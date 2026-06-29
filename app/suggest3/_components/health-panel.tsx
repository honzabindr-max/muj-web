import { GlassCard, MONO } from "./glass";
import { fmt, type SourceStat } from "../_lib/markets";

// GPT decision #1: honest per-source health (Google / Seznam), no fake regions.
export function HealthPanel({ sources }: { sources: SourceStat[] }) {
  const new24hTotal = sources.reduce((s, x) => s + x.new24h, 0);

  return (
    <GlassCard style={{ padding: "18px 20px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Sběr podle zdroje</div>
          <div style={{ fontSize: 11, color: "#9aa09c", marginTop: 3 }}>Stav podle crawleru</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: "#16a34a", fontVariantNumeric: "tabular-nums" }}>
            +{fmt(new24hTotal)}
          </div>
          <div style={{ fontSize: 10, color: "#9aa09c" }}>nové / 24 h</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {sources.length === 0 && <div style={{ fontSize: 12, color: "#9aa09c" }}>Žádná data zdrojů</div>}
        {sources.map((s) => {
          const pct = s.total > 0 ? Math.round((s.running / s.total) * 100) : 0;
          return (
            <div key={s.source} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.freshColor, flex: "none" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#3a3f3c" }}>{s.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "#6c716e", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                  {s.running}/{s.total} trhů běží
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "#eef0ee", overflow: "hidden" }}>
                <div style={{ height: "100%", background: s.freshColor, width: `${pct}%` }} />
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6c716e", fontFamily: MONO, fontVariantNumeric: "tabular-nums", flexWrap: "wrap" }}>
                <span style={{ color: "#16a34a" }}>+{fmt(s.new24h)} / 24 h</span>
                <span>fronta {fmt(s.queue)}</span>
                <span>hloubka {s.depthAvg}%</span>
                {s.stale > 0 && <span style={{ color: "#dc2626" }}>{s.stale} zastaralé</span>}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
