// Notion control panel "TARS — Zakázky": one row per order, rewritten on EVERY state transition.
// The row is computed deterministically from state.json (no LLM decides any value).
// Transport: Notion REST API if NOTION_TOKEN is set; otherwise the official Notion MCP connector
// via `claude -p`, where the code verifies that the executed tool call carried exactly the
// payload it asked for (stream-json tool_use input == expected) — the model only transports.
// A panel failure never stops an order: it is logged and caught up on the next transition.
import fs from "node:fs";
import path from "node:path";

import { runProcess } from "./adapters";
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
}

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
  };
}

export interface PanelSink {
  /** Creates or updates the row; returns the row page id. Throws on failure. */
  upsert(row: PanelRow, existingPageId?: string): Promise<string>;
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

  async upsert(row: PanelRow, existingPageId?: string): Promise<string> {
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
        "--allowedTools",
        tool,
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
  set(orderId: string, pageId: string): void {
    fs.writeFileSync(
      this.file,
      JSON.stringify({ ...this.read(), [orderId]: pageId }, null, 2) + "\n",
    );
  }
}
