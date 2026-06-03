"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { DashboardRow } from "../_lib/types";
import { isHeartbeatAlive } from "../_lib/types";
import { flagEmoji, formatNumber, countryName } from "../_lib/utils";

// ── Types ─────────────────────────────────────────────────────────
export type SuggestWorldMapProps = {
  rows: DashboardRow[];
  selectedGl?: string | null;
  onSelectGl?: (gl: string | null) => void;
  className?: string;
};

type CountryStatus = "running" | "done" | "paused" | "error" | "idle";

type CountryData = {
  gl: string;
  phraseCount: number;
  new24h: number;
  mutationCount: number;
  depthPct: number | null;
};

type RenderData = {
  gl: string;
  score: number;
  isFallback: boolean;
  realData?: CountryData;
};

// ── ISO alpha-2 → numeric ─────────────────────────────────────────
const ALPHA2_TO_NUMERIC: Record<string, number> = {
  af: 4, al: 8, dz: 12, ad: 20, ao: 24, ag: 28, ar: 32, am: 51, au: 36,
  at: 40, az: 31, bs: 44, bh: 48, bd: 50, bb: 52, by: 112, be: 56, bz: 84,
  bj: 204, bt: 64, bo: 68, ba: 70, bw: 72, br: 76, bn: 96, bg: 100, bf: 854,
  bi: 108, cv: 132, kh: 116, cm: 120, ca: 124, cf: 140, td: 148, cl: 152,
  cn: 156, co: 170, km: 174, cg: 178, cd: 180, cr: 188, ci: 384, hr: 191,
  cu: 192, cy: 196, cz: 203, dk: 208, dj: 262, dm: 212, do: 214, ec: 218,
  eg: 818, sv: 222, gq: 226, er: 232, ee: 233, sz: 748, et: 231, fj: 242,
  fi: 246, fr: 250, ga: 266, gm: 270, ge: 268, de: 276, gh: 288, gr: 300,
  gd: 308, gt: 320, gn: 324, gw: 624, gy: 328, ht: 332, hn: 340, hu: 348,
  is: 352, in: 356, id: 360, ir: 364, iq: 368, ie: 372, il: 376, it: 380,
  jm: 388, jp: 392, jo: 400, kz: 398, ke: 404, ki: 296, kw: 414, kg: 417,
  la: 418, lv: 428, lb: 422, ls: 426, lr: 430, ly: 434, li: 438, lt: 440,
  lu: 442, mg: 450, mw: 454, my: 458, mv: 462, ml: 466, mt: 470, mh: 584,
  mr: 478, mu: 480, mx: 484, fm: 583, md: 498, mc: 492, mn: 496, me: 499,
  ma: 504, mz: 508, mm: 104, na: 516, nr: 520, np: 524, nl: 528, nz: 554,
  ni: 558, ne: 562, ng: 566, mk: 807, no: 578, om: 512, pk: 586, pw: 585,
  pa: 591, pg: 598, py: 600, pe: 604, ph: 608, pl: 616, pt: 620, qa: 634,
  ro: 642, ru: 643, rw: 646, kn: 659, lc: 662, vc: 670, ws: 882, sm: 674,
  st: 678, sa: 682, sn: 686, rs: 688, sc: 690, sl: 694, sg: 702, sk: 703,
  si: 705, sb: 90, so: 706, za: 710, ss: 728, es: 724, lk: 144, sd: 729,
  sr: 740, se: 752, ch: 756, sy: 760, tw: 158, tj: 762, tz: 834, th: 764,
  tl: 626, tg: 768, to: 776, tt: 780, tn: 788, tr: 792, tm: 795, tv: 798,
  ug: 800, ua: 804, ae: 784, gb: 826, us: 840, uy: 858, uz: 860,
  vu: 548, ve: 862, vn: 704, ye: 887, zm: 894, zw: 716,
  uk: 826, // alias for gb
};

// Reverse map (numeric → alpha2), 'gb' preferred over alias 'uk'
const NUMERIC_TO_ALPHA2: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const [a2, num] of Object.entries(ALPHA2_TO_NUMERIC)) {
    if (!map[num] || a2 === "gb") map[num] = a2;
  }
  return map;
})();

// ── Heatmap color scale ───────────────────────────────────────────
const HEATMAP_COLORS = [
  "#bfdbfe", "#93c5fd", "#60a5fa",
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#172554", "#0b1f66",
];
const LEGEND_COLORS = ["#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8", "#0b1f66"];
const FALLBACK_MIN_SCORE = 8;

function getHeatmapColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - 1) / 99));
  return d3.interpolateRgbBasis(HEATMAP_COLORS)(t);
}

function getHeatmapScore(value: number, maxValue: number): number {
  if (!maxValue || maxValue <= 0) return FALLBACK_MIN_SCORE;
  const normalized = Math.max(0, Math.min(1, value / maxValue));
  const transformed = Math.pow(normalized, 0.42);
  return Math.max(FALLBACK_MIN_SCORE, Math.min(100, Math.round(transformed * 99) + 1));
}

// ── Stable fallback values ────────────────────────────────────────
const MAJOR_MARKET_BOOST: Record<string, number> = {
  us: 1.0, in: 0.92, cn: 0.86, br: 0.78, de: 0.76, gb: 0.72, uk: 0.72,
  jp: 0.70, fr: 0.68, ca: 0.55, mx: 0.58, es: 0.56, it: 0.54,
  au: 0.52, kr: 0.50, id: 0.48, ru: 0.46, tr: 0.42,
};

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function stableFallbackValue(gl: string, maxValue: number): number {
  if (!maxValue || maxValue <= 0) return 1000;
  const boost = MAJOR_MARKET_BOOST[gl];
  if (boost !== undefined) return Math.round(maxValue * boost);
  const normalized = (stableHash(gl) % 1000) / 1000;
  return Math.round(maxValue * (0.08 + normalized * 0.32));
}

// ── Status stroke config ──────────────────────────────────────────
const STATUS_STROKE: Record<CountryStatus, { color: string; width: number }> = {
  running: { color: "#16a34a", width: 1.45 },
  done:    { color: "rgba(37,99,235,.48)", width: 0.65 },
  paused:  { color: "rgba(245,158,11,.85)", width: 1.05 },
  error:   { color: "rgba(220,38,38,.85)", width: 1.15 },
  idle:    { color: "rgba(255,255,255,.55)", width: 0.35 },
};

const STATUS_LABELS: Record<CountryStatus, string> = {
  running: "Aktivní", done: "Hotovo", paused: "Pauza",
  error: "Problém", idle: "Neaktivní",
};

// ── Aggregate rows → per-country fill data (phrase counts only) ───
// NOTE: status is intentionally NOT included here — it's tracked
// separately in glStatusMap so fill renders stay stable between polls.
function aggregateFills(rows: DashboardRow[]): Map<string, CountryData> {
  const map = new Map<string, CountryData>();
  for (const row of rows) {
    const gl = row.gl.toLowerCase();
    const existing = map.get(gl);
    if (!existing) {
      map.set(gl, {
        gl,
        phraseCount: row.phrase_count,
        new24h: row.new_24h ?? 0,
        mutationCount: 1,
        depthPct: row.depth_pct,
      });
    } else {
      existing.phraseCount += row.phrase_count;
      existing.new24h += row.new_24h ?? 0;
      existing.mutationCount += 1;
      if (row.depth_pct !== null) {
        existing.depthPct = existing.depthPct === null
          ? row.depth_pct : Math.max(existing.depthPct, row.depth_pct);
      }
    }
  }
  return map;
}

// ── Per-country status map (heartbeat-based, updates every poll) ───
// Uses isHeartbeatAlive which checks updated_at < WARN_THRESHOLD_S (180s).
// This covers both green (<60s) and amber (60–180s) heartbeat states,
// so any live crawler causes the country to blink — consistent with the
// table's three-state dot system where both green and amber mean "alive".
function buildStatusMap(rows: DashboardRow[]): Map<string, CountryStatus> {
  const priority: Record<CountryStatus, number> = {
    error: 4, running: 3, paused: 2, done: 1, idle: 0,
  };
  const map = new Map<string, CountryStatus>();
  for (const row of rows) {
    const gl = row.gl.toLowerCase();
    // Heartbeat wins over status field — avoids crash remnants
    // (status="running" but updated_at stale) and mismatches
    const rowStatus: CountryStatus = isHeartbeatAlive(row.updated_at)
      ? "running"
      : row.status === "paused" ? "paused"
      : row.status === "done" ? "done"
      : "idle";
    const existing = map.get(gl);
    if (!existing || priority[rowStatus] > priority[existing]) {
      map.set(gl, rowStatus);
    }
  }
  return map;
}

// ── Build render map: numericId → RenderData (fills only) ─────────
function buildRenderMap(fillMap: Map<string, CountryData>): Map<number, RenderData> {
  const result = new Map<number, RenderData>();
  const maxReal = Math.max(
    ...Array.from(fillMap.values()).map((c) => c.phraseCount), 100_000,
  );
  for (const [numStr, gl] of Object.entries(NUMERIC_TO_ALPHA2)) {
    const numId = Number(numStr);
    const real = fillMap.get(gl);
    if (real) {
      result.set(numId, {
        gl, score: getHeatmapScore(real.phraseCount, maxReal),
        isFallback: false, realData: real,
      });
    } else {
      const fv = stableFallbackValue(gl, maxReal);
      result.set(numId, {
        gl, score: getHeatmapScore(fv, maxReal),
        isFallback: true,
      });
    }
  }
  return result;
}

// ── Tooltip ───────────────────────────────────────────────────────
function Tooltip({
  data,
  currentStatus,
  x,
  y,
}: {
  data: RenderData;
  currentStatus: CountryStatus;
  x: number;
  y: number;
}) {
  const { gl, score, isFallback, realData } = data;
  return (
    <div
      className="pointer-events-none absolute z-50 min-w-[160px] max-w-[210px] rounded-2xl border border-zinc-200/80 bg-white/95 px-3.5 py-3 text-sm shadow-lg backdrop-blur-sm"
      style={{ left: x, top: y - 8 }}
    >
      <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
        <span>{flagEmoji(gl)}</span>
        <span className="truncate">{countryName(gl)} ({gl.toLowerCase()})</span>
      </div>

      {isFallback ? (
        <div className="mt-2 text-xs text-zinc-400 italic">Zatím bez crawler dat</div>
      ) : realData ? (
        <div className="mt-2 space-y-0.5 text-xs text-zinc-600">
          <div className="flex justify-between gap-4">
            <span>Frází</span>
            <span className="font-medium tabular-nums text-zinc-900">{formatNumber(realData.phraseCount)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Heatmap score</span>
            <span className="font-medium tabular-nums text-zinc-900">{score}/100</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Nové / 24 h</span>
            <span className="font-medium tabular-nums text-zinc-900">+{formatNumber(realData.new24h)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Mutace</span>
            <span className="font-medium tabular-nums text-zinc-900">{realData.mutationCount}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Status</span>
            <span className="font-medium text-zinc-900">{STATUS_LABELS[currentStatus]}</span>
          </div>
          {realData.depthPct !== null && (
            <div className="flex justify-between gap-4">
              <span>Hloubka</span>
              <span className="font-medium tabular-nums text-zinc-900">{realData.depthPct} %</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function SuggestWorldMap({
  rows,
  selectedGl,
  onSelectGl,
  className = "",
}: SuggestWorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawFnRef = useRef<() => void>(() => {});
  const [tooltip, setTooltip] = useState<{
    data: RenderData;
    currentStatus: CountryStatus;
    x: number;
    y: number;
  } | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [worldData, setWorldData] = useState<unknown>(null);

  // ── Status map (per-poll, heartbeat-based) ──────────────────────
  // Changes every 3s; used for class updates and strip stats.
  const glStatusMap = useMemo(() => buildStatusMap(rows), [rows]);

  // Keep a ref to glStatusMap so draw() can read current status
  // without including it as a dependency (which would cause full redraws).
  const glStatusMapRef = useRef<Map<string, CountryStatus>>(new Map());
  useEffect(() => { glStatusMapRef.current = glStatusMap; }, [glStatusMap]);

  // ── Fill data (stable between polls) ───────────────────────────
  // phraseFingerprint changes only when phrase_count values actually change.
  // This makes renderMap (and draw) stable between 3s status-only polls.
  const phraseFingerprint = useMemo(
    () => rows.map((r) => `${r.gl}:${r.phrase_count}`).sort().join(","),
    [rows],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFillMap = useMemo(() => aggregateFills(rows), [phraseFingerprint]);
  const renderMap = useMemo(() => buildRenderMap(stableFillMap), [stableFillMap]);

  // ── Strip stats (from live rows / glStatusMap) ──────────────────
  const totalPhrases = useMemo(
    () => rows.reduce((s, r) => s + r.phrase_count, 0), [rows],
  );
  const new24hTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.new_24h ?? 0), 0), [rows],
  );
  const runningCount = useMemo(
    () => Array.from(glStatusMap.values()).filter((s) => s === "running").length,
    [glStatusMap],
  );
  const doneCount = useMemo(
    () => Array.from(glStatusMap.values()).filter((s) => s === "done").length,
    [glStatusMap],
  );
  const totalMappedCountries = renderMap.size;

  // ── Load world-atlas ────────────────────────────────────────────
  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((data) => { setWorldData(data); setMapLoaded(true); })
      .catch(() => setMapError(true));
  }, []);

  // ── Core draw (full SVG rebuild) ────────────────────────────────
  // Runs only when: world data loads, phrase counts change, or selectedGl changes.
  // Does NOT run on every 3s status poll (glStatusMap excluded from deps).
  const draw = useCallback(() => {
    if (!worldData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3
      .geoNaturalEarth1()
      .scale((width / 640) * 100)
      .translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = worldData as any;
    let countries: GeoJSON.Feature[];
    try {
      const fc = topojson.feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
      countries = fc.features;
    } catch {
      setMapError(true);
      return;
    }

    // Ocean sphere
    svg.append("path")
      .datum({ type: "Sphere" } as unknown as GeoJSON.GeoJsonObject)
      .attr("d", path as unknown as string)
      .attr("fill", "rgba(239,246,255,.65)")
      .attr("stroke", "none");

    // Graticule
    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", path as unknown as string)
      .attr("fill", "none")
      .attr("stroke", "rgba(148,163,184,.18)")
      .attr("stroke-width", 0.35);

    // Countries — fill from renderMap, class/stroke from glStatusMapRef
    svg.append("g")
      .selectAll<SVGPathElement, GeoJSON.Feature>("path")
      .data(countries)
      .join("path")
      .attr("d", path as unknown as string)
      .attr("fill", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        return rd ? getHeatmapColor(rd.score) : "#bfdbfe";
      })
      .attr("class", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status = rd && !rd.isFallback
          ? (glStatusMapRef.current.get(rd.gl) ?? "idle")
          : "idle";
        return `country ${status}`;
      })
      .attr("stroke", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status: CountryStatus = rd && !rd.isFallback
          ? (glStatusMapRef.current.get(rd.gl) ?? "idle")
          : "idle";
        return STATUS_STROKE[status].color;
      })
      .attr("stroke-width", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status: CountryStatus = rd && !rd.isFallback
          ? (glStatusMapRef.current.get(rd.gl) ?? "idle")
          : "idle";
        return STATUS_STROKE[status].width;
      })
      .attr("opacity", (d) => {
        if (!selectedGl) return 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        return rd?.gl === selectedGl ? 1 : 0.5;
      })
      .style("cursor", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        return rd && !rd.isFallback ? "pointer" : "default";
      })
      .on("mouseenter", function (event: MouseEvent, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        if (!rd) return;

        const status: CountryStatus = rd.isFallback
          ? "idle"
          : (glStatusMapRef.current.get(rd.gl) ?? "idle");

        d3.select(this).raise()
          .attr("stroke-width", STATUS_STROKE[status].width + 0.8)
          .attr("opacity", 1);

        const rect = containerRef.current!.getBoundingClientRect();
        const rx = event.clientX - rect.left;
        const ry = event.clientY - rect.top;
        const clampedX = rx + 220 > rect.width ? rx - 224 : rx;
        setTooltip({ data: rd, currentStatus: status, x: clampedX, y: ry });
      })
      .on("mousemove", function (event: MouseEvent) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const rx = event.clientX - rect.left;
        const ry = event.clientY - rect.top;
        const clampedX = rx + 220 > rect.width ? rx - 224 : rx;
        setTooltip((prev) => prev ? { ...prev, x: clampedX, y: ry } : null);
      })
      .on("mouseleave", function (_, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status: CountryStatus = rd && !rd.isFallback
          ? (glStatusMapRef.current.get(rd.gl) ?? "idle")
          : "idle";
        d3.select(this)
          .attr("stroke-width", STATUS_STROKE[status].width)
          .attr("opacity", selectedGl && rd?.gl !== selectedGl ? 0.5 : 1);
        setTooltip(null);
      })
      .on("click", function (_, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        if (!rd || rd.isFallback) return;
        onSelectGl?.(selectedGl === rd.gl ? null : rd.gl);
      });

  }, [worldData, renderMap, selectedGl, onSelectGl]);

  // ── Lightweight status update (every 3s poll) ───────────────────
  // Only updates class + stroke attributes on existing paths — no SVG rebuild.
  const updateClasses = useCallback(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGPathElement, GeoJSON.Feature>("path.country")
      .attr("class", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status = rd && !rd.isFallback
          ? (glStatusMap.get(rd.gl) ?? "idle")
          : "idle";
        return `country ${status}`;
      })
      .attr("stroke", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status: CountryStatus = rd && !rd.isFallback
          ? (glStatusMap.get(rd.gl) ?? "idle")
          : "idle";
        return STATUS_STROKE[status].color;
      })
      .attr("stroke-width", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = renderMap.get(Number((d as any).id));
        const status: CountryStatus = rd && !rd.isFallback
          ? (glStatusMap.get(rd.gl) ?? "idle")
          : "idle";
        return STATUS_STROKE[status].width;
      });
  }, [glStatusMap, renderMap]);

  // Keep drawFnRef in sync for resize handler
  useEffect(() => { drawFnRef.current = draw; }, [draw]);

  // Full redraw when fill data or selection changes (NOT on every poll)
  useEffect(() => { draw(); }, [draw]);

  // Lightweight class/stroke update on every status poll
  useEffect(() => { updateClasses(); }, [updateClasses]);

  // Stable resize / ResizeObserver
  useEffect(() => {
    const handle = () => drawFnRef.current();
    window.addEventListener("resize", handle);
    const ro = new ResizeObserver(handle);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", handle);
      ro.disconnect();
    };
  }, []);

  // D3 timer: smooth sine-wave pulse on .country.running elements
  useEffect(() => {
    if (!mapLoaded) return;
    const PERIOD = 1300;
    const timer = d3.timer((elapsed) => {
      if (!svgRef.current) return;
      const t = (Math.sin((elapsed / PERIOD) * Math.PI * 2) + 1) / 2;
      const strokeAlpha = (0.3 + t * 0.7).toFixed(2);
      const strokeWidth = (0.8 + t * 2.4).toFixed(2);
      const glow = t * 9;
      d3.select(svgRef.current)
        .selectAll<SVGPathElement, unknown>(".country.running")
        .attr("stroke", `rgba(22,163,74,${strokeAlpha})`)
        .attr("stroke-width", strokeWidth)
        .style("filter", glow > 0.3
          ? `drop-shadow(0 0 ${glow.toFixed(1)}px rgba(22,163,74,${(t * 0.8).toFixed(2)}))`
          : "none",
        );
    });
    return () => timer.stop();
  }, [mapLoaded]);

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <style>{`
        .country.done   { stroke: rgba(37,99,235,.5);  stroke-width: .7px; }
        .country.paused { stroke: rgba(245,158,11,.9); stroke-width: 1.1px; }
        .country.error  { stroke: rgba(220,38,38,.9);  stroke-width: 1.2px; }
      `}</style>

      {/* Panel header */}
      <div className="flex flex-col gap-2.5 border-b border-white/60 bg-white/30 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-800">Světová mapa sběru</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            100stupňová heatmapa podle absolutního počtu frází. Běžící země pulzují zeleně.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs text-zinc-600 tabular-nums">
            {formatNumber(totalPhrases)} frází
          </span>
          <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs text-zinc-600 tabular-nums">
            {totalMappedCountries} zemí
          </span>
          {runningCount > 0 && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 tabular-nums">
              ● {runningCount} běží
            </span>
          )}
          {doneCount > 0 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 tabular-nums">
              ● {doneCount} hotovo
            </span>
          )}
          <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs text-zinc-600 tabular-nums">
            +{formatNumber(new24hTotal)} / 24 h
          </span>
        </div>
      </div>

      {/* Map area */}
      <div className="relative px-4 pb-4 pt-3">
        {mapError ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            Mapu se nepodařilo načíst.
          </div>
        ) : !mapLoaded ? (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
            Načítám mapu…
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative w-full"
            style={{ height: "clamp(260px, 42vw, 520px)" }}
          >
            <svg ref={svgRef} width="100%" height="100%" className="block rounded-xl" />

            {tooltip && (
              <Tooltip
                data={tooltip.data}
                currentStatus={tooltip.currentStatus}
                x={tooltip.x}
                y={tooltip.y}
              />
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1.5 text-[10px] text-zinc-500 shadow-sm backdrop-blur-md">
              <span>0</span>
              <div className="flex h-2.5 w-14 overflow-hidden rounded-full sm:w-20">
                {LEGEND_COLORS.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                ))}
              </div>
              <span>100</span>
              <span className="ml-1 flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="hidden sm:inline">běží</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                <span className="hidden sm:inline">hotovo</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
