"use client";

import { useMemo, useState } from "react";
import { GlassCard, MONO } from "./glass";
import { fmt, freshColor, freshLabel, STATUS_META } from "../_lib/markets";
import { sparkPath } from "../_lib/svg";
import type { LiveMarket } from "../_hooks/use-suggest3";

type SortKey = "name" | "phrases" | "status" | "freshSec" | "bfs" | "queue" | "pilot";

const thBase: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#9aa09c",
  borderBottom: "1px solid #e4e6e4",
  cursor: "pointer",
  userSelect: "none",
};
const STATUS_ORDER = { run: 0, idle: 1, err: 2 };

export function MarketsBoard({ markets }: { markets: LiveMarket[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("phrases");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);

  const sorted = useMemo(() => {
    const dir = sortDir;
    return [...markets].sort((a, b) => {
      if (sortKey === "name") return a.name < b.name ? -dir : a.name > b.name ? dir : 0;
      if (sortKey === "status") return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [markets, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? 1 : -1);
    }
  };
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir < 0 ? "↓" : "↑") : "↕");

  const now = Date.now();
  const cols: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "name", label: "Trh", align: "left" },
    { key: "phrases", label: "Fráze", align: "right" },
    { key: "status", label: "Stav", align: "left" },
    { key: "freshSec", label: "Čerstvost", align: "right" },
    { key: "bfs", label: "BFS %", align: "left" },
    { key: "queue", label: "Fronta", align: "right" },
    { key: "pilot", label: "Nové / 24 h", align: "right" },
  ];

  return (
    <GlassCard style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", borderBottom: "1px solid #eef0ee" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Trhy</span>
        <span style={{ fontSize: 11, color: "#9aa09c", fontFamily: MONO }}>{markets.length} řádků · živě</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6c716e" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", animation: "s3livepulse 1.6s infinite" }} />
          aktualizace blikne zeleně
        </div>
      </div>
      <div style={{ maxHeight: 540, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(255,255,255,.78)", backdropFilter: "blur(10px)" }}>
              <th onClick={() => onSort("name")} style={{ ...thBase, textAlign: "left", padding: "10px 20px" }}>
                Trh {arrow("name")}
              </th>
              <th onClick={() => onSort("phrases")} style={{ ...thBase, textAlign: "right" }}>Fráze {arrow("phrases")}</th>
              <th style={{ ...thBase, textAlign: "left", cursor: "default" }}>Trend</th>
              <th onClick={() => onSort("status")} style={{ ...thBase, textAlign: "left" }}>Stav {arrow("status")}</th>
              <th onClick={() => onSort("freshSec")} style={{ ...thBase, textAlign: "right" }}>Čerstvost {arrow("freshSec")}</th>
              <th onClick={() => onSort("bfs")} style={{ ...thBase, textAlign: "left" }}>BFS % {arrow("bfs")}</th>
              <th onClick={() => onSort("queue")} style={{ ...thBase, textAlign: "right" }}>Fronta {arrow("queue")}</th>
              <th
                onClick={() => onSort("pilot")}
                title="Počet nových frází za posledních 24 hodin pro daný trh."
                style={{ ...thBase, textAlign: "right", padding: "10px 20px" }}
              >
                Nové / 24 h {arrow("pilot")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const flash = now - m.lastFlash;
              const rowBg = flash < 1700 ? `rgba(22,163,74,${((1 - flash / 1700) * 0.13).toFixed(3)})` : "transparent";
              const meta = STATUS_META[m.status];
              return (
                <tr key={m.gl} style={{ borderBottom: "1px solid #f1f2f1", background: rowBg, transition: "background .25s" }}>
                  <td style={{ padding: "11px 20px", fontSize: 13, fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontFamily: MONO, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(m.phrases)}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <svg width="76" height="22" viewBox="0 0 76 22" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                      <path d={sparkPath(m.spark, 76, 22)} fill="none" stroke={m.status === "err" ? "#dc2626" : "#16a34a"} strokeWidth="1.5" />
                    </svg>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 500, color: meta.color, background: meta.bg, padding: "3px 8px", borderRadius: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color }} />
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: freshColor(m), fontVariantNumeric: "tabular-nums" }}>
                    {freshLabel(m.freshSec)}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#eef0ee", overflow: "hidden", minWidth: 42 }}>
                        <div style={{ height: "100%", background: "#bcdccb", width: `${m.bfs}%` }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "#6c716e", width: 34, textAlign: "right" }}>{m.bfs}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: "#6c716e", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(m.queue)}
                  </td>
                  <td style={{ padding: "11px 20px", textAlign: "right", fontFamily: MONO, fontSize: 12, color: m.pilot > 0 ? "#16a34a" : "#b6bbb7", fontVariantNumeric: "tabular-nums" }}>
                    {m.pilot > 0 ? `+${fmt(m.pilot)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
