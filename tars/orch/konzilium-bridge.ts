// Most mezi uloženým workflow /konzilium (.claude/workflows/konzilium.js, DR-029 krok 3) a deterministickým kódem.
// Workflow drží pořadí, paralelismus a role (advokát, rada odborníků, zapracování, kontrola, soudce). Skript workflow
// ale nemá přístup k souborům ani shellu, takže vše, co sahá na disk, na GPT (`codex exec --output-schema`, krok 1)
// a na Notion (`claude -p` + Notion MCP, stejný transport jako panel.ts/notion.ts), jde přes tento CLI.
// Pravidla převzatá z Konzilia PR #82: každý výstup modelu validuje kód, soudce necituje nic mimo drafty,
// soudce je jiné rodiny než tvůrce, rada je mix Claude + GPT. Rodina, kterou nejde ověřit = „Nelze ověřit“, nikdy PASS.
//
// Použití (volají ho jen agenti workflow, jeden příkaz = jeden řádek JSON na stdout):
//   npx tsx tars/orch/konzilium-bridge.ts prep --out <dir> --sha <fnv> --in <soubor>   (soubor: args workflow jako JSON)
//   npx tsx tars/orch/konzilium-bridge.ts gpt --out <dir> --role <r> --schema <s> --file <f> --sha <fnv> --in <soubor>   (soubor: prompt)
// Vstupní soubor zapisuje transportní agent nástrojem Write do <dir>/konzilium/.in-<fnv>.txt (Bash odmítá heredoc
// se složenými závorkami a uvozovkami); most ho přijme jen se shodným součtem a po přečtení smaže. Bez --in čte stdin.
//   npx tsx tars/orch/konzilium-bridge.ts council --out <dir>
//   npx tsx tars/orch/konzilium-bridge.ts review --out <dir>
//   npx tsx tars/orch/konzilium-bridge.ts judge-check --out <dir> --attempt <n>
//   npx tsx tars/orch/konzilium-bridge.ts assemble --out <dir> --attempt <n>
//   npx tsx tars/orch/konzilium-bridge.ts panel --out <dir>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ClaudeCli, CodexCli } from "./adapters";
import { briefMarkdown, copyDeterministicIssues } from "./departments";
import { makeNotion } from "./notion";
import { McpPanelSink, type PanelRow, type PanelSink } from "./panel";
import { scanSecrets } from "./secret-scan";
import { reservedDecisionHits } from "./supervisor";
import type { ModelFamily, OrderBrief } from "./types";
import { parseStructuredVerdict, REVIEW_SCHEMA, REVIEW_VERDICTS, unverifiable, type JsonSchema } from "./verdict";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");
export const KONZILIUM_CARDS_DIR = path.join(REPO_ROOT, ".claude/agents/konzilium");
export const KONZILIUM_DIR = "konzilium";

export const HONEST_NOTE =
  "Poctivě: nikdo předem neví, který text přinese nejvíc nákupů. Konzilium dává nejlepší odborný odhad z různých rodin modelů, ne důkaz. Konverzi ověří až test se skutečnými návštěvníky (T5 5.3).";

export const EXPERT_ROLES = ["prodejni-psycholog", "ux-ui", "brand-strateg", "hlas-zakaznika", "eticky-strazce"] as const;
export const ALL_ROLES = ["advokat", ...EXPERT_ROLES, "soudce"] as const;

/** Text result of the whole run as seen by the owner / caller. Never "PASS" when families are unverifiable. */
export type RunStatus = "OK" | "WAITING_OWNER" | "NELZE_OVERIT" | "FAILED" | "LIMIT";

// ───────────────────────────── integrity (shared with the workflow script) ─────────────────────────────

/**
 * FNV-1a 32 bit over UTF-16 code units, hex. The workflow script has the same function: a prompt or args
 * payload that an agent copies into a heredoc must arrive unchanged, otherwise the bridge refuses it.
 * Integrity check against paraphrase/truncation, not a cryptographic signature.
 */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Payload normalisation on both sides: trailing whitespace (heredoc newline) is not part of the payload. */
export function payload(s: string): string {
  return s.replace(/\s+$/, "");
}

// ───────────────────────────── families ─────────────────────────────

/** Family of a model description ("claude -p --model opus", "codex exec (gpt-6.1-sol)"); undefined = not provable. */
export function familyOf(model: string | undefined): ModelFamily | undefined {
  if (!model) return undefined;
  const claude = /\b(claude|opus|sonnet|haiku|fable)\b/i.test(model);
  const gpt = /\b(gpt[\w.-]*|codex|o[1-9][\w.-]*)\b/i.test(model);
  if (claude === gpt) return undefined;
  return claude ? "claude" : "gpt";
}

/** The model codex reported is an OpenAI model (codex can be pointed at other providers). */
export function isGptModel(model: string | undefined): boolean {
  // "codex-default" = CodexCli did not see the model in codex output → not proven.
  return Boolean(model && /^(gpt-|o[1-9]|codex-mini)/i.test(model.trim()));
}

export interface Sidecar {
  family: ModelFamily;
  model: string;
  verified: boolean;
  role: string;
  prompt_sha: string;
}

function sidecarPath(file: string): string {
  return `${file}.meta.json`;
}

function readSidecar(file: string): Sidecar | undefined {
  const f = sidecarPath(file);
  if (!fs.existsSync(f)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as Sidecar;
  } catch {
    return undefined;
  }
}

/**
 * Who produced `file`: GPT = sidecar written by `gpt` (codex reported an OpenAI model), Claude = written by a
 * workflow subagent (no sidecar). Returns undefined when the evidence does not match the expected family.
 */
export function provenFamily(file: string, expected: ModelFamily): { family: ModelFamily; model: string } | undefined {
  const sc = readSidecar(file);
  if (expected === "gpt") {
    if (!sc || sc.family !== "gpt" || !sc.verified || !isGptModel(sc.model)) return undefined;
    return { family: "gpt", model: `codex exec (${sc.model})` };
  }
  if (sc) return undefined; // a codex sidecar next to a file the Claude role should have written
  return { family: "claude", model: "workflow /konzilium (Claude Opus)" };
}

// ───────────────────────────── cards ─────────────────────────────

export interface KonziliumCard {
  role: string;
  /** Claude subagent name (agentType in the workflow); undefined for GPT roles. */
  agent?: string;
  konzilium_role: "advocate" | "expert" | "judge";
  title: string;
  family: ModelFamily | "cross";
  sources: string[];
  file: string;
}

const FM = /^---\n([\s\S]*?)\n---\n/;

function frontmatter(text: string): Record<string, string> | undefined {
  const m = FM.exec(text);
  if (!m) return undefined;
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function stripFrontmatter(text: string): string {
  return text.replace(FM, "");
}

/** Loads and validates the 7 Konzilium definitions. Any problem = the Konzilium does not run (§2a). */
export function loadCards(dir = KONZILIUM_CARDS_DIR): { cards: Record<string, KonziliumCard>; problems: string[] } {
  const cards: Record<string, KonziliumCard> = {};
  const problems: string[] = [];
  for (const role of ALL_ROLES) {
    const file = path.join(dir, `${role}.md`);
    if (!fs.existsSync(file)) {
      problems.push(`${role}: definice chybí`);
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    const fm = frontmatter(text);
    if (!fm || fm.role !== role) {
      problems.push(`${role}: frontmatter bez role ${role}`);
      continue;
    }
    const family = fm.family as KonziliumCard["family"];
    const kr = fm.konzilium_role as KonziliumCard["konzilium_role"];
    const expectKr = role === "advokat" ? "advocate" : role === "soudce" ? "judge" : "expert";
    if (kr !== expectKr) problems.push(`${role}: konzilium_role musí být ${expectKr}`);
    if (role === "soudce" ? family !== "cross" : family !== "claude" && family !== "gpt") problems.push(`${role}: neplatná rodina ${family}`);
    // Claude roles (and the Claude variant of the judge) are subagents; GPT roles must not be loadable as one.
    if (family === "gpt" && fm.name) problems.push(`${role}: role GPT nesmí být Claude subagent (name)`);
    if (family !== "gpt") {
      if (fm.name !== `konzilium-${role}`) problems.push(`${role}: name musí být konzilium-${role}`);
      if (fm.model !== "opus") problems.push(`${role}: model subagenta musí být opus (karta PR #82)`);
      if (fm.tools !== "Read, Write") problems.push(`${role}: tools musí být přesně „Read, Write“`);
    }
    if (!/\n## Společné podklady/.test(text)) problems.push(`${role}: chybí sekce Společné podklady`);
    cards[role] = {
      role,
      agent: family !== "gpt" ? fm.name : undefined,
      konzilium_role: kr,
      title: fm.title ?? role,
      family,
      sources: (fm.sources ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      file,
    };
  }
  const fams = new Set(EXPERT_ROLES.map((r) => cards[r]?.family).filter(Boolean));
  if (!problems.length && (!fams.has("claude") || !fams.has("gpt"))) problems.push("rada odborníků musí být rozdělená mezi Claude a GPT");
  if (!problems.length && cards.advokat.family !== "claude") problems.push("advokát je podle PR #82 Claude");
  return { cards, problems };
}

// ───────────────────────────── run.json ─────────────────────────────

export interface RunArgs {
  out_dir: string;
  draft: string;
  creator_family: string;
  creator_model: string;
  creator_role?: string;
  creator_card?: string;
  kind?: "copy" | "prep";
  order?: string;
  brief: OrderBrief;
  sources?: Array<{ key: string; path: string }>;
  draft_url?: string;
  panel?: boolean;
  panel_title?: string;
  archive_parent?: string;
  mission?: string;
}

export interface RunFile {
  order: string;
  kind: "copy" | "prep";
  out: string;
  draft: string;
  draft_rel: string;
  creator: { family: ModelFamily; model: string; role: string };
  judge_family: ModelFamily;
  creator_card: string;
  brief: OrderBrief;
  brief_file: string;
  sources: Array<{ key: string; path: string; ok: boolean }>;
  draft_url?: string;
  panel: boolean;
  panel_title: string;
  archive_parent?: string;
  mission: string;
  now: string;
}

const kdir = (out: string) => path.join(out, KONZILIUM_DIR);
const kfile = (out: string, f: string) => path.join(kdir(out), f);

export function readRun(out: string): RunFile {
  return JSON.parse(fs.readFileSync(kfile(out, "run.json"), "utf8")) as RunFile;
}

function writeAtomic(file: string, text: string): void {
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
}

function isBrief(b: unknown): b is OrderBrief {
  const o = b as Record<string, unknown> | undefined;
  const arr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
  return Boolean(
    o &&
      typeof o.title === "string" &&
      o.title.trim() &&
      typeof o.goal === "string" &&
      typeof o.milestone === "string" &&
      typeof o.why === "string" &&
      arr(o.inputs) &&
      arr(o.acceptance) &&
      arr(o.owner_decisions),
  );
}

export interface PrepResult {
  ok: boolean;
  status: RunStatus;
  error?: string;
  run?: RunFile;
  cards?: Record<string, KonziliumCard>;
  mandatory?: string[];
}

/** Validates the workflow args, family rule and inputs, writes konzilium/run.json + brief.md. */
export function prep(out: string, args: RunArgs, now: string): PrepResult {
  const fail = (status: RunStatus, error: string): PrepResult => ({ ok: false, status, error });
  if (!path.isAbsolute(out)) return fail("FAILED", "out_dir musí být absolutní cesta");
  if (path.resolve(args.out_dir ?? "") !== path.resolve(out)) return fail("FAILED", "--out se neshoduje s args.out_dir");
  if (!fs.existsSync(out)) return fail("FAILED", "out_dir neexistuje");
  const family = args.creator_family;
  if (family !== "claude" && family !== "gpt") return fail("NELZE_OVERIT", "rodinu tvůrce nejde ověřit: creator_family musí být claude|gpt");
  if (familyOf(args.creator_model) !== family)
    return fail("NELZE_OVERIT", `rodinu tvůrce nejde ověřit: model „${args.creator_model ?? ""}“ neodpovídá rodině ${family}`);
  if (!isBrief(args.brief)) return fail("FAILED", "brief musí mít title, milestone, why, goal, inputs[], acceptance[], owner_decisions[]");
  const kind = args.kind ?? "copy";
  if (kind !== "copy" && kind !== "prep") return fail("FAILED", "kind musí být copy|prep");
  const draft = path.resolve(out, args.draft ?? "");
  if (!args.draft || !fs.existsSync(draft)) return fail("FAILED", "draft neexistuje");
  const creatorCard = path.resolve(REPO_ROOT, args.creator_card ?? ".claude/agents/gpt/copy-studio.md");
  if (!fs.existsSync(creatorCard)) return fail("FAILED", "karta tvůrce neexistuje");
  const { cards, problems } = loadCards();
  if (problems.length) return fail("NELZE_OVERIT", `karty konzilia: ${problems.join(" | ")}`);
  fs.mkdirSync(kdir(out), { recursive: true });
  const prev = fs.existsSync(kfile(out, "run.json")) ? readRun(out) : undefined;
  if (prev && prev.creator.family !== family)
    return fail("FAILED", "out_dir už obsahuje Konzilium s tvůrcem jiné rodiny; použij novou složku");
  const order = args.order?.trim() || path.basename(out);
  const sources = (args.sources ?? []).map((s) => {
    const p = path.resolve(out, s.path);
    return { key: s.key, path: p, ok: fs.existsSync(p) };
  });
  const run: RunFile = {
    order,
    kind,
    out,
    draft,
    draft_rel: path.relative(out, draft),
    creator: { family, model: args.creator_model, role: args.creator_role?.trim() || "Tvůrce" },
    judge_family: family === "claude" ? "gpt" : "claude",
    creator_card: creatorCard,
    brief: args.brief,
    brief_file: kfile(out, "brief.md"),
    sources,
    draft_url: args.draft_url,
    panel: args.panel !== false,
    panel_title: args.panel_title?.trim() || args.brief.title,
    archive_parent: args.archive_parent,
    mission: args.mission?.trim() || "MEZI VÁMI",
    now,
  };
  fs.writeFileSync(run.brief_file, briefMarkdown(args.brief) + "\n");
  writeAtomic(kfile(out, "run.json"), JSON.stringify(run, null, 2) + "\n");
  return { ok: true, status: "OK", run, cards, mandatory: mandatoryQuestions(args.brief).map((q) => q.question) };
}

// ───────────────────────────── schemas (strict, OpenAI structured outputs) ─────────────────────────────

const STR = { type: "string" } as const;
function obj(properties: Record<string, unknown>): JsonSchema {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

export const BLOCK_KINDS = ["eyebrow", "headline", "lede", "section", "price", "cta", "note", "list", "option"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const EXPERT_SCHEMA = obj({
  verdict: { type: "string", enum: ["PALEC", "VYHRADA", "UPRAVA"] },
  summary: STR,
  changes: { type: "array", items: obj({ target: STR, proposal: STR, reason: STR, source: STR }) },
});

export const ADVOCATE_SCHEMA = obj({
  questions: {
    type: "array",
    items: obj({ question: STR, why: STR, touches: { type: "string", enum: ["sponsor", "contract", "none"] }, decision_key: STR, prep_title: STR }),
  },
});

const VIEW_SCHEMA = obj({
  label: STR,
  summary: STR,
  blocks: { type: "array", items: obj({ kind: { type: "string", enum: [...BLOCK_KINDS] }, label: STR, text: STR }) },
});

export const JUDGE_SCHEMA = obj({
  recommended: VIEW_SCHEMA,
  alternative: { anyOf: [VIEW_SCHEMA, { type: "null" }] },
  reasons: { type: "array", items: STR },
  disputes: { type: "array", items: STR },
});

export const SCHEMAS: Record<string, JsonSchema | undefined> = {
  expert: EXPERT_SCHEMA,
  advocate: ADVOCATE_SCHEMA,
  judge: JUDGE_SCHEMA,
  review: REVIEW_SCHEMA,
  text: undefined,
};

// ───────────────────────────── parsing (deterministic, from PR #82) ─────────────────────────────

/** One JSON object: bare, or one fenced ```json block that is the whole file (Claude written files). */
export function readJsonText(text: string): unknown {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(t);
  try {
    return JSON.parse(fenced ? fenced[1] : t);
  } catch {
    return undefined;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type ExpertMark = "PALEC" | "VYHRADA" | "UPRAVA";

export interface ExpertChange {
  target: string;
  proposal: string;
  reason: string;
  source: string;
  no_source?: boolean;
}

export interface ExpertVerdict {
  role: string;
  title: string;
  model: string;
  family: ModelFamily;
  ok: boolean;
  verdict?: ExpertMark;
  summary: string;
  changes: ExpertChange[];
  error?: string;
}

export interface AdvocateQuestion {
  question: string;
  why: string;
  touches: "sponsor" | "contract" | "none";
  decision_key?: string;
  prep_title?: string;
  mandatory?: boolean;
  reserved_hits?: string[];
  prep_order?: string;
}

export interface Block {
  kind: BlockKind;
  label?: string;
  text: string;
}

export interface DecisionView {
  label: string;
  summary: string;
  blocks: Block[];
}

export function parseExpert(j: unknown): Pick<ExpertVerdict, "verdict" | "summary" | "changes"> | undefined {
  const o = j as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return undefined;
  const v = str(o.verdict).toUpperCase().replace("Ý", "Y").replace("Á", "A").replace("Ú", "U");
  if (v !== "PALEC" && v !== "VYHRADA" && v !== "UPRAVA") return undefined;
  const changes: ExpertChange[] = [];
  for (const c of (Array.isArray(o.changes) ? o.changes : []) as Array<Record<string, unknown>>) {
    const target = str(c?.target);
    const proposal = str(c?.proposal);
    if (!target && !proposal) continue;
    const source = str(c.source);
    changes.push({ target, proposal, reason: str(c.reason) || "UNKNOWN", source: source || "bez zdroje", no_source: !source || undefined });
  }
  if (v === "UPRAVA" && !changes.length) return undefined;
  return { verdict: v, summary: str(o.summary) || "—", changes };
}

export function parseAdvocate(j: unknown): AdvocateQuestion[] | undefined {
  const o = j as { questions?: unknown } | undefined;
  if (!o || !Array.isArray(o.questions)) return undefined;
  const out: AdvocateQuestion[] = [];
  for (const raw of o.questions as Array<Record<string, unknown>>) {
    const question = str(raw?.question);
    if (!question) continue;
    const t = str(raw.touches);
    out.push({
      question,
      why: str(raw.why) || "UNKNOWN (advokát neuvedl důvod)",
      touches: t === "sponsor" || t === "contract" ? t : "none",
      decision_key: str(raw.decision_key) || undefined,
      prep_title: str(raw.prep_title) || undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseView(raw: unknown): DecisionView | undefined {
  const r = raw as Record<string, unknown> | null | undefined;
  if (!r || !Array.isArray(r.blocks)) return undefined;
  const blocks: Block[] = [];
  for (const b of r.blocks as Array<Record<string, unknown>>) {
    const kind = str(b?.kind) as BlockKind;
    const text = str(b?.text);
    if (!BLOCK_KINDS.includes(kind) || !text) continue;
    blocks.push({ kind, text, label: str(b.label) || undefined });
  }
  if (!blocks.length) return undefined;
  return { label: str(r.label) || "Verze", summary: str(r.summary), blocks };
}

export interface JudgeOutput {
  recommended: DecisionView;
  alternative: DecisionView | null;
  reasons: string[];
  disputes: string[];
}

export function parseJudge(j: unknown): JudgeOutput | undefined {
  const o = j as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return undefined;
  const recommended = parseView(o.recommended);
  if (!recommended) return undefined;
  const alternative = o.alternative ? (parseView(o.alternative) ?? null) : null;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  return { recommended, alternative, reasons: list(o.reasons), disputes: list(o.disputes) };
}

const NAME_RE = /(název|jmen|pojmenov|značk|brand)/i;

export function questionHits(q: string): string[] {
  const hits = reservedDecisionHits(q);
  if (NAME_RE.test(q) && !hits.includes("značka / název")) hits.push("značka / název");
  return hits;
}

/** Recipe-mandated questions (owner, 2026-11-02): paid offer copy must ask about the names and purchase likelihood. */
export function mandatoryQuestions(b: Pick<OrderBrief, "department" | "title" | "goal">): AdvocateQuestion[] {
  if (b.department !== "copy" || !/(nabíd|offer|placen|R1\.d|Hloubkov)/i.test(`${b.title}\n${b.goal}`)) return [];
  return [
    {
      question: "Proč se produkt jmenuje MEZI VÁMI? Je to název, pod kterým v ČR koupí nejvíc lidí a který obstojí i globálně (global-first)?",
      why: "HANDOFF: otevřené rozhodnutí č. 2 (finální globální název a značka) blokuje 3.1 a 5.2; milník 1.0 OPEN.",
      touches: "sponsor",
      decision_key: "nazev-produktu",
      prep_title: "Příprava rozhodnutí: název produktu (MEZI VÁMI)",
      mandatory: true,
    },
    {
      question: "Proč se placená vrstva jmenuje „Hloubková analýza“? Říká zákazníkovi, co kupuje a proč za to platit?",
      why: "HANDOFF Cíl: placená Hloubková analýza je hlavní produkt; název vrstvy je pracovní (funnel) a spadá pod otevřené rozhodnutí č. 2.",
      touches: "sponsor",
      decision_key: "nazev-placene-vrstvy",
      prep_title: "Příprava rozhodnutí: název placené vrstvy (Hloubková analýza)",
      mandatory: true,
    },
    {
      question: "Je tohle text s nejvyšší pravděpodobností nákupu? Co by musel obsahovat, aby kupovalo víc lidí, a jak to poznáme?",
      why: "HANDOFF Done pro H1: cizí lidé opakovaně platí. Odpověď dává rada odborníků; důkaz až T5 5.3.",
      touches: "none",
      decision_key: "konverze-textu",
      mandatory: true,
    },
  ];
}

function similar(a: string, b: string): boolean {
  const w = (s: string) => new Set(s.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []);
  const A = w(a);
  const B = w(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n >= 3;
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "otazka"
  );
}

/** Merges model questions with the mandatory ones and classifies every question deterministically. */
export function finalizeQuestions(model: AdvocateQuestion[] | undefined, mandatory: AdvocateQuestion[]): AdvocateQuestion[] {
  const out: AdvocateQuestion[] = [...mandatory];
  const keys = new Set(mandatory.map((q) => q.decision_key));
  for (const q of model ?? []) {
    if (q.decision_key && keys.has(q.decision_key)) continue;
    if (mandatory.some((m) => m.mandatory && similar(m.question, q.question))) continue;
    out.push(q);
    if (q.decision_key) keys.add(q.decision_key);
  }
  return out.map((q) => {
    const hits = questionHits(`${q.question} ${q.decision_key ?? ""}`);
    const touches = q.touches === "none" && hits.length && !(q.mandatory && q.decision_key === "konverze-textu") ? "sponsor" : q.touches;
    return { ...q, touches, reserved_hits: hits, decision_key: q.decision_key ?? slug(q.question) };
  });
}

export function norm(s: string): string {
  return s
    .replace(/[*_`>#]/g, "")
    .replace(/[“”„"]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quoteKey(t: string): string {
  return norm(
    t
      .split("\n")
      .map((l) => l.replace(/^\s*([-*+]|\d+\.)\s+/, ""))
      .join(" "),
  ).replace(/:$/, "");
}

/** Whole source segments of a draft: every contiguous range of WHOLE lines inside a paragraph, never a fragment. */
export function draftSegments(draft: string): Set<string> {
  const out = new Set<string>();
  for (const para of draft.split(/\n\s*\n/)) {
    const lines = para.split("\n").filter((l) => l.trim());
    for (let i = 0; i < lines.length; i++)
      for (let j = i; j < Math.min(lines.length, i + 40); j++) {
        const k = quoteKey(lines.slice(i, j + 1).join("\n"));
        if (k) out.add(k);
      }
  }
  return out;
}

/** Judge must not write new copy: every block text (and label) has to be a whole segment of one of the drafts. */
export function quoteProblems(views: Array<DecisionView | null>, drafts: string[]): string[] {
  const segs = drafts.map(draftSegments);
  const problems: string[] = [];
  for (const v of views) {
    if (!v) continue;
    for (const b of v.blocks)
      for (const t of [b.text, b.label]) {
        if (!t) continue;
        if (!segs.some((set) => set.has(quoteKey(t)))) problems.push(`„${t.slice(0, 80)}“ (${v.label}/${b.kind}) není celý blok z draftu`);
      }
  }
  return problems;
}

export function mandatoryFactLines(draft: string): string[] {
  return [
    ...new Set(
      draft
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /\d[\d\s]*Kč/.test(l) && norm(l).length <= 60 && !/[|#]/.test(l)),
    ),
  ];
}

export function factProblems(views: Array<DecisionView | null>, draft: string): string[] {
  const facts = mandatoryFactLines(draft);
  const problems: string[] = [];
  for (const v of views) {
    if (!v) continue;
    const have = new Set(v.blocks.map((b) => norm(b.text)));
    for (const f of facts) if (!have.has(norm(f))) problems.push(`${v.label}: chybí nebo je změněný povinný údaj „${f.slice(0, 60)}“ (blok price)`);
  }
  return problems;
}

export function structureProblems(p: Pick<JudgeOutput, "recommended">, kind: "copy" | "prep"): string[] {
  const has = (v: DecisionView, ks: BlockKind[]) => v.blocks.some((b) => ks.includes(b.kind));
  const out: string[] = [];
  if (kind === "copy") {
    if (!has(p.recommended, ["headline"])) out.push("doporučená verze nemá headline");
    if (!has(p.recommended, ["cta"])) out.push("doporučená verze nemá CTA");
  } else if (!has(p.recommended, ["option"])) out.push("doporučená možnost nemá blok option");
  return out;
}

export function konziliumFeedback(experts: ExpertVerdict[], questions: AdvocateQuestion[]): string {
  const ex = experts
    .filter((e) => e.ok)
    .map(
      (e) =>
        `### ${e.title} (${e.role}, ${e.family}) — ${e.verdict}\n${e.summary}\n` +
        e.changes.map((c, i) => `${i + 1}. CÍL: „${c.target}“ → NÁVRH: „${c.proposal}“ · důvod: ${c.reason} · zdroj: ${c.source}`).join("\n"),
    )
    .join("\n\n");
  const qs = questions.map((q) => `- ${q.question} [${q.touches}${q.touches !== "none" ? " — NEROZHODUJ, jde do Přípravy rozhodnutí" : ""}]`).join("\n");
  return `VERDIKTY RADY ODBORNÍKŮ:\n${ex || "(žádné čitelné)"}\n\nOTÁZKY ADVOKÁTA PRVNÍHO PRINCIPU:\n${qs}\n\nZapracuj úpravy, které nesahají na rozhodnutí Sponzora ani zamčené kontrakty. Vrať CELÝ upravený dokument a na konec sekci "## Zapracování konzilia": tabulka | role | úprava | přijato/odmítnuto | důvod |. Odmítnutí výhrady etického strážce musí mít důvod.`;
}

// ───────────────────────────── steps ─────────────────────────────

function readFileJson(file: string): unknown {
  return fs.existsSync(file) ? readJsonText(fs.readFileSync(file, "utf8")) : undefined;
}

export interface CouncilResult {
  ok: boolean;
  status: RunStatus;
  readable: number;
  families: ModelFamily[];
  advocate_ok: boolean;
  error?: string;
}

/** Reads advocate + 5 experts from disk, checks provenance by family, writes rada.json + zpetna-vazba.md. */
export function council(out: string): CouncilResult {
  const run = readRun(out);
  const { cards, problems } = loadCards();
  if (problems.length) return { ok: false, status: "NELZE_OVERIT", readable: 0, families: [], advocate_ok: false, error: problems.join(" | ") };
  const advFile = kfile(out, "advokat.json");
  const advFam = provenFamily(advFile, "claude");
  const advParsed = advFam ? parseAdvocate(readFileJson(advFile)) : undefined;
  const questions = finalizeQuestions(advParsed, mandatoryQuestions(run.brief));
  if (!advParsed)
    questions.push({
      question: "UNKNOWN: advokát nevrátil čitelné otázky; v balíčku jsou jen povinné otázky receptu.",
      why: advFam ? "výstup nečitelný" : "Nelze ověřit původ výstupu advokáta",
      touches: "none",
      decision_key: "advokat-unknown",
    });
  const experts: ExpertVerdict[] = EXPERT_ROLES.map((role) => {
    const card = cards[role];
    const fam = card.family as ModelFamily;
    const file = kfile(out, `${role}.json`);
    const proven = provenFamily(file, fam);
    const p = proven ? parseExpert(readFileJson(file)) : undefined;
    return {
      role,
      title: card.title,
      model: proven?.model ?? (fam === "gpt" ? "codex exec (rodina neověřena)" : "workflow /konzilium (Claude Opus)"),
      family: fam,
      ok: Boolean(p),
      verdict: p?.verdict,
      summary: p?.summary ?? "",
      changes: p?.changes ?? [],
      error: p ? undefined : !fs.existsSync(file) ? "výstup chybí" : proven ? "verdikt nečitelný" : "Nelze ověřit rodinu modelu",
    };
  });
  writeAtomic(kfile(out, "rada.json"), JSON.stringify({ experts, advocate: questions, advocate_ok: Boolean(advParsed) }, null, 2) + "\n");
  fs.writeFileSync(kfile(out, "zpetna-vazba.md"), konziliumFeedback(experts, questions) + "\n");
  const readable = experts.filter((e) => e.ok);
  const families = [...new Set(readable.map((e) => e.family))];
  if (readable.length < 3) return { ok: false, status: "FAILED", readable: readable.length, families, advocate_ok: Boolean(advParsed), error: `čitelné verdikty jen ${readable.length}/5` };
  if (families.length < 2)
    return { ok: false, status: "NELZE_OVERIT", readable: readable.length, families, advocate_ok: Boolean(advParsed), error: "rada nemá čitelné verdikty obou rodin (Claude i GPT)" };
  return { ok: true, status: "OK", readable: readable.length, families, advocate_ok: Boolean(advParsed) };
}

export interface ReviewResult {
  ok: boolean;
  accepted: boolean;
  verdict: string;
  issues: string[];
  error?: string;
}

/** Kontrola zapracování: deterministic checks + checker of the other family (structured verdict). Not PASS = revision dropped. */
export function review(out: string): ReviewResult {
  const run = readRun(out);
  const revisedFile = kfile(out, "draft-konzilium.md");
  const checkFile = kfile(out, "zapracovani-kontrola.json");
  const checkerFamily = run.judge_family;
  let verdict = "FIX";
  let issues: string[] = [];
  let checkerModel = "—";
  if (!fs.existsSync(revisedFile) || !fs.readFileSync(revisedFile, "utf8").trim()) {
    issues = ["tvůrce nevrátil zapracovaný draft"];
  } else if (!provenFamily(revisedFile, run.creator.family)) {
    issues = unverifiable(`zapracovaný draft nepochází prokazatelně od tvůrce rodiny ${run.creator.family}`).issues;
  } else {
    const det = run.kind === "copy" ? copyDeterministicIssues(fs.readFileSync(revisedFile, "utf8")) : [];
    const proven = fs.existsSync(checkFile) ? provenFamily(checkFile, checkerFamily) : undefined;
    if (det.length) issues = det;
    else if (!fs.existsSync(checkFile)) issues = unverifiable("kontrolor nevrátil verdikt").issues;
    else if (!proven) issues = unverifiable(`kontrolor není prokazatelně rodiny ${checkerFamily}`).issues;
    else {
      checkerModel = proven.model;
      const raw = fs.readFileSync(checkFile, "utf8").trim();
      const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(raw);
      const s = parseStructuredVerdict(fenced ? fenced[1] : raw, REVIEW_VERDICTS);
      const v = s ?? unverifiable("verdikt kontrolora není validní JSON podle schématu");
      verdict = v.verdict;
      issues = v.issues;
    }
  }
  const accepted = verdict === "PASS";
  writeAtomic(
    kfile(out, "zapracovani.json"),
    JSON.stringify({ accepted, verdict, issues, checker: { family: checkerFamily, model: checkerModel } }, null, 2) + "\n",
  );
  return { ok: true, accepted, verdict, issues: issues.slice(0, 8) };
}

function revisionAccepted(out: string): boolean {
  const f = kfile(out, "zapracovani.json");
  return fs.existsSync(f) && (JSON.parse(fs.readFileSync(f, "utf8")) as { accepted?: boolean }).accepted === true;
}

export interface JudgeCheck {
  ok: boolean;
  status: RunStatus | "FIX";
  problems: string[];
  judge?: JudgeOutput;
  model?: string;
}

/** Judge of the other family than the creator; code verifies structure, verbatim quotes and price facts. */
export function judgeCheck(out: string, attempt: number): JudgeCheck {
  const run = readRun(out);
  const file = kfile(out, `soudce-a${attempt}.json`);
  if (run.judge_family === run.creator.family) return { ok: false, status: "NELZE_OVERIT", problems: ["soudce je stejné rodiny jako tvůrce"] };
  if (!fs.existsSync(file)) return { ok: false, status: "FIX", problems: ["soudce nevrátil výstup"] };
  const proven = provenFamily(file, run.judge_family);
  if (!proven) return { ok: false, status: "NELZE_OVERIT", problems: [`Nelze ověřit: soudce není prokazatelně rodiny ${run.judge_family}`] };
  const parsed = parseJudge(readFileJson(file));
  if (!parsed) return { ok: false, status: "FIX", problems: ["výstup soudce není čitelný JSON podle formátu"] };
  const original = fs.readFileSync(run.draft, "utf8");
  const revised = revisionAccepted(out) ? fs.readFileSync(kfile(out, "draft-konzilium.md"), "utf8") : original;
  const problems = [
    ...structureProblems(parsed, run.kind),
    ...quoteProblems([parsed.recommended, parsed.alternative], [original, revised]),
    ...(run.kind === "copy" ? factProblems([parsed.recommended, parsed.alternative], revised) : []),
  ];
  fs.writeFileSync(kfile(out, `soudce-a${attempt}.check.json`), JSON.stringify({ problems }, null, 2) + "\n");
  return problems.length ? { ok: false, status: "FIX", problems } : { ok: true, status: "OK", problems: [], judge: parsed, model: proven.model };
}

export interface DecisionPackage {
  version: 1;
  order: string;
  kind: "copy" | "prep";
  title: string;
  milestone: string;
  created_at: string;
  recommended: DecisionView;
  alternative: DecisionView | null;
  reasons: string[];
  disputes: string[];
  experts: ExpertVerdict[];
  advocate: AdvocateQuestion[];
  author: { role: string; model: string; family: ModelFamily };
  creator: { role: string; model: string; family: ModelFamily };
  sponsor_reserved: string[];
  honest_note: string;
  drafts: { original?: string; revised?: string; notion?: string };
  prep_orders: string[];
  notion_archive_url?: string;
}

/** One human sentence for the owner's row (no paths, no secrets). */
export function recommendationSentence(pkg: Pick<DecisionPackage, "recommended" | "alternative">): string {
  const first = (/^(.+?[.!?])(\s|$)/.exec(pkg.recommended.summary.trim())?.[1] ?? pkg.recommended.summary).trim().replace(/[.!?]+$/, "");
  const alt = pkg.alternative ? " (alternativa je v balíčku)" : "";
  const s = `Konzilium doporučuje „${pkg.recommended.label}“${alt}${first ? ` – ${first}` : ""}`.replace(/\s+/g, " ");
  return `${s.length > 297 ? `${s.slice(0, 296).trimEnd()}…` : s}.`;
}

export interface AssembleResult {
  ok: boolean;
  status: RunStatus;
  error?: string;
  decision?: string;
  sentence?: string;
}

export function assemble(out: string, attempt: number): AssembleResult {
  const run = readRun(out);
  const jc = judgeCheck(out, attempt);
  // A judge that fails the code check is never shown to the owner (PR #82: unknown, not a decision).
  if (!jc.ok || !jc.judge) return { ok: false, status: "NELZE_OVERIT", error: `soudce neprošel kontrolou kódu: ${jc.problems.slice(0, 5).join("; ")}` };
  const radaFile = kfile(out, "rada.json");
  if (!fs.existsSync(radaFile)) return { ok: false, status: "FAILED", error: "chybí rada.json (krok council)" };
  const rada = JSON.parse(fs.readFileSync(radaFile, "utf8")) as { experts: ExpertVerdict[]; advocate: AdvocateQuestion[] };
  const readable = rada.experts.filter((e) => e.ok);
  if (new Set(readable.map((e) => e.family)).size < 2) return { ok: false, status: "NELZE_OVERIT", error: "rada nemá čitelné verdikty obou rodin" };
  const zapFile = kfile(out, "zapracovani.json");
  const zap = fs.existsSync(zapFile) ? (JSON.parse(fs.readFileSync(zapFile, "utf8")) as { accepted: boolean; verdict: string; issues: string[] }) : undefined;
  const revisionIssues: string[] = [];
  if (!zap?.accepted)
    revisionIssues.push(
      `Zapracování konzilia neprošlo kontrolou (${zap?.verdict ?? "chybí"}: ${(zap?.issues ?? []).join("; ").slice(0, 300)}) — balíček stojí na původním draftu.`,
    );
  const disputes = [...revisionIssues, ...jc.judge.disputes];
  const ethics = rada.experts.find((v) => v.role === "eticky-strazce");
  if (ethics?.ok && ethics.verdict !== "PALEC" && !disputes.some((d) => /etick/i.test(d)))
    disputes.push(`Etický strážce: ${ethics.verdict} — ${ethics.summary} (soudce spor neuvedl; doplnil kód)`);
  for (const v of rada.experts.filter((x) => !x.ok)) disputes.push(`${v.title}: verdikt chybí (${v.error})`);
  const pkg: DecisionPackage = {
    version: 1,
    order: run.order,
    kind: run.kind,
    title: run.brief.title,
    milestone: run.brief.milestone,
    created_at: run.now,
    recommended: jc.judge.recommended,
    alternative: jc.judge.alternative,
    reasons: jc.judge.reasons,
    disputes,
    experts: rada.experts,
    advocate: rada.advocate,
    author: { role: "Soudce konzilia", model: jc.model!, family: run.judge_family },
    creator: run.creator,
    sponsor_reserved: run.brief.owner_decisions,
    honest_note: HONEST_NOTE,
    drafts: {
      original: run.draft_rel,
      revised: zap?.accepted ? `${KONZILIUM_DIR}/draft-konzilium.md` : undefined,
      notion: run.draft_url,
    },
    prep_orders: [],
  };
  const text = JSON.stringify(pkg, null, 2) + "\n";
  if (!scanSecrets(text).clean) return { ok: false, status: "FAILED", error: "secret-scan: balíček obsahuje vzor tajemství" };
  writeAtomic(path.join(out, "decision.json"), text);
  return { ok: true, status: "WAITING_OWNER", decision: path.join(out, "decision.json"), sentence: recommendationSentence(pkg) };
}

/** Notion archive page for the owner (the decision itself is the row's „Rozhodnutí vlastníka“). */
export function archiveMarkdown(pkg: DecisionPackage): string {
  const view = (v: DecisionView) => v.blocks.map((b) => `- **${b.kind}${b.label ? ` · ${b.label}` : ""}:** ${b.text}`).join("\n");
  return [
    "**Rozhoduje se v panelu TARS — Zakázky** (sloupec „Rozhodnutí vlastníka“: GO = doporučená verze, GO B = alternativa, REJECT). Tato stránka je archiv balíčku decision.json z workflow /konzilium.",
    "",
    `## Doporučeno — ${pkg.recommended.label}`,
    `Autor doporučení: ${pkg.author.role} · ${pkg.author.model}. ${pkg.recommended.summary}`,
    view(pkg.recommended),
    ...(pkg.alternative ? ["", `## Alternativa — ${pkg.alternative.label}`, pkg.alternative.summary, view(pkg.alternative)] : []),
    "",
    "## Důvody",
    ...(pkg.reasons.length ? pkg.reasons.map((r) => `- ${r}`) : ["- —"]),
    "",
    "## Rada odborníků",
    ...pkg.experts.map((e) => `- ${e.title} (${e.family}): **${e.verdict ?? "—"}** — ${e.summary || e.error}`),
    "",
    "## Otázky Advokáta prvního principu",
    ...pkg.advocate.map((q) => `- ${q.question} [${q.touches}]`),
    "",
    "## Spory",
    ...(pkg.disputes.length ? pkg.disputes.map((d) => `- ${d}`) : ["- žádné"]),
    "",
    `> ${pkg.honest_note}`,
  ].join("\n");
}

/** Row of the Notion panel „TARS — Zakázky“ for a finished Konzilium (WAITING_OWNER, owner decides by tapping). */
export function konziliumPanelRow(run: RunFile, pkg: DecisionPackage, link: string | null): PanelRow {
  return {
    Zakázka: run.panel_title,
    "ID zakázky": run.order,
    Mise: run.mission,
    Oddělení: run.brief.department ?? "—",
    Stav: "WAITING_OWNER",
    Fronta: "1 · Čeká na vlastníka",
    "Tvůrce (model)": run.creator.model,
    "Kontrolor (model)": pkg.author.model,
    "Kolo oprav": 0,
    "Poslední krok": recommendationSentence(pkg),
    "date:Start:start": run.now,
    "date:Start:is_datetime": 1,
    "date:Poslední změna:start": run.now,
    "date:Poslední změna:is_datetime": 1,
    "Ruční zásahy": 0,
    "Odkaz na výstup": link,
    "Čeká na vlastníka": "__YES__",
  };
}

export interface PanelDeps {
  sink: PanelSink;
  archive?: (parent: string, title: string, markdown: string) => Promise<string>;
}

export async function panel(out: string, deps: PanelDeps): Promise<{ ok: boolean; status: RunStatus; row?: string; link?: string | null; error?: string }> {
  const run = readRun(out);
  const decFile = path.join(out, "decision.json");
  if (!fs.existsSync(decFile)) return { ok: false, status: "FAILED", error: "chybí decision.json" };
  const pkg = JSON.parse(fs.readFileSync(decFile, "utf8")) as DecisionPackage;
  if (!run.panel) return { ok: true, status: "WAITING_OWNER", link: null };
  const prev = fs.existsSync(kfile(out, "panel.json")) ? (JSON.parse(fs.readFileSync(kfile(out, "panel.json"), "utf8")) as { row?: string; link?: string | null }) : {};
  let link: string | null = prev.link ?? pkg.notion_archive_url ?? null;
  if (!link && run.archive_parent && deps.archive) {
    link = await deps.archive(run.archive_parent, `KARTA (archiv) — ${run.panel_title} (${run.order})`, archiveMarkdown(pkg));
    pkg.notion_archive_url = link;
    writeAtomic(decFile, JSON.stringify(pkg, null, 2) + "\n");
  }
  if (!link) link = run.draft_url ?? null;
  // Exactly one create per run: a known row is never created twice (the panel has no SQL/rows lookup).
  const row = prev.row ?? (await deps.sink.upsert(konziliumPanelRow(run, pkg, link)));
  writeAtomic(kfile(out, "panel.json"), JSON.stringify({ row, link }, null, 2) + "\n");
  return { ok: true, status: "WAITING_OWNER", row, link };
}

// ───────────────────────────── GPT (codex exec --output-schema, krok 1) ─────────────────────────────

/** {{FILE:/abs}} → file content, {{CARD:/abs}} → definition without frontmatter (inlined like PR #82 prompts). */
export function expandFiles(prompt: string): string {
  return prompt.replace(/\{\{(FILE|CARD):([^}]+)\}\}/g, (_m, kind: string, p: string) => {
    const f = p.trim();
    if (!path.isAbsolute(f) || !fs.existsSync(f)) return `UNKNOWN (soubor ${path.basename(f)} nejde načíst)`;
    const t = fs.readFileSync(f, "utf8");
    return kind === "CARD" ? stripFrontmatter(t) : t;
  });
}

export interface GptDeps {
  run(prompt: string, opts: { cwd: string; outputSchema?: JsonSchema }): Promise<{ ok: boolean; text: string; limit: boolean; error?: string }>;
  model(): string;
}

export async function gpt(
  out: string,
  role: string,
  schemaName: string,
  file: string,
  sha: string,
  prompt: string,
  deps: GptDeps,
): Promise<{ ok: boolean; family: "gpt"; model?: string; verified?: boolean; limit?: boolean; error?: string }> {
  const fail = (error: string, limit = false) => ({ ok: false, family: "gpt" as const, error, limit });
  if (!(schemaName in SCHEMAS)) return fail(`neznámé schéma ${schemaName}`);
  if (!/^[a-z0-9-]+(\.json|\.md)$/.test(file)) return fail("neplatný název výstupního souboru");
  if (fnv1a(payload(prompt)) !== sha) return fail("prompt se při přenosu změnil (sha nesedí) — GPT nevolán");
  const target = kfile(out, file);
  const r = await deps.run(expandFiles(payload(prompt)), { cwd: kdir(out), outputSchema: SCHEMAS[schemaName] });
  if (!r.ok) return fail(r.error ?? "codex selhal", r.limit);
  if (!scanSecrets(r.text).clean) return fail("secret-scan: výstup GPT obsahuje vzor tajemství");
  // free text (zapracovaný draft): a reply wrapped as one ```markdown block is unwrapped, nothing else changes
  const fenced = schemaName === "text" ? /^```[\w-]*\n([\s\S]*?)\n```$/.exec(r.text.trim()) : null;
  const text = fenced ? `${fenced[1]}\n` : r.text;
  const model = deps.model();
  const verified = isGptModel(model);
  fs.writeFileSync(target, text.endsWith("\n") ? text : `${text}\n`);
  const sc: Sidecar = { family: "gpt", model, verified, role, prompt_sha: sha };
  fs.writeFileSync(sidecarPath(target), JSON.stringify(sc, null, 2) + "\n");
  return { ok: true, family: "gpt", model, verified };
}

// ───────────────────────────── CLI ─────────────────────────────

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

export interface BridgeIO {
  stdin(): Promise<string>;
  readIn?(file: string): string;
  gptDeps(): GptDeps;
  panelDeps(out: string): PanelDeps;
  now(): string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const realIO: BridgeIO = {
  stdin: readStdin,
  gptDeps: () => {
    const codex = new CodexCli();
    return { run: (p, o) => codex.run(p, o), model: () => codex.model };
  },
  panelDeps: (out) => {
    const notion = makeNotion(new ClaudeCli("sonnet"), kdir(out));
    return { sink: new McpPanelSink(kdir(out)), archive: async (parent, title, md) => (await notion.createPage(parent, title, md)).url };
  },
  now: () => new Date().toISOString(),
};

/** Payload of prep/gpt: the --in file (only <out>/konzilium/.in-<sha>.txt, removed after reading) or stdin. */
async function input(rest: string[], out: string, io: BridgeIO): Promise<string> {
  const f = flag(rest, "in");
  if (!f) return io.stdin();
  const expected = path.join(kdir(out), `.in-${flag(rest, "sha") ?? ""}.txt`);
  if (path.resolve(f) !== expected) throw new Error("--in musí být <out>/konzilium/.in-<sha>.txt");
  const text = io.readIn ? io.readIn(f) : fs.readFileSync(f, "utf8");
  fs.rmSync(f, { force: true });
  return text;
}

export async function main(argv: string[], io: BridgeIO = realIO): Promise<Record<string, unknown>> {
  const [cmd, ...rest] = argv;
  const out = flag(rest, "out");
  if (!out || !path.isAbsolute(out)) return { ok: false, error: "--out <absolutní cesta> je povinné" };
  const attempt = Number(flag(rest, "attempt") ?? "0");
  switch (cmd) {
    case "prep": {
      const raw = payload(await input(rest, out, io));
      if (fnv1a(raw) !== flag(rest, "sha")) return { ok: false, status: "FAILED", error: "args se při přenosu změnily (sha nesedí)" };
      let args: RunArgs;
      try {
        args = JSON.parse(raw) as RunArgs;
      } catch {
        return { ok: false, status: "FAILED", error: "args nejsou JSON" };
      }
      const r = prep(out, args, io.now());
      if (!r.ok) return { ok: false, status: r.status, error: r.error };
      const run = r.run!;
      return {
        ok: true,
        status: "OK",
        now: run.now,
        out: run.out,
        repo: REPO_ROOT,
        order: run.order,
        kind: run.kind,
        draft: run.draft,
        brief_file: run.brief_file,
        creator: run.creator,
        judge_family: run.judge_family,
        creator_card: run.creator_card,
        sources: run.sources,
        mandatory: r.mandatory,
        cards: Object.fromEntries(Object.values(r.cards!).map((c) => [c.role, { family: c.family, agent: c.agent ?? null, title: c.title, file: c.file, sources: c.sources }])),
      };
    }
    case "gpt":
      return (await gpt(out, flag(rest, "role") ?? "", flag(rest, "schema") ?? "", flag(rest, "file") ?? "", flag(rest, "sha") ?? "", await input(rest, out, io), io.gptDeps())) as unknown as Record<string, unknown>;
    case "council":
      return council(out) as unknown as Record<string, unknown>;
    case "review":
      return review(out) as unknown as Record<string, unknown>;
    case "judge-check": {
      const r = judgeCheck(out, attempt);
      return { ok: r.ok, status: r.status, problems: r.problems.slice(0, 10) };
    }
    case "assemble":
      return assemble(out, attempt) as unknown as Record<string, unknown>;
    case "panel":
      return (await panel(out, io.panelDeps(out))) as unknown as Record<string, unknown>;
    default:
      return { ok: false, error: `neznámý příkaz ${cmd}` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .catch((e: Error) => ({ ok: false, status: "FAILED", error: e.message.split("\n")[0].slice(0, 300) }))
    .then((r) => {
      process.stdout.write(`${JSON.stringify(r)}\n`);
    });
}
