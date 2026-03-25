"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CrawlSnapshot, CrawlState } from "../_lib/types";

const POLL_INTERVAL_MS = 3_000;

const EMPTY_SNAPSHOT: CrawlSnapshot = {
  count: 0,
  state: null,
  latest: "",
  recent: [],
};

type ConnectionStatus = "connected" | "error" | "loading";

async function fetchEngine(
  table: string,
  stateTable: string
): Promise<CrawlSnapshot> {
  const [countRes, stateRes, recentRes] = await Promise.all([
    supabase.from(table).select("*", { count: "exact", head: true }),
    supabase.from(stateTable).select("*").eq("id", 1).single(),
    supabase.from(table).select("id, phrase").order("id", { ascending: false }).limit(8),
  ]);

  const count = countRes.count ?? 0;
  const state = (stateRes.data as CrawlState) ?? null;
  const recent = (recentRes.data as { id: number; phrase: string }[]) ?? [];
  const latest = recent[0]?.phrase ?? "";

  return { count, state, latest, recent };
}

export function useCrawlData() {
  const [seznam, setSeznam] = useState<CrawlSnapshot>(EMPTY_SNAPSHOT);
  const [google, setGoogle] = useState<CrawlSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<ConnectionStatus>("loading");

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const [s, g] = await Promise.all([
          fetchEngine("suggestions", "crawl_state"),
          fetchEngine("google_suggestions", "google_crawl_state"),
        ]);

        if (!mounted) return;
        setSeznam(s);
        setGoogle(g);
        setStatus("connected");
      } catch {
        if (!mounted) return;
        setStatus("error");
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const total = useMemo(() => seznam.count + google.count, [seznam.count, google.count]);

  return { seznam, google, total, status };
}
