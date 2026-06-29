// Data adapter for /suggest3 (hifi "Sběr dat · Live" redesign).
// Source of truth = DashboardRow[] (per gl/hl). Here we aggregate per market (gl).
import type { DashboardRow } from "../../suggest/_lib/types";
import { heartbeatColor } from "../../suggest/_lib/types";

export type MarketStatus = "run" | "idle" | "err";

export type Market = {
  gl: string;
  name: string;
  phrases: number;
  new24h: number;
  status: MarketStatus;
  freshSec: number; // age of freshest heartbeat in this market
  bfs: number; // BFS průchod %, 0..100
  queue: number;
  pilot: number; // GPT decision #3: column "Nové / 24 h" = new_24h
  updatedAt: string | null;
};

// ── ISO alpha-2 → numeric (world-atlas country ids are numeric) ──────
// Mirrors app/suggest/_components/SuggestWorldMap.tsx so the green map matches.
export const ALPHA2_TO_NUMERIC: Record<string, number> = {
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
  uk: 826, kr: 410, hk: 344, ps: 275, kp: 408, pr: 630, gl: 304,
};

// ── Source aggregation (GPT decision #1) ─────────────────────────────
// "Zdraví sběru" replaced by honest per-source health. No fake regions.
export type SourceStat = {
  source: string;
  label: string;
  total: number; // distinct gl/hl markets
  running: number;
  stale: number; // freshness red
  freshStatus: "green" | "amber" | "red";
  freshColor: string;
  new24h: number;
  queue: number;
  depthAvg: number; // weighted by phrase_count
};

const SOURCE_LABEL: Record<string, string> = { google: "Google", seznam: "Seznam" };

export function aggregateSources(rows: DashboardRow[]): SourceStat[] {
  const bySource = new Map<string, DashboardRow[]>();
  for (const r of rows) {
    const arr = bySource.get(r.source);
    if (arr) arr.push(r);
    else bySource.set(r.source, [r]);
  }
  const stats: SourceStat[] = [];
  for (const [source, srcRows] of bySource) {
    let running = 0;
    let stale = 0;
    let freshestAge = Infinity;
    let depthWeighted = 0;
    let depthWeight = 0;
    for (const r of srcRows) {
      const hb = heartbeatColor(r.updated_at);
      if (hb !== "gray") running++;
      const age = r.updated_at ? (Date.now() - new Date(r.updated_at).getTime()) / 1000 : Infinity;
      if (age >= 180) stale++;
      if (age < freshestAge) freshestAge = age;
      if (r.depth_pct !== null && r.phrase_count > 0) {
        depthWeighted += r.depth_pct * r.phrase_count;
        depthWeight += r.phrase_count;
      }
    }
    const freshStatus: SourceStat["freshStatus"] =
      freshestAge < 60 ? "green" : freshestAge < 180 ? "amber" : "red";
    const freshColorMap = { green: "#16a34a", amber: "#c2820a", red: "#dc2626" } as const;
    stats.push({
      source,
      label: SOURCE_LABEL[source] ?? source,
      total: srcRows.length,
      running,
      stale,
      freshStatus,
      freshColor: freshColorMap[freshStatus],
      new24h: srcRows.reduce((s, r) => s + (r.new_24h ?? 0), 0),
      queue: srcRows.reduce((s, r) => s + (r.queue_len ?? 0), 0),
      depthAvg: depthWeight > 0 ? Math.round(depthWeighted / depthWeight) : 0,
    });
  }
  // stable order: google first, then seznam, then rest
  const rank = (s: string) => (s === "google" ? 0 : s === "seznam" ? 1 : 2);
  stats.sort((a, b) => rank(a.source) - rank(b.source));
  return stats;
}

// ── Freshness rule (README): <60s green, <180s amber, ≥180s/err red ──
export function freshColor(m: { status: MarketStatus; freshSec: number }): string {
  if (m.status === "err" || m.freshSec >= 180) return "#dc2626";
  if (m.freshSec >= 60) return "#c2820a";
  return "#16a34a";
}

export function freshLabel(sec: number): string {
  return sec >= 600 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`;
}

export const STATUS_META: Record<MarketStatus, { label: string; color: string; bg: string }> = {
  run: { label: "Běží", color: "#16a34a", bg: "rgba(22,163,74,.10)" },
  idle: { label: "Nečinný", color: "#c2820a", bg: "rgba(194,130,10,.10)" },
  err: { label: "Chyba", color: "#dc2626", bg: "rgba(220,38,38,.10)" },
};

export const fmt = (n: number) => Math.round(n).toLocaleString("cs-CZ");

const countryName = (gl: string) =>
  new Intl.DisplayNames(["cs"], { type: "region" }).of(gl.toUpperCase()) ?? gl.toUpperCase();

// Aggregate per-gl rows into one market each.
export function aggregateMarkets(rows: DashboardRow[]): Market[] {
  const byGl = new Map<string, DashboardRow[]>();
  for (const r of rows) {
    const gl = r.gl.toLowerCase();
    const arr = byGl.get(gl);
    if (arr) arr.push(r);
    else byGl.set(gl, [r]);
  }

  const markets: Market[] = [];
  for (const [gl, glRows] of byGl) {
    const phrases = glRows.reduce((s, r) => s + (r.phrase_count || 0), 0);
    const new24h = glRows.reduce((s, r) => s + (r.new_24h ?? 0), 0);
    const queue = glRows.reduce((s, r) => s + (r.queue_len ?? 0), 0);
    const bfs = Math.round(
      Math.max(0, ...glRows.map((r) => (r.depth_pct !== null ? r.depth_pct : 0))),
    );
    // freshest heartbeat across the market's rows
    const freshestTs = glRows.reduce<number>((best, r) => {
      if (!r.updated_at) return best;
      const t = new Date(r.updated_at).getTime();
      return t > best ? t : best;
    }, 0);
    const updatedAt = freshestTs > 0 ? new Date(freshestTs).toISOString() : null;
    const freshSec = freshestTs > 0 ? Math.max(0, (Date.now() - freshestTs) / 1000) : 99999;
    // status from heartbeat (no explicit error signal in data → never "err" for now)
    const hb = heartbeatColor(updatedAt);
    const status: MarketStatus = hb === "gray" ? "idle" : "run";

    markets.push({
      gl,
      name: countryName(gl),
      phrases,
      new24h,
      status,
      freshSec,
      bfs,
      queue,
      pilot: new24h, // "Nové / 24 h" (decision #3)
      updatedAt,
    });
  }
  markets.sort((a, b) => b.phrases - a.phrases);
  return markets;
}
