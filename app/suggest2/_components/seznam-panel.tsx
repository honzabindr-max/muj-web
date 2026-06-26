"use client";

import { useSeznamStatus } from "../_hooks/use-seznam-status";
import { heartbeatColor } from "../../suggest/_lib/types";
import { formatNumber, formatRelativeTime } from "../../suggest/_lib/utils";

export function SeznamPanel({ className = "" }: { className?: string }) {
  const s = useSeznamStatus();
  const hb = heartbeatColor(s?.updated_at ?? null);

  const badgeClass =
    hb === "green"
      ? "border-orange-200 bg-orange-50/80 text-orange-700"
      : hb === "amber"
        ? "border-amber-200 bg-amber-50/80 text-amber-700"
        : "border-zinc-200/70 bg-zinc-50/70 text-zinc-400";
  const dotClass =
    hb === "green"
      ? "bg-orange-500 motion-safe:animate-pulse"
      : hb === "amber"
        ? "bg-amber-400"
        : "bg-zinc-300";
  const badgeLabel = hb === "gray" ? "pauza" : "aktivní";

  const progress =
    s && s.queue_size > 0
      ? Math.min(100, (s.processed / s.queue_size) * 100)
      : 0;

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          Seznam Crawler
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          {s ? badgeLabel : "—"}
        </span>
        {s?.updated_at && (
          <span className="ml-auto text-[10px] text-zinc-400">
            před {formatRelativeTime(s.updated_at)}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="mb-3.5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Celkem frází</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-950">
            {s ? formatNumber(s.count_after) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Hloubka BFS</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-950">
            {s ? s.current_depth : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Nové (průchod)</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-950">
            {s ? formatNumber(s.new_total) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Nové dnes</div>
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              s?.new_today ? "text-emerald-700" : "text-zinc-400"
            }`}
          >
            {s !== null ? (s.new_today > 0 ? `+${formatNumber(s.new_today)}` : "—") : "—"}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            BFS průchod · {s ? formatNumber(s.processed) : "0"} /{" "}
            {s ? formatNumber(s.queue_size) : "0"} dotazů
          </span>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-zinc-600">
            {progress.toFixed(1)}%
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100/80">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              hb !== "gray"
                ? "bg-gradient-to-r from-orange-400 to-red-400"
                : "bg-gradient-to-r from-zinc-300 to-zinc-400"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
