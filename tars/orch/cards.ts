// Specialist cards (TARS-ORCH-001 §2a). No card → the specialist must not run.
// A card is tars/orch/specialists/<mission>/<role>.md with a small frontmatter and the 7 sections.
import fs from "node:fs";
import path from "node:path";

import { parseSourceKeys, SOURCE_REGISTRY } from "./sources";
import type { Department, ModelFamily } from "./types";

export const REQUIRED_SECTIONS = [
  "## 1. Mise role a model",
  "## 2. Kanonické vstupy",
  "## 3. Zamčené kontrakty a zákazy",
  "## 4. Výstup",
  "## 5. Akceptační kritéria",
  "## 6. Kontrolor",
  "## 7. Eskalace na vlastníka",
  "## Příčka §2b",
] as const;

export type Rung = 1 | 2 | 3 | 4;

export interface Card {
  role: string;
  kind: "supervisor" | "creator" | "checker";
  department?: Department;
  title: string;
  model: string;
  family: ModelFamily;
  adapter: string;
  rung: Rung;
  checker_family: ModelFamily | "none";
  max_fix_rounds: number;
  /** Required canonical sources (keys of SOURCE_REGISTRY), §2a bod 2. */
  sources: string[];
  file: string;
}

export interface CardCheck {
  ok: boolean;
  card?: Card;
  problems: string[];
}

function frontmatter(text: string): Record<string, string> | undefined {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

/** Validates one card file; never throws. */
export function validateCardText(text: string, file: string): CardCheck {
  const problems: string[] = [];
  const fm = frontmatter(text);
  if (!fm) return { ok: false, problems: ["chybí frontmatter"] };
  for (const s of REQUIRED_SECTIONS) {
    const i = text.indexOf(`\n${s}`);
    if (i < 0) {
      problems.push(`chybí sekce "${s}"`);
      continue;
    }
    const rest = text.slice(i + s.length + 1);
    const body = rest.split(/\n## /)[0].trim();
    if (body.length < 20) problems.push(`sekce "${s}" je prázdná`);
  }
  const fam = (v: string | undefined) =>
    v === "claude" || v === "gpt" ? v : undefined;
  const kind = fm.kind;
  if (kind !== "supervisor" && kind !== "creator" && kind !== "checker")
    problems.push("kind musí být supervisor|creator|checker");
  const family = fam(fm.family);
  if (!family) problems.push("family musí být claude|gpt");
  const rung = Number(fm.rung);
  if (![1, 2, 3, 4].includes(rung)) problems.push("rung musí být 1–4");
  const checkerFamily =
    fm.checker_family === "none" ? "none" : fam(fm.checker_family);
  if (!checkerFamily) problems.push("checker_family musí být claude|gpt|none");
  // §2a bod 6 applies to every role: a checker of the other model family.
  if (checkerFamily === "none")
    problems.push("karta musí mít kontrolora (§2a bod 6)");
  if (checkerFamily && checkerFamily === family)
    problems.push(
      "kontrolor je stejné rodiny jako tvůrce (tvůrce ≠ kontrolor)",
    );
  if (kind === "creator") {
    if (
      fm.department !== "copy" &&
      fm.department !== "dev" &&
      fm.department !== "vizual"
    )
      problems.push("tvůrce musí mít department copy|dev|vizual");
  }
  const maxFix = Number(fm.max_fix_rounds);
  if (!Number.isInteger(maxFix) || maxFix < 0 || maxFix > 3)
    problems.push("max_fix_rounds musí být 0–3");
  if (!fm.role || !fm.title || !fm.model || !fm.adapter)
    problems.push("chybí role/title/model/adapter");
  const sources = parseSourceKeys(fm.sources);
  for (const k of sources) if (!SOURCE_REGISTRY[k]) problems.push(`neznámý zdroj "${k}"`);
  if (kind !== "checker" && !sources.includes("handoff")) problems.push("povinné zdroje musí obsahovat handoff");
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    problems: [],
    card: {
      role: fm.role,
      kind: kind as Card["kind"],
      department: fm.department as Department | undefined,
      title: fm.title,
      model: fm.model,
      family: family!,
      adapter: fm.adapter,
      rung: rung as Rung,
      checker_family: checkerFamily!,
      max_fix_rounds: maxFix,
      sources,
      file,
    },
  };
}

export class CardRegistry {
  constructor(public readonly dir: string) {}

  check(role: string): CardCheck {
    const file = path.join(this.dir, `${role}.md`);
    if (!fs.existsSync(file))
      return { ok: false, problems: [`karta ${role}.md neexistuje`] };
    return validateCardText(fs.readFileSync(file, "utf8"), file);
  }

  /** Creator card for a department (exactly one creator card per department). */
  creatorFor(dept: Department): CardCheck {
    if (!fs.existsSync(this.dir))
      return { ok: false, problems: [`adresář karet ${this.dir} neexistuje`] };
    const hits = fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .map((f) =>
        validateCardText(
          fs.readFileSync(path.join(this.dir, f), "utf8"),
          path.join(this.dir, f),
        ),
      )
      .filter((c) => c.card?.kind === "creator" && c.card.department === dept);
    if (hits.length !== 1)
      return {
        ok: false,
        problems: [
          `oddělení ${dept}: očekávána 1 karta tvůrce, nalezeno ${hits.length}`,
        ],
      };
    return hits[0];
  }

  /** Raw card text for prompts (frontmatter stripped). */
  /** Card body plus `_spolecne.md` when the card refers to it (shared sources and bans, „platí celé“). */
  text(role: string): string {
    const body = fs
      .readFileSync(path.join(this.dir, `${role}.md`), "utf8")
      .replace(/^---\n[\s\S]*?\n---\n/, "");
    const shared = path.join(this.dir, "_spolecne.md");
    if (!body.includes("_spolecne.md") || !fs.existsSync(shared)) return body;
    return `${body}\n\n<<<_spolecne.md\n${fs.readFileSync(shared, "utf8")}\n_spolecne.md>>>\n`;
  }
}
