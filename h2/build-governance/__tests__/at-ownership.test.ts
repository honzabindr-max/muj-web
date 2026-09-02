import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AT_OWNERSHIP, COMPLETED_BUILD_BLOCKS, TOTAL_AT_COUNT } from "../at-ownership";

function listTestFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      listTestFiles(fullPath, out);
    } else if (entry.endsWith(".test.ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("Acceptance Test Ownership Matrix (Build Specification §6)", () => {
  it("každý AT-01..AT-72 má právě jednoho BUILD ownera — žádná duplicita, žádná mezera", () => {
    const ownerOf = new Map<string, string>();
    for (const [block, ats] of Object.entries(AT_OWNERSHIP)) {
      for (const at of ats) {
        const existingOwner = ownerOf.get(at);
        if (existingOwner) {
          throw new Error(`${at} je vlastněný duplicitně: ${existingOwner} i ${block}`);
        }
        ownerOf.set(at, block);
      }
    }

    const missing: string[] = [];
    for (let n = 1; n <= TOTAL_AT_COUNT; n += 1) {
      const at = `AT-${String(n).padStart(2, "0")}`;
      if (!ownerOf.has(at)) missing.push(at);
    }
    expect(missing, `chybí owner pro: ${missing.join(", ")}`).toEqual([]);
    expect(ownerOf.size).toBe(TOTAL_AT_COUNT);
  });

  it("dokončené bloky (COMPLETED_BUILD_BLOCKS) mají test soubor odkazující na jejich AT čísla", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const testFiles = listTestFiles(path.join(repoRoot, "h2")).concat(
      listTestFiles(path.join(repoRoot, "app")),
    );
    const allTestContent = testFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    const missingCoverage: string[] = [];
    for (const block of COMPLETED_BUILD_BLOCKS) {
      for (const at of AT_OWNERSHIP[block] ?? []) {
        if (!allTestContent.includes(at)) {
          missingCoverage.push(`${at} (${block})`);
        }
      }
    }
    expect(missingCoverage, `AT bez zmínky v testech: ${missingCoverage.join(", ")}`).toEqual([]);
  });
});
