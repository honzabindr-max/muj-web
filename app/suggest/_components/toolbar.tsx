"use client";

import type { FilterState, SortKey } from "../_lib/types";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "heartbeat", label: "Stav (výchozí)" },
  { key: "phrase_count", label: "Počet frází" },
  { key: "new_24h", label: "Nové / 24 h" },
  { key: "new_total", label: "Nové celkem" },
  { key: "updated_at", label: "Aktivita" },
  { key: "name", label: "Název" },
];

export function Toolbar({
  filter,
  onChange,
  className = "",
}: {
  filter: FilterState;
  onChange: (next: FilterState) => void;
  className?: string;
}) {
  function set(patch: Partial<FilterState>) {
    onChange({ ...filter, ...patch });
  }

  function toggleSort(key: SortKey) {
    if (filter.sortKey === key) {
      set({ sortDir: filter.sortDir === "asc" ? "desc" : "asc" });
    } else {
      set({ sortKey: key, sortDir: "desc" });
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* Search */}
      <div className="relative min-w-[180px] flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          🔍
        </span>
        <input
          type="search"
          placeholder="Hledat gl-hl…"
          value={filter.search}
          onChange={(e) => set({ search: e.target.value })}
          className="w-full rounded-xl border border-white/70 bg-white/70 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 backdrop-blur-md outline-none focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200"
        />
      </div>

      {/* Problematic filter */}
      <button
        onClick={() => set({ onlyProblematic: !filter.onlyProblematic })}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
          filter.onlyProblematic
            ? "border-red-200/80 bg-red-50/80 text-red-700"
            : "border-white/70 bg-white/70 text-zinc-600 hover:bg-white/90"
        } backdrop-blur-md`}
      >
        ⚠️ Jen problémové
        {filter.onlyProblematic && (
          <span className="ml-1 text-xs opacity-70">×</span>
        )}
      </button>

      {/* Group by GL */}
      <button
        onClick={() => set({ groupByGl: !filter.groupByGl })}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
          filter.groupByGl
            ? "border-blue-200/80 bg-blue-50/80 text-blue-700"
            : "border-white/70 bg-white/70 text-zinc-600 hover:bg-white/90"
        } backdrop-blur-md`}
      >
        🌍 Seskupit dle GL
      </button>

      {/* Sort */}
      <div className="relative">
        <select
          value={filter.sortKey}
          onChange={(e) => toggleSort(e.target.value as SortKey)}
          className="appearance-none rounded-xl border border-white/70 bg-white/70 py-2 pl-3 pr-8 text-sm text-zinc-700 backdrop-blur-md outline-none focus:border-zinc-300"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
          {filter.sortDir === "asc" ? "↑" : "↓"}
        </span>
      </div>
    </div>
  );
}
