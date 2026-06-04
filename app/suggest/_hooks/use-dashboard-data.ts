"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  DashboardRow,
  DashboardSummary,
  New24hRow,
  StateRow,
} from "../_lib/types";
import { isHeartbeatAlive } from "../_lib/types";

const FAST_POLL_MS = 3_000;
const SLOW_POLL_MS = 60_000;
const PHRASE_COUNT_POLL_MS = 300_000;

function computeSummary(rows: DashboardRow[]): DashboardSummary {
  return {
    totalPhrases: rows.reduce((s, r) => s + r.phrase_count, 0),
    mutationCount: rows.length,
    activeCount: rows.filter((r) => isHeartbeatAlive(r.updated_at)).length,
    idleCount: rows.filter((r) => !isHeartbeatAlive(r.updated_at)).length,
    newPhrases24h: rows.reduce((s, r) => s + (r.new_24h ?? 0), 0),
  };
}

function mergeState(prev: DashboardRow[], stateRows: StateRow[]): DashboardRow[] {
  const map = new Map(stateRows.map((r) => [`${r.gl}-${r.hl}`, r]));
  return prev.map((row) => {
    if (row.source !== "google") return row;
    const s = map.get(`${row.gl}-${row.hl}`);
    if (!s) return row;
    return {
      ...row,
      depth: s.depth,
      depth_pct: s.depth_pct !== null ? Number(s.depth_pct) : null,
      processed: s.processed,
      queries_total: s.queries_total,
      new_total: s.new_total,
      queue_len: s.queue_len,
      next_queue_len: s.next_queue_len,
      current_prefix: s.current_prefix,
      status: s.status as DashboardRow["status"],
      updated_at: s.updated_at,
    };
  });
}

function mergePhraseCount(prev: DashboardRow[], fresh: DashboardRow[]): DashboardRow[] {
  const map = new Map(fresh.map((r) => [`${r.gl}-${r.hl}`, Number(r.phrase_count)]));
  return prev.map((row) => ({
    ...row,
    phrase_count: map.get(`${row.gl}-${row.hl}`) ?? row.phrase_count,
  }));
}

function merge24h(prev: DashboardRow[], new24hRows: New24hRow[]): DashboardRow[] {
  const map = new Map(
    new24hRows.map((r) => [`${r.gl}-${r.hl}`, Number(r.new_24h)]),
  );
  return prev.map((row) => ({
    ...row,
    new_24h: map.get(`${row.gl}-${row.hl}`) ?? row.new_24h ?? 0,
  }));
}

export function useDashboardData() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    totalPhrases: 0,
    mutationCount: 0,
    activeCount: 0,
    idleCount: 0,
    newPhrases24h: 0,
  });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const updateRows = useCallback((updater: (prev: DashboardRow[]) => DashboardRow[]) => {
    setRows((prev) => {
      const next = updater(prev);
      setSummary(computeSummary(next));
      return next;
    });
  }, []);

  // Init: full load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [rowsRes, new24hRes] = await Promise.all([
        supabase.rpc("get_dashboard_rows"),
        supabase.rpc("get_new_phrases_24h"),
      ]);

      if (cancelled) return;

      if (rowsRes.error || !rowsRes.data) {
        setLoadState("error");
        return;
      }

      const raw = rowsRes.data as DashboardRow[];
      const totalPhrases = raw.reduce((s, r) => s + Number(r.phrase_count), 0);
      const new24hMap = new Map<string, number>(
        ((new24hRes.data as New24hRow[]) ?? []).map((r) => [
          `${r.gl}-${r.hl}`,
          Number(r.new_24h),
        ]),
      );

      const enriched: DashboardRow[] = raw.map((r) => ({
        ...r,
        phrase_count: Number(r.phrase_count),
        depth_pct: r.depth_pct !== null ? Number(r.depth_pct) : null,
        new_total: r.new_total !== null ? Number(r.new_total) : null,
        phrase_count_share:
          totalPhrases > 0
            ? Math.round((Number(r.phrase_count) / totalPhrases) * 1000) / 10
            : 0,
        new_24h: new24hMap.get(`${r.gl}-${r.hl}`) ?? 0,
      }));

      setRows(enriched);
      setSummary(computeSummary(enriched));
      setLoadState("ready");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStateRef = useRef(loadState);
  loadStateRef.current = loadState;

  // Shared state fetch — called by Realtime handler and fast poll fallback
  const fetchAndMergeState = useCallback(async () => {
    if (loadStateRef.current !== "ready") return;
    const { data, error } = await supabase.rpc("get_dashboard_state");
    if (!error && data) {
      updateRows((prev) => mergeState(prev, data as StateRow[]));
    }
  }, [updateRows]);

  // Realtime: push-based updates when google_crawler_state changes
  useEffect(() => {
    const debounceRef = { timer: null as ReturnType<typeof setTimeout> | null };
    const channel = supabase
      .channel("crawler-state")
      .on("postgres_changes", { event: "*", schema: "public", table: "google_crawler_state" }, () => {
        if (debounceRef.timer) clearTimeout(debounceRef.timer);
        debounceRef.timer = setTimeout(fetchAndMergeState, 200);
      })
      .subscribe();
    return () => {
      if (debounceRef.timer) clearTimeout(debounceRef.timer);
      supabase.removeChannel(channel);
    };
  }, [fetchAndMergeState]);

  // Fast poll fallback: catches Realtime gaps (3s)
  useEffect(() => {
    const id = setInterval(fetchAndMergeState, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAndMergeState]);

  // Phrase_count refresh: syncs map heatmap with MV refresh cycle (5 min)
  useEffect(() => {
    const id = setInterval(async () => {
      if (loadStateRef.current !== "ready") return;
      const { data, error } = await supabase.rpc("get_dashboard_rows");
      if (!error && data) {
        updateRows((prev) => mergePhraseCount(prev, data as DashboardRow[]));
      }
    }, PHRASE_COUNT_POLL_MS);
    return () => clearInterval(id);
  }, [updateRows]);

  // Slow poll: new_24h (60s)
  useEffect(() => {
    const id = setInterval(async () => {
      if (loadStateRef.current !== "ready") return;
      const { data, error } = await supabase.rpc("get_new_phrases_24h");
      if (!error && data) {
        updateRows((prev) => merge24h(prev, data as New24hRow[]));
      }
    }, SLOW_POLL_MS);
    return () => clearInterval(id);
  }, [updateRows]);

  return { rows, summary, loadState };
}
