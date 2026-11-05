// Etapa 4 PR 3 (DR-042: scope karta = samostatný řádek panelu, GO jen vlastník na panelu; mapa v4 §3.3–§3.6,
// v5 §3.3/§3.4/§3.7, v6 §3.3/§3.3a). Efekt `inbox-<e8>/scope-card/r0`: TARS jednou sestaví celé tělo POST, zapíše ho
// do scope ledgeru `runs/inbox/scope/<event_id>/r0.json` přes publishOnce (create-only), a každý POST (první i replay)
// pošle bajty z ledgeru. V režimu hold jen čtení a příprava v paměti (v6 §14 PR 3): 0 ledger, 0 journal, 0 HTTP zápis.
import { randomBytes } from "node:crypto";
import path from "node:path";

import {
  EffectJournal,
  effectSurelyAbsent,
  operationId,
  type EffectRecord,
} from "../effects";
import { NotionRestError, pageIdFromUrl, setsOwnerDecision } from "../notion";
import {
  DurabilityHold,
  LedgerPublishUnsupported,
  publishOnce,
  readPublished,
  type PublishOptions,
} from "../publish";
import {
  InboxHold,
  assertLease,
  assertRun,
  canonicalJson,
  event8,
  sha256Hex,
  type InboxHoldCode,
  type InboxMode,
  type LeaseView,
} from "./common";
import { rqKey, type InboxEvent } from "./event";
import type { InboxHttp } from "./http";
import {
  checkScopeAuthor,
  checkTrustedMap,
  type TrustedIdentities,
} from "./identity";
import {
  readInboxIdentities,
  readInboxPayload,
  readSchema,
  readTextProperty,
  scanDataSource,
  textOf,
  type CompleteScan,
  type DataSourceSchema,
  type Deadline,
} from "./read";
import { assertPreparedAttempt, claimSend } from "./send-intent";

export const SCOPE_METHOD = "POST";
export const SCOPE_PATH = "/v1/pages";
/** Titulková vlastnost panelu. */
export const PANEL_TITLE_PROPERTY = "Zakázka";

export const scopeOp = (eventId: string): string =>
  operationId(`inbox-${event8(eventId)}`, "scope-card", 0);
export const scopeLedgerFile = (runsDir: string, eventId: string): string =>
  path.join(runsDir, "inbox", "scope", eventId, "r0.json");
export const scopeOrderId = (
  ev: Pick<InboxEvent, "request_id" | "generation">,
): string => `rq:${rqKey(ev.request_id, ev.generation)}`;

/** Panel, do kterého smí scope karta jít (z konfigurace TARS, ne z ledgeru). */
export interface PanelConfig {
  data_source_id: string;
}

/** Řádek panelu přečtený úplně (titulek a `ID zakázky` přes endpoint vlastnosti, U3). */
export interface PanelCard {
  page_id: string;
  created_by?: { object?: unknown; id?: unknown };
  in_trash: boolean;
  id_zakazky: string;
  title: string;
  karta_url: string | null;
  stav: string | null;
}

/** Úplné čtení jednoho ticku, ze kterého se rozhoduje o POST, adopci a receiptu (mapa v4 §3.3 předpoklady 1–5). */
export interface ScopeSnapshot {
  inbox: CompleteScan;
  /** identity všech řádků úplného Inboxu (page_id, request_id#generation) */
  inboxRows: ReadonlyArray<{ page_id: string; key: string }>;
  /** payload_hash řádku R z úplného čtení v tomto ticku */
  rPayloadHash: string;
  /** úplně přečtený titulek `Požadavek` řádku R */
  requestTitle: string;
  panel: CompleteScan;
  panelCards: readonly PanelCard[];
}

// ---------- značky titulku ----------

const TAG_RE = /\[(op|ev|ph|nx):([^\]\s]*)\]/g;

/** Všechny hodnoty značky daného druhu v titulku. */
export function tagValues(
  title: string,
  kind: "op" | "ev" | "ph" | "nx",
): string[] {
  return [...title.matchAll(TAG_RE)]
    .filter((m) => m[1] === kind)
    .map((m) => m[2]);
}

const exactlyOne = (
  title: string,
  kind: "op" | "ev" | "ph" | "nx",
  want: string,
): boolean => {
  const v = tagValues(title, kind);
  return v.length === 1 && v[0] === want;
};

/** Titulek S: `<Požadavek z R> [op:…] [ev:…] [ph:…] [nx:…]`; lidská část se zkrátí, značky vždy zůstanou (≤ 2000 znaků). */
export function scopeTitle(
  requestTitle: string,
  ev: InboxEvent,
  nonce: string,
): string {
  const tags = `[op:${scopeOp(ev.event_id)}] [ev:${ev.event_id}] [ph:${ev.payload_hash.slice(0, 16)}] [nx:${nonce}]`;
  const human = requestTitle
    .replace(TAG_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000 - tags.length - 1);
  return `${human} ${tags}`;
}

// ---------- sestavení těla (jen v cestě „ledger chybí“) ----------

export interface BodyInput {
  event: InboxEvent;
  panelDataSourceId: string;
  requestTitle: string;
  nonce: string;
}
export type BodyBuilder = (inp: BodyInput) => Record<string, unknown>;

/** Výchozí sestavení těla POST S (vlastnosti S podle mapy v2 §3.1 (5) a v4 §3.3). Bez „Rozhodnutí vlastníka“ (P20). */
export const buildScopeBody: BodyBuilder = ({
  event,
  panelDataSourceId,
  requestTitle,
  nonce,
}) => ({
  parent: { type: "data_source_id", data_source_id: panelDataSourceId },
  properties: {
    [PANEL_TITLE_PROPERTY]: {
      title: [
        {
          type: "text",
          text: { content: scopeTitle(requestTitle, event, nonce) },
        },
      ],
    },
    "ID zakázky": {
      rich_text: [{ type: "text", text: { content: scopeOrderId(event) } }],
    },
    "Karta rozhodnutí": { url: `https://www.notion.so/${event.page_id}` },
    Stav: { select: { name: "WAITING_OWNER" } },
    Fronta: { select: { name: "1 · Čeká na vlastníka" } },
    "Čeká na vlastníka": { checkbox: true },
    "Kde běží": { select: { name: "Mac" } },
  },
});

const richText = (v: unknown): string | undefined => {
  const arr =
    (v as { rich_text?: unknown; title?: unknown } | undefined)?.rich_text ??
    (v as { title?: unknown } | undefined)?.title;
  if (!Array.isArray(arr)) return undefined;
  let s = "";
  for (const seg of arr as Array<{ text?: { content?: unknown } }>) {
    if (typeof seg?.text?.content !== "string") return undefined;
    s += seg.text.content;
  }
  return s;
};

/** Titulek z těla POST (vlastnost `Zakázka`). */
export function bodyTitle(body: unknown): string | undefined {
  return richText(
    (body as { properties?: Record<string, unknown> })?.properties?.[
      PANEL_TITLE_PROPERTY
    ],
  );
}

/**
 * V7 (mapa v6 §3.3): význam těla odpovídá události a panelu. `parent` = panel z konfigurace, `ID zakázky` = zakázka
 * události, `Karta rozhodnutí` = řádek R, titulek nese přesně jednu `[op]`, `[ev]`, `[ph]` této události. Kontroluje
 * se nad kandidátem PŘED publikací ledgeru a nad ledgerem před každým POST, při adopci a po POST.
 */
export function checkBodySemantics(
  body: unknown,
  ev: InboxEvent,
  panel: PanelConfig,
): void {
  const fail = (why: string): never => {
    throw new InboxHold("SCOPE_BODY_SEMANTIC_MISMATCH", why);
  };
  const b = body as {
    parent?: { type?: unknown; data_source_id?: unknown };
    properties?: Record<string, unknown>;
  };
  if (!b || typeof b !== "object" || !b.properties) fail("tělo bez vlastností");
  if (
    b.parent?.type !== "data_source_id" ||
    b.parent?.data_source_id !== panel.data_source_id
  )
    fail("parent nemíří na panel z konfigurace");
  if (richText(b.properties!["ID zakázky"]) !== scopeOrderId(ev))
    fail("ID zakázky nepatří události");
  const url = (
    b.properties!["Karta rozhodnutí"] as { url?: unknown } | undefined
  )?.url;
  if (typeof url !== "string" || pageIdFromUrl(url) !== ev.page_id)
    fail("Karta rozhodnutí neukazuje na řádek R");
  const t = bodyTitle(body);
  if (t === undefined) fail("tělo bez titulku");
  if (
    !exactlyOne(t!, "op", scopeOp(ev.event_id)) ||
    !exactlyOne(t!, "ev", ev.event_id) ||
    !exactlyOne(t!, "ph", ev.payload_hash.slice(0, 16))
  )
    fail("značky [op]/[ev]/[ph] nesedí na událost");
  if (setsOwnerDecision(body))
    fail("tělo nastavuje Rozhodnutí vlastníka (P20)");
}

// ---------- scope ledger (v6 schéma) ----------

export interface ScopeLedger {
  ledger_version: 1;
  event_id: string;
  nonce: string;
  title: string;
  body: string;
  body_sha256: string;
  body_bytes: number;
  api_version: string;
  method: "POST";
  path: "/v1/pages";
  target_data_source_id: string;
  code_version: string;
  prepared_at: string;
  fence: number;
}

declare const verifiedBrand: unique symbol;
/** Ledger, který prošel V1–V7. Jediný zdroj bajtů POST (T13): vzniká jen ve `verifyScopeLedger`. */
export type VerifiedScopeLedger = ScopeLedger & {
  readonly bytes: Buffer;
  readonly [verifiedBrand]: true;
};

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** V1–V7 nad bajty ledgeru (V1 = soubor existuje řeší volající). Neshoda = HOLD s kódem, ledger se nemění. */
export function verifyScopeLedger(
  bytes: Buffer,
  ev: InboxEvent,
  rec: EffectRecord | undefined,
  http: Pick<InboxHttp, "apiVersion">,
  panel: PanelConfig,
): VerifiedScopeLedger {
  let v: Partial<ScopeLedger>;
  try {
    v = JSON.parse(bytes.toString("utf8")) as Partial<ScopeLedger>;
  } catch {
    throw new InboxHold("SCOPE_BODY_CORRUPT", "V2: ledger není JSON");
  }
  if (!v || typeof v !== "object")
    throw new InboxHold("SCOPE_BODY_CORRUPT", "V2: ledger není objekt");
  if (v.body === undefined)
    throw new InboxHold("SCOPE_BODY_MISSING", "V1: ledger bez těla");
  const typed =
    v.ledger_version === 1 &&
    typeof v.event_id === "string" &&
    HEX32.test(v.event_id) &&
    typeof v.nonce === "string" &&
    HEX32.test(v.nonce) &&
    typeof v.title === "string" &&
    typeof v.body === "string" &&
    typeof v.body_sha256 === "string" &&
    HEX64.test(v.body_sha256) &&
    Number.isSafeInteger(v.body_bytes) &&
    typeof v.api_version === "string" &&
    typeof v.method === "string" &&
    typeof v.path === "string" &&
    typeof v.target_data_source_id === "string" &&
    typeof v.code_version === "string" &&
    typeof v.prepared_at === "string" &&
    Number.isInteger(v.fence);
  if (!typed)
    throw new InboxHold(
      "SCOPE_BODY_CORRUPT",
      "V2: pole ledgeru chybí nebo mají špatný typ",
    );
  if (v.event_id !== ev.event_id)
    throw new InboxHold("SCOPE_BODY_CORRUPT", "V2: ledger patří jiné události");
  const L = v as ScopeLedger;
  const buf = Buffer.from(L.body, "utf8");
  if (sha256Hex(buf) !== L.body_sha256 || buf.length !== L.body_bytes)
    throw new InboxHold(
      "SCOPE_BODY_CORRUPT",
      "V3: hash nebo délka těla nesedí",
    );
  let body: unknown;
  try {
    body = JSON.parse(L.body);
  } catch {
    throw new InboxHold("SCOPE_BODY_CORRUPT", "V4: tělo není JSON");
  }
  const t = bodyTitle(body);
  if (t !== L.title || !exactlyOne(L.title, "nx", L.nonce))
    throw new InboxHold(
      "SCOPE_BODY_CORRUPT",
      "V4: titulek nebo nonce v těle nesedí na ledger",
    );
  if (
    rec &&
    (rec.content_hash !== L.body_sha256 || rec.subject !== ev.event_id)
  )
    throw new InboxHold(
      "SCOPE_LEDGER_CONFLICT",
      "V5: journal nesedí na ledger",
    );
  const parentDs = (body as { parent?: { data_source_id?: unknown } })?.parent
    ?.data_source_id;
  if (
    L.api_version !== http.apiVersion ||
    L.method !== SCOPE_METHOD ||
    L.path !== SCOPE_PATH ||
    L.target_data_source_id !== panel.data_source_id ||
    parentDs !== L.target_data_source_id
  )
    throw new InboxHold(
      "SCOPE_CONTEXT_MISMATCH",
      "V6: verze API, metoda, cesta nebo cílový panel nesedí na aktuální klient a konfiguraci",
    );
  checkBodySemantics(body, ev, panel);
  return { ...L, bytes: buf } as VerifiedScopeLedger;
}

function readScopeLedger(
  runsDir: string,
  ev: InboxEvent,
  opts: PublishOptions,
): Buffer | undefined {
  let r: ReturnType<typeof readPublished>;
  try {
    r = readPublished(scopeLedgerFile(runsDir, ev.event_id), opts);
  } catch (e) {
    if (e instanceof DurabilityHold)
      throw new InboxHold("LEDGER_NOT_DURABLE", e.message);
    throw e;
  }
  return r.state === "present" ? r.bytes : undefined;
}

// ---------- vazba S ↔ R (B1–B9) ----------

/** Kandidáti scope karty v úplném panelu (mapa v4 §3.4): ID zakázky, nebo kterákoli značka [op], [ev], [nx:nonce]. */
export function scopeCandidates(
  cards: readonly PanelCard[],
  ev: InboxEvent,
  nonce?: string,
): PanelCard[] {
  return cards.filter(
    (c) =>
      c.id_zakazky === scopeOrderId(ev) ||
      tagValues(c.title, "op").includes(scopeOp(ev.event_id)) ||
      tagValues(c.title, "ev").includes(ev.event_id) ||
      (nonce !== undefined && tagValues(c.title, "nx").includes(nonce)),
  );
}

export interface BindInput {
  card: PanelCard;
  event: InboxEvent;
  snap: ScopeSnapshot;
  journal: EffectRecord | undefined;
  ledger: VerifiedScopeLedger;
  http: InboxHttp;
  trusted: TrustedIdentities;
}

/** Původ ověřený B8 a B9 (zapíše se do scope receiptu). */
export interface CardProvenance {
  created_by_id: string;
  nonce: string;
}

/**
 * `bindScopeCard` (mapa v4 §3.5, B1–B9) nad úplně přečteným panelem a Inboxem. Projde jen když platí všechno. O původu
 * rozhodují jen B8 (autor = integrace TARS přes resolver) a B9 (nonce z ledgeru), nikdy `ID zakázky` ani název.
 */
export async function bindScopeCard(b: BindInput): Promise<CardProvenance> {
  const { card: S, event: ev, snap } = b;
  const mis = (why: string): never => {
    throw new InboxHold("SCOPE_BINDING_MISMATCH", why);
  };
  if (S.id_zakazky !== scopeOrderId(ev)) mis("B1: ID zakázky");
  const same = snap.inboxRows.filter(
    (r) => r.key === rqKey(ev.request_id, ev.generation),
  );
  if (
    !S.karta_url ||
    pageIdFromUrl(S.karta_url) !== ev.page_id ||
    same.length !== 1 ||
    same[0].page_id !== ev.page_id
  )
    mis("B2: Karta rozhodnutí nebo řádek R");
  if (
    !exactlyOne(S.title, "op", scopeOp(ev.event_id)) ||
    !exactlyOne(S.title, "ev", ev.event_id)
  )
    mis("B3: značky [op]/[ev]");
  if (
    !exactlyOne(S.title, "ph", ev.payload_hash.slice(0, 16)) ||
    snap.rPayloadHash !== ev.payload_hash
  )
    throw new InboxHold("MUTATED", "B4: otisk podání");
  if (!b.journal || b.journal.subject !== ev.event_id)
    mis("B5: journal scope karty");
  if (
    b.journal!.state === "EFFECT_DONE" &&
    pageIdFromUrl(b.journal!.receipt?.url ?? "") !== S.page_id
  )
    mis("B5: receipt ukazuje jinou stránku");
  if (scopeCandidates(snap.panelCards, ev, b.ledger.nonce).length !== 1)
    throw new InboxHold("DUPLICATE_SCOPE_CARD", "B6: víc kandidátů");
  if (S.in_trash || S.stav === "SUPERSEDED" || S.title.startsWith("tainted:"))
    mis("B7: koš, tainted nebo SUPERSEDED");
  const created_by_id = await checkScopeAuthor(b.http, S, b.trusted);
  if (!exactlyOne(S.title, "nx", b.ledger.nonce))
    throw new InboxHold("SCOPE_PROVENANCE_UNPROVEN", "B9: nonce");
  if (S.title !== b.ledger.title) mis("titulek S ≠ titulek ledgeru");
  return { created_by_id, nonce: b.ledger.nonce };
}

// ---------- úplné čtení pro rozhodnutí ----------

/** Úplné čtení řádků panelu (titulek a `ID zakázky` přes endpoint vlastnosti). */
export async function readPanelCards(
  http: InboxHttp,
  panel: CompleteScan,
  schema: DataSourceSchema,
  deadline?: Deadline,
): Promise<PanelCard[]> {
  const titleId = schema[PANEL_TITLE_PROPERTY]?.id;
  const orderId = schema["ID zakázky"]?.id;
  if (!titleId || !orderId)
    throw new InboxHold(
      "PAYLOAD_INCOMPLETE",
      "P1: schéma panelu bez titulku nebo ID zakázky",
    );
  const out: PanelCard[] = [];
  for (const row of panel.rows) {
    const page_id = row.id.replace(/-/g, "").toLowerCase();
    const karta = (
      row.properties["Karta rozhodnutí"] as { url?: unknown } | undefined
    )?.url;
    const stav = (
      row.properties.Stav as { select?: { name?: unknown } | null } | undefined
    )?.select?.name;
    out.push({
      page_id,
      created_by: row.created_by,
      in_trash: row.in_trash === true,
      title: textOf(
        await readTextProperty(http, page_id, titleId, "title", { deadline }),
      ),
      id_zakazky: textOf(
        await readTextProperty(http, page_id, orderId, "rich_text", {
          deadline,
        }),
      ),
      karta_url: typeof karta === "string" ? karta : null,
      stav: typeof stav === "string" ? stav : null,
    });
  }
  return out;
}

/**
 * Úplné čtení pro scope kartu v jednom okamžiku (mapa v4 §3.3 předpoklady 1–5, §3.6 krok 2): úplný průchod Inboxu
 * s identitou každého řádku, úplný payload R, úplný průchod panelu s úplně přečtenými titulky. Mapa v5 §8.3: není to
 * atomický snapshot, proto se volá znovu po každém POST.
 */
export async function readScopeSnapshot(
  http: InboxHttp,
  inp: {
    inboxDataSourceId: string;
    panel: PanelConfig;
    event: InboxEvent;
    deadline?: Deadline;
  },
): Promise<ScopeSnapshot> {
  const opts = { deadline: inp.deadline };
  const inbox = await scanDataSource(http, inp.inboxDataSourceId, opts);
  const inboxSchema = await readSchema(http, inp.inboxDataSourceId);
  const inboxRows = await readInboxIdentities(http, inbox, inboxSchema, opts);
  let rPayloadHash: string | undefined;
  let requestTitle = "";
  for (const row of inbox.rows) {
    if (row.id.replace(/-/g, "").toLowerCase() !== inp.event.page_id) continue;
    const p = await readInboxPayload(http, row, inboxSchema, opts);
    rPayloadHash = p.payload_hash;
    requestTitle = (p.values["Požadavek"] as readonly string[]).join("");
  }
  if (rPayloadHash === undefined)
    throw new InboxHold(
      "SCOPE_BINDING_MISMATCH",
      "řádek R v úplném Inboxu není",
    );
  const panel = await scanDataSource(http, inp.panel.data_source_id, opts);
  const panelSchema = await readSchema(http, inp.panel.data_source_id);
  const panelCards = await readPanelCards(
    http,
    panel,
    panelSchema,
    inp.deadline,
  );
  return { inbox, inboxRows, rPayloadHash, requestTitle, panel, panelCards };
}

// ---------- tick scope karty ----------

export interface ScopeCtx {
  http: InboxHttp;
  runsDir: string;
  journal: EffectJournal;
  lease: LeaseView;
  mode: InboxMode;
  event: InboxEvent;
  panel: PanelConfig;
  trusted: Partial<TrustedIdentities> | undefined;
  /** úplné čtení Inboxu, R a panelu v tomto okamžiku (volá se před rozhodnutím i znovu po POST, §3.6) */
  read: () => Promise<ScopeSnapshot>;
  /** ACK r0 je `EFFECT_DONE` (předpoklad 4) */
  ackR0Done: () => boolean;
  codeVersion: string;
  now: () => string;
  buildBody?: BodyBuilder;
  nonce?: () => string;
  publish?: PublishOptions;
  /** Jen testy: zastavení/pád v bodech toku. */
  point?: (
    p:
      | "candidate"
      | "ledger-published"
      | "intent-published"
      | "prepared"
      | "before-post"
      | "posted",
  ) => void;
}

export type ScopeOutcome =
  | {
      kind: "done";
      page_id: string;
      recovered: boolean;
      provenance?: CardProvenance;
    }
  | { kind: "prepared-only"; body_sha256: string; body_bytes: number }
  | { kind: "hold"; code: InboxHoldCode; detail: string };

export const BODY_REJECTED = "SCOPE_BODY_REJECTED";

export async function scopeTick(ctx: ScopeCtx): Promise<ScopeOutcome> {
  try {
    return await scopeTickInner(ctx);
  } catch (e) {
    if (e instanceof InboxHold)
      return { kind: "hold", code: e.code, detail: e.message };
    throw e;
  }
}

function preconditions(ctx: ScopeCtx, snap: ScopeSnapshot): void {
  const ev = ctx.event;
  const same = snap.inboxRows.filter(
    (r) => r.key === rqKey(ev.request_id, ev.generation),
  );
  if (same.length > 1)
    throw new InboxHold("DUPLICATE", rqKey(ev.request_id, ev.generation));
  if (same.length !== 1 || same[0].page_id !== ev.page_id)
    throw new InboxHold(
      "SCOPE_BINDING_MISMATCH",
      "předpoklad 2: řádek R v úplném Inboxu",
    );
  if (snap.rPayloadHash !== ev.payload_hash)
    throw new InboxHold("MUTATED", "předpoklad 3");
  if (!ctx.ackR0Done())
    throw new InboxHold(
      "ACK_NOT_DONE",
      "předpoklad 4: ACK r0 není EFFECT_DONE",
    );
}

async function scopeTickInner(ctx: ScopeCtx): Promise<ScopeOutcome> {
  const ev = ctx.event;
  const op = scopeOp(ev.event_id);
  const opts = ctx.publish ?? {};
  const rec0 = ctx.journal.get(op);
  if (rec0 && rec0.subject !== ev.event_id)
    throw new InboxHold("EVENT8_COLLISION", `${op} patří jiné události`);
  if (rec0?.state === "EFFECT_DONE")
    return {
      kind: "done",
      page_id: pageIdFromUrl(rec0.receipt?.url ?? "") ?? "",
      recovered: Boolean(rec0.recovered),
    };
  if (rec0?.state === "EFFECT_UNKNOWN")
    throw new InboxHold("EFFECT_UNKNOWN", `${op}: rozhoduje vlastník`);
  if (rec0?.state === "EFFECT_ABSENT" && rec0.reason?.startsWith(BODY_REJECTED))
    throw new InboxHold(
      "SCOPE_BODY_REJECTED",
      `${op}: uložené tělo server odmítl, nepřestavuje se`,
    );
  const trusted = checkTrustedMap(ctx.trusted);
  const snap = await ctx.read();
  preconditions(ctx, snap);
  const existing = readScopeLedger(ctx.runsDir, ev, opts);

  if (rec0?.state === "PREPARED")
    return adopt(ctx, snap, rec0, existing, trusted);

  // journal chybí nebo EFFECT_ABSENT: v panelu nesmí být žádný kandidát (předpoklad 6)
  if (scopeCandidates(snap.panelCards, ev).length > 0)
    throw new InboxHold(
      "FOREIGN_SCOPE_CARD",
      "předpoklad 6: v panelu už je řádek se zakázkou nebo značkou události",
    );

  let L: VerifiedScopeLedger;
  if (existing) {
    L = verifyScopeLedger(existing, ev, rec0, ctx.http, ctx.panel); // ledger z dřívějška: jen číst, nikdy znovu sestavit
  } else {
    if (rec0)
      throw new InboxHold(
        "SCOPE_LEDGER_MISSING",
        `${op}: journal ${rec0.state} bez ledgeru`,
      );
    const nonce = (ctx.nonce ?? (() => randomBytes(16).toString("hex")))();
    const bodyObj = (ctx.buildBody ?? buildScopeBody)({
      event: ev,
      panelDataSourceId: ctx.panel.data_source_id,
      requestTitle: snap.requestTitle,
      nonce,
    });
    checkBodySemantics(bodyObj, ev, ctx.panel); // V7 nad kandidátem: neprojde = ledger nevznikne
    const body = canonicalJson(bodyObj);
    const ledger: ScopeLedger = {
      ledger_version: 1,
      event_id: ev.event_id,
      nonce,
      title: bodyTitle(bodyObj)!,
      body,
      body_sha256: sha256Hex(Buffer.from(body, "utf8")),
      body_bytes: Buffer.byteLength(body, "utf8"),
      api_version: ctx.http.apiVersion,
      method: SCOPE_METHOD,
      path: SCOPE_PATH,
      target_data_source_id: ctx.panel.data_source_id,
      code_version: ctx.codeVersion,
      prepared_at: ctx.now(),
      fence: ctx.lease.fence,
    };
    if (ctx.mode !== "run")
      return {
        kind: "prepared-only",
        body_sha256: ledger.body_sha256,
        body_bytes: ledger.body_bytes,
      };
    ctx.point?.("candidate");
    assertLease(ctx.lease, "před publikací scope ledgeru (1)");
    let r: string;
    try {
      r = publishOnce(
        scopeLedgerFile(ctx.runsDir, ev.event_id),
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
        "SCOPE_LEDGER_CONFLICT",
        `${op}: ledger existuje s jiným obsahem, kandidát se zahazuje`,
      );
    ctx.point?.("ledger-published");
    const back = readScopeLedger(ctx.runsDir, ev, opts);
    if (!back)
      throw new InboxHold(
        "LEDGER_NOT_DURABLE",
        "scope ledger po publikaci chybí",
      );
    L = verifyScopeLedger(back, ev, undefined, ctx.http, ctx.panel);
    assertLease(ctx.lease, "po publikaci scope ledgeru (2)");
  }
  assertRun(ctx.mode, "scope POST");
  return post(ctx, op, rec0, L, trusted);
}

async function post(
  ctx: ScopeCtx,
  op: string,
  rec0: EffectRecord | undefined,
  L: VerifiedScopeLedger,
  trusted: TrustedIdentities,
): Promise<ScopeOutcome> {
  const ev = ctx.event;
  const attempt = claimSend({
    runsDir: ctx.runsDir,
    op,
    record: rec0,
    lease: ctx.lease,
    contentHash: L.body_sha256,
    now: ctx.now,
    publish: ctx.publish,
  });
  ctx.point?.("intent-published");
  assertLease(ctx.lease, "před prepare scope karty");
  const rec = ctx.journal.prepare(op, {
    content_hash: L.body_sha256,
    subject: ev.event_id,
  });
  assertPreparedAttempt(rec, attempt);
  ctx.point?.("prepared");
  assertLease(ctx.lease, "před POST (3)");
  const fresh = readScopeLedger(ctx.runsDir, ev, ctx.publish ?? {});
  if (!fresh)
    throw new InboxHold("SCOPE_LEDGER_MISSING", "ledger před POST chybí");
  const V = verifyScopeLedger(fresh, ev, rec, ctx.http, ctx.panel); // V1–V7 těsně před POST
  ctx.point?.("before-post");
  let pageId: string | undefined;
  try {
    const res = await ctx.http.send({
      method: V.method,
      path: V.path,
      body: V.bytes,
    });
    const id = (res.json as { id?: unknown })?.id;
    pageId =
      typeof id === "string" ? id.replace(/-/g, "").toLowerCase() : undefined;
  } catch (e) {
    if (e instanceof NotionRestError && e.committedId) {
      pageId = e.committedId.toLowerCase();
    } else if (
      e instanceof NotionRestError &&
      e.status === 400 &&
      e.code === "validation_error"
    ) {
      ctx.journal.absent(
        op,
        `${BODY_REJECTED}: server odmítl uložené tělo (validation_error)`,
      );
      throw new InboxHold(
        "SCOPE_BODY_REJECTED",
        `${op}: uložené tělo odmítnuto, nepřestavuje se`,
      );
    } else if (effectSurelyAbsent(e)) {
      ctx.journal.absent(
        op,
        `POST čistě odmítnut: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
      );
      return {
        kind: "hold",
        code: "EFFECT_RETRY",
        detail: `${op}: POST odmítnut před zápisem, další tick stejné bajty (bez MCP)`,
      };
    } else {
      ctx.journal.note(
        op,
        `POST s nejistým výsledkem: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
      );
      return {
        kind: "hold",
        code: "EFFECT_PENDING",
        detail: `${op}: výsledek POST neznámý, další tick adopce podle B1–B9`,
      };
    }
  }
  ctx.point?.("posted");
  if (!pageId || !/^[0-9a-f]{32}$/.test(pageId)) {
    ctx.journal.note(op, "odpověď POST bez id stránky");
    return {
      kind: "hold",
      code: "EFFECT_PENDING",
      detail: `${op}: odpověď bez id, další tick adopce`,
    };
  }
  // §3.6: nové úplné čtení a B1–B9 nad page_id(S), teprve pak done
  const snap = await ctx.read();
  preconditions(ctx, snap);
  const cands = scopeCandidates(snap.panelCards, ev, L.nonce);
  if (cands.length === 0)
    throw new InboxHold(
      "SCOPE_CARD_UNKNOWN",
      "S po POST zatím není v úplném panelu (journal zůstává PREPARED)",
    );
  if (cands.length > 1)
    throw new InboxHold("DUPLICATE_SCOPE_CARD", "po POST víc kandidátů");
  if (cands[0].page_id !== pageId)
    throw new InboxHold(
      "SCOPE_BINDING_MISMATCH",
      "kandidát v panelu není stránka z odpovědi POST",
    );
  const provenance = await bindScopeCard({
    card: cands[0],
    event: ev,
    snap,
    journal: rec,
    ledger: L,
    http: ctx.http,
    trusted,
  });
  assertLease(ctx.lease, "před done scope karty");
  ctx.journal.done(
    op,
    { url: `https://www.notion.so/${pageId}` },
    { content_hash: L.body_sha256 },
  );
  return { kind: "done", page_id: pageId, recovered: false, provenance };
}

/** §3.4 (5): journal PREPARED → adopce jen s ledgerem, jediným kandidátem a úplnou vazbou B1–B9. Nikdy druhý POST. */
async function adopt(
  ctx: ScopeCtx,
  snap: ScopeSnapshot,
  rec: EffectRecord,
  existing: Buffer | undefined,
  trusted: TrustedIdentities,
): Promise<ScopeOutcome> {
  const ev = ctx.event;
  if (!existing)
    throw new InboxHold(
      "SCOPE_LEDGER_MISSING",
      "journal PREPARED bez scope ledgeru",
    );
  const L = verifyScopeLedger(existing, ev, rec, ctx.http, ctx.panel);
  const cands = scopeCandidates(snap.panelCards, ev, L.nonce);
  if (cands.length === 0)
    throw new InboxHold(
      "SCOPE_CARD_UNKNOWN",
      "PREPARED a v úplném panelu 0 kandidátů, druhý POST nevznikne",
    );
  if (cands.length > 1)
    throw new InboxHold("DUPLICATE_SCOPE_CARD", `${cands.length} kandidátů`);
  const provenance = await bindScopeCard({
    card: cands[0],
    event: ev,
    snap,
    journal: rec,
    ledger: L,
    http: ctx.http,
    trusted,
  });
  assertRun(ctx.mode, "adopce scope karty");
  assertLease(ctx.lease, "před done(recovered) scope karty");
  ctx.journal.done(
    scopeOp(ev.event_id),
    { url: `https://www.notion.so/${cands[0].page_id}` },
    { content_hash: L.body_sha256, recovered: true },
  );
  return {
    kind: "done",
    page_id: cands[0].page_id,
    recovered: true,
    provenance,
  };
}

/** Ledger ověřený V1–V7 pro jiné moduly (receipt, revalidace). */
export function loadVerifiedScopeLedger(
  runsDir: string,
  ev: InboxEvent,
  rec: EffectRecord | undefined,
  http: Pick<InboxHttp, "apiVersion">,
  panel: PanelConfig,
  opts: PublishOptions = {},
): VerifiedScopeLedger {
  const b = readScopeLedger(runsDir, ev, opts);
  if (!b) throw new InboxHold("SCOPE_LEDGER_MISSING", "scope ledger chybí");
  return verifyScopeLedger(b, ev, rec, http, panel);
}
