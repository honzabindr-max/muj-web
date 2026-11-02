// Specialist definitions (TARS-ORCH-001 §2a, DR-029 krok 2). Single source of truth: .claude/agents/**/*.md.
// Claude roles are Claude Code subagents (`name`, `description`, `model`, `tools` + TARS fields that
// Claude Code ignores). Roles done by GPT (codex) are NOT subagents: no `name` (so Claude Code reads the
// file as documentation only), they carry `role`. No definition → the specialist must not run.
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
  /** What actually runs the role (`executor`, else `model`) — display only. */
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

const FM = /^---\n([\s\S]*?)\n---\n/;

function frontmatter(text: string): Record<string, string> | undefined {
  const m = FM.exec(text);
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Definition text without frontmatter. */
export function stripFrontmatter(text: string): string {
  return text.replace(FM, "");
}

/** All definition files below `dir` (recursive); README and `_*` files are not definitions. */
export function listAgentFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listAgentFiles(p));
    else if (e.name.endsWith(".md") && e.name !== "README.md" && !e.name.startsWith("_")) out.push(p);
  }
  return out.sort();
}

/** Validates one definition; never throws. */
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
  const fam = (v: string | undefined) => (v === "claude" || v === "gpt" ? v : undefined);
  const kind = fm.kind;
  if (kind !== "supervisor" && kind !== "creator" && kind !== "checker")
    problems.push("kind musí být supervisor|creator|checker");
  const family = fam(fm.family);
  if (!family) problems.push("family musí být claude|gpt");
  // Claude roles are Claude Code subagents; GPT roles must never be loadable as one (no `name`).
  const role = fm.name ?? fm.role;
  if (family === "claude") {
    if (!fm.name) problems.push("role Claude musí být subagent (chybí name)");
    if (!fm.description) problems.push("chybí description (kdy roli použít)");
    if (fm.model !== "opus" && fm.model !== "sonnet") problems.push("model subagenta musí být opus|sonnet");
    if (!fm.tools) problems.push("chybí tools");
  }
  if (family === "gpt" && fm.name) problems.push("role GPT nesmí být Claude subagent (name smí být jen u rodiny claude)");
  const rung = Number(fm.rung);
  if (![1, 2, 3, 4].includes(rung)) problems.push("rung musí být 1–4");
  const checkerFamily = fm.checker_family === "none" ? "none" : fam(fm.checker_family);
  if (!checkerFamily) problems.push("checker_family musí být claude|gpt|none");
  // §2a bod 6 applies to every role: a checker of the other model family.
  if (checkerFamily === "none") problems.push("karta musí mít kontrolora (§2a bod 6)");
  if (checkerFamily && checkerFamily === family)
    problems.push("kontrolor je stejné rodiny jako tvůrce (tvůrce ≠ kontrolor)");
  if (kind === "creator" && fm.department !== "copy" && fm.department !== "dev" && fm.department !== "vizual")
    problems.push("tvůrce musí mít department copy|dev|vizual");
  const maxFix = Number(fm.max_fix_rounds);
  if (!Number.isInteger(maxFix) || maxFix < 0 || maxFix > 3) problems.push("max_fix_rounds musí být 0–3");
  const executor = fm.executor ?? fm.model;
  if (!role || !fm.title || !executor || !fm.adapter) problems.push("chybí role/title/model/adapter");
  const sources = parseSourceKeys(fm.sources);
  for (const k of sources) if (!SOURCE_REGISTRY[k]) problems.push(`neznámý zdroj "${k}"`);
  if (kind !== "checker" && !sources.includes("handoff")) problems.push("povinné zdroje musí obsahovat handoff");
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    problems: [],
    card: {
      role: role!,
      kind: kind as Card["kind"],
      department: fm.department as Department | undefined,
      title: fm.title,
      model: executor!,
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
  /** `dir` = .claude/agents (searched recursively). */
  constructor(public readonly dir: string) {}

  private find(role: string): string | undefined {
    return listAgentFiles(this.dir).find((f) => {
      const fm = frontmatter(fs.readFileSync(f, "utf8"));
      return fm && (fm.name ?? fm.role) === role;
    });
  }

  check(role: string): CardCheck {
    const file = this.find(role);
    if (!file) return { ok: false, problems: [`definice ${role} v ${this.dir} neexistuje`] };
    return validateCardText(fs.readFileSync(file, "utf8"), file);
  }

  /** Creator definition for a department (exactly one per department). */
  creatorFor(dept: Department): CardCheck {
    if (!fs.existsSync(this.dir)) return { ok: false, problems: [`adresář definic ${this.dir} neexistuje`] };
    const hits = listAgentFiles(this.dir)
      .map((f) => validateCardText(fs.readFileSync(f, "utf8"), f))
      .filter((c) => c.card?.kind === "creator" && c.card.department === dept);
    if (hits.length !== 1)
      return { ok: false, problems: [`oddělení ${dept}: očekávána 1 karta tvůrce, nalezeno ${hits.length}`] };
    return hits[0];
  }

  /** Definition body for prompts (frontmatter stripped; shared rules are part of every body). */
  text(role: string): string {
    return stripFrontmatter(fs.readFileSync(this.find(role)!, "utf8"));
  }
}
