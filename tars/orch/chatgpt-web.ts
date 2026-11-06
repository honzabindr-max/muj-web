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
  DisplayAsleepError,
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
/**
 * Intensity slider in Chat: Nízká / Střední / Vysoká (English UI: Low / Medium / High); the top step (Vysoká = High)
 * is the target for both Chat models. A top step with another label is a mismatch; Max exists only in Work.
 */
export const CHATGPT_INTENSITY = "Vysoká";
export const CHATGPT_INTENSITY_EN = "High";
/** The picker in the composer that holds the intensity slider and (behind "Medium ›" / "Vysoká ›") the model list. */
export const CHATGPT_PICKER = "Vybrat model ChatGPT";
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
 * Journal of attempts (Codex review kolo 2, nálezy 1, 3, 4: one attempt = one new chat = one nonce = one send), one
 * durable file per order dir. An attempt is written as "sending" BEFORE the send and "sent" when the gate saw it. Its
 * answer is accepted only in the same browser run that sent it, and only when that run showed Chat + an allowed model +
 * Vysoká before the send and after the answer; then the attempt is "answered" with the answer and both models stored.
 * Anything else (timeout, mismatch, crash, any doubt) makes the attempt "burned" for good: its chat is never opened
 * again and its answer is never accepted, not even by a later read. A provably unsent attempt is removed.
 * Codex review PR #101 kolo 3: a stored answer is never restored. An "answered" attempt found by a later run (crash
 * between "answered" and storing the result) is burned like any interrupted attempt; nothing is sent automatically.
 * Codex review kolo 3, nález 1: a burned attempt is never followed by an automatic one. While the last attempt of the
 * dir is burned, nothing is sent; the order stays in WAITING_REVIEW with the reason. A new attempt (new chat, new
 * nonce, one send) needs an explicit grant from `cli.ts gpt-retry` (RETRY_FILE).
 */
export const SENT_JOURNAL = "gptweb-sent.json";
export interface SentEntry {
  prompt_sha256: string;
  nonce: string;
  at: string;
  state: "sending" | "sent" | "answered" | "burned";
  chat_url?: string;
  /** Why the attempt is burned (redacted, never a value). */
  reason?: string;
  /** answered: the validated answer and the models the same run showed before the send and after the answer. */
  answer?: string;
  model_before?: string;
  model_after?: string;
}
/**
 * Codex review PR #101 kolo 3: an answer is accepted only in the browser run that sent and read it (the control is
 * verified live in that run). A stored "answered" attempt is never restored from the journal (the journal is written
 * by the same order dir and proves nothing): after a restart it is burned with this reason, nothing is sent.
 */
export const INTERRUPTED_ATTEMPT =
  "přerušený pokus, obnova z deníku se nepovoluje";
const isFinal = (e: SentEntry) =>
  e.state === "answered" || e.state === "burned";
/** Only a real ChatGPT conversation URL is recorded (diagnostics; a chat is never opened again). */
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
  writeDurableJson(dir, SENT_JOURNAL, { v: 1, entries });
}

/**
 * Explicit retry grants (Codex review kolo 3, nález 1): after a burned attempt (timeout, mismatch, crash, any doubt)
 * nothing is sent again automatically, not on the next tick and not on the next day. A new attempt (new chat, new
 * nonce, at most one send) needs one unused grant, written only by `npx tsx tars/orch/cli.ts gpt-retry <id> <kdo>
 * <proč>` (Fable or the owner). The run that sends marks the grant used BEFORE it writes its attempt, so one grant is
 * never more than one send. One file per order dir, next to the journal.
 */
export const RETRY_FILE = "gptweb-retry.json";
export const RETRY_BY = ["fable", "vlastnik"] as const;
export type RetryBy = (typeof RETRY_BY)[number];
export interface RetryGrant {
  by: RetryBy;
  at: string;
  /** Why the retry is wanted (redacted, max. 300 characters). */
  why: string;
  /** Set by the run that uses the grant, before its send. */
  used_at?: string;
  nonce?: string;
}

/** The grants of a dir; [] when there is none, undefined when the file exists but cannot be read (then nothing is sent). */
export function readRetries(dir: string): RetryGrant[] | undefined {
  const f = path.join(dir, RETRY_FILE);
  if (!fs.existsSync(f)) return [];
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8")) as {
      v?: unknown;
      grants?: unknown;
    };
    if (j.v !== 1 || !Array.isArray(j.grants)) return undefined;
    return j.grants as RetryGrant[];
  } catch {
    return undefined;
  }
}

export function writeRetries(dir: string, grants: RetryGrant[]): void {
  writeDurableJson(dir, RETRY_FILE, { v: 1, grants });
}

/** The burned attempt that blocks every further send in this dir: the last attempt of the journal, when it is burned. */
export function blockingAttempt(entries: SentEntry[]): SentEntry | undefined {
  const last = entries.at(-1);
  return last?.state === "burned" ? last : undefined;
}

/** The command that allows one new attempt (shown in the reason of the waiting order). */
export const retryCommand = (id: string) =>
  `npx tsx tars/orch/cli.ts gpt-retry ${id} fable|vlastnik <proč>`;

export type GrantResult =
  | { ok: true; grant: RetryGrant; burned: SentEntry }
  | { ok: false; reason: string };

/**
 * Writes one retry grant into `dir` (the order dir). Only when the last attempt there is burned and no unused grant
 * waits (one command = at most one new send). Never sends anything itself.
 */
export function grantRetry(
  dir: string,
  by: string,
  why: string,
  now: () => Date = () => new Date(),
): GrantResult {
  if (!(RETRY_BY as readonly string[]).includes(by))
    return {
      ok: false,
      reason: `kdo musí být jedno z: ${RETRY_BY.join(", ")}`,
    };
  const reason = redactSecrets(why.trim()).slice(0, 300);
  if (!reason) return { ok: false, reason: "chybí důvod (proč)" };
  const entries = readJournal(dir);
  if (!entries) return { ok: false, reason: "deník pokusů nejde přečíst" };
  const burned = blockingAttempt(entries);
  if (!burned)
    return {
      ok: false,
      reason:
        "poslední pokus o kontrolu GPT není spálený; nový pokus není potřeba",
    };
  const grants = readRetries(dir);
  if (!grants)
    return { ok: false, reason: "soubor povolení opakování nejde přečíst" };
  if (grants.some((g) => !g.used_at))
    return {
      ok: false,
      reason: "jedno povolení nového pokusu už čeká na použití",
    };
  const grant: RetryGrant = {
    by: by as RetryBy,
    at: now().toISOString(),
    why: reason,
  };
  writeRetries(dir, [...grants, grant]);
  return { ok: true, grant, burned };
}

function writeDurableJson(dir: string, name: string, data: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  const tmp = `${f}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
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

const TEXT_FILE_RE = /\.(md|ya?ml|json|txt|log)$/i;

/**
 * Kinds of secrets (never values) in the text files of the given dirs, recursively (Codex review kolo 2, nález 5):
 * the whole shots dir of the run (the MCP server writes its automatic snapshots there, --output-dir) and the legacy
 * `.playwright-mcp/` next to it. Images cannot be scanned; a hit anywhere purges them all (purgeRunFiles).
 */
export function scanRunFiles(dirs: string[]): string[] {
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
      else if (n.isFile() && TEXT_FILE_RE.test(n.name))
        scanSecrets(fs.readFileSync(p, "utf8")).kinds.forEach((k) =>
          kinds.add(k),
        );
    }
  };
  dirs.forEach(walk);
  return [...kinds];
}

/** A secret was seen: every file of the run (PNG, snapshots, reads) is deleted; only the redacted record stays. */
export function purgeRunFiles(dirs: string[]): void {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
}

/** Steps of one check: open a new ChatGPT chat, mode Chat (never Work), model, intensity, read, one exact submit, wait, read. */
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
      what: `model (výběr „${CHATGPT_PICKER}“ v poli pro zadání; seznam modelů otevře položka s intenzitou, např. „Medium ›“ nebo „Vysoká ›“)`,
      prefer: CHATGPT_MODEL,
      fallback: `„${CHATGPT_MODEL_FALLBACK}“; nikdy nepřepínej do režimu „${CHATGPT_FORBIDDEN_MODE}“`,
      picker: CHATGPT_PICKER,
    },
    {
      kind: "choose",
      what: `intenzita přemýšlení (posuvník „Výkon“ ve výběru „${CHATGPT_PICKER}“; popisky Nízká / Střední / Vysoká nebo Low / Medium / High)`,
      prefer: CHATGPT_INTENSITY,
      fallback: `„${CHATGPT_INTENSITY_EN}“; vždy nejvyšší stupeň posuvníku: klikni na „Výkon“ a stiskni klávesu End (browser_press_key), popř. šipku vpravo až na konec; nikdy „Max“`,
      picker: CHATGPT_PICKER,
    },
    // Codex review kolo 2, nález 1: the page before the send is read in the same run; the answer counts only when this
    // read AND the read after the answer show Chat + an allowed model + Vysoká/High. Smoke 4. 11.: model and intensity
    // are visible only in the open picker, so it is open for the read. PR #101 kolo 1: open + read are mandatory and
    // checked in code (detectModel reads only the open picker; a closed one = WAITING_REVIEW).
    { kind: "open", text: CHATGPT_PICKER },
    { kind: "read" },
    // Smoke 4. 11.: the open picker stayed over the composer; every popover is closed before the field is filled.
    { kind: "close_popups" },
    {
      kind: "fill",
      selector: 'div[contenteditable="true"]#prompt-textarea, textarea',
      value: prompt,
      submit: true,
      exact: true,
    },
    { kind: "wait_text", text: marker, ms: timeoutMs },
    { kind: "open", text: CHATGPT_PICKER },
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
  // Smoke 4. 11., pokus 1: "Odpověz jen slovem OK." → the answer was only "OK", without the marker (timeout, burned).
  // The marker is part of every answer, also of a one-word one; the code still requires it (markerEndsAnswer).
  return `\n\n---\nFORMÁT ODPOVĚDI (TARS, kontrola jiné rodiny modelů)\n${format}\nPo odpovědi napiš na samostatný řádek značku, která vznikne spojením slova ${END_WORD} a kódu níže, bez mezery. Značka je povinná i u velmi krátké odpovědi (třeba jediného slova) a pokyn „jen“ nebo „pouze“ v zadání ji nevylučuje; bez značky se odpověď nepočítá.\nKód: ${nonce}`;
}

/**
 * Prompt of `cli.ts gpt-smoke`. Smoke 4. 11., pokus 1: "Odpověz jen slovem OK." collided with the marker instruction
 * (ChatGPT answered only "OK"). This text asks for the word OK without excluding anything else in the answer.
 */
export const GPT_SMOKE_PROMPT = "Kontrola spojení TARS. Napiš slovo OK.";

/** `said_ok` of the smoke: the answer (without the marker) contains the word OK. */
export function smokeSaidOk(text: string): boolean {
  return /\bOK\b/.test(text);
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

/** Last line of the sent prompt (answerInstructions): the answer starts after it. */
export const promptEnd = (nonce: string) => `Kód: ${nonce}`;

const indentOf = (l: string) => l.length - l.trimStart().length;
/** Role of a snapshot element line (`  - article [ref=e5]:` → article), also of a quoted key (`- 'button "a: b"'`). */
const roleOf = (l: string): string | undefined =>
  /^\s*-\s*'?([a-z]+)/i.exec(l)?.[1]?.toLowerCase();

/**
 * Roles whose content is quoted or literal text: an end marker inside them is never the end of an answer, and an
 * assistant heading inside them is never the boundary of a message (Codex review PR #104 kolo 2).
 */
const QUOTE_ROLES: ReadonlySet<string> = new Set(["blockquote", "code", "pre"]);

/**
 * Where the end marker sits in the snapshot tree (Codex review kolo 2, nález 2): the line of its last occurrence, the
 * column, and the assistant message it belongs to by ROLE: its nearest `article` ancestor (ChatGPT renders each turn
 * as an article). An article ancestor always wins, however near a heading is (Codex review PR #104 kolo 2).
 * Only when the marker has NO article ancestor (layout of smoke 4. 11. 22:55): the ancestor whose child is the heading
 * "ChatGPT řekl:" (`byHeading`). That heading is a structural boundary only when it is the one such heading on the
 * whole ancestor chain: a second one (a heading inside the answer's content, e.g. a markdown "ChatGPT řekl:") makes
 * the message ambiguous (`ambiguous`). `quoted` = the marker or one of its ancestors is a blockquote, code or pre.
 * `end` = first line after the message element (or the end of the page when there is none).
 */
function markerMessage(page: string, marker: string) {
  const at = page.lastIndexOf(marker);
  if (at < 0) return undefined;
  const lines = page.split("\n");
  const starts: number[] = [];
  let pos = 0;
  for (const l of lines) {
    starts.push(pos);
    pos += l.length + 1;
  }
  let mIdx = lines.length - 1;
  while (mIdx > 0 && starts[mIdx] > at) mIdx--;
  let min = indentOf(lines[mIdx]);
  let quoted = QUOTE_ROLES.has(roleOf(lines[mIdx]) ?? "");
  let articleAt = -1;
  /** ancestors (nearest first) that have the assistant heading "ChatGPT řekl:" as a direct child */
  const headed: number[] = [];
  /** a sibling of the current ancestor (or of the marker line) is the assistant heading */
  let headingSibling = false;
  for (let i = mIdx - 1; i >= 0 && min > 0; i--) {
    if (!lines[i].trim()) continue;
    const ind = indentOf(lines[i]);
    if (ind > min) continue;
    if (ind === min) {
      if (ASSISTANT_HEADING.test(lines[i])) headingSibling = true;
      continue;
    }
    // lines[i] is the parent of the current level: the whole chain is walked (no early stop)
    min = ind;
    const role = roleOf(lines[i]) ?? "";
    if (QUOTE_ROLES.has(role)) quoted = true;
    if (role === "article" && articleAt < 0) articleAt = i;
    if (headingSibling) headed.push(i);
    headingSibling = false;
  }
  let article = articleAt;
  let byHeading = false;
  let ambiguous = false;
  // Smoke 4. 11. 22:55: the new layout has no article; the message is the element whose child is the heading
  // "ChatGPT řekl:". The composer, picker and disclaimer lie outside of it.
  if (article < 0 && headed.length) {
    article = headed[0];
    byHeading = true;
    ambiguous = headed.length > 1;
  }
  let end = lines.length;
  if (article >= 0) {
    const ai = indentOf(lines[article]);
    for (let j = mIdx + 1; j < lines.length; j++)
      if (lines[j].trim() && indentOf(lines[j]) <= ai) {
        end = j;
        break;
      }
  }
  return {
    lines,
    starts,
    at,
    mIdx,
    col: at - starts[mIdx],
    article,
    byHeading,
    ambiguous,
    quoted,
    end,
  };
}

/**
 * Why the end marker cannot be the end of an answer by its place in the tree (Codex review PR #104 kolo 2), or
 * undefined: inside a blockquote, code or pre (a quotation is never an answer, in any layout), or under two nested
 * assistant headings without an article (a heading inside the answer's content is no message boundary).
 */
export function markerPlacementProblem(
  page: string,
  marker: string,
): string | undefined {
  const m = markerMessage(page, marker);
  if (!m) return undefined;
  if (m.quoted)
    return "koncová značka je uvnitř citace nebo kódu (není konec odpovědi)";
  if (m.ambiguous)
    return "zpráva se značkou nejde určit (nadpis asistenta uvnitř obsahu odpovědi)";
  return undefined;
}

/**
 * The answer region: the whole text of the assistant message that holds the end marker, up to the marker (Codex review
 * kolo 2, nález 2: by role, the `article` of the turn, not by indentation). The sent prompt (`Kód: <nonce>`, its last
 * occurrence before the marker) must end before that message and no other turn may lie between them. Without an
 * article ancestor: the page text strictly between the prompt end and the marker. Nothing of the prompt (the reviewed
 * draft may contain JSON) is ever part of it. undefined = marker or prompt end not on the page, or not in that order.
 */
export function answerRegion(
  page: string,
  marker: string,
  nonce: string,
): string | undefined {
  const m = markerMessage(page, marker);
  if (!m || m.quoted || m.ambiguous) return undefined;
  const end = promptEnd(nonce);
  const start = page.lastIndexOf(end, m.at - 1);
  if (start < 0 || start + end.length > m.at) return undefined;
  if (m.article < 0) return page.slice(start + end.length, m.at);
  const msgStart = m.starts[m.article];
  if (start + end.length > msgStart) {
    // an element found by the heading that also holds the prompt is no message of its own (flat layout: the heading is
    // a sibling of the prompt): as without an article. Quoted markers and nested headings were rejected above.
    if (m.byHeading) return page.slice(start + end.length, m.at);
    return undefined; // the prompt end lies inside the answer's own message
  }
  // no other turn between the prompt and the answer
  const between = page.slice(start + end.length, msgStart).split("\n");
  if (between.some((l) => roleOf(l) === "article" || ASSISTANT_HEADING.test(l)))
    return undefined;
  return page.slice(m.starts[m.article + 1] ?? m.at, m.at);
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
 * Fixed texts of the ChatGPT UI (cs + en) that are never part of an answer; only an EXACT match of the whole text
 * (no pattern, no prefix). Smoke 4. 11. 22:55: the disclaimer and the hidden heading of the latest answer.
 */
const UI_FIXED_TEXTS: ReadonlySet<string> = new Set([
  "ChatGPT může dělat chyby. Důležité informace si ověřte.",
  "ChatGPT can make mistakes. Check important info.",
  "Nejnovější odpověď",
  "Latest response",
]);
/** `- role [attrs]: text` with a plain (unnamed) role; the text is decoded by its YAML quoting. */
const UI_TEXT_LINE = /^\s*-\s*[a-z]+(?:\s*\[[^\]\n]*\])*:[ \t]+\S/i;
/** `- role "name" [attrs]` (optionally `:` with no value): an element with only an accessible name. */
const UI_NAMED_LINE =
  /^\s*-\s*[a-z]+\s+"([^"\\\n]*)"(?:\s*\[[^\]\n]*\])*:?\s*$/i;

/** true when the line is only a fixed UI text of UI_FIXED_TEXTS (exact, whole text). */
export function uiFixedTextLine(line: string): boolean {
  const named = UI_NAMED_LINE.exec(line);
  if (named) return UI_FIXED_TEXTS.has(named[1]);
  return UI_TEXT_LINE.test(line) && UI_FIXED_TEXTS.has(snapshotValue(line));
}

/**
 * true when the end marker is the real end of the last assistant message (Codex review kolo 1, nález 3; kolo 2,
 * nález 2): on its line only a closing quote may follow; every following line of the same message (by role: the rest
 * of its `article`, whatever the indentation, so leaving a blockquote does not end the check; without an article: the
 * rest of the page) holds no text, only snapshot structure, text-less buttons or an exact fixed UI text (UI_FIXED_TEXTS);
 * and no further turn (article or
 * assistant heading) follows anywhere. Anything else (e.g. a correction to FIX after the marker) → unclear.
 */
export function markerEndsAnswer(page: string, marker: string): boolean {
  const m = markerMessage(page, marker);
  if (!m || m.quoted || m.ambiguous) return false;
  if (!/^\s*['"]?\s*$/.test(m.lines[m.mIdx].slice(m.col + marker.length)))
    return false;
  for (let j = m.mIdx + 1; j < m.end; j++) {
    const l = m.lines[j];
    if (ASSISTANT_HEADING.test(l) || roleOf(l) === "article") return false;
    if (
      !l.trim() ||
      SNAPSHOT_ONLY_LINE.test(l) ||
      UI_BUTTON_LINE.test(l) ||
      uiFixedTextLine(l)
    )
      continue;
    return false;
  }
  for (let j = m.end; j < m.lines.length; j++)
    if (ASSISTANT_HEADING.test(m.lines[j]) || roleOf(m.lines[j]) === "article")
      return false;
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
  // Codex review kolo 2, nález 2: the message is exactly one JSON line and the marker; a quotation is never an answer.
  if (lines.some((l) => roleOf(l) === "blockquote")) return undefined;
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
 * Model and intensity as the open picker shows them, and ONLY from it (Codex review PR #101 kolo 1, nález high): the
 * model is the checked `menuitemradio` of the open `menu "Vybrat model ChatGPT"`, the intensity is the label and step
 * of its slider status. No text of the page counts (a chat titled "GPT-6 High" in the history, the prompt or the
 * answer never decides). The version is read whole and only a known name word may follow, so "GPT-6" is never
 * "GPT-6.1 Sol" or "GPT-5.6 Sol". {} = the picker is not open or not readable (see controlVerified).
 */
export function detectModel(page: string): ShownModel {
  return pickerModel(page) ?? {};
}

/**
 * true when the state was read from the control: the open picker showed exactly one checked model and the slider
 * status (label + step). Anything else is an unverified UI state → WAITING_REVIEW, never a match.
 */
export const controlVerified = (seen: ShownModel): boolean =>
  seen.model !== undefined &&
  seen.intensity !== undefined &&
  seen.level !== undefined &&
  seen.levels !== undefined;

/** Reason of WAITING_REVIEW when the open picker was not read (closed, missing or ambiguous). */
export const CONTROL_UNVERIFIED = "stav modelu neověřen z ovládacího prvku";

export interface ShownModel {
  model?: string;
  intensity?: string;
  /** Step of the intensity slider and the number of steps, when the page says them ("Medium, 2 z(e) 3."). */
  level?: number;
  levels?: number;
}

const MODEL_NAME_RE =
  /(?<![\p{L}\d])((?:Chat)?GPT[- ]?\d+(?:\.\d+)*(?:[ -](?:Sol|Pro|Thinking|Instant|mini|Mini)(?![\p{L}\d]))?)(?![\p{L}\d.]*\d)/u;
/** The slider's live status in the picker: "Medium, 2 z(e) 3." (cs) / "High, 3 of 3." (en). */
const SLIDER_STATUS_RE =
  /^\s*-\s*status(?:\s*\[[^\]\n]*\])*:\s*['"]?([^,'"\n]+),\s*(\d+)\s*(?:z\(e\)|ze|z|of|\/)\s*(\d+)\.?['"]?\s*$/iu;
/** A checked radio of the model list: `- menuitemradio [checked]:` (also `[checked=true]`), never by text. */
const CHECKED_RADIO_RE =
  /^\s*-\s*'?menuitemradio(?:\s+"[^"\n]*")?(?:\s*\[[^\]\n]*\])*?\s*\[checked(?:=true)?\]/i;
/** The line of the open picker: `- menu "Vybrat model ChatGPT" [ref=…]:` (role menu, exactly this accessible name). */
const PICKER_MENU_RE = new RegExp(
  `^\\s*-\\s*'?menu\\s+"${CHATGPT_PICKER}"(?:\\s*\\[[^\\]\\n]*\\])*:?'?\\s*$`,
);

/**
 * Model and intensity from the open picker, and only from it (smoke 4. 11.; Codex review PR #101 kolo 1): exactly one
 * element `menu "Vybrat model ChatGPT"`, and only its own subtree (by indentation) is parsed, so nothing of the chat
 * history, the prompt or the answer can be taken for it. In that subtree the model is the text of the one checked
 * `menuitemradio` (`- menuitemradio [checked]: - generic: GPT-6`: its own name, else the first text below it), the
 * intensity is the label of the slider `status` line ("Medium, 2 z(e) 3.") with its step. Two pickers, two checked
 * radios or two status lines are ambiguous. undefined = no open picker, or it is ambiguous.
 */
function pickerModel(page: string): ShownModel | undefined {
  const lines = page.split("\n");
  const menus = lines
    .map((l, i) => (PICKER_MENU_RE.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (menus.length !== 1) return undefined;
  const i = menus[0];
  const ind = indentOf(lines[i]);
  let end = i + 1;
  while (
    end < lines.length &&
    (!lines[end].trim() || indentOf(lines[end]) > ind)
  )
    end++;
  const statuses: RegExpExecArray[] = [];
  const models: (string | undefined)[] = [];
  for (let j = i + 1; j < end; j++) {
    const l = lines[j];
    const st = SLIDER_STATUS_RE.exec(l);
    if (st) {
      statuses.push(st);
      continue;
    }
    if (!CHECKED_RADIO_RE.test(l)) continue;
    let text =
      /"([^"\n]+)"/.exec(l)?.[1] ??
      snapshotValue(l).replace(/^\[[^\]]*\]\s*:?/, "");
    for (
      let k = j + 1;
      !text.trim() && k < end && indentOf(lines[k]) > indentOf(l);
      k++
    )
      text = snapshotValue(lines[k]);
    models.push(MODEL_NAME_RE.exec(text)?.[1]);
  }
  if (statuses.length > 1 || models.length > 1) return undefined;
  const out: ShownModel = {};
  if (models[0] !== undefined) out.model = models[0];
  if (statuses[0]) {
    out.intensity = statuses[0][1].trim();
    out.level = Number(statuses[0][2]);
    out.levels = Number(statuses[0][3]);
  }
  return out;
}

/** Intensity "Vysoká" (High) as the page shows it. */
export const isHighIntensity = (intensity?: string): boolean =>
  intensity === CHATGPT_INTENSITY || intensity === CHATGPT_INTENSITY_EN;

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

/**
 * `submitted` = what the gate saw about sending (SentReport). REPORT-adapter O2: "odpověď nedorazila" only after a
 * confirmed send; a timeout before it is a step of the browser (Playwright "Timeout …ms", e.g. the model picker) or the
 * driver process killed at its run limit, and says whether anything was sent.
 */
export function waitReason(
  e: unknown,
  submitted?: SentReport["submitted"],
): string {
  const msg = String((e as Error)?.message ?? e)
    .split("\n")[0]
    .slice(0, 200);
  // FIX2 nález 2: displej usnul mezi první a druhou sondou; nic se neodeslalo, pokus se nepočítá (první, aby text
  // důvodu sondy nespadl do jiné větve).
  if (e instanceof DisplayAsleepError)
    return `${msg}; pokus GPT v prohlížeči se neprovedl, nic neodesláno`;
  if (/nepřihlá|log ?in|sign ?up|přihlásit|přihlášen/i.test(msg))
    return "profil TARS-agent není přihlášen do ChatGPT (TARS se nepřihlašuje)";
  if (e instanceof DriverLimitError)
    return `ovladač prohlížeče (Claude) je na limitu: ${msg}`;
  if (/timeout/i.test(msg)) {
    if (submitted === true)
      return "odpověď ChatGPT nedorazila v časovém limitu";
    const sent =
      submitted === false ? "nic neodesláno" : "odeslání nejde potvrdit";
    if (/ovladač prohlížeče selhal: timeout\b/i.test(msg))
      return `ovladač prohlížeče nedokončil kroky v limitu běhu; ${sent}`;
    return `krok v prohlížeči nedoběhl v časovém limitu (prvek nereagoval): ${msg}; ${sent}`;
  }
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
  /**
   * Zjištění 5. 11.: stav displeje (display.ts). Když je zadaný, pokus proběhne jen při `awake: true`; jinak se
   * vůbec neprovede (žádný Chrome, žádný zápis do deníku pokusů) a zakázka čeká ve WAITING_REVIEW.
   */
  displayAwake?: () => { awake: boolean; reason: string };
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
    // Every file of this browser run: the shots dir (the MCP server writes its automatic snapshots there, --output-dir)
    // and, defensively, the legacy `.playwright-mcp/` in the MCP workspace (Codex review kolo 2, nález 5).
    const runDirs = [shots, path.join(opts.cwd, ".playwright-mcp")];
    const jdir = opts.journalDir ?? opts.cwd;
    // The prompt as the reviewer gets it, without the per-attempt nonce: the key of the journal of attempts.
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
    let entries: SentEntry[] = [];
    let nonce = "";
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
      nonce !== "" && e.nonce === nonce && e.prompt_sha256 === promptSha;
    /** The attempt of this run is burned for good (no-op when it was provably not sent and removed). */
    const burn = (reason: string) => {
      if (!entries.some((e) => isMine(e) && !isFinal(e))) return;
      save(
        entries.map((e) =>
          isMine(e) && !isFinal(e)
            ? {
                ...e,
                state: "burned" as const,
                reason: redactSecrets(reason).slice(0, 300),
                ...(chatUrl ? { chat_url: chatUrl } : {}),
              }
            : e,
        ),
      );
    };
    /**
     * A secret in the answer, the page, a file or the record: rejected (like SecretScanningAdapter), the attempt burned,
     * every file of the run deleted (PNG and snapshots cannot be redacted reliably); only the redacted record stays.
     */
    const rejected = (kinds: string[], actual: string): AdapterResult => {
      burn(`secret-scan: ${kinds.join(",")}`);
      purgeRunFiles(runDirs);
      record({
        status: "WAITING_REVIEW",
        actual_model: actual,
        model_matches: false,
        reason: `secret-scan: ${kinds.join(",")} (hodnota skryta, odpověď se nepoužije, soubory běhu smazány)`,
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
      burn(reason);
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
    // Zjištění 5. 11.: při spícím displeji se okno nekreslí a výběr modelu selže. Pokus se neprovede vůbec (před
    // čtením deníku, před Chrome); `burn` je tu no-op, protože tento běh ještě nic nezapsal.
    if (this.o.displayAwake) {
      let d: { awake: boolean; reason: string };
      try {
        d = this.o.displayAwake();
      } catch {
        d = { awake: false, reason: "sonda displeje selhala" };
      }
      if (d.awake !== true)
        return waiting(
          `displej spí (${d.reason}); pokus GPT v prohlížeči se neprovedl`,
        );
    }
    const journal = readJournal(jdir);
    if (!journal)
      return waiting("deník pokusů nejde přečíst; nový prompt se neposílá");
    entries = journal;

    // 1) Codex review PR #101 kolo 3: an "answered" attempt of this prompt means a run was interrupted between the
    //    answer and storing the result. The stored answer is never restored (no proof outside the live run): the
    //    attempt is burned and moved to the end of the journal (so it blocks like any burned attempt), the order waits,
    //    nothing is sent; a new attempt only by gpt-retry.
    const answered = journal.filter(
      (e) => e.prompt_sha256 === promptSha && e.state === "answered",
    );
    if (answered.length) {
      const next: SentEntry[] = [
        ...journal.filter((e) => !answered.includes(e)),
        ...answered.map((e) => ({
          ...e,
          state: "burned" as const,
          reason: INTERRUPTED_ATTEMPT,
        })),
      ];
      if (!save(next))
        return waiting("deník pokusů nejde zapsat; nic neodesláno");
      return waiting(
        `${INTERRUPTED_ATTEMPT}: uložená odpověď se nepoužije, pokus je spálený a znovu se automaticky neposílá. Nový pokus jen příkazem: ${retryCommand(path.basename(jdir))}`,
      );
    }

    // 2) An attempt left unfinished by an earlier run (crash): burned, its chat is never opened, its answer never taken.
    const stale = journal.filter((e) => !isFinal(e));
    if (stale.length) {
      const burned = journal.map((e) =>
        isFinal(e)
          ? e
          : {
              ...e,
              state: "burned" as const,
              reason: `${INTERRUPTED_ATTEMPT} (pokus nedokončen v běhu, který ho odeslal, pád nebo přerušení; odpověď se nikdy nepřijme)`,
            },
      );
      if (!save(burned))
        return waiting("deník pokusů nejde zapsat; nic neodesláno");
      if (stale.some((e) => e.prompt_sha256 === promptSha))
        return waiting(
          `předchozí pokus o tuto kontrolu nebyl dokončen v běhu, který ho odeslal; je spálený a znovu se automaticky neposílá. Nový pokus jen příkazem: ${retryCommand(path.basename(jdir))}`,
        );
    }

    // 3) Codex review kolo 3, nález 1: after a burned attempt nothing is sent again without an explicit grant
    //    (cli.ts gpt-retry). No automatic retry on the next tick, no daily reset.
    const blocking = blockingAttempt(entries);
    let grants: RetryGrant[] = [];
    let grantIdx = -1;
    if (blocking) {
      const g = readRetries(jdir);
      if (!g)
        return waiting(
          "soubor povolení opakování nejde přečíst; nový prompt se neposílá",
        );
      grants = g;
      grantIdx = grants.findIndex((x) => !x.used_at);
      if (grantIdx < 0)
        return waiting(
          `pokus o kontrolu v GPT je spálený (${blocking.reason ?? "bez důvodu"}); znovu se automaticky neposílá. Nový pokus jen příkazem: ${retryCommand(path.basename(jdir))}`,
        );
    }

    // 4) A new attempt: new chat, new nonce, one send.
    const fresh = (this.o.nonce ?? (() => randomBytes(5).toString("hex")))();
    // Every attempt of this prompt has its own nonce (a reused one could match a marker of an earlier attempt).
    if (entries.some((e) => e.prompt_sha256 === promptSha && e.nonce === fresh))
      return waiting(
        "nový kód pokusu (nonce) se shoduje s už použitým; nic neodesláno",
      );
    const marker = `${END_WORD}${fresh}`;
    if (prompt.includes(marker))
      return waiting(
        "prompt už obsahuje koncovou značku (nelze bezpečně číst odpověď)",
      );
    // The grant is used up BEFORE the attempt is written: one grant is never more than one send (also after a crash).
    if (grantIdx >= 0) {
      try {
        writeRetries(
          jdir,
          grants.map((g, i) =>
            i === grantIdx
              ? { ...g, used_at: now().toISOString(), nonce: fresh }
              : g,
          ),
        );
      } catch {
        return waiting(
          "povolení opakování nejde označit jako použité; nic neodesláno",
        );
      }
    }
    // Write-ahead: the attempt is durable BEFORE the send, so a crash during the run burns it (never read again).
    if (
      !save([
        ...entries,
        {
          prompt_sha256: promptSha,
          nonce: fresh,
          at: now().toISOString(),
          state: "sending",
        },
      ])
    )
      return waiting("deník pokusů nejde zapsat; nic neodesláno");
    nonce = fresh;
    const steps = chatGptSteps(
      prompt + answerInstructions(nonce, opts.outputSchema),
      marker,
      this.o.timeoutMs,
    );
    let report: SentReport | undefined;
    /** Records what the gate saw about sending. */
    const settle = () => {
      const mine = entries.find((e) => isMine(e) && !isFinal(e));
      if (!mine) return;
      const others = entries.filter((e) => e !== mine);
      if (report?.submitted === false) {
        save(others); // provably not sent: the attempt does not count, a later run may send
        return;
      }
      if (report?.submitted !== true) return; // unknown: stays "sending" and is burned below
      submits = 1;
      chatUrl =
        report.url && CHAT_URL_RE.test(report.url) ? report.url : undefined;
      save([
        ...others,
        { ...mine, state: "sent", ...(chatUrl ? { chat_url: chatUrl } : {}) },
      ]);
    };
    let reads: string[];
    try {
      const r = await this.browser.run(steps, shots, (sent) => {
        report = sent;
      });
      reads = r.rawReads;
    } catch (e) {
      // FIX2 nález 2: druhá sonda displeje (McpBrowser.run) odmítla start před Chrome = prokazatelně nic neodesláno,
      // i kdyby prohlížeč nehlásil onSent. Pokus se odstraní (nespálí), zakázka čeká s důvodem „displej spí“.
      if (e instanceof DisplayAsleepError && report === undefined)
        report = { submitted: false };
      settle();
      const kinds = scanRunFiles(runDirs);
      if (kinds.length) return rejected(kinds, "neověřeno");
      return waiting(waitReason(e, report?.submitted));
    }
    settle();
    const before = reads.length >= 2 ? reads[0] : undefined;
    const page = reads.at(-1) ?? "";
    // Codex review kolo 1, nález 6 + kolo 2, nález 5: a secret anywhere on the page or in any file of the run = rejected.
    const fileKinds = scanRunFiles(runDirs);
    const pageScan = scanSecrets(reads.join("\n"));
    if (fileKinds.length || !pageScan.clean)
      return rejected(
        [...new Set([...fileKinds, ...pageScan.kinds])],
        "neověřeno",
      );
    if (report?.submitted !== true)
      return waiting("odeslání promptu nejde potvrdit; pokus je spálený");
    const seen = detectModel(page);
    const actual = shownModel(seen);
    this.model = actual;
    // P16 v3: Work is never a valid place for a check; the answer is not used, the order waits (never pretended).
    if (ranInWork(page, seen))
      return waiting("běží v režimu Work místo Chat", actual);
    // Codex review PR #104 kolo 2: a marker inside a quotation or under a heading of the answer's content → unclear.
    const placement = markerPlacementProblem(page, marker);
    if (placement) return waiting(placement, actual);
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
    // Codex review kolo 1, nález 1 + kolo 2, nález 1: only the requested Chat model at intensity Vysoká counts, shown
    // by THIS run before the send and after the answer (the same model both times). Anything else = burned, waits.
    // Codex review PR #101 kolo 1: model and intensity count only from the open picker (both reads); a closed or
    // unreadable picker is an unverified UI state, never a match and never a fallback to the page text.
    if (!controlVerified(seen))
      return waiting(
        `${CONTROL_UNVERIFIED} (po odpovědi: výběr „${CHATGPT_PICKER}“ není otevřený nebo čitelný)`,
        actual,
      );
    const seenBefore = before === undefined ? {} : detectModel(before);
    if (!controlVerified(seenBefore))
      return waiting(
        `${CONTROL_UNVERIFIED} (před odesláním: výběr „${CHATGPT_PICKER}“ ${before === undefined ? "nepřečten" : "není otevřený nebo čitelný"})`,
        actual,
      );
    if (!modelOk(seen))
      return waiting(
        `model nebo intenzita neodpovídá požadovanému ${this.requestedModel} (stránka po odpovědi: ${actual})`,
        actual,
      );
    if (
      before === undefined ||
      ranInWork(before, seenBefore) ||
      !pickerPairOk(seenBefore, seen)
    )
      return waiting(
        `model nebo intenzita před odesláním neodpovídá požadovanému ${this.requestedModel} nebo modelu po odpovědi (před odesláním: ${before === undefined ? "nepřečteno" : shownModel(seenBefore)}, po odpovědi: ${actual})`,
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
      model_matches: true,
      answer: text,
    });
    if (kinds.length) return rejected(kinds, actual);
    // The attempt must still be open on disk (no other run burned it meanwhile); then it is answered for good.
    const disk = readJournal(jdir);
    const still = disk?.find((e) => isMine(e));
    if (!disk || !still || isFinal(still)) {
      if (disk) entries = disk;
      return waiting(
        "pokus byl mezitím v deníku uzavřen jiným během; odpověď se nepřijme",
        actual,
      );
    }
    save(
      disk.map((e) =>
        isMine(e)
          ? {
              ...e,
              state: "answered" as const,
              answer: text,
              model_before: shownModel(seenBefore),
              model_after: actual,
              ...(chatUrl ? { chat_url: chatUrl } : {}),
            }
          : e,
      ),
    );
    return { ok: true, text, limit: false, duration_ms: Date.now() - t0 };
  }
}

/** Model and intensity as text ("GPT-6 · Vysoká"); "neověřeno …" when the page does not show them. */
function shownModel(seen: ShownModel): string {
  // the slider step only when it is not the top (a top step "High" reads as before: "GPT-6 · High")
  const step =
    seen.levels !== undefined && seen.level !== seen.levels
      ? ` (stupeň ${seen.level}/${seen.levels})`
      : "";
  return seen.model
    ? `${seen.model}${seen.intensity ? ` · ${seen.intensity}${step}` : ""}`
    : `neověřeno (výběr modelu není otevřený nebo neukazuje označený model${seen.intensity ? `; intenzita ${seen.intensity}${step}` : ""})`;
}

/**
 * An allowed Chat model at intensity Vysoká / High; when the page shows the slider step, it must be the top one
 * (a top step with another label, e.g. Medium of a two-step slider, is a mismatch).
 */
const modelOk = (seen: ShownModel): boolean =>
  seen.model !== undefined &&
  CHAT_MODELS.includes(seen.model) &&
  isHighIntensity(seen.intensity) &&
  (seen.levels === undefined || seen.level === seen.levels);
/**
 * The match of the two picker reads (before the send, after the answer): both read from the control, both an allowed
 * Chat model at the top intensity, the same model. Used only by the live run.
 */
const pickerPairOk = (before: ShownModel, after: ShownModel): boolean =>
  controlVerified(before) &&
  controlVerified(after) &&
  modelOk(before) &&
  modelOk(after) &&
  before.model === after.model;

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
