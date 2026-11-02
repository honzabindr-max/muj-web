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
