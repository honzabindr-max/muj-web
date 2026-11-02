// Deterministic order lifecycle (TARS-ORCH-001 §3).
// NEW → PLANNED → DOING → CHECKING → (FIXING ≤ 3) → DELIVERED → WAITING_OWNER → DONE
// side states: PAUSED (subscription limit), FAILED, UNKNOWN.

import type { Order, OrderState } from "./types";

export const MAX_FIX_ROUNDS = 3;

export type OrderEvent =
  | { type: "planned" }
  | { type: "start"; preflight: { ok: boolean; reasons: string[] } }
  | { type: "created" }
  | { type: "verdict"; verdict: "PASS" | "FIX" | "BLOCK"; issues?: string[] }
  | { type: "revised" }
  | { type: "delivered"; owner_needed: boolean }
  | { type: "owner"; decision: "GO" | "REJECT" }
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
      if (s === "WAITING_OWNER")
        return ev.decision === "GO" ? "DONE" : "FAILED";
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
      break;
    case "fail":
    case "unknown":
      next.failure_reason = ev.reason.slice(0, 500);
      break;
  }
  return next;
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
