// Etapa 4 PR 3: úplné čtení Inboxu a panelu (mapa v4 §8.1, S1–S8) a úplné čtení vlastností (mapa v4 §8.2, U1–U7,
// P1–P8). Jen GET a query, nic se nezapisuje. Neúplné čtení nikdy nevede k závěru „neexistuje“ ani k hashi.
import { NotionRestError } from "../notion";
import { InboxHold, canonicalJson, sha256Hex } from "./common";
import { jsonBytes, type InboxHttp } from "./http";

export const INBOX_MAX_PAGES = 20;
export const QUERY_PAGE_SIZE = 100;
export const PAYLOAD_MAX_SEGMENTS = 100;
export const PAYLOAD_MAX_CHARS = 20_000;

export type ScanSign = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
export type PayloadSign = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";

export class ScanIncomplete extends InboxHold {
  constructor(
    public readonly sign: ScanSign,
    detail: string,
  ) {
    super("INBOX_SCAN_INCOMPLETE", `${sign} ${detail}`);
  }
}

export class PayloadIncomplete extends InboxHold {
  constructor(
    public readonly sign: PayloadSign,
    detail: string,
  ) {
    super("PAYLOAD_INCOMPLETE", `${sign} ${detail}`);
  }
}

/** Page object z odpovědi query (jen pole, která inbox používá). `created_by` nese jen `id`, typ se z něj nikdy nečte. */
export interface NotionPageObject {
  object?: unknown;
  id: string;
  url?: string;
  in_trash?: boolean;
  created_time?: string;
  created_by?: { object?: unknown; id?: unknown };
  properties: Record<
    string,
    { id?: unknown; type?: unknown; [k: string]: unknown }
  >;
}

declare const completeScan: unique symbol;
/** Výsledek úplného průchodu (vzniká jen v `scanDataSource`). */
export type CompleteScan = {
  readonly dataSourceId: string;
  readonly rows: readonly NotionPageObject[];
  readonly [completeScan]: true;
};

/** Deadline ticku: true = čas vypršel. */
export type Deadline = () => boolean;
const never: Deadline = () => false;

/**
 * Úplný průchod data source (§8.1). Úplné jen když každá stránka je list s `results` a boolean `has_more`, poslední
 * má `has_more = false`, žádná nemá `request_status` jiný než `complete`, kurzory jsou platné a neopakují se, žádné
 * `page_id` se neopakuje, stránek ≤ maxPages a čtení skončí v limitu ticku. Jinak `ScanIncomplete` se známkou.
 */
export async function scanDataSource(
  http: InboxHttp,
  dataSourceId: string,
  opts: { maxPages?: number; pageSize?: number; deadline?: Deadline } = {},
): Promise<CompleteScan> {
  const maxPages = opts.maxPages ?? INBOX_MAX_PAGES;
  const pageSize = opts.pageSize ?? QUERY_PAGE_SIZE;
  const deadline = opts.deadline ?? never;
  const rows: NotionPageObject[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= maxPages)
      throw new ScanIncomplete(
        "S3",
        `strop ${maxPages} stránek a has_more = true`,
      );
    if (deadline())
      throw new ScanIncomplete("S5", "čtení nedoběhlo v limitu ticku");
    let j: unknown;
    try {
      j = (
        await http.send({
          method: "POST",
          path: `/v1/data_sources/${dataSourceId}/query`,
          body: jsonBytes({
            page_size: pageSize,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        })
      ).json;
    } catch (e) {
      if (e instanceof NotionRestError && e.status === 429)
        throw new ScanIncomplete("S4", "HTTP 429");
      throw new ScanIncomplete(
        "S5",
        e instanceof NotionRestError
          ? `HTTP ${e.status} ${e.code}`
          : "chyba čtení",
      );
    }
    const r = j as {
      object?: unknown;
      results?: unknown;
      has_more?: unknown;
      next_cursor?: unknown;
      request_status?: { type?: unknown } | unknown;
    };
    if (
      !r ||
      typeof r !== "object" ||
      r.object !== "list" ||
      !Array.isArray(r.results) ||
      typeof r.has_more !== "boolean"
    )
      throw new ScanIncomplete("S7", "chybný tvar odpovědi");
    if (r.results.length > pageSize)
      throw new ScanIncomplete("S7", "víc výsledků než page_size");
    if (r.request_status !== undefined) {
      const t = (r.request_status as { type?: unknown } | null)?.type;
      if (t === "incomplete")
        throw new ScanIncomplete("S1", "request_status incomplete");
      if (t !== "complete")
        throw new ScanIncomplete("S2", "neznámý request_status");
    }
    for (const x of r.results as NotionPageObject[]) {
      if (
        !x ||
        typeof x !== "object" ||
        typeof x.id !== "string" ||
        !x.properties ||
        typeof x.properties !== "object"
      )
        throw new ScanIncomplete("S7", "výsledek bez id nebo vlastností");
      const id = x.id.replace(/-/g, "").toLowerCase();
      if (seen.has(id))
        throw new ScanIncomplete(
          "S8",
          "stejné page_id dvakrát v jednom průchodu",
        );
      seen.add(id);
      rows.push(x);
    }
    if (!r.has_more) {
      if (r.next_cursor !== undefined && r.next_cursor !== null)
        throw new ScanIncomplete("S6", "next_cursor při has_more = false");
      return { dataSourceId, rows } as unknown as CompleteScan;
    }
    if (typeof r.next_cursor !== "string" || !r.next_cursor)
      throw new ScanIncomplete("S6", "has_more bez next_cursor");
    if (cursors.has(r.next_cursor))
      throw new ScanIncomplete("S6", "opakovaný kurzor");
    cursors.add(r.next_cursor);
    cursor = r.next_cursor;
  }
}

declare const completeText: unique symbol;
/** Úplně přečtená textová vlastnost: segmenty `plain_text` v pořadí z endpointu (U6). Vzniká jen v `readTextProperty`. */
export type CompleteText = {
  readonly segments: readonly string[];
  readonly [completeText]: true;
};

export const textOf = (t: CompleteText): string => t.segments.join("");

/**
 * Úplné čtení `title` / `rich_text` (U3–U5): vždy přes `GET /v1/pages/{id}/properties/{prop}`, nikdy z page objectu,
 * přes všechny stránky do `has_more = false`. Každá známka P3–P8 = `PayloadIncomplete`.
 */
export async function readTextProperty(
  http: InboxHttp,
  pageId: string,
  propertyId: string,
  type: "title" | "rich_text",
  opts: { pageSize?: number; deadline?: Deadline } = {},
): Promise<CompleteText> {
  const pageSize = opts.pageSize ?? 100;
  const deadline = opts.deadline ?? never;
  const maxPages = Math.ceil(PAYLOAD_MAX_SEGMENTS / pageSize);
  const segments: string[] = [];
  let chars = 0;
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= maxPages)
      throw new PayloadIncomplete(
        "P6",
        `víc než ${PAYLOAD_MAX_SEGMENTS} segmentů`,
      );
    if (deadline())
      throw new PayloadIncomplete(
        "P7",
        "čtení vlastnosti nedoběhlo v limitu ticku",
      );
    let j: unknown;
    try {
      j = (
        await http.send({
          method: "GET",
          path: `/v1/pages/${pageId}/properties/${encodeURIComponent(propertyId)}?page_size=${pageSize}${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`,
        })
      ).json;
    } catch (e) {
      throw new PayloadIncomplete(
        "P3",
        e instanceof NotionRestError
          ? `HTTP ${e.status} ${e.code}`
          : "chyba čtení",
      );
    }
    const r = j as {
      object?: unknown;
      results?: unknown;
      has_more?: unknown;
      next_cursor?: unknown;
      request_status?: unknown;
    };
    if (
      !r ||
      typeof r !== "object" ||
      r.object !== "list" ||
      !Array.isArray(r.results) ||
      typeof r.has_more !== "boolean"
    )
      throw new PayloadIncomplete("P5", "chybný tvar odpovědi");
    if (
      r.request_status !== undefined &&
      (r.request_status as { type?: unknown } | null)?.type !== "complete"
    )
      throw new PayloadIncomplete("P8", "request_status není complete");
    if (r.results.length > pageSize)
      throw new PayloadIncomplete("P5", "víc výsledků než page_size");
    for (const it of r.results as Array<Record<string, unknown>>) {
      if (
        !it ||
        it.object !== "property_item" ||
        it.type !== type ||
        it.id !== propertyId
      )
        throw new PayloadIncomplete(
          "P5",
          "výsledek jiného typu nebo jiné vlastnosti",
        );
      const v = it[type] as { plain_text?: unknown } | undefined;
      if (!v || typeof v.plain_text !== "string")
        throw new PayloadIncomplete("P5", "segment bez plain_text");
      segments.push(v.plain_text);
      chars += v.plain_text.length;
      if (segments.length > PAYLOAD_MAX_SEGMENTS || chars > PAYLOAD_MAX_CHARS)
        throw new PayloadIncomplete(
          "P6",
          "překročen strop segmentů nebo znaků",
        );
    }
    if (!r.has_more) {
      if (r.next_cursor !== undefined && r.next_cursor !== null)
        throw new PayloadIncomplete("P4", "next_cursor při has_more = false");
      return { segments } as unknown as CompleteText;
    }
    if (typeof r.next_cursor !== "string" || !r.next_cursor)
      throw new PayloadIncomplete("P4", "has_more bez next_cursor");
    if (cursors.has(r.next_cursor))
      throw new PayloadIncomplete("P4", "opakovaný kurzor");
    cursors.add(r.next_cursor);
    cursor = r.next_cursor;
  }
}

/** Schéma data source načtené v tomto ticku: jméno vlastnosti → { id, type }. */
export type DataSourceSchema = Record<string, { id: string; type: string }>;

export async function readSchema(
  http: InboxHttp,
  dataSourceId: string,
): Promise<DataSourceSchema> {
  let j: unknown;
  try {
    j = (
      await http.send({
        method: "GET",
        path: `/v1/data_sources/${dataSourceId}`,
      })
    ).json;
  } catch (e) {
    throw new PayloadIncomplete(
      "P3",
      e instanceof NotionRestError
        ? `schéma: HTTP ${e.status}`
        : "schéma: chyba čtení",
    );
  }
  const props = (j as { properties?: unknown })?.properties;
  if (!props || typeof props !== "object")
    throw new PayloadIncomplete("P1", "schéma bez vlastností");
  const out: DataSourceSchema = {};
  for (const [name, p] of Object.entries(
    props as Record<string, { id?: unknown; type?: unknown }>,
  )) {
    if (typeof p?.id === "string" && typeof p?.type === "string")
      out[name] = { id: p.id, type: p.type };
  }
  return out;
}

/** Producentský whitelist Inboxu (mapa v2 §2.1) → typ vlastnosti. `Přijetí TARS` v něm není (mimo `payload_hash`). */
export const INBOX_PRODUCER_PROPS: Readonly<
  Record<string, "title" | "rich_text" | "number" | "select">
> = {
  Požadavek: "title",
  request_id: "rich_text",
  generation: "number",
  supersedes: "rich_text",
  Producent: "select",
  "Typ karty": "select",
  Zadání: "rich_text",
};
/** Volitelná vlastnost: smí být prázdná, ale ve schématu existovat musí (U2). Typ je předpoklad do založení Inboxu. */
export const INBOX_OPTIONAL_PROPS: Readonly<Record<string, "select">> = {
  Projekt: "select",
};
/** Jediná vlastnost Inboxu, kterou TARS zapisuje (mapa v2 §2.1). */
export const ACK_PROPERTY = "Přijetí TARS";

/**
 * Identita `request_id#generation` každého řádku úplného průchodu (DUPLICATE a předpoklad 2 mapy v4 §3.3).
 * `request_id` úplně přes endpoint vlastnosti, `generation` z page objectu (number). Neplatná generace = klíč s „?“,
 * který se nikdy neshoduje s platnou událostí.
 */
export async function readInboxIdentities(
  http: InboxHttp,
  scan: CompleteScan,
  schema: DataSourceSchema,
  opts: { deadline?: Deadline } = {},
): Promise<Array<{ page_id: string; key: string }>> {
  const rid = schema.request_id;
  if (!rid || rid.type !== "rich_text")
    throw new PayloadIncomplete("P1", "schéma Inboxu bez request_id");
  const out: Array<{ page_id: string; key: string }> = [];
  for (const row of scan.rows) {
    const page_id = row.id.replace(/-/g, "").toLowerCase();
    const gen = (row.properties.generation as { number?: unknown } | undefined)
      ?.number;
    const r = textOf(
      await readTextProperty(http, page_id, rid.id, "rich_text", opts),
    );
    out.push({
      page_id,
      key: `${r}#${typeof gen === "number" && Number.isSafeInteger(gen) ? gen : "?"}`,
    });
  }
  return out;
}

declare const completePayload: unique symbol;
/** Úplně přečtené producentské vlastnosti řádku R a jejich `payload_hash` (vzniká jen v `readInboxPayload`). */
export type CompletePayload = {
  readonly values: Readonly<
    Record<string, readonly string[] | number | string | null>
  >;
  readonly payload_hash: string;
  readonly [completePayload]: true;
};

/**
 * Úplné čtení whitelistu řádku R (U1–U7). Každá vlastnost musí být ve schématu i v page objectu se shodným typem (P1).
 * `title`/`rich_text` jen přes endpoint vlastnosti (U3), `number`/`select` z page objectu. Hash se počítá až po
 * dočtení všech vlastností: jedna neúplná = výjimka, žádný částečný hash (U1).
 */
export async function readInboxPayload(
  http: InboxHttp,
  row: NotionPageObject,
  schema: DataSourceSchema,
  opts: { pageSize?: number; deadline?: Deadline } = {},
): Promise<CompletePayload> {
  const values: Record<string, readonly string[] | number | string | null> = {};
  const all: Array<[string, string, boolean]> = [
    ...Object.entries(INBOX_PRODUCER_PROPS).map(
      ([n, t]) => [n, t, false] as [string, string, boolean],
    ),
    ...Object.entries(INBOX_OPTIONAL_PROPS).map(
      ([n, t]) => [n, t, true] as [string, string, boolean],
    ),
  ];
  const pageId = row.id.replace(/-/g, "");
  for (const [name, type] of all) {
    const s = schema[name];
    const p = row.properties[name];
    if (!s || s.type !== type)
      throw new PayloadIncomplete(
        "P1",
        `vlastnost ${name} chybí ve schématu nebo má jiný typ`,
      );
    if (!p || p.type !== type || p.id !== s.id)
      throw new PayloadIncomplete(
        "P1",
        `vlastnost ${name} chybí v page objectu nebo má jiný typ`,
      );
    if (type === "title" || type === "rich_text") {
      values[name] = (
        await readTextProperty(http, pageId, s.id, type, opts)
      ).segments;
    } else if (type === "number") {
      const n = p.number;
      if (n !== null && typeof n !== "number")
        throw new PayloadIncomplete("P1", `vlastnost ${name} nemá číslo`);
      values[name] = n as number | null;
    } else {
      const sel = p.select as { name?: unknown } | null | undefined;
      if (
        sel !== null &&
        (typeof sel !== "object" || typeof sel?.name !== "string")
      )
        throw new PayloadIncomplete("P1", `vlastnost ${name} nemá select`);
      values[name] = sel ? (sel.name as string) : null;
    }
  }
  return {
    values,
    payload_hash: sha256Hex(canonicalJson(values)),
  } as unknown as CompletePayload;
}
