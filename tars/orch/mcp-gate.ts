// Hooks (PreToolUse + PostToolUse) of the Playwright MCP run of the vizual department (DR-029 krok 6).
// The rules of the adapter ladder (ladder.ts: host allowlist, forbidden actions, bot challenge) are enforced in code
// on every MCP tool call, not in the prompt. The gate keeps a small state file per run (TARS_GATE_STATE, outside the
// MCP workspace so the browser cannot write it):
//   post: reads what the page really shows (tool response, structured: "### Page" URL line and the "### Snapshot"
//         section, inline or in the .yml file the MCP server saved): current URL, refs with their real labels
//         (role + accessible name + text of the element's subtree), bot challenge. An off-allowlist URL or a challenge
//         blocks every further call.
//   pre:  navigation only to allowed hosts; click/type only on a ref of the last snapshot whose real label is allowed
//         (the model's own description is not trusted); after the first submit nothing more is typed or sent;
//         call budget; tool allowlist.
// Hooks run concurrently, so every read-modify-write of the state is under a lock. Exit 2 = deny (stderr is shown to
// the model). Any crash or unreadable state in `pre` is a deny (the hook command adds `|| exit 2`).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { actionAllowed, hostAllowed, isBotChallenge } from "./ladder";

export const MCP_SERVER = "playwright";

/** The only Playwright MCP tools the browser run may use (no evaluate / run_code / upload / cookies / storage / keys / history). */
export const BROWSER_MCP_TOOLS = ["browser_navigate", "browser_snapshot", "browser_take_screenshot", "browser_click", "browser_type", "browser_wait_for"] as const;

const ACTION_TOOLS = new Set(["browser_click", "browser_type"]);
export const MAX_TOOL_CALLS = 80;
/** Clicks on labels like these count as sending (a second one is denied); typing after the first send is denied. */
export const SUBMIT_LABEL_RE = /\b(send|submit|odeslat|odeslání|odešli|generate|vygenerovat)\b/i;

export interface RefInfo {
  /** role + accessible name (truncated, for messages). */
  label: string;
  /** false when the element's own label or its subtree text contains a forbidden action. */
  ok: boolean;
  /** true when the label looks like sending. */
  submit: boolean;
  /**
   * Text the element holds as the last snapshot shows it (its own text value and the text values of its subtree, one
   * per line, decoded from the YAML quoting). undefined = unknown (no snapshot since the last action on it).
   */
  content?: string;
}

export interface GateState {
  calls: number;
  submits: number;
  url?: string;
  refs: Record<string, RefInfo>;
  blocked?: { kind: "offhost" | "bot"; detail: string };
  /** Exact mode (typeSha): the ref the prompt was typed into; the send is allowed only when its content matches. */
  typedRef?: string;
}

export const emptyState = (): GateState => ({ calls: 0, submits: 0, refs: {} });

/**
 * A file name the model gives a snapshot/screenshot must stay inside the shots dir of this run (`filesDir`, relative
 * to the MCP workspace = runs/): the workspace also holds other orders, which the browser run must not overwrite.
 */
export function filenameAllowed(filename: unknown, filesDir: string | undefined): boolean {
  if (filename === undefined) return true;
  if (typeof filename !== "string" || !filesDir || path.isAbsolute(filename) || filename.includes("\\")) return false;
  const n = path.posix.normalize(filename);
  return !n.split("/").includes("..") && n.startsWith(`${filesDir}/`);
}

/** sha256 of a text to type, normalized (CRLF → LF, trimmed) the same way on both sides of the comparison. */
export function typedTextSha(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n?/g, "\n").trim()).digest("hex");
}

/** true when the text to type is empty after the same normalization (clearing the field). */
const isClearText = (text: unknown): boolean => String(text ?? "").replace(/\r\n?/g, "\n").trim() === "";

/**
 * Returns the reason a tool call is denied, or undefined when it is allowed (pure; the caller counts the call).
 * `typeSha` (P16 v2): when set, every browser_type must type exactly the planned text (sha256), so the driving model
 * cannot change the prompt a reviewer answers. Exact mode also guards what is really sent (Codex review kolo 1, nález 4):
 * `slowly` (pressSequentially appends to what is already there) and `submit` on browser_type are denied; the field must
 * be empty in the last snapshot before the prompt is typed (clearing = browser_type with ""), and the send click is
 * allowed only when a snapshot after typing shows the field holding exactly the prompt (sha256).
 * `noType`: the plan types nothing (read-only run, e.g. reading an already sent ChatGPT answer): no browser_type and no
 * click on a send-like element.
 */
export function gateMcpCall(toolName: string, input: Record<string, unknown> = {}, state: GateState = emptyState(), filesDir?: string, typeSha?: string, noType = false): string | undefined {
  const prefix = `mcp__${MCP_SERVER}__`;
  if (!toolName.startsWith(prefix)) return undefined; // not ours (matcher keeps this from happening)
  const tool = toolName.slice(prefix.length);
  if (state.blocked) return `běh zastaven (${state.blocked.kind === "bot" ? "ověření proti botům" : "stránka mimo povolené hosty"}): ${state.blocked.detail}`;
  if (state.calls >= MAX_TOOL_CALLS) return `překročen limit ${MAX_TOOL_CALLS} volání nástrojů prohlížeče`;
  if (!(BROWSER_MCP_TOOLS as readonly string[]).includes(tool)) return `nástroj ${tool} není pro prohlížeč TARS povolen`;
  if (!filenameAllowed(input.filename, filesDir)) return `soubor smí být jen ve složce ${filesDir ?? "(neurčena)"}/ tohoto běhu: ${String(input.filename).slice(0, 80)}`;
  if (tool === "browser_snapshot") {
    // Every new snapshot replaces the judged refs (observeResponse); a shortened one (depth, a sub-tree target, ...) would
    // drop the text that made a forbidden element forbidden and re-allow it. Only the full snapshot is allowed.
    // Whitelist of keys: an empty key ("") is falsy, so the check is on the key list, never on a found key.
    const keys = Object.keys(input);
    if (keys.some((k) => k !== "filename")) return `browser_snapshot smí mít jen parametr filename, ne „${keys.filter((k) => k !== "filename").join(", ").slice(0, 40)}“ (zkrácený snapshot by přepsal hodnocení prvků)`;
  }
  if (tool === "browser_navigate") {
    const url = String(input.url ?? "");
    if (url !== "about:blank" && !hostAllowed(url)) return `host není povolen: ${url}`;
  }
  if (ACTION_TOOLS.has(tool)) {
    const target = String(input.target ?? input.ref ?? "");
    const ref = Object.hasOwn(state.refs, target) ? state.refs[target] : undefined;
    if (!ref) return `cíl „${target.slice(0, 40)}“ není ref z posledního snapshotu stránky (použij ref, např. e5)`;
    if (!ref.ok) return `zakázaná akce: "${ref.label.slice(0, 80)}"`;
    if (typeof input.element === "string" && !actionAllowed(input.element)) return `zakázaná akce: "${input.element.slice(0, 80)}"`;
    if (state.submits >= 1 && (tool === "browser_type" || ref.submit)) return "po odeslání se už nepíše ani neodesílá";
    if (tool === "browser_click" && input.doubleClick === true && ref.submit) return "dvojklik na odesílací prvek se nepovoluje";
    if (noType && (tool === "browser_type" || ref.submit)) return "tento běh jen čte: nic se nepíše ani neodesílá";
    if (typeSha && tool === "browser_type") {
      if (input.slowly === true) return "pomalé psaní (slowly) se nepovoluje: nepřepíše rozepsaný text v poli";
      if (input.submit === true) return "odeslání přes browser_type se nepovoluje: nejdřív browser_snapshot (brána ověří obsah pole), pak klik na odeslání";
      if (!isClearText(input.text)) {
        if (typedTextSha(String(input.text ?? "")) !== typeSha) return "vkládaný text se liší od zadaného (sha256); vlož ho přesně beze změny";
        if (ref.content === undefined || ref.content.trim() !== "") return 'pole není podle posledního snapshotu prázdné: vyčisti ho (browser_type s textem ""), udělej browser_snapshot a teprve pak piš';
      }
    }
    if (typeSha && tool === "browser_click" && ref.submit) {
      const typed = state.typedRef !== undefined && Object.hasOwn(state.refs, state.typedRef) ? state.refs[state.typedRef] : undefined;
      if (typed?.content === undefined || typedTextSha(typed.content) !== typeSha) return "obsah pole podle posledního snapshotu neodpovídá zadanému textu (sha256): nic se neodesílá";
    }
  }
  return undefined;
}

/** Counts an allowed call (pre): every call, and submits (type with submit, click on a send-like element). */
export function countCall(toolName: string, input: Record<string, unknown>, state: GateState): void {
  state.calls++;
  if (toolName.endsWith("browser_type") && input.submit === true) state.submits++;
  const target = String(input.target ?? input.ref ?? "");
  const ref = Object.hasOwn(state.refs, target) ? state.refs[target] : undefined;
  if (toolName.endsWith("browser_click") && ref?.submit) state.submits++;
  if (toolName.endsWith("browser_type") && ref) {
    // What the field holds after this call is known only from the next snapshot.
    ref.content = undefined;
    if (!isClearText(input.text)) state.typedRef = target;
  }
  // A click may change the field: it is verified again by the next snapshot.
  if (toolName.endsWith("browser_click") && !ref?.submit && state.typedRef !== undefined && Object.hasOwn(state.refs, state.typedRef)) state.refs[state.typedRef].content = undefined;
}

function textOf(x: unknown): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(textOf).join("\n");
  if (x && typeof x === "object") return Object.values(x).map(textOf).join("\n");
  return "";
}

// The MCP serializer writes "- role "name" [attributes]: text", and wraps the whole key in single quotes ('' escaped)
// when it contains ": ", starts with "-" etc.: - 'role "na: me" [ref=e5]': text.
const QUOTED_KEY = /^(\s*)- '((?:[^']|'')*)'(?::(.*))?$/;
const PLAIN_LINE = /^(\s*)- (.*)$/;
// The role never contains ":", so a quoted text value (`- paragraph: "Kód: x"`) is never read as an accessible name.
const KEY = /^([^\s:]+)(?: ("(?:[^"\\]|\\.)*"))?((?: \[[^\]]*\])*)(?::(.*))?$/;
const REF_ATTR = /\[ref=((?:f\d+)?e\d+)\]/;

interface SnapLine {
  indent: number;
  role: string;
  name: string;
  ref?: string;
  text: string;
}

/** Never drops a line: whatever cannot be read as an element still contributes its raw text to the parent's subtree. */
function parseSnapLine(l: string): SnapLine | undefined {
  const q = QUOTED_KEY.exec(l);
  const p = q ?? PLAIN_LINE.exec(l);
  if (!p) return l.trim() ? { indent: l.length - l.trimStart().length, role: "", name: "", text: l.trim() } : undefined;
  const indent = p[1].length;
  const key = q ? q[2].replace(/''/g, "'") : p[2];
  const k = KEY.exec(key);
  if (!k) return { indent, role: "", name: "", text: `${key} ${q?.[3] ?? ""}`.trim() };
  return { indent, role: k[1], name: k[2] ? k[2].slice(1, -1) : "", ref: REF_ATTR.exec(k[3])?.[1], text: (q ? (q[3] ?? "") : (k[4] ?? "")).trim() };
}

/** A text value of a snapshot line decoded by its YAML quoting: '…' ('' = '), "…" (JSON escapes), plain as is. */
export function yamlScalar(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

/** Reads refs from a YAML snapshot structurally: a ref counts only as an attribute of the element, never inside names or texts. */
export function parseSnapshotRefs(yaml: string): Record<string, RefInfo> {
  const lines = yaml.split("\n").map(parseSnapLine);
  const refs: Record<string, RefInfo> = {};
  for (let i = 0; i < lines.length; i++) {
    const e = lines[i];
    if (!e?.ref) continue;
    const own = `${e.role}${e.name ? ` "${e.name}"` : ""}`;
    let all = `${own} ${e.text}`;
    const texts = e.text ? [yamlScalar(e.text)] : [];
    for (let j = i + 1; j < lines.length; j++) {
      const c = lines[j];
      if (!c) continue;
      if (c.indent <= e.indent) break;
      all += ` ${c.role} ${c.name} ${c.text}`;
      texts.push(yamlScalar(c.text));
    }
    const info: RefInfo = { label: own.slice(0, 120), ok: actionAllowed(all), submit: SUBMIT_LABEL_RE.test(all), content: texts.join("\n") };
    const prev = Object.hasOwn(refs, e.ref) ? refs[e.ref] : undefined;
    // The same ref twice: what the field holds is ambiguous (content unknown).
    refs[e.ref] = prev ? { label: `${prev.label} | ${info.label}`.slice(0, 240), ok: prev.ok && info.ok, submit: prev.submit || info.submit, content: undefined } : info;
  }
  return refs;
}

/**
 * The snapshot content of a tool response: inline YAML, or the file the MCP server saved (only inside `cwd`).
 * undefined = the response has no snapshot; "" = it has one the gate cannot read (the caller fails closed).
 */
function snapshotOf(text: string, cwd: string | undefined): string | undefined {
  const m = /(?:^|\n)### Snapshot\n([\s\S]*)$/.exec(text);
  if (!m) return undefined;
  const body = m[1];
  const fence = /^```yaml\n([\s\S]*?)\n```/.exec(body);
  if (fence) return fence[1];
  const link = /^- \[Snapshot\]\(([^)\n]+)\)/.exec(body);
  if (!link || !cwd) return "";
  try {
    const root = fs.realpathSync(cwd);
    const file = fs.realpathSync(path.resolve(root, link[1]));
    if (!file.startsWith(root + path.sep) || fs.statSync(file).size > 5_000_000) return "";
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Learns from a tool response (post): current URL, refs with real labels, bot challenge, off-allowlist page. */
export function observeResponse(response: unknown, state: GateState, cwd?: string): void {
  const text = textOf(response);
  // The "### Page" section precedes the title and the snapshot; its first URL line is the MCP server's own.
  // An "Error"/"Result" section before it can quote page text, so every "### Page" section and every URL line in it
  // is checked (fail-closed): injected text can only cause a false stop, never hide a real off-allowlist page.
  const urls = [...text.matchAll(/(?:^|\n)### Page\n([\s\S]*?)(?=\n### |$)/g)].flatMap((p) => [...p[1].matchAll(/^- Page URL:[ \t]*(\S+)[ \t]*$/gm)].map((m) => m[1]));
  if (urls.length) state.url = urls[0];
  const off = urls.find((u) => u !== "about:blank" && !hostAllowed(u));
  if (off) state.blocked ??= { kind: "offhost", detail: off };
  const snap = snapshotOf(text, cwd);
  if (snap) {
    const refs = parseSnapshotRefs(snap);
    if (Object.keys(refs).length) state.refs = refs;
  } else if (snap === "") {
    // The page changed but its snapshot cannot be read (file outside cwd, missing, too big): the old refs no longer
    // describe the page and a challenge in it would stay unseen, so no click/type until a readable snapshot.
    state.refs = {};
  }
  if (isBotChallenge(`${text}\n${snap ?? ""}`)) state.blocked ??= { kind: "bot", detail: "stránka vyžaduje ověření proti botům" };
}

/** Missing or damaged state → undefined (the caller decides; `pre` treats damage as deny). */
export function readState(file: string): GateState | undefined {
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8")) as GateState;
    if (typeof s.calls !== "number" || typeof s.submits !== "number" || !s.refs || typeof s.refs !== "object") return undefined;
    return s;
  } catch {
    return undefined;
  }
}

/** Runs fn under an exclusive lock (mkdir is atomic); hooks of parallel tool calls must not lose each other's updates. */
export function withLock<T>(file: string, fn: () => T): T {
  const lock = `${file}.lock`;
  const t0 = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 10_000) fs.rmdirSync(lock); // abandoned by a crashed hook
      } catch {
        /* released meanwhile */
      }
      if (Date.now() - t0 > 8_000) throw new Error("gate state lock timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmdirSync(lock);
  }
}

async function main() {
  const mode = process.argv[2];
  const file = process.env.TARS_GATE_STATE;
  if ((mode !== "pre" && mode !== "post") || !file) throw new Error("usage: TARS_GATE_STATE=<file> mcp-gate.ts pre|post");
  let raw = "";
  for await (const c of process.stdin) raw += c;
  const j = JSON.parse(raw) as { tool_name?: string; tool_input?: Record<string, unknown>; tool_response?: unknown; cwd?: string };
  const name = j.tool_name ?? "";
  const input = j.tool_input ?? {};
  withLock(file, () => {
    let state: GateState;
    if (fs.existsSync(file)) {
      const s = readState(file);
      if (!s) throw new Error("gate state damaged"); // fail closed: pre denies, the run ends UNKNOWN
      state = s;
    } else state = emptyState();
    if (mode === "pre") {
      const why = gateMcpCall(name, input, state, process.env.TARS_GATE_FILES || undefined, process.env.TARS_GATE_TYPE_SHA || undefined, process.env.TARS_GATE_NO_TYPE === "1");
      if (why) {
        process.stderr.write(`TARS: ${why}\n`);
        process.exitCode = 2;
        return;
      }
      countCall(name, input, state);
    } else {
      observeResponse(j.tool_response, state, j.cwd);
    }
    fs.writeFileSync(file, JSON.stringify(state));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`TARS: brána selhala: ${(e as Error).message}\n`);
    process.exit(2); // fail-closed
  });
}
