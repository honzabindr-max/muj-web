import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runContextJanitor } from "../context-janitor";

const tmpDirs: string[] = [];

function makeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "context-janitor-"));
  tmpDirs.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  return root;
}

function bootstrapFixture(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "CLAUDE.md": "# CLAUDE\n\nklidný soubor.\n",
    "AGENTS.md": "# AGENTS\n\nklidný soubor.\n",
    "docs/h2/BUILD-STATUS.md": "# H2 Buddy — Build Status\n\nklidný soubor.\n",
    "docs/h2/DECISIONS.md": "# H2 Buddy — Decision Log\n\n### DEC-001\n\nobsah.\n\n## Authority map\n\nobsah.\n",
    ...overrides,
  };
}

describe("runContextJanitor", () => {
  afterEach(() => {
    while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
  });

  it("nehlásí FAIL na zdravé sadě bootstrap souborů", () => {
    const root = makeRepo(bootstrapFixture());
    const { failures } = runContextJanitor(root);
    expect(failures).toEqual([]);
  });

  it("FAIL na odkaz na neexistující soubor", () => {
    const root = makeRepo(
      bootstrapFixture({
        "docs/h2/BUILD-STATUS.md": "# Status\n\n[Plán](./NEEXISTUJE-PLAN.md)\n",
      }),
    );
    const { failures } = runContextJanitor(root);
    expect(failures.some((f) => /NEEXISTUJE-PLAN\.md/.test(f.message))).toBe(true);
  });

  it("FAIL na odkaz s rozbitou kotvou v existujícím souboru", () => {
    const root = makeRepo(
      bootstrapFixture({
        "docs/h2/BUILD-STATUS.md": "# Status\n\n[DEC](./DECISIONS.md#dec-999)\n",
      }),
    );
    const { failures } = runContextJanitor(root);
    expect(failures.some((f) => /dec-999/.test(f.message))).toBe(true);
  });

  it("validní odkaz s existující kotvou neprojde jako FAIL", () => {
    const root = makeRepo(
      bootstrapFixture({
        "docs/h2/BUILD-STATUS.md": "# Status\n\n[DEC](./DECISIONS.md#dec-001)\n",
      }),
    );
    const { failures } = runContextJanitor(root);
    expect(failures).toEqual([]);
  });

  it("FAIL, když CLAUDE.md přesáhne 120 řádků", () => {
    const longClaude = "# CLAUDE\n" + "řádek\n".repeat(121);
    const root = makeRepo(bootstrapFixture({ "CLAUDE.md": longClaude }));
    const { failures } = runContextJanitor(root);
    expect(failures.some((f) => f.file === "CLAUDE.md" && /120/.test(f.message))).toBe(true);
  });

  it("FAIL, když docs/h2/BUILD-STATUS.md přesáhne 200 řádků", () => {
    const longStatus = "# Status\n" + "řádek\n".repeat(201);
    const root = makeRepo(bootstrapFixture({ "docs/h2/BUILD-STATUS.md": longStatus }));
    const { failures } = runContextJanitor(root);
    expect(failures.some((f) => f.file === "docs/h2/BUILD-STATUS.md" && /200/.test(f.message))).toBe(true);
  });

  it("FAIL, když chybí celý bootstrap soubor", () => {
    const files = bootstrapFixture();
    delete files["AGENTS.md"];
    const root = makeRepo(files);
    const { failures } = runContextJanitor(root);
    expect(failures.some((f) => f.file === "AGENTS.md")).toBe(true);
  });

  it("WARNING na výskyt supabase v bootstrap souboru", () => {
    const root = makeRepo(bootstrapFixture({ "CLAUDE.md": "# CLAUDE\n\nSupabase REST API cap.\n" }));
    const { warnings } = runContextJanitor(root);
    expect(warnings.some((w) => w.file === "CLAUDE.md" && /supabase/i.test(w.message))).toBe(true);
  });

  it("WARNING na starý/neexistující název repa", () => {
    const root = makeRepo(bootstrapFixture({ "CLAUDE.md": "# CLAUDE\n\nRepo: honzabindr-max/muj-web-next\n" }));
    const { warnings } = runContextJanitor(root);
    expect(warnings.some((w) => /muj-web-next/.test(w.message))).toBe(true);
  });

  it("nehlásí WARNING na kanonický název repa", () => {
    const root = makeRepo(bootstrapFixture({ "CLAUDE.md": "# CLAUDE\n\nRepo: honzabindr-max/muj-web\n" }));
    const { warnings } = runContextJanitor(root);
    expect(warnings.some((w) => /muj-web/.test(w.message))).toBe(false);
  });

  it("WARNING, když víc souborů tvrdí, že jsou autorita pro stejnou kategorii", () => {
    const root = makeRepo(
      bootstrapFixture({
        "CLAUDE.md": "# CLAUDE\n\nTenhle soubor je zdroj pravdy pro bootstrap pořadí.\n",
        "AGENTS.md": "# AGENTS\n\nTenhle soubor je zdroj pravdy pro bootstrap pořadí.\n",
      }),
    );
    const { warnings } = runContextJanitor(root);
    expect(warnings.some((w) => /bootstrap pořadí čtení/.test(w.message))).toBe(true);
  });
});
