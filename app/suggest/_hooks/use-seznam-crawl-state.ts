"use client";

import { useEffect, useState } from "react";

const POLL_MS = 5_000;
const ACTIVE_THRESHOLD_S = 300; // 5 minut bez heartbeatu = idle

export type SeznamCrawlState = {
  status: string | null;
  processed: number;
  queue_size: number;
  current_prefix: string | null;
  new_total: number;
  count_before: number;
  count_after: number;
  updated_at: string | null;
};

export function isActive(state: SeznamCrawlState | null): boolean {
  if (!state?.updated_at) return false;
  const ageSec = (Date.now() - new Date(state.updated_at).getTime()) / 1000;
  return ageSec < ACTIVE_THRESHOLD_S;
}

export function useSeznamCrawlState() {
  const [state, setState] = useState<SeznamCrawlState | null>(null);

  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch("/api/suggest/seznam-status", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        setState({
          status: d.status ?? null,
          processed: d.processed ?? 0,
          queue_size: d.queue_size ?? 0,
          // proxy doesn't return current_prefix yet — renders as hidden badge
          current_prefix: d.current_prefix ?? null,
          new_total: d.new_total ?? 0,
          // proxy doesn't return count_before — default to count_after so delta shows "—"
          count_before: d.count_before ?? d.count_after ?? 0,
          count_after: d.count_after ?? 0,
          updated_at: d.updated_at ?? null,
        });
      } catch {
        // silent — retries on next poll
      }
    }

    fetchState();
    const id = setInterval(fetchState, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return state;
}
