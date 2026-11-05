// Etapa 4 PR 2 FIX1 nález 3: refreshBrowserStatus (cli tick se scope vizual, browser-check) spustí sondu displeje
// před zámkem i před prohlížečem; spící displej nebo chyba sondy = žádný Chrome, žádný zámek, stav se nepřepíše.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { refreshBrowserStatusWith } from "../browser-status";

function rig(probe: () => { awake: boolean; reason: string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bs-"));
  const statusFile = path.join(dir, "browser-status.json");
  fs.writeFileSync(statusFile, '{"ok":true,"reasons":[],"checked_at":"x"}\n');
  const log: string[] = [];
  const deps = {
    displayAwake: () => {
      log.push("probe");
      return probe();
    },
    lock: {
      acquireLock: () => (log.push("lock"), true),
      releaseLock: () => void log.push("unlock"),
    },
    browser: () => {
      log.push("browser");
      return {
        loginCheck: async () => {
          log.push("loginCheck");
          return { ok: true, reasons: [] };
        },
      };
    },
    statusFile,
    shotsDir: path.join(dir, "shots-browser-check"),
  };
  return { deps, log, statusFile };
}

describe("refreshBrowserStatusWith: sonda displeje před prohlížečem", () => {
  it("spící displej, nejistota i výjimka sondy: jen sonda, žádný zámek ani prohlížeč, stav beze změny", async () => {
    const probes = [
      () => ({ awake: false, reason: "displej spí" }),
      () => ({ awake: false, reason: "sonda displeje: osascript selhal" }),
      (): { awake: boolean; reason: string } => {
        throw new Error("boom");
      },
    ];
    for (const p of probes) {
      const r = rig(p);
      const before = fs.readFileSync(r.statusFile, "utf8");
      const out = await refreshBrowserStatusWith(r.deps);
      expect(out.ok).toBe(false);
      expect(out.reasons[0]).toMatch(/^displej spí/);
      expect(r.log).toEqual(["probe"]);
      expect(fs.readFileSync(r.statusFile, "utf8")).toBe(before);
    }
  });

  it("probuzený displej: sonda → zámek → prohlížeč → loginCheck → uvolnění; stav zapsán", async () => {
    const r = rig(() => ({ awake: true, reason: "displej vzhůru" }));
    const out = await refreshBrowserStatusWith({
      ...r.deps,
      now: () => new Date("2026-11-05T08:00:00Z"),
    });
    expect(out.ok).toBe(true);
    expect(r.log).toEqual(["probe", "lock", "browser", "loginCheck", "unlock"]);
    expect(JSON.parse(fs.readFileSync(r.statusFile, "utf8"))).toMatchObject({
      ok: true,
      checked_at: "2026-11-05T08:00:00.000Z",
    });
  });
});
