"use client";

import { AnimatedNumber } from "./primitives";
import type { DashboardSummary } from "../_lib/types";

export function SummaryBar({
  summary,
  className = "",
}: {
  summary: DashboardSummary;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className}`}
    >
      <Metric label="Frází celkem" value={summary.totalPhrases} />
      <Metric label="Mutací" value={summary.mutationCount} />
      <Metric
        label="Aktivní"
        value={summary.activeCount}
        highlight={summary.activeCount > 0}
      />
      <Metric
        label="Nové / 24 h"
        value={summary.newPhrases24h}
        highlight={summary.newPhrases24h > 0}
        prefix="+"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  prefix = "",
}: {
  label: string;
  value: number;
  highlight?: boolean;
  prefix?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono text-xl font-semibold tabular-nums leading-none ${
          highlight ? "text-emerald-600" : "text-zinc-950"
        }`}
      >
        {prefix}
        <AnimatedNumber value={value} />
      </p>
    </div>
  );
}
