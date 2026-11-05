// Etapa 4 PR 2 FIX1 nález 3: obnova stavu přihlášení profilu TARS-agent (rung 3) s branou displeje.
// Sonda displeje běží jako první: spící displej nebo chyba sondy = žádný zámek, žádný Chrome, žádný ovladač a uložený
// stav (browser-status.json) se nepřepíše. Teprve při probuzeném displeji se přes lease spustí loginCheck.
import fs from "node:fs";
import path from "node:path";

import type { PreflightResult } from "./ladder";

export interface BrowserStatusDeps {
  displayAwake: () => { awake: boolean; reason: string };
  /** Lease ticku (debugovací port smí existovat jen při drženém zámku, I8). */
  lock: { acquireLock(): boolean; releaseLock(): void };
  /** Vytvoří prohlížeč až po sondě a zámku (samotná tvorba nic nespouští). */
  browser: () => {
    loginCheck(site: string, shotsDir: string): Promise<PreflightResult>;
  };
  statusFile: string;
  shotsDir: string;
  site?: string;
  now?: () => Date;
}

export async function refreshBrowserStatusWith(
  d: BrowserStatusDeps,
): Promise<PreflightResult> {
  let disp: { awake: boolean; reason: string };
  try {
    disp = d.displayAwake();
  } catch {
    disp = { awake: false, reason: "sonda displeje selhala" };
  }
  if (disp.awake !== true)
    return {
      ok: false,
      reasons: [
        `displej spí (${disp.reason}); kontrola přihlášení se neprovedla`,
      ],
    };
  if (!d.lock.acquireLock())
    return { ok: false, reasons: ["běží jiná zakázka (lock)"] };
  let r: PreflightResult;
  try {
    r = await d
      .browser()
      .loginCheck(d.site ?? "https://claude.ai/new", d.shotsDir);
  } catch (e) {
    r = {
      ok: false,
      reasons: [`login check selhal: ${(e as Error).message.split("\n")[0]}`],
    };
  } finally {
    d.lock.releaseLock();
  }
  fs.mkdirSync(path.dirname(d.statusFile), { recursive: true });
  fs.writeFileSync(
    d.statusFile,
    JSON.stringify(
      { ...r, checked_at: (d.now?.() ?? new Date()).toISOString() },
      null,
      2,
    ),
  );
  return r;
}
