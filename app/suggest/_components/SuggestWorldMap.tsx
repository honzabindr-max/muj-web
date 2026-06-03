"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import type { DashboardRow } from "../_lib/types";
import { flagEmoji, formatNumber } from "../_lib/utils";

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
  status: CountryStatus;
  depthPct: number | null;
  score: number; // 1–100
};

// ── ISO alpha-2 → numeric (world-atlas uses numeric IDs) ──────────
// Covers most common country codes used by Google gl parameter
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
  ug: 800, ua: 804, ae: 784, gb: 826, uk: 826, us: 840, uy: 858, uz: 860,
  vu: 548, ve: 862, vn: 704, ye: 887, zm: 894, zw: 716,
  // Aliases
  xk: 383, // Kosovo (not in all datasets)
};

const STATUS_COLORS: Record<CountryStatus, { stroke: string; width: number }> = {
  running: { stroke: "#16a34a", width: 1.4 },
  done:    { stroke: "#3b82f6", width: 1.0 },
  paused:  { stroke: "#d97706", width: 1.0 },
  error:   { stroke: "#dc2626", width: 1.4 },
  idle:    { stroke: "#d1d5db", width: 0.5 },
};

const HEAT_COLORS = [
  "#f8fbff", "#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e40af", "#0b1f66",
];

function heatScore(value: number, maxValue: number): number {
  if (!maxValue || !value) return 0;
  return Math.round(Math.pow(value / maxValue, 0.42) * 99) + 1;
}

function heatColor(score: number): string {
  if (score <= 0) return "#f3f4f6";
  const idx = Math.floor(((score - 1) / 99) * (HEAT_COLORS.length - 1));
  const clamped = Math.max(0, Math.min(HEAT_COLORS.length - 1, idx));
  return HEAT_COLORS[clamped];
}

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česká republika", sk: "Slovensko", de: "Německo", at: "Rakousko",
  pl: "Polsko", hu: "Maďarsko", us: "Spojené státy", gb: "Velká Británie",
  uk: "Velká Británie", fr: "Francie", es: "Španělsko", it: "Itálie",
  ru: "Rusko", cn: "Čína", jp: "Japonsko", br: "Brazílie", au: "Austrálie",
  ca: "Kanada", in: "Indie", mx: "Mexiko", kr: "Jižní Korea", tr: "Turecko",
  sa: "Saúdská Arábie", nl: "Nizozemsko", ch: "Švýcarsko", se: "Švédsko",
  no: "Norsko", dk: "Dánsko", fi: "Finsko", be: "Belgie", pt: "Portugalsko",
  ro: "Rumunsko", ua: "Ukrajina", bg: "Bulharsko", hr: "Chorvatsko",
  rs: "Srbsko", si: "Slovinsko", gr: "Řecko", lt: "Litva", lv: "Lotyšsko",
  ee: "Estonsko", ie: "Irsko", nz: "Nový Zéland", za: "Jižní Afrika",
  ar: "Argentina", cl: "Chile", co: "Kolumbie", pe: "Peru", ve: "Venezuela",
  eg: "Egypt", ng: "Nigérie", ke: "Keňa", ma: "Maroko", gh: "Ghana",
  id: "Indonésie", my: "Malajsie", ph: "Filipíny", sg: "Singapur",
  th: "Thajsko", vn: "Vietnam", bd: "Bangladéš", pk: "Pákistán",
  ae: "Spojené arabské emiráty", il: "Izrael", iq: "Irák", ir: "Írán",
};

function countryName(gl: string): string {
  return COUNTRY_NAMES[gl.toLowerCase()] ?? gl.toUpperCase();
}

function statusLabel(s: CountryStatus): string {
  const map: Record<CountryStatus, string> = {
    running: "Aktivní", done: "Hotovo", paused: "Pauza",
    error: "Problém", idle: "Neaktivní",
  };
  return map[s];
}

// ── Aggregate rows → per-country ─────────────────────────────────
function aggregateByGl(rows: DashboardRow[]): Map<string, CountryData> {
  const map = new Map<string, CountryData>();

  for (const row of rows) {
    const gl = row.gl.toLowerCase();
    const existing = map.get(gl);

    let rowStatus: CountryStatus = "idle";
    if (row.status === "running") rowStatus = "running";
    else if (row.status === "paused") rowStatus = "paused";
    else if (row.status === "done") rowStatus = "done";
    else if (row.status === "pending") rowStatus = "idle";

    if (!existing) {
      map.set(gl, {
        gl,
        phraseCount: row.phrase_count,
        new24h: row.new_24h ?? 0,
        mutationCount: 1,
        status: rowStatus,
        depthPct: row.depth_pct,
      } as CountryData & { score: number });
    } else {
      existing.phraseCount += row.phrase_count;
      existing.new24h += row.new_24h ?? 0;
      existing.mutationCount += 1;
      // worst status wins: error > running > paused > done > idle
      const priority: Record<CountryStatus, number> = {
        error: 4, running: 3, paused: 2, done: 1, idle: 0,
      };
      if (priority[rowStatus] > priority[existing.status]) {
        existing.status = rowStatus;
      }
      if (row.depth_pct !== null) {
        existing.depthPct = existing.depthPct === null
          ? row.depth_pct
          : Math.max(existing.depthPct, row.depth_pct);
      }
    }
  }

  // Compute scores
  const max = Math.max(...Array.from(map.values()).map((c) => c.phraseCount), 1);
  for (const c of map.values()) {
    (c as CountryData).score = heatScore(c.phraseCount, max);
  }

  return map;
}

// ── Tooltip component ─────────────────────────────────────────────
function Tooltip({
  data,
  x,
  y,
}: {
  data: CountryData;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-50 max-w-[200px] rounded-2xl border border-zinc-200/80 bg-white/95 px-3.5 py-3 text-sm shadow-lg backdrop-blur-sm"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
        <span>{flagEmoji(data.gl)}</span>
        <span>{countryName(data.gl)}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-400">GL: {data.gl.toUpperCase()}</div>
      <div className="mt-2 space-y-0.5 text-xs text-zinc-600">
        <div className="flex justify-between gap-4">
          <span>Frází</span>
          <span className="font-medium tabular-nums text-zinc-900">{formatNumber(data.phraseCount)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Heatmap score</span>
          <span className="font-medium tabular-nums text-zinc-900">{data.score}/100</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Nové / 24 h</span>
          <span className="font-medium tabular-nums text-zinc-900">+{formatNumber(data.new24h)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Mutace</span>
          <span className="font-medium tabular-nums text-zinc-900">{data.mutationCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Status</span>
          <span className="font-medium text-zinc-900">{statusLabel(data.status)}</span>
        </div>
        {data.depthPct !== null && (
          <div className="flex justify-between gap-4">
            <span>Hloubka</span>
            <span className="font-medium tabular-nums text-zinc-900">{data.depthPct} %</span>
          </div>
        )}
      </div>
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
  const [tooltip, setTooltip] = useState<{ data: CountryData; x: number; y: number } | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [worldData, setWorldData] = useState<unknown>(null);

  const countryDataMap = useMemo(() => aggregateByGl(rows), [rows]);

  // Summary stats for live strip
  const totalPhrases = useMemo(
    () => rows.reduce((s, r) => s + r.phrase_count, 0),
    [rows],
  );
  const countryCount = countryDataMap.size;
  const runningCount = Array.from(countryDataMap.values()).filter((c) => c.status === "running").length;
  const doneCount = Array.from(countryDataMap.values()).filter(
    (c) => c.status === "done",
  ).length;
  const new24hTotal = Array.from(countryDataMap.values()).reduce((s, c) => s + c.new24h, 0);

  // Load world-atlas
  useEffect(() => {
    fetch("/countries-110m.json")
      .then((r) => r.json())
      .then((data) => {
        setWorldData(data);
        setMapLoaded(true);
      })
      .catch(() => setMapError(true));
  }, []);

  // Draw / redraw map
  useEffect(() => {
    if (!worldData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const projection = d3
      .geoNaturalEarth1()
      .scale((width / 640) * 100)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    let countries: GeoJSON.Feature[];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo = worldData as any;
      const fc = topojson.feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
      countries = fc.features;
    } catch {
      setMapError(true);
      return;
    }

    // Sphere background
    svg
      .append("path")
      .datum({ type: "Sphere" } as unknown as GeoJSON.GeoJsonObject)
      .attr("d", path as unknown as string)
      .attr("fill", "#f0f4f8")
      .attr("stroke", "none");

    // Graticule
    const graticule = d3.geoGraticule()();
    svg
      .append("path")
      .datum(graticule)
      .attr("d", path as unknown as string)
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.3);

    // Countries
    const countryGroup = svg.append("g").attr("class", "countries");

    countryGroup
      .selectAll("path")
      .data(countries)
      .join("path")
      .attr("d", path as unknown as string)
      .attr("class", (d) => {
        // Find countryData by numeric id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        const statusClass = cData ? cData.status : "idle";
        return `country ${statusClass}`;
      })
      .attr("fill", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        if (!cData || cData.phraseCount === 0) return "#f3f4f6";
        return heatColor(cData.score);
      })
      .attr("stroke", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        const status = cData?.status ?? "idle";
        return STATUS_COLORS[status].stroke;
      })
      .attr("stroke-width", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        return STATUS_COLORS[cData?.status ?? "idle"].width;
      })
      .attr("opacity", (d) => {
        if (!selectedGl) return 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        return gl === selectedGl ? 1 : 0.4;
      })
      .style("cursor", (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        return countryDataMap.has(gl ?? "") ? "pointer" : "default";
      })
      .on("mouseenter", function (event: MouseEvent, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        if (!cData) return;

        d3.select(this).raise().attr("opacity", 1).attr("stroke-width", (STATUS_COLORS[cData.status].width + 0.8));

        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({ data: cData, x: event.clientX - rect.left, y: event.clientY - rect.top });
      })
      .on("mousemove", function (event: MouseEvent) {
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip((prev) => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
      })
      .on("mouseleave", function (_, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        const cData = gl ? countryDataMap.get(gl) : undefined;
        d3.select(this)
          .attr("opacity", selectedGl && gl !== selectedGl ? 0.4 : 1)
          .attr("stroke-width", STATUS_COLORS[cData?.status ?? "idle"].width);
        setTooltip(null);
      })
      .on("click", function (_, d) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numId = Number((d as any).id);
        const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
        if (!gl || !countryDataMap.has(gl)) return;
        onSelectGl?.(selectedGl === gl ? null : gl);
      });

  }, [worldData, countryDataMap, selectedGl, onSelectGl]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (worldData) {
        // Re-trigger by toggling a key would be cleaner, but just re-call draw
        const event = new Event("resize");
        window.dispatchEvent(event);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [worldData]);

  // Redraw on window resize
  useEffect(() => {
    const handle = () => {
      if (!worldData || !svgRef.current || !containerRef.current) return;
      const container = containerRef.current;
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;

      const projection = d3
        .geoNaturalEarth1()
        .scale((width / 640) * 100)
        .translate([width / 2, height / 2]);

      const path = d3.geoPath().projection(projection);

      let countries: GeoJSON.Feature[];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const topo = worldData as any;
        const fc = topojson.feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
        countries = fc.features;
      } catch {
        return;
      }

      svg
        .append("path")
        .datum({ type: "Sphere" } as unknown as GeoJSON.GeoJsonObject)
        .attr("d", path as unknown as string)
        .attr("fill", "#f0f4f8")
        .attr("stroke", "none");

      const graticule = d3.geoGraticule()();
      svg
        .append("path")
        .datum(graticule)
        .attr("d", path as unknown as string)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 0.3);

      const countryGroup = svg.append("g").attr("class", "countries");
      countryGroup
        .selectAll("path")
        .data(countries)
        .join("path")
        .attr("d", path as unknown as string)
        .attr("fill", (d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const numId = Number((d as any).id);
          const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
          const cData = gl ? countryDataMap.get(gl) : undefined;
          if (!cData || cData.phraseCount === 0) return "#f3f4f6";
          return heatColor(cData.score);
        })
        .attr("stroke", (d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const numId = Number((d as any).id);
          const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
          const cData = gl ? countryDataMap.get(gl) : undefined;
          return STATUS_COLORS[cData?.status ?? "idle"].stroke;
        })
        .attr("stroke-width", (d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const numId = Number((d as any).id);
          const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
          const cData = gl ? countryDataMap.get(gl) : undefined;
          return STATUS_COLORS[cData?.status ?? "idle"].width;
        })
        .attr("opacity", (d) => {
          if (!selectedGl) return 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const numId = Number((d as any).id);
          const gl = Object.entries(ALPHA2_TO_NUMERIC).find(([, v]) => v === numId)?.[0];
          return gl === selectedGl ? 1 : 0.4;
        });
    };

    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [worldData, countryDataMap, selectedGl]);

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <style>{`
        @keyframes pulseCountry {
          0%, 100% { stroke-opacity: .55; filter: drop-shadow(0 0 2px rgba(22,163,74,.20)); }
          50%       { stroke-opacity: 1;   filter: drop-shadow(0 0 8px rgba(22,163,74,.75)); }
        }
        .country.running {
          animation: pulseCountry 1.15s ease-in-out infinite;
        }
      `}</style>

      {/* Panel header */}
      <div className="flex flex-col gap-3 border-b border-white/60 bg-white/30 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-800">Světová mapa sběru</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            100stupňová heatmapa podle absolutního počtu frází. Běžící země pulzují zeleně.
          </div>
        </div>

        {/* Live strip */}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs text-zinc-600 tabular-nums">
            {formatNumber(totalPhrases)} frází
          </span>
          <span className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs text-zinc-600 tabular-nums">
            {countryCount} zemí
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
      <div className="relative p-4">
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
            style={{ height: "clamp(240px, 38vw, 430px)" }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              className="block rounded-xl"
            />

            {/* Tooltip */}
            {tooltip && (
              <Tooltip data={tooltip.data} x={tooltip.x} y={tooltip.y} />
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-[10px] text-zinc-500 shadow-sm backdrop-blur-md sm:text-xs">
              <span>0</span>
              <div className="flex h-2.5 w-16 overflow-hidden rounded-full sm:w-20">
                {HEAT_COLORS.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c, flex: 1 }} />
                ))}
              </div>
              <span>100</span>
              <span className="ml-1 flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> běží
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> hotovo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
