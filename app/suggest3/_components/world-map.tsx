"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { GlassCard, MONO } from "./glass";
import { ALPHA2_TO_NUMERIC, fmt, freshLabel, STATUS_META, type Market } from "../_lib/markets";
import type { LiveMarket } from "../_hooks/use-suggest3";

type Feat = { id: number; d: string; cx: number; cy: number };
type Hover = { m: Market; x: number; y: number };

export function WorldMap({ markets, today }: { markets: LiveMarket[]; today: number | null }) {
  const [feats, setFeats] = useState<Feat[] | null>(null);
  const [err, setErr] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((w: any) => {
        const fc = topojson.feature(w, w.objects.countries) as unknown as GeoJSON.FeatureCollection;
        const proj = d3.geoNaturalEarth1().fitExtent([[8, 8], [992, 486]], fc);
        const gp = d3.geoPath(proj);
        setFeats(
          fc.features.map((fe) => {
            const c = gp.centroid(fe);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { id: +(fe as any).id, d: gp(fe) ?? "", cx: c[0], cy: c[1] };
          }),
        );
      })
      .catch(() => setErr(true));
  }, []);

  // market by numeric ISO id
  const byIso = useMemo(() => {
    const map = new Map<number, LiveMarket>();
    for (const m of markets) {
      const id = ALPHA2_TO_NUMERIC[m.gl];
      if (id) map.set(id, m);
    }
    return map;
  }, [markets]);

  const maxP = useMemo(() => Math.max(1, ...markets.map((m) => m.phrases)), [markets]);

  const statStr = `${markets.length} aktivních trhů · 198 zemí`;
  const deltaStr = today === null ? "" : `+${fmt(today)} / 24 h`;

  return (
    <GlassCard style={{ marginTop: 14, padding: "18px 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Světová mapa sběru</div>
          <div style={{ fontSize: 11, color: "#9aa09c", marginTop: 3, maxWidth: 560 }}>
            Heatmapa podle počtu frází. Šedé body nemají crawler data. Běžící regiony pulzují zeleně.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#9aa09c" }}>méně</span>
            <span style={{ width: 84, height: 7, borderRadius: 4, background: "linear-gradient(90deg,#dfe3df,#9ed3b1,#16a34a)" }} />
            <span style={{ fontSize: 10, color: "#9aa09c" }}>více frází</span>
          </div>
          <div style={{ fontSize: 11, color: "#6c716e", fontFamily: MONO }}>{statStr}</div>
          {deltaStr && <div style={{ fontSize: 11, color: "#16a34a", fontFamily: MONO }}>{deltaStr}</div>}
        </div>
      </div>

      <div style={{ marginTop: 8, position: "relative" }}>
        {err ? (
          <div style={{ padding: "70px 0", textAlign: "center", color: "#9aa09c", fontSize: 12 }}>Mapu se nepodařilo načíst</div>
        ) : !feats ? (
          <div style={{ padding: "90px 0", textAlign: "center", color: "#9aa09c", fontSize: 12 }}>Načítám mapu…</div>
        ) : (
          <>
            <svg viewBox="0 0 1000 494" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
              {feats.map((fe, i) => {
                const m = byIso.get(fe.id);
                if (!m) {
                  return <path key={i} d={fe.d} fill="#e6e9e6" stroke="#f3f4f3" strokeWidth={0.6} strokeLinejoin="round" />;
                }
                const t = Math.pow(m.phrases / maxP, 0.55);
                const a = (0.2 + t * 0.76).toFixed(2);
                const fill =
                  m.status === "err" ? `rgba(220,38,38,${a})` : m.status === "idle" ? `rgba(194,130,10,${a})` : `rgba(22,163,74,${a})`;
                const pulsing = m.status === "run" && t > 0.45;
                return (
                  <path
                    key={i}
                    d={fe.d}
                    fill={fill}
                    stroke="#f3f4f3"
                    strokeWidth={0.6}
                    strokeLinejoin="round"
                    style={{ cursor: "pointer", animation: pulsing ? "s3mappulse 2.2s ease-in-out infinite" : undefined }}
                    onMouseEnter={() => setHover({ m, x: (fe.cx / 1000) * 100, y: (fe.cy / 494) * 100 })}
                    onMouseLeave={() => setHover((h) => (h && h.m === m ? null : h))}
                  />
                );
              })}
            </svg>
            {hover && <MapTooltip hover={hover} />}
          </>
        )}
      </div>
    </GlassCard>
  );
}

function MapTooltip({ hover }: { hover: Hover }) {
  const m = hover.m as LiveMarket;
  const meta = STATUS_META[m.status];
  const Row = ({ k, v, c }: { k: string; v: string; c?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, fontSize: 11 }}>
      <span style={{ color: "#9aa09c" }}>{k}</span>
      <span style={{ fontFamily: MONO, color: c ?? "#15181a", fontWeight: 500 }}>{v}</span>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: `${hover.x}%`,
        top: `${hover.y}%`,
        transform: "translate(-50%,calc(-100% - 12px))",
        pointerEvents: "none",
        zIndex: 30,
        background: "#fff",
        border: "1px solid #e4e6e4",
        borderRadius: 11,
        boxShadow: "0 10px 28px rgba(20,24,26,.14)",
        padding: "11px 13px",
        minWidth: 182,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, padding: "2px 7px", borderRadius: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color }} />
          {meta.label}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Row k="Frází" v={fmt(m.phrases)} />
        <Row k="Čerstvost" v={freshLabel(m.freshSec)} c={meta.color} />
        <Row k="BFS průchod" v={`${m.bfs}%`} />
        <Row k="Fronta" v={fmt(m.queue)} />
        <Row k="Nové / 24 h" v={m.pilot > 0 ? `+${fmt(m.pilot)}` : "—"} c={m.pilot > 0 ? "#16a34a" : "#b6bbb7"} />
      </div>
    </div>
  );
}
