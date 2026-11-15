import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Hranice prototypu /mezi-vami (zamčené invarianty), hlídané nad zdrojáky sekce:
// noindex na celé sekci · žádné platby · žádný LLM výpočet · žádné ukládání osobních údajů ·
// data jen z fixtures.

const ROOT = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "fonts" ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const FILES = walk(ROOT);
// zdroják bez komentářů (komentáře smějí hranice popisovat)
const read = (p: string) =>
  fs
    .readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const rel = (p: string) => path.relative(ROOT, p);

describe("noindex", () => {
  it("layout sekce nastavuje robots index:false, follow:false", () => {
    const layout = read(path.join(ROOT, "layout.tsx"));
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });
  it("žádná stránka sekce nepřepisuje noindex na index:true", () => {
    for (const f of FILES) expect(read(f), rel(f)).not.toMatch(/index:\s*true/);
  });
});

describe("žádné platby, žádný LLM, žádné volání ven", () => {
  it("žádný fetch / XHR / beacon / formulář s akcí / API route v sekci", () => {
    for (const f of FILES) {
      const src = read(f);
      expect(src, rel(f)).not.toMatch(/\bfetch\s*\(/);
      expect(src, rel(f)).not.toMatch(/XMLHttpRequest|sendBeacon|EventSource|WebSocket/);
      expect(src, rel(f)).not.toMatch(/<form\b/);
      expect(src, rel(f)).not.toMatch(/["'`]\/api\//);
    }
    expect(fs.existsSync(path.join(ROOT, "api"))).toBe(false);
  });
  it("žádný platební ani LLM balíček či endpoint", () => {
    const bad =
      /from\s+["'](stripe|@stripe\/[^"']*|openai|@anthropic-ai\/[^"']*|@google\/generative-ai|gopay[^"']*|comgate[^"']*)["']|api\.(stripe|openai|anthropic)\.com|gopay\.cz|comgate\.cz|gw\.sandbox/i;
    for (const f of FILES) expect(read(f), rel(f)).not.toMatch(bad);
  });
  it("nic z větve mezi-vami-vypocet (_calc, výpočetní kontrakt) se nepřebírá", () => {
    expect(fs.existsSync(path.join(ROOT, "_calc"))).toBe(false);
    for (const f of FILES)
      expect(read(f), rel(f)).not.toMatch(/_calc\/|mezi-vami-vypocet/);
  });
});

describe("žádné ukládání osobních údajů", () => {
  it("žádné sessionStorage / localStorage / cookies / IndexedDB", () => {
    for (const f of FILES) {
      const src = read(f);
      expect(src, rel(f)).not.toMatch(
        /sessionStorage|localStorage|document\.cookie|indexedDB|cookies\(\)/,
      );
    }
  });
  it("store osob je čistě v paměti modulu", () => {
    const store = read(path.join(ROOT, "_lib/persons-store.ts"));
    expect(store).toMatch(/let memory/);
  });
});

describe("design (plátno je zdroj pravdy)", () => {
  it("ručně psané komponenty V nepoužívají váhu 300 ani Google Fonts", () => {
    for (const f of FILES.filter((x) => x.includes(`${path.sep}_v${path.sep}`))) {
      expect(read(f), rel(f)).not.toMatch(/fontWeight:\s*"?300/);
      expect(read(f), rel(f)).not.toMatch(/googleapis/);
    }
  });
  it("tokeny jsou v jednom souboru tokens.css (font a barva CTA z Design systému)", () => {
    const css = fs.readFileSync(path.join(ROOT, "tokens.css"), "utf8");
    expect(css).toMatch(/--peach-from:\s*#f7d5bb/);
    expect(css).toMatch(/--bg:\s*#0d090e/);
  });
});
