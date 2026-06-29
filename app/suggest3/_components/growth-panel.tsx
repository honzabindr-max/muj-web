"use client";

import { useMemo, useState } from "react";
import { GlassCard, MONO } from "./glass";
import { fmt } from "../_lib/markets";
import { lineAndArea } from "../_lib/svg";
import type { PhraseSample } from "../../suggest2/_hooks/use-suggest2-data";

type Range = "1h" | "24h" | "7d";
const WINDOW_MS: Record<Range, number> = { "1h": 3_600_000, "24h": 86_400_000, "7d": 604_800_000 };
const X_LABELS: Record<Range, string[]> = {
  "1h": ["−60 m", "−40 m", "−20 m", "teď"],
  "24h": ["−24 h", "−16 h", "−8 h", "teď"],
  "7d": ["−7 d", "−5 d", "−3 d", "teď"],
};

function segBtn(active: boolean): React.CSSProperties {
  return active
    ? { border: "none", background: "#fff", color: "#15181a", fontWeight: 600, fontSize: 12, padding: "4px 12px", borderRadius: 6, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,.06)", fontFamily: "inherit" }
    : { border: "none", background: "transparent", color: "#6c716e", fontWeight: 500, fontSize: 12, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" };
}

export function GrowthPanel({ samples, total }: { samples: PhraseSample[]; total: number }) {
  const [range, setRange] = useState<Range>("1h");

  const filtered = useMemo(() => {
    const cutoff = Date.now() - WINDOW_MS[range];
    return samples.filter((s) => s.ts >= cutoff);
  }, [samples, range]);

  const chart = useMemo(() => lineAndArea(filtered.map((s) => s.total), 820, 200), [filtered]);
  const rangeDelta = filtered.length > 1 ? filtered[filtered.length - 1].total - filtered[0].total : 0;

  const firstSampleStr =
    samples.length > 0
      ? new Date(samples[0].ts).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
      : null;
  const emptyMsg = firstSampleStr ? `Historie se sbírá od ${firstSampleStr}` : "Historie se zatím nesbírá";

  return (
    <GlassCard style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Jak databáze roste</div>
          <div style={{ fontSize: 11, color: "#9aa09c", marginTop: 3 }}>Krokový dle MV (≈5 min) · od začátku session</div>
        </div>
        <div style={{ display: "flex", gap: 3, background: "#f3f4f3", border: "1px solid #e4e6e4", borderRadius: 8, padding: 3 }}>
          {(["1h", "24h", "7d"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={segBtn(range === r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: "#1a73e8" }}>+{fmt(rangeDelta)}</span>
        <span style={{ fontSize: 12, color: "#9aa09c" }}>za {range}</span>
      </div>

      <div style={{ position: "relative", marginTop: 8 }}>
        <svg width="100%" height="200" viewBox="0 0 820 200" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
          <line x1="6" y1="50" x2="814" y2="50" stroke="#eef0ee" strokeWidth="1" />
          <line x1="6" y1="100" x2="814" y2="100" stroke="#eef0ee" strokeWidth="1" />
          <line x1="6" y1="150" x2="814" y2="150" stroke="#eef0ee" strokeWidth="1" />
          {chart && <path d={chart.area} fill="rgba(26,115,232,.10)" />}
          {chart && <path d={chart.line} fill="none" stroke="#1a73e8" strokeWidth="2.2" strokeLinejoin="round" />}
        </svg>
        {chart && (
          <div
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#1a73e8",
              border: "2px solid #fff",
              animation: "s3lastdot 1.6s infinite",
              left: `${((chart.lastX / 820) * 100).toFixed(2)}%`,
              top: `${((chart.lastY / 200) * 100).toFixed(2)}%`,
              transform: "translate(-50%,-50%)",
            }}
          />
        )}
        {!chart && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9aa09c", textAlign: "center" }}>
            <span>Zatím málo dat pro {range}</span>
            <span style={{ fontSize: 11 }}>{emptyMsg}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#9aa09c", fontFamily: MONO }}>
        {X_LABELS[range].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
    </GlassCard>
  );
}
