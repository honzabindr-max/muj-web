// Konzilium (§2e), decision card (/rozhodnuti) and merge policy (DR-024) — mocked models, no network.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  dosahToolOpts,
  type AdapterResult,
  type RunOpts,
  type TextAdapter,
} from "../adapters";
import { CardRegistry } from "../cards";
import {
  csrfToken,
  decisionRoute,
  hostOriginOk,
  isLoopback,
  renderDecisionPage,
} from "../decision-card";
import { CopyDepartment } from "../departments";
import { NotImplementedDesktop } from "../desktop";
import {
  finalizeQuestions,
  Konzilium,
  mandatoryQuestions,
  parseAdvocate,
  parseExpert,
  parseJudge,
  quoteProblems,
  readPackage,
  type DecisionPackage,
} from "../konzilium";
import {
  classifyPaths,
  MAX_REVIEW_DIFF,
  MergeRunner,
  packageJsonDepsChanged,
  parseChecks,
  type Exec,
} from "../merge-policy";
import type { NotionClient } from "../notion";
import { Orchestrator, SecretScanningAdapter } from "../orchestrator";
import { DecisionPrepDepartment, prepDeterministicIssues } from "../prep";
import { SourceLoader } from "../sources";
import { transition } from "../state-machine";
import { Store } from "../store";
import type { ModelFamily, Order, OrderBrief } from "../types";

const NOW = "2026-11-02T12:00:00.000Z";
const CARDS_DIR = path.join(__dirname, "..", "specialists", "mezi-vami");
const J = (o: unknown) => "```json\n" + JSON.stringify(o) + "\n```";

type Responder = (prompt: string, opts: RunOpts) => Partial<AdapterResult>;
class Mock implements TextAdapter {
  calls: Array<{ prompt: string; opts: RunOpts }> = [];
  name = "mock";
  constructor(
    public family: ModelFamily,
    public model: string,
    private respond: Responder,
  ) {}
  async run(prompt: string, opts: RunOpts): Promise<AdapterResult> {
    this.calls.push({ prompt, opts });
    return {
      ok: true,
      text: "",
      limit: false,
      duration_ms: 3,
      ...this.respond(prompt, opts),
    };
  }
}
class MockNotion implements NotionClient {
  pages: Array<{ title: string; md: string }> = [];
  async createPage(_p: string, title: string, md: string) {
    this.pages.push({ title, md });
    return { url: `https://app.notion.com/p/mock${this.pages.length}` };
  }
}

const COPY_DRAFT = `# Podrobněji o vašem vztahu\n\n## Směr A\n\nRozsáhlá designovaná analýza. ${"Tichý, sebejistý text. ".repeat(20)}\n\nObjednat Hloubkovou analýzu\n\n## Směr B\n\nVáš vztah v širších souvislostech\n\nPokračovat k objednávce analýzy\n\n## Kontrola kritérií\n- ok`;
const PREP_DRAFT = `# Příprava\n\n## Otázka\nnázev\n\n## Možnosti\n### Možnost 1: Ponechat MEZI VÁMI\nPonechat pracovní název MEZI VÁMI pro ČR.\n### Možnost 2: Globální název\nZvolit nový globální název před 5.2.\n\n## Doporučení\nDoporučuji možnost 1 do testu T5 5.3.\n\n${"Zdroj: handoff. ".repeat(30)}\n\n## Kontrola kritérií\n- ok`;

const OFFER_BRIEF: OrderBrief = {
  title: "COPY_SYSTEM_V1 – část B: copy pro placenou nabídku (R1.d Paid Offer)",
  department: "copy",
  milestone: "3.1",
  why: "DALŠÍ KROK",
  goal: "Copy placené nabídky Hloubková analýza",
  inputs: ["fakt"],
  acceptance: ["kritérium"],
  owner_decisions: ["cena 1 990 Kč je pracovní", "název a značka"],
  sources: [
    "handoff",
    "capsule",
    "buildos",
    "funnel",
    "ui_build_brief",
    "copy_handoff",
  ],
};

function expertJson(role: string) {
  if (role.includes("Etický"))
    return J({ verdict: "PALEC", summary: "Bez dark patterns.", changes: [] });
  return J({
    verdict: "UPRAVA",
    summary: "Zjasnit hodnotu.",
    changes: [
      {
        target: "Objednat Hloubkovou analýzu",
        proposal: "Objednat Hloubkovou analýzu za 1 990 Kč",
        reason: "kotva ceny",
        source: "handoff č. 2",
      },
    ],
  });
}

function claudeResponder(): Responder {
  return (p) => {
    if (p.includes("Jsi SUPERVIZOR")) return { text: J(OFFER_BRIEF) };
    if (p.includes("ADVOKÁT PRVNÍHO PRINCIPU"))
      return {
        text: J({
          questions: [
            {
              question: "Proč 48 hodin?",
              why: "HANDOFF 3.7",
              touches: "none",
              decision_key: "sla",
            },
          ],
        }),
      };
    if (p.includes("SOUDCE KONZILIA"))
      return {
        text: J({
          recommended: {
            label: "Směr A",
            summary: "kratší",
            blocks: [
              { kind: "headline", text: "Podrobněji o vašem vztahu" },
              { kind: "lede", text: "Rozsáhlá designovaná analýza." },
              { kind: "cta", text: "Objednat Hloubkovou analýzu" },
            ],
          },
          alternative: {
            label: "Směr B",
            summary: "delší",
            blocks: [
              { kind: "headline", text: "Váš vztah v širších souvislostech" },
              { kind: "cta", text: "Pokračovat k objednávce analýzy" },
            ],
          },
          reasons: ["prodejní psycholog: kotva"],
          disputes: [],
        }),
      };
    if (p.includes("v Konziliu projektu"))
      return { text: expertJson(p.slice(0, 200)) };
    if (p.includes("REŠERŠÉR")) return { text: PREP_DRAFT };
    if (p.includes("KONTROLOR"))
      return { text: J({ verdict: "PASS", issues: [] }) };
    return { text: J({ verdict: "PASS", issues: [] }) };
  };
}

function gptResponder(): Responder {
  return (p) => {
    if (p.includes("KROK KONZILIUM"))
      return {
        text: p.includes("REŠERŠÉR")
          ? PREP_DRAFT
          : COPY_DRAFT +
            "\n\n## Zapracování konzilia\n| role | úprava | přijato | důvod |",
      };
    if (p.includes("SOUDCE KONZILIA"))
      return {
        text: J({
          recommended: {
            label: "Možnost 1",
            summary: "",
            blocks: [
              {
                kind: "option",
                label: "Možnost 1: Ponechat MEZI VÁMI",
                text: "Ponechat pracovní název MEZI VÁMI pro ČR.",
              },
            ],
          },
          alternative: {
            label: "Možnost 2",
            summary: "",
            blocks: [
              {
                kind: "option",
                label: "Možnost 2: Globální název",
                text: "Zvolit nový globální název před 5.2.",
              },
            ],
          },
          reasons: ["hlas zákazníka"],
          disputes: [],
        }),
      };
    if (p.includes("v Konziliu projektu"))
      return { text: expertJson(p.slice(0, 200)) };
    if (p.includes("Jsi copywriter")) return { text: COPY_DRAFT };
    return { text: J({ verdict: "PASS", issues: [] }) };
  };
}

let dir: string;
let store: Store;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tars-konz-"));
  store = new Store(dir);
});

function build(opts: { claude?: Responder; gpt?: Responder; now?: string } = {}) {
  const claude = new Mock("claude", "opus", opts.claude ?? claudeResponder());
  const gpt = new Mock("gpt", "gpt-x", opts.gpt ?? gptResponder());
  const notion = new MockNotion();
  const sources = new SourceLoader(notion, dir, path.join(dir, "cache"));
  const cards = new CardRegistry(CARDS_DIR);
  const o = new Orchestrator({
    store,
    supervisor: claude,
    briefChecker: gpt,
    departments: {
      copy: new CopyDepartment(new SecretScanningAdapter(gpt), claude),
      prep: new DecisionPrepDepartment(claude, gpt),
    },
    cards,
    ladder: {
      hasCli: () => true,
      browserReady: () => ({ ok: false, reasons: ["x"] }),
      desktopReady: () => new NotImplementedDesktop().preflight(),
    },
    notion,
    guard: () => ({ alarm: false, summary: "OK" }),
    draftParentId: "parent",
    repoRoot: dir,
    capsulePath: path.join(dir, "capsule.md"),
    sources,
    konzilium: new Konzilium({
      cards: new CardRegistry(path.join(CARDS_DIR, "konzilium")),
      adapters: { claude, gpt },
      loadSources: (k) => sources.loadAll(k),
      now: () => new Date(NOW),
    }),
    now: () => new Date(opts.now ?? NOW),
  });
  return { o, claude, gpt, notion };
}

describe("Konzilium cards (§2a + §2c Postup/Dosah)", () => {
  it("all Konzilium cards validate and the council is split between Claude and GPT", () => {
    const k = new Konzilium({
      cards: new CardRegistry(path.join(CARDS_DIR, "konzilium")),
      adapters: {} as never,
      loadSources: async () => [],
      now: () => new Date(),
    });
    expect(k.check()).toEqual([]);
  });
  it("copy and prep creator cards carry Postup + Dosah and are valid", () => {
    const reg = new CardRegistry(CARDS_DIR);
    expect(reg.creatorFor("copy").ok).toBe(true);
    expect(reg.creatorFor("prep").card?.tools).toEqual([
      "WebSearch",
      "WebFetch",
    ]);
    expect(reg.text("copy-studio")).toMatch(
      /## Postup[\s\S]*## Dosah[\s\S]*Recept §2c/,
    );
  });
  it("Konzilium card text includes the shared rules from the parent directory", () => {
    expect(
      new CardRegistry(path.join(CARDS_DIR, "konzilium")).text("advokat"),
    ).toContain("<<<_spolecne.md");
  });
  it("Dosah is enforced as CLI flags: none = every built-in tool disallowed", () => {
    expect(dosahToolOpts([]).disallowedTools).toContain("Bash");
    const web = dosahToolOpts(["WebSearch", "WebFetch"]);
    expect(web.allowedTools).toEqual(["WebSearch", "WebFetch"]);
    expect(web.disallowedTools).not.toContain("WebSearch");
    expect(web.disallowedTools).toContain("Write");
  });
});

describe("Konzilium parsers (deterministic)", () => {
  it("paid-offer copy gets the three mandatory questions; name questions are Sponsor-reserved", () => {
    const qs = finalizeQuestions(
      parseAdvocate(
        J({
          questions: [
            {
              question: "Proč tenhle název placené vrstvy?",
              why: "x",
              touches: "none",
            },
          ],
        }),
      ),
      mandatoryQuestions(OFFER_BRIEF),
    );
    expect(qs.filter((q) => q.mandatory).map((q) => q.decision_key)).toEqual([
      "nazev-produktu",
      "nazev-placene-vrstvy",
      "konverze-textu",
    ]);
    expect(qs.find((q) => q.decision_key === "konverze-textu")?.touches).toBe(
      "none",
    );
    expect(
      qs.filter((q) => q.touches === "sponsor").length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("code backstop: a question about a name is Sponsor-reserved even when the model says none", () => {
    const [q] = finalizeQuestions(
      [
        {
          question: "Proč se vrstva jmenuje takhle?",
          why: "x",
          touches: "none",
        },
      ],
      [],
    );
    expect(q.touches).toBe("sponsor");
  });
  it("expert verdict requires a known mark; changes without source are flagged", () => {
    expect(
      parseExpert(J({ verdict: "VÝHRADA", summary: "s", changes: [] }))
        ?.verdict,
    ).toBe("VYHRADA");
    expect(
      parseExpert(J({ verdict: "UPRAVA", summary: "s", changes: [] })),
    ).toBeUndefined();
    expect(
      parseExpert(
        J({
          verdict: "UPRAVA",
          summary: "s",
          changes: [{ target: "a", proposal: "b", reason: "c" }],
        }),
      )?.changes[0].no_source,
    ).toBe(true);
    expect(parseExpert("nevím")).toBeUndefined();
  });
  it("judge may only quote drafts", () => {
    const j = parseJudge(
      J({
        recommended: {
          label: "A",
          blocks: [
            { kind: "headline", text: "Podrobněji o vašem vztahu" },
            { kind: "cta", text: "Kupte hned teď!" },
          ],
        },
        alternative: null,
      }),
    )!;
    expect(quoteProblems([j.recommended], [COPY_DRAFT])).toHaveLength(1);
  });
  it("prep drafts need 2–3 options and a recommendation", () => {
    expect(prepDeterministicIssues(PREP_DRAFT)).toEqual([]);
    expect(
      prepDeterministicIssues(
        PREP_DRAFT.replace(/### Možnost 2[^\n]*\n/, ""),
      )[0],
    ).toMatch(/2–3 možnosti/);
  });
});

describe("state machine (KONZILIUM, ALT, SUPERSEDED)", () => {
  const base: Order = {
    id: "wo-x",
    mission: "m",
    state: "DELIVERED",
    created_at: NOW,
    updated_at: NOW,
    fix_rounds: 0,
    manual_interventions: 0,
    history: [],
    meta: {},
  };
  it("DELIVERED → KONZILIUM → WAITING_OWNER → DONE (ALT)", () => {
    const k = transition(
      base,
      { type: "delivered", owner_needed: true, konzilium: true },
      NOW,
    );
    expect(k.state).toBe("KONZILIUM");
    const w = transition(k, { type: "konzilium_done" }, NOW);
    expect(w.state).toBe("WAITING_OWNER");
    const d = transition(w, { type: "owner", decision: "ALT" }, NOW);
    expect([d.state, d.owner_choice]).toEqual(["DONE", "ALT"]);
  });
  it("SUPERSEDED is terminal and not a REJECT", () => {
    const s = transition(
      { ...base, state: "WAITING_OWNER" },
      { type: "supersede", reason: "Konzilium" },
      NOW,
    );
    expect(s.state).toBe("SUPERSEDED");
    expect(s.owner_choice).toBeUndefined();
    expect(() => transition(s, { type: "resume" }, NOW)).toThrow();
  });
});

describe("orchestrator with Konzilium (mock models)", () => {
  it("offer copy: NEW → … → KONZILIUM → WAITING_OWNER with decision.json, prep orders and Notion archive", async () => {
    const { o, notion, claude, gpt } = build();
    expect((await o.tick()).status).toBe("waiting_owner");
    const main = store
      .listOrders()
      .find((x) => x.brief?.department === "copy")!;
    expect(main.state).toBe("WAITING_OWNER");
    expect(main.history.map((h) => h.to)).toEqual([
      "PLANNED",
      "DOING",
      "CHECKING",
      "DELIVERED",
      "KONZILIUM",
      "WAITING_OWNER",
    ]);
    const pkg = readPackage(store.orderDir(main.id))!;
    expect(pkg.recommended.label).toBe("Směr A");
    expect(pkg.alternative?.label).toBe("Směr B");
    expect(pkg.author.family).toBe("claude"); // creator GPT → judge Claude
    expect(pkg.honest_note).toMatch(/T5 5\.3/);
    expect(pkg.experts).toHaveLength(5);
    expect(new Set(pkg.experts.map((e) => e.family))).toEqual(
      new Set(["claude", "gpt"]),
    );
    expect(pkg.prep_orders).toHaveLength(2);
    expect(notion.pages.map((p) => p.title.split(" — ")[0])).toEqual([
      "DRAFT",
      "KARTA (archiv)",
    ]);
    expect(notion.pages[1].md).toContain(`/rozhodnuti/${main.id}`);
    // Dosah: Claude experts ran with every built-in tool disallowed.
    expect(
      claude.calls
        .filter((c) => c.prompt.includes("v Konziliu projektu"))
        .every((c) => c.opts.disallowedTools?.includes("Bash")),
    ).toBe(true);
    expect(gpt.calls.some((c) => c.prompt.includes("KROK KONZILIUM"))).toBe(
      true,
    );
    const preps = store.listOrders().filter((x) => x.parent_order === main.id);
    expect(preps.map((x) => [x.state, x.decision_key])).toEqual([
      ["PLANNED", "nazev-produktu"],
      ["PLANNED", "nazev-placene-vrstvy"],
    ]);
  });

  it("prep orders run next (research with WebSearch only) and reach their own decision card; no recursion", async () => {
    const { o, claude } = build();
    await o.tick();
    await o.tick();
    await o.tick();
    const preps = store
      .listOrders()
      .filter((x) => x.brief?.department === "prep");
    expect(preps.map((x) => x.state)).toEqual([
      "WAITING_OWNER",
      "WAITING_OWNER",
    ]);
    const pkg = readPackage(store.orderDir(preps[0].id))!;
    expect(pkg.kind).toBe("prep");
    expect(pkg.author.family).toBe("gpt"); // creator Claude → judge GPT
    expect(pkg.prep_orders).toEqual([]);
    expect(store.listOrders()).toHaveLength(3);
    const research = claude.calls.find((c) => c.prompt.includes("REŠERŠÉR"))!;
    expect(research.opts.allowedTools).toEqual(["WebSearch", "WebFetch"]);
    expect((await o.tick()).status).toBe("waiting_owner"); // WIP: nothing new while cards wait
  });

  it("owner ALT is recorded in decision.json; supersede --redo gives the supervisor a priority hint", async () => {
    const { o, claude } = build();
    await o.tick();
    const main = store
      .listOrders()
      .find((x) => x.brief?.department === "copy")!;
    const d = await o.owner(main.id, "ALT", "panel");
    expect([d.state, d.owner_choice]).toEqual(["DONE", "ALT"]);
    expect(readPackage(store.orderDir(main.id))!.owner_decision?.choice).toBe(
      "ALT",
    );
    await expect(o.owner(main.id, "GO")).rejects.toThrow(/nečeká/);

    // owner superseded an order with redo → next supervisor prompt carries PŘEDNOST
    for (const p of store.listOrders().filter((x) => x.state === "PLANNED")) o.supersede(p.id, "test", false);
    const fake: Order = { ...main, id: "wo-20261102-000000", state: "WAITING_OWNER", meta: {} };
    store.save(fake);
    expect(o.supersede(fake.id, "Konzilium", true).state).toBe("SUPERSEDED");
    const later = build({ now: "2026-11-02T13:00:00.000Z" });
    await later.o.tick();
    const sup = later.claude.calls.find((c) => c.prompt.includes("Jsi SUPERVIZOR"));
    expect(sup?.prompt).toContain("PŘEDNOST (vlastník)");
    expect(store.load(fake.id).meta.redone_by).toBe("wo-20261102-130000");
    void claude;
  });

  it("judge inventing copy → retried once, then UNKNOWN (never sent to the owner)", async () => {
    const bad = J({
      recommended: {
        label: "X",
        blocks: [
          { kind: "headline", text: "Úplně nový slogan" },
          { kind: "cta", text: "Koupit" },
        ],
      },
      alternative: null,
    });
    const base = claudeResponder();
    const { o } = build({
      claude: (p, op) =>
        p.includes("SOUDCE KONZILIA") ? { text: bad } : base(p, op),
    });
    await o.tick();
    const main = store
      .listOrders()
      .find((x) => x.brief?.department === "copy")!;
    expect(main.state).toBe("UNKNOWN");
    expect(
      fs.existsSync(
        path.join(store.orderDir(main.id), "konzilium", "soudce-a1.md"),
      ),
    ).toBe(true);
  });

  it("subscription limit in the council → PAUSED, resumes from cached verdicts", async () => {
    let limited = true;
    const base = gptResponder();
    let t = new Date(NOW).getTime();
    const { o, gpt } = build({
      gpt: (p, op) =>
        p.includes("v Konziliu projektu") && limited
          ? { ok: false, limit: true, error: "usage limit" }
          : base(p, op),
    });
    (o as unknown as { now: () => Date }).now = () => new Date(t);
    expect((await o.tick()).status).toBe("paused");
    limited = false;
    t += 2 * 60 * 60_000;
    const before = gpt.calls.length;
    await o.tick();
    const main = store
      .listOrders()
      .find((x) => x.brief?.department === "copy")!;
    expect(main.state).toBe("WAITING_OWNER");
    expect(gpt.calls.length - before).toBeGreaterThan(0);
  });
});

describe("decision card /rozhodnuti/<id>", () => {
  function pkg(): DecisionPackage {
    return {
      version: 1,
      order: "wo-1",
      kind: "copy",
      title: "Nabídka",
      milestone: "3.1",
      created_at: NOW,
      recommended: {
        label: "Směr A",
        summary: "",
        blocks: [
          { kind: "headline", text: "Podrobněji o vašem vztahu" },
          { kind: "cta", text: "Objednat Hloubkovou analýzu" },
        ],
      },
      alternative: {
        label: "Směr B",
        summary: "",
        blocks: [{ kind: "headline", text: "Váš vztah <b>x</b>" }],
      },
      reasons: [],
      disputes: [],
      experts: [
        {
          role: "ux-ui",
          title: "UX/UI",
          model: "m",
          family: "gpt",
          ok: true,
          verdict: "PALEC",
          summary: "ok",
          changes: [],
        },
      ],
      advocate: [],
      author: { role: "Soudce konzilia", model: "opus", family: "claude" },
      creator: { role: "c", model: "g", family: "gpt" },
      sponsor_reserved: [],
      honest_note: "T5 5.3",
      drafts: {},
      prep_orders: [],
    };
  }
  it("renders customer view with MEZI VÁMI tokens, escapes HTML, shows GO/ALT/REJECT only while waiting", () => {
    const html = renderDecisionPage(
      pkg(),
      { state: "WAITING_OWNER" } as Order,
      "tok",
    );
    expect(html).toContain("EB+Garamond");
    expect(html).toContain("#E8B391");
    expect(html).toContain('value="ALT"');
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(
      renderDecisionPage(
        pkg(),
        { state: "DONE", owner_choice: "GO" } as Order,
        "tok",
      ),
    ).not.toContain("<form");
  });
  it("host/origin and loopback checks", () => {
    expect(isLoopback("127.0.0.1")).toBe(true);
    expect(isLoopback("192.168.1.5")).toBe(false);
    expect(hostOriginOk("127.0.0.1:4747", undefined)).toBe(true);
    expect(hostOriginOk("127.0.0.1:4747", "http://127.0.0.1:4747")).toBe(true);
    expect(hostOriginOk("127.0.0.1:4747", "https://evil.example")).toBe(false);
    expect(hostOriginOk("evil.example:4747", undefined)).toBe(false);
  });
  it("POST: CSRF required; valid POST runs the owner path once; GET/POST over real HTTP", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tars-card-"));
    fs.mkdirSync(path.join(root, "wo-1"));
    fs.writeFileSync(
      path.join(root, "wo-1", "decision.json"),
      JSON.stringify(pkg()),
    );
    fs.writeFileSync(
      path.join(root, "wo-1", "state.json"),
      JSON.stringify({ id: "wo-1", state: "WAITING_OWNER" }),
    );
    const secret = Buffer.alloc(32, 7);
    const calls: string[] = [];
    const route = decisionRoute(root, {
      secret,
      runOwner: async (id, c) => (
        calls.push(`${id}:${c}`),
        { code: 0, out: "ok" }
      ),
    });
    const srv = http.createServer((q, s) => {
      if (!route(q, s)) s.writeHead(404).end();
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    const get = await fetch(`${base}/rozhodnuti/wo-1`);
    expect(get.status).toBe(200);
    expect(await get.text()).toContain(csrfToken("wo-1", secret));
    const post = (body: string, headers: Record<string, string> = {}) =>
      fetch(`${base}/rozhodnuti/wo-1`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...headers,
        },
        body,
      });
    expect((await post("choice=GO&csrf=bad")).status).toBe(403);
    expect(
      (
        await post(`choice=GO&csrf=${csrfToken("wo-1", secret)}`, {
          Origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await post(`choice=HACK&csrf=${csrfToken("wo-1", secret)}`)).status,
    ).toBe(403);
    const ok = await post(`choice=ALT&csrf=${csrfToken("wo-1", secret)}`, {
      Origin: base,
    });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/rozhodnuti/wo-1?ok=1");
    expect(calls).toEqual(["wo-1:ALT"]);
    expect((await fetch(`${base}/rozhodnuti`)).status).toBe(200);
    expect((await fetch(`${base}/jinde`)).status).toBe(404);
    srv.close();
  });
});

describe("merge policy DR-024", () => {
  it("class A: tars/**, docs/**, tests", () => {
    expect(
      classifyPaths([
        "tars/orch/konzilium.ts",
        "tars/orch/__tests__/x.test.ts",
        "docs/a.md",
        "README.md",
      ]).cls,
    ).toBe("A");
  });
  it.each([
    ["app/mezi-vami/page.tsx"],
    ["public/homepage.html"],
    ["supabase/migrations/1.sql"],
    [".claude/settings.json"],
    [".claude/hooks/tars-guard.sh"],
    ["tars/orch/guard/i8.sh"],
    ["tars/orch/guard.ts"],
    [".github/workflows/ci.yml"],
    ["package-lock.json"],
    ["CLAUDE.md"],
    ["scripts/crawler.py"],
    ["neco/neznameho.ts"],
  ])("class B: %s", (p) => {
    expect(classifyPaths(["tars/orch/x.ts", p]).cls).toBe("B");
  });
  it("package.json: scripts only = A, dependencies = B", () => {
    const a = JSON.stringify({ scripts: { a: "1" }, dependencies: { x: "1" } });
    const b = JSON.stringify({ scripts: { a: "2" }, dependencies: { x: "1" } });
    const c = JSON.stringify({ scripts: { a: "2" }, dependencies: { x: "2" } });
    expect(packageJsonDepsChanged(a, b)).toBe(false);
    expect(classifyPaths(["package.json"], { before: a, after: b }).cls).toBe(
      "A",
    );
    expect(classifyPaths(["package.json"], { before: a, after: c }).cls).toBe(
      "B",
    );
    expect(classifyPaths(["package.json"]).cls).toBe("B");
  });
  it("parses required checks", () => {
    expect(
      parseChecks(
        JSON.stringify([
          { name: "test", bucket: "pass" },
          { name: "janitor", bucket: "pass" },
          { name: "Vercel", bucket: "fail" },
        ]),
      ).pass,
    ).toBe(true);
    expect(
      parseChecks(
        JSON.stringify([
          { name: "test", bucket: "pending" },
          { name: "janitor", bucket: "pass" },
        ]),
      ).pending,
    ).toEqual(["test"]);
    expect(
      parseChecks(JSON.stringify([{ name: "test", bucket: "fail" }])).failed,
    ).toEqual(["test=fail"]);
  });

  function fakeGh(
    files: Array<string | [string, string]>,
    opts: { behind?: boolean; draft?: boolean; diff?: () => string; head?: () => string } = {},
  ) {
    const calls: string[] = [];
    let merged = false;
    let updated = false;
    const exec: Exec = (cmd, args) => {
      calls.push(`${cmd} ${args.join(" ")}`);
      if (args[0] === "pr" && args[1] === "view")
        return {
          code: 0,
          out: JSON.stringify({
            number: 9,
            headRefName: "h",
            baseRefName: "main",
            isDraft: opts.draft ?? true,
            mergeStateStatus: opts.behind && !updated ? "BEHIND" : "CLEAN",
            state: merged ? "MERGED" : "OPEN",
            headRefOid: opts.head ? opts.head() : updated ? "def" : "abc",
          }),
        };
      if (args[0] === "api") return { code: 0, out: files.map((f) => (Array.isArray(f) ? `${f[0]}\t${f[1]}` : `${f}\t`)).join("\n") };
      if (args[0] === "pr" && args[1] === "checks")
        return { code: 0, out: JSON.stringify([{ name: "test", bucket: "pass" }, { name: "janitor", bucket: "pass" }]) };
      if (args[0] === "pr" && args[1] === "diff") return { code: 0, out: opts.diff ? opts.diff() : "diff --git a/x b/x" };
      if (args[0] === "pr" && args[1] === "update-branch") updated = true;
      if (args[0] === "pr" && args[1] === "merge") merged = true;
      return { code: 0, out: "" };
    };
    return { exec, calls };
  }
  const reviewer = (verdict: string, family: ModelFamily = "gpt", extra: Partial<AdapterResult> = {}) =>
    new Mock(family, "gpt-x", () => ({ text: J({ verdict, issues: verdict === "PASS" ? [] : ["x"] }), ...extra }));
  const runner = (g: ReturnType<typeof fakeGh>, rv = reviewer("PASS")) => new MergeRunner({ exec: g.exec, cwd: "/", reviewer: rv, sleep: async () => {} });

  it("class A + green CI + PASS review of the other family → ready → update-branch → squash merge pinned to head", async () => {
    const g = fakeGh(["tars/orch/a.ts"], { behind: true });
    const r = await runner(g).run(9, "claude");
    expect(r.status).toBe("merged");
    expect(g.calls.filter((c) => /pr (ready|update-branch|merge)/.test(c))).toEqual(["gh pr ready 9", "gh pr update-branch 9", "gh pr merge 9 --squash --delete-branch --match-head-commit def"]);
  });
  it("reviewer prompt carries DR-024 authority; diff is data", async () => {
    const rv = reviewer("PASS");
    await runner(fakeGh(["tars/orch/a.ts"]), rv).run(9, "claude");
    expect(rv.calls[0].prompt).toContain("DR-024");
  });
  it("class B → owner card with binding; GO merges only the same diff", async () => {
    const g = fakeGh(["app/mezi-vami/page.tsx"]);
    const r = await runner(g).run(9, "claude");
    expect(r.status).toBe("owner");
    expect(g.calls.some((c) => c.includes("pr merge"))).toBe(false);
    if (r.status !== "owner") throw new Error();
    expect((await runner(g).run(9, "claude", { ownerGo: true })).status).toBe("blocked"); // no binding
    expect((await runner(g).run(9, "claude", { ownerGo: true, binding: { head: "abc", diff_sha256: "x" } })).status).toBe("blocked");
    expect((await runner(g).run(9, "claude", { ownerGo: true, binding: r.binding })).status).toBe("merged");
  });
  it("Sponsor-reserved decision forces class B even for class-A paths", async () => {
    const r = await runner(fakeGh(["tars/orch/a.ts"])).run(9, "claude", { forceOwner: ["cena"] });
    expect(r.status).toBe("owner");
  });
  it("review fails closed: FIX, adapter error with PASS text, oversized diff; same family refused", async () => {
    expect((await runner(fakeGh(["tars/orch/a.ts"]), reviewer("FIX")).run(9, "claude")).status).toBe("blocked");
    const err = await runner(fakeGh(["tars/orch/a.ts"]), reviewer("PASS", "gpt", { ok: false, error: "exit 1" })).run(9, "claude");
    expect(err).toMatchObject({ status: "blocked", reason: "review UNKNOWN" });
    const big = await runner(fakeGh(["tars/orch/a.ts"], { diff: () => "x".repeat(MAX_REVIEW_DIFF + 1) })).run(9, "claude");
    expect(big).toMatchObject({ status: "blocked", reason: "review UNKNOWN" });
    await expect(runner(fakeGh(["tars/orch/a.ts"]), reviewer("PASS", "claude")).run(9, "claude")).rejects.toThrow(/jiná rodina/);
  });
  it("head moving during review or diff changing after update-branch blocks the merge", async () => {
    let n = 0;
    const moving = fakeGh(["tars/orch/a.ts"], { head: () => (n++ === 0 ? "abc" : "zzz") });
    expect(await runner(moving).run(9, "claude")).toMatchObject({ status: "blocked", reason: "head PR se změnil během review" });
    let d = 0;
    const drift = fakeGh(["tars/orch/a.ts"], { behind: true, diff: () => (d++ === 0 ? "diff A" : "diff B") });
    expect((await runner(drift).run(9, "claude")).status).toBe("blocked");
    expect(drift.calls.some((c) => c.includes("pr merge"))).toBe(false);
  });
  it("renames are classified on both sides (app/** moved to docs/** is class B)", async () => {
    const r = await runner(fakeGh([["docs/old-page.tsx", "app/mezi-vami/page.tsx"]])).run(9, "claude");
    expect(r.status).toBe("owner");
  });
});

describe("owner decisions (locks, blocked merge)", () => {
  function waiting(id: string, pkgExtra: Partial<DecisionPackage> = {}): Store {
    const st = new Store(fs.mkdtempSync(path.join(os.tmpdir(), "tars-own-")));
    st.save({ id, mission: "m", state: "WAITING_OWNER", created_at: NOW, updated_at: NOW, fix_rounds: 0, manual_interventions: 0, history: [], meta: { merge_pr: "9", merge_blocked: "1" } });
    fs.writeFileSync(path.join(st.orderDir(id), "decision.json"), JSON.stringify({ kind: "merge", recommended: { label: "x", summary: "", blocks: [] }, alternative: null, merge: { pr: "u", cls: "B", reasons: [], files: [], blocked: true }, ...pkgExtra }));
    return st;
  }
  function orchFor(st: Store) {
    const a = new Mock("claude", "o", () => ({ text: "" }));
    const g = new Mock("gpt", "g", () => ({ text: "" }));
    return new Orchestrator({ store: st, supervisor: a, briefChecker: g, departments: {}, cards: new CardRegistry(CARDS_DIR), ladder: { hasCli: () => true, browserReady: () => ({ ok: false, reasons: [] }), desktopReady: () => ({ ok: false, reasons: [] }) }, notion: new MockNotion(), guard: () => ({ alarm: false, summary: "" }), draftParentId: "p", repoRoot: "/", capsulePath: "/x" });
  }
  it("GO on a blocked merge card is refused; REJECT works", async () => {
    const st = waiting("wo-b");
    const o = orchFor(st);
    await expect(o.owner("wo-b", "GO")).rejects.toThrow(/zablokován/);
    expect((await o.owner("wo-b", "REJECT")).state).toBe("FAILED");
  });
  it("concurrent decisions: a held per-order lock refuses the second decision", async () => {
    const st = waiting("wo-c");
    const o = orchFor(st);
    expect(st.acquireOrderLock("wo-c", "owner")).toBe(true);
    await expect(o.owner("wo-c", "REJECT")).rejects.toThrow(/rozhoduje jinde/);
    st.releaseOrderLock("wo-c", "owner");
    expect((await o.owner("wo-c", "REJECT")).state).toBe("FAILED");
    await expect(o.owner("wo-c", "REJECT")).rejects.toThrow(/nečeká/);
  });
  it("Dosah of Konzilium roles loads no MCP servers", () => {
    expect(dosahToolOpts([]).noMcp).toBe(true);
  });
});
