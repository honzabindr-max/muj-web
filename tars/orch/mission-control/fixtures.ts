// Mock data for tests and ?demo=1 ONLY. Never mixed with real runs: the server picks either
// readLiveInput() or one of these scenarios, and demo views always carry the „Ukázková data“ label.
import type { LogEntry, Order, OrderState, StateTransitionRecord } from "../types";
import type { McInput } from "./view";

export const SCENARIOS = ["aktivita", "oprava", "cekani", "chyba", "dokonceni", "prazdno"] as const;
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
