import { GlassCard, KPI_LABEL, MONO } from "./glass";
import { fmt } from "../_lib/markets";
import { sparkPath } from "../_lib/svg";

const cardStyle = { padding: "17px 19px", display: "flex", flexDirection: "column" as const, justifyContent: "space-between" };

export type KpiData = {
  total: number;
  totalSpark: number[];
  today: number | null;
  tempo: number | null;
  runningCount: number;
  workerDots: boolean[];
  freshMedian: number;
  freshColor: string;
  greenPct: number;
  amberPct: number;
  redPct: number;
  bfsAvg: number;
  bfsDone: number;
  bfsTotal: number;
};

export function KpiCards({ d }: { d: KpiData }) {
  const spark = sparkPath(d.totalSpark, 320, 30);
  const sparkArea = spark ? `M0 30 L${spark.slice(1)} L320 30 Z` : "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr 1fr 1fr", gap: 14 }}>
      {/* Fráze celkem */}
      <GlassCard style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={KPI_LABEL}>Fráze celkem</span>
          <span style={{ fontSize: 10, color: "#6c716e" }}>z MV · á 5 min</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 38, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#1a73e8" }}>
            {fmt(d.total)}
          </span>
        </div>
        <svg width="100%" height="34" viewBox="0 0 320 34" preserveAspectRatio="none" style={{ marginTop: 10, overflow: "visible" }}>
          {sparkArea && <path d={sparkArea} fill="rgba(26,115,232,.10)" />}
          {spark && <path d={spark} fill="none" stroke="#1a73e8" strokeWidth="1.6" />}
        </svg>
      </GlassCard>

      {/* Přírůstek dnes */}
      <GlassCard style={cardStyle}>
        <span style={KPI_LABEL}>Přírůstek dnes</span>
        <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 600, lineHeight: 1, color: "#16a34a", fontVariantNumeric: "tabular-nums", marginTop: 10 }}>
          {d.today === null ? "—" : `+${fmt(d.today)}`}
        </span>
        <span style={{ fontSize: 11, color: "#6c716e", marginTop: 8 }}>
          tempo{" "}
          <strong style={{ fontFamily: MONO, color: "#15181a", fontWeight: 600 }}>
            {d.tempo === null ? "—" : fmt(d.tempo)}
          </strong>{" "}
          /min
        </span>
      </GlassCard>

      {/* Aktivní crawleři */}
      <GlassCard style={cardStyle}>
        <span style={KPI_LABEL}>Aktivní crawleři</span>
        <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums", marginTop: 10, color: "#a142f4" }}>
          {d.runningCount}/{d.workerDots.length}
        </span>
        <div style={{ display: "flex", gap: 5, marginTop: 11 }}>
          {d.workerDots.map((on, i) => (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: on ? "#a142f4" : "#dcdfdc" }} />
          ))}
        </div>
      </GlassCard>

      {/* Čerstvost */}
      <GlassCard style={cardStyle}>
        <span style={KPI_LABEL}>Čerstvost</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, whiteSpace: "nowrap" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.freshColor, flex: "none" }} />
          <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {d.freshMedian} s
          </span>
          <span style={{ fontSize: 13, color: "#9aa09c" }}>medián</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 11 }}>
          <span style={{ height: 5, borderRadius: 3, background: "#16a34a", width: `${d.greenPct}%` }} />
          <span style={{ height: 5, borderRadius: 3, background: "#c2820a", width: `${d.amberPct}%` }} />
          <span style={{ height: 5, borderRadius: 3, background: "#dc2626", width: `${d.redPct}%` }} />
        </div>
      </GlassCard>

      {/* BFS průchod */}
      <GlassCard style={cardStyle}>
        <span style={KPI_LABEL}>BFS průchod</span>
        <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums", marginTop: 10, color: "#d97706" }}>
          {d.bfsAvg}%
        </span>
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 6, borderRadius: 4, background: "#eef0ee", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#d97706", width: `${d.bfsAvg}%` }} />
          </div>
          <span style={{ fontSize: 11, color: "#6c716e", fontFamily: MONO, marginTop: 6, display: "block" }}>
            {fmt(d.bfsDone)} / {fmt(d.bfsTotal)} dotazů
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
