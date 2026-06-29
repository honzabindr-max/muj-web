"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSuggest2Data } from "../../suggest2/_hooks/use-suggest2-data";
import { aggregateMarkets, type Market } from "../_lib/markets";

export type LiveMarket = Market & {
  spark: number[]; // session-scoped phrase samples (honest, resets on reload)
  tickDelta: number; // accumulated delta since last refresh tick
  lastFlash: number; // ts of last observed increase (for row flash)
};

const SPARK_LEN = 18;

export function useSuggest3() {
  const base = useSuggest2Data();
  const { rows } = base;

  const markets = useMemo(() => aggregateMarkets(rows), [rows]);

  // Clock (HH:MM:SS), 1s cadence
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Per-market live overlay: spark history + tick deltas + flash, kept in a ref
  const liveRef = useRef<Map<string, { spark: number[]; tickDelta: number; lastFlash: number; prev: number }>>(
    new Map(),
  );
  const [version, setVersion] = useState(0);
  const prevCountdownRef = useRef<number>(base.countdown);

  useEffect(() => {
    const live = liveRef.current;
    const now = Date.now();
    for (const m of markets) {
      const entry = live.get(m.gl);
      if (!entry) {
        live.set(m.gl, { spark: [m.phrases], tickDelta: 0, lastFlash: 0, prev: m.phrases });
        continue;
      }
      if (m.phrases !== entry.prev) {
        const delta = m.phrases - entry.prev;
        entry.spark.push(m.phrases);
        if (entry.spark.length > SPARK_LEN) entry.spark.shift();
        if (delta > 0) {
          entry.tickDelta += delta;
          entry.lastFlash = now;
        }
        entry.prev = m.phrases;
      }
    }
    setVersion((v) => v + 1);
  }, [markets]);

  // Decay ticker deltas when a refresh cycle completes (countdown wraps up)
  useEffect(() => {
    const prev = prevCountdownRef.current;
    if (base.countdown > prev) {
      for (const entry of liveRef.current.values()) {
        entry.tickDelta = Math.round(entry.tickDelta * 0.35);
      }
    }
    prevCountdownRef.current = base.countdown;
  }, [base.countdown]);

  const liveMarkets: LiveMarket[] = useMemo(() => {
    const live = liveRef.current;
    return markets.map((m) => {
      const e = live.get(m.gl);
      return {
        ...m,
        spark: e?.spark ?? [m.phrases],
        tickDelta: e?.tickDelta ?? 0,
        lastFlash: e?.lastFlash ?? 0,
      };
    });
  // version: spark/tickDelta mutations in liveRef; now: freshSec UI ticks each second
  }, [markets, now, version]);

  return { ...base, now, markets: liveMarkets };
}
