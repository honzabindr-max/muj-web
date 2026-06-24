"use client";

import { useMemo, useState } from "react";
import type { PhraseSample } from "../_hooks/use-suggest2-data";
import { formatNumber } from "../../suggest/_lib/utils";

type Timeframe = "1h" | "24h" | "7d";

const W = 600;
const H = 130;
const PAD = { top: 14, right: 12, bottom: 28, left: 58 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

const CUTOFFS_MS: Record<Timeframe, number> = {
  "1h": 3_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};

function fmt(ts: number, long: boolean): string {
  if (long)
    return new Date(ts).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return new Date(ts).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

function buildPath(samples: PhraseSample[]) {
  if (samples.length < 2) return null;
  const minTs = samples[0].ts;
  const maxTs = samples[samples.length - 1].ts;
  const vals = samples.map((s) => s.total);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const tsRange = Math.max(maxTs - minTs, 1);
  const valRange = Math.max(maxVal - minVal, 1);

  const sx = (ts: number) => PAD.left + ((ts - minTs) / tsRange) * INNER_W;
  const sy = (v: number) => PAD.top + INNER_H - ((v - minVal) / valRange) * INNER_H;

  let line = `M ${sx(samples[0].ts)} ${sy(samples[0].total)}`;
  for (let i = 1; i < samples.length; i++) {
    line += ` H ${sx(samples[i].ts)} V ${sy(samples[i].total)}`;
  }
  // extend last value to right edge
  line += ` H ${PAD.left + INNER_W}`;

  const area = `${line} V ${PAD.top + INNER_H} H ${PAD.left} Z`;

  return {
    line,
    area,
    minVal,
    maxVal,
    minTs,
    maxTs,
    startLabel: fmt(minTs, false),
    endLabel: fmt(maxTs, false),
  };
}

export function GrowthChart({
  samples,
  sessionStartedAt,
  className = "",
}: {
  samples: PhraseSample[];
  sessionStartedAt: Date;
  className?: string;
}) {
  const [tf, setTf] = useState<Timeframe>("1h");

  const filtered = useMemo(() => {
    const cutoff = Date.now() - CUTOFFS_MS[tf];
    return samples.filter((s) => s.ts >= cutoff);
  }, [samples, tf]);

  const path = useMemo(() => buildPath(filtered), [filtered]);

  const sessionStr = sessionStartedAt.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sessionDateStr = sessionStartedAt.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const showLong = tf !== "1h";

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-white/70 bg-white/45 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 bg-white/30 px-5 py-3.5">
        <div>
          <div className="text-sm font-semibold text-zinc-800">Jak databáze roste</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Krokový dle MV (≈5 min) · data od {sessionStr}
          </div>
        </div>
        <div className="flex gap-1">
          {(["1h", "24h", "7d"] as Timeframe[]).map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                tf === t
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200/80 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-3 pt-2">
        {filtered.length < 2 ? (
          <div className="flex h-[88px] items-center justify-center text-sm text-zinc-400">
            {samples.length < 2
              ? "Sbíráme vzorky · první obnova za ≈5 min"
              : `Nedostatek dat pro ${tf} · ${samples.length} vzork${samples.length === 1 ? "" : "ů"} od ${sessionDateStr}`}
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              style={{ height: "clamp(72px, 14vw, 130px)" }}
              aria-label="Graf růstu databáze frází"
              role="img"
            >
              <defs>
                <linearGradient id="gfill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid */}
              {[0.33, 0.66, 1].map((t) => (
                <line
                  key={t}
                  x1={PAD.left}
                  x2={PAD.left + INNER_W}
                  y1={PAD.top + INNER_H * (1 - t)}
                  y2={PAD.top + INNER_H * (1 - t)}
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="1"
                />
              ))}

              {/* Fill */}
              {path && <path d={path.area} fill="url(#gfill)" />}

              {/* Step line */}
              {path && (
                <path
                  d={path.line}
                  fill="none"
                  stroke="rgb(59,130,246)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              )}

              {/* Y labels */}
              {path && (
                <>
                  <text
                    x={PAD.left - 4}
                    y={PAD.top + 4}
                    textAnchor="end"
                    fontSize="9"
                    fill="rgba(113,113,122,0.8)"
                  >
                    {formatNumber(path.maxVal)}
                  </text>
                  <text
                    x={PAD.left - 4}
                    y={PAD.top + INNER_H}
                    textAnchor="end"
                    fontSize="9"
                    fill="rgba(113,113,122,0.8)"
                  >
                    {formatNumber(path.minVal)}
                  </text>
                </>
              )}

              {/* X labels */}
              {path && (
                <>
                  <text
                    x={PAD.left}
                    y={H - 6}
                    textAnchor="start"
                    fontSize="9"
                    fill="rgba(113,113,122,0.8)"
                  >
                    {showLong ? fmt(path.minTs, true) : path.startLabel}
                  </text>
                  <text
                    x={PAD.left + INNER_W}
                    y={H - 6}
                    textAnchor="end"
                    fontSize="9"
                    fill="rgba(113,113,122,0.8)"
                  >
                    {showLong ? fmt(path.maxTs, true) : path.endLabel}
                  </text>
                </>
              )}
            </svg>

            <div className="mt-0.5 flex justify-between text-[10px] text-zinc-400">
              <span>data jen za aktuální session (od {sessionStr})</span>
              <span>{filtered.length} vzorků</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
