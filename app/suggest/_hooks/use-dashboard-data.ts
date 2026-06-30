"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

async function apiFetch<T>(path: string): Promise<T[]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return (await res.json()) as T[];
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
      const [rowsData, new24hData] = await Promise.all([
        apiFetch<DashboardRow>("/api/suggest/dashboard-rows").catch(() => null),
        apiFetch<New24hRow>("/api/suggest/new-phrases-24h").catch(() => null),
      ]);

      if (cancelled) return;

      if (!rowsData) {
        setLoadState("error");
        return;
      }

      const totalPhrases = rowsData.reduce((s, r) => s + Number(r.phrase_count), 0);
      const new24hMap = new Map<string, number>(
        ((new24hData ?? []) as New24hRow[]).map((r) => [
          `${r.gl}-${r.hl}`,
          Number(r.new_24h),
        ]),
      );

      const enriched: DashboardRow[] = rowsData.map((r) => ({
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
    try {
      const data = await apiFetch<StateRow>("/api/suggest/dashboard-state");
      updateRows((prev) => mergeState(prev, data));
    } catch {
      // silent — fast poll retries in 3s
    }
  }, [updateRows]);

  // Fast poll: state updates (3s)
  useEffect(() => {
    const id = setInterval(fetchAndMergeState, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAndMergeState]);

  // Phrase_count refresh: syncs map heatmap with MV refresh cycle (5 min)
  useEffect(() => {
    const id = setInterval(async () => {
      if (loadStateRef.current !== "ready") return;
      try {
        const data = await apiFetch<DashboardRow>("/api/suggest/dashboard-rows");
        updateRows((prev) => mergePhraseCount(prev, data));
      } catch {
        // silent — retries next cycle
      }
    }, PHRASE_COUNT_POLL_MS);
    return () => clearInterval(id);
  }, [updateRows]);

  // Slow poll: new_24h (60s)
  useEffect(() => {
    const id = setInterval(async () => {
      if (loadStateRef.current !== "ready") return;
      try {
        const data = await apiFetch<New24hRow>("/api/suggest/new-phrases-24h");
        updateRows((prev) => merge24h(prev, data));
      } catch {
        // silent — retries next cycle
      }
    }, SLOW_POLL_MS);
    return () => clearInterval(id);
  }, [updateRows]);

  return { rows, summary, loadState };
}
