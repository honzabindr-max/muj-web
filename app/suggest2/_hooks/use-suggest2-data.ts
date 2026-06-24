"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardData } from "../../suggest/_hooks/use-dashboard-data";

export type PhraseSample = { ts: number; total: number };

const TODAY_POLL_MS = 60_000;

async function apiFetch<T>(path: string): Promise<T[]> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return (await res.json()) as T[];
}

function computeTempo(samples: PhraseSample[]): number | null {
  const window = samples.slice(-5);
  if (window.length < 2) return null;
  const dt = (window[window.length - 1].ts - window[0].ts) / 60_000;
  const dv = window[window.length - 1].total - window[0].total;
  if (dt <= 0 || dv < 0) return null;
  return Math.max(0, Math.round(dv / dt));
}

export function useSuggest2Data() {
  const base = useDashboardData();
  const { rows, summary, loadState } = base;

  // Freshness: track last state change + countdown to next poll
  const [dataTimestamp, setDataTimestamp] = useState<Date>(() => new Date());
  const [countdown, setCountdown] = useState(3);
  const prevFpRef = useRef("");

  useEffect(() => {
    const fp = rows.map((r) => `${r.gl}${r.hl}${r.updated_at}`).join("|");
    if (fp && fp !== prevFpRef.current) {
      prevFpRef.current = fp;
      setDataTimestamp(new Date());
      setCountdown(3);
    }
  }, [rows]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 3 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Phrase samples for growth chart (client-side, MV cadence ~5 min)
  const [phraseSamples, setPhraseSamples] = useState<PhraseSample[]>([]);
  const prevTotalRef = useRef(-1);

  useEffect(() => {
    if (loadState !== "ready") return;
    const total = summary.totalPhrases;
    if (total !== prevTotalRef.current && total > 0) {
      prevTotalRef.current = total;
      setPhraseSamples((prev) => [...prev.slice(-120), { ts: Date.now(), total }]);
    }
  }, [summary.totalPhrases, loadState]);

  // New phrases today (od 00:00 Europe/Prague, monotónní)
  const [newPhrasesToday, setNewPhrasesToday] = useState<number | null>(null);

  const fetchToday = useCallback(async () => {
    try {
      const data = await apiFetch<{ gl: string; hl: string; new_today: number }>(
        "/api/suggest/new-phrases-today",
      );
      const total = data.reduce((s, r) => s + Number(r.new_today), 0);
      setNewPhrasesToday((prev) => {
        if (prev === null) return total;
        // midnight reset: new value significantly lower → accept reset
        if (total < prev * 0.5 && prev > 100) return total;
        return Math.max(prev, total);
      });
    } catch {
      // silent — API not yet available on Hetzner; falls back to Supabase (NO-GROWTH)
    }
  }, []);

  useEffect(() => {
    fetchToday();
    const id = setInterval(fetchToday, TODAY_POLL_MS);
    return () => clearInterval(id);
  }, [fetchToday]);

  const tempo = computeTempo(phraseSamples);

  return {
    ...base,
    dataTimestamp,
    countdown,
    newPhrasesToday,
    phraseSamples,
    tempo,
  };
}
