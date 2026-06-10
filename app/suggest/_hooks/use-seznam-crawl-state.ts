"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    async function fetch() {
      const { data } = await supabase
        .from("crawl_state")
        .select("status, processed, queue_size, current_prefix, new_total, count_before, count_after, updated_at")
        .eq("id", 1)
        .single();
      if (data) setState(data as SeznamCrawlState);
    }

    fetch();
    const id = setInterval(fetch, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return state;
}
