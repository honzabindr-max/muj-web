import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Chybějící H2 env proměnné nesmí ovlivnit existující stránky muj-web.
 * Config validace smí běžet jen na hranici H2 requestu (/api/h2/*,
 * /honzik2/* Buddy surfaces), nikdy při Next.js app boot.
 *
 * /honzik2/* výjimka byla od BUILD-01 jen v komentáři, ne v kódu testu —
 * BUILD-10's re-auth stránka (app/honzik2/reauth) je první skutečná
 * stránka, co h2/* importuje, takže výjimku aktivujeme teď.
 *
 * Tato sada to nevynucuje za běhu (to dělá modulární struktura Next.js
 * code-splittingu), ale zamyká to jako regresní kontrolu: pokud někdy
 * v budoucnu něco mimo h2/*, app/api/h2/* nebo app/honzik2/* naimportuje
 * h2 config, test spadne dřív, než se to projeví jako rozbitá homepage.
 */
function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      listSourceFiles(fullPath, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("H2 config: lazy loading, žádný dopad na existující stránky bez H2 env", () => {
  it("import h2/config nevyžaduje žádnou H2 env proměnnou a nespadne", async () => {
    const savedEnv = { ...process.env };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("H2_")) delete process.env[key];
    }
    try {
      const configModule = await import("../index");
      expect(() => configModule.getH2Config()).not.toThrow();
    } finally {
      process.env = savedEnv;
    }
  });

  it("žádný soubor mimo h2/**, app/api/h2/**, app/api/internal/** a app/honzik2/** neimportuje h2 config/logging/db (app/ i lib/)", () => {
    const scanDirs = ["app", "lib"].map((d) => path.join(REPO_ROOT, d)).filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    });

    // app/honzik2/** je vlastní Buddy web surface (BUILD-10 re-auth stránka
    // je první — BUILD-26 přidá zbytek) — komentář nahoře tuhle výjimku
    // předpokládal už od BUILD-01, jen ji kód dosud nekontroloval.
    //
    // app/api/internal/** — BUILD-11 Rozhodnutí 8: nezávislý queue-wake
    // endpoint (POST /api/internal/queue-wakeup, cron-job.org) je čistě H2
    // interní plumbing (autentizovaný přes H2_QUEUE_WAKE_SECRET, žádná
    // stránka/uživatelský povrch), ale plán ho záměrně pojmenoval mimo
    // /api/h2/* prefix (BUILD-11-PLAN.md) — proto vlastní scoped výjimka,
    // ne přesun pod app/api/h2/internal.
    const offenders: string[] = [];
    for (const dir of scanDirs) {
      for (const file of listSourceFiles(dir)) {
        const relative = path.relative(REPO_ROOT, file);
        if (relative.startsWith(path.join("app", "api", "h2"))) continue;
        if (relative.startsWith(path.join("app", "api", "internal"))) continue;
        if (relative.startsWith(path.join("app", "honzik2"))) continue;
        const content = readFileSync(file, "utf8");
        if (/from ["']@\/h2\//.test(content) || /from ["']\.\.\/.*\/h2\//.test(content)) {
          offenders.push(relative);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
