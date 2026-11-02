// TARS-GUARD (DR-022) gate: on ALARM the orchestrator stops before any work.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

export interface GuardResult {
  alarm: boolean;
  summary: string;
}

export function parseGuardOutput(out: string): GuardResult {
  const alarm = /TARS-GUARD ALARM/.test(out);
  const line =
    out.split("\n").find((l) => /TARS-GUARD (ALARM|OK)/.test(l)) ??
    "TARS-GUARD: no status line";
  return {
    alarm: alarm || !/TARS-GUARD OK/.test(out),
    summary: line.slice(0, 300),
  };
}

/** TARS-GUARD + I8 (browser automation only in the TARS-agent profile). Any I8 ALARM = alarm. */
export function runGuardWithI8(script: string, i8Script: string, cwd: string): GuardResult {
  const g = runGuard(script, cwd);
  if (!fs.existsSync(i8Script)) return { alarm: true, summary: `I8 script missing: ${i8Script}` };
  const r = spawnSync("bash", [i8Script], { cwd, encoding: "utf8", timeout: 30_000 });
  return combineI8(g, `${r.stdout ?? ""}`);
}

export function combineI8(g: GuardResult, i8Out: string): GuardResult {
  const alarms = i8Out.split("\n").filter((l) => l.startsWith("I8 ALARM"));
  if (alarms.length) return { alarm: true, summary: `${g.summary} | ${alarms.join(" | ")}`.slice(0, 600) };
  if (!/^I8 OK/m.test(i8Out)) return { alarm: true, summary: `${g.summary} | I8: no status line` };
  return { alarm: g.alarm, summary: `${g.summary} | I8 OK` };
}

export function runGuard(script: string, cwd: string): GuardResult {
  if (!fs.existsSync(script))
    return { alarm: true, summary: `TARS-GUARD script missing: ${script}` };
  const r = spawnSync("bash", [script], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    input: "{}",
  });
  return parseGuardOutput(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
}
