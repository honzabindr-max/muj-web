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
}

export interface GateState {
  calls: number;
  submits: number;
  url?: string;
  refs: Record<string, RefInfo>;
  blocked?: { kind: "offhost" | "bot"; detail: string };
}

export const emptyState = (): GateState => ({ calls: 0, submits: 0, refs: {} });

/** Returns the reason a tool call is denied, or undefined when it is allowed (pure; the caller counts the call). */
export function gateMcpCall(toolName: string, input: Record<string, unknown> = {}, state: GateState = emptyState()): string | undefined {
  const prefix = `mcp__${MCP_SERVER}__`;
  if (!toolName.startsWith(prefix)) return undefined; // not ours (matcher keeps this from happening)
  const tool = toolName.slice(prefix.length);
  if (state.blocked) return `běh zastaven (${state.blocked.kind === "bot" ? "ověření proti botům" : "stránka mimo povolené hosty"}): ${state.blocked.detail}`;
  if (state.calls >= MAX_TOOL_CALLS) return `překročen limit ${MAX_TOOL_CALLS} volání nástrojů prohlížeče`;
  if (!(BROWSER_MCP_TOOLS as readonly string[]).includes(tool)) return `nástroj ${tool} není pro prohlížeč TARS povolen`;
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
  }
  return undefined;
}

/** Counts an allowed call (pre): every call, and submits (type with submit, click on a send-like element). */
export function countCall(toolName: string, input: Record<string, unknown>, state: GateState): void {
  state.calls++;
  if (toolName.endsWith("browser_type") && input.submit === true) state.submits++;
  if (toolName.endsWith("browser_click")) {
    const ref = Object.hasOwn(state.refs, String(input.target ?? input.ref ?? "")) ? state.refs[String(input.target ?? input.ref)] : undefined;
    if (ref?.submit) state.submits++;
  }
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
const KEY = /^(\S+)(?: ("(?:[^"\\]|\\.)*"))?((?: \[[^\]]*\])*)(?::(.*))?$/;
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

/** Reads refs from a YAML snapshot structurally: a ref counts only as an attribute of the element, never inside names or texts. */
export function parseSnapshotRefs(yaml: string): Record<string, RefInfo> {
  const lines = yaml.split("\n").map(parseSnapLine);
  const refs: Record<string, RefInfo> = {};
  for (let i = 0; i < lines.length; i++) {
    const e = lines[i];
    if (!e?.ref) continue;
    const own = `${e.role}${e.name ? ` "${e.name}"` : ""}`;
    let all = `${own} ${e.text}`;
    for (let j = i + 1; j < lines.length; j++) {
      const c = lines[j];
      if (!c) continue;
      if (c.indent <= e.indent) break;
      all += ` ${c.role} ${c.name} ${c.text}`;
    }
    const info: RefInfo = { label: own.slice(0, 120), ok: actionAllowed(all), submit: SUBMIT_LABEL_RE.test(all) };
    const prev = Object.hasOwn(refs, e.ref) ? refs[e.ref] : undefined;
    refs[e.ref] = prev ? { label: `${prev.label} | ${info.label}`.slice(0, 240), ok: prev.ok && info.ok, submit: prev.submit || info.submit } : info;
  }
  return refs;
}

/** The snapshot content of a tool response: inline YAML, or the file the MCP server saved (only inside `cwd`). */
function snapshotOf(text: string, cwd: string | undefined): string {
  const m = /(?:^|\n)### Snapshot\n([\s\S]*)$/.exec(text);
  if (!m) return "";
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
  const page = /(?:^|\n)### Page\n([\s\S]*?)(?=\n### |$)/.exec(text);
  const url = page ? /^- Page URL:[ \t]*(\S+)[ \t]*$/m.exec(page[1])?.[1] : undefined;
  if (url) {
    state.url = url;
    if (url !== "about:blank" && !hostAllowed(url)) state.blocked ??= { kind: "offhost", detail: url };
  }
  const snap = snapshotOf(text, cwd);
  if (snap) {
    const refs = parseSnapshotRefs(snap);
    if (Object.keys(refs).length) state.refs = refs;
  }
  if (isBotChallenge(`${text}\n${snap}`)) state.blocked ??= { kind: "bot", detail: "stránka vyžaduje ověření proti botům" };
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
      const why = gateMcpCall(name, input, state);
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
