export type DashboardRow = {
  source: "google" | "seznam";
  gl: string;
  hl: string;
  phrase_count: number;
  depth: number | null;
  depth_pct: number | null;
  processed: number | null;
  queries_total: number | null;
  new_total: number | null;
  queue_len: number | null;
  next_queue_len: number | null;
  current_prefix: string | null;
  status: "pending" | "running" | "paused" | "done" | null;
  updated_at: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  // Computed by frontend after fetch
  phrase_count_share?: number;
  new_24h?: number;
};

export type StateRow = {
  gl: string;
  hl: string;
  depth: number | null;
  depth_pct: number | null;
  processed: number | null;
  queries_total: number | null;
  new_total: number | null;
  queue_len: number | null;
  next_queue_len: number | null;
  current_prefix: string | null;
  status: string | null;
  updated_at: string | null;
};

export type New24hRow = {
  gl: string;
  hl: string;
  new_24h: number;
};

export type DashboardSummary = {
  totalPhrases: number;
  mutationCount: number;
  activeCount: number;
  idleCount: number;
  newPhrases24h: number;
};

export type SortKey =
  | "heartbeat"
  | "phrase_count"
  | "new_total"
  | "new_24h"
  | "depth_pct"
  | "updated_at"
  | "name";

export type FilterState = {
  search: string;
  onlyProblematic: boolean;
  groupByGl: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
};

// Heartbeat colour derived from updated_at age (never from status)
export const ALIVE_THRESHOLD_S = 60;
export const WARN_THRESHOLD_S = 180;

export function heartbeatColor(
  updatedAt: string | null,
): "green" | "amber" | "gray" {
  if (!updatedAt) return "gray";
  const age = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  if (age < ALIVE_THRESHOLD_S) return "green";
  if (age < WARN_THRESHOLD_S) return "amber";
  return "gray";
}

export function isHeartbeatAlive(updatedAt: string | null): boolean {
  return heartbeatColor(updatedAt) !== "gray";
}
