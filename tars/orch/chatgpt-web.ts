// P16 v2 (pokyn vlastníka 4. 11.): every non-code check runs in ChatGPT in the browser — mode Work, project
// "TARS · Analýzy", the model with the highest reasoning (today GPT-6.1 Sol, intensity Max.). Codex stays for code.
//
// No own browser code (DR-027): the steps run through McpBrowser (Playwright MCP, Chrome TARS-agent started and closed
// by guard/tars-browser.sh, every tool call through mcp-gate.ts: host allowlist incl. chatgpt.com, one submit, the
// typed prompt must match its sha256). Never logs in. The answer is read from the page as data and parsed in code.
// Whatever goes wrong (no profile/login, limit, timeout, an answer that is not exactly the schema) is `waitReview`:
// the orchestrator keeps the order in WAITING_REVIEW with the same artifact. A check is never PASS without an answer.
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AdapterResult, RunOpts, TextAdapter } from "./adapters";
import {
  BrowserLaunchError,
  DriverLimitError,
  RuleViolation,
  UiUnknownError,
  type BrowserStep,
} from "./mcp-browser";
import type { ModelFamily } from "./types";
import { parseStructuredVerdict } from "./verdict";

export const CHATGPT_URL = "https://chatgpt.com/";
export const CHATGPT_WORKSPACE = "Work";
export const CHATGPT_PROJECT = "TARS · Analýzy";
export const CHATGPT_MODEL = "GPT-6.1 Sol";
export const CHATGPT_INTENSITY = "Max.";
/** How long one answer may take (Max. reasoning can think for many minutes). */
export const CHATGPT_ANSWER_TIMEOUT_MS = 25 * 60_000;
/** The end marker is the word + the nonce written together; the prompt holds them only apart. */
export const END_WORD = "TARSKONEC";

/** What the checker needs from the browser (McpBrowser satisfies it; tests use a fake). */
export interface WebBrowser {
  run(
    steps: BrowserStep[],
    shotsDir: string,
  ): Promise<{ rawReads: string[]; screenshots: string[]; finalUrl: string }>;
}

export interface WebCheckRecord {
  at: string;
  status: "ANSWER" | "WAITING_REVIEW";
  requested_model: string;
  /** Model and intensity as the page shows them; "neověřeno" when the page does not show them. */
  actual_model: string;
  model_matches: boolean;
  reason?: string;
  submits: 1;
  answer?: string;
}

/** Steps of one check: open ChatGPT, mode Work, the project, the model, intensity, one exact submit, wait, read. */
export function chatGptSteps(
  prompt: string,
  marker: string,
  timeoutMs = CHATGPT_ANSWER_TIMEOUT_MS,
): BrowserStep[] {
  return [
    { kind: "goto", url: CHATGPT_URL },
    { kind: "wait", ms: 4000 },
    {
      kind: "choose",
      what: "režim / pracovní prostor (workspace)",
      prefer: CHATGPT_WORKSPACE,
      fallback: `nic jiného; když „${CHATGPT_WORKSPACE}“ není, skonči s RESULT: UNKNOWN work-nedostupny`,
    },
    { kind: "click", text: CHATGPT_PROJECT },
    {
      kind: "choose",
      what: "model",
      prefer: CHATGPT_MODEL,
      fallback: "dostupný model s nejvyšší intenzitou přemýšlení",
    },
    {
      kind: "choose",
      what: "intenzita přemýšlení",
      prefer: CHATGPT_INTENSITY,
      fallback: "nejvyšší dostupná intenzita přemýšlení",
    },
    {
      kind: "fill",
      selector: 'div[contenteditable="true"]#prompt-textarea, textarea',
      value: prompt,
      submit: true,
      exact: true,
    },
    { kind: "wait_text", text: marker, ms: timeoutMs },
    { kind: "read" },
  ];
}

/** Final instructions appended to the reviewed prompt. The nonce is the very last word of the prompt. */
export function answerInstructions(
  nonce: string,
  schema?: Record<string, unknown>,
): string {
  const format = schema
    ? `Odpověz POUZE jedním JSON objektem přesně podle tohoto JSON Schema, na JEDNOM řádku, bez code bloku a bez dalšího textu:\n${JSON.stringify(schema)}`
    : "Odpověz stručně podle zadání výše.";
  return `\n\n---\nFORMÁT ODPOVĚDI (TARS, kontrola jiné rodiny modelů)\n${format}\nPo odpovědi napiš na samostatný řádek značku, která vznikne spojením slova ${END_WORD} a kódu níže, bez mezery.\nKód: ${nonce}`;
}

const unescapes: ((s: string) => string)[] = [
  (s) => s,
  (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
  (s) => s.replace(/''/g, "'"),
];

/** End index (exclusive) of the balanced JSON object starting at `start` (string-aware), or -1. */
function objectEnd(s: string, start: number): number {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/** All JSON objects in a page text (also inside YAML-escaped snapshot strings), in order of their end position. */
export function jsonObjectsIn(text: string): { end: number; value: unknown }[] {
  const out: { end: number; value: unknown }[] = [];
  for (const u of unescapes) {
    const s = u(text);
    for (let i = s.indexOf("{"); i >= 0; i = s.indexOf("{", i + 1)) {
      const e = objectEnd(s, i);
      if (e < 0) continue;
      try {
        out.push({
          end: e + (text.length - s.length),
          value: JSON.parse(s.slice(i, e)),
        });
      } catch {
        /* not JSON */
      }
    }
  }
  return out.sort((a, b) => a.end - b.end);
}

/** The answer region: page text before the end marker (the last one), at most the last 40 000 characters. */
/** Last line of the sent prompt (answerInstructions): the answer starts after it. */
export const promptEnd = (nonce: string) => `Kód: ${nonce}`;

/**
 * The answer region: page text strictly between the end of the sent prompt (`Kód: <nonce>`, its last occurrence before
 * the marker) and the end marker (its last occurrence). Nothing of the prompt (the reviewed draft may contain JSON) is
 * ever part of it. undefined = marker or prompt end not on the page (unfinished, collapsed prompt) → unclear.
 */
export function answerRegion(
  page: string,
  marker: string,
  nonce: string,
): string | undefined {
  const at = page.lastIndexOf(marker);
  if (at < 0) return undefined;
  const end = promptEnd(nonce);
  const start = page.lastIndexOf(end, at - 1);
  if (start < 0 || start + end.length > at) return undefined;
  return page.slice(start + end.length, at);
}

/**
 * A line that is only snapshot structure: a role with optional attributes (`- paragraph [ref=e5]:`), quotes or nothing.
 * No accessible name in quotes and no text: those are content and may never be skipped.
 */
const SNAPSHOT_ONLY_LINE = /^\s*(?:-\s*[a-z]+(?:\s*\[[^\]\n]*\])*:?)?\s*['"]?\s*$/i;
/** The snapshot prefix of an element line (`  - paragraph [ref=e5]: `); the rest of the line is its value. */
const SNAPSHOT_PREFIX = /^\s*(?:-\s*[a-z]+(?:\s*\[[^\]\n]*\])*:[ \t]*)?/i;

/**
 * The text value of a snapshot line, decoded by its own YAML quoting (not guessed): '…' → '' is ', "…" → JSON-style
 * escapes (\" \\ \n \t \uXXXX), plain → as is. The closing quote may be missing (the end marker cut the line).
 */
export function snapshotValue(line: string, withPrefix = true): string {
  let v = (withPrefix ? line.replace(SNAPSHOT_PREFIX, "") : line).replace(/\s+$/, "");
  if (v.startsWith("'")) {
    v = v.slice(1).replace(/'$/, "").replace(/''/g, "'");
  } else if (v.startsWith('"')) {
    v = v.slice(1).replace(/(?<!\\)"$/, "");
    try {
      v = JSON.parse(`"${v}"`) as string;
    } catch {
      v = v.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }
  return v.replace(/\s+$/, "");
}

const verdictOf = (v: unknown): unknown => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>).verdict : undefined);

/** The JSON object that the answer ends with: on the last content line, or starting up to 200 lines higher (pretty JSON). */
function trailingObject(lines: string[]): { value: unknown; startLine: number } | undefined {
  const last = lines.length - 1;
  for (let k = last; k >= Math.max(0, last - 200); k--) {
    const text =
      k === last
        ? snapshotValue(lines[k])
        : [snapshotValue(lines[k]), ...lines.slice(k + 1, last).map((l) => l.replace(/\s+$/, "")), snapshotValue(lines[last], false)].join("\n");
    const t = text.trim();
    if (!t.startsWith("{") || objectEnd(t, 0) !== t.length) continue;
    try {
      return { value: JSON.parse(t), startLine: k };
    } catch {
      /* not JSON from this line; try a higher start */
    }
  }
  return undefined;
}

/**
 * The verdict from the answer region (P16 v2, never a false PASS, no needless stop):
 *  1. from the end, only lines of pure snapshot structure are dropped (no names, no text);
 *  2. the answer must END with one JSON object (alone in its element, after the element prefix; one line or several),
 *     decoded by the line's real YAML quoting; whitespace before the end marker is ignored;
 *  3. that object must be exactly the schema; an invalid one = unclear, earlier objects are never searched;
 *  4. no other schema-valid verdict object with a different verdict may appear anywhere in the answer.
 * Anything else (prose after the JSON, a quoted element name, conflicting verdicts) is unclear → undefined →
 * WAITING_REVIEW.
 */
export function verdictFromAnswer(region: string, schema: Record<string, unknown>): string | undefined {
  const allowed = ((schema.properties as Record<string, { enum?: string[] }> | undefined)?.verdict?.enum ?? []) as string[];
  if (!allowed.length) return undefined;
  const lines = region.split("\n");
  while (lines.length && SNAPSHOT_ONLY_LINE.test(lines[lines.length - 1])) lines.pop();
  if (!lines.length) return undefined;
  const t = trailingObject(lines);
  if (t === undefined) return undefined;
  const found = JSON.stringify(t.value);
  if (!parseStructuredVerdict(found, allowed)) return undefined;
  // The conflict guard protects against a false PASS only: a FIX/BLOCK never lets an order through. It looks only at
  // the answer BEFORE the chosen object, never inside it (a finding may quote a PASS JSON, e.g. from the draft).
  if (verdictOf(t.value) === "PASS") {
    const before = lines.slice(0, t.startLine);
    for (const part of [...before.map((l) => snapshotValue(l)), before.join("\n")]) {
      for (const c of jsonObjectsIn(part)) {
        if (parseStructuredVerdict(JSON.stringify(c.value), allowed) && verdictOf(c.value) !== "PASS") return undefined;
      }
    }
  }
  return found;
}

/** Model and intensity as the page shows them (model picker in the header comes first in the snapshot). */
export function detectModel(page: string): {
  model?: string;
  intensity?: string;
} {
  const head = page.slice(0, 30_000);
  const m =
    /\b((?:Chat)?GPT[- ]?\d+(?:\.\d+)?(?:[ -](?:Sol|Pro|Thinking|Instant|mini|Mini|[A-Z][a-z]{2,12}))?)\b/.exec(
      head,
    );
  if (!m) return {};
  const near = head.slice(m.index, m.index + 300);
  const i =
    /\b(Max\.?|Maximální|Maximum|Heavy|Extended|Vysoká|High|Střední|Medium|Standard|Light)(?=[\s"'\]):,]|$)/.exec(
      near.slice(m[1].length),
    );
  return { model: m[1], intensity: i?.[1] };
}

const LIMIT_PAGE_RE =
  /(you['’]ve (hit|reached) (your|the) (usage )?limit|usage cap|limit (for|on) .*(messages|reasoning)|dosáhli jste limitu|limit zpráv)/i;

export function waitReason(e: unknown): string {
  const msg = String((e as Error)?.message ?? e)
    .split("\n")[0]
    .slice(0, 200);
  if (/nepřihlá|log ?in|sign ?up|přihlásit|přihlášen/i.test(msg))
    return "profil TARS-agent není přihlášen do ChatGPT (TARS se nepřihlašuje)";
  if (e instanceof DriverLimitError)
    return `ovladač prohlížeče (Claude) je na limitu: ${msg}`;
  if (/timeout/i.test(msg))
    return "odpověď ChatGPT nedorazila v časovém limitu";
  if (e instanceof BrowserLaunchError)
    return `prohlížeč TARS-agent nejde spustit: ${msg}`;
  if (e instanceof RuleViolation)
    return `pravidla prohlížeče zastavila běh: ${msg}`;
  if (e instanceof UiUnknownError) return `ChatGPT v prohlížeči: ${msg}`;
  return `ChatGPT v prohlížeči selhal: ${msg}`;
}

export interface ChatGptWebOpts {
  timeoutMs?: number;
  nonce?: () => string;
  now?: () => Date;
}

export class ChatGptWebChecker implements TextAdapter {
  readonly family: ModelFamily = "gpt";
  readonly name = `ChatGPT web (${CHATGPT_WORKSPACE}, projekt ${CHATGPT_PROJECT})`;
  /** The answer is validated against RunOpts.outputSchema in code, so the text it returns is exactly one schema JSON. */
  readonly supportsOutputSchema = true;
  readonly requestedModel = `${CHATGPT_MODEL} · ${CHATGPT_INTENSITY}`;
  /** Before the first check: the requested model; after a check: the model the page really showed. */
  model: string;
  lastRecord?: WebCheckRecord;
  constructor(
    private browser: WebBrowser,
    private o: ChatGptWebOpts = {},
  ) {
    this.model = `${this.requestedModel} (požadováno)`;
  }

  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    const t0 = Date.now();
    const now = this.o.now ?? (() => new Date());
    const nonce = (this.o.nonce ?? (() => randomBytes(5).toString("hex")))();
    const marker = `${END_WORD}${nonce}`;
    const full = prompt + answerInstructions(nonce, opts.outputSchema);
    const stamp = now().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
    const shots = path.join(opts.cwd, `shots-gptweb-${stamp}`);
    const record = (
      r: Omit<WebCheckRecord, "at" | "requested_model" | "submits">,
    ): WebCheckRecord => {
      const rec: WebCheckRecord = {
        at: now().toISOString(),
        requested_model: this.requestedModel,
        submits: 1,
        ...r,
      };
      this.lastRecord = rec;
      try {
        fs.writeFileSync(
          path.join(opts.cwd, `check-gptweb-${stamp}.md`),
          recordMarkdown(rec),
        );
      } catch {
        /* the record is diagnostics; the caller stores the verdict and logs the call */
      }
      return rec;
    };
    const waiting = (reason: string, actual = "neověřeno"): AdapterResult => {
      record({
        status: "WAITING_REVIEW",
        actual_model: actual,
        model_matches: false,
        reason,
      });
      return {
        ok: false,
        text: "",
        limit: false,
        waitReview: true,
        error: `čeká na kontrolu: ${reason}`,
        duration_ms: Date.now() - t0,
      };
    };
    if (prompt.includes(marker))
      return waiting(
        "prompt už obsahuje koncovou značku (nelze bezpečně číst odpověď)",
      );
    let page: string;
    try {
      const r = await this.browser.run(
        chatGptSteps(full, marker, this.o.timeoutMs),
        shots,
      );
      page = r.rawReads.at(-1) ?? "";
    } catch (e) {
      return waiting(waitReason(e));
    }
    const seen = detectModel(page);
    const actual = seen.model
      ? `${seen.model}${seen.intensity ? ` · ${seen.intensity}` : ""}`
      : "neověřeno (stránka model neukazuje)";
    const matches =
      seen.model === CHATGPT_MODEL &&
      Boolean(seen.intensity?.startsWith("Max"));
    this.model = actual;
    const region = answerRegion(page, marker, nonce);
    if (region === undefined)
      return waiting(
        LIMIT_PAGE_RE.test(page)
          ? "ChatGPT je na limitu"
          : "odpověď ChatGPT není dokončená nebo konec promptu není na stránce (koncová značka chybí)",
        actual,
      );
    let text: string;
    if (opts.outputSchema) {
      const v = verdictFromAnswer(region, opts.outputSchema);
      if (!v)
        return waiting(
          LIMIT_PAGE_RE.test(region)
            ? "ChatGPT je na limitu"
            : "nejasný výsledek: odpověď není JSON podle schématu",
          actual,
        );
      text = v;
    } else {
      text = region.slice(-4000).trim();
      if (!text) return waiting("prázdná odpověď", actual);
    }
    record({
      status: "ANSWER",
      actual_model: actual,
      model_matches: matches,
      answer: text,
    });
    return { ok: true, text, limit: false, duration_ms: Date.now() - t0 };
  }
}

export function recordMarkdown(r: WebCheckRecord): string {
  return [
    "# Kontrola GPT v prohlížeči (P16 v2)",
    "",
    `- Čas: ${r.at}`,
    `- Stav: ${r.status}`,
    `- Požadovaný model: ${r.requested_model}`,
    `- Skutečný model (ze stránky): ${r.actual_model}${r.model_matches ? "" : " — NEODPOVÍDÁ požadovanému nebo neověřeno"}`,
    `- Odesláno zpráv: ${r.submits}`,
    ...(r.reason ? [`- Důvod čekání: ${r.reason}`] : []),
    ...(r.answer
      ? ["", "## Odpověď (data ze stránky)", "", "```json", r.answer, "```"]
      : []),
    "",
  ].join("\n");
}
