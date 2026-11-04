// Notion control panel "TARS — Zakázky": one row per order, rewritten on EVERY state transition.
// The row is computed deterministically from state.json (no LLM decides any value).
// Transport: Notion REST API when the integration token is in the macOS Keychain (DR-029 krok 5);
// otherwise (or when REST is unavailable) the official Notion MCP connector via `claude -p`,
// where the code verifies that the executed tool call carried exactly the payload it asked for
// (stream-json tool_use input == expected) — the model only transports.
// A panel failure never stops an order: it is logged and caught up on the next transition.
// The orchestrator NEVER writes „Rozhodnutí vlastníka“ — that select belongs to the owner.
// It only reads it (readOwnerDecision) while an order is in WAITING_OWNER, and only through the REST API:
// the claude -p fallback never takes over an owner decision (a model in the middle could not be trusted with it).
import fs from "node:fs";
import path from "node:path";

import {
  NOTION_QUERY_TOOLS_DENIED,
  ORCH_CLAUDE_SETTINGS,
  runProcess,
} from "./adapters";
import {
  isFallbackEligible,
  NotionRestError,
  type NotionRestApi,
} from "./notion";
import { redactDeep, redactSecrets } from "./secret-scan";
import { Store, writeDurable } from "./store";
import type { Order } from "./types";

export const PANEL_DATA_SOURCE_ID = "93d450d0-fabd-4e29-8f09-decda4ad45b6";
export const PANEL_DATABASE_URL =
  "https://app.notion.com/p/f12aa6d7804b4af0858db6b46167a3e5";

export interface PanelRow {
  Zakázka: string;
  "ID zakázky": string;
  Mise: string;
  Oddělení: string;
  Stav: string;
  Fronta: string;
  "Tvůrce (model)": string;
  "Kontrolor (model)": string;
  "Kolo oprav": number;
  "Poslední krok": string;
  "date:Start:start": string;
  "date:Start:is_datetime": number;
  "date:Poslední změna:start": string;
  "date:Poslední změna:is_datetime": number;
  "Ruční zásahy": number;
  "Odkaz na výstup": string | null;
  "Čeká na vlastníka": "__YES__" | "__NO__";
  /** Orchestrator on the Mac writes „Mac“; Fable cloud agents write „Cloud“. */
  "Kde běží": "Mac" | "Cloud";
  "Proč tento model": string;
  /** URL of the visual decision card (owner card page). */
  "Karta rozhodnutí": string | null;
}

/** Name of the owner-only select. Deliberately NOT a key of PanelRow. */
export const OWNER_DECISION_PROPERTY = "Rozhodnutí vlastníka";

const STEP_TEXT: Record<string, string> = {
  planned: "Supervizor vybral zakázku z HANDOFF a GPT schválil zadání.",
  start: "Karta a pravidla adaptéru ověřeny, tvůrce spuštěn.",
  created: "Tvůrce odevzdal první verzi, běží kontrola.",
  revised: "Tvůrce zapracoval připomínky, běží nová kontrola.",
  delivered: "Výstup doručen jako DRAFT.",
  limit: "Narazil na limit předplatného, pokračuje po obnovení.",
  resume: "Pokračuje po pauze kvůli limitu.",
};

/** One Czech sentence describing the last transition (deterministic). */
export function lastStepSentence(o: Order): string {
  const h = o.history.at(-1);
  if (!h) return "Zakázka založena, supervizor vybírá práci.";
  switch (h.event) {
    case "verdict":
      if (h.to === "DELIVERED") return "Kontrolor jiné rodiny vrátil PASS.";
      if (h.to === "FIXING")
        return `Kontrolor vrátil opravy (kolo ${o.fix_rounds}).`;
      return `Zakázka selhala: ${(o.failure_reason ?? "").slice(0, 150)}`;
    case "start":
      return h.to === "DOING"
        ? STEP_TEXT.start
        : `Spuštění zastaveno: ${(o.failure_reason ?? "").slice(0, 150)}`;
    case "delivered":
      return h.to === "WAITING_OWNER"
        ? "Výstup doručen jako DRAFT, čeká na GO / REJECT vlastníka."
        : "Výstup doručen, zakázka hotová.";
    case "owner":
      return h.to === "DONE" ? "Vlastník dal GO." : "Vlastník dal REJECT.";
    case "planned":
      return o.brief?.check_notes?.length
        ? "Supervizor vybral zakázku z HANDOFF, kontrola zadání: PASS s výhradami (DR-031)."
        : STEP_TEXT.planned;
    case "fail":
    case "unknown":
      return `Zastaveno: ${(o.failure_reason ?? "").slice(0, 150)}`;
    default:
      return STEP_TEXT[h.event] ?? `Přechod ${h.from} → ${h.to}.`;
  }
}

export function queueOf(o: Order): string {
  if (o.state === "WAITING_OWNER") return "1 · Čeká na vlastníka";
  if (o.state === "DONE" || o.state === "FAILED" || o.state === "UNKNOWN")
    return "3 · Hotové";
  return "2 · Běží";
}

/** One deterministic sentence, DR-030: Opus = úsudek, Sonnet = přesné zadání, GPT = kontrola jiné rodiny. */
export function modelReason(
  o: Order,
  creator: string,
  checker: string,
): string {
  if (!o.brief)
    return "Supervizor (Opus) vybírá práci a píše zadání, zadání kontroluje GPT.";
  return `Tvůrce ${creator} a kontrolor ${checker} jsou z různých modelových rodin (pravidlo „kontroluje jiná rodina“).`;
}

export function panelRow(o: Order, creator: string, checker: string): PanelRow {
  return {
    Zakázka: o.brief?.title ?? `Nová zakázka ${o.id}`,
    "ID zakázky": o.id,
    Mise: o.mission,
    Oddělení: o.brief?.department ?? "—",
    Stav: o.state,
    Fronta: queueOf(o),
    "Tvůrce (model)": creator,
    "Kontrolor (model)": checker,
    "Kolo oprav": o.fix_rounds,
    "Poslední krok": lastStepSentence(o),
    "date:Start:start": o.created_at,
    "date:Start:is_datetime": 1,
    "date:Poslední změna:start": o.updated_at,
    "date:Poslední změna:is_datetime": 1,
    "Ruční zásahy": o.manual_interventions,
    "Odkaz na výstup": o.delivered_url ?? null,
    "Čeká na vlastníka": o.state === "WAITING_OWNER" ? "__YES__" : "__NO__",
    "Kde běží": "Mac",
    "Proč tento model": modelReason(o, creator, checker),
    "Karta rozhodnutí": o.owner_card_url ?? null,
  };
}

export interface PanelSink {
  /** Creates or updates the row; returns the row page id. Throws on failure. */
  upsert(row: PanelRow, existingPageId?: string): Promise<string>;
  /** Raw value of the owner-only select „Rozhodnutí vlastníka“ of a row (undefined = empty). Read-only. */
  readOwnerDecision?(pageId: string): Promise<string | undefined>;
  /**
   * Finds the row of an order by its „ID zakázky“ (REST data source query with a filter, never SQL/rows through MCP).
   * Used after a create of unknown outcome, before any new row is created. Returns the page id, or undefined only when
   * the row certainly does not exist (a consistent query). Review kolo 3: a search that may lag behind (MCP
   * `notion-search`) never answers undefined; finding nothing there throws `PanelRowUnclear`. `consistentOnly`: do not
   * fall back to such a search at all (a new row with nothing sent before: the caller creates it).
   */
  findRowByOrderId?(
    orderId: string,
    opts?: { consistentOnly?: boolean },
  ): Promise<string | undefined>;
}

/**
 * Review kolo 3: the lookup could not prove that the row does not exist (the consistent REST query is unavailable and
 * the MCP search, whose index lags behind, found nothing — or was not asked). Never read as „does not exist“.
 */
export class PanelRowUnclear extends Error {}

const text = (s: string | null | undefined) => ({
  rich_text: s ? [{ type: "text", text: { content: s.slice(0, 2000) } }] : [],
});
const select = (s: string | null | undefined) => ({
  select: s ? { name: s.replace(/,/g, " ").slice(0, 100) } : null,
});
const date = (iso: string) => ({ date: { start: iso } });

/**
 * PanelRow → REST `properties`. An explicit whitelist of exactly the columns the orchestrator owns;
 * „Rozhodnutí vlastníka“ is not among them and can never be emitted.
 */
export function rowToRestProperties(row: PanelRow): Record<string, unknown> {
  return {
    Zakázka: {
      title: [{ type: "text", text: { content: row.Zakázka.slice(0, 2000) } }],
    },
    "ID zakázky": text(row["ID zakázky"]),
    Mise: text(row.Mise),
    Oddělení: select(row.Oddělení),
    Stav: select(row.Stav),
    Fronta: select(row.Fronta),
    "Tvůrce (model)": text(row["Tvůrce (model)"]),
    "Kontrolor (model)": text(row["Kontrolor (model)"]),
    "Kolo oprav": { number: row["Kolo oprav"] },
    "Poslední krok": text(row["Poslední krok"]),
    Start: date(row["date:Start:start"]),
    "Poslední změna": date(row["date:Poslední změna:start"]),
    "Ruční zásahy": { number: row["Ruční zásahy"] },
    "Odkaz na výstup": { url: row["Odkaz na výstup"] },
    "Čeká na vlastníka": { checkbox: row["Čeká na vlastníka"] === "__YES__" },
    "Kde běží": select(row["Kde běží"]),
    "Proč tento model": text(row["Proč tento model"]),
    "Karta rozhodnutí": { url: row["Karta rozhodnutí"] },
  };
}

/** Deep equality for plain JSON values (used to verify the transported tool payload). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  return v;
}

interface StreamCall {
  name: string;
  input: Record<string, unknown>;
  result: string;
}

export function toolCalls(streamJson: string): StreamCall[] {
  const calls: StreamCall[] = [];
  const byId = new Map<string, StreamCall>();
  for (const line of streamJson.split("\n")) {
    let e: { type?: string; message?: { content?: unknown } };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const content = Array.isArray(e.message?.content)
      ? (e.message!.content as Array<Record<string, unknown>>)
      : [];
    for (const c of content) {
      if (e.type === "assistant" && c.type === "tool_use") {
        const call = {
          name: String(c.name),
          input: (c.input ?? {}) as Record<string, unknown>,
          result: "",
        };
        byId.set(String(c.id), call);
        calls.push(call);
      }
      if (e.type === "user" && c.type === "tool_result") {
        const call = byId.get(String(c.tool_use_id));
        if (call)
          call.result = Array.isArray(c.content)
            ? (c.content as Array<{ text?: string }>)
                .map((x) => x.text ?? "")
                .join("")
            : String(c.content ?? "");
      }
    }
  }
  return calls;
}

export class McpPanelSink implements PanelSink {
  constructor(private cwd: string) {}

  async upsert(unsafeRow: PanelRow, existingPageId?: string): Promise<string> {
    const row = redactDeep(unsafeRow); // a loaded token never enters the claude -p prompt or the Notion row
    const tool = existingPageId
      ? "mcp__claude_ai_Notion__notion-update-page"
      : "mcp__claude_ai_Notion__notion-create-pages";
    const input = existingPageId
      ? {
          page_id: existingPageId,
          command: "update_properties",
          properties: row,
        }
      : {
          parent: {
            type: "data_source_id",
            data_source_id: PANEL_DATA_SOURCE_ID,
          },
          pages: [{ properties: row }],
        };
    const prompt = `Jsi transportní vrstva. Zavolej PŘESNĚ JEDNOU nástroj ${tool} s tímto vstupem, beze změny jediného znaku:\n${JSON.stringify(input)}\nPak odpověz jen OK.`;
    const r = await runProcess(
      "claude",
      [
        "-p",
        "--model",
        "sonnet",
        "--settings",
        ORCH_CLAUDE_SETTINGS,
        "--allowedTools",
        tool,
        "--disallowedTools",
        NOTION_QUERY_TOOLS_DENIED,
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      prompt,
      this.cwd,
      4 * 60_000,
    );
    const calls = toolCalls(r.stdout).filter((c) => c.name === tool);
    if (calls.length !== 1)
      throw new Error(`panel: expected 1 ${tool} call, got ${calls.length}`);
    const sentProps = existingPageId
      ? (calls[0].input.properties as unknown)
      : ((
          calls[0].input.pages as Array<{ properties: unknown }> | undefined
        )?.[0]?.properties as unknown);
    if (!jsonEqual(sentProps, row))
      throw new Error("panel: transported payload differs from computed row");
    if (
      /error|failed/i.test(calls[0].result.slice(0, 200)) &&
      !/"id"|url/i.test(calls[0].result)
    )
      throw new Error("panel: tool returned error");
    if (existingPageId) return existingPageId;
    const id =
      /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
        calls[0].result,
      )?.[1];
    if (!id) throw new Error("panel: created page id not found");
    return id.replace(/-/g, "");
  }
}

/** Most pages read when looking a row up by order id (a filtered result is normally a single row). */
const FIND_MAX_PAGES = 5;

/** REST sink: PATCH/POST /v1/pages with the whitelisted properties; secrets in the row are redacted first. */
export class RestPanelSink implements PanelSink {
  constructor(private api: NotionRestApi) {}

  async upsert(row: PanelRow, existingPageId?: string): Promise<string> {
    const properties = rowToRestProperties(redactDeep(row));
    if (existingPageId) {
      await this.api.request("PATCH", `/v1/pages/${existingPageId}`, {
        properties,
      });
      return existingPageId;
    }
    try {
      const j = await this.api.request<{ id?: string }>("POST", "/v1/pages", {
        parent: {
          type: "data_source_id",
          data_source_id: PANEL_DATA_SOURCE_ID,
        },
        properties,
      });
      if (!j.id) throw new Error("panel: created page id not found");
      return j.id.replace(/-/g, "");
    } catch (e) {
      // 503 after the row was saved: Notion names it, so the same order never gets a second row.
      if (e instanceof NotionRestError && e.committedId) return e.committedId;
      throw e;
    }
  }

  async findRowByOrderId(orderId: string): Promise<string | undefined> {
    let cursor: string | undefined;
    for (let page = 0; page < FIND_MAX_PAGES; page++) {
      const j = await this.api.request<{
        results?: Array<{ id?: string; in_trash?: boolean }>;
        has_more?: boolean;
        next_cursor?: string | null;
      }>("POST", `/v1/data_sources/${PANEL_DATA_SOURCE_ID}/query`, {
        filter: { property: "ID zakázky", rich_text: { equals: orderId } },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 25,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      const hit = (j.results ?? []).find((r) => r.id && !r.in_trash);
      if (hit?.id) return hit.id.replace(/-/g, "");
      if (!j.has_more) return undefined; // the whole result was read and holds no live row: it does not exist
      if (!j.next_cursor) break;
      cursor = j.next_cursor;
    }
    // Page limit reached, or Notion says there is more without telling where: we cannot tell, so never answer „does not exist“.
    throw new Error("dohledání řádku nelze ověřit (neúplný výsledek)");
  }

  async readOwnerDecision(pageId: string): Promise<string | undefined> {
    const j = await this.api.request<{
      in_trash?: boolean;
      properties?: Record<string, { select?: { name?: string } | null }>;
    }>("GET", `/v1/pages/${pageId}`);
    if (j.in_trash) return undefined;
    return j.properties?.[OWNER_DECISION_PROPERTY]?.select?.name ?? undefined;
  }
}

/**
 * Looks a panel row up by „ID zakázky“: the page id of an exact hit, undefined when nothing was found, throws when the
 * answer is unclear. Review kolo 3: undefined here is NOT a proof of absence (the MCP search index lags behind).
 */
export interface PanelRowLookup {
  find(orderId: string): Promise<string | undefined>;
}

const SEARCH_TOOL = "mcp__claude_ai_Notion__notion-search";
const FETCH_TOOL = "mcp__claude_ai_Notion__notion-fetch";
/** More candidates than this in one search: the answer may be incomplete, so it is never read as „does not exist“. */
const MCP_FIND_PAGE_SIZE = 25;

const normId = (s: unknown) =>
  String(s ?? "")
    .replace(/-/g, "")
    .toLowerCase();

/** The `<properties>` JSON of a notion-fetch page result (undefined when the result does not carry it). */
export function fetchedProperties(
  result: string,
): Record<string, unknown> | undefined {
  // The connector answers JSON whose `text` holds the page markdown; the bare markdown is accepted too.
  let page = result;
  try {
    const j = JSON.parse(result) as { text?: unknown };
    if (typeof j?.text === "string") page = j.text;
  } catch {
    /* not JSON: the markdown itself */
  }
  const m = /<properties>\s*([\s\S]*?)\s*<\/properties>/.exec(page);
  if (!m) return undefined;
  try {
    const j = JSON.parse(m[1]) as unknown;
    return j && typeof j === "object" && !Array.isArray(j)
      ? (j as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Review kolo 2: lookup of an order's row through the Notion MCP connector (`claude -p`), the fallback of the REST
 * query when the integration does not see the panel (404/403 …). No SQL/rows tools: `notion-search` restricted to the
 * panel data source, then `notion-fetch` of EVERY candidate. The code (not the model) decides: the search call must
 * carry exactly the expected input and return a parseable, complete result; a hit is a fetched page of the panel data
 * source whose property „ID zakázky“ equals the order id exactly. Anything unclear (missing call, unparseable result,
 * a candidate not fetched, a full page of candidates) throws. Undefined = the search found nothing, which is not a
 * proof of absence (review kolo 3: the search index lags behind a fresh create); `HybridPanelSink` turns it into
 * `PanelRowUnclear`.
 */
export class McpPanelLookup implements PanelRowLookup {
  constructor(private cwd: string) {}

  async find(orderId: string): Promise<string | undefined> {
    const input = {
      query: orderId,
      data_source_url: `collection://${PANEL_DATA_SOURCE_ID}`,
      page_size: MCP_FIND_PAGE_SIZE,
    };
    const prompt =
      `Jsi transportní vrstva. 1) Zavolej PŘESNĚ JEDNOU nástroj ${SEARCH_TOOL} s tímto vstupem, beze změny jediného znaku:\n${JSON.stringify(input)}\n` +
      `2) Pro KAŽDÝ výsledek hledání zavolej ${FETCH_TOOL} s jeho id. Nic jiného nevolej. Pak odpověz jen OK.`;
    const r = await runProcess(
      "claude",
      [
        "-p",
        "--model",
        "sonnet",
        "--settings",
        ORCH_CLAUDE_SETTINGS,
        "--allowedTools",
        `${SEARCH_TOOL},${FETCH_TOOL}`,
        "--disallowedTools",
        NOTION_QUERY_TOOLS_DENIED,
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      prompt,
      this.cwd,
      4 * 60_000,
    );
    const calls = toolCalls(r.stdout);
    const searches = calls.filter((c) => c.name === SEARCH_TOOL);
    if (searches.length !== 1)
      throw new Error(
        `panel lookup (MCP): expected 1 ${SEARCH_TOOL} call, got ${searches.length}`,
      );
    if (!jsonEqual(searches[0].input, input))
      throw new Error(
        "panel lookup (MCP): search input differs from the expected one",
      );
    let results: Array<{ id?: unknown; parent_data_source_url?: unknown }>;
    try {
      const j = JSON.parse(searches[0].result) as { results?: unknown };
      if (!Array.isArray(j.results)) throw new Error("no results array");
      results = j.results as typeof results;
    } catch {
      throw new Error(
        "panel lookup (MCP): search result unreadable, cannot tell",
      );
    }
    if (results.length >= MCP_FIND_PAGE_SIZE)
      throw new Error(
        "dohledání řádku nelze ověřit (neúplný výsledek hledání)",
      );
    const fetches = calls.filter((c) => c.name === FETCH_TOOL);
    for (const cand of results) {
      if (
        cand.parent_data_source_url !== undefined &&
        cand.parent_data_source_url !== `collection://${PANEL_DATA_SOURCE_ID}`
      )
        continue;
      const id = normId(cand.id);
      if (!/^[0-9a-f]{32}$/.test(id))
        throw new Error("panel lookup (MCP): search result without a page id");
      const fetched = fetches.find((c) => normId(c.input.id).includes(id));
      const props = fetched ? fetchedProperties(fetched.result) : undefined;
      if (!fetched || !props)
        throw new Error(
          `panel lookup (MCP): candidate ${id} not fetched, cannot tell`,
        );
      if (!fetched.result.includes(`collection://${PANEL_DATA_SOURCE_ID}`))
        continue; // a page outside the panel
      if (props["ID zakázky"] === orderId) return id;
    }
    return undefined;
  }
}

/**
 * REST first; the claude -p MCP sink when REST refuses before writing (401/403/404/429, shared pause in NotionRestApi).
 * Reading the owner decision is REST only: no MCP fallback, an error means „later“.
 * Review kolo 2: finding a row by order id uses the same chain as the write: REST query first; when REST cannot answer
 * (any fallback-eligible error — a query never writes) the MCP lookup answers, if one is configured. Without it, or when
 * it fails too, the error stands („cannot tell“: nothing is created).
 * Review kolo 3: only the REST query can prove absence. The MCP search either finds the row or throws `PanelRowUnclear`
 * (its index lags behind, so an empty result is never „does not exist“). With `consistentOnly` the MCP search is not
 * asked at all: REST unavailable → `PanelRowUnclear` straight away.
 */
export class HybridPanelSink implements PanelSink {
  constructor(
    private rest: PanelSink,
    private mcp: PanelSink,
    private log: (message: string) => void,
    private mcpLookup?: PanelRowLookup,
  ) {}

  async upsert(unsafeRow: PanelRow, existingPageId?: string): Promise<string> {
    const row = redactDeep(unsafeRow); // same row goes to whichever transport is chosen
    try {
      return await this.rest.upsert(row, existingPageId);
    } catch (e) {
      // Updating a known row repeats safely; creating one after an uncertain failure would risk a duplicate row.
      if (!isFallbackEligible(e, existingPageId !== undefined)) throw e;
      this.log(`Notion REST: ${redactSecrets(e.message)}, používám fallback`);
    }
    return this.mcp.upsert(row, existingPageId);
  }

  readOwnerDecision(pageId: string): Promise<string | undefined> {
    return this.rest.readOwnerDecision!(pageId);
  }

  async findRowByOrderId(
    orderId: string,
    opts: { consistentOnly?: boolean } = {},
  ): Promise<string | undefined> {
    try {
      return await this.rest.findRowByOrderId!(orderId);
    } catch (e) {
      if (!this.mcpLookup || !isFallbackEligible(e, true)) throw e;
      if (opts.consistentOnly)
        throw new PanelRowUnclear(
          `Notion REST: ${redactSecrets(e.message)}, jistou neexistenci řádku nelze ověřit`,
        );
      this.log(
        `Notion REST: ${redactSecrets(e.message)}, dohledávám řádek přes fallback`,
      );
    }
    const found = await this.mcpLookup.find(orderId);
    if (found) return found;
    throw new PanelRowUnclear(
      "řádek panelu nejasný, ruční kontrola: hledání přes MCP nic nenašlo, jeho index může být zpožděný",
    );
  }
}

/**
 * Order id → panel page id, so every transition updates the same row.
 * Review kolo 3: every read-modify-write of the file runs under the same short `.state.lock` as state.json
 * (`Store.withStateLock`, shared by the orchestrator and the CLI), and the file is replaced atomically (`writeDurable`:
 * tmp + fsync + rename). A process can no longer write back an older snapshot over a newer mark or sequence.
 * Plain reads stay lock-free: the atomic rename means a reader always sees one whole version.
 */
export class PanelIndex {
  private file: string;
  private store: Store;
  constructor(runsDir: string, store?: Store) {
    this.file = path.join(runsDir, "panel-index.json");
    this.store = store ?? new Store(runsDir);
  }
  /** One read-modify-write under the state lock; `fn` gets the current content and returns what to write (or nothing). */
  private update<T>(
    fn: (all: Record<string, string>) => {
      write?: Record<string, string>;
      result: T;
    },
  ): T {
    return this.store.withStateLock(() => {
      const r = fn(this.read());
      if (r.write) this.write(r.write);
      return r.result;
    });
  }
  private read(): Record<string, string> {
    return fs.existsSync(this.file)
      ? (JSON.parse(fs.readFileSync(this.file, "utf8")) as Record<
          string,
          string
        >)
      : {};
  }
  get(orderId: string): string | undefined {
    return this.read()[orderId];
  }
  /** Setting the page id also clears the „unknown outcome“ mark. */
  set(orderId: string, pageId: string): void {
    this.update((all) => {
      delete all[`${UNCERTAIN_PREFIX}${orderId}`];
      return { write: { ...all, [orderId]: pageId }, result: undefined };
    });
  }
  private write(all: Record<string, string>): void {
    writeDurable(this.file, JSON.stringify(all, null, 2) + "\n"); // etapa 3: page ids and dirty marks survive a crash
  }
  /** A create of this order's row may have been saved although we got no answer: look it up before creating again. */
  markUncertain(orderId: string): void {
    this.update((all) => ({
      write: { ...all, [`${UNCERTAIN_PREFIX}${orderId}`]: "1" },
      result: undefined,
    }));
  }
  isUncertain(orderId: string): boolean {
    return this.read()[`${UNCERTAIN_PREFIX}${orderId}`] === "1";
  }
  clearUncertain(orderId: string): void {
    this.update((all) => {
      delete all[`${UNCERTAIN_PREFIX}${orderId}`];
      return { write: all, result: undefined };
    });
  }
  /**
   * Etapa 3: the last write of this order's row failed; the next tick rewrites the row from state.json (same order id,
   * so the same row: the page id from this index, or the lookup by order id after an uncertain create).
   */
  markDirty(orderId: string): void {
    // Review kolo 2: the mark remembers the last write sent so far; only a write sent AFTER it may clear it.
    this.update((all) => {
      const issued = seqOf(all, `${SEQ_PREFIX}${orderId}`);
      if (
        all[`${DIRTY_PREFIX}${orderId}`] === "1" &&
        seqOf(all, `${DIRTY_SEQ_PREFIX}${orderId}`) >= issued
      )
        return { result: undefined };
      return {
        write: {
          ...all,
          [`${DIRTY_PREFIX}${orderId}`]: "1",
          [`${DIRTY_SEQ_PREFIX}${orderId}`]: String(issued),
        },
        result: undefined,
      };
    });
  }
  isDirty(orderId: string): boolean {
    return this.read()[`${DIRTY_PREFIX}${orderId}`] === "1";
  }
  /**
   * Without `writeSeq`: unconditional (the order is gone, or a HOLD). With `writeSeq` (the confirmed write, see
   * `beginWrite`): the mark is cleared only when that write was sent after the mark was set; a late answer of an older
   * or concurrent write leaves it (returns false). Review kolo 2.
   */
  clearDirty(orderId: string, writeSeq?: number): boolean {
    return this.update((all) => {
      if (!(`${DIRTY_PREFIX}${orderId}` in all)) return { result: true };
      if (
        writeSeq !== undefined &&
        writeSeq <= seqOf(all, `${DIRTY_SEQ_PREFIX}${orderId}`)
      )
        return { result: false };
      delete all[`${DIRTY_PREFIX}${orderId}`];
      delete all[`${DIRTY_SEQ_PREFIX}${orderId}`];
      return { write: all, result: true };
    });
  }
  /**
   * Review kolo 2: a monotonic sequence of row writes of an order, taken right before the write is sent (send order,
   * not answer order). Shared through this file by every process that writes the panel (orchestrator, CLI).
   */
  beginWrite(orderId: string): number {
    return this.update((all) => {
      const seq = seqOf(all, `${SEQ_PREFIX}${orderId}`) + 1;
      return {
        write: { ...all, [`${SEQ_PREFIX}${orderId}`]: String(seq) },
        result: seq,
      };
    });
  }
  dirtyOrders(): string[] {
    return Object.keys(this.read())
      .filter((k) => k.startsWith(DIRTY_PREFIX))
      .map((k) => k.slice(DIRTY_PREFIX.length))
      .sort();
  }
}

const UNCERTAIN_PREFIX = "uncertain:";
const DIRTY_PREFIX = "dirty:";
const DIRTY_SEQ_PREFIX = "dirtyseq:";
const SEQ_PREFIX = "writeseq:";
const seqOf = (all: Record<string, string>, key: string): number => {
  const n = Number(all[key]);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
