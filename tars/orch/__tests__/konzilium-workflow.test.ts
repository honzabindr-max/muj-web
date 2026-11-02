// DR-029 krok 3: Konzilium jako uložený workflow Claude Code (.claude/workflows/konzilium.js) + most konzilium-bridge.ts.
// Workflow se tu spouští v sandboxu s falešným agent(): transportní agenti volají skutečný most (main) in-process,
// Claude role zapisují své soubory, GPT (codex) a Notion jsou podvržené závislosti.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ADVOCATE_SCHEMA,
  attest,
  EXPERT_SCHEMA,
  JUDGE_SCHEMA,
  familyOf,
  fnv1a,
  isGptModel,
  konziliumPanelRow,
  loadCards,
  main,
  panel,
  prep,
  provenFamily,
  quoteProblems,
  type BridgeIO,
  type DecisionPackage,
} from "../konzilium-bridge";
import type { PanelRow } from "../panel";
import { STRUCTURED_FORMAT } from "../verdict";

const ROOT = path.resolve(__dirname, "../../..");
const WF = path.join(ROOT, ".claude/workflows/konzilium.js");
const CARDS = path.join(ROOT, ".claude/agents/konzilium");

// ───────────── sandbox for the workflow script ─────────────
function loadWorkflow() {
  const src = fs.readFileSync(WF, "utf8");
  const m = /^export const meta = (\{[\s\S]*?\n\})\n/.exec(src);
  if (!m) throw new Error("meta není první příkaz");
  const meta = new Function(`return (${m[1]})`)() as { name: string; description: string; phases: Array<{ title: string }> };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...x: unknown[]) => Promise<unknown>;
  const fn = new AsyncFunction("agent", "parallel", "pipeline", "phase", "log", "args", "Date", "Math", src.slice(m[0].length));
  return { src, meta, fn };
}

// Date.now(), Math.random() and new Date() throw inside workflows (resume) — the sandbox enforces the same.
const SafeDate = new Proxy(Date, {
  construct(t, a) {
    if (!a.length) throw new Error("new Date() je ve workflow zakázané");
    return new (t as DateConstructor)(...(a as [string]));
  },
  get(t, k) {
    if (k === "now") return () => { throw new Error("Date.now() je ve workflow zakázané"); };
    return Reflect.get(t, k);
  },
});
const SafeMath = new Proxy(Math, { get: (t, k) => (k === "random" ? () => { throw new Error("Math.random() je ve workflow zakázané"); } : Reflect.get(t, k)) });

function shellSplit(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let quoted = false;
  while (i < s.length) {
    const c = s[i];
    if (c === "'") {
      const end = s.indexOf("'", i + 1);
      cur += s.slice(i + 1, end);
      quoted = true;
      i = end + 1;
    } else if (c === "\\" && s[i + 1] === "'") {
      cur += "'";
      i += 2;
    } else if (c === " ") {
      if (cur || quoted) out.push(cur);
      cur = "";
      quoted = false;
      i++;
    } else {
      cur += c;
      i++;
    }
  }
  if (cur || quoted) out.push(cur);
  return out;
}

const DRAFT = `# Nabídka Hloubkové analýzy (DRAFT)

## Směr A

Váš vztah, oblast po oblasti

Rozsáhlá Hloubková analýza MEZI VÁMI propojuje pohled na vztahové potřeby a komunikaci s modelovými situacemi a praktickými doporučeními.

1 990 Kč (vč. DPH)

K objednávce Hloubkové analýzy

## Směr B

Podněty pro společný život

Hloubková analýza MEZI VÁMI nabízí modelové situace a podněty, čeho si všímat v každodenním soužití.

## Kontrola kritérií

- Headline, lede, cena a CTA jsou v obou směrech.
`;
const REVISED = `${DRAFT}
## Zapracování konzilia

| role | úprava | přijato/odmítnuto | důvod |
| --- | --- | --- | --- |
| ux-ui | kratší CTA | přijato | mobil |
`;

const expert = (verdict = "UPRAVA") =>
  JSON.stringify({ verdict, summary: "Shrnutí.", changes: verdict === "UPRAVA" ? [{ target: "K objednávce Hloubkové analýzy", proposal: "Objednat", reason: "jasnost", source: "funnel C.2" }] : [] });
const ADVOCATE = JSON.stringify({ questions: [{ question: "Proč zrovna tento nadpis?", why: "funnel C.2", touches: "none", decision_key: "nadpis", prep_title: "" }] });
const judgeJson = (headline = "Váš vztah, oblast po oblasti") =>
  JSON.stringify({
    recommended: {
      label: "",
      summary: "Směr A je nejjasnější. Druhá věta.",
      blocks: [
        { kind: "headline", label: "", text: headline },
        { kind: "lede", label: "", text: "Rozsáhlá Hloubková analýza MEZI VÁMI propojuje pohled na vztahové potřeby a komunikaci s modelovými situacemi a praktickými doporučeními." },
        { kind: "price", label: "", text: "1 990 Kč (vč. DPH)" },
        { kind: "cta", label: "", text: "K objednávce Hloubkové analýzy" },
      ],
    },
    alternative: null,
    reasons: ["UX/UI: krátké CTA."],
    disputes: [],
  });

interface Scenario {
  creatorFamily?: string;
  creatorModel?: string;
  gptModel?: string | ((file: string) => string);
  /** extra writes of a Claude role (as if its Write were not restricted by the guard hook) */
  onClaudeWrite?: (file: string, konziliumDir: string) => void;
  /** file name → content written by a Claude role / returned by GPT */
  out?: Partial<Record<string, string | ((n: number) => string)>>;
  tamperGptPrompt?: boolean;
  panel?: boolean;
  draft?: string;
}

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "konzilium-"));
  process.env.TARS_KONZILIUM_KEYS = path.join(dir, "..", `${path.basename(dir)}-keys`);
  process.env.TARS_KONZILIUM_LOG_DIR = path.join(dir, "..", `${path.basename(dir)}-log`);
  fs.writeFileSync(path.join(dir, "draft-v1.md"), DRAFT);
  fs.mkdirSync(path.join(dir, "sources"));
  fs.writeFileSync(path.join(dir, "sources", "handoff.md"), "HANDOFF: otevřená rozhodnutí č. 1 a 2.");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const BRIEF = {
  title: "TEST – nabídka Hloubkové analýzy",
  department: "copy",
  milestone: "3.1",
  why: "test",
  goal: "Copy placené nabídky",
  inputs: ["funnel C.2"],
  acceptance: ["headline, lede, cena, CTA"],
  owner_decisions: ["Cena 1 990 Kč je pracovní."],
  sources: ["handoff"],
};

async function runWorkflow(sc: Scenario = {}) {
  const { fn } = loadWorkflow();
  const calls: Array<{ prompt: string; opts: Record<string, unknown> }> = [];
  const gptCalls: Array<{ file: string; prompt: string; schema: unknown }> = [];
  const rows: PanelRow[] = [];
  const archives: string[] = [];
  const counters: Record<string, number> = {};
  const defaults: Record<string, string | ((n: number) => string)> = {
    "advokat.json": ADVOCATE,
    "prodejni-psycholog.json": expert(),
    "ux-ui.json": expert(),
    "brand-strateg.json": expert("PALEC"),
    "hlas-zakaznika.json": expert("VYHRADA"),
    "eticky-strazce.json": expert("VYHRADA"),
    "draft-konzilium.md": "```markdown\n" + REVISED + "\n```",
    "zapracovani-kontrola.json": JSON.stringify({ verdict: "PASS", findings: [] }),
    "soudce-a0.json": judgeJson(),
    "soudce-a1.json": judgeJson(),
  };
  const content = (file: string) => {
    counters[file] = (counters[file] ?? 0) + 1;
    const v = { ...defaults, ...sc.out }[file];
    return typeof v === "function" ? v(counters[file]) : (v ?? "");
  };
  const agent = async (prompt: string, opts: Record<string, unknown>) => {
    calls.push({ prompt, opts });
    const schema = opts.schema as { properties?: Record<string, unknown> };
    if (schema?.properties?.line) {
      expect(opts.agentType).toBe("konzilium-transport");
      const cmd = /PRIKAZ_START\n([\s\S]*?)\nPRIKAZ_KONEC/.exec(prompt)![1];
      expect(cmd).not.toMatch(/\n|<</); // one line, no heredoc (Bash refuses braces + quotes in heredocs)
      const argv = shellSplit(cmd);
      expect(argv.slice(0, 3)).toEqual(["npx", "tsx", "tars/orch/konzilium-bridge.ts"]);
      const file = argv[argv.indexOf("--file") + 1];
      // the Write step of the transport agent
      const w = /zapiš do souboru (\/\S+) PŘESNĚ[\s\S]*?\nVSTUP_START\n([\s\S]*?)\nVSTUP_KONEC/.exec(prompt);
      if (w) {
        let text = w[2];
        if (sc.tamperGptPrompt && argv[3] === "gpt") text = text.replace("Konziliu", "Konzíliu");
        expect(argv[argv.indexOf("--in") + 1]).toBe(w[1]);
        fs.mkdirSync(path.dirname(w[1]), { recursive: true });
        fs.writeFileSync(w[1], text);
      }
      const io: BridgeIO = {
        stdin: async () => "",
        now: () => "2026-11-02T19:00:00.000Z",
        gptDeps: () => ({
          run: async (p, o) => {
            gptCalls.push({ file, prompt: p, schema: o.outputSchema });
            return { ok: true, text: content(file), limit: false };
          },
          model: () => (typeof sc.gptModel === "function" ? sc.gptModel(file) : (sc.gptModel ?? "gpt-6.1-sol")),
        }),
        panelDeps: () => ({
          sink: { upsert: async (row) => (rows.push(row), "row123") },
          archive: async (_p, title) => (archives.push(title), "https://app.notion.com/p/archiv123"),
        }),
      };
      return { line: JSON.stringify(await main(argv.slice(3), io)) };
    }
    // Claude role: only as a Konzilium subagent definition, then writes its single output file (Write tool)
    expect(String(opts.agentType)).toMatch(/^konzilium-(advokat|prodejni-psycholog|brand-strateg|eticky-strazce|soudce|tvurce|kontrolor)$/);
    const target = /Write do souboru (\/\S+?\.(?:json|md))(?=[\s.])/.exec(prompt)?.[1];
    if (!target) throw new Error(`neznámé volání agenta: ${prompt.slice(0, 120)}`);
    fs.writeFileSync(target, content(path.basename(target)));
    sc.onClaudeWrite?.(path.basename(target), path.dirname(target));
    return { written: true };
  };
  const parallel = async (thunks: Array<() => Promise<unknown>>) => Promise.all(thunks.map((t) => t().catch(() => null)));
  if (sc.draft !== undefined) fs.writeFileSync(path.join(dir, "draft-v1.md"), sc.draft);
  const args = {
    out_dir: dir,
    draft: "draft-v1.md",
    creator_family: sc.creatorFamily ?? "gpt",
    creator_model: sc.creatorModel ?? "codex exec (gpt-6.1-sol)",
    creator_role: "Copy Studio (tvůrce)",
    brief: BRIEF,
    sources: [{ key: "handoff", path: "sources/handoff.md" }],
    panel: sc.panel ?? true,
    panel_title: "TEST Konzilium",
    archive_parent: "40c0ae49f50781149394dcef1a669453",
  };
  if (sc.creatorFamily === "") delete (args as Record<string, unknown>).creator_family;
  const result = (await fn(agent, parallel, undefined, () => undefined, () => undefined, args, SafeDate, SafeMath)) as Record<string, unknown>;
  return { result, calls, gptCalls, rows, archives };
}

const readDecision = () => JSON.parse(fs.readFileSync(path.join(dir, "decision.json"), "utf8")) as DecisionPackage;

describe("workflow /konzilium (DR-029 krok 3)", () => {
  it("is a valid saved workflow: pure-literal meta first, plain JS, no imports, phases match phase() calls", () => {
    const { src, meta } = loadWorkflow();
    expect(meta.name).toBe("konzilium");
    expect(meta.description.length).toBeGreaterThan(20);
    expect(src).not.toMatch(/\bimport\s*\(|^import\s/m);
    expect(src).not.toMatch(/Date\.now\(|Math\.random\(|new Date\(\)/);
    const called = [...src.matchAll(/^phase\('([^']+)'\)/gm)].map((m) => m[1]);
    expect(called).toEqual(meta.phases.map((p) => p.title));
  });

  it("happy path (tvůrce GPT): advokát + rada 3× Claude / 2× GPT, zapracování, kontrola, soudce Claude → decision.json + řádek WAITING_OWNER", async () => {
    const { result, calls, gptCalls, rows, archives } = await runWorkflow();
    expect(result.status).toBe("WAITING_OWNER");
    const pkg = readDecision();
    // same schema as the real run-3 decision.json
    expect(Object.keys(pkg).sort()).toEqual(
      ["advocate", "alternative", "author", "created_at", "creator", "disputes", "drafts", "experts", "honest_note", "kind", "milestone", "notion_archive_url", "order", "prep_orders", "reasons", "recommended", "sponsor_reserved", "title", "version"].sort(),
    );
    expect(pkg.author).toMatchObject({ role: "Soudce konzilia", family: "claude" });
    expect(pkg.creator).toEqual({ role: "Copy Studio (tvůrce)", model: "codex exec (gpt-6.1-sol)", family: "gpt" });
    expect(pkg.experts.map((e) => [e.role, e.family, e.ok])).toEqual([
      ["prodejni-psycholog", "claude", true],
      ["ux-ui", "gpt", true],
      ["brand-strateg", "claude", true],
      ["hlas-zakaznika", "gpt", true],
      ["eticky-strazce", "claude", true],
    ]);
    expect(pkg.experts.find((e) => e.role === "ux-ui")!.model).toBe("codex exec (gpt-6.1-sol)");
    expect(pkg.advocate.filter((q) => q.mandatory).map((q) => q.decision_key)).toEqual(["nazev-produktu", "nazev-placene-vrstvy", "konverze-textu"]);
    expect(pkg.advocate.some((q) => q.decision_key === "nadpis")).toBe(true);
    expect(pkg.drafts).toEqual({ original: "draft-v1.md", revised: "konzilium/draft-konzilium.md" });
    expect(pkg.disputes.some((d) => /Etický strážce: VYHRADA/.test(d))).toBe(true); // code adds the ethics dispute
    expect(pkg.created_at).toBe("2026-11-02T19:00:00.000Z");
    expect(pkg.prep_orders).toEqual([]);
    expect(pkg.notion_archive_url).toBe("https://app.notion.com/p/archiv123");
    // GPT calls: 2 experts + incorporation (creator) — every one with codex --output-schema except free text
    expect(gptCalls.map((c) => c.file).sort()).toEqual(["draft-konzilium.md", "hlas-zakaznika.json", "ux-ui.json"]);
    expect(gptCalls.find((c) => c.file === "ux-ui.json")!.schema).toBe(EXPERT_SCHEMA);
    expect(gptCalls.find((c) => c.file === "draft-konzilium.md")!.schema).toBeUndefined();
    expect(fs.readFileSync(path.join(dir, "konzilium/draft-konzilium.md"), "utf8").startsWith("# Nabídka")).toBe(true); // ```markdown obal odstraněn
    // GPT prompts get the card and draft inlined by the bridge (like PR #82), not as paths
    const ux = gptCalls.find((c) => c.file === "ux-ui.json")!.prompt;
    expect(ux).toContain("Jsi UX/UI odborník v Konziliu projektu MEZI VÁMI");
    expect(ux).toContain("Váš vztah, oblast po oblasti");
    expect(ux).toContain("# Karta Konzilia: ux-ui");
    expect(ux).not.toMatch(/\{\{(FILE|CARD):/);
    // Claude roles run as their subagent definitions on Opus
    const claudeRoles = calls.filter((c) => c.opts.agentType && c.opts.agentType !== "konzilium-transport").map((c) => c.opts.agentType);
    expect(claudeRoles.sort()).toEqual(["konzilium-advokat", "konzilium-brand-strateg", "konzilium-eticky-strazce", "konzilium-kontrolor", "konzilium-prodejni-psycholog", "konzilium-soudce"]);
    expect(calls.filter((c) => c.opts.agentType && c.opts.agentType !== "konzilium-transport").every((c) => c.opts.model === "opus")).toBe(true);
    // kontrola zapracování = Claude (other family than the GPT creator), structured verdict format of krok 1
    const checker = calls.find((c) => /Jsi KONTROLOR oddělení/.test(c.prompt))!;
    expect(checker.prompt).toContain(STRUCTURED_FORMAT);
    // panel row: WAITING_OWNER, waits for the owner, one sentence, link
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Zakázka: "TEST Konzilium", Stav: "WAITING_OWNER", Fronta: "1 · Čeká na vlastníka", "Čeká na vlastníka": "__YES__", "Odkaz na výstup": "https://app.notion.com/p/archiv123", "Kontrolor (model)": pkg.author.model });
    expect(rows[0]["Poslední krok"]).toBe("Konzilium doporučuje „Verze“ – Směr A je nejjasnější.");
    expect(archives).toEqual([`KARTA (archiv) — TEST Konzilium (${path.basename(dir)})`]);
    expect(result).toMatchObject({ panel_row: "row123", link: "https://app.notion.com/p/archiv123" });
    expect(fs.readdirSync(path.join(dir, "konzilium")).filter((f) => f.startsWith(".in-"))).toEqual([]); // inputs removed
  });

  it("tvůrce Claude → soudce i kontrolor jsou GPT (codex --output-schema), Claude soudce se nespustí", async () => {
    const { result, calls, gptCalls } = await runWorkflow({ creatorFamily: "claude", creatorModel: "claude -p --model opus" });
    expect(result.status).toBe("WAITING_OWNER");
    const pkg = readDecision();
    expect(pkg.author).toEqual({ role: "Soudce konzilia", model: "codex exec (gpt-6.1-sol)", family: "gpt" });
    expect(calls.some((c) => c.opts.agentType === "konzilium-soudce")).toBe(false);
    expect(gptCalls.find((c) => c.file === "soudce-a0.json")!.schema).toBe(JUDGE_SCHEMA);
    expect(gptCalls.find((c) => c.file === "zapracovani-kontrola.json")!.prompt).toContain(STRUCTURED_FORMAT);
    expect(gptCalls.some((c) => c.file === "draft-konzilium.md")).toBe(false); // Claude creator revises itself
    expect(calls.some((c) => c.opts.agentType === "konzilium-tvurce")).toBe(true);
    expect(calls.some((c) => c.opts.agentType === "konzilium-kontrolor")).toBe(false);
  });

  it("rodina tvůrce chybí nebo nesedí s modelem → NELZE_OVERIT, nic se nespustí ani nezapíše", async () => {
    for (const sc of [
      { creatorFamily: "" },
      { creatorFamily: "gemini" },
      { creatorFamily: "gpt", creatorModel: "claude -p --model opus" },
      { creatorFamily: "gpt", creatorModel: "neznámý model" },
      { creatorFamily: "gpt", creatorModel: "codex-default" },
      { creatorFamily: "gpt", creatorModel: "codex exec (llama3)" },
    ]) {
      const { result, rows, gptCalls } = await runWorkflow(sc);
      expect(result.status, JSON.stringify(sc)).toBe("NELZE_OVERIT");
      expect(gptCalls).toHaveLength(0);
      expect(rows).toHaveLength(0);
      expect(fs.existsSync(path.join(dir, "decision.json"))).toBe(false);
    }
  });

  it("codex nehlásí model OpenAI → GPT verdikty neověřené, rada bez GPT → NELZE_OVERIT (nikdy PASS)", async () => {
    for (const gptModel of ["codex-default", "llama3.1:70b"]) {
      fs.rmSync(path.join(dir, "konzilium"), { recursive: true, force: true }); // each run needs a fresh folder
      const { result, rows } = await runWorkflow({ gptModel });
      expect(result.status, gptModel).toBe("NELZE_OVERIT");
      expect(String(result.reason)).toMatch(/obou rodin/);
      expect(rows).toHaveLength(0);
      const rada = JSON.parse(fs.readFileSync(path.join(dir, "konzilium/rada.json"), "utf8")) as { experts: Array<{ role: string; ok: boolean; error?: string }> };
      expect(rada.experts.find((e) => e.role === "ux-ui")).toMatchObject({ ok: false, error: "Nelze ověřit rodinu modelu" });
    }
  });

  it("soudce GPT s neověřeným modelem (tvůrce Claude) → NELZE_OVERIT, decision.json ani řádek nevznikne", async () => {
    const { result, rows } = await runWorkflow({
      creatorFamily: "claude",
      creatorModel: "claude -p --model opus",
      gptModel: (file) => (file.startsWith("soudce") ? "codex-default" : "gpt-6.1-sol"),
    });
    expect(result.status).toBe("NELZE_OVERIT");
    expect(String(result.reason)).toMatch(/Nelze ověřit: soudce není prokazatelně rodiny gpt/);
    expect(rows).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, "decision.json"))).toBe(false);
  });

  it("soudce dvakrát vymyslí text mimo drafty → NELZE_OVERIT, žádný řádek", async () => {
    const { result, rows, calls } = await runWorkflow({ out: { "soudce-a0.json": judgeJson("Nový nadpis, který v draftu není"), "soudce-a1.json": judgeJson("Ani tenhle tam není") } });
    expect(result.status).toBe("NELZE_OVERIT");
    expect(String(result.reason)).toMatch(/není celý blok z draftu/);
    expect(rows).toHaveLength(0);
    // the second attempt got the code's objections
    expect(calls.filter((c) => /OPRAV \(minulý pokus neprošel kontrolou kódu\)/.test(c.prompt))).toHaveLength(1);
  });

  it("soudce opraví citaci na 2. pokus → projde", async () => {
    const { result } = await runWorkflow({ out: { "soudce-a0.json": judgeJson("Vymyšlený nadpis") } });
    expect(result.status).toBe("WAITING_OWNER");
  });

  it("prompt pozměněný při přenosu → most GPT nezavolá (sha), role chybí", async () => {
    const { gptCalls, result } = await runWorkflow({ tamperGptPrompt: true });
    expect(gptCalls).toHaveLength(0);
    // 2 GPT experts missing (3/5 readable, Claude only) → families cannot be mixed
    expect(result.status).toBe("NELZE_OVERIT");
  });

  it("kontrola zapracování: PASS s medium nálezem není PASS → zapracování zahozeno, balíček na původním draftu", async () => {
    const { result } = await runWorkflow({ out: { "zapracovani-kontrola.json": JSON.stringify({ verdict: "PASS", findings: [{ severity: "medium", file: null, line: null, text: "x" }] }) } });
    expect(result.status).toBe("WAITING_OWNER");
    const pkg = readDecision();
    expect(pkg.drafts.revised).toBeUndefined();
    expect(pkg.disputes[0]).toMatch(/Zapracování konzilia neprošlo kontrolou \(FIX: Nelze ověřit/);
  });

  it("panel:false zapíše jen decision.json", async () => {
    const { result, rows } = await runWorkflow({ panel: false });
    expect(result.status).toBe("WAITING_OWNER");
    expect(rows).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, "decision.json"))).toBe(true);
  });
  it("nový běh ve složce s výstupy jiného běhu se nespustí (staré PASS se nikdy nepoužije)", async () => {
    expect((await runWorkflow()).result.status).toBe("WAITING_OWNER");
    fs.rmSync(path.join(dir, "decision.json"));
    const second = await runWorkflow({ out: { "soudce-a0.json": judgeJson("Vymyšlený"), "soudce-a1.json": judgeJson("Vymyšlený") } });
    expect(second.result.status).toBe("FAILED");
    expect(String(second.result.reason)).toMatch(/výstupy jiného běhu/);
    expect(second.gptCalls).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, "decision.json"))).toBe(false);
  });

  it("tajemství v draftu zastaví běh v přípravě, nic nejde žádnému modelu", async () => {
    const { result, calls, gptCalls } = await runWorkflow({ draft: `${DRAFT}\nklíč: sk-ant-${"a".repeat(30)}\n` });
    expect(result.status).toBe("FAILED");
    expect(String(result.reason)).toMatch(/secret-scan/);
    expect(gptCalls).toHaveLength(0);
    expect(calls.filter((c) => c.opts.agentType !== "konzilium-transport")).toHaveLength(0);
  });

  it("tajemství ve výstupu role Claude zastaví běh, do zpětné vazby se nedostane", async () => {
    const { result, gptCalls } = await runWorkflow({ out: { "brand-strateg.json": expert().replace("Shrnutí.", `ghp_${"b".repeat(36)}`) } });
    expect(result.status).toBe("FAILED");
    expect(String(result.reason)).toMatch(/secret-scan/);
    expect(fs.existsSync(path.join(dir, "konzilium/zpetna-vazba.md"))).toBe(false);
    expect(gptCalls.some((c) => c.file === "draft-konzilium.md")).toBe(false);
  });
});

describe("kolo 3: nálezy 2. kontroly GPT", () => {
  const guard = (profile: string, input: Record<string, unknown>) =>
    spawnSync("python3", [path.join(ROOT, ".claude/hooks/konzilium-guard.py"), profile], {
      input: JSON.stringify(input),
      env: { ...process.env, TARS_KONZILIUM_LOG_DIR: process.env.TARS_KONZILIUM_LOG_DIR },
    }).status;
  const W = (file_path: string) => ({ tool_name: "Write", tool_input: { file_path, content: "{}" } });

  it("nález 1: hook dovolí každé roli zapsat jen její výstup, transportu jen vstupní soubor a příkaz mostu", () => {
    const k = path.join(dir, "konzilium");
    fs.mkdirSync(k, { recursive: true });
    expect(guard("advokat", W(path.join(k, "advokat.json")))).toBe(0);
    expect(guard("tvurce", W(path.join(k, "draft-konzilium.md")))).toBe(0);
    expect(guard("kontrolor", W(path.join(k, "zapracovani-kontrola.json")))).toBe(0);
    expect(guard("soudce", W(path.join(k, "soudce-a1.json")))).toBe(0);
    expect(guard("transport", W(path.join(k, ".in-0000beef.txt")))).toBe(0);
    for (const [profile, f] of [
      ["tvurce", "zapracovani-kontrola.json"], // the creator cannot forge the other family's check
      ["tvurce", "zapracovani-kontrola.json.meta.json"],
      ["advokat", "ux-ui.json"],
      ["soudce", "soudce-a2.json"],
      ["kontrolor", "draft-konzilium.md"],
      ["transport", "ux-ui.json"],
      ["transport", "ux-ui.json.meta.json"],
      ["neznamy", "advokat.json"],
    ] as const)
      expect(guard(profile, W(path.join(k, f))), `${profile} ${f}`).toBe(2);
    expect(guard("advokat", W(path.join(dir, "advokat.json")))).toBe(2); // not in konzilium/
    expect(guard("advokat", { tool_name: "Edit", tool_input: { file_path: path.join(k, "advokat.json") } })).toBe(2);
    expect(guard("advokat", { tool_name: "Read", tool_input: { file_path: path.join(os.homedir(), ".tars/konzilium-keys/0000beef.key") } })).toBe(2);
    expect(guard("advokat", { tool_name: "Read", tool_input: { file_path: path.join(k, "ux-ui.json.meta.json") } })).toBe(2);
    expect(guard("advokat", { tool_name: "Read", tool_input: { file_path: path.join(dir, "draft-v1.md") } })).toBe(0);
    expect(guard("advokat", { tool_name: "Bash", tool_input: { command: "npx tsx tars/orch/konzilium-bridge.ts council --out '/x'" } })).toBe(2);
    expect(guard("transport", { tool_name: "Bash", tool_input: { command: "npx tsx tars/orch/konzilium-bridge.ts council --out '/x'" } })).toBe(0);
    for (const c of ["npx tsx tars/orch/konzilium-bridge.ts council --out '/x'; rm -rf /", "cat ~/.tars/konzilium-keys/a.key", "npx tsx tars/orch/konzilium-bridge.ts council --out $(id)", "echo hi"])
      expect(guard("transport", { tool_name: "Bash", tool_input: { command: c } }), c).toBe(2);
    const sym = path.join(k, "brand-strateg.json");
    fs.symlinkSync(path.join(dir, "draft-v1.md"), sym);
    expect(guard("brand-strateg", W(sym))).toBe(2);
  });

  it("nález 1: každá Claude role i transport mají v definici hook se svým profilem; bez něj se Konzilium nespustí", () => {
    expect(loadCards().problems).toEqual([]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kcards-"));
    for (const f of fs.readdirSync(CARDS)) fs.copyFileSync(path.join(CARDS, f), path.join(tmp, f));
    fs.writeFileSync(path.join(tmp, "tvurce.md"), fs.readFileSync(path.join(tmp, "tvurce.md"), "utf8").replace('konzilium-guard.py" tvurce', 'konzilium-guard.py" kontrolor'));
    expect(loadCards(tmp).problems.join()).toMatch(/tvurce: chybí hook konzilium-guard/);
    fs.writeFileSync(path.join(tmp, "transport.md"), fs.readFileSync(path.join(tmp, "transport.md"), "utf8").replace("tools: Bash, Write", "tools: Bash, Write, Read"));
    expect(loadCards(tmp).problems.join()).toMatch(/transport:/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("nález 1: podvržená kontrola GPT od Claude tvůrce (i kdyby hook neběžel) se nezapočte – bez klíče běhu nejde záznam o původu padělat", async () => {
    const forge = (file: string, k: string) => {
      if (file !== "draft-konzilium.md") return;
      const check = JSON.stringify({ verdict: "PASS", findings: [] });
      fs.writeFileSync(path.join(k, "zapracovani-kontrola.json"), check);
      const meta = { family: "gpt", model: "gpt-6.1-sol", verified: true, role: "kontrola", run_id: JSON.parse(fs.readFileSync(path.join(k, "run.json"), "utf8")).run_id, sha: fnv1a(check), mac: "0".repeat(64) };
      fs.writeFileSync(path.join(k, "zapracovani-kontrola.json.meta.json"), JSON.stringify(meta));
    };
    const { result, gptCalls } = await runWorkflow({ creatorFamily: "claude", creatorModel: "claude -p --model opus", onClaudeWrite: forge });
    expect(result.status).toBe("WAITING_OWNER");
    expect(gptCalls.some((c) => c.file === "zapracovani-kontrola.json")).toBe(false); // existing file is never overwritten
    const pkg = readDecision();
    expect(pkg.drafts.revised).toBeUndefined(); // forged PASS did not count
    expect(pkg.disputes[0]).toMatch(/Nelze ověřit: kontrolor není prokazatelně rodiny gpt/);
    // a record without the run key (or with a wrong one) never proves anything
    const k = path.join(dir, "konzilium");
    fs.rmSync(process.env.TARS_KONZILIUM_KEYS!, { recursive: true, force: true });
    expect(provenFamily(path.join(k, "ux-ui.json"), "gpt", JSON.parse(fs.readFileSync(path.join(k, "run.json"), "utf8")).run_id)).toBeUndefined();
  });

  it("nález 2: tajemství v jakémkoli poli args (mission, panel_title) zastaví běh v přípravě", async () => {
    for (const field of ["mission", "panel_title", "draft_url", "creator_role"]) {
      fs.rmSync(path.join(dir, "konzilium"), { recursive: true, force: true });
      const r = prep(dir, { out_dir: dir, draft: "draft-v1.md", creator_family: "gpt", creator_model: "codex exec (gpt-6.1-sol)", brief: BRIEF, [field]: `x ghp_${"c".repeat(36)}` } as never, "2026-11-02T19:00:00.000Z");
      expect(r, field).toMatchObject({ ok: false, status: "FAILED", error: expect.stringMatching(/secret-scan: args/) });
    }
  });

  it("nález 2: řádek ani archiv pro Notion s tajemstvím se nezapíšou", async () => {
    const r = prep(dir, { out_dir: dir, draft: "draft-v1.md", creator_family: "gpt", creator_model: "codex exec (gpt-6.1-sol)", brief: BRIEF, panel_title: "TEST", archive_parent: "p" } as never, "2026-11-02T19:00:00.000Z");
    expect(r.ok).toBe(true);
    const runFile = path.join(dir, "konzilium", "run.json");
    const run = JSON.parse(fs.readFileSync(runFile, "utf8"));
    fs.writeFileSync(runFile, JSON.stringify({ ...run, panel_title: `T xoxb-${"1".repeat(20)}` }));
    fs.writeFileSync(path.join(dir, "decision.json"), JSON.stringify({ author: { model: "m" }, recommended: { label: "A", summary: "S.", blocks: [] }, alternative: null, reasons: [], experts: [], advocate: [], disputes: [], honest_note: "n" }));
    let writes = 0;
    const deps = { sink: { upsert: async () => (writes++, "row") }, archive: async () => (writes++, "https://app.notion.com/p/x") };
    expect(await panel(dir, deps)).toMatchObject({ ok: false, status: "FAILED", error: expect.stringMatching(/secret-scan: archiv/) });
    fs.writeFileSync(runFile, JSON.stringify({ ...run, archive_parent: undefined, panel_title: `T xoxb-${"1".repeat(20)}` }));
    expect(await panel(dir, deps)).toMatchObject({ ok: false, status: "FAILED", error: expect.stringMatching(/secret-scan: řádek/) });
    expect(writes).toBe(0);
  });

  it("nález 3: tvůrce „claude -p --model llama3“ → NELZE_OVERIT, nic se nespustí", async () => {
    for (const m of ["claude -p --model llama3", "sonnet (llama3)"]) {
      const { result, gptCalls } = await runWorkflow({ creatorFamily: "claude", creatorModel: m });
      expect(result.status, m).toBe("NELZE_OVERIT");
      expect(gptCalls).toHaveLength(0);
    }
  });

  it("nález 4: tajemství ve výstupu GPT (odborník i tvůrce) zastaví běh", async () => {
    const secret = `AKIA${"B".repeat(16)}`;
    const a = await runWorkflow({ out: { "ux-ui.json": expert().replace("Shrnutí.", secret) } });
    expect(a.result.status).toBe("FAILED");
    expect(String(a.result.reason)).toMatch(/secret-scan/);
    expect(fs.existsSync(path.join(dir, "konzilium", "zpetna-vazba.md"))).toBe(false);
    fs.rmSync(path.join(dir, "konzilium"), { recursive: true, force: true });
    const b = await runWorkflow({ out: { "draft-konzilium.md": `${REVISED}\n${secret}\n` } });
    expect(b.result.status).toBe("FAILED");
    expect(String(b.result.reason)).toMatch(/secret-scan/);
    expect(b.calls.some((c) => /Jsi KONTROLOR/.test(c.prompt))).toBe(false);
    expect(fs.existsSync(path.join(dir, "decision.json"))).toBe(false);
  });
});

describe("konzilium-bridge: původ, vstupy, panel", () => {
  const ARGS = (over: Record<string, unknown> = {}) => ({ out_dir: dir, draft: "draft-v1.md", creator_family: "gpt", creator_model: "codex exec (gpt-6.1-sol)", brief: BRIEF, ...over });
  const noIO = { stdin: async () => "", now: () => "2026-11-02T19:00:00.000Z", gptDeps: () => ({ run: async () => ({ ok: false, text: "", limit: false }), model: () => "" }), panelDeps: () => ({ sink: { upsert: async () => "x" } }) } as BridgeIO;

  it("Claude výstup bez záznamu, z jiného běhu nebo se změněným obsahem se nezapočte", () => {
    const r = prep(dir, ARGS() as never, "2026-11-02T19:00:00.000Z");
    expect(r.ok).toBe(true);
    const f = path.join(dir, "konzilium", "brand-strateg.json");
    fs.writeFileSync(f, expert());
    expect(provenFamily(f, "claude", r.run!.run_id)).toBeUndefined(); // no record = not proven
    expect(attest(dir, ["brand-strateg.json"]).attested).toEqual(["brand-strateg.json"]);
    expect(provenFamily(f, "claude", r.run!.run_id)).toMatchObject({ family: "claude" });
    expect(provenFamily(f, "claude", "jinybeh")).toBeUndefined();
    expect(provenFamily(f, "gpt", r.run!.run_id)).toBeUndefined();
    expect(attest(dir, ["brand-strateg.json"]).ok).toBe(false); // a record is never overwritten
    fs.writeFileSync(f, expert("PALEC"));
    expect(provenFamily(f, "claude", r.run!.run_id)).toBeUndefined(); // changed after attest
    expect(attest(dir, ["../x.json"]).ok).toBe(false);
  });

  it("--sha a --in: jen 8 hex znaků, jen soubor v konzilium/, mazání až po shodě součtu", async () => {
    fs.mkdirSync(path.join(dir, "konzilium"), { recursive: true });
    const victim = path.join(dir, "obet.txt");
    fs.writeFileSync(victim, "nesmí zmizet");
    const r1 = await main(["prep", "--out", dir, "--sha", "x/../../obet", "--in", victim], noIO).catch((e: Error) => ({ ok: false, error: e.message }));
    expect(r1).toMatchObject({ ok: false });
    expect(fs.existsSync(victim)).toBe(true);
    const inFile = path.join(dir, "konzilium", ".in-0000beef.txt");
    fs.writeFileSync(inFile, "jiný obsah");
    const r2 = await main(["prep", "--out", dir, "--sha", "0000beef", "--in", inFile], noIO).catch((e: Error) => ({ ok: false, error: e.message }));
    expect(r2).toMatchObject({ ok: false });
    expect(fs.existsSync(inFile)).toBe(true); // wrong checksum → nothing deleted
    fs.rmSync(inFile);
    fs.symlinkSync(victim, inFile);
    const r3 = await main(["prep", "--out", dir, "--sha", "0000beef", "--in", inFile], noIO).catch((e: Error) => ({ ok: false, error: e.message }));
    expect(r3).toMatchObject({ ok: false });
    expect(fs.existsSync(victim)).toBe(true);
  });

  it("GPT nedostane vstup s tajemstvím a výstup se nikdy nepřepíše", async () => {
    const r = prep(dir, ARGS({ sources: [{ key: "handoff", path: "sources/handoff.md" }] }) as never, "2026-11-02T19:00:00.000Z");
    expect(r.ok).toBe(true);
    let called = 0;
    const deps = { run: async () => (called++, { ok: true, text: expert(), limit: false }), model: () => "gpt-6.1-sol" };
    const bad = `Prompt {{FILE:${path.join(dir, "sources", "handoff.md")}}}`;
    fs.appendFileSync(path.join(dir, "sources", "handoff.md"), `\nAKIA${"A".repeat(16)}\n`);
    const { gpt } = await import("../konzilium-bridge");
    expect(await gpt(dir, "ux-ui", "expert", "ux-ui.json", fnv1a(bad), bad, deps)).toMatchObject({ ok: false, error: expect.stringMatching(/secret-scan/) });
    expect(called).toBe(0);
    const ok = "Prompt bez tajemství";
    expect(await gpt(dir, "ux-ui", "expert", "ux-ui.json", fnv1a(ok), ok, deps)).toMatchObject({ ok: true, verified: true });
    expect(await gpt(dir, "ux-ui", "expert", "ux-ui.json", fnv1a(ok), ok, deps)).toMatchObject({ ok: false, error: expect.stringMatching(/nepřepisuje/) });
    expect(provenFamily(path.join(dir, "konzilium", "ux-ui.json"), "gpt", r.run!.run_id)).toMatchObject({ family: "gpt" });
  });

  it("panel: nejasný výsledek prvního zápisu → druhý pokus řádek znovu nezaloží", async () => {
    const r = prep(dir, ARGS({ panel_title: "TEST" }) as never, "2026-11-02T19:00:00.000Z");
    fs.writeFileSync(path.join(dir, "decision.json"), JSON.stringify({ author: { model: "m" }, recommended: { label: "A", summary: "S.", blocks: [] }, alternative: null }));
    let creates = 0;
    const lost = { sink: { upsert: async () => { creates++; throw new Error("odpověď se ztratila"); } } };
    await expect(panel(dir, lost)).rejects.toThrow();
    expect(await panel(dir, { sink: { upsert: async () => (creates++, "row") } })).toMatchObject({ ok: false, status: "FAILED" });
    expect(creates).toBe(1);
    expect(r.ok).toBe(true);
  });
});

describe("konzilium-bridge", () => {
  it("fnv1a is identical in the workflow script and in the bridge", () => {
    const { src } = loadWorkflow();
    const body = /function fnv1a\(s\) \{[\s\S]*?\n\}/.exec(src)![0];
    const scriptFnv = new Function(`${body}; return fnv1a`)() as (s: string) => string;
    for (const s of ["", "a", "Příliš žluťoučký kůň „úpěl“ ďábelské ódy\n", JSON.stringify({ x: [1, "ž"] })]) expect(scriptFnv(s)).toBe(fnv1a(s));
  });

  it("families: model descriptions and codex-reported models", () => {
    expect(familyOf("claude -p --model opus")).toBe("claude");
    expect(familyOf("Claude Opus")).toBe("claude");
    expect(familyOf("codex exec (gpt-6.1-sol)")).toBe("gpt");
    expect(familyOf("gpt-6.1-sol")).toBe("gpt");
    expect(familyOf("codex exec · claude")).toBeUndefined();
    expect(familyOf("llama")).toBeUndefined();
    expect(familyOf("codex-default")).toBeUndefined();
    expect(familyOf("codex exec")).toBeUndefined();
    expect(familyOf("codex exec (llama3)")).toBeUndefined();
    expect(familyOf("codex exec (o3)")).toBe("gpt");
    // the CLI name never proves the family: only the model counts (round 2, finding 3)
    for (const m of ["claude -p --model llama3", "claude -p --model unknown-provider", "sonnet (llama3)", "claude", "claude -p", "opus-killer (x)", "claude -p --model opus (llama3)"])
      expect(familyOf(m), m).toBeUndefined();
    expect(familyOf("claude -p --model sonnet")).toBe("claude");
    expect(familyOf("claude -p --model claude-opus-5-5")).toBe("claude");
    expect(familyOf("codex exec -m gpt-5-codex")).toBe("gpt");
    expect(isGptModel("gpt-6.1-sol")).toBe(true);
    expect(isGptModel("codex-default")).toBe(false);
    expect(isGptModel("gpt-5-codex")).toBe(true);
    expect(isGptModel("llama3")).toBe(false);
  });

  it("cards: 7 roles, rada = mix Claude/GPT, Claude roles are Opus subagents with Read+Write, GPT roles are not subagents, shared section = krok 2", () => {
    const { cards, problems } = loadCards();
    expect(problems).toEqual([]);
    expect(Object.keys(cards).sort()).toEqual(["advokat", "brand-strateg", "eticky-strazce", "hlas-zakaznika", "kontrolor", "prodejni-psycholog", "soudce", "tvurce", "ux-ui"]);
    expect(["ux-ui", "hlas-zakaznika"].map((r) => cards[r].family)).toEqual(["gpt", "gpt"]);
    expect(["advokat", "prodejni-psycholog", "brand-strateg", "eticky-strazce"].map((r) => cards[r].family)).toEqual(["claude", "claude", "claude", "claude"]);
    expect(cards.soudce.family).toBe("cross");
    expect(["tvurce", "kontrolor"].map((r) => cards[r].family)).toEqual(["claude", "claude"]);
    // frontmatter must be valid YAML (Claude Code skips definitions it cannot parse)
    const req = createRequire(__filename);
    let yaml: { load(s: string): unknown } | undefined;
    try {
      yaml = req("js-yaml") as { load(s: string): unknown };
    } catch {
      yaml = undefined;
    }
    for (const c of Object.values(cards)) {
      const fm = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(c.file, "utf8"))![1];
      for (const line of fm.split("\n")) {
        const v = /^[a-z_]+: (.*)$/.exec(line)?.[1] ?? "";
        if (!v.startsWith('"')) expect(v, `${c.role}: ${line}`).not.toMatch(/: | #|^[&*!|>'%@`{[]/);
      }
      if (yaml) {
        const doc = yaml.load(fm) as Record<string, unknown>;
        expect(doc.role, c.role).toBe(c.role);
        if (c.agent) expect([doc.name, doc.model, doc.tools], c.role).toEqual([c.agent, "opus", "Read, Write"]);
      }
    }
    const shared = (f: string) => fs.readFileSync(f, "utf8").split("\n## Společné podklady")[1];
    const ref = shared(path.join(ROOT, ".claude/agents/supervizor.md"));
    for (const c of Object.values(cards)) {
      expect(shared(c.file), c.role).toBe(ref);
      const text = fs.readFileSync(c.file, "utf8");
      for (const s of ["## 1. Mise role a model", "## 2. Kanonické vstupy", "## 3. Zamčené kontrakty a zákazy", "## 4. Výstup", "## 5. Akceptační kritéria", "## 6. Kontrolor", "## 7. Eskalace na vlastníka", "## Postup", "## Dosah", "## Příčka §2b"])
        expect(text, `${c.role} ${s}`).toContain(`\n${s}`);
      expect(text).not.toContain("`../_spolecne.md`");
    }
    // a broken card stops the Konzilium
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kcards-"));
    for (const f of fs.readdirSync(CARDS)) fs.copyFileSync(path.join(CARDS, f), path.join(tmp, f));
    fs.writeFileSync(path.join(tmp, "ux-ui.md"), fs.readFileSync(path.join(tmp, "ux-ui.md"), "utf8").replace("family: gpt", "family: claude"));
    fs.writeFileSync(path.join(tmp, "hlas-zakaznika.md"), fs.readFileSync(path.join(tmp, "hlas-zakaznika.md"), "utf8").replace("family: gpt", "family: claude"));
    expect(loadCards(tmp).problems.join()).toMatch(/name musí být|mezi Claude a GPT/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("schemas are strict for codex --output-schema (additionalProperties:false, every key required)", () => {
    const check = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.type === "object") {
        expect(o.additionalProperties).toBe(false);
        expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as object).sort());
      }
      Object.values(o).forEach(check);
    };
    for (const s of [EXPERT_SCHEMA, ADVOCATE_SCHEMA, JUDGE_SCHEMA]) check(s);
  });

  it("quotes: only whole lines of a draft, never fragments", () => {
    const v = (text: string) => ({ label: "A", summary: "", blocks: [{ kind: "headline" as const, text }] });
    expect(quoteProblems([v("Váš vztah, oblast po oblasti")], [DRAFT])).toEqual([]);
    expect(quoteProblems([v("990 Kč")], [DRAFT])).toHaveLength(1);
  });

  it("panel row is computed by code and the bridge never queries the Notion database (no SQL / rows)", () => {
    for (const f of [WF, path.join(ROOT, "tars/orch/konzilium-bridge.ts")]) {
      const t = fs.readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/query[-_]data[-_]sources|notion-query|\bSELECT\b|mode:\s*"?rows/i);
    }
    const row = konziliumPanelRow(
      { panel_title: "T", order: "o", mission: "MEZI VÁMI", brief: BRIEF, creator: { family: "gpt", model: "codex exec (gpt-6.1-sol)", role: "r" }, now: "2026-11-02T19:00:00.000Z" } as never,
      { author: { model: "workflow /konzilium (Claude Opus)" }, recommended: { label: "A", summary: "Proč.", blocks: [] }, alternative: null } as never,
      null,
    );
    expect(row).toMatchObject({ Stav: "WAITING_OWNER", "Čeká na vlastníka": "__YES__", "Odkaz na výstup": null, "Kolo oprav": 0 });
  });
});
