"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useDashboardData } from "./_hooks/use-dashboard-data";
import { useSoundEvents } from "./_hooks/use-sound-events";
import { resumeAudio } from "./_lib/sounds";
import { SummaryBar } from "./_components/summary-bar";
import { Toolbar } from "./_components/toolbar";
import { MutationsTable } from "./_components/mutations-table";
import { SuggestWorldMap } from "./_components/SuggestWorldMap";
import { SeznamCrawlStatus } from "./_components/seznam-crawl-status";
import type { FilterState } from "./_lib/types";
import { flagEmoji, countryName } from "./_lib/utils";

const DEFAULT_FILTER: FilterState = {
  search: "",
  onlyProblematic: false,
  groupByGl: false,
  sortKey: "updated_at",
  sortDir: "desc",
};

export default function SuggestPage() {
  const { rows, summary, loadState } = useDashboardData();
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedGl, setSelectedGl] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const handleSoundToggle = useCallback(() => {
    resumeAudio();
    setSoundEnabled((prev) => !prev);
  }, []);

  useSoundEvents(rows, soundEnabled);

  const filteredByGl = useMemo(
    () => (selectedGl ? rows.filter((r) => r.gl.toLowerCase() === selectedGl) : rows),
    [rows, selectedGl],
  );

  const activeLabel =
    summary.activeCount > 0 ? `${summary.activeCount} aktivní` : "Standby";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f5f7fb_38%,#f8fafc_100%)] text-zinc-950">
      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      {/* Background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[6%] left-[8%] h-[380px] w-[380px] rounded-full bg-red-200/10 blur-3xl" />
        <div className="absolute top-[12%] right-[8%] h-[420px] w-[420px] rounded-full bg-blue-200/10 blur-3xl" />
        <div className="absolute bottom-[10%] left-[32%] h-[420px] w-[420px] rounded-full bg-emerald-200/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/52 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl md:p-6">
          <div className="pointer-events-none absolute -top-24 left-20 h-72 w-72 rounded-full bg-blue-200/14 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-red-200/12 blur-3xl" />
          <div className="pointer-events-none absolute top-0 right-24 h-64 w-64 rounded-full bg-emerald-200/12 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/"
                prefetch={false}
                className="inline-flex h-10 items-center rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-zinc-700 backdrop-blur-md transition hover:bg-white hover:text-zinc-950"
              >
                ← Zpět
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-zinc-950">
                    Crawler Dashboard
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm ${
                      summary.activeCount > 0
                        ? "border-emerald-200/90 bg-emerald-50/85 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                        : "border-white/70 bg-white/75 text-zinc-600"
                    }`}
                  >
                    {activeLabel}
                  </span>
                  {loadState === "error" && (
                    <span className="rounded-full border border-red-200/80 bg-red-50/80 px-3 py-1 text-xs font-medium text-red-700">
                      Chyba načítání
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Přehled sběru návrhů v reálném čase ·{" "}
                  {summary.mutationCount} mutací
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-3xl border border-white/70 bg-white/55 px-5 py-4 text-right shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Aktualizace
                </div>
                <div className="mt-2 text-[clamp(1rem,2vw,1.35rem)] font-semibold leading-none text-zinc-950">
                  každé 3 s
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/55 px-5 py-4 text-right shadow-[0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Projekt
                </div>
                <div className="mt-2 text-[clamp(0.95rem,1.3vw,1.1rem)] break-all font-semibold leading-none text-zinc-950">
                  good-inventions.work
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Summary */}
        <SummaryBar summary={summary} className="mt-5" />

        {/* Seznam live status */}
        <SeznamCrawlStatus className="mt-3" />

        {/* World map */}
        <SuggestWorldMap
          rows={rows}
          selectedGl={selectedGl}
          onSelectGl={setSelectedGl}
          className="mt-3"
        />

        {/* Toolbar */}
        <Toolbar
          filter={filter}
          onChange={setFilter}
          soundEnabled={soundEnabled}
          onSoundToggle={handleSoundToggle}
          className="mt-3"
        />

        {/* Active country filter chip */}
        {selectedGl && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-sm text-zinc-600 backdrop-blur-sm">
              {flagEmoji(selectedGl)}{" "}
              Filtrovaná země: <span className="font-semibold">{countryName(selectedGl)}</span>
            </span>
            <button
              onClick={() => setSelectedGl(null)}
              className="rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-sm text-zinc-500 backdrop-blur-sm hover:bg-white hover:text-zinc-800"
            >
              · Zrušit
            </button>
          </div>
        )}

        {/* Table */}
        <MutationsTable
          rows={filteredByGl}
          filter={filter}
          onFilterChange={setFilter}
          className="mt-3"
        />

        <footer className="mt-6 flex flex-col gap-2 border-t border-zinc-200/70 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Monitoring crawlerů v reálném čase</span>
          <span>good-inventions.work</span>
        </footer>
      </div>
    </div>
  );
}
