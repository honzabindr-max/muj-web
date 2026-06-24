"use client";

import { useMemo, useState } from "react";
import type { DashboardRow } from "../../suggest/_lib/types";
import { heartbeatColor } from "../../suggest/_lib/types";
import { flagEmoji, formatNumber, formatRelativeTime } from "../../suggest/_lib/utils";

type ColKey =
  | "gl"
  | "phrase_count"
  | "status"
  | "updated_at"
  | "depth_pct"
  | "queue_len"
  | "new_total";

const COLS: { key: ColKey; label: string; right?: boolean }[] = [
  { key: "gl", label: "Trh" },
  { key: "phrase_count", label: "Fráze", right: true },
  { key: "status", label: "Stav" },
  { key: "updated_at", label: "Čerstvost" },
  { key: "depth_pct", label: "BFS %", right: true },
  { key: "queue_len", label: "Fronta", right: true },
  { key: "new_total", label: "Nové v pilotu", right: true },
];

function sortVal(row: DashboardRow, col: ColKey): number | string {
  switch (col) {
    case "gl":
      return `${row.gl}-${row.hl}`;
    case "phrase_count":
      return row.phrase_count;
    case "status":
      return row.status ?? "";
    case "updated_at":
      return row.updated_at ?? "";
    case "depth_pct":
      return row.depth_pct ?? -1;
    case "queue_len":
      return row.queue_len ?? 0;
    case "new_total":
      return row.new_total ?? 0;
  }
}

function StatusBadge({ row }: { row: DashboardRow }) {
  const hb = heartbeatColor(row.updated_at);
  if (hb !== "gray" && row.status === "running") {
    const cls =
      hb === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
    const dot = hb === "green" ? "bg-emerald-500" : "bg-amber-400";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        běží
      </span>
    );
  }
  const map: Record<string, string> = {
    done: "border-blue-200 bg-blue-50 text-blue-700",
    paused: "border-zinc-200 bg-zinc-50 text-zinc-500",
    pending: "border-zinc-200 bg-zinc-50 text-zinc-400",
    running: "border-zinc-200 bg-zinc-50 text-zinc-400",
  };
  const labels: Record<string, string> = {
    done: "hotovo",
    paused: "pauza",
    pending: "čeká",
    running: "zasekl.",
  };
  const s = row.status ?? "";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[s] ?? "border-zinc-200 bg-zinc-50 text-zinc-400"}`}
    >
      {labels[s] ?? (s || "—")}
    </span>
  );
}

function FreshnessCell({ updatedAt }: { updatedAt: string | null }) {
  const hb = heartbeatColor(updatedAt);
  const dot =
    hb === "green" ? "bg-emerald-500" : hb === "amber" ? "bg-amber-400" : "bg-zinc-300";
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {updatedAt ? formatRelativeTime(updatedAt) : "—"}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="text-zinc-300">↕</span>;
  return <span className="text-zinc-500">{dir === "asc" ? "↑" : "↓"}</span>;
}

export function MarketsTable({
  rows,
  className = "",
}: {
  rows: DashboardRow[];
  className?: string;
}) {
  const [sortCol, setSortCol] = useState<ColKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: ColKey) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = sortVal(a, sortCol);
      const bv = sortVal(b, sortCol);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <div className="border-b border-white/60 bg-white/30 px-5 py-3.5">
        <div className="text-sm font-semibold text-zinc-800">Trhy · všechny atributy</div>
        <div className="mt-0.5 text-[11px] text-zinc-500">
          {rows.length} řádků · kliknutím na záhlaví seřadit
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-100/80 bg-white/20">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-700 ${col.right ? "text-right" : "text-left"}`}
                >
                  <span className={`flex items-center gap-1 ${col.right ? "justify-end" : ""}`}>
                    {col.label}{" "}
                    <SortIcon active={sortCol === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={`${row.source}-${row.gl}-${row.hl}`}
                className={`border-b border-zinc-100/60 transition-colors hover:bg-white/40 ${i % 2 !== 0 ? "bg-white/10" : ""}`}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span>{flagEmoji(row.gl)}</span>
                    <span className="font-mono text-xs font-medium">
                      {row.gl}/{row.hl}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                  {formatNumber(row.phrase_count)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge row={row} />
                </td>
                <td className="px-4 py-2.5">
                  <FreshnessCell updatedAt={row.updated_at} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-600">
                  {row.depth_pct !== null ? `${row.depth_pct}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-600">
                  {row.queue_len !== null ? formatNumber(row.queue_len) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-600">
                  {row.new_total !== null ? `+${formatNumber(row.new_total)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
