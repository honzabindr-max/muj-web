export type CrawlState = {
  current_depth: number;
  status: string;
  processed: number;
  queue_size: number;
  current_prefix: string;
  queries_total: number;
  new_total: number;
  count_before: number;
  count_after: number;
  updated_at: string;
  started_at: string;
  queue: string;
  next_queue: string;
};

export type EngineId = "seznam" | "google";

export type CrawlSnapshot = {
  count: number;
  state: CrawlState | null;
  latest: string;
  recent: { id: number; phrase: string }[];
};

export const STALE_THRESHOLD_S = 180;
