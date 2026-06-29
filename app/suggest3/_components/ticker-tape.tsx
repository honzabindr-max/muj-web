import { MONO } from "./glass";
import { fmt, type Market } from "../_lib/markets";
import type { LiveMarket } from "../_hooks/use-suggest3";

function deltaColor(d: number): string {
  return d > 0 ? "#34a853" : d < 0 ? "#ea4335" : "#9aa0a6";
}

export function TickerTape({ markets }: { markets: LiveMarket[] }) {
  const top = [...markets].sort((a, b) => b.phrases - a.phrases).slice(0, 16);
  const loop = [...top, ...top];

  return (
    <div
      style={{
        background: "rgba(255,255,255,.45)",
        backdropFilter: "blur(14px) saturate(1.5)",
        WebkitBackdropFilter: "blur(14px) saturate(1.5)",
        overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,.55)",
      }}
    >
      <div style={{ display: "flex", width: "max-content", animation: "s3tape 48s linear infinite", willChange: "transform" }}>
        {loop.map((m: Market & { tickDelta: number }, i) => (
          <div
            key={`${m.gl}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRight: "1px solid rgba(0,0,0,.06)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 12, color: "#5f6368", fontWeight: 500 }}>{m.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#202124", fontVariantNumeric: "tabular-nums" }}>
              {fmt(m.phrases)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: deltaColor(m.tickDelta) }}>
              {m.tickDelta > 0 ? "+" : ""}
              {fmt(m.tickDelta)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
