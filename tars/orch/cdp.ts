// Variant B (TARS-ORCH-001 §2b, příčka 3): the REAL Chrome binary with the isolated TARS-agent
// profile, started by the orchestrator for the duration of one browser job, with a debugging
// port bound to 127.0.0.1. Playwright attaches over CDP (no --enable-automation, visible window).
// Fail-closed identity check before any action: the process listening on the port must be
// Chrome with --user-data-dir=<TARS-agent profile>; the profile must have no Google account.
// After the job the Chrome process is terminated, so the port never outlives the order.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const CHROME_BIN = process.env.TARS_CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const CDP_PORT = Number(process.env.TARS_CDP_PORT ?? 9333);

export class IdentityError extends Error {}

export function chromeArgs(profileDir: string, port: number): string[] {
  return [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
}

/** Pure identity rule: the debugging process must be exactly the TARS-agent profile on 127.0.0.1. */
export function isTarsAgentProcess(cmdline: string, profileDir: string, port: number): boolean {
  return (
    cmdline.includes(`--user-data-dir=${profileDir}`) &&
    cmdline.includes(`--remote-debugging-port=${port}`) &&
    !/--remote-debugging-address=(?!127\.0\.0\.1)/.test(cmdline)
  );
}

/** Count of Google accounts in the profile; reads only the account_info key. */
export function googleAccountCount(profileDir: string): number | undefined {
  const f = path.join(profileDir, "Default", "Preferences");
  if (!fs.existsSync(f)) return 0;
  try {
    const a = (JSON.parse(fs.readFileSync(f, "utf8")) as { account_info?: unknown[] }).account_info;
    return Array.isArray(a) ? a.length : 0;
  } catch {
    return undefined;
  }
}

function listenerCmdline(port: number): string | undefined {
  const l = spawnSync("lsof", ["-nP", `-iTCP@127.0.0.1:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  const pid = (l.stdout ?? "").trim().split("\n")[0];
  if (!pid) return undefined;
  return spawnSync("ps", ["-ww", "-o", "command=", "-p", pid], { encoding: "utf8" }).stdout?.trim();
}

/** Is the TARS-agent profile already open (without our port)? Launching would hand off to it. */
export function profileAlreadyOpen(profileDir: string, psOutput?: string): boolean {
  const out = psOutput ?? spawnSync("ps", ["-axww", "-o", "command="], { encoding: "utf8" }).stdout ?? "";
  return out.split("\n").some((l) => l.includes("Google Chrome") && l.includes(`--user-data-dir=${profileDir}`) && !l.includes("--type="));
}

export interface CdpSession {
  endpoint: string;
  close(): Promise<void>;
}

async function waitForEndpoint(port: number, ms: number): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Starts real Chrome with the TARS-agent profile and verifies identity (fail-closed). */
export async function startTarsChrome(profileDir: string, port = CDP_PORT): Promise<CdpSession> {
  const accounts = googleAccountCount(profileDir);
  if (accounts === undefined) throw new IdentityError("Preferences profilu TARS-agent nečitelné – Google účet UNKNOWN");
  if (accounts > 0) throw new IdentityError("v profilu TARS-agent je přihlášený Google účet – stop");
  if (profileAlreadyOpen(profileDir)) throw new IdentityError("profil TARS-agent je už otevřený bez ladicího portu – zavři jeho okno (Cmd+Q) a zakázku spusť znovu");
  if (listenerCmdline(port)) throw new IdentityError(`port ${port} už někdo poslouchá – stop`);
  const proc: ChildProcess = spawn(CHROME_BIN, chromeArgs(profileDir, port), { stdio: "ignore", detached: false });
  const close = async () => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1500));
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }
  };
  if (!(await waitForEndpoint(port, 20_000))) {
    await close();
    throw new IdentityError("Chrome TARS-agent nenaběhl s ladicím portem");
  }
  const cmd = listenerCmdline(port) ?? "";
  if (!isTarsAgentProcess(cmd, profileDir, port)) {
    await close();
    throw new IdentityError("proces na ladicím portu není profil TARS-agent – stop (fail-closed)");
  }
  return { endpoint: `http://127.0.0.1:${port}`, close };
}
