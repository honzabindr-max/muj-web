"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSuggest2Data } from "./_hooks/use-suggest2-data";
import { useSoundEvents } from "../suggest/_hooks/use-sound-events";
import { resumeAudio } from "../suggest/_lib/sounds";
import { SuggestWorldMap } from "../suggest/_components/SuggestWorldMap";
import { BfsProgressBar } from "./_components/bfs-progress-bar";
import { FreshnessBar } from "./_components/freshness-bar";
import { KpiStrip } from "./_components/kpi-strip";
import { GrowthChart } from "./_components/growth-chart";
import { MarketsTable } from "./_components/markets-table";
import { SeznamPanel } from "./_components/seznam-panel";
import { isHeartbeatAlive } from "../suggest/_lib/types";
import { flagEmoji, countryName } from "../suggest/_lib/utils";

export default function Suggest2Page() {
  const { rows, summary, loadState, dataTimestamp, countdown, newPhrasesToday, phraseSamples, tempo } =
    useSuggest2Data();
  const [selectedGl, setSelectedGl] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [sessionStartedAt] = useState(() => new Date());

  const handleSoundToggle = () => {
    resumeAudio();
    setSoundEnabled((prev) => !prev);
  };

  useSoundEvents(rows, soundEnabled);

  const filteredByGl = useMemo(
    () => (selectedGl ? rows.filter((r) => r.gl.toLowerCase() === selectedGl) : rows),
    [rows, selectedGl],
  );

  const marketCount = useMemo(() => [...new Set(rows.map((r) => r.gl))].length, [rows]);

  const runningCount = useMemo(
    () => [...new Set(rows.filter((r) => isHeartbeatAlive(r.updated_at)).map((r) => r.gl))].length,
    [rows],
  );

  const doneCount = useMemo(() => {
    const gls = [...new Set(rows.map((r) => r.gl))];
    return gls.filter((gl) => {
      const glRows = rows.filter((r) => r.gl === gl);
      return glRows.length > 0 && glRows.every((r) => r.status === "done");
    }).length;
  }, [rows]);

  const pendingCount = useMemo(
    () => [...new Set(rows.filter((r) => r.status === "pending").map((r) => r.gl))].length,
    [rows],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f5f7fb_38%,#f8fafc_100%)] text-zinc-950">
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[6%] left-[8%] h-[380px] w-[380px] rounded-full bg-blue-200/10 blur-3xl" />
        <div className="absolute top-[12%] right-[8%] h-[420px] w-[420px] rounded-full bg-emerald-200/10 blur-3xl" />
        <div className="absolute bottom-[10%] left-[32%] h-[420px] w-[420px] rounded-full bg-indigo-200/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">

        {/* ── 1) HLAVIČKA ── */}
        <header className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/52 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl md:p-6">
          <div className="pointer-events-none absolute -top-24 left-20 h-72 w-72 rounded-full bg-blue-200/14 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-emerald-200/12 blur-3xl" />
          <div className="pointer-events-none absolute top-0 right-24 h-64 w-64 rounded-full bg-indigo-200/10 blur-3xl" />

          <div className="relative flex flex-col gap-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex gap-2">
                <Link
                  href="/"
                  prefetch={false}
                  className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-zinc-700 backdrop-blur-md transition hover:bg-white hover:text-zinc-950"
                >
                  ← Zpět
                </Link>
                <Link
                  href="/suggest"
                  prefetch={false}
                  className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/60 px-4 text-sm font-medium text-zinc-500 backdrop-blur-md transition hover:bg-white/90 hover:text-zinc-700"
                >
                  v1 dashboard
                </Link>
                <button
                  onClick={handleSoundToggle}
                  aria-label={soundEnabled ? "Vypnout zvuk" : "Zapnout zvuk"}
                  className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/60 px-3 text-sm text-zinc-500 backdrop-blur-md transition hover:bg-white/90"
                >
                  {soundEnabled ? "🔔" : "🔕"}
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-[clamp(1.8rem,3.5vw,3rem)] font-semibold tracking-tight text-zinc-950">
                    Sběr dat · Live
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm ${
                      summary.activeCount > 0
                        ? "border-emerald-200/90 bg-emerald-50/85 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                        : "border-white/70 bg-white/75 text-zinc-600"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${summary.activeCount > 0 ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-zinc-400"}`}
                    />
                    {summary.activeCount > 0 ? `${summary.activeCount} aktivní` : "Standby"}
                  </span>
                  {loadState === "error" && (
                    <span className="rounded-full border border-red-200/80 bg-red-50/80 px-3 py-1 text-xs font-medium text-red-700">
                      Chyba načítání
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Freshness + market summary */}
            <FreshnessBar
              dataTimestamp={dataTimestamp}
              countdown={countdown}
              marketCount={marketCount}
              runningCount={runningCount}
              doneCount={doneCount}
              pendingCount={pendingCount}
            />
          </div>
        </header>

        {/* ── 2) KPI PRUH ── */}
        <KpiStrip
          rows={rows}
          totalPhrases={summary.totalPhrases}
          newPhrases24h={summary.newPhrases24h}
          newPhrasesToday={newPhrasesToday}
          tempo={tempo}
          className="mt-4"
        />

        {/* ── 3) RŮSTOVÝ GRAF ── */}
        <GrowthChart
          samples={phraseSamples}
          sessionStartedAt={sessionStartedAt}
          className="mt-3"
        />

        {/* BFS průchod */}
        <BfsProgressBar rows={rows} className="mt-3" />

        {/* ── 4) MAPA ── */}
        <SuggestWorldMap
          rows={rows}
          selectedGl={selectedGl}
          onSelectGl={setSelectedGl}
          className="mt-3"
        />

        {/* Country filter chip */}
        {selectedGl && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-sm text-zinc-600 backdrop-blur-sm">
              {flagEmoji(selectedGl)}{" "}
              Filtrovaná země:{" "}
              <span className="font-semibold">{countryName(selectedGl)}</span>
            </span>
            <button
              onClick={() => setSelectedGl(null)}
              className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-sm text-zinc-500 backdrop-blur-sm hover:bg-white hover:text-zinc-800"
            >
              · Zrušit
            </button>
          </div>
        )}

        {/* ── 5) SEZNAM PANEL ── */}
        <SeznamPanel className="mt-3" />

        {/* ── 6) TABULKA TRHŮ ── */}
        <MarketsTable rows={filteredByGl} className="mt-3" />

        <footer className="mt-6 flex flex-col gap-2 border-t border-zinc-200/70 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Live sběr · {marketCount} trhů · stav každé 3 s · fráze každých ≈5 min</span>
          <span>good-inventions.work</span>
        </footer>
      </div>
    </div>
  );
}
