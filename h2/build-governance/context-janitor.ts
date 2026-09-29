/**
 * Deterministický context Janitor — žádné LLM volání. Kontroluje bootstrap
 * soubory (CLAUDE.md, AGENTS.md, docs/h2/BUILD-STATUS.md, DECISIONS.md),
 * ze kterých si nová session skládá autoritu a stav. Běží v CI
 * (.github/workflows/context-janitor.yml) na PR i push na main.
 *
 * FAIL: rozbitý markdown odkaz (soubor/anchor neexistuje) v bootstrap
 * souboru; CLAUDE.md > 120 řádků; docs/h2/BUILD-STATUS.md > 200 řádků.
 * WARNING: výskyt „supabase" v bootstrap souboru; repo jméno v bootstrap
 * souboru neodpovídá `honzabindr-max/muj-web`; víc než jeden bootstrap
 * soubor si nárokuje autoritu pro stejnou kategorii z Authority map.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface JanitorFinding {
  file: string;
  message: string;
}

export interface JanitorReport {
  failures: JanitorFinding[];
  warnings: JanitorFinding[];
}

export const BOOTSTRAP_FILES: readonly string[] = [
  "CLAUDE.md",
  "AGENTS.md",
  "docs/h2/BUILD-STATUS.md",
  "docs/h2/DECISIONS.md",
];

export const SIZE_LIMITS: Readonly<Record<string, number>> = {
  "CLAUDE.md": 120,
  "docs/h2/BUILD-STATUS.md": 200,
};

const CANONICAL_REPO = "honzabindr-max/muj-web";

/** Kategorie z Authority map (docs/h2/DECISIONS.md) — klíčová slova pro
 * detekci, kdy víc než jeden bootstrap soubor si nárokuje autoritu pro
 * stejnou věc. Heuristika: řádek zmiňuje kategorii I autoritativní frázi. */
const AUTHORITY_CATEGORIES: ReadonlyArray<{ name: string; keywords: RegExp }> = [
  { name: "invarianty I1–I8 / Locked Architecture", keywords: /invariant|I1[–-]I8|locked architecture/i },
  { name: "runtime schéma", keywords: /migrac|schema/i },
  { name: "certifikace promptů", keywords: /prompt_version|prompt_test_run/i },
  { name: "profil", keywords: /\bprofil/i },
  { name: "bootstrap pořadí čtení", keywords: /\bbootstrap\b/i },
];
const AUTHORITY_CLAIM = /(autoritativn|je autorita|zdroj pravdy)/i;

function githubSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .trim()
    .replace(/[^\p{L}\p{N}\- ]+/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingSlugs(content: string): Set<string> {
  const slugs = new Set<string>();
  for (const line of content.split("\n")) {
    const match = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (match) slugs.add(githubSlug(match[1]));
  }
  return slugs;
}

const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function checkBrokenLinks(repoRoot: string, relFile: string, content: string, failures: JanitorFinding[]): void {
  const fileDir = path.dirname(path.join(repoRoot, relFile));
  let match: RegExpExecArray | null;
  MD_LINK_RE.lastIndex = 0;
  while ((match = MD_LINK_RE.exec(content))) {
    const target = match[1].trim();
    if (/^(https?:|mailto:|tel:)/i.test(target)) continue;

    const [filePart, anchorPart] = target.split("#");
    const targetAbsPath = filePart ? path.resolve(fileDir, filePart) : path.join(repoRoot, relFile);

    let targetContent: string;
    try {
      targetContent = readFileSync(targetAbsPath, "utf8");
    } catch {
      failures.push({ file: relFile, message: `rozbitý odkaz na soubor: ${target}` });
      continue;
    }

    if (anchorPart) {
      const slugs = headingSlugs(targetContent);
      if (!slugs.has(anchorPart.toLowerCase())) {
        failures.push({ file: relFile, message: `rozbitá kotva #${anchorPart} v odkazu: ${target}` });
      }
    }
  }
}

function checkSize(relFile: string, content: string, failures: JanitorFinding[]): void {
  const limit = SIZE_LIMITS[relFile];
  if (!limit) return;
  const lineCount = content.split("\n").length;
  if (lineCount > limit) {
    failures.push({ file: relFile, message: `${lineCount} řádků přesahuje limit ${limit}` });
  }
}

function checkSupabaseMention(relFile: string, content: string, warnings: JanitorFinding[]): void {
  if (/supabase/i.test(content)) {
    warnings.push({ file: relFile, message: `obsahuje zmínku "supabase" — zkontroluj, jestli patří do H2 bootstrapu` });
  }
}

function checkRepoName(relFile: string, content: string, warnings: JanitorFinding[]): void {
  const re = /honzabindr-max\/([\w.-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const repo = `honzabindr-max/${match[1]}`;
    if (repo !== CANONICAL_REPO) {
      warnings.push({ file: relFile, message: `neexistující/starý název repa "${repo}", kanonický je ${CANONICAL_REPO}` });
    }
  }
}

function checkDuplicateAuthorityClaims(files: ReadonlyMap<string, string>, warnings: JanitorFinding[]): void {
  for (const category of AUTHORITY_CATEGORIES) {
    const claimants: string[] = [];
    for (const [relFile, content] of files) {
      for (const line of content.split("\n")) {
        if (category.keywords.test(line) && AUTHORITY_CLAIM.test(line)) {
          claimants.push(relFile);
          break;
        }
      }
    }
    const distinct = Array.from(new Set(claimants));
    if (distinct.length > 1) {
      warnings.push({
        file: distinct.join(", "),
        message: `víc bootstrap souborů si nárokuje autoritu pro "${category.name}"`,
      });
    }
  }
}

export function runContextJanitor(repoRoot: string): JanitorReport {
  const failures: JanitorFinding[] = [];
  const warnings: JanitorFinding[] = [];
  const contents = new Map<string, string>();

  for (const relFile of BOOTSTRAP_FILES) {
    let content: string;
    try {
      content = readFileSync(path.join(repoRoot, relFile), "utf8");
    } catch {
      failures.push({ file: relFile, message: "bootstrap soubor neexistuje" });
      continue;
    }
    contents.set(relFile, content);

    checkBrokenLinks(repoRoot, relFile, content, failures);
    checkSize(relFile, content, failures);
    checkSupabaseMention(relFile, content, warnings);
    checkRepoName(relFile, content, warnings);
  }

  checkDuplicateAuthorityClaims(contents, warnings);

  return { failures, warnings };
}
