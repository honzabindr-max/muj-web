"use client";

import { useMemo } from "react";
import { useSuggest3 } from "./_hooks/use-suggest3";
import { aggregateSources, freshColor } from "./_lib/markets";
import { HeaderBar } from "./_components/header-bar";
import { TickerTape } from "./_components/ticker-tape";
import { KpiCards, type KpiData } from "./_components/kpi-cards";
import { GrowthPanel } from "./_components/growth-panel";
import { HealthPanel } from "./_components/health-panel";
import { WorldMap } from "./_components/world-map";
import { MarketsBoard } from "./_components/markets-board";

const COUNTDOWN_MAX = 3; // real fast-poll cadence (s)

export default function Suggest3Page() {
  const { markets, rows, summary, newPhrasesToday, phraseSamples, tempo, countdown, now } = useSuggest3();

  const runningCount = useMemo(() => markets.filter((m) => m.status === "run").length, [markets]);

  // Per-source health (GPT decision #1) — also drives the "Aktivní crawleři" dots
  const sources = useMemo(() => aggregateSources(rows), [rows]);
  const sourceOn = useMemo(() => sources.map((s) => s.running > 0), [sources]);

  const kpi: KpiData = useMemo(() => {
    // freshness buckets + median over running markets
    let green = 0, amber = 0, red = 0;
    for (const m of markets) {
      if (m.status === "err" || m.freshSec >= 180) red++;
      else if (m.freshSec >= 60) amber++;
      else green++;
    }
    const fb = green + amber + red || 1;
    const runningFresh = markets.filter((m) => m.status === "run").map((m) => m.freshSec).sort((a, b) => a - b);
    const median = runningFresh.length ? Math.round(runningFresh[Math.floor(runningFresh.length / 2)]) : 0;

    const bfsAvg = markets.length ? Math.round(markets.reduce((s, m) => s + m.bfs, 0) / markets.length) : 0;
    const bfsDone = rows.reduce((s, r) => s + (r.processed ?? 0), 0);
    const bfsTotal = rows.reduce((s, r) => s + (r.queries_total ?? 0), 0);

    return {
      total: summary.totalPhrases,
      totalSpark: phraseSamples.map((s) => s.total),
      today: newPhrasesToday,
      tempo,
      runningCount: sourceOn.filter(Boolean).length,
      workerDots: sourceOn,
      freshMedian: median,
      freshColor: freshColor({ status: "run", freshSec: median }),
      greenPct: Math.round((green / fb) * 100),
      amberPct: Math.round((amber / fb) * 100),
      redPct: Math.round((red / fb) * 100),
      bfsAvg,
      bfsDone,
      bfsTotal,
    };
  }, [markets, rows, summary.totalPhrases, phraseSamples, newPhrasesToday, tempo, sourceOn]);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 48, fontFamily: "'Geist', system-ui, -apple-system, sans-serif", color: "#202124", letterSpacing: "-0.01em" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
        body {
          background:
            radial-gradient(1100px 620px at 8% -10%, rgba(66,133,244,.13), transparent 60%),
            radial-gradient(960px 540px at 99% -4%, rgba(52,168,83,.11), transparent 55%),
            radial-gradient(880px 660px at 52% 116%, rgba(251,188,5,.09), transparent 55%),
            #e9edf2;
          background-attachment: fixed;
        }
        @keyframes s3livepulse { 0% { box-shadow: 0 0 0 0 rgba(22,163,74,.5) } 70% { box-shadow: 0 0 0 6px rgba(22,163,74,0) } 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0) } }
        @keyframes s3tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes s3lastdot { 0% { box-shadow: 0 0 0 0 rgba(26,115,232,.45) } 70% { box-shadow: 0 0 0 7px rgba(26,115,232,0) } 100% { box-shadow: 0 0 0 0 rgba(26,115,232,0) } }
        @keyframes s3mappulse { 0%, 100% { opacity: 1 } 50% { opacity: .32 } }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; }
        }
      `}</style>

      <HeaderBar now={now} runningCount={runningCount} countdown={countdown} countdownMax={COUNTDOWN_MAX} />
      <TickerTape markets={markets} />

      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "24px 24px 0" }}>
        <KpiCards d={kpi} />

        <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 14, marginTop: 14 }}>
          <GrowthPanel samples={phraseSamples} total={summary.totalPhrases} />
          <HealthPanel sources={sources} />
        </div>

        <WorldMap markets={markets} today={newPhrasesToday} />

        <div style={{ marginTop: 14 }}>
          <MarketsBoard markets={markets} />
        </div>
      </div>
    </div>
  );
}
