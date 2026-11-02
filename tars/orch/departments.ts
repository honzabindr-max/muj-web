// Departments v0 (§2): Copy a kreativa (GPT creates, Claude checks → Notion DRAFT) and
// Vývoj (AI Chain creates → GPT review + deterministic checks → PR draft).
// Creator and checker are ALWAYS from different model families; the orchestrator asserts it.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { AdapterResult, AiChain, TextAdapter } from "./adapters";
import type { NotionClient } from "./notion";
import { scanSecrets } from "./secret-scan";
import type { Store } from "./store";
import type { ModelFamily, Order, OrderBrief, Verdict } from "./types";

export interface StepOutcome {
  ok: boolean;
  limit?: boolean;
  error?: string;
  model?: string;
  duration_ms?: number;
}

export interface CheckOutcome extends StepOutcome {
  verdict?: Verdict;
  issues?: string[];
  /** true when deterministic checks failed and no model was called. */
  deterministic?: boolean;
}

export interface DeliverOutcome extends StepOutcome {
  url?: string;
}

export interface DeptContext {
  store: Store;
  notion: NotionClient;
  draftParentId: string;
  repoRoot: string;
}

export interface DepartmentRunner {
  name: string;
  creatorFamily: ModelFamily;
  checkerFamily: ModelFamily;
  creatorModel(): string;
  checkerModel(): string;
  create(order: Order, ctx: DeptContext): Promise<StepOutcome & { draft_file?: string; meta?: Record<string, string> }>;
  check(order: Order, ctx: DeptContext): Promise<CheckOutcome>;
  revise(order: Order, ctx: DeptContext): Promise<StepOutcome & { draft_file?: string }>;
  deliver(order: Order, ctx: DeptContext): Promise<DeliverOutcome>;
  /** Department-level rule: does delivery always need the owner (e.g. PR into main)? */
  alwaysOwner: boolean;
}

export function briefMarkdown(b: OrderBrief): string {
  return [
    `# ZAKÁZKA: ${b.title}`,
    `Milník HANDOFF: ${b.milestone}`,
    `Proč teď: ${b.why}`,
    "",
    "## Cíl",
    b.goal,
    "",
    "## Vstupy (fakta z HANDOFF a kufříku)",
    ...b.inputs.map((x) => `- ${x}`),
    "",
    "## Akceptační kritéria",
    ...b.acceptance.map((x) => `- ${x}`),
    "",
    "## Rozhodnutí vyhrazená Sponzorovi (NEROZHODOVAT, jen označit)",
    ...(b.owner_decisions.length ? b.owner_decisions.map((x) => `- ${x}`) : ["- žádná"]),
  ].join("\n");
}

const VERDICT_FORMAT = `Vrať POUZE JSON v bloku \`\`\`json:
{"verdict": "PASS"|"FIX"|"BLOCK", "issues": ["konkrétní, opravitelný nedostatek s odkazem na kritérium", "..."]}
PASS = splňuje všechna akceptační kritéria. FIX = opravitelné nedostatky (vyjmenuj je). BLOCK = zakázka nejde splnit bez vlastníka nebo by porušila zákaz (zamčený kontrakt, rozhodnutí Sponzora, tajemství).`;

export function parseVerdict(text: string): { verdict: Verdict; issues: string[] } | undefined {
  const m = /```json\s*([\s\S]*?)```/.exec(text) ?? /(\{[\s\S]*"verdict"[\s\S]*\})/.exec(text);
  if (!m) return undefined;
  try {
    const j = JSON.parse(m[1]) as { verdict?: string; issues?: unknown };
    const v = j.verdict;
    if (v !== "PASS" && v !== "FIX" && v !== "BLOCK") return undefined;
    const issues = Array.isArray(j.issues) ? j.issues.filter((x): x is string => typeof x === "string") : [];
    if (v !== "PASS" && issues.length === 0) return undefined;
    return { verdict: v, issues };
  } catch {
    return undefined;
  }
}

function fromAdapter(r: AdapterResult, model: string): StepOutcome {
  return { ok: r.ok, limit: r.limit, error: r.error, model, duration_ms: r.duration_ms };
}

// ───────────────────────────── Copy a kreativa ─────────────────────────────

export const COPY_MIN_CHARS = 400;

export function copyDeterministicIssues(draft: string): string[] {
  const issues: string[] = [];
  if (draft.trim().length < COPY_MIN_CHARS) issues.push(`text je kratší než ${COPY_MIN_CHARS} znaků`);
  if (!/^#{1,3} /m.test(draft)) issues.push("chybí nadpisy sekcí (Markdown #)");
  const s = scanSecrets(draft);
  if (!s.clean) issues.push(`secret-scan: nalezen vzor ${s.kinds.join(", ")} — odstranit`);
  return issues;
}

export class CopyDepartment implements DepartmentRunner {
  name = "Copy a kreativa";
  alwaysOwner = false;
  creatorFamily: ModelFamily;
  checkerFamily: ModelFamily;
  constructor(private creator: TextAdapter, private checker: TextAdapter) {
    this.creatorFamily = creator.family;
    this.checkerFamily = checker.family;
  }
  creatorModel() {
    return `${this.creator.name} (${this.creator.model})`;
  }
  checkerModel() {
    return `${this.checker.name} (${this.checker.model})`;
  }

  private creatorPrompt(b: OrderBrief, extra = ""): string {
    return `Jsi copywriter oddělení "Copy a kreativa" projektu MEZI VÁMI (prémiový vztahový report, čeština).
Napiš DRAFT podle zakázky níže. Tón: tichý, sebejistý, elegantní zdrženlivost, žádné AI buzzwords, žádný hype.
Pravidla:
- Pracuješ jen s fakty v zakázce. Nic si nedomýšlej; chybějící fakt označ "UNKNOWN".
- Rozhodnutí vyhrazená Sponzorovi (cena, značka/název, platby, právo, LOCK) NEROZHODUJ. Kde je potřeba, nabídni varianty a označ "ROZHODNE SPONZOR".
- Pracovní cena 1 990 Kč není launch cena; nepiš ji jako finální.
- Žádná tajemství, žádné osobní údaje.
- Výstup = jeden Markdown dokument s nadpisy (#, ##). Na konci sekce "## Kontrola kritérií" — u každého akceptačního kritéria jedna věta, jak je splněno.
- Nečti ani neměň soubory, nespouštěj příkazy. Vrať jen dokument.

${briefMarkdown(b)}
${extra}`;
  }

  async create(order: Order, ctx: DeptContext) {
    const r = await this.creator.run(this.creatorPrompt(order.brief!), { cwd: ctx.store.orderDir(order.id) });
    if (!r.ok) return fromAdapter(r, this.creatorModel());
    const name = "draft-v0.md";
    ctx.store.writeFile(order.id, name, r.text);
    return { ...fromAdapter(r, this.creatorModel()), draft_file: name };
  }

  async check(order: Order, ctx: DeptContext): Promise<CheckOutcome> {
    const draft = ctx.store.readFile(order.id, order.draft_file!);
    const det = copyDeterministicIssues(draft);
    if (det.length) return { ok: true, verdict: "FIX", issues: det, deterministic: true, model: "deterministic" };
    const prompt = `Jsi KONTROLOR oddělení "Copy a kreativa" (jiná rodina modelů než tvůrce). Netvoříš, jen hodnotíš.
Posuď DRAFT proti zakázce a jejím akceptačním kritériím. Hlídej zvlášť:
- nedomyšlená fakta (vše musí vycházet ze vstupů zakázky, jinak UNKNOWN),
- zda draft NEROZHODUJE rozhodnutí vyhrazená Sponzorovi (cena, značka/název, platby, právo, LOCK) — smí jen nabízet varianty,
- tón značky (tichý, sebejistý, bez AI buzzwords), čeština.
Nepoužívej žádné nástroje.

${briefMarkdown(order.brief!)}

<<<DRAFT
${draft}
DRAFT>>>

${VERDICT_FORMAT}`;
    const r = await this.checker.run(prompt, { cwd: ctx.store.orderDir(order.id) });
    if (!r.ok) return fromAdapter(r, this.checkerModel());
    ctx.store.writeFile(order.id, `check-r${order.fix_rounds}.md`, r.text);
    const v = parseVerdict(r.text);
    if (!v) return { ok: false, error: "checker verdict unparseable", model: this.checkerModel(), duration_ms: r.duration_ms };
    return { ...fromAdapter(r, this.checkerModel()), verdict: v.verdict, issues: v.issues };
  }

  async revise(order: Order, ctx: DeptContext) {
    const draft = ctx.store.readFile(order.id, order.draft_file!);
    const extra = `\nPŘEDCHOZÍ DRAFT (oprav ho, nepiš od nuly, pokud to není nutné):\n<<<DRAFT\n${draft}\nDRAFT>>>\n\nPŘIPOMÍNKY KONTROLORA (všechny vypořádej):\n${(order.last_issues ?? []).map((x) => `- ${x}`).join("\n")}`;
    const r = await this.creator.run(this.creatorPrompt(order.brief!, extra), { cwd: ctx.store.orderDir(order.id) });
    if (!r.ok) return fromAdapter(r, this.creatorModel());
    const name = `draft-v${order.fix_rounds}.md`;
    ctx.store.writeFile(order.id, name, r.text);
    return { ...fromAdapter(r, this.creatorModel()), draft_file: name };
  }

  async deliver(order: Order, ctx: DeptContext): Promise<DeliverOutcome> {
    const draft = ctx.store.readFile(order.id, order.draft_file!);
    const header = [
      `**DRAFT — není schváleno.** Vytvořeno orchestrátorem TARS-ORCH v0, zakázka \`${order.id}\`, milník ${order.brief!.milestone}.`,
      `Tvůrce: ${this.creatorModel()} · Kontrolor: ${this.checkerModel()} · Kol oprav: ${order.fix_rounds}.`,
      `Rozhodnutí vyhrazená Sponzorovi: ${order.brief!.owner_decisions.join("; ") || "žádná"}.`,
      "",
      "---",
      "",
    ].join("\n");
    const page = await ctx.notion.createPage(ctx.draftParentId, `DRAFT — ${order.brief!.title} (${order.id})`, header + draft);
    return { ok: true, url: page.url, model: "notion" };
  }
}

// ───────────────────────────────── Vývoj ─────────────────────────────────

function git(cwd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 120_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export class DevDepartment implements DepartmentRunner {
  name = "Vývoj";
  /** Output is a PR into main → merge is the owner's (DR-022). */
  alwaysOwner = true;
  creatorFamily: ModelFamily;
  checkerFamily: ModelFamily;
  constructor(private chain: AiChain, private reviewer: TextAdapter) {
    this.creatorFamily = chain.family;
    this.checkerFamily = reviewer.family;
  }
  creatorModel() {
    return `${this.chain.name} (${this.chain.model})`;
  }
  checkerModel() {
    return `${this.reviewer.name} (${this.reviewer.model}) + deterministic`;
  }

  private worktree(order: Order, ctx: DeptContext): { wt: string; branch: string } {
    return { wt: path.join(ctx.store.orderDir(order.id), "wt"), branch: `tars/${order.id}` };
  }

  private async runChain(order: Order, ctx: DeptContext, extra: string) {
    const { wt } = this.worktree(order, ctx);
    const dir = ctx.store.orderDir(order.id);
    const zadani = ctx.store.writeFile(
      order.id,
      `zadani-r${order.fix_rounds}.md`,
      `${briefMarkdown(order.brief!)}\n\n## Zákazy\n- Žádný merge, deploy, DB zápis, dispatch workflow, nákup ani placené API.\n- Neměnit zamčené kontrakty MEZI VÁMI.\n- Neprovádět commit ani push (to dělá orchestrátor).\n${extra}`,
    );
    const r = await this.chain.run(zadani, wt, dir);
    if (r.ok) {
      git(wt, ["add", "-A"]);
      git(wt, ["commit", "-q", "-m", `feat(tars): ${order.brief!.title} (${order.id}, r${order.fix_rounds})`]);
    }
    return { ...fromAdapter(r, this.creatorModel()), draft_file: "wt" };
  }

  async create(order: Order, ctx: DeptContext) {
    const { wt, branch } = this.worktree(order, ctx);
    if (!fs.existsSync(wt)) {
      git(ctx.repoRoot, ["fetch", "-q", "origin", "main"]);
      const r = git(ctx.repoRoot, ["worktree", "add", "-q", "-b", branch, wt, "origin/main"]);
      if (!r.ok) return { ok: false, error: `worktree: ${r.out.slice(0, 200)}` };
    }
    const out = await this.runChain(order, ctx, "");
    return { ...out, meta: { branch, worktree: wt } };
  }

  async check(order: Order, ctx: DeptContext): Promise<CheckOutcome> {
    const { wt } = this.worktree(order, ctx);
    const diff = git(wt, ["diff", "origin/main...HEAD"]).out;
    const issues: string[] = [];
    if (!diff.trim()) issues.push("žádná změna oproti origin/main");
    const s = scanSecrets(diff);
    if (!s.clean) issues.push(`secret-scan diffu: ${s.kinds.join(", ")}`);
    const ws = git(wt, ["diff", "--check", "origin/main...HEAD"]);
    if (!ws.ok) issues.push("git diff --check: whitespace chyby");
    if (issues.length) return { ok: true, verdict: "FIX", issues, deterministic: true, model: "deterministic" };
    const prompt = `Jsi KONTROLOR (code review) oddělení Vývoj — jiná rodina modelů než tvůrce. Neměň soubory.
Posuď diff proti zakázce a jejím akceptačním kritériím: správnost, bezpečnost, rozsah (nic navíc), zákazy (merge/deploy/DB/secrets).

${briefMarkdown(order.brief!)}

<<<DIFF
${diff.slice(0, 150_000)}
DIFF>>>

${VERDICT_FORMAT}`;
    const r = await this.reviewer.run(prompt, { cwd: wt });
    if (!r.ok) return fromAdapter(r, this.checkerModel());
    ctx.store.writeFile(order.id, `check-r${order.fix_rounds}.md`, r.text);
    const v = parseVerdict(r.text);
    if (!v) return { ok: false, error: "reviewer verdict unparseable", model: this.checkerModel() };
    return { ...fromAdapter(r, this.checkerModel()), verdict: v.verdict, issues: v.issues };
  }

  async revise(order: Order, ctx: DeptContext) {
    return this.runChain(order, ctx, `\n## Připomínky kontrolora (vypořádat)\n${(order.last_issues ?? []).map((x) => `- ${x}`).join("\n")}`);
  }

  async deliver(order: Order, ctx: DeptContext): Promise<DeliverOutcome> {
    const { wt, branch } = this.worktree(order, ctx);
    const push = git(wt, ["push", "-q", "-u", "origin", branch]);
    if (!push.ok) return { ok: false, error: "git push failed" };
    const body = `${briefMarkdown(order.brief!)}\n\n---\nVytvořeno TARS-ORCH v0, zakázka \`${order.id}\`. Tvůrce: ${this.creatorModel()}. Kontrolor: ${this.checkerModel()}. Kol oprav: ${order.fix_rounds}.\n**DRAFT — NEMERGOVAT bez GO vlastníka.**\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
    const r = spawnSync("gh", ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", `feat(tars): ${order.brief!.title}`, "--body", body], {
      cwd: wt,
      encoding: "utf8",
    });
    const url = /https:\/\/github\.com\/\S+\/pull\/\d+/.exec(r.stdout ?? "")?.[0];
    return url ? { ok: true, url, model: "gh" } : { ok: false, error: "gh pr create failed" };
  }
}
