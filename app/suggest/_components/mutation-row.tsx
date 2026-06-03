"use client";

import { AnimatedNumber } from "./primitives";
import { MiniDonut } from "./mini-donut";
import { ExpandedDetail } from "./expanded-detail";
import {
  flagEmoji,
  formatNumber,
  formatRelativeTime,
} from "../_lib/utils";
import { heartbeatColor } from "../_lib/types";
import type { DashboardRow } from "../_lib/types";

// paused + alive heartbeat = between batches = effectively running
// paused + stale heartbeat = genuinely waiting
function getStatusBadge(
  status: DashboardRow["status"],
  updatedAt: string | null,
): { label: string; classes: string } | null {
  const alive = heartbeatColor(updatedAt) !== "gray";
  if (status === "running" || (status === "paused" && alive)) {
    return { label: "Běží", classes: "border-emerald-200/80 bg-emerald-50/80 text-emerald-700" };
  }
  if (status === "paused") {
    return { label: "Pauza", classes: "border-amber-200/80 bg-amber-50/80 text-amber-700" };
  }
  if (status === "done") {
    return { label: "Hotovo", classes: "border-blue-200/80 bg-blue-50/80 text-blue-700" };
  }
  if (status === "pending") {
    return { label: "Čeká", classes: "border-white/70 bg-white/55 text-zinc-500" };
  }
  return null;
}


const HB_DOT: Record<
  "green" | "amber" | "gray",
  { ring: string; dot: string }
> = {
  green: {
    ring: "shadow-[0_0_0_3px_rgba(16,185,129,0.15)]",
    dot: "bg-emerald-500",
  },
  amber: {
    ring: "shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
    dot: "bg-amber-400",
  },
  gray: { ring: "", dot: "bg-zinc-300" },
};

export function MutationRow({
  row,
  expanded,
  onToggle,
  measureRef,
}: {
  row: DashboardRow;
  expanded: boolean;
  onToggle: () => void;
  measureRef?: (el: HTMLDivElement | null) => void;
}) {
  const hb = heartbeatColor(row.updated_at);
  const { ring, dot } = HB_DOT[hb];
  const badge = getStatusBadge(row.status, row.updated_at);
  const newPositive = (row.new_total ?? 0) > 0;

  return (
    <div ref={measureRef} className="border-b border-zinc-100/80 last:border-0">
      {/* Main row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/40 sm:gap-3 sm:px-4"
        aria-expanded={expanded}
      >
        {/* Heartbeat dot */}
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot} ${ring}`}
          aria-label={`Heartbeat: ${hb}`}
        />

        {/* Flag + name */}
        <span className="flex w-[88px] shrink-0 items-center gap-1 sm:w-[108px]">
          {row.source === "google" ? (
            <>
              <span className="text-base leading-none">{flagEmoji(row.gl)}</span>
              <span className="font-mono text-xs font-medium text-zinc-700">
                {row.gl}-{row.hl}
              </span>
            </>
          ) : (
            <span className="font-mono text-xs font-medium text-zinc-700">
              📋 seznam
            </span>
          )}
        </span>

        {/* Frází — always visible */}
        <span className="ml-auto w-[88px] shrink-0 text-right font-mono text-sm tabular-nums text-zinc-900">
          <AnimatedNumber value={row.phrase_count} />
        </span>

        {/* Share bar — hidden on mobile */}
        {row.phrase_count_share !== undefined && (
          <span className="relative hidden w-[80px] shrink-0 overflow-hidden rounded sm:inline-block">
            <span
              className="absolute inset-y-0 left-0 rounded bg-blue-100/80"
              style={{ width: `${Math.min(row.phrase_count_share, 100)}%` }}
            />
            <span className="relative z-10 block px-1 py-0.5 text-right font-mono text-xs tabular-nums text-zinc-600">
              {row.phrase_count_share.toFixed(1)}%
            </span>
          </span>
        )}

        {/* Depth badge — lg+ */}
        <span className="hidden w-8 shrink-0 text-center lg:inline-block">
          {row.depth !== null ? (
            <span className="rounded-md border border-zinc-200/70 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              D{row.depth}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )}
        </span>

        {/* Depth donut — md+ */}
        <span className="hidden w-[64px] shrink-0 items-center gap-1 md:inline-flex">
          <MiniDonut
            pct={row.depth_pct}
            size={22}
            color={hb === "green" ? "#10b981" : hb === "amber" ? "#f59e0b" : "#d1d5db"}
          />
          <span className="font-mono text-[11px] tabular-nums text-zinc-600">
            {row.depth_pct !== null ? `${Math.round(row.depth_pct)}%` : "—"}
          </span>
        </span>

        {/* Nové fráze — always visible */}
        <span
          className={`w-[72px] shrink-0 text-right font-mono text-sm tabular-nums ${
            newPositive ? "font-medium text-emerald-600" : "text-zinc-400"
          }`}
        >
          {newPositive
            ? `+${formatNumber(row.new_total!)}`
            : "—"}
        </span>

        {/* Čas — sm+ */}
        <span className="hidden w-[44px] shrink-0 text-right font-mono text-xs text-zinc-400 sm:inline-block">
          {row.source === "seznam" ? "—" : formatRelativeTime(row.updated_at)}
        </span>

        {/* Status badge — md+ */}
        {badge && (
          <span
            className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium md:inline-block ${badge.classes}`}
          >
            {badge.label}
          </span>
        )}

        {/* Chevron */}
        <span
          className={`ml-1 shrink-0 text-zinc-400 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && row.source === "google" && <ExpandedDetail row={row} />}
    </div>
  );
}
