// Deterministic order lifecycle (TARS-ORCH-001 §3).
// NEW → PLANNED → DOING → CHECKING → (FIXING ≤ 3) → DELIVERED → WAITING_OWNER → DONE
// side states: PAUSED (subscription limit), FAILED, UNKNOWN.

import { goBlocker } from "./approval";
import type { Order, OrderState } from "./types";

export const MAX_FIX_ROUNDS = 3;

export type OrderEvent =
  | { type: "planned" }
  | { type: "start"; preflight: { ok: boolean; reasons: string[] } }
  | { type: "created" }
  | { type: "verdict"; verdict: "PASS" | "FIX" | "BLOCK"; issues?: string[] }
  | { type: "revised" }
  | { type: "delivered"; owner_needed: boolean }
  | { type: "owner"; decision: "GO" | "REJECT"; option?: "A" | "B" }
  /** Znovuvydání karty (`cli.ts reissue`): karta bez otisku se vrací do DELIVERED, další tick vydá novou s otiskem. */
  | { type: "reissue" }
  | { type: "limit"; resume_after: string }
  | { type: "resume" }
  | { type: "fail"; reason: string }
  | { type: "unknown"; reason: string };

export class TransitionError extends Error {}

const ACTIVE: readonly OrderState[] = [
  "NEW",
  "PLANNED",
  "DOING",
  "CHECKING",
  "FIXING",
  "DELIVERED",
];

function target(order: Order, ev: OrderEvent): OrderState {
  const s = order.state;
  switch (ev.type) {
    case "planned":
      if (s === "NEW") return "PLANNED";
      break;
    case "start":
      // §2a/§2b: no card or unmet adapter rules → never DOING.
      if (s === "PLANNED") return ev.preflight.ok ? "DOING" : "UNKNOWN";
      break;
    case "created":
      if (s === "DOING") return "CHECKING";
      break;
    case "verdict":
      if (s === "CHECKING") {
        if (ev.verdict === "PASS") return "DELIVERED";
        if (ev.verdict === "BLOCK") return "FAILED";
        return order.fix_rounds >= maxFix(order) ? "FAILED" : "FIXING";
      }
      break;
    case "revised":
      if (s === "FIXING") return "CHECKING";
      break;
    case "delivered":
      if (s === "DELIVERED") return ev.owner_needed ? "WAITING_OWNER" : "DONE";
      break;
    case "owner":
      if (s === "WAITING_OWNER") {
        if (ev.decision === "REJECT") return "FAILED";
        // DR-039: GO → DONE jen s otiskem schváleného obsahu a čerstvým read-backem cílové stránky.
        const blocker = goBlocker(order);
        if (blocker) throw new TransitionError(`GO → DONE zamítnuto: ${blocker}`);
        return "DONE";
      }
      break;
    case "reissue":
      // Jen karta bez otisku (stará verze před DR-039): karta s approved_hash se znovu nevydává.
      if (s === "WAITING_OWNER" && !order.meta.approved_hash) return "DELIVERED";
      break;
    case "limit":
      if (ACTIVE.includes(s)) return "PAUSED";
      break;
    case "resume":
      if (s === "PAUSED" && order.paused_from) return order.paused_from;
      break;
    case "fail":
      if (ACTIVE.includes(s) || s === "PAUSED") return "FAILED";
      break;
    case "unknown":
      if (ACTIVE.includes(s) || s === "PAUSED") return "UNKNOWN";
      break;
  }
  throw new TransitionError(`illegal transition: ${s} --${ev.type}-->`);
}

/** Pure: returns a new order; never mutates the input. */
export function transition(order: Order, ev: OrderEvent, now: string): Order {
  const to = target(order, ev);
  const next: Order = {
    ...order,
    state: to,
    updated_at: now,
    history: [
      ...order.history,
      { from: order.state, to, event: ev.type, at: now },
    ],
  };
  switch (ev.type) {
    case "verdict":
      next.last_issues = ev.issues ?? [];
      if (to === "FIXING") next.fix_rounds = order.fix_rounds + 1;
      if (to === "FAILED")
        next.failure_reason =
          ev.verdict === "BLOCK"
            ? `checker BLOCK: ${(ev.issues ?? []).join("; ")}`.slice(0, 500)
            : `fix limit ${maxFix(order)} exhausted`;
      break;
    case "delivered":
      next.owner_needed = ev.owner_needed;
      break;
    case "limit":
      next.paused_from = order.state;
      next.resume_after = ev.resume_after;
      break;
    case "resume":
      next.paused_from = undefined;
      next.resume_after = undefined;
      break;
    case "start":
      if (!ev.preflight.ok) next.failure_reason = `preflight: ${ev.preflight.reasons.join("; ")}`.slice(0, 500);
      break;
    case "owner":
      if (ev.decision === "REJECT") next.failure_reason = "owner REJECT";
      if (ev.option) next.meta = { ...order.meta, owner_option: ev.option };
      break;
    case "reissue":
      // Stará karta a všechna owner-pole zmizí (staré GO se nikdy nepřebírá). `reissue_round` je kolo karty: zakázka
      // dostane pro toto kolo nový řádek panelu a rozhodnutí se čte jen z něj (starý řádek je SUPERSEDED).
      next.meta = {
        ...Object.fromEntries(Object.entries(order.meta).filter(([k]) => !k.startsWith("owner_") && !k.startsWith("reissue_") && k !== "readback")),
        reissued_at: now,
        reissue_round: String(reissueRound(order) + 1),
      };
      next.owner_card_url = undefined;
      next.owner_reasons = undefined;
      next.owner_needed = undefined;
      break;
    case "fail":
    case "unknown":
      next.failure_reason = ev.reason.slice(0, 500);
      break;
  }
  return next;
}

/** Values of the Notion select „Rozhodnutí vlastníka“ (owner writes it on iPhone). */
export const OWNER_DECISION_VALUES = ["GO", "GO A", "GO B", "REJECT"] as const;
export type OwnerDecisionValue = (typeof OWNER_DECISION_VALUES)[number];

/** Deterministic mapping of the owner's select value to the `owner` event. Anything else → undefined (ignored). */
export function ownerEventFor(value: unknown): Extract<OrderEvent, { type: "owner" }> | undefined {
  switch (value) {
    case "GO":
      return { type: "owner", decision: "GO" };
    case "GO A":
      return { type: "owner", decision: "GO", option: "A" };
    case "GO B":
      return { type: "owner", decision: "GO", option: "B" };
    case "REJECT":
      return { type: "owner", decision: "REJECT" };
    default:
      return undefined;
  }
}

/** Kolo karty (`meta.reissue_round`): 0 = karta nikdy znovuvydaná. Nečitelná hodnota vyhodí chybu (nic se nepřijme). */
export function reissueRound(order: Order): number {
  const raw = order.meta.reissue_round;
  if (raw === undefined) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new TransitionError(`neplatné meta.reissue_round: ${String(raw).slice(0, 20)}`);
  return n;
}

export function maxFix(order: Order): number {
  return Math.min(order.max_fix_rounds ?? MAX_FIX_ROUNDS, MAX_FIX_ROUNDS);
}

export function isTerminal(s: OrderState): boolean {
  return s === "DONE" || s === "FAILED" || s === "UNKNOWN";
}

/** States where the orchestrator itself should act on the next tick. */
export function isActionable(s: OrderState): boolean {
  return ACTIVE.includes(s) || s === "PAUSED";
}
