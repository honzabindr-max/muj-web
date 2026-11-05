// Etapa 4 PR 3 (DR-042 v6.2, návrh v6 §4, mapa v4 §2.3 + v5/v6 doplňky): ACK v poli „Přijetí TARS“ řádku Inboxu.
// Efekt `inbox-<e8>/ack/r<n>`, zmrazený text v ACK ledgeru `runs/inbox/ack/<event_id>/r<n>.json` (publishOnce, nikdy
// writeDurable), PATCH jen jedné vlastnosti, úplný read-back, tabulka replay. Každý PATCH předchází záměr odeslání
// (N-12) a každý ledger se přijme až po doložené trvanlivosti (N-11).
import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  EffectJournal,
  effectSurelyAbsent,
  operationId,
  type EffectRecord,
} from "../effects";
import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import {
  InboxHold,
  assertLease,
  assertRun,
  event8,
  sha256Hex,
  type InboxHoldCode,
  type InboxMode,
  type LeaseView,
} from "./common";
import type { InboxEvent } from "./event";
import { jsonBytes, type InboxHttp } from "./http";
import { ACK_PROPERTY, readTextProperty, textOf, type Deadline } from "./read";
import { assertPreparedAttempt, claimSend } from "./send-intent";

/** Stavy ACK (v6 §4). `NOTION_VISIBLE` je úroveň důkazu (read-back), ne text. */
export type AckState =
  | "ACKED"
  | "CLAIMED"
  | "SUPERSEDED"
  | "REJECTED_SCOPE"
  | "NEEDS_OWNER"
  | "LATE"
  | `HOLD(${string})`;

const HOLD_STATE_RE = /^HOLD\([A-Z0-9_]{1,40}\)$/;
const isAckState = (s: string): s is AckState =>
  [
    "ACKED",
    "CLAIMED",
    "SUPERSEDED",
    "REJECTED_SCOPE",
    "NEEDS_OWNER",
    "LATE",
  ].includes(s) || HOLD_STATE_RE.test(s);

/**
 * Monotónní přechody (v6 §4): r0 je vždy ACKED; z ACKED do CLAIMED | SUPERSEDED | REJECTED_SCOPE | NEEDS_OWNER | LATE |
 * HOLD(x); z CLAIMED jen do HOLD(REVOKED). Ostatní stavy jsou koncové.
 */
export function ackTransitionAllowed(
  prev: AckState | undefined,
  next: AckState,
): boolean {
  if (prev === undefined) return next === "ACKED";
  if (prev === "ACKED") return next !== "ACKED";
  if (prev === "CLAIMED") return next === "HOLD(REVOKED)";
  return false;
}

/** Text kroku: `<STAV> · <e8> · <čas UTC na minuty>`, např. `ACKED · 3f2a9c1b · 2026-11-05T10:00Z` (mapa v2 §2.1). */
export function ackText(state: AckState, eventId: string, at: string): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) throw new Error("ackText: neplatný čas");
  return `${state} · ${event8(eventId)} · ${t.toISOString().slice(0, 16)}Z`;
}

export interface AckLedger {
  ledger_version: 1;
  event_id: string;
  n: number;
  state: AckState;
  text: string;
  text_sha256: string;
  prev_text_sha256: string;
  decided_at: string;
  fence: number;
  /**
   * Náhodné ID zapisovatele (16 B hex). Dva souběžní zapisovatelé mají vždy jiné bajty i při shodném fence a čase
   * (simulovaná chyba lease, T23), takže prohrávající dostane CONFLICT, nikdy IDENTICAL.
   */
  writer?: string;
}

export const EMPTY_TEXT_SHA256 = sha256Hex("");

export const ackLedgerFile = (
  runsDir: string,
  eventId: string,
  n: number,
): string => path.join(runsDir, "inbox", "ack", eventId, `r${n}.json`);
export const ackOp = (eventId: string, n: number): string =>
  operationId(`inbox-${event8(eventId)}`, "ack", n);

/** V-pravidla ACK ledgeru (mapa v5 §2.3): nečitelný JSON, chybějící text nebo nesedící hash = `ACK_LEDGER_CORRUPT`. */
export function parseAckLedger(
  bytes: Buffer,
  eventId: string,
  n: number,
): AckLedger {
  let v: AckLedger;
  try {
    v = JSON.parse(bytes.toString("utf8")) as AckLedger;
  } catch {
    throw new InboxHold("ACK_LEDGER_CORRUPT", `r${n}: ledger nejde přečíst`);
  }
  const ok =
    v?.ledger_version === 1 &&
    v.event_id === eventId &&
    v.n === n &&
    typeof v.state === "string" &&
    isAckState(v.state) &&
    typeof v.text === "string" &&
    typeof v.text_sha256 === "string" &&
    sha256Hex(v.text) === v.text_sha256 &&
    typeof v.prev_text_sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(v.prev_text_sha256) &&
    typeof v.decided_at === "string" &&
    Number.isInteger(v.fence) &&
    (v.writer === undefined ||
      (typeof v.writer === "string" && /^[0-9a-f]{32}$/.test(v.writer)));
  if (!ok)
    throw new InboxHold(
      "ACK_LEDGER_CORRUPT",
      `r${n}: ledger má chybný tvar nebo hash`,
    );
  return v;
}

function readAckLedger(
  runsDir: string,
  eventId: string,
  n: number,
  opts: PublishOptions,
): AckLedger | undefined {
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(
      ackLedgerFile(runsDir, eventId, n),
      rooted(runsDir, opts),
    );
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  return r.state === "absent" ? undefined : parseAckLedger(r.bytes, eventId, n);
}

/** Klient pro Inbox smí zapsat jen `Přijetí TARS` (mapa v2 §2.1). Jiný klíč = výjimka před odesláním, 0 HTTP. */
export function assertAckPatchAllowlist(body: unknown): void {
  const b = body as { properties?: unknown };
  const keys = b && typeof b === "object" ? Object.keys(b) : [];
  const props =
    b?.properties && typeof b.properties === "object"
      ? Object.keys(b.properties as object)
      : [];
  if (
    keys.length !== 1 ||
    keys[0] !== "properties" ||
    props.length !== 1 ||
    props[0] !== ACK_PROPERTY
  )
    throw new Error(
      `zápis do Inboxu smí měnit jen „${ACK_PROPERTY}“, PATCH se neodešle`,
    );
}

export interface AckCtx {
  http: InboxHttp;
  runsDir: string;
  journal: EffectJournal;
  lease: LeaseView;
  mode: InboxMode;
  event: InboxEvent;
  /** id vlastnosti `Přijetí TARS` ze schématu Inboxu načteného v tomto ticku */
  ackPropertyId: string;
  now: () => string;
  deadline?: Deadline;
  publish?: PublishOptions;
  /** Jen testy: zastavení/pád v bodech toku (např. „before-patch“). */
  point?: (
    p:
      | "ledger-published"
      | "intent-published"
      | "prepared"
      | "before-patch"
      | "patched",
  ) => void;
}

export type AckOutcome =
  | {
      kind: "done";
      n: number;
      text: string;
      readback_sha256: string;
      recovered: boolean;
    }
  | { kind: "noop"; n: number }
  | { kind: "hold"; code: InboxHoldCode; detail: string };

async function readBack(ctx: AckCtx): Promise<string> {
  try {
    return textOf(
      await readTextProperty(
        ctx.http,
        ctx.event.page_id,
        ctx.ackPropertyId,
        "rich_text",
        { deadline: ctx.deadline },
      ),
    );
  } catch (e) {
    throw new InboxHold(
      "ACK_UNREADABLE",
      e instanceof Error ? e.message : String(e),
    );
  }
}

const rowUrl = (pageId: string): string => `https://www.notion.so/${pageId}`;

function subjectOk(ctx: AckCtx, j: EffectRecord | undefined): void {
  if (j && j.subject !== ctx.event.event_id)
    throw new InboxHold(
      "EVENT8_COLLISION",
      `${j.operation_id} patří jiné události`,
    );
}

async function send(
  ctx: AckCtx,
  op: string,
  rec: EffectRecord | undefined,
  L: AckLedger,
): Promise<AckOutcome> {
  assertRun(ctx.mode, "ACK PATCH");
  const attempt = claimSend({
    runsDir: ctx.runsDir,
    op,
    record: rec,
    lease: ctx.lease,
    contentHash: L.text_sha256,
    now: ctx.now,
    publish: ctx.publish,
  });
  ctx.point?.("intent-published");
  assertLease(ctx.lease, "před prepare ACK");
  const prepared = ctx.journal.prepare(op, {
    content_hash: L.text_sha256,
    subject: ctx.event.event_id,
  });
  assertPreparedAttempt(prepared, attempt);
  ctx.point?.("prepared");
  const body = {
    properties: {
      [ACK_PROPERTY]: {
        rich_text: [{ type: "text", text: { content: L.text } }],
      },
    },
  };
  assertAckPatchAllowlist(body);
  assertLease(ctx.lease, "před PATCH");
  ctx.point?.("before-patch");
  try {
    await ctx.http.send({
      method: "PATCH",
      path: `/v1/pages/${ctx.event.page_id}`,
      body: jsonBytes(body),
    });
  } catch (e) {
    if (effectSurelyAbsent(e)) {
      ctx.journal.absent(
        op,
        `PATCH čistě odmítnut: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
      );
      return {
        kind: "hold",
        code: "EFFECT_RETRY",
        detail: `${op}: PATCH odmítnut před zápisem, další tick stejný text`,
      };
    }
    ctx.journal.note(
      op,
      `PATCH s nejistým výsledkem: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
    );
    return {
      kind: "hold",
      code: "EFFECT_PENDING",
      detail: `${op}: výsledek PATCH neznámý, další tick rozhodne read-back`,
    };
  }
  ctx.point?.("patched");
  const rb = await readBack(ctx);
  const h = sha256Hex(rb);
  if (h !== L.text_sha256)
    throw new InboxHold("ACK_MISMATCH", `${op}: read-back po PATCH nesedí`);
  assertLease(ctx.lease, "před done ACK");
  ctx.journal.done(op, { url: rowUrl(ctx.event.page_id) }, { content_hash: h });
  return {
    kind: "done",
    n: L.n,
    text: L.text,
    readback_sha256: h,
    recovered: false,
  };
}

/**
 * FIX1 (Codex kolo 1, nález 2): před každým opakovaným PATCH (ledger z dřívějška, EFFECT_ABSENT) se přečte aktuální
 * „Přijetí TARS“. PATCH smí odejít jen tehdy, když pole stále nese text, ze kterého ledger vychází
 * (`prev_text_sha256`). Cokoli jiného, včetně změny vlastníka mezi pokusy, je `ACK_MISMATCH` (HOLD): nic se nepřepíše.
 */
async function assertBeforeRetry(
  ctx: AckCtx,
  op: string,
  L: AckLedger,
): Promise<void> {
  assertRun(ctx.mode, "ACK PATCH");
  const rb = sha256Hex(await readBack(ctx));
  if (rb !== L.prev_text_sha256)
    throw new InboxHold(
      "ACK_MISMATCH",
      `${op}: Přijetí TARS se před opakovaným zápisem změnilo, bez přepisu`,
    );
}

/**
 * Jeden krok ACK pro událost: dokončí rozpracovaný krok r<k> podle tabulky mapy v4 §2.3, nebo (když jsou všechny
 * předchozí `EFFECT_DONE`) založí krok r<n> se stavem `desired`. Nikdy nepočítá text znovu (R2-ACK), nikdy nezačne
 * r<n+1> před `EFFECT_DONE` r<n> (R1-ACK), nový PATCH jen z prázdného stavu nebo z `EFFECT_ABSENT` (R3-ACK).
 */
export async function ackStep(
  ctx: AckCtx,
  desired: AckState,
): Promise<AckOutcome> {
  try {
    return await ackStepInner(ctx, desired);
  } catch (e) {
    if (e instanceof InboxHold)
      return { kind: "hold", code: e.code, detail: e.message };
    throw e;
  }
}

async function ackStepInner(
  ctx: AckCtx,
  desired: AckState,
): Promise<AckOutcome> {
  const ev = ctx.event;
  const opts = rooted(ctx.runsDir, ctx.publish);
  let lastDone: AckLedger | undefined;
  let n = 0;
  let rec: EffectRecord | undefined;
  let L: AckLedger | undefined;
  for (; ; n++) {
    const op = ackOp(ev.event_id, n);
    rec = ctx.journal.get(op);
    subjectOk(ctx, rec);
    L = readAckLedger(ctx.runsDir, ev.event_id, n, opts);
    if (rec?.state !== "EFFECT_DONE") break;
    if (!L)
      throw new InboxHold(
        "ACK_LEDGER_MISSING",
        `${op}: EFFECT_DONE bez ledgeru`,
      );
    lastDone = L;
  }
  const op = ackOp(ev.event_id, n);

  if (!rec) {
    if (lastDone) {
      const rb = await readBack(ctx);
      if (sha256Hex(rb) !== lastDone.text_sha256)
        throw new InboxHold(
          "ACK_MISMATCH",
          `r${lastDone.n}: Přijetí TARS se změnilo, bez přepisu`,
        );
    }
    if (L) {
      if (L.prev_text_sha256 !== (lastDone?.text_sha256 ?? EMPTY_TEXT_SHA256))
        throw new InboxHold(
          "ACK_LEDGER_CORRUPT",
          `${op}: prev_text_sha256 nesedí na předchozí krok`,
        );
      await assertBeforeRetry(ctx, op, L);
      return send(ctx, op, rec, L); // ledger z předchozího pokusu: jeho text, ne nově spočítaný (R2-ACK)
    }
    if (lastDone?.state === desired) return { kind: "noop", n: lastDone.n };
    if (!ackTransitionAllowed(lastDone?.state, desired))
      throw new InboxHold(
        "ACK_TRANSITION",
        `${lastDone?.state ?? "∅"} → ${desired}`,
      );
    assertRun(ctx.mode, "ACK ledger");
    const at = ctx.now();
    const text = ackText(desired, ev.event_id, at);
    if (text.length > 2000) throw new Error("ACK text nad strop U5");
    const ledger: AckLedger = {
      ledger_version: 1,
      event_id: ev.event_id,
      n,
      state: desired,
      text,
      text_sha256: sha256Hex(text),
      prev_text_sha256: lastDone?.text_sha256 ?? EMPTY_TEXT_SHA256,
      decided_at: at,
      fence: ctx.lease.fence,
      writer: randomBytes(16).toString("hex"),
    };
    assertLease(ctx.lease, "před publikací ACK ledgeru");
    let r: string;
    try {
      r = publishOnce(
        ackLedgerFile(ctx.runsDir, ev.event_id, n),
        JSON.stringify(ledger, null, 2) + "\n",
        opts,
      );
    } catch (e) {
      if (e instanceof LedgerPublishUnsupported)
        throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
      if (e instanceof DurabilityHold)
        throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
      throw e;
    }
    if (r === "CONFLICT")
      throw new InboxHold(
        "ACK_LEDGER_CONFLICT",
        `${op}: ledger existuje s jiným obsahem`,
      );
    ctx.point?.("ledger-published");
    const back = readAckLedger(ctx.runsDir, ev.event_id, n, opts);
    if (!back)
      throw new InboxHold(
        "LEDGER_NOT_DURABLE",
        `${op}: ledger po publikaci chybí`,
      );
    assertLease(ctx.lease, "po publikaci ACK ledgeru");
    return send(ctx, op, rec, back);
  }

  if (!L)
    throw new InboxHold(
      "ACK_LEDGER_MISSING",
      `${op}: journal ${rec.state} bez ledgeru (pořadí ledger → prepare porušeno)`,
    );
  if (rec.content_hash !== L.text_sha256)
    throw new InboxHold(
      "ACK_LEDGER_CONFLICT",
      `${op}: journal content_hash ≠ text_sha256 ledgeru`,
    );

  if (rec.state === "EFFECT_UNKNOWN")
    throw new InboxHold("EFFECT_UNKNOWN", `${op}: rozhoduje vlastník`);
  if (rec.state === "EFFECT_ABSENT") {
    await assertBeforeRetry(ctx, op, L);
    return send(ctx, op, rec, L); // R3-ACK: stejný operation_id, stejný text
  }

  // PREPARED: výsledek posledního pokusu neznámý → jen read-back, nikdy slepý PATCH
  const rb = sha256Hex(await readBack(ctx));
  if (rb === L.text_sha256) {
    assertLease(ctx.lease, "před done(recovered) ACK");
    ctx.journal.done(
      op,
      { url: rowUrl(ev.page_id) },
      { content_hash: rb, recovered: true },
    );
    return {
      kind: "done",
      n,
      text: L.text,
      readback_sha256: rb,
      recovered: true,
    };
  }
  if (rb === L.prev_text_sha256) {
    assertLease(ctx.lease, "před EFFECT_UNKNOWN ACK");
    ctx.journal.unknown(
      op,
      "read-back = předchozí text, zápis se neprojevil nebo je neznámý (bez slepého retry)",
    );
    throw new InboxHold(
      "EFFECT_UNKNOWN",
      `${op}: zápis se neprojevil, rozhoduje vlastník`,
    );
  }
  throw new InboxHold(
    "ACK_MISMATCH",
    `${op}: read-back je jiný text, bez přepisu`,
  );
}
