"use client";

import { AnimatedNumber } from "../../suggest/_components/primitives";
import { heartbeatColor } from "../../suggest/_lib/types";
import { formatNumber } from "../../suggest/_lib/utils";
import type { DashboardRow } from "../../suggest/_lib/types";

function HbDot({ color }: { color: "green" | "amber" | "gray" }) {
  const cls =
    color === "green"
      ? "bg-emerald-500"
      : color === "amber"
        ? "bg-amber-400"
        : "bg-zinc-300";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />;
}

const card =
  "rounded-[28px] border border-white/70 bg-white/55 px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl";
const label = "text-[10px] uppercase tracking-[0.18em] text-zinc-500";
const val =
  "mt-2 font-mono text-[clamp(1.1rem,1.6vw,1.75rem)] font-semibold leading-none text-zinc-950 tabular-nums";
const hint = "mt-1.5 text-[11px] text-zinc-500";

export function KpiStrip({
  rows,
  totalPhrases,
  newPhrases24h,
  newPhrasesToday,
  tempo,
  className = "",
}: {
  rows: DashboardRow[];
  totalPhrases: number;
  newPhrases24h: number;
  newPhrasesToday: number | null;
  tempo: number | null;
  className?: string;
}) {
  const now = Date.now();

  const greenCount = rows.filter((r) => heartbeatColor(r.updated_at) === "green").length;
  const amberCount = rows.filter((r) => heartbeatColor(r.updated_at) === "amber").length;
  const grayRunning = rows.filter(
    (r) => r.status === "running" && heartbeatColor(r.updated_at) === "gray",
  ).length;
  const activeCount = greenCount + amberCount;
  const totalMarkets = [...new Set(rows.map((r) => r.gl))].length;

  let oldestActiveAge: number | null = null;
  for (const r of rows) {
    if (!r.updated_at || heartbeatColor(r.updated_at) === "gray") continue;
    const age = (now - new Date(r.updated_at).getTime()) / 1000;
    if (oldestActiveAge === null || age > oldestActiveAge) oldestActiveAge = age;
  }

  // 24h window label: now-24h formatted
  const since24h = new Date(now - 86_400_000);
  const since24hStr = since24h.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {/* a) Fráze celkem */}
      <div className={card}>
        <div className={label}>Fráze celkem</div>
        <div className={val}>
          <AnimatedNumber value={totalPhrases} />
        </div>
        <div className={hint}>z MV · obnova každých 5 min</div>
      </div>

      {/* b) Přírůstek dnes */}
      <div className={card}>
        <div className={label}>Přírůstek dnes</div>
        <div
          className={`${val} ${newPhrasesToday !== null && newPhrasesToday > 0 ? "text-emerald-700" : "text-zinc-400"}`}
        >
          {newPhrasesToday !== null ? `+${formatNumber(newPhrasesToday)}` : "—"}
        </div>
        <div className={hint}>
          {newPhrasesToday !== null ? "od 00:00 · monotónní" : "čeká na Hetzner endpoint"}
        </div>
        {newPhrases24h > 0 && (
          <div className="mt-1 text-[10px] text-zinc-400">
            24 h klouzavé ±{formatNumber(newPhrases24h)} (od {since24hStr})
          </div>
        )}
      </div>

      {/* c) Aktivní crawleři */}
      <div className={card}>
        <div className={label}>Aktivní crawleři</div>
        <div className={val}>
          {activeCount}
          <span className="font-mono text-base font-normal text-zinc-400">/{totalMarkets}</span>
        </div>
        <div className={hint}>
          {tempo !== null
            ? `~${formatNumber(tempo)} fr/min · klouzavý průměr`
            : "tempo — sbíráme vzorky"}
        </div>
      </div>

      {/* d) Čerstvost */}
      <div className={card}>
        <div className={label}>Čerstvost</div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {greenCount > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
              <HbDot color="green" />
              {greenCount}
            </span>
          )}
          {amberCount > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
              <HbDot color="amber" />
              {amberCount}
            </span>
          )}
          {grayRunning > 0 && (
            <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-zinc-400">
              <HbDot color="gray" />
              {grayRunning} zasekl.
            </span>
          )}
          {greenCount === 0 && amberCount === 0 && grayRunning === 0 && (
            <span className="text-sm text-zinc-400">—</span>
          )}
        </div>
        <div className={hint}>
          {oldestActiveAge !== null
            ? `nejstarší ${Math.round(oldestActiveAge)} s`
            : "<60 s zelená · <180 s jantarová"}
        </div>
      </div>
    </div>
  );
}
