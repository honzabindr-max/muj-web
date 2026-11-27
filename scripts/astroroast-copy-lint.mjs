#!/usr/bin/env node
// AstroRoast: deterministická kontrola českých textů per model (typografie + pravopis).
//
//   node scripts/astroroast-copy-lint.mjs            souhrn per model
//   node scripts/astroroast-copy-lint.mjs --details  i jednotlivé nálezy
//   node scripts/astroroast-copy-lint.mjs --details --nbsp  i nálezy, kde chybí jen nezlomitelná mezera
//   node scripts/astroroast-copy-lint.mjs --strict   exit 1 při jakémkoli nálezu (pro CI)
//
// Typografie: typopo (fixTypos, locale "cs"). Nález = text, který by typopo změnil
// (uvozovky „“, nezlomitelná mezera po jednopísmenných předložkách a spojkách, pomlčky, výpustka).
// Pravopis: cspell + @cspell/dict-cs-cz (offline). Slova projektu jsou v astroroast/cspell.json.
// Nic se neposílá ven.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { fixTypos } from "typopo";

const ROOT = new URL("..", import.meta.url).pathname;
const MODELS = ["claude", "codex", "skills"];
const args = new Set(process.argv.slice(2));

function filesFor(model) {
  const dir = join(ROOT, "astroroast/content", model);
  const signs = readdirSync(join(dir, "signs")).map((f) => join(dir, "signs", f));
  return [
    ...signs,
    join(dir, "shared.ts"),
    join(dir, "catalog.ts"),
    join(dir, "signinfo.ts"),
    join(ROOT, "astroroast/copy", `${model}.ts`),
  ];
}

/** Texty pro lidi: string a template literály s mezerou nebo písmenem s diakritikou. */
function extract(file) {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const out = [];
  const push = (text, node) => {
    if (!/\s/.test(text) && !/[À-ž]/.test(text)) return; // id, klíče, slugy
    if (/^[a-z0-9-]+$/.test(text)) return;
    const { line } = src.getLineAndCharacterOfPosition(node.getStart());
    out.push({ file: relative(ROOT, file), line: line + 1, text });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!ts.isPropertyAssignment(node.parent) || node.parent.name !== node) push(node.text, node);
    } else if (ts.isTemplateExpression(node)) {
      // ${…} nahradíme slovem, aby typopo viděl celou větu
      const text = node.head.text + node.templateSpans.map((s) => "X" + s.literal.text).join("");
      push(text, node);
      node.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

const show = (s) => s.replace(/ /g, "⍽");

function spelling(strings) {
  let raw = "";
  try {
    raw = execFileSync(
      "npx",
      ["--no-install", "cspell", "lint", "--no-progress", "--no-summary", "--unique", "--words-only",
        "-c", join(ROOT, "astroroast/cspell.json"), "--language-id", "plaintext", "stdin"],
      { cwd: ROOT, encoding: "utf8", input: strings.map((s) => s.text).join("\n"), stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (e) {
    raw = e.stdout ?? ""; // cspell končí kódem 1, když najde chyby
  }
  return [...new Set(raw.split("\n").map((w) => w.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "cs"));
}

let total = 0;
const rows = [];
for (const model of MODELS) {
  const strings = filesFor(model).flatMap(extract);
  const typo = strings
    .map((s) => ({ ...s, fixed: fixTypos(s.text, "cs") }))
    .filter((s) => s.fixed !== s.text);
  const nbspOnly = typo.filter((t) => t.fixed.replace(/\u00a0/g, " ") === t.text).length;
  const words = spelling(strings);
  const chars = strings.reduce((n, s) => n + s.text.length, 0);
  rows.push({ model, strings: strings.length, chars, typo: typo.length, nbsp: nbspOnly, spell: words.length });
  total += typo.length + words.length;
  if (args.has("--details")) {
    console.log(`\n## ${model}: typografie (${typo.length})`);
    for (const t of typo.filter((x) => args.has("--nbsp") || x.fixed.replace(/\u00a0/g, " ") !== x.text)) console.log(`${t.file}:${t.line}\n  - ${show(t.text)}\n  + ${show(t.fixed)}`);
    console.log(`\n## ${model}: neznámá slova (${words.length})\n${words.join(", ")}`);
  }
}

console.log("\nmodel   | texty | znaky  | typografie | z toho jen nbsp | jiná typo | neznámá slova | (jiná typo + slova) / 1000 znaků");
console.log("--------|-------|--------|------------|-----------------|-----------|---------------|-------------------------------");
for (const r of rows) {
  const other = r.typo - r.nbsp;
  const per = (((other + r.spell) / r.chars) * 1000).toFixed(2);
  console.log(`${r.model.padEnd(7)} | ${String(r.strings).padStart(5)} | ${String(r.chars).padStart(6)} | ${String(r.typo).padStart(10)} | ${String(r.nbsp).padStart(15)} | ${String(other).padStart(9)} | ${String(r.spell).padStart(13)} | ${per.padStart(29)}`);
}
if (args.has("--strict") && total > 0) process.exit(1);
