// Etapa 4 PR 3 (návrh v6 §2.1, §4; mapa v2 §2.1, v4 §8): událost podání z řádku Inboxu. Identita `event_id`,
// `payload_hash` z úplně přečteného whitelistu, zápis `runs/inbox/events/<event_id>.json` jen jednou (publishOnce),
// `ack_durable` `runs/inbox/ack/<event_id>.json`. Producent ani ACK nic neodemykají.
import path from "node:path";

import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  rooted,
  type PublishOptions,
} from "../publish";
import { EVENT_ID_RE, InboxHold, sha256Hex, type LeaseView } from "./common";
import {
  checkProducer,
  type Producer,
  type TrustedIdentities,
} from "./identity";
import type { InboxHttp } from "./http";
import {
  readInboxPayload,
  type CompletePayload,
  type CompleteScan,
  type DataSourceSchema,
  type Deadline,
  type NotionPageObject,
} from "./read";

export interface InboxEvent {
  v: 1;
  event_id: string;
  page_id: string;
  request_id: string;
  generation: number;
  supersedes: string | null;
  producer: Producer;
  /** autor řádku R (ID z page objectu, ověřené resolverem proti důvěryhodné mapě) */
  created_by_id: string;
  payload_hash: string;
  observed_at: string;
  observed_fence: number;
}

/** `event_id = sha256(page_id | request_id | generation)[:32]` (návrh v6 §2.1). */
export function eventId(
  pageId: string,
  requestId: string,
  generation: number,
): string {
  return sha256Hex(
    `${pageId.replace(/-/g, "").toLowerCase()}|${requestId}|${generation}`,
  ).slice(0, 32);
}

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Identita podání z úplného payloadu. Chybí nebo je neplatná = `INVALID_IDENTITY` (TARS si nic nedomýšlí). */
export function identityOf(p: CompletePayload): {
  request_id: string;
  generation: number;
  supersedes: string | null;
  producer: string | null;
} {
  const rid = p.values.request_id;
  const gen = p.values.generation;
  const sup = p.values.supersedes;
  const request_id = Array.isArray(rid) ? rid.join("") : "";
  if (!REQUEST_ID_RE.test(request_id))
    throw new InboxHold(
      "INVALID_IDENTITY",
      "request_id chybí nebo je neplatné",
    );
  if (typeof gen !== "number" || !Number.isSafeInteger(gen) || gen < 1)
    throw new InboxHold(
      "INVALID_IDENTITY",
      "generation chybí nebo není celé číslo ≥ 1",
    );
  const s = Array.isArray(sup) ? sup.join("") : "";
  if (s && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}#[1-9][0-9]*$/.test(s))
    throw new InboxHold(
      "INVALID_IDENTITY",
      "supersedes není request_id#generation",
    );
  const prod = p.values.Producent;
  return {
    request_id,
    generation: gen,
    supersedes: s || null,
    producer: typeof prod === "string" ? prod : null,
  };
}

export const eventFile = (runsDir: string, id: string): string =>
  path.join(runsDir, "inbox", "events", `${id}.json`);
export const ackDurableFile = (runsDir: string, id: string): string =>
  path.join(runsDir, "inbox", "ack", `${id}.json`);

/** Klíč identity `request_id#generation`. */
export const rqKey = (requestId: string, generation: number): string =>
  `${requestId}#${generation}`;

/**
 * Dvojice v úplném Inboxu (v6 §2.1): dva a víc řádků se stejným `request_id#generation` = všechny HOLD `DUPLICATE`.
 * Vstupem jsou identity řádků, které prošly úplným čtením; vrací množinu klíčů, které se nesmí zpracovat.
 */
export function duplicateKeys(
  identities: ReadonlyArray<{ page_id: string; key: string }>,
): Set<string> {
  const pages = new Map<string, Set<string>>();
  for (const x of identities)
    pages.set(x.key, (pages.get(x.key) ?? new Set()).add(x.page_id));
  return new Set([...pages].filter(([, p]) => p.size > 1).map(([k]) => k));
}

/** SUPERSEDED určuje jen producent: kolo g je nahrazené, když existuje kolo g+k se stejným request_id (v6 §2.1). */
export function isSuperseded(
  ev: Pick<InboxEvent, "request_id" | "generation">,
  all: ReadonlyArray<Pick<InboxEvent, "request_id" | "generation">>,
): boolean {
  return all.some(
    (x) => x.request_id === ev.request_id && x.generation > ev.generation,
  );
}

function parseEvent(bytes: Buffer, id: string): InboxEvent {
  let v: InboxEvent;
  try {
    v = JSON.parse(bytes.toString("utf8")) as InboxEvent;
  } catch {
    throw new InboxHold("EVENT_CONFLICT", `událost ${id} nejde přečíst`);
  }
  if (
    v?.v !== 1 ||
    v.event_id !== id ||
    typeof v.payload_hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(v.payload_hash)
  )
    throw new InboxHold("EVENT_CONFLICT", `událost ${id} má chybný tvar`);
  return v;
}

/** Uložená událost (N-11: jen po doložené trvanlivosti), undefined = zatím nepozorovaná. */
export function readEvent(
  runsDir: string,
  id: string,
  opts: PublishOptions = {},
): InboxEvent | undefined {
  if (!EVENT_ID_RE.test(id))
    throw new InboxHold("INVALID_IDENTITY", "neplatné event_id");
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(eventFile(runsDir, id), rooted(runsDir, opts));
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  return r.state === "absent" ? undefined : parseEvent(r.bytes, id);
}

/**
 * FIX1 (Codex kolo 1, nález 3): neměnná vazba řádku na první pozorovanou identitu podání.
 * `runs/inbox/pages/<page_id>.json` vzniká jen jednou (publishOnce) a nikdy se nepřepíše. Obsah je deterministický
 * (bez času), takže dva souběžní pozorovatelé téže identity dostanou IDENTICAL, nikdy CONFLICT.
 */
export interface PageBinding {
  v: 1;
  page_id: string;
  request_id: string;
  generation: number;
  event_id: string;
}

export const pageBindingFile = (runsDir: string, pageId: string): string =>
  path.join(runsDir, "inbox", "pages", `${pageId}.json`);

function parseBinding(bytes: Buffer, pageId: string): PageBinding {
  let v: PageBinding;
  try {
    v = JSON.parse(bytes.toString("utf8")) as PageBinding;
  } catch {
    throw new InboxHold(
      "EVENT_CONFLICT",
      `vazba řádku ${pageId} nejde přečíst`,
    );
  }
  if (
    v?.v !== 1 ||
    v.page_id !== pageId ||
    typeof v.request_id !== "string" ||
    !Number.isSafeInteger(v.generation) ||
    typeof v.event_id !== "string" ||
    !EVENT_ID_RE.test(v.event_id)
  )
    throw new InboxHold(
      "EVENT_CONFLICT",
      `vazba řádku ${pageId} má chybný tvar`,
    );
  return v;
}

/** Uložená vazba řádku (N-11: jen po doložené trvanlivosti), undefined = řádek ještě nebyl pozorován. */
export function readPageBinding(
  runsDir: string,
  pageId: string,
  opts: PublishOptions = {},
): PageBinding | undefined {
  if (!EVENT_ID_RE.test(pageId))
    throw new InboxHold("INVALID_IDENTITY", "neplatné page_id");
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(pageBindingFile(runsDir, pageId), rooted(runsDir, opts));
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  return r.state === "absent" ? undefined : parseBinding(r.bytes, pageId);
}

/** Jiná identita na už vázaném řádku = `MUTATED` (HOLD): nová událost, ACK ani scope karta nevznikne. */
function assertSameIdentity(bound: PageBinding, want: PageBinding): void {
  if (
    bound.event_id !== want.event_id ||
    bound.request_id !== want.request_id ||
    bound.generation !== want.generation
  )
    throw new InboxHold(
      "MUTATED",
      `řádek ${want.page_id} je vázán na ${rqKey(bound.request_id, bound.generation)}, teď nese ${rqKey(want.request_id, want.generation)}; identita podání se na řádku nemění, nové kolo = nový řádek`,
    );
}

/** Vazbu ověří; chybí-li, založí ji (jen s platným lease). CONFLICT = vazbu mezitím založil jiný proces: porovná se uložená. */
function bindPage(inp: ObserveInput, want: PageBinding): void {
  const bound = readPageBinding(inp.runsDir, want.page_id, inp.publish);
  if (bound) return assertSameIdentity(bound, want);
  if (!inp.lease.holds())
    throw new InboxHold("LEASE_LOST", "před zápisem vazby řádku");
  let r: string;
  try {
    r = publishOnce(
      pageBindingFile(inp.runsDir, want.page_id),
      JSON.stringify(want, null, 2) + "\n",
      rooted(inp.runsDir, inp.publish),
    );
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r === "CONFLICT")
    assertSameIdentity(
      readPageBinding(inp.runsDir, want.page_id, inp.publish)!,
      want,
    );
}

export interface ObserveInput {
  http: InboxHttp;
  runsDir: string;
  row: NotionPageObject;
  schema: DataSourceSchema;
  /** úplný průchod Inboxu z tohoto ticku (DUPLICATE se počítá jen z něj) */
  scan: CompleteScan;
  /** identity všech řádků úplného průchodu (klíč request_id#generation) */
  identities: ReadonlyArray<{ page_id: string; key: string }>;
  trusted: TrustedIdentities;
  lease: LeaseView;
  now: () => string;
  deadline?: Deadline;
  publish?: PublishOptions;
}

export type ObserveResult =
  | { kind: "new"; event: InboxEvent }
  | { kind: "seen"; event: InboxEvent };

/**
 * První pozorování nebo opakované pozorování řádku R (v6 §2.1). Úplné čtení whitelistu → identita → producent →
 * `event_id` → zápis jen jednou. Existuje-li událost, `payload_hash` musí sedět (jinak `MUTATED`). Souběžný první
 * zápis jiným procesem (CONFLICT) se nepřepíše: platí uložená událost a porovná se její `payload_hash`.
 */
export async function observeRow(inp: ObserveInput): Promise<ObserveResult> {
  const page_id = inp.row.id.replace(/-/g, "").toLowerCase();
  if (
    !inp.scan.rows.some((r) => r.id.replace(/-/g, "").toLowerCase() === page_id)
  )
    throw new InboxHold(
      "INBOX_SCAN_INCOMPLETE",
      "řádek není v úplném průchodu tohoto ticku",
    );
  const payload = await readInboxPayload(inp.http, inp.row, inp.schema, {
    deadline: inp.deadline,
  });
  const id = identityOf(payload);
  if (duplicateKeys(inp.identities).has(rqKey(id.request_id, id.generation)))
    throw new InboxHold("DUPLICATE", rqKey(id.request_id, id.generation));
  const producer = await checkProducer(
    inp.http,
    inp.row,
    id.producer,
    inp.trusted,
  );
  const event_id = eventId(page_id, id.request_id, id.generation);
  // FIX1 nález 3: řádek je navždy vázán na první pozorovanou identitu; změna request_id/generation = MUTATED dřív,
  // než by nový event_id vedl na jiný soubor události (a tím na druhé ACK nebo druhou scope kartu).
  bindPage(inp, {
    v: 1,
    page_id,
    request_id: id.request_id,
    generation: id.generation,
    event_id,
  });
  const existing = readEvent(inp.runsDir, event_id, inp.publish);
  if (existing) {
    if (existing.payload_hash !== payload.payload_hash)
      throw new InboxHold(
        "MUTATED",
        `podání ${rqKey(id.request_id, id.generation)} upraveno, založ nové kolo`,
      );
    return { kind: "seen", event: existing };
  }
  if (!inp.lease.holds())
    throw new InboxHold("LEASE_LOST", "před zápisem události");
  const ev: InboxEvent = {
    v: 1,
    event_id,
    page_id,
    request_id: id.request_id,
    generation: id.generation,
    supersedes: id.supersedes,
    producer,
    created_by_id: inp.row.created_by!.id as string,
    payload_hash: payload.payload_hash,
    observed_at: inp.now(),
    observed_fence: inp.lease.fence,
  };
  let r: string;
  try {
    r = publishOnce(
      eventFile(inp.runsDir, event_id),
      JSON.stringify(ev, null, 2) + "\n",
      rooted(inp.runsDir, inp.publish),
    );
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  if (r === "CONFLICT") {
    const other = readEvent(inp.runsDir, event_id, inp.publish)!;
    if (other.payload_hash !== payload.payload_hash)
      throw new InboxHold(
        "MUTATED",
        `podání ${rqKey(id.request_id, id.generation)} upraveno`,
      );
    return { kind: "seen", event: other };
  }
  return { kind: "new", event: ev };
}

/** `ack_durable` (v6 §4): `runs/inbox/ack/<event_id>.json` jen jednou; vrací sha256 uloženého obsahu. */
export function writeAckDurable(
  runsDir: string,
  ev: InboxEvent,
  at: string,
  opts: PublishOptions = {},
): string {
  const content =
    JSON.stringify(
      {
        v: 1,
        event_id: ev.event_id,
        state: "ACKED",
        payload_hash: ev.payload_hash,
        at,
      },
      null,
      2,
    ) + "\n";
  const f = ackDurableFile(runsDir, ev.event_id);
  opts = rooted(runsDir, opts);
  let r: string;
  try {
    r = publishOnce(f, content, opts);
  } catch (e) {
    if (e instanceof LedgerPublishUnsupported)
      throw new InboxHold("LEDGER_PUBLISH_UNSUPPORTED", e.message);
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  const got = readPublished(f, opts);
  if (got.state !== "present")
    throw new InboxHold("LEDGER_NOT_DURABLE", "ack_durable zmizel");
  if (r === "CONFLICT") {
    const v = JSON.parse(got.bytes.toString("utf8")) as {
      event_id?: unknown;
      payload_hash?: unknown;
    };
    if (v.event_id !== ev.event_id || v.payload_hash !== ev.payload_hash)
      throw new InboxHold("EVENT_CONFLICT", "ack_durable patří jinému podání");
  }
  return sha256Hex(got.bytes);
}
