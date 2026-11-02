// Mock data for tests and ?demo=1 ONLY. Never mixed with real runs: the server picks either
// readLiveInput() or one of these scenarios, and demo views always carry the „Ukázková data“ label.
import type { LogEntry, Order, OrderState, StateTransitionRecord } from "../types";
import type { McInput } from "./view";

export const SCENARIOS = ["aktivita", "oprava", "cekani", "chyba", "dokonceni", "prazdno", "paralel"] as const;
export type Scenario = (typeof SCENARIOS)[number];

const CARDS: Record<string, string> = {
  supervizor: "Řídí práci na misi: vybere další zakázku z HANDOFF a napíše její zadání; sám netvoří ani nekontroluje.",
  "copy-studio": "Píše zákaznickou komunikaci MEZI VÁMI: marketing copy, UX copy, offer framing, CTA, contextual polish (Build OS §4).",
  vizual: "Navrhuje vizuál: visual direction, hierarchy, component look, responsive behavior, interaction patterns (Build OS §4).",
  vyvojar: "Implementuje Next.js/TypeScript: implementace, migrace, testy, refactoring, fixes (Build OS §4 „Claude Code / Sonnet — Executor“).",
  brana: "Nezávislá brána: adversarial review, contract drift, privacy/security/data integrity/product fidelity, release gate (Build OS §4 „GPT — Independent Gate“).",
};

const t = (base: number, min: number) => new Date(base + min * 60_000).toISOString();

function order(id: string, created: string, state: OrderState, history: Array<[OrderState, OrderState, string, string]>, extra: Partial<Order> = {}): Order {
  const h: StateTransitionRecord[] = history.map(([from, to, event, at]) => ({ from, to, event, at }));
  return {
    id,
    mission: "mezi-vami",
    state,
    created_at: created,
    updated_at: h.at(-1)?.at ?? created,
    fix_rounds: 0,
    manual_interventions: 0,
    history: h,
    meta: {},
    brief: {
      title: "COPY_SYSTEM_V1 — hlas, glosář a copy deck pro obrazovky prototypu",
      department: "copy",
      milestone: "3.1",
      why: "HANDOFF, DALŠÍ KROK: paralelně běží 3.1 Copy systém.",
      goal: "Navrhnout hlas značky, glosář a texty čtyř obrazovek prototypu jako Notion DRAFT.",
      inputs: [],
      acceptance: ["Pokrývá Landing hero, Proof of Computation, odhalení a checkout.", "Žádné dark patterns."],
      owner_decisions: [],
      sources: ["handoff", "funnel"],
    },
    ...extra,
  };
}

/** Builds a scenario relative to `now` so durations look live. */
export function scenario(name: Scenario, now = new Date().toISOString()): McInput {
  const base = Date.parse(now) - 30 * 60_000;
  const guard: LogEntry = { ts: t(base, 0), order: "-", kind: "guard", result: "OK" };
  const common = { cards: CARDS, files: {} as Record<string, string[]>, now, demo: true, scheduler: true };
  const sup = (o: string, m: number, result = "ok"): LogEntry => ({ ts: t(base, m), order: o, kind: "call", role: "supervisor", model: "opus", family: "claude", duration_ms: 48_000, result });
  const chk = (o: string, m: number, result: string, model = "gpt-6.1-sol", reason = ""): LogEntry => ({ ts: t(base, m), order: o, kind: "call", role: "checker", model, family: model.includes("opus") ? "claude" : "gpt", duration_ms: 40_000, result, reason });
  const tr = (o: string, m: number, from: OrderState, to: OrderState, event: string, role: LogEntry["role"]): LogEntry => ({ ts: t(base, m), order: o, kind: "transition", from, to, event, role });
  const cre = (o: string, m: number, result = "ok"): LogEntry => ({ ts: t(base, m), order: o, kind: "call", role: "creator", model: "codex exec (gpt-6.1-sol)", family: "gpt", duration_ms: 250_000, result });

  // an earlier finished order (gives the timeline and the order list some history)
  const prevId = "wo-demo-0900";
  const prev = order(prevId, t(base, -60), "FAILED", [
    ["NEW", "PLANNED", "planned", t(base, -58)],
    ["PLANNED", "DOING", "start", t(base, -58)],
    ["DOING", "CHECKING", "created", t(base, -54)],
    ["CHECKING", "FAILED", "verdict", t(base, -53)],
  ], { failure_reason: "checker BLOCK: BLOCK (karta, bod 2): chybí povinný zdroj Funnel V1.", card_role: "copy-studio" });
  const prevLog: LogEntry[] = [
    sup(prevId, -59), chk(prevId, -58, "PASS"), tr(prevId, -58, "NEW", "PLANNED", "planned", "supervisor"), tr(prevId, -58, "PLANNED", "DOING", "start", "orchestrator"),
    cre(prevId, -54), tr(prevId, -54, "DOING", "CHECKING", "created", "creator"), chk(prevId, -53, "BLOCK", "claude -p --model opus (opus)", "chybí Funnel V1"), tr(prevId, -53, "CHECKING", "FAILED", "verdict", "checker"),
  ];

  const id = "wo-demo-1000";
  switch (name) {
    case "prazdno":
      return { ...common, orders: [], log: [guard], lock: { present: false, alive: false } };
    case "aktivita": {
      const o = order(id, t(base, 0), "DOING", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
      ], { card_role: "copy-studio" });
      return {
        ...common,
        orders: [prev, o],
        log: [...prevLog, guard, sup(id, 1), chk(id, 2, "PASS"), tr(id, 2, "NEW", "PLANNED", "planned", "supervisor"), tr(id, 2, "PLANNED", "DOING", "start", "orchestrator")],
        lock: { present: true, alive: true, mtime: t(base, 0) },
      };
    }
    case "oprava": {
      const o = order(id, t(base, 0), "FIXING", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
        ["DOING", "CHECKING", "created", t(base, 7)],
        ["CHECKING", "FIXING", "verdict", t(base, 8)],
      ], { card_role: "copy-studio", fix_rounds: 1, last_issues: ["CTA v hero chybí sekundární akce."] });
      return {
        ...common,
        orders: [prev, o],
        log: [...prevLog, guard, sup(id, 1), chk(id, 2, "PASS"), tr(id, 2, "NEW", "PLANNED", "planned", "supervisor"), tr(id, 2, "PLANNED", "DOING", "start", "orchestrator"), cre(id, 7), tr(id, 7, "DOING", "CHECKING", "created", "creator"), chk(id, 8, "FIX", "claude -p --model opus (opus)", "CTA v hero chybí sekundární akce."), tr(id, 8, "CHECKING", "FIXING", "verdict", "checker")],
        lock: { present: true, alive: true, mtime: t(base, 0) },
      };
    }
    case "paralel": {
      // §2d: three orders at once, each with its own lock and recipe (§2c).
      const call = (o: string, m: number, role: LogEntry["role"], card: string, model: string, result: string, dur = 60_000): LogEntry =>
        ({ ts: t(base, m), order: o, kind: "call", role, model, family: model.includes("gpt") || model.includes("codex") ? "gpt" : "claude", duration_ms: dur, result, card }) as LogEntry;
      const p1 = order("wo-demo-p1", t(base, 0), "CHECKING", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
        ["DOING", "CHECKING", "created", t(base, 14)],
        ["CHECKING", "FIXING", "verdict", t(base, 15)],
        ["FIXING", "CHECKING", "revised", t(base, 19)],
      ], {
        fix_rounds: 1,
        recipe: { id: "copy", version: "1", steps: [{ role: "reserser", label: "Rešeršér" }, { role: "strazce-hlasu", label: "Strážce hlasu" }, { role: "copy-studio" }, { role: "kontrolor", kind: "check" }] },
        recipe_step: 3,
      } as Partial<Order>);
      const p2 = order("wo-demo-p2", t(base, 6), "DOING", [
        ["NEW", "PLANNED", "planned", t(base, 8)],
        ["PLANNED", "DOING", "start", t(base, 8)],
      ], {
        brief: { ...order("x", now, "NEW", []).brief!, title: "Formulář sběru údajů narození — validace a chybové stavy", department: "dev", milestone: "2.4" },
        recipe: { id: "vyvoj", version: "1", steps: [{ role: "architekt", label: "Architekt" }, { role: "vyvojar", label: "Implementace" }, { role: "ci", label: "Testy a CI", kind: "check" }, { role: "brana", label: "Code review", kind: "check" }, { role: "pr", label: "PR draft", kind: "deliver" }] },
        recipe_step: 1,
      } as Partial<Order>);
      const p3 = order("wo-demo-p3", t(base, 24), "NEW", [], { brief: undefined });
      return {
        ...common,
        cardDocs: {
          "copy-studio": { role: "copy-studio", title: "GPT — Copy Studio", model: "codex exec (GPT)", adapter: "codex", rung: "1", file: "tars/orch/specialists/mezi-vami/copy-studio.md", mission: CARDS["copy-studio"], postup: ["1. Načíst podklady od rešeršéra a strážce hlasu", "2. Navrhnout 3 směry", "3. Vybrat nejsilnější", "4. Rozepsat", "5. Sebekontrola proti zákazům"] },
        },
        orders: [prev, p1, p2, p3],
        log: [
          ...prevLog,
          guard,
          sup("wo-demo-p1", 1), chk("wo-demo-p1", 2, "PASS"), tr("wo-demo-p1", 2, "NEW", "PLANNED", "planned", "supervisor"),
          call("wo-demo-p1", 6, "creator", "reserser", "claude -p --model sonnet", "ok", 200_000),
          call("wo-demo-p1", 9, "creator", "strazce-hlasu", "claude -p --model opus", "ok", 150_000),
          call("wo-demo-p1", 14, "creator", "copy-studio", "codex exec (gpt-6.1-sol)", "ok", 280_000), tr("wo-demo-p1", 14, "DOING", "CHECKING", "created", "creator"),
          { ...chk("wo-demo-p1", 15, "FIX", "claude -p --model opus (opus)", "Chybí sekundární CTA."), card: "kontrolor" } as LogEntry, tr("wo-demo-p1", 15, "CHECKING", "FIXING", "verdict", "checker"),
          call("wo-demo-p1", 19, "creator", "copy-studio", "codex exec (gpt-6.1-sol)", "ok", 190_000), tr("wo-demo-p1", 19, "FIXING", "CHECKING", "revised", "creator"),
          sup("wo-demo-p2", 7), chk("wo-demo-p2", 8, "PASS"), tr("wo-demo-p2", 8, "NEW", "PLANNED", "planned", "supervisor"),
          call("wo-demo-p2", 12, "creator", "architekt", "claude -p --model opus", "ok", 210_000),
        ],
        lock: { present: false, alive: false },
        orderLocks: { "wo-demo-p1": { present: true, alive: true }, "wo-demo-p2": { present: true, alive: true }, "wo-demo-p3": { present: true, alive: true } },
      };
    }
    case "cekani": {
      const o = order(id, t(base, 0), "WAITING_OWNER", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
        ["DOING", "CHECKING", "created", t(base, 7)],
        ["CHECKING", "DELIVERED", "verdict", t(base, 8)],
        ["DELIVERED", "WAITING_OWNER", "delivered", t(base, 9)],
      ], {
        card_role: "copy-studio",
        owner_needed: true,
        owner_reasons: ["Schválení copy systému 3.1 je vyhrazené Sponzorovi."],
        delivered_url: "https://app.notion.com/p/demo-draft",
        owner_card_url: "https://app.notion.com/p/demo-go-karta",
      });
      return {
        ...common,
        orders: [prev, o],
        log: [...prevLog, guard, sup(id, 1), chk(id, 2, "PASS"), tr(id, 2, "NEW", "PLANNED", "planned", "supervisor"), tr(id, 2, "PLANNED", "DOING", "start", "orchestrator"), cre(id, 7), tr(id, 7, "DOING", "CHECKING", "created", "creator"), chk(id, 8, "PASS", "claude -p --model opus (opus)"), tr(id, 8, "CHECKING", "DELIVERED", "verdict", "checker"), tr(id, 9, "DELIVERED", "WAITING_OWNER", "delivered", "orchestrator")],
        lock: { present: false, alive: false },
      };
    }
    case "chyba": {
      const o = order(id, t(base, 0), "UNKNOWN", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
        ["DOING", "UNKNOWN", "unknown", t(base, 3)],
      ], {
        card_role: "vizual",
        failure_reason: "creator: UI_UNKNOWN: krok 3 (fill) selhal: locator.fill: Timeout 30000ms exceeded.",
        brief: { ...order(id, now, "NEW", []).brief!, title: "Principy pohybu pro vizuální směr 3.2 (DRAFT)", department: "vizual", milestone: "3.2" },
      });
      return {
        ...common,
        orders: [prev, o],
        log: [...prevLog, guard, sup(id, 1), chk(id, 2, "PASS"), tr(id, 2, "NEW", "PLANNED", "planned", "supervisor"), tr(id, 2, "PLANNED", "DOING", "start", "orchestrator"), { ts: t(base, 3), order: id, kind: "call", role: "creator", model: "Claude Design (prohlížeč, profil TARS-agent)", family: "claude", result: "error", reason: "UI_UNKNOWN" }, tr(id, 3, "DOING", "UNKNOWN", "unknown", "creator")],
        lock: { present: false, alive: false },
      };
    }
    case "dokonceni": {
      const o = order(id, t(base, 0), "DONE", [
        ["NEW", "PLANNED", "planned", t(base, 2)],
        ["PLANNED", "DOING", "start", t(base, 2)],
        ["DOING", "CHECKING", "created", t(base, 7)],
        ["CHECKING", "DELIVERED", "verdict", t(base, 8)],
        ["DELIVERED", "DONE", "delivered", t(base, 9)],
      ], { card_role: "copy-studio", owner_needed: false, delivered_url: "https://app.notion.com/p/demo-draft" });
      return {
        ...common,
        orders: [prev, o],
        log: [...prevLog, guard, sup(id, 1), chk(id, 2, "PASS"), tr(id, 2, "NEW", "PLANNED", "planned", "supervisor"), tr(id, 2, "PLANNED", "DOING", "start", "orchestrator"), cre(id, 7), tr(id, 7, "DOING", "CHECKING", "created", "creator"), chk(id, 8, "PASS", "claude -p --model opus (opus)"), tr(id, 8, "CHECKING", "DELIVERED", "verdict", "checker"), tr(id, 9, "DELIVERED", "DONE", "delivered", "orchestrator")],
        lock: { present: false, alive: false },
      };
    }
  }
}
