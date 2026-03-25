"use client";

import { EngineId, CrawlSnapshot } from "../_lib/types";
import { getEngineTheme } from "../_lib/theme";
import {
  formatNumber,
  safeQueueLength,
  getProgress,
  isActuallyRunning,
  getRealAdded,
  getElapsedLabel,
  getUpdatedTime,
  getStatusText,
  getStatusBadgeClasses,
  buildSparklineSeries,
} from "../_lib/utils";
import {
  GlassCard,
  AnimatedNumber,
  DonutProgress,
  Sparkline,
  StatMiniCard,
  DetailRow,
} from "./primitives";

function CompactGaugeCard({
  label, value, description, color, track, pulse,
}: {
  label: string; value: number; description: string; color: string; track: string; pulse: boolean;
}) {
  return (
    <GlassCard className="rounded-[24px] p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-3 flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          <DonutProgress value={value} color={color} track={track} label={label.includes("Pod\u00edl") ? "share" : "crawl"} subtitle={label.includes("Pod\u00edl") ? "celku" : "progress"} pulse={pulse} />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-zinc-500 leading-snug">{description}</div>
          <div className="mt-1 text-[clamp(1rem,1.25vw,1.65rem)] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">{value}%</div>
        </div>
      </div>
    </GlassCard>
  );
}

function LiveRail({ recent, engine }: { recent: { id: number; phrase: string }[]; engine: EngineId }) {
  const dot = engine === "seznam" ? "bg-red-500" : "bg-blue-500";
  const label = engine === "seznam" ? "Seznam" : "Google";

  return (
    <GlassCard className="rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-medium text-zinc-950">Live feed</div>
          <div className="mt-1 text-sm text-zinc-500">Posledn\u00ed zachycen\u00e9 fr\u00e1ze v \u017eiv\u00e9m proudu.</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600 backdrop-blur-sm">
          <span className={`h-2 w-2 rounded-full ${dot} animate-pulse`} />
          {label}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {recent.length > 0 ? (
          recent.slice(0, 6).map((item) => (
            <GlassCard key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
              <span className="truncate text-sm text-zinc-700">{item.phrase}</span>
            </GlassCard>
          ))
        ) : (
          <GlassCard className="rounded-xl px-4 py-6 text-center text-sm text-zinc-500">Zat\u00edm nejsou k dispozici \u017e\u00e1dn\u00e9 nov\u00e9 fr\u00e1ze.</GlassCard>
        )}
      </div>
    </GlassCard>
  );
}

export function SourcePanel({
  title, engine, snapshot, total,
}: {
  title: string; engine: EngineId; snapshot: CrawlSnapshot; total: number;
}) {
  const { count, state, latest, recent } = snapshot;
  const theme = getEngineTheme(engine);
  const progress = getProgress(state);
  const queueNow = safeQueueLength(state?.queue);
  const queueNext = safeQueueLength(state?.next_queue);
  const processed = state?.processed ?? 0;
  const queueSize = state?.queue_size ?? 0;
  const currentDepth = state?.current_depth ?? 0;
  const isRunning = isActuallyRunning(state);
  const statusText = getStatusText(state);
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  const realAdded = getRealAdded(state);
  const sparkline = buildSparklineSeries(count, processed, progress, recent.length);

  return (
    <section className={`relative overflow-hidden rounded-[36px] border ${theme.panelBorder} bg-gradient-to-br ${theme.topTint} ${theme.panelGlow} h-full backdrop-blur-xl`}>
      <div className={`pointer-events-none absolute -top-16 left-8 h-44 w-44 rounded-full ${theme.ambientA} blur-3xl`} />
      <div className={`pointer-events-none absolute -bottom-20 right-10 h-56 w-56 rounded-full ${theme.ambientB} blur-3xl`} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:34px_34px] opacity-[0.12]" />

      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}${isRunning ? " animate-pulse" : ""}`} />
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Zdroj</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-none tracking-tight text-zinc-950">{title}</h2>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${getStatusBadgeClasses(state)}`}>{statusText}</span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${theme.miniPill}`}>Hloubka {currentDepth}</span>
          </div>

          <p className="text-sm text-zinc-500">{latest ? `Posledn\u00ed zachycen\u00e1 fr\u00e1ze: ${latest}` : "Zat\u00edm bez nov\u00fdch fr\u00e1z\u00ed"}</p>

          <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] 2xl:[grid-template-columns:minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="min-w-0">
              <div className="text-sm text-zinc-500">Celkem fr\u00e1z\u00ed</div>
              <div className="mt-2 min-w-0 overflow-hidden text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">
                <AnimatedNumber value={count} />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <CompactGaugeCard label="Pod\u00edl na celku" value={share} description="Objem zdroje" color={theme.progress} track={theme.progressTrack} pulse={isRunning} />
                <CompactGaugeCard label="Dokon\u010den\u00ed hloubky" value={progress} description="Aktu\u00e1ln\u00ed pr\u016fb\u011bh" color={theme.progress} track={theme.progressTrack} pulse={isRunning} />
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-zinc-950">Pr\u016fb\u011bh crawleru</div>
                    <div className="mt-1 text-sm text-zinc-500 tabular-nums">Hloubka {currentDepth} \u2014 {formatNumber(processed)} / {formatNumber(queueSize)}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-zinc-900 tabular-nums">{progress}%</div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/55 backdrop-blur-sm" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Pr\u016fb\u011bh crawleru: ${progress}%`}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${theme.progress} 0%, ${theme.progress}CC 100%)`, boxShadow: isRunning ? `0 0 18px ${theme.progress}40` : "none" }} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
                <StatMiniCard label="Dotazy" value={<AnimatedNumber value={state?.queries_total ?? 0} />} shimmer={isRunning} />
                <StatMiniCard label="Nov\u00e9 fr\u00e1ze (b\u011bh)" value={<>+<AnimatedNumber value={realAdded} /></>} shimmer={isRunning} />
                <StatMiniCard label="Fronta te\u010f" value={<AnimatedNumber value={queueNow} />} />
                <StatMiniCard label="Dal\u0161\u00ed hloubka" value={<AnimatedNumber value={queueNext} />} hint="prefix\u016f" />
              </div>

              <GlassCard className="mt-5 rounded-[28px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-medium text-zinc-950">Odhad aktivity</div>
                    <div className="mt-1 text-sm text-zinc-500">Odvozen\u00e1 vizualizace z aktu\u00e1ln\u00edch \u010d\u00edta\u010d\u016f \u2014 ne historick\u00e1 data.</div>
                  </div>
                  <div className={`text-sm font-medium ${theme.accentText}`}>{isRunning ? "aktivn\u00ed" : "idle"}</div>
                </div>
                <div className="mt-4">
                  <Sparkline values={sparkline} color={theme.progress} fill={theme.sparkFill} />
                </div>
              </GlassCard>
            </div>

            <div className="grid gap-4 min-w-0">
              <GlassCard className="flex flex-col rounded-[28px] p-5 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-zinc-950">Live detail</div>
                    <div className="mt-1 text-sm text-zinc-500">Aktu\u00e1ln\u00ed stav zdroje a posledn\u00ed zachycen\u00e9 fr\u00e1ze.</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <div className="text-xs text-zinc-500">Aktivn\u00ed prefix</div>
                    <div className="mt-2 max-w-[150px] truncate rounded-2xl border border-white/70 bg-white/75 px-3 py-2 font-mono text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-sm">
                      {state?.current_prefix ? `"${state.current_prefix}"` : "\u2014"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <DetailRow label="Status" value={statusText} emphasize />
                  <DetailRow label="Hloubka" value={String(currentDepth || "\u2014")} />
                  <DetailRow label="Zpracov\u00e1no" value={state ? `${formatNumber(processed)} / ${formatNumber(queueSize)}` : "\u2014"} />
                  <DetailRow label="B\u011b\u017e\u00ed" value={state?.started_at ? getElapsedLabel(state.started_at) : "\u2014"} />
                  <DetailRow label="Aktualizov\u00e1no" value={state?.updated_at ? getUpdatedTime(state.updated_at) : "\u2014"} />
                </div>

                <div className="my-5 h-px bg-zinc-200/70" />

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-950">Posledn\u00ed fr\u00e1ze</div>
                  <div className="text-xs text-zinc-500 shrink-0">{recent.length > 0 ? `${recent.length} polo\u017eek` : "bez dat"}</div>
                </div>

                <div className="mt-4 grid gap-2">
                  {recent.length > 0 ? (
                    recent.slice(0, 6).map((item, index) => (
                      <GlassCard key={item.id} className={`rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-white/70 ${index === 0 ? "ring-1 ring-white/70" : ""}`}>
                        <div className="truncate">{item.phrase}</div>
                      </GlassCard>
                    ))
                  ) : (
                    <GlassCard className="rounded-xl px-4 py-6 text-center text-sm text-zinc-500">Zat\u00edm nejsou k dispozici \u017e\u00e1dn\u00e9 nov\u00e9 fr\u00e1ze.</GlassCard>
                  )}
                </div>
              </GlassCard>

              <LiveRail recent={recent} engine={engine} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
