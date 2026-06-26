"use client";

import { useEffect, useState } from "react";

const POLL_MS = 5_000;

export type SeznamStatus = {
  current_depth: number;
  status: string;
  processed: number;
  queue_size: number;
  new_total: number;
  count_after: number;
  updated_at: string | null;
  new_today: number;
};

export function useSeznamStatus() {
  const [data, setData] = useState<SeznamStatus | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/suggest/seznam-status", { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        // silent — retries next cycle
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return data;
}
