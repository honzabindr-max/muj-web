// TARS-GUARD (DR-022) gate: on ALARM the orchestrator stops before any work.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

export interface GuardResult {
  alarm: boolean;
  summary: string;
}

/** Invariants the guard must confirm, each one as its own OK item (DR-022 I1–I8). */
export const GUARD_INVARIANTS = ["I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8"] as const;

const OK_LINE_RE = /^TARS-GUARD OK \((\d+)\/(\d+)\)(?::(.*))?$/;
const UNSURE_RE = /\bUNKNOWN\b|\bFAIL(?:ED)?\b|\bALARM\b/i;

/**
 * Fail-closed (DR-039): the gate opens only for exactly one line „TARS-GUARD OK (8/8): …“ that lists every one of
 * I1–I8 as an OK item, and nothing in the whole output says UNKNOWN, FAIL or ALARM (a summary OK next to a partial
 * UNKNOWN/FAIL is a contradiction = alarm). Missing, unparseable, duplicated or < 8/8 output = alarm.
 */
export function parseGuardOutput(out: string): GuardResult {
  const lines = out.split("\n").map((l) => l.trim());
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
  const unsure = lines.find((l) => UNSURE_RE.test(l));
  if (unsure) return fail(`rozpor: ${unsure.slice(0, 120)}`);
  return { alarm: false, summary: statusLine.slice(0, 300) };
}

/** TARS-GUARD + I8 (browser automation only in the TARS-agent profile). Any I8 ALARM = alarm. */
export function runGuardWithI8(script: string, i8Script: string, cwd: string, runsDir?: string): GuardResult {
  // The guards must judge "is an order running" by the same runs/ dir (lock) as the orchestrator.
  const env = runsDir ? { ...process.env, TARS_RUNS_DIR: runsDir } : process.env;
  const g = runGuard(script, cwd, env);
  if (!fs.existsSync(i8Script)) return { alarm: true, summary: `I8 script missing: ${i8Script}` };
  const r = spawnSync("bash", [i8Script], { cwd, encoding: "utf8", timeout: 30_000, env });
  return combineI8(g, `${r.stdout ?? ""}`);
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
  if (r.error) return { alarm: true, summary: `TARS-GUARD nedoběhl (${r.error.message.slice(0, 120)}) | fail-closed` };
  return parseGuardOutput(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
}
