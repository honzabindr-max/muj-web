// TARS-ORCH-001 v0 — shared types.
// Spec: Notion "TARS-ORCH-001 v0.1" §3–§7. The state machine is deterministic code;
// LLMs only produce text (supervisor = order brief, creator = draft, checker = verdict).

export const STATES = [
  "NEW",
  "PLANNED",
  "DOING",
  "CHECKING",
  "FIXING",
  "DELIVERED",
  "WAITING_OWNER",
  "DONE",
  "PAUSED",
  "FAILED",
  "UNKNOWN",
] as const;
export type OrderState = (typeof STATES)[number];

export const TERMINAL_STATES: readonly OrderState[] = [
  "DONE",
  "FAILED",
  "UNKNOWN",
];

export type ModelFamily = "claude" | "gpt";

export type Department = "dev" | "copy" | "vizual";

export type Verdict = "PASS" | "FIX" | "BLOCK";

/** Brief written by the supervisor (Opus). Validated by code before use. */
export interface OrderBrief {
  title: string;
  department: Department;
  /** HANDOFF milestone the order belongs to, e.g. "3.1". */
  milestone: string;
  /** Why this order now (citation of ACTIVE TRACK / DALŠÍ KROK). */
  why: string;
  goal: string;
  inputs: string[];
  acceptance: string[];
  /** Sponsor-reserved decisions touched (LOCK, price, brand, payments, legal, CTE). */
  owner_decisions: string[];
}

export interface StateTransitionRecord {
  from: OrderState;
  to: OrderState;
  event: string;
  at: string;
}

export interface Order {
  id: string;
  mission: string;
  state: OrderState;
  created_at: string;
  updated_at: string;
  brief?: OrderBrief;
  /** Number of FIXING rounds already used. */
  fix_rounds: number;
  /** Max FIXING rounds from the creator card (≤ MAX_FIX_ROUNDS); default MAX_FIX_ROUNDS. */
  max_fix_rounds?: number;
  /** Creator specialist card role (TARS-ORCH-001 §2a). */
  card_role?: string;
  /** State to return to after PAUSED. */
  paused_from?: OrderState;
  resume_after?: string;
  /** Latest checker feedback (input for FIXING). */
  last_issues?: string[];
  /** Path (relative to order dir) of the current draft artifact. */
  draft_file?: string;
  /** Deliverable location: PR URL or Notion page URL. */
  delivered_url?: string;
  /** Owner card URL (Notion) when WAITING_OWNER. */
  owner_card_url?: string;
  owner_needed?: boolean;
  owner_reasons?: string[];
  failure_reason?: string;
  /** Manual interventions by a human between NEW and DELIVERED (goal 0). */
  manual_interventions: number;
  history: StateTransitionRecord[];
  /** Department-specific scratch data (branch name, worktree path, ...). */
  meta: Record<string, string>;
}

export interface LogEntry {
  ts: string;
  order: string;
  kind: "transition" | "call" | "guard" | "secret_scan" | "info" | "error";
  role?: "supervisor" | "creator" | "checker" | "transport" | "orchestrator";
  model?: string;
  family?: ModelFamily | "none";
  from?: OrderState;
  to?: OrderState;
  event?: string;
  duration_ms?: number;
  fix_rounds?: number;
  manual_interventions?: number;
  result?: string;
  reason?: string;
}
