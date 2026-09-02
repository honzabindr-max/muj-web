import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Chybějící H2 env proměnné nesmí ovlivnit existující stránky muj-web.
 * Config validace smí běžet jen na hranici H2 requestu (/api/h2/*,
 * budoucí /honzik2/* Buddy surfaces), nikdy při Next.js app boot.
 *
 * Tato sada to nevynucuje za běhu (to dělá modulární struktura Next.js
 * code-splittingu), ale zamyká to jako regresní kontrolu: pokud někdy
 * v budoucnu něco mimo h2/* nebo app/api/h2/* naimportuje h2 config,
 * test spadne dřív, než se to projeví jako rozbitá homepage.
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

  it("žádný soubor mimo h2/** a app/api/h2/** neimportuje h2 config/logging/db (app/ i lib/)", () => {
    const scanDirs = ["app", "lib"].map((d) => path.join(REPO_ROOT, d)).filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    });

    const offenders: string[] = [];
    for (const dir of scanDirs) {
      for (const file of listSourceFiles(dir)) {
        const relative = path.relative(REPO_ROOT, file);
        if (relative.startsWith(path.join("app", "api", "h2"))) continue;
        const content = readFileSync(file, "utf8");
        if (/from ["']@\/h2\//.test(content) || /from ["']\.\.\/.*\/h2\//.test(content)) {
          offenders.push(relative);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
