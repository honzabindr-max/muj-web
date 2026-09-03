import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Strojová kontrola (docs/h2/BUILD-07-PLAN.md Rozhodnutí 7, Honzíkův
 * výslovný požadavek): "jen activatePromptVersion() smí zapsat
 * prompt_versions.status = 'ACTIVE'" je jinak jen konvence, co drží do
 * chvíle, kdy si na ni někdo nevzpomene. Stejný vzor jako
 * h2/build-governance/at-ownership.ts — mechanická kontrola, ne text v
 * plánu.
 *
 * Regex je vázaný na "update/insert ... prompt_versions ... 'ACTIVE'"
 * pohromadě (bounded rozestup, ne přes celý soubor), ne na holý string
 * "ACTIVE" — jinak by trefil legitimní TS union typ
 * ('DRAFT'|'TESTING'|'ACTIVE'|'RETIRED') nebo testovací
 * `expect(status).toBe("ACTIVE")` assert, což by byl false positive.
 */
const ACTIVE_WRITE_PATTERN = /(update|insert)[^;]{0,500}prompt_versions[^;]{0,500}'ACTIVE'/i;
const ALLOWED_FILE = path.join("h2", "prompts", "activation.ts");

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      listSourceFiles(fullPath, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("prompt_versions ACTIVE zápis — jen activatePromptVersion() (BUILD-07 plán, Rozhodnutí 7)", () => {
  it("žádný jiný modul v h2/ ani app/ nezapisuje status='ACTIVE' do prompt_versions", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const files = listSourceFiles(path.join(repoRoot, "h2")).concat(listSourceFiles(path.join(repoRoot, "app")));

    const violations: string[] = [];
    for (const file of files) {
      const relative = path.relative(repoRoot, file);
      if (relative === ALLOWED_FILE) continue;
      const content = readFileSync(file, "utf8");
      if (ACTIVE_WRITE_PATTERN.test(content)) {
        violations.push(relative);
      }
    }
    expect(violations, `nalezen zápis ACTIVE mimo ${ALLOWED_FILE}: ${violations.join(", ")}`).toEqual([]);
  });

  it("kontrola skutečně něco hlídá — regex trefí umělý porušující vzor (regresní fixture)", () => {
    const violatingSample = "await client.query(\"update prompt_versions set status = 'ACTIVE' where id = $1\", [id]);";
    expect(ACTIVE_WRITE_PATTERN.test(violatingSample)).toBe(true);
  });

  it("nefalešně pozitivní na legitimní TS union typ ani na testovací assert", () => {
    const typeDeclaration = 'export type PromptVersionStatus = "DRAFT" | "TESTING" | "ACTIVE" | "RETIRED";';
    const testAssertion = 'expect(row.status).toBe("ACTIVE");';
    expect(ACTIVE_WRITE_PATTERN.test(typeDeclaration)).toBe(false);
    expect(ACTIVE_WRITE_PATTERN.test(testAssertion)).toBe(false);
  });
});
