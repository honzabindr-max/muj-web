import type { DashboardRow } from "../_lib/types";
import { formatNumber, formatRelativeTime } from "../_lib/utils";

export function ExpandedDetail({ row }: { row: DashboardRow }) {
  const processed = row.processed ?? 0;
  const total = processed + (row.queue_len ?? 0);
  const pct = total > 0 ? Math.round((processed / total) * 100) : null;

  return (
    <div className="grid gap-4 border-t border-zinc-100/80 bg-white/30 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {/* Prefix & queue */}
      <div className="space-y-1.5">
        <Row label="Aktuální prefix" value={row.current_prefix ?? "—"} mono />
        <Row label="Queue (aktuální)" value={row.queue_len ?? "—"} />
        <Row label="Next queue" value={row.next_queue_len ?? "—"} />
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <Row
          label="Zpracováno"
          value={`${formatNumber(processed)} / ${formatNumber(total)}`}
        />
        <Row label="Queries celkem" value={formatNumber(row.queries_total ?? 0)} />
        <Row label="Poslední start" value={formatRelativeTime(row.last_started_at)} />
      </div>

      {/* Depth bar */}
      {pct !== null && (
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Průběh hloubky</span>
            <span className="tabular-nums font-medium text-zinc-700">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-blue-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-500">{label}</span>
      <span
        className={`font-medium text-zinc-800 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
