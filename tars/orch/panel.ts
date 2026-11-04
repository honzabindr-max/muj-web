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

import { NOTION_QUERY_TOOLS_DENIED, ORCH_CLAUDE_SETTINGS, runProcess } from "./adapters";
import { isFallbackEligible, NotionRestError, type NotionRestApi } from "./notion";
import { redactDeep, redactSecrets } from "./secret-scan";
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
export function modelReason(o: Order, creator: string, checker: string): string {
  if (!o.brief) return "Supervizor (Opus) vybírá práci a píše zadání, zadání kontroluje GPT.";
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

/** Stav starého řádku panelu po znovuvydání karty. Rozhodnutí na takovém řádku se nikdy nepřijme. */
export const SUPERSEDED_STATE = "SUPERSEDED";

/**
 * Starý řádek po znovuvydání karty: Stav SUPERSEDED, fronta Hotové, nečeká na vlastníka, odkaz na nový řádek. Odkaz
 * „Karta rozhodnutí“ se vyprázdní, aby starý řádek neukazoval žádnou kartu. „Rozhodnutí vlastníka“ v PanelRow není (P20).
 */
export function supersededRow(o: Order, creator: string, checker: string, newRowId: string): PanelRow {
  return {
    ...panelRow(o, creator, checker),
    Stav: SUPERSEDED_STATE,
    Fronta: "3 · Hotové",
    "Čeká na vlastníka": "__NO__",
    "Poslední krok": `karta znovuvydána → nový řádek ${newRowId}`,
    "Karta rozhodnutí": null,
  };
}

/** Rozhodnutí vlastníka z řádku panelu (undefined = prázdné). */
export interface OwnerRow {
  decision?: string;
  last_edited_time?: string;
  /**
   * true jen když je hodnota spolehlivě přečtená: řádek není v koši a sloupec „Rozhodnutí vlastníka“ v odpovědi je
   * jako select. Jinak (koš, chybějící nebo přejmenovaný sloupec) prázdné `decision` NEZNAMENÁ prázdné pole.
   */
  readable?: boolean;
  /**
   * Odkaz „Karta rozhodnutí“, který řádek v okamžiku čtení ukazuje (null = prázdný, undefined = sloupec v odpovědi
   * chybí nebo není typu url). Po znovuvydání karty platí rozhodnutí jen z řádku, který ukazuje přesně aktuální kartu.
   */
  card?: string | null;
}

/** Omezení dohledání řádku: vynechat vyřazené řádky a (po znovuvydání) vzít jen řádek s odkazem na tuto kartu. */
export interface FindRowOptions {
  exclude?: string[];
  card?: string;
}

export interface PanelSink {
  /** Creates or updates the row; returns the row page id. Throws on failure. */
  upsert(row: PanelRow, existingPageId?: string): Promise<string>;
  /** Raw value of the owner-only select „Rozhodnutí vlastníka“ of a row (undefined = empty). Read-only. */
  readOwnerDecision?(pageId: string): Promise<string | undefined>;
  /** Totéž i se spolehlivostí čtení a odkazem „Karta rozhodnutí“ (Notion REST); potřeba pro GO po znovuvydání karty. */
  readOwnerRow?(pageId: string): Promise<OwnerRow>;
  /**
   * Finds the row of an order by its „ID zakázky“ (REST data source query with a filter, never SQL/rows through MCP).
   * Used after a create of unknown outcome, before any new row is created. Returns the page id or undefined.
   */
  findRowByOrderId?(orderId: string, opts?: FindRowOptions): Promise<string | undefined>;
}

const text = (s: string | null | undefined) => ({ rich_text: s ? [{ type: "text", text: { content: s.slice(0, 2000) } }] : [] });
const select = (s: string | null | undefined) => ({ select: s ? { name: s.replace(/,/g, " ").slice(0, 100) } : null });
const date = (iso: string) => ({ date: { start: iso } });

/**
 * PanelRow → REST `properties`. An explicit whitelist of exactly the columns the orchestrator owns;
 * „Rozhodnutí vlastníka“ is not among them and can never be emitted.
 */
export function rowToRestProperties(row: PanelRow): Record<string, unknown> {
  return {
    Zakázka: { title: [{ type: "text", text: { content: row.Zakázka.slice(0, 2000) } }] },
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

interface FoundRow {
  id?: string;
  in_trash?: boolean;
  properties?: Record<string, { url?: string | null }>;
}

/** Most pages read when looking a row up by order id (a filtered result is normally a single row). */
const FIND_MAX_PAGES = 5;

/** REST sink: PATCH/POST /v1/pages with the whitelisted properties; secrets in the row are redacted first. */
export class RestPanelSink implements PanelSink {
  constructor(private api: NotionRestApi) {}

  async upsert(row: PanelRow, existingPageId?: string): Promise<string> {
    const properties = rowToRestProperties(redactDeep(row));
    if (existingPageId) {
      await this.api.request("PATCH", `/v1/pages/${existingPageId}`, { properties });
      return existingPageId;
    }
    try {
      const j = await this.api.request<{ id?: string }>("POST", "/v1/pages", {
        parent: { type: "data_source_id", data_source_id: PANEL_DATA_SOURCE_ID },
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

  async findRowByOrderId(orderId: string, opts: FindRowOptions = {}): Promise<string | undefined> {
    const excluded = new Set((opts.exclude ?? []).map((x) => x.replace(/-/g, "")));
    // Po znovuvydání karty: vyřazený řádek se nikdy nevezme a platí jen řádek s odkazem na aktuální kartu.
    const matches = (r: FoundRow) =>
      Boolean(r.id) && !r.in_trash && !excluded.has(r.id!.replace(/-/g, "")) && (opts.card === undefined || r.properties?.["Karta rozhodnutí"]?.url === opts.card);
    let cursor: string | undefined;
    for (let page = 0; page < FIND_MAX_PAGES; page++) {
      const j = await this.api.request<{ results?: FoundRow[]; has_more?: boolean; next_cursor?: string | null }>(
        "POST",
        `/v1/data_sources/${PANEL_DATA_SOURCE_ID}/query`,
        {
          filter: { property: "ID zakázky", rich_text: { equals: orderId } },
          sorts: [{ timestamp: "created_time", direction: "ascending" }],
          page_size: 25,
          ...(cursor ? { start_cursor: cursor } : {}),
        },
      );
      const hit = (j.results ?? []).find(matches);
      if (hit?.id) return hit.id.replace(/-/g, "");
      if (!j.has_more) return undefined; // the whole result was read and holds no live row: it does not exist
      if (!j.next_cursor) break;
      cursor = j.next_cursor;
    }
    // Page limit reached, or Notion says there is more without telling where: we cannot tell, so never answer „does not exist“.
    throw new Error("dohledání řádku nelze ověřit (neúplný výsledek)");
  }

  async readOwnerDecision(pageId: string): Promise<string | undefined> {
    return (await this.readOwnerRow(pageId)).decision;
  }

  async readOwnerRow(pageId: string): Promise<OwnerRow> {
    const j = await this.api.request<{ in_trash?: boolean; last_edited_time?: string; properties?: Record<string, { select?: { name?: string } | null; url?: string | null }> }>("GET", `/v1/pages/${pageId}`);
    if (j.in_trash) return { readable: false };
    const prop = j.properties?.[OWNER_DECISION_PROPERTY];
    const readable = Boolean(prop && typeof prop === "object" && "select" in prop);
    const cardProp = j.properties?.["Karta rozhodnutí"];
    const card = cardProp && typeof cardProp === "object" && "url" in cardProp ? (typeof cardProp.url === "string" ? cardProp.url : null) : undefined;
    return { decision: prop?.select?.name ?? undefined, last_edited_time: typeof j.last_edited_time === "string" ? j.last_edited_time : undefined, readable, card };
  }
}

/**
 * REST first; the claude -p MCP sink when REST refuses before writing (401/403/404/429, shared pause in NotionRestApi).
 * Reading the owner decision and finding a row by order id are REST only: no MCP fallback, an error means „later“.
 */
export class HybridPanelSink implements PanelSink {
  constructor(
    private rest: PanelSink,
    private mcp: PanelSink,
    private log: (message: string) => void,
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

  async readOwnerRow(pageId: string): Promise<OwnerRow> {
    if (this.rest.readOwnerRow) return this.rest.readOwnerRow(pageId);
    return { decision: await this.rest.readOwnerDecision!(pageId) }; // bez readable/card: po znovuvydání se GO nepřijme
  }

  findRowByOrderId(orderId: string, opts?: FindRowOptions): Promise<string | undefined> {
    return this.rest.findRowByOrderId!(orderId, opts);
  }
}

/** Order id → panel page id, so every transition updates the same row. */
export class PanelIndex {
  private file: string;
  constructor(runsDir: string) {
    this.file = path.join(runsDir, "panel-index.json");
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
  /**
   * Setting the page id also clears the „unknown outcome“ mark. Refused (false) for a row retired by a card reissue and
   * for an older card round: a delayed write of the old row can never point the index back at it. Call under the state lock.
   */
  set(orderId: string, pageId: string, round = 0): boolean {
    const all = this.read();
    if (round < roundOf(all, orderId) || supersededOf(all, orderId).includes(norm(pageId))) return false;
    delete all[`${UNCERTAIN_PREFIX}${orderId}`];
    this.write({ ...all, [orderId]: pageId, ...(round > 0 ? { [`${ROUND_PREFIX}${orderId}`]: String(round) } : {}) });
    return true;
  }
  /** Kolo karty, ke kterému patří řádek v indexu (0 = zakázka nikdy znovuvydaná). */
  round(orderId: string): number {
    return roundOf(this.read(), orderId);
  }
  /** Row id kola karty `round`; undefined, když index patří jinému kolu nebo ukazuje na vyřazený řádek. */
  current(orderId: string, round: number): string | undefined {
    const all = this.read();
    const id = all[orderId];
    if (!id || roundOf(all, orderId) !== round || supersededOf(all, orderId).includes(norm(id))) return undefined;
    return id;
  }
  /** Řádky vyřazené znovuvydáním karty: index na ně už nikdy neukáže a jejich rozhodnutí se nikdy nepřijme. */
  superseded(orderId: string): string[] {
    return supersededOf(this.read(), orderId);
  }
  /**
   * Znovuvydání karty (pod stavovým zámkem): dosavadní řádek se vyřadí a index patří kolu `round`, zatím bez řádku.
   * Nový řádek vznikne až s novou kartou s otiskem (`Orchestrator.syncPanel`).
   */
  retire(orderId: string, round: number): void {
    const all = this.read();
    const old = all[orderId];
    const list = supersededOf(all, orderId);
    if (old && !list.includes(norm(old))) list.push(norm(old));
    delete all[orderId];
    delete all[`${UNCERTAIN_PREFIX}${orderId}`];
    this.write({ ...all, [`${ROUND_PREFIX}${orderId}`]: String(round), [`${SUPERSEDED_PREFIX}${orderId}`]: JSON.stringify(list) });
  }
  /** Vyřazené řádky, které už nesou Stav SUPERSEDED a odkaz na nový řádek. */
  supersededMarked(orderId: string): string[] {
    return listOf(this.read()[`${MARKED_PREFIX}${orderId}`]);
  }
  markSuperseded(orderId: string, pageId: string): void {
    const all = this.read();
    const list = listOf(all[`${MARKED_PREFIX}${orderId}`]);
    if (!list.includes(norm(pageId))) list.push(norm(pageId));
    this.write({ ...all, [`${MARKED_PREFIX}${orderId}`]: JSON.stringify(list) });
  }
  private write(all: Record<string, string>): void {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n");
    fs.renameSync(tmp, this.file);
  }
  /** A create of this order's row may have been saved although we got no answer: look it up before creating again. */
  markUncertain(orderId: string): void {
    this.write({ ...this.read(), [`${UNCERTAIN_PREFIX}${orderId}`]: "1" });
  }
  isUncertain(orderId: string): boolean {
    return this.read()[`${UNCERTAIN_PREFIX}${orderId}`] === "1";
  }
  clearUncertain(orderId: string): void {
    const all = this.read();
    delete all[`${UNCERTAIN_PREFIX}${orderId}`];
    this.write(all);
  }
}

const UNCERTAIN_PREFIX = "uncertain:";
const ROUND_PREFIX = "round:";
const SUPERSEDED_PREFIX = "superseded:";
const MARKED_PREFIX = "superseded-marked:";

const norm = (id: string) => id.replace(/-/g, "");

/** Nečitelný seznam vyhodí chybu: volající pak nezapisuje ani nepřijímá (čeká), nikdy naopak. */
function listOf(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  const v = JSON.parse(raw) as unknown;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new Error("panel-index: poškozený seznam řádků");
  return v.map(norm);
}
function supersededOf(all: Record<string, string>, orderId: string): string[] {
  return listOf(all[`${SUPERSEDED_PREFIX}${orderId}`]);
}
function roundOf(all: Record<string, string>, orderId: string): number {
  const raw = all[`${ROUND_PREFIX}${orderId}`];
  if (raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error("panel-index: poškozené kolo karty");
  return n;
}
