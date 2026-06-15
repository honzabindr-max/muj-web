"use client";

import { useMemo } from "react";
import type { DashboardRow } from "../../suggest/_lib/types";
import { isHeartbeatAlive } from "../../suggest/_lib/types";
import { formatNumber } from "../../suggest/_lib/utils";

export function BfsProgressBar({
  rows,
  className = "",
}: {
  rows: DashboardRow[];
  className?: string;
}) {
  const { processed, total, pct, activeCount } = useMemo(() => {
    let proc = 0;
    let tot = 0;
    let active = 0;
    for (const r of rows) {
      if (r.source !== "google") continue;
      proc += r.processed ?? 0;
      tot += r.queries_total ?? 0;
      if (isHeartbeatAlive(r.updated_at)) active++;
    }
    const p = tot > 0 ? Math.min(100, Math.round((proc / tot) * 1000) / 10) : 0;
    return { processed: proc, total: tot, pct: p, activeCount: active };
  }, [rows]);

  const isActive = activeCount > 0;

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Průchod BFS
          </span>
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {activeCount} běží
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm tabular-nums text-zinc-600">
            {formatNumber(processed)} / {formatNumber(total)} dotazů
          </span>
          <span className="min-w-[44px] text-right font-mono text-sm font-semibold tabular-nums text-zinc-900">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100/80">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isActive
              ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
              : "bg-gradient-to-r from-blue-400 to-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
        {isActive && pct > 0 && (
          <div
            className="absolute inset-y-0 rounded-full opacity-60"
            style={{
              left: `${Math.max(0, pct - 8)}%`,
              width: "8%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
              animation: "shimmer 2.2s linear infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}
