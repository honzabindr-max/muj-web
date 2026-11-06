// TARS-GUARD (DR-022) gate: on ALARM the orchestrator stops before any work.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import { redactSecretsUnbounded } from "./secret-scan";

export interface GuardResult {
  alarm: boolean;
  summary: string;
}

/** Invariants the guard must confirm, each one as its own OK item (DR-022 I1–I8). */
export const GUARD_INVARIANTS = ["I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8"] as const;

/**
 * Explicit positive state of each invariant, exactly as `tars-guard.sh` prints it into the OK line (`ok+=("I1 …")`;
 * for I8 the text after „I8 OK “ from `i8.sh`). A bare `OK` / `PASS` also counts. Anything else (SKIP, empty,
 * unknown text) is not a positive state = alarm.
 */
export const GUARD_OK_TEXTS: Record<(typeof GUARD_INVARIANTS)[number], readonly string[]> = {
  I1: ["všechny klony HTTPS"],
  I2: ["fine-grained token"],
  I3: ["token bez Administration"],
  I4: ["ruleset main aktivní"],
  I5: ["SSH ke GitHubu zamítnuto"],
  I6: ["žádné staré .env.migrate*/.env.verify"],
  I7: ["Vercel CLI odhlášené", "Vercel CLI není nainstalované"],
  I8: ["prohlížečová automatizace jen v profilu TARS-agent, bez Google účtu"],
};
const OK_WORDS = new Set(["OK", "PASS"]);
const ITEM_RE = /^(I\d+)(?:\s+(.*))?$/;

const OK_LINE_RE = /^TARS-GUARD OK \((\d+)\/(\d+)\)(?::(.*))?$/;
const UNSURE_RE = /\bUNKNOWN\b|\bFAIL(?:ED)?\b|\bALARM\b|\bWARN(?:ING)?\b/i;

/**
 * `tars-guard.sh` is a SessionStart hook: its stdout is one JSON line
 * `{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "TARS-GUARD OK (8/8): …\n"}}`
 * (the script prints nothing else to stdout). This unwraps the envelope into plain text; non-JSON lines (a plain-text
 * guard, stderr) pass through unchanged. Fail-closed: a line that looks like JSON but does not parse, an envelope
 * without `hookEventName: "SessionStart"` or without a string `additionalContext`, or more than one envelope = error.
 */
export function unwrapGuardOutput(out: string): { text: string } | { error: string } {
  const contexts: string[] = [];
  const plain: string[] = [];
  for (const raw of out.split("\n")) {
    const l = raw.trim();
    if (!l.startsWith("{")) {
      plain.push(raw);
      continue;
    }
    let j: unknown;
    try {
      j = JSON.parse(l);
    } catch {
      return { error: "neplatný JSON ve výstupu" };
    }
    const h = (j as { hookSpecificOutput?: { hookEventName?: unknown; additionalContext?: unknown } } | null)?.hookSpecificOutput;
    if (!h || typeof h !== "object") return { error: "JSON bez hookSpecificOutput" };
    if (h.hookEventName !== "SessionStart") return { error: "hookEventName není SessionStart" };
    if (typeof h.additionalContext !== "string") return { error: "chybí additionalContext (text)" };
    contexts.push(h.additionalContext);
  }
  if (contexts.length > 1) return { error: `${contexts.length} obálky SessionStart místo jedné` };
  return { text: [...contexts, ...plain].join("\n") };
}

/**
 * Fail-closed (DR-039): the gate opens only for exactly one line „TARS-GUARD OK (8/8): …“ that lists every one of
 * I1–I8 exactly once with an explicitly positive state (`GUARD_OK_TEXTS`, or OK / PASS), and nothing in the whole
 * output says UNKNOWN, FAIL, WARN or ALARM (a summary OK next to a partial UNKNOWN/FAIL is a contradiction = alarm).
 * Missing, unparseable, duplicated, SKIP / empty / unknown state or < 8/8 output = alarm.
 * Takes the hook's JSON envelope or plain text (`unwrapGuardOutput`); the same strict check runs after unwrapping.
 */
export function parseGuardOutput(out: string): GuardResult {
  const u = unwrapGuardOutput(out);
  if ("error" in u) return { alarm: true, summary: `TARS-GUARD: ${u.error} | fail-closed`.slice(0, 300) };
  const lines = u.text.split("\n").map((l) => l.trim());
  const statusLine = lines.find((l) => /TARS-GUARD (ALARM|OK)/.test(l)) ?? "TARS-GUARD: no status line";
  const fail = (why: string): GuardResult => ({ alarm: true, summary: `${statusLine.slice(0, 240)} | fail-closed: ${why}`.slice(0, 300) });
  if (lines.some((l) => /TARS-GUARD ALARM/.test(l))) return { alarm: true, summary: statusLine.slice(0, 300) };
  const okLines = lines.filter((l) => l.startsWith("TARS-GUARD OK"));
  if (okLines.length === 0) return fail("chybí řádek TARS-GUARD OK");
  if (okLines.length > 1) return fail("víc řádků TARS-GUARD OK");
  const m = OK_LINE_RE.exec(okLines[0]);
  if (!m) return fail("řádek TARS-GUARD OK nejde rozparsovat");
  const [ok, total] = [Number(m[1]), Number(m[2])];
  if (total !== GUARD_INVARIANTS.length || ok !== total) return fail(`${ok}/${total} místo ${GUARD_INVARIANTS.length}/${GUARD_INVARIANTS.length}`);
  const items = (m[3] ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  const missing = GUARD_INVARIANTS.filter((k) => !items.some((it) => new RegExp(`^${k}(?![0-9])`).test(it)));
  if (missing.length) return fail(`chybí ${missing.join(", ")}`);
  if (items.length !== GUARD_INVARIANTS.length) return fail(`${items.length} položek místo ${GUARD_INVARIANTS.length}`);
  const seen = new Set<string>();
  for (const it of items) {
    const im = ITEM_RE.exec(it);
    const k = im?.[1] as (typeof GUARD_INVARIANTS)[number] | undefined;
    if (!im || !k || !GUARD_INVARIANTS.includes(k)) return fail(`neznámá položka: ${it.slice(0, 60)}`);
    if (seen.has(k)) return fail(`${k} uvedeno víckrát`);
    seen.add(k);
    const state = (im[2] ?? "").trim();
    if (!state) return fail(`${k} bez stavu`);
    if (!OK_WORDS.has(state) && !GUARD_OK_TEXTS[k].includes(state)) return fail(`${k} stav „${state.slice(0, 60)}“ není kladný`);
  }
  const unsure = lines.find((l) => UNSURE_RE.test(l));
  if (unsure) return fail(`rozpor: ${unsure.slice(0, 120)}`);
  return { alarm: false, summary: statusLine.slice(0, 300) };
}

const STDERR_HEAD = 160;

/**
 * Diagnostic only (never changes alarm): why a guard / I8 child failed – `status=<n> signal=<s>` plus the first
 * ≤160 chars of stderr, redacted BEFORE the cut (a token cut in half would no longer match a pattern).
 * Returns "" when the child looks healthy (exit 0, no signal, no spawn error, non-empty stdout).
 */
export function failureReason(r: Pick<SpawnSyncReturns<string>, "status" | "signal" | "stdout" | "stderr" | "error">): string {
  const healthy = !r.error && r.status === 0 && !r.signal && `${r.stdout ?? ""}`.trim() !== "";
  if (healthy) return "";
  const head = redactSecretsUnbounded(`${r.stderr ?? ""}`.trim())
    .replace(/\s+/g, " ")
    .slice(0, STDERR_HEAD);
  const err = r.error ? ` error=${redactSecretsUnbounded(r.error.message).slice(0, 120)}` : "";
  return `status=${r.status ?? "null"} signal=${r.signal ?? "null"}${err}${head ? ` stderr: ${head}` : ""}`;
}

/** TARS-GUARD + I8 (browser automation only in the TARS-agent profile). Any I8 ALARM = alarm. */
export function runGuardWithI8(script: string, i8Script: string, cwd: string, runsDir?: string): GuardResult {
  // The guards must judge "is an order running" by the same runs/ dir (lock) as the orchestrator.
  const env = runsDir ? { ...process.env, TARS_RUNS_DIR: runsDir } : process.env;
  const g = runGuard(script, cwd, env);
  if (!fs.existsSync(i8Script)) return { alarm: true, summary: `I8 script missing: ${i8Script}` };
  const r = spawnSync("bash", [i8Script], { cwd, encoding: "utf8", timeout: 30_000, env });
  const res = combineI8(g, `${r.stdout ?? ""}`);
  const why = res.alarm ? failureReason(r) : "";
  return why ? { alarm: true, summary: `${res.summary} | I8 příčina: ${why}` } : res;
}

export function combineI8(g: GuardResult, i8Out: string): GuardResult {
  const alarms = i8Out.split("\n").filter((l) => l.startsWith("I8 ALARM"));
  if (alarms.length) return { alarm: true, summary: `${g.summary} | ${alarms.join(" | ")}`.slice(0, 600) };
  if (!/^I8 OK/m.test(i8Out)) return { alarm: true, summary: `${g.summary} | I8: no status line` };
  // Fail-closed (DR-039): I8 OK next to an I8 WARN / UNKNOWN is a contradiction.
  const unsure = i8Out.split("\n").filter((l) => l.startsWith("I8 WARN") || UNSURE_RE.test(l));
  if (unsure.length) return { alarm: true, summary: `${g.summary} | fail-closed: ${unsure.join(" | ")}`.slice(0, 600) };
  return { alarm: g.alarm, summary: `${g.summary} | I8 OK` };
}

export function runGuard(script: string, cwd: string, env: NodeJS.ProcessEnv = process.env): GuardResult {
  if (!fs.existsSync(script))
    return { alarm: true, summary: `TARS-GUARD script missing: ${script}` };
  const r = spawnSync("bash", [script], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    input: "{}",
    env,
  });
  if (r.error) return { alarm: true, summary: `TARS-GUARD nedoběhl (${redactSecretsUnbounded(r.error.message).slice(0, 120)}) | fail-closed | příčina: ${failureReason(r)}` };
  const res = parseGuardOutput(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
  const why = res.alarm ? failureReason(r) : "";
  return why ? { alarm: true, summary: `${res.summary} | příčina: ${why}` } : res;
}
