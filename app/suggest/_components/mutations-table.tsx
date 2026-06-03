"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MutationRow } from "./mutation-row";
import { flagEmoji } from "../_lib/utils";
import {
  heartbeatColor,
  isHeartbeatAlive,
  type DashboardRow,
  type FilterState,
} from "../_lib/types";

// ─── flat item types ────────────────────────────────────────────
type RowItem = { kind: "row"; row: DashboardRow };
type GroupItem = {
  kind: "group";
  gl: string;
  label: string;
  count: number;
  phraseCount: number;
};
type FlatItem = RowItem | GroupItem;

// ─── sort helper ────────────────────────────────────────────────
function sortRows(rows: DashboardRow[], key: FilterState["sortKey"], dir: "asc" | "desc"): DashboardRow[] {
  const sorted = [...rows].sort((a, b) => {
    switch (key) {
      case "heartbeat": {
        // stale (gray) first, then amber, then green
        const order = { gray: 0, amber: 1, green: 2 };
        const diff =
          order[heartbeatColor(a.updated_at)] -
          order[heartbeatColor(b.updated_at)];
        if (diff !== 0) return diff;
        // secondary: phrase_count desc
        return b.phrase_count - a.phrase_count;
      }
      case "phrase_count":
        return b.phrase_count - a.phrase_count;
      case "new_total":
        return (b.new_total ?? 0) - (a.new_total ?? 0);
      case "new_24h":
        return (b.new_24h ?? 0) - (a.new_24h ?? 0);
      case "depth_pct":
        return (b.depth_pct ?? 0) - (a.depth_pct ?? 0);
      case "updated_at": {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      }
      case "name":
        return `${a.gl}-${a.hl}`.localeCompare(`${b.gl}-${b.hl}`);
      default:
        return 0;
    }
  });
  return dir === "asc" ? sorted.reverse() : sorted;
}

// ─── table header ────────────────────────────────────────────────
function TableHeader({
  filter,
  onSortChange,
}: {
  filter: FilterState;
  onSortChange: (key: FilterState["sortKey"]) => void;
}) {
  function Th({
    sortKey,
    label,
    className = "",
  }: {
    sortKey?: FilterState["sortKey"];
    label: string;
    className?: string;
  }) {
    const active = sortKey && filter.sortKey === sortKey;
    return (
      <span
        className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${
          sortKey ? "cursor-pointer select-none hover:text-zinc-700" : ""
        } ${active ? "font-semibold text-zinc-700" : "text-zinc-400"} ${className}`}
        onClick={sortKey ? () => onSortChange(sortKey) : undefined}
      >
        {label}
        {active && (
          <span className="ml-0.5">{filter.sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200/60 bg-white/40 px-3 py-2 backdrop-blur-sm sm:gap-3 sm:px-4">
      <span className="w-2 shrink-0" />
      <Th label="Mutace" sortKey="name" className="w-[88px] sm:w-[108px]" />
      <Th
        label="Frází"
        sortKey="phrase_count"
        className="ml-auto w-[88px] text-right"
      />
      <Th label="Podíl" className="hidden w-[80px] sm:inline-block" />
      <Th label="D" className="hidden w-8 text-center lg:inline-block" />
      <Th
        label="Hloubka"
        sortKey="depth_pct"
        className="hidden w-[64px] md:inline-block"
      />
      <Th
        label="Nové"
        sortKey="new_total"
        className="w-[72px] text-right"
      />
      <Th
        label="Čas"
        sortKey="updated_at"
        className="hidden w-[44px] text-right sm:inline-block"
      />
      <Th label="Status" className="hidden w-[52px] md:inline-block" />
      <span className="ml-1 w-4 shrink-0" />
    </div>
  );
}

// ─── main component ─────────────────────────────────────────────
export function MutationsTable({
  rows,
  filter,
  onFilterChange,
  className = "",
}: {
  rows: DashboardRow[];
  filter: FilterState;
  onFilterChange: (next: FilterState) => void;
  className?: string;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const parentRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── filter + sort ──
  const filteredRows = useMemo(() => {
    let result = rows;

    if (filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.gl.includes(q) ||
          r.hl.includes(q) ||
          `${r.gl}-${r.hl}`.includes(q),
      );
    }

    if (filter.onlyProblematic) {
      result = result.filter((r) => !isHeartbeatAlive(r.updated_at));
    }

    return sortRows(result, filter.sortKey, filter.sortDir);
  }, [rows, filter]);

  // ── flatten with optional group headers ──
  const flatItems = useMemo<FlatItem[]>(() => {
    if (!filter.groupByGl) {
      return filteredRows.map((row) => ({ kind: "row", row }));
    }

    // group by gl
    const groups = new Map<string, DashboardRow[]>();
    for (const row of filteredRows) {
      const existing = groups.get(row.gl) ?? [];
      existing.push(row);
      groups.set(row.gl, existing);
    }

    const items: FlatItem[] = [];
    for (const [gl, glRows] of groups) {
      const phraseCount = glRows.reduce((s, r) => s + r.phrase_count, 0);
      items.push({
        kind: "group",
        gl,
        label: `${flagEmoji(gl)} ${gl.toUpperCase()}`,
        count: glRows.length,
        phraseCount,
      });
      for (const row of glRows) {
        items.push({ kind: "row", row });
      }
    }
    return items;
  }, [filteredRows, filter.groupByGl]);

  // ── virtualizer ──
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (!item) return 48;
      if (item.kind === "group") return 36;
      const key = `${item.row.gl}-${item.row.hl}`;
      return expandedKeys.has(key) ? 208 : 48;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 5,
  });

  function handleSortChange(key: FilterState["sortKey"]) {
    if (filter.sortKey === key) {
      onFilterChange({ ...filter, sortDir: filter.sortDir === "asc" ? "desc" : "asc" });
    } else {
      onFilterChange({ ...filter, sortKey: key, sortDir: "desc" });
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <TableHeader filter={filter} onSortChange={handleSortChange} />

      {/* Empty state */}
      {flatItems.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
          {filter.search || filter.onlyProblematic
            ? "Žádné výsledky"
            : "Načítám…"}
        </div>
      )}

      {/* Virtual scroll */}
      {flatItems.length > 0 && (
        <div
          ref={parentRef}
          style={{ height: "calc(100vh - 380px)", minHeight: 300, overflowY: "auto" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const item = flatItems[vi.index];
              if (!item) return null;

              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {item.kind === "group" ? (
                    <GroupHeader item={item} />
                  ) : (
                    <MutationRow
                      row={item.row}
                      expanded={expandedKeys.has(
                        `${item.row.gl}-${item.row.hl}`,
                      )}
                      onToggle={() =>
                        toggle(`${item.row.gl}-${item.row.hl}`)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupHeader({ item }: { item: GroupItem }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-100/80 bg-zinc-50/60 px-4 py-2">
      <span className="text-sm font-semibold text-zinc-700">{item.label}</span>
      <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] text-zinc-500">
        {item.count}
      </span>
    </div>
  );
}
