// P16 v3 (Pravidla vlastníka v1.7, pokyn 4. 11. 9:53): every non-code check runs in ChatGPT in the browser in the
// ordinary mode Chat (switch "Chat | Work" at the top), so it draws on the ChatGPT subscription (paušál), not on the
// Work limit. Highest reasoning Chat offers: GPT-6, intensity Vysoká (fallback GPT-5.6 Sol, Vysoká). Work is never
// used for checks, not even as a fallback; there is no project. A page that shows Work is a mismatch → WAITING_REVIEW.
// Codex stays for code.
//
// No own browser code (DR-027): the steps run through McpBrowser (Playwright MCP, Chrome TARS-agent started and closed
// by guard/tars-browser.sh, every tool call through mcp-gate.ts: host allowlist incl. chatgpt.com, one submit, the
// typed prompt must match its sha256). Never logs in. The answer is read from the page as data and parsed in code.
// Whatever goes wrong (no profile/login, limit, timeout, an answer that is not exactly the schema) is `waitReview`:
// the orchestrator keeps the order in WAITING_REVIEW with the same artifact. A check is never PASS without an answer.
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AdapterResult, RunOpts, TextAdapter } from "./adapters";
import {
  BrowserLaunchError,
  DriverLimitError,
  RuleViolation,
  UiUnknownError,
  type BrowserStep,
  type SentReport,
} from "./mcp-browser";
import { redactDeep, redactSecrets, scanSecrets } from "./secret-scan";
import type { ModelFamily } from "./types";
import { parseStructuredVerdict } from "./verdict";

export const CHATGPT_URL = "https://chatgpt.com/";
/** Mode of the switch "Chat | Work" (P16 v3): always Chat. */
export const CHATGPT_MODE = "Chat";
/** The other mode of the switch. Checks never use it, not even as a fallback. */
export const CHATGPT_FORBIDDEN_MODE = "Work";
export const CHATGPT_MODEL = "GPT-6";
export const CHATGPT_MODEL_FALLBACK = "GPT-5.6 Sol";
/** Intensity slider in Chat: Nízká / Střední / Vysoká; Vysoká is the top for both Chat models. */
export const CHATGPT_INTENSITY = "Vysoká";
/** Models the check accepts (both exist only in Chat). */
export const CHAT_MODELS: readonly string[] = [
  CHATGPT_MODEL,
  CHATGPT_MODEL_FALLBACK,
];
/** How long one answer may take (Vysoká reasoning can think for many minutes). */
export const CHATGPT_ANSWER_TIMEOUT_MS = 25 * 60_000;
/** The end marker is the word + the nonce written together; the prompt holds them only apart. */
export const END_WORD = "TARSKONEC";

/** What the checker needs from the browser (McpBrowser satisfies it; tests use a fake). */
export interface WebBrowser {
  run(
    steps: BrowserStep[],
    shotsDir: string,
    /** Called once per run (also when it fails) with what the gate saw about sending. */
    onSent?: (s: SentReport) => void,
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
  /** Prompts sent by this run: 1, or 0 when it only read the answer of an already sent prompt (journal). */
  submits: 0 | 1;
  /** URL of the chat the answer belongs to (from the journal of sent prompts). */
  chat_url?: string;
  answer?: string;
}

/**
 * Journal of sent prompts (Codex review kolo 1, nález 5), one durable file per order dir. A prompt is written as
 * "sending" BEFORE it is sent, "sent" (with the chat URL) when the gate saw the send, "answered" when its answer was
 * read. While an entry is not answered, no new prompt is sent from this dir: the next run only opens the saved chat
 * and reads; without a chat URL the check waits (WAITING_REVIEW) until a new round.
 */
export const SENT_JOURNAL = "gptweb-sent.json";
export interface SentEntry {
  prompt_sha256: string;
  nonce: string;
  at: string;
  state: "sending" | "sent" | "answered";
  chat_url?: string;
}
/** Only a real ChatGPT conversation URL is ever opened again. */
export const CHAT_URL_RE = /^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9-]+\/?$/;

/** The journal of a dir; [] when there is none, undefined when it exists but cannot be read (then nothing is sent). */
export function readJournal(dir: string): SentEntry[] | undefined {
  const f = path.join(dir, SENT_JOURNAL);
  if (!fs.existsSync(f)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8")) as {
      v?: unknown;
      entries?: unknown;
    };
    if (j.v !== 1 || !Array.isArray(j.entries)) return undefined;
    return j.entries as SentEntry[];
  } catch {
    return undefined;
  }
}

/** Durable write: temp file, fsync, rename, fsync of the dir (a crash leaves the old or the new journal, never half). */
export function writeJournal(dir: string, entries: SentEntry[]): void {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, SENT_JOURNAL);
  const tmp = `${f}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, `${JSON.stringify({ v: 1, entries }, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, f);
  try {
    const d = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(d);
    } finally {
      fs.closeSync(d);
    }
  } catch {
    /* fsync of a dir is not supported everywhere; the rename is atomic */
  }
}

/** Steps that only read the answer of an already sent prompt: open its chat, wait for the marker, read. No fill. */
export function chatGptReadSteps(
  chatUrl: string,
  marker: string,
  timeoutMs = CHATGPT_ANSWER_TIMEOUT_MS,
): BrowserStep[] {
  return [
    { kind: "goto", url: chatUrl },
    { kind: "wait", ms: 4000 },
    { kind: "wait_text", text: marker, ms: timeoutMs },
    { kind: "read" },
  ];
}

const TEXT_FILE_RE = /\.(md|ya?ml|json|txt|log)$/i;

/**
 * Redacts every secret in the text files of a dir (recursively), in place; returns the kinds found (never values).
 * The MCP server writes the page snapshot itself; this runs right after every browser run (Codex review kolo 1, nález 6).
 */
export function redactSecretFiles(dir: string): string[] {
  const kinds = new Set<string>();
  const walk = (d: string) => {
    let names: fs.Dirent[];
    try {
      names = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const n of names) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p);
      else if (n.isFile() && TEXT_FILE_RE.test(n.name)) {
        const t = fs.readFileSync(p, "utf8");
        const sc = scanSecrets(t);
        if (sc.clean) continue;
        sc.kinds.forEach((k) => kinds.add(k));
        fs.writeFileSync(p, redactSecrets(t));
      }
    }
  };
  walk(dir);
  return [...kinds];
}

/** Steps of one check: open ChatGPT, mode Chat (never Work), the model, intensity, one exact submit, wait, read. */
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
      what: "režim (přepínač nahoře „Chat | Work“)",
      prefer: CHATGPT_MODE,
      fallback: `nic jiného, nikdy „${CHATGPT_FORBIDDEN_MODE}“; když „${CHATGPT_MODE}“ není, skonči s RESULT: UNKNOWN chat-nedostupny`,
    },
    {
      kind: "choose",
      what: "model",
      prefer: CHATGPT_MODEL,
      fallback: `„${CHATGPT_MODEL_FALLBACK}“; nikdy nepřepínej do režimu „${CHATGPT_FORBIDDEN_MODE}“`,
    },
    {
      kind: "choose",
      what: "intenzita přemýšlení (posuvník Nízká / Střední / Vysoká)",
      prefer: CHATGPT_INTENSITY,
      fallback: "nejvyšší stupeň posuvníku",
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
const SNAPSHOT_ONLY_LINE =
  /^\s*(?:-\s*[a-z]+(?:\s*\[[^\]\n]*\])*:?)?\s*['"]?\s*$/i;
/** The snapshot prefix of an element line (`  - paragraph [ref=e5]: `); the rest of the line is its value. */
const SNAPSHOT_PREFIX = /^\s*(?:-\s*[a-z]+(?:\s*\[[^\]\n]*\])*:[ \t]*)?/i;

/**
 * The text value of a snapshot line, decoded by its own YAML quoting (not guessed): '…' → '' is ', "…" → JSON-style
 * escapes (\" \\ \n \t \uXXXX), plain → as is. The closing quote may be missing (the end marker cut the line).
 */
export function snapshotValue(line: string, withPrefix = true): string {
  let v = (withPrefix ? line.replace(SNAPSHOT_PREFIX, "") : line).replace(
    /\s+$/,
    "",
  );
  if (v.startsWith("'")) {
    v = v.slice(1).replace(/'$/, "").replace(/''/g, "'");
  } else if (v.startsWith('"')) {
    v = v.slice(1).replace(/(?<!\\)"$/, "");
    try {
      v = JSON.parse(`"${v}"`) as string;
    } catch {
      v = v
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }
  return v.replace(/\s+$/, "");
}

/** true when `text` names a verdict of `allowed` other than `chosen` (whole words, upper case as in the schema). */
export function otherVerdictWord(
  text: string,
  chosen: string,
  allowed: readonly string[],
): boolean {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const v of allowed) {
    if (v === chosen) continue;
    // a shorter verdict inside the chosen one ("PASS" in "PASS WITH REQUIRED PATCHES") is not another verdict
    const t = chosen.includes(v) ? text.split(chosen).join(" ") : text;
    if (new RegExp(`(?<![A-Za-z_])${esc(v)}(?![A-Za-z_])`).test(t)) return true;
  }
  return false;
}

const verdictOf = (v: unknown): unknown =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>).verdict
    : undefined;

/** A button with an accessible name but no text value (ChatGPT UI: copy, rate, "Přemýšlení trvalo 2 min"). */
const UI_BUTTON_LINE =
  /^\s*-\s*button(?:\s+"[^"\n]*")?(?:\s*\[[^\]\n]*\])*:?\s*$/i;
/** The heading ChatGPT puts above an assistant message ("ChatGPT řekl:" / "ChatGPT said:"). */
const ASSISTANT_HEADING =
  /^\s*-\s*heading\s+"ChatGPT(?:\s+(?:řekl|said))?:?"(?:\s*\[[^\]\n]*\])*:?\s*$/i;

/**
 * true when the end marker is the real end of the last assistant message (Codex review kolo 1, nález 3): on its line
 * only a closing quote may follow; the following lines of the same block (indented at least as deep as the marker's
 * line) hold no text, only snapshot structure or text-less buttons; and no further assistant message follows anywhere.
 * Anything else (e.g. a correction to FIX after the marker) = the answer did not end with the marker → unclear.
 */
export function markerEndsAnswer(page: string, marker: string): boolean {
  const at = page.lastIndexOf(marker);
  if (at < 0) return false;
  const lineStart = page.lastIndexOf("\n", at) + 1;
  const nl = page.indexOf("\n", at);
  if (
    !/^\s*['"]?\s*$/.test(
      page.slice(at + marker.length, nl < 0 ? undefined : nl),
    )
  )
    return false;
  if (nl < 0) return true;
  const indent = (l: string) => l.length - l.trimStart().length;
  const mi = indent(page.slice(lineStart, at));
  let inBlock = true;
  for (const l of page.slice(nl + 1).split("\n")) {
    if (ASSISTANT_HEADING.test(l)) return false;
    if (!l.trim()) continue;
    if (indent(l) < mi) inBlock = false;
    if (!inBlock || SNAPSHOT_ONLY_LINE.test(l) || UI_BUTTON_LINE.test(l))
      continue;
    return false;
  }
  return true;
}

/** The answer line as one JSON object on ONE line (decoded by its YAML quoting), or undefined. */
function singleLineObject(line: string): unknown {
  const v = snapshotValue(line);
  if (v.includes("\n")) return undefined;
  const t = v.trim();
  if (!t.startsWith("{") || objectEnd(t, 0) !== t.length) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/**
 * The verdict from the answer region (P16, never a false PASS). The answer must be exactly the schema (Codex review
 * kolo 1, nález 2): one JSON object on one line, then the end marker. Concretely:
 *  1. from the end, only lines of pure snapshot structure are dropped (no names, no text);
 *  2. the last line must be one JSON object on one line (alone in its element, after the element prefix), decoded by
 *     the line's real YAML quoting; whitespace before the end marker is ignored;
 *  3. that object must be exactly the schema;
 *  4. every line before it may only be ChatGPT UI without text: snapshot structure, a text-less button, the heading
 *     "ChatGPT řekl:"; no other verdict word or verdict object in those names. Any text (prose such as "only a quoted
 *     sample, I did not check", a heading, a second JSON, a JSON pretty-printed over several lines) = unclear.
 * Unclear → undefined → WAITING_REVIEW.
 */
export function verdictFromAnswer(
  region: string,
  schema: Record<string, unknown>,
): string | undefined {
  const allowed = ((
    schema.properties as Record<string, { enum?: string[] }> | undefined
  )?.verdict?.enum ?? []) as string[];
  if (!allowed.length) return undefined;
  const lines = region.split("\n");
  while (lines.length && SNAPSHOT_ONLY_LINE.test(lines[lines.length - 1]))
    lines.pop();
  if (!lines.length) return undefined;
  const value = singleLineObject(lines[lines.length - 1]);
  if (value === undefined) return undefined;
  const found = JSON.stringify(value);
  if (!parseStructuredVerdict(found, allowed)) return undefined;
  const before = lines.slice(0, -1);
  if (
    before.some(
      (l) =>
        !SNAPSHOT_ONLY_LINE.test(l) &&
        !UI_BUTTON_LINE.test(l) &&
        !ASSISTANT_HEADING.test(l),
    )
  )
    return undefined;
  // Button names are UI, but none may carry another verdict or a JSON verdict object (no blocking finding gets lost).
  for (const c of jsonObjectsIn(before.join("\n")))
    if (verdictOf(c.value) !== undefined) return undefined;
  if (
    otherVerdictWord(
      before.map((l) => snapshotValue(l)).join("\n"),
      String(verdictOf(value)),
      allowed,
    )
  )
    return undefined;
  return found;
}

/**
 * Model and intensity as the page shows them (model picker in the header comes first in the snapshot). The version is
 * read whole and only a known name word may follow, so "GPT-6" is never "GPT-6.1 Sol" or "GPT-5.6 Sol" and an
 * intensity word ("GPT-6 Vysoká") is never part of the model name.
 */
export function detectModel(page: string): {
  model?: string;
  intensity?: string;
} {
  const head = page.slice(0, 30_000);
  const m =
    /(?<![\p{L}\d])((?:Chat)?GPT[- ]?\d+(?:\.\d+)*(?:[ -](?:Sol|Pro|Thinking|Instant|mini|Mini)(?![\p{L}\d]))?)(?![\p{L}\d.]*\d)/u.exec(
      head,
    );
  if (!m) return {};
  const near = head.slice(m.index, m.index + 300);
  const i =
    /(?<![\p{L}\d])(Max\.?|Maximální|Maximum|Heavy|Extended|Vysoká|High|Střední|Medium|Standard|Light|Nízká|Low)(?=[\s"'\]):,·]|$)/u.exec(
      near.slice(m[1].length),
    );
  return { model: m[1], intensity: i?.[1] };
}

/** Intensity "Vysoká" (High) as the page shows it. */
export const isHighIntensity = (intensity?: string): boolean =>
  intensity === "Vysoká" || intensity === "High";

/** A selected "Work" in the mode switch (snapshot state), not the mere label (the switch always shows both modes). */
const WORK_SELECTED_RE =
  /-\s*[a-z]+\s+"Work"[^\n]*\[(?:pressed|selected|checked)(?:=true)?\]/i;

/**
 * true when the page shows that the check runs in Work instead of Chat (P16 v3): the mode switch has Work selected, or
 * the page shows a Work model or intensity (GPT-6.1 Sol, Max.), which do not exist in Chat.
 */
export function ranInWork(
  page: string,
  seen: { model?: string; intensity?: string },
): boolean {
  if (WORK_SELECTED_RE.test(page.slice(0, 30_000))) return true;
  if (seen.model && /^(?:Chat)?GPT[- ]?6\.1\b/.test(seen.model)) return true;
  return Boolean(seen.intensity && /^Max/.test(seen.intensity));
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
  readonly name = `ChatGPT web (${CHATGPT_MODE}, ${CHATGPT_MODEL} · ${CHATGPT_INTENSITY})`;
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
    const stamp = now().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
    const shots = path.join(opts.cwd, `shots-gptweb-${stamp}`);
    const jdir = opts.journalDir ?? opts.cwd;
    // The prompt as the reviewer gets it, without the per-send nonce: the key of the journal of sent prompts.
    const promptSha = createHash("sha256")
      .update(`${prompt}\n${JSON.stringify(opts.outputSchema ?? null)}`)
      .digest("hex");
    let submits: 0 | 1 = 0;
    let chatUrl: string | undefined;
    /**
     * Writes the record (diagnostics). Codex review kolo 1, nález 6: it is scanned for secrets BEFORE anything is
     * written; with a hit only the redacted record is written (no value) and the kinds are returned (the caller rejects).
     */
    const record = (
      r: Omit<WebCheckRecord, "at" | "requested_model" | "submits">,
    ): string[] => {
      let rec: WebCheckRecord = {
        at: now().toISOString(),
        requested_model: this.requestedModel,
        submits,
        ...(chatUrl ? { chat_url: chatUrl } : {}),
        ...r,
      };
      const sc = scanSecrets(JSON.stringify(rec));
      if (!sc.clean) rec = redactDeep(rec);
      this.lastRecord = rec;
      try {
        fs.writeFileSync(
          path.join(opts.cwd, `check-gptweb-${stamp}.md`),
          recordMarkdown(rec),
        );
      } catch {
        /* the record is diagnostics; the caller stores the verdict and logs the call */
      }
      return sc.kinds;
    };
    /** A secret in the answer, the page or the record: rejected (like SecretScanningAdapter), the value never stored. */
    const rejected = (kinds: string[], actual: string): AdapterResult => {
      record({
        status: "WAITING_REVIEW",
        actual_model: actual,
        model_matches: false,
        reason: `secret-scan: ${kinds.join(",")} (hodnota skryta, odpověď se nepoužije)`,
      });
      return {
        ok: false,
        text: "",
        limit: false,
        error: `secret-scan: ${kinds.join(",")}`,
        duration_ms: Date.now() - t0,
      };
    };
    const waiting = (reason: string, actual = "neověřeno"): AdapterResult => {
      const kinds = record({
        status: "WAITING_REVIEW",
        actual_model: actual,
        model_matches: false,
        reason,
      });
      if (kinds.length) return rejected(kinds, actual);
      return {
        ok: false,
        text: "",
        limit: false,
        waitReview: true,
        error: `čeká na kontrolu: ${reason}`,
        duration_ms: Date.now() - t0,
      };
    };
    // Codex review kolo 1, nález 5: a prompt is sent at most once per order dir. An entry that is not answered yet
    // means: never send again; open its chat and only read, or wait when there is no chat URL.
    const journal = readJournal(jdir);
    if (!journal)
      return waiting(
        "deník odeslaných promptů nejde přečíst; nový prompt se neposílá",
      );
    const open = journal.find((e) => e.state !== "answered");
    if (open && open.prompt_sha256 !== promptSha)
      return waiting(
        `v této zakázce čeká odpověď na jiný už odeslaný prompt (sha256 ${String(open.prompt_sha256).slice(0, 12)}…); nový prompt se bez nového kola neposílá`,
      );
    if (open && !(open.chat_url && CHAT_URL_RE.test(open.chat_url)))
      return waiting(
        "prompt už byl odeslán (nebo odeslání nejde vyloučit), ale URL chatu chybí; odpověď nejde přečíst a nový prompt se bez nového kola neposílá",
      );
    const nonce =
      open?.nonce ?? (this.o.nonce ?? (() => randomBytes(5).toString("hex")))();
    const marker = `${END_WORD}${nonce}`;
    if (prompt.includes(marker))
      return waiting(
        "prompt už obsahuje koncovou značku (nelze bezpečně číst odpověď)",
      );
    let entries = journal;
    const save = (next: SentEntry[]): boolean => {
      try {
        writeJournal(jdir, next);
        entries = next;
        return true;
      } catch {
        return false;
      }
    };
    const isMine = (e: SentEntry) =>
      e.prompt_sha256 === promptSha && e.state !== "answered";
    let steps: BrowserStep[];
    if (open) {
      chatUrl = open.chat_url;
      steps = chatGptReadSteps(open.chat_url!, marker, this.o.timeoutMs);
    } else {
      // Write-ahead: the entry is durable BEFORE the send, so a crash during the run can never lead to a second send.
      if (
        !save([
          ...journal,
          {
            prompt_sha256: promptSha,
            nonce,
            at: now().toISOString(),
            state: "sending",
          },
        ])
      )
        return waiting("deník odeslaných promptů nejde zapsat; nic neodesláno");
      steps = chatGptSteps(
        prompt + answerInstructions(nonce, opts.outputSchema),
        marker,
        this.o.timeoutMs,
      );
    }
    let report: SentReport | undefined;
    /** Records what the gate saw about sending (a read-only run never sends). */
    const settle = () => {
      const mine = open ? undefined : entries.find(isMine);
      if (!mine) return;
      const others = entries.filter((e) => !isMine(e));
      if (report?.submitted === false) {
        save(others); // provably not sent: a later run may send it
        return;
      }
      if (report?.submitted !== true) return; // unknown: stays "sending" (never sent again, waits)
      submits = 1;
      chatUrl =
        report.url && CHAT_URL_RE.test(report.url) ? report.url : undefined;
      save([
        ...others,
        { ...mine, state: "sent", ...(chatUrl ? { chat_url: chatUrl } : {}) },
      ]);
    };
    let page: string;
    try {
      const r = await this.browser.run(steps, shots, (sent) => {
        report = sent;
      });
      page = r.rawReads.at(-1) ?? "";
    } catch (e) {
      settle();
      const kinds = redactSecretFiles(shots);
      if (kinds.length) return rejected(kinds, "neověřeno");
      return waiting(waitReason(e));
    }
    settle();
    // Codex review kolo 1, nález 6: a secret anywhere on the page (snapshot) = rejected; the files are redacted.
    const fileKinds = redactSecretFiles(shots);
    const pageScan = scanSecrets(page);
    if (fileKinds.length || !pageScan.clean)
      return rejected(
        [...new Set([...fileKinds, ...pageScan.kinds])],
        "neověřeno",
      );
    const seen = detectModel(page);
    const actual = seen.model
      ? `${seen.model}${seen.intensity ? ` · ${seen.intensity}` : ""}`
      : "neověřeno (stránka model neukazuje)";
    this.model = actual;
    // P16 v3: Work is never a valid place for a check; the answer is not used, the order waits (never pretended).
    if (ranInWork(page, seen))
      return waiting("běží v režimu Work místo Chat", actual);
    const matches =
      seen.model !== undefined &&
      CHAT_MODELS.includes(seen.model) &&
      isHighIntensity(seen.intensity);
    const region = answerRegion(page, marker, nonce);
    if (region === undefined)
      return waiting(
        LIMIT_PAGE_RE.test(page)
          ? "ChatGPT je na limitu"
          : "odpověď ChatGPT není dokončená nebo konec promptu není na stránce (koncová značka chybí)",
        actual,
      );
    // Codex review kolo 1, nález 3: nothing of the answer may follow the end marker in the same message.
    if (!markerEndsAnswer(page, marker))
      return waiting(
        "za koncovou značkou následuje další obsah odpovědi (značka není konec odpovědi)",
        actual,
      );
    // Codex review kolo 1, nález 1: only the requested Chat model at intensity Vysoká counts; another or unverified
    // model/intensity = the answer is not used, the order waits (never PASS).
    if (!matches)
      return waiting(
        `model nebo intenzita neodpovídá požadovanému ${this.requestedModel} (stránka: ${actual})`,
        actual,
      );
    let text: string;
    if (opts.outputSchema) {
      const v = verdictFromAnswer(region, opts.outputSchema);
      if (!v)
        return waiting(
          LIMIT_PAGE_RE.test(region)
            ? "ChatGPT je na limitu"
            : "nejasný výsledek: odpověď není přesně jeden JSON objekt podle schématu na jednom řádku",
          actual,
        );
      text = v;
    } else {
      text = region.slice(-4000).trim();
      if (!text) return waiting("prázdná odpověď", actual);
    }
    const kinds = record({
      status: "ANSWER",
      actual_model: actual,
      model_matches: matches,
      answer: text,
    });
    if (kinds.length) return rejected(kinds, actual);
    save(
      entries.map((e) =>
        isMine(e) ? { ...e, state: "answered" as const } : e,
      ),
    );
    return { ok: true, text, limit: false, duration_ms: Date.now() - t0 };
  }
}

export function recordMarkdown(r: WebCheckRecord): string {
  return [
    "# Kontrola GPT v prohlížeči (P16 v3, Chat)",
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
