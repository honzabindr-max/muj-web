"use client";

import { useSeznamCrawlState, isActive } from "../_hooks/use-seznam-crawl-state";
import { GlassCard, AnimatedNumber } from "./primitives";
import { formatRelativeTime, formatNumber } from "../_lib/utils";

export function SeznamCrawlStatus({ className = "" }: { className?: string }) {
  const state = useSeznamCrawlState();

  const active = isActive(state);
  const progress =
    state && state.queue_size > 0
      ? Math.min(100, (state.processed / state.queue_size) * 100)
      : 0;
  const lastRunDelta = state ? state.count_after - state.count_before : 0;

  return (
    <GlassCard className={`rounded-[28px] p-5 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">

        {/* Left: header + progress */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800">Seznam Crawler</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                active
                  ? "border border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
                  : "border border-zinc-200/70 bg-zinc-50/70 text-zinc-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  active ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                }`}
              />
              {active ? "aktivní" : "idle"}
            </span>
            {state?.updated_at && (
              <span className="text-[11px] text-zinc-400">
                {formatRelativeTime(state.updated_at)} ago
              </span>
            )}
          </div>

          {state?.current_prefix && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-zinc-400">prefix</span>
              <code className="rounded-md border border-zinc-200/60 bg-zinc-50/80 px-2 py-0.5 text-xs font-mono text-zinc-700">
                {state.current_prefix}
              </code>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                průchod BFS · {formatNumber(state?.processed ?? 0)} / {formatNumber(state?.queue_size ?? 0)} dotazů
              </span>
              <span className="text-[11px] font-semibold text-zinc-600">
                {progress.toFixed(1)} %
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  active ? "bg-emerald-400" : "bg-zinc-300"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: metrics */}
        <div className="flex shrink-0 gap-4 sm:gap-6">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">nových (průchod)</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {state ? <AnimatedNumber value={state.new_total} /> : "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-400">poslední běh</div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums ${
                lastRunDelta > 0 ? "text-emerald-600" : "text-zinc-400"
              }`}
            >
              {lastRunDelta > 0 ? `+${formatNumber(lastRunDelta)}` : "—"}
            </div>
          </div>
        </div>

      </div>
    </GlassCard>
  );
}
