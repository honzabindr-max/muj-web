"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CrawlState = {
  current_depth: number;
  status: string;
  processed: number;
  queue_size: number;
  current_prefix: string;
  queries_total: number;
  new_total: number;
  count_before: number;
  count_after: number;
  updated_at: string;
  started_at: string;
  queue: string;
  next_queue: string;
};

function formatNumber(value: number) {
  return value.toLocaleString("cs-CZ");
}

function safeQueueLength(raw?: string) {
  if (!raw) return 0;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.length : 0;
  } catch {
    return 0;
  }
}

function getProgress(state: CrawlState | null) {
  if (!state || !state.queue_size) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((state.processed / state.queue_size) * 100))
  );
}

function isActuallyRunning(state: CrawlState | null) {
  if (!state || state.status !== "running") return false;
  if (!state.updated_at) return false;
  return (Date.now() - new Date(state.updated_at).getTime()) / 1000 < 180;
}

function getElapsedLabel(startedAt?: string) {
  if (!startedAt) return "—";
  const s = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getUpdatedTime(updatedAt?: string) {
  if (!updatedAt) return "—";
  return new Date(updatedAt).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStatusText(state: CrawlState | null) {
  if (!state) return "Neznámý stav";
  if (state.status === "running") {
    if (
      state.updated_at &&
      (Date.now() - new Date(state.updated_at).getTime()) / 1000 > 180
    ) {
      return "Čeká na další běh";
    }
    return "Crawluje";
  }
  if (state.status === "completed") return "Dokončeno";
  if (state.status === "paused") return "Pozastaveno";
  return "Idle";
}

function getStatusBadgeClasses(state: CrawlState | null) {
  if (!state) return "border-zinc-200 bg-zinc-50 text-zinc-600";
  if (state.status === "running") {
    if (
      state.updated_at &&
      (Date.now() - new Date(state.updated_at).getTime()) / 1000 > 180
    ) {
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
    }
    return "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]";
  }
  if (state.status === "completed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (state.status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function getEngineTheme(engine: "seznam" | "google") {
  if (engine === "seznam") {
    return {
      dot: "bg-red-500",
      panelBorder: "border-red-100",
      panelGlow:
        "shadow-[0_1px_2px_rgba(0,0,0,0.03),0_0_0_1px_rgba(239,68,68,0.03)]",
      topTint: "from-red-50 via-white to-white",
      softBlock: "bg-red-50/45",
      progress: "#ef4444",
      progressTrack: "#fee2e2",
      accentText: "text-red-600",
      miniPill: "border-red-100 bg-red-50 text-red-700",
      sparkFill: "rgba(239,68,68,0.10)",
    };
  }
  return {
    dot: "bg-blue-500",
    panelBorder: "border-blue-100",
    panelGlow:
      "shadow-[0_1px_2px_rgba(0,0,0,0.03),0_0_0_1px_rgba(59,130,246,0.03)]",
    topTint: "from-blue-50 via-white to-white",
    softBlock: "bg-blue-50/45",
    progress: "#0ea5e9",
    progressTrack: "#dbeafe",
    accentText: "text-blue-600",
    miniPill: "border-blue-100 bg-blue-50 text-blue-700",
    sparkFill: "rgba(14,165,233,0.10)",
  };
}

function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const start = previousRef.current;
    const end = value;

    if (start === end) {
      setDisplay(end);
      return;
    }

    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        previousRef.current = end;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function AnimatedNumber({
  value,
  className = "",
  prefix = "",
  suffix = "",
}: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatNumber(animated)}
      {suffix}
    </span>
  );
}

function DonutProgress({
  value,
  size = 82,
  stroke = 8,
  color,
  track,
  label,
  subtitle,
  pulse = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  label: string;
  subtitle: string;
  pulse?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      {pulse ? (
        <div
          className="absolute inset-0 animate-pulse rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: color }}
        />
      ) : null}

      <svg width={size} height={size} className="relative -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[0.9rem] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">
          {progress}%
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">{subtitle}</div>
      </div>
    </div>
  );
}

function Sparkline({
  values,
  color,
  fill,
}: {
  values: number[];
  color: string;
  fill: string;
}) {
  const width = 280;
  const height = 72;
  const padding = 6;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${points} ${width - padding},${
    height - padding
  }`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[72px] w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <polygon points={area} fill={fill} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildSparklineSeries(
  count: number,
  processed: number,
  progress: number,
  recentLength: number
) {
  const base = Math.max(12, Math.round(count / 120));
  const amp = Math.max(8, Math.round(processed / 300));
  const p = Math.max(4, progress);
  const r = Math.max(1, recentLength);

  return Array.from({ length: 12 }, (_, i) =>
    Math.max(
      8,
      Math.round(
        base +
          i * (p / 2.4) +
          Math.sin(i * 0.78) * amp +
          ((i % 3) - 1) * r * 4
      )
    )
  );
}

function StatMiniCard({
  label,
  value,
  hint,
  shimmer = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  shimmer?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
        shimmer
          ? "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.8s_linear_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent"
          : ""
      }`}
    >
      <div className="relative text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="relative mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.4vw,1.6rem)] font-semibold leading-[1] tracking-tight text-zinc-950 tabular-nums">
        {value}
      </div>
      {hint ? <div className="relative mt-1.5 text-sm text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function TopMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.35vw,1.9rem)] font-semibold leading-[1] tracking-tight text-zinc-950 tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-sm text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`text-sm tabular-nums text-right ${
          emphasize ? "font-semibold text-zinc-950" : "font-medium text-zinc-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RecentPhraseItem({
  phrase,
  index,
}: {
  phrase: string;
  index: number;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-200 hover:bg-white ${
        index === 0 ? "ring-1 ring-zinc-200" : ""
      }`}
    >
      <div className="truncate">{phrase}</div>
    </div>
  );
}

function LiveRail({
  recent,
  engine,
}: {
  recent: string[];
  engine: "seznam" | "google";
}) {
  const dot = engine === "seznam" ? "bg-red-500" : "bg-blue-500";
  const label = engine === "seznam" ? "Seznam" : "Google";

  return (
    <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-medium text-zinc-950">Live feed</div>
          <div className="mt-1 text-sm text-zinc-500">
            Poslední zachycené fráze v živém proudu.
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600">
          <span className={`h-2 w-2 rounded-full ${dot} animate-pulse`} />
          {label}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {recent.length > 0 ? (
          recent.slice(0, 6).map((phrase, index) => (
            <div
              key={`${phrase}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-2.5"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
              <span className="truncate text-sm text-zinc-700">{phrase}</span>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            Zatím nejsou k dispozici žádné nové fráze.
          </div>
        )}
      </div>
    </div>
  );
}

function CompactGaugeCard({
  label,
  value,
  description,
  color,
  track,
  pulse,
}: {
  label: string;
  value: number;
  description: string;
  color: string;
  track: string;
  pulse: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          <DonutProgress
            value={value}
            color={color}
            track={track}
            label={label.includes("Podíl") ? "share" : "crawl"}
            subtitle={label.includes("Podíl") ? "celku" : "progress"}
            pulse={pulse}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-zinc-500 leading-snug">{description}</div>
          <div className="mt-1 text-[clamp(1rem,1.25vw,1.65rem)] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">
            {value}%
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcePanel({
  title,
  engine,
  count,
  total,
  state,
  latest,
  recent,
}: {
  title: string;
  engine: "seznam" | "google";
  count: number;
  total: number;
  state: CrawlState | null;
  latest: string;
  recent: string[];
}) {
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
  const realAdded = Math.max(
    0,
    (state?.count_after ?? 0) - (state?.count_before ?? 0)
  );
  const sparkline = buildSparklineSeries(
    count,
    processed,
    progress,
    recent.length
  );

  return (
    <section
      className={`overflow-hidden rounded-[32px] border ${theme.panelBorder} bg-white ${theme.panelGlow} h-full`}
    >
      <div className={`bg-gradient-to-b ${theme.topTint} px-5 py-5 md:px-6 md:py-6`}>
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${theme.dot}${
                isRunning ? " animate-pulse" : ""
              }`}
            />
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              Zdroj
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-none tracking-tight text-zinc-950">
              {title}
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusBadgeClasses(
                state
              )}`}
            >
              {statusText}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${theme.miniPill}`}
            >
              Hloubka {currentDepth}
            </span>
          </div>

          <p className="text-sm text-zinc-500">
            {latest ? `Poslední zachycená fráze: ${latest}` : "Zatím bez nových frází"}
          </p>

          <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] 2xl:[grid-template-columns:minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="min-w-0">
              <div className="text-sm text-zinc-500">Celkem frází</div>
              <div className="mt-2 min-w-0 overflow-hidden text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-none tracking-tight text-zinc-950 tabular-nums">
                <AnimatedNumber value={count} />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <CompactGaugeCard
                  label="Podíl na celku"
                  value={share}
                  description="Objem zdroje"
                  color={theme.progress}
                  track={theme.progressTrack}
                  pulse={isRunning}
                />
                <CompactGaugeCard
                  label="Dokončení hloubky"
                  value={progress}
                  description="Aktuální průběh"
                  color={theme.progress}
                  track={theme.progressTrack}
                  pulse={isRunning}
                />
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-zinc-950">
                      Průběh crawleru
                    </div>
                    <div className="mt-1 text-sm text-zinc-500 tabular-nums">
                      Hloubka {currentDepth} — {formatNumber(processed)} / {formatNumber(queueSize)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-zinc-900 tabular-nums">
                    {progress}%
                  </div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${theme.progress} 0%, ${theme.progress}CC 100%)`,
                      boxShadow: isRunning ? `0 0 18px ${theme.progress}40` : "none",
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 grid-cols-2 xl:grid-cols-4">
                <StatMiniCard
                  label="Dotazy"
                  value={<AnimatedNumber value={state?.queries_total ?? 0} />}
                  shimmer={isRunning}
                />
                <StatMiniCard
                  label="Nové fráze (běh)"
                  value={
                    <>
                      +<AnimatedNumber value={realAdded} />
                    </>
                  }
                  shimmer={isRunning}
                />
                <StatMiniCard
                  label="Fronta teď"
                  value={<AnimatedNumber value={queueNow} />}
                />
                <StatMiniCard
                  label="Další hloubka"
                  value={<AnimatedNumber value={queueNext} />}
                  hint="prefixů"
                />
              </div>

              <div className="mt-5 rounded-[28px] border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-medium text-zinc-950">
                      Aktivita zdroje
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Vizualizace intenzity běhu a přírůstků.
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${theme.accentText}`}>live</div>
                </div>

                <div className="mt-4">
                  <Sparkline
                    values={sparkline}
                    color={theme.progress}
                    fill={theme.sparkFill}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 min-w-0">
              <div className="flex flex-col rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-zinc-950">Live detail</div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Aktuální stav zdroje a poslední zachycené fráze.
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <div className="text-xs text-zinc-500">Aktivní prefix</div>
                    <div className="mt-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] max-w-[150px] truncate">
                      {state?.current_prefix ? `"${state.current_prefix}"` : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <DetailRow label="Status" value={statusText} emphasize />
                  <DetailRow label="Hloubka" value={String(currentDepth || "—")} />
                  <DetailRow
                    label="Zpracováno"
                    value={state ? `${formatNumber(processed)} / ${formatNumber(queueSize)}` : "—"}
                  />
                  <DetailRow
                    label="Běží"
                    value={state?.started_at ? getElapsedLabel(state.started_at) : "—"}
                  />
                  <DetailRow
                    label="Aktualizováno"
                    value={state?.updated_at ? getUpdatedTime(state.updated_at) : "—"}
                  />
                </div>

                <div className="my-5 h-px bg-zinc-200" />

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-950">Poslední fráze</div>
                  <div className="text-xs text-zinc-500 shrink-0">
                    {recent.length > 0 ? `${recent.length} položek` : "bez dat"}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {recent.length > 0 ? (
                    recent.slice(0, 6).map((phrase, index) => (
                      <RecentPhraseItem
                        key={`${phrase}-${index}`}
                        phrase={phrase}
                        index={index}
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
                      Zatím nejsou k dispozici žádné nové fráze.
                    </div>
                  )}
                </div>
              </div>

              <LiveRail recent={recent} engine={engine} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SuggestPage() {
  const [seznamCount, setSeznamCount] = useState(0);
  const [googleCount, setGoogleCount] = useState(0);
  const [seznamState, setSeznamState] = useState<CrawlState | null>(null);
  const [googleState, setGoogleState] = useState<CrawlState | null>(null);
  const [seznamLatest, setSeznamLatest] = useState("");
  const [googleLatest, setGoogleLatest] = useState("");
  const [seznamRecent, setSeznamRecent] = useState<string[]>([]);
  const [googleRecent, setGoogleRecent] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const [sc, gc] = await Promise.all([
        supabase.from("suggestions").select("*", { count: "exact", head: true }),
        supabase.from("google_suggestions").select("*", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      if (sc.count !== null) setSeznamCount(sc.count);
      if (gc.count !== null) setGoogleCount(gc.count);

      const [ss, gs] = await Promise.all([
        supabase.from("crawl_state").select("*").eq("id", 1).single(),
        supabase.from("google_crawl_state").select("*").eq("id", 1).single(),
      ]);

      if (!mounted) return;

      if (ss.data) setSeznamState(ss.data as CrawlState);
      if (gs.data) setGoogleState(gs.data as CrawlState);

      const [sl, gl, sr, gr] = await Promise.all([
        supabase
          .from("suggestions")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("google_suggestions")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("suggestions")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(8),
        supabase
          .from("google_suggestions")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(8),
      ]);

      if (!mounted) return;

      if (sl.data?.phrase) setSeznamLatest(sl.data.phrase);
      if (gl.data?.phrase) setGoogleLatest(gl.data.phrase);
      if (sr.data) setSeznamRecent(sr.data.map((r: any) => r.phrase));
      if (gr.data) setGoogleRecent(gr.data.map((r: any) => r.phrase));
    }

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const total = useMemo(() => seznamCount + googleCount, [seznamCount, googleCount]);
  const activeCount = [seznamState, googleState].filter((s) => isActuallyRunning(s)).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-[32px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/"
                prefetch={false}
                className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                ← Zpět
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-zinc-950">
                    Crawler Dashboard
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                      activeCount > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    {activeCount > 0 ? `${activeCount} aktivní` : "Standby"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Přehled sběru návrhů v reálném čase.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Aktualizace
                </div>
                <div className="mt-2 text-[clamp(1rem,2vw,1.35rem)] font-semibold leading-none text-zinc-950">
                  každé 3 s
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Projekt
                </div>
                <div className="mt-2 break-all text-[clamp(0.95rem,1.3vw,1.1rem)] font-semibold leading-none text-zinc-950">
                  good-inventions.work
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-center">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Celkový přehled
              </div>
              <h2 className="mt-4 min-w-0 text-[clamp(2.3rem,6vw,4.8rem)] font-semibold leading-[0.95] tracking-tight text-zinc-950">
                <AnimatedNumber value={total} /> unikátních frází
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                Data ze Seznamu a Googlu. Crawlery běží non-stop přes GitHub Actions.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TopMetric
                label="Seznam.cz"
                value={<AnimatedNumber value={seznamCount} />}
                hint={getStatusText(seznamState)}
              />
              <TopMetric
                label="Google.cz"
                value={<AnimatedNumber value={googleCount} />}
                hint={getStatusText(googleState)}
              />
              <TopMetric
                label="Aktivních"
                value={<AnimatedNumber value={activeCount} />}
                hint={activeCount > 0 ? "crawluje" : "žádný aktivní"}
              />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SourcePanel
            title="Seznam.cz"
            engine="seznam"
            count={seznamCount}
            total={total}
            state={seznamState}
            latest={seznamLatest}
            recent={seznamRecent}
          />
          <SourcePanel
            title="Google.cz"
            engine="google"
            count={googleCount}
            total={total}
            state={googleState}
            latest={googleLatest}
            recent={googleRecent}
          />
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Monitoring crawlerů v reálném čase</span>
          <span>{new Date().toLocaleDateString("cs-CZ")} · good-inventions.work</span>
        </footer>
      </div>
    </div>
  );
}
