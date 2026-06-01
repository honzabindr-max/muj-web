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
    Math.min(100, Math.round((state.processed / state.queue_size) * 100)),
  );
}

function isActuallyRunning(state: CrawlState | null) {
  if (!state || state.status !== "running") return false;
  if (!state.updated_at) return false;
  return (Date.now() - new Date(state.updated_at).getTime()) / 1000 < 180;
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
  if (!state) return "border-white/70 bg-white/55 text-zinc-600";
  if (state.status === "running") {
    if (
      state.updated_at &&
      (Date.now() - new Date(state.updated_at).getTime()) / 1000 > 180
    ) {
      return "border-white/70 bg-white/55 text-zinc-600";
    }
    return "border-emerald-200/80 bg-emerald-50/80 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]";
  }
  if (state.status === "completed")
    return "border-blue-200/80 bg-blue-50/80 text-blue-700";
  if (state.status === "paused")
    return "border-amber-200/80 bg-amber-50/80 text-amber-700";
  return "border-white/70 bg-white/55 text-zinc-600";
}

type EngineId = "seznam" | "google" | "google_de" | "google_at";

function getEngineTheme(engine: EngineId) {
  if (engine === "seznam") {
    return {
      dot: "bg-red-500",
      panelBorder: "border-red-100/80",
      panelGlow:
        "shadow-[0_8px_30px_rgba(239,68,68,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
      topTint: "from-red-50/95 via-white/75 to-white/65",
      softBlock: "bg-white/55",
      progress: "#ef4444",
      progressTrack: "#fee2e2",
      accentText: "text-red-600",
      miniPill: "border-red-100/80 bg-red-50/80 text-red-700",
      sparkFill: "rgba(239,68,68,0.10)",
      ambientA: "bg-red-200/16",
      ambientB: "bg-orange-200/12",
    };
  }
  if (engine === "google_de") {
    return {
      dot: "bg-amber-500",
      panelBorder: "border-amber-100/80",
      panelGlow:
        "shadow-[0_8px_30px_rgba(245,158,11,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
      topTint: "from-amber-50/95 via-white/75 to-white/65",
      softBlock: "bg-white/55",
      progress: "#f59e0b",
      progressTrack: "#fef3c7",
      accentText: "text-amber-600",
      miniPill: "border-amber-100/80 bg-amber-50/80 text-amber-700",
      sparkFill: "rgba(245,158,11,0.10)",
      ambientA: "bg-amber-200/16",
      ambientB: "bg-yellow-200/12",
    };
  }
  if (engine === "google_at") {
    return {
      dot: "bg-violet-500",
      panelBorder: "border-violet-100/80",
      panelGlow:
        "shadow-[0_8px_30px_rgba(139,92,246,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
      topTint: "from-violet-50/95 via-white/75 to-white/65",
      softBlock: "bg-white/55",
      progress: "#8b5cf6",
      progressTrack: "#ede9fe",
      accentText: "text-violet-600",
      miniPill: "border-violet-100/80 bg-violet-50/80 text-violet-700",
      sparkFill: "rgba(139,92,246,0.10)",
      ambientA: "bg-violet-200/16",
      ambientB: "bg-purple-200/12",
    };
  }
  return {
    dot: "bg-blue-500",
    panelBorder: "border-blue-100/80",
    panelGlow:
      "shadow-[0_8px_30px_rgba(59,130,246,0.05),0_1px_2px_rgba(0,0,0,0.04)]",
    topTint: "from-blue-50/95 via-white/75 to-white/65",
    softBlock: "bg-white/55",
    progress: "#0ea5e9",
    progressTrack: "#dbeafe",
    accentText: "text-blue-600",
    miniPill: "border-blue-100/80 bg-blue-50/80 text-blue-700",
    sparkFill: "rgba(14,165,233,0.10)",
    ambientA: "bg-blue-200/16",
    ambientB: "bg-cyan-200/12",
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

function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border border-white/70 bg-white/55 shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
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
        <div className="text-[0.9rem] leading-none font-semibold tracking-tight text-zinc-950 tabular-nums">
          {progress}%
        </div>
        <div className="mt-1 text-[8px] tracking-[0.18em] text-zinc-500 uppercase">
          {label}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">{subtitle}</div>
      </div>
    </div>
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
    <GlassCard
      className={`relative overflow-hidden rounded-2xl p-3.5 ${
        shimmer
          ? "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.8s_linear_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent"
          : ""
      }`}
    >
      <div className="relative text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="relative mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.4vw,1.6rem)] leading-[1] font-semibold tracking-tight text-zinc-950 tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="relative mt-1.5 text-sm text-zinc-500">{hint}</div>
      ) : null}
    </GlassCard>
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
    <GlassCard className="min-w-0 overflow-hidden rounded-3xl p-4">
      <div className="truncate text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-2 min-w-0 overflow-hidden text-[clamp(1rem,1.35vw,1.9rem)] leading-[1] font-semibold tracking-tight text-zinc-950 tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-sm text-zinc-500">{hint}</div> : null}
    </GlassCard>
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
    <GlassCard className="rounded-[24px] p-4">
      <div className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-3">
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
          <div className="text-sm leading-snug text-zinc-500">
            {description}
          </div>
          <div className="mt-1 text-[clamp(1rem,1.25vw,1.65rem)] leading-none font-semibold tracking-tight text-zinc-950 tabular-nums">
            {value}%
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function SourcePanel({
  title,
  engine,
  count,
  total,
  state,
  latest,
}: {
  title: string;
  engine: EngineId;
  count: number;
  total: number;
  state: CrawlState | null;
  latest: string;
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
    (state?.count_after ?? 0) - (state?.count_before ?? 0),
  );

  return (
    <section
      className={`relative overflow-hidden rounded-[36px] border ${theme.panelBorder} bg-gradient-to-br ${theme.topTint} ${theme.panelGlow} h-full backdrop-blur-xl`}
    >
      <div
        className={`pointer-events-none absolute -top-16 left-8 h-44 w-44 rounded-full ${theme.ambientA} blur-3xl`}
      />
      <div
        className={`pointer-events-none absolute right-10 -bottom-20 h-56 w-56 rounded-full ${theme.ambientB} blur-3xl`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[size:34px_34px] opacity-[0.12]" />

      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${theme.dot}${
                isRunning ? "animate-pulse" : ""
              }`}
            />
            <span className="text-[11px] tracking-[0.22em] text-zinc-500 uppercase">
              Zdroj
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[clamp(2rem,3vw,3rem)] leading-none font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${getStatusBadgeClasses(
                state,
              )}`}
            >
              {statusText}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${theme.miniPill}`}
            >
              Hloubka {currentDepth}
            </span>
          </div>

          <p className="text-sm text-zinc-500">
            {latest
              ? `Poslední zachycená fráze: ${latest}`
              : "Zatím bez nových frází"}
          </p>

          <div className="grid [grid-template-columns:minmax(0,1fr)] gap-4">
            <div className="min-w-0">
              <div className="text-sm text-zinc-500">Celkem frází</div>
              <div className="mt-2 min-w-0 overflow-hidden text-[clamp(2.2rem,5vw,4.4rem)] leading-none font-semibold tracking-tight text-zinc-950 tabular-nums">
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
                      Hloubka {currentDepth} — {formatNumber(processed)} /{" "}
                      {formatNumber(queueSize)}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-zinc-900 tabular-nums">
                    {progress}%
                  </div>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/55 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${theme.progress} 0%, ${theme.progress}CC 100%)`,
                      boxShadow: isRunning
                        ? `0 0 18px ${theme.progress}40`
                        : "none",
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
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
  const [deCount, setDeCount] = useState(0);
  const [atCount, setAtCount] = useState(0);
  const [seznamState, setSeznamState] = useState<CrawlState | null>(null);
  const [googleState, setGoogleState] = useState<CrawlState | null>(null);
  const [deState, setDeState] = useState<CrawlState | null>(null);
  const [atState, setAtState] = useState<CrawlState | null>(null);
  const [seznamLatest, setSeznamLatest] = useState("");
  const [googleLatest, setGoogleLatest] = useState("");
  const [deLatest, setDeLatest] = useState("");
  const [atLatest, setAtLatest] = useState("");

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const [sc, gc, dc, ac] = await Promise.all([
        supabase
          .from("suggestions")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("google_suggestions")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("google_suggestions_de")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("google_suggestions_at")
          .select("*", { count: "exact", head: true }),
      ]);

      if (!mounted) return;

      if (sc.count !== null) setSeznamCount(sc.count);
      if (gc.count !== null) setGoogleCount(gc.count);
      if (dc.count !== null) setDeCount(dc.count);
      if (ac.count !== null) setAtCount(ac.count);

      const [ss, gs, ds, ats] = await Promise.all([
        supabase.from("crawl_state").select("*").eq("id", 1).single(),
        supabase.from("google_crawl_state").select("*").eq("id", 1).single(),
        supabase.from("google_crawl_state_de").select("*").eq("id", 1).single(),
        supabase.from("google_crawl_state_at").select("*").eq("id", 1).single(),
      ]);

      if (!mounted) return;

      if (ss.data) setSeznamState(ss.data as CrawlState);
      if (gs.data) setGoogleState(gs.data as CrawlState);
      if (ds.data) setDeState(ds.data as CrawlState);
      if (ats.data) setAtState(ats.data as CrawlState);

      const [sl, gl, dl, al] = await Promise.all([
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
          .from("google_suggestions_de")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("google_suggestions_at")
          .select("phrase")
          .order("id", { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (!mounted) return;

      if (sl.data?.phrase) setSeznamLatest(sl.data.phrase);
      if (gl.data?.phrase) setGoogleLatest(gl.data.phrase);
      if (dl.data?.phrase) setDeLatest(dl.data.phrase);
      if (al.data?.phrase) setAtLatest(al.data.phrase);
    }

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const total = useMemo(
    () => seznamCount + googleCount + deCount + atCount,
    [seznamCount, googleCount, deCount, atCount],
  );
  const activeCount = [seznamState, googleState, deState, atState].filter((s) =>
    isActuallyRunning(s),
  ).length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f5f7fb_38%,#f8fafc_100%)] text-zinc-950">
      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[6%] left-[8%] h-[380px] w-[380px] rounded-full bg-red-200/10 blur-3xl" />
        <div className="absolute top-[12%] right-[8%] h-[420px] w-[420px] rounded-full bg-blue-200/10 blur-3xl" />
        <div className="absolute bottom-[10%] left-[32%] h-[420px] w-[420px] rounded-full bg-emerald-200/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/52 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl md:p-6">
          <div className="pointer-events-none absolute -top-24 left-20 h-72 w-72 rounded-full bg-blue-200/14 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-red-200/12 blur-3xl" />
          <div className="pointer-events-none absolute top-0 right-24 h-64 w-64 rounded-full bg-emerald-200/12 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:36px_36px] opacity-[0.14]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/"
                prefetch={false}
                className="inline-flex h-10 items-center rounded-full border border-white/70 bg-white/80 px-4 text-sm font-medium text-zinc-700 backdrop-blur-md transition hover:bg-white hover:text-zinc-950"
              >
                ← Zpět
              </Link>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-zinc-950">
                    Crawler Dashboard
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm ${
                      activeCount > 0
                        ? "border-emerald-200/90 bg-emerald-50/85 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                        : "border-white/70 bg-white/75 text-zinc-600"
                    }`}
                  >
                    {activeCount > 0 ? `${activeCount} aktivní` : "Standby"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Přehled sběru návrhů v reálném čase.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <GlassCard className="rounded-3xl px-5 py-4 text-right">
                <div className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
                  Aktualizace
                </div>
                <div className="mt-2 text-[clamp(1rem,2vw,1.35rem)] leading-none font-semibold text-zinc-950">
                  každé 3 s
                </div>
              </GlassCard>
              <GlassCard className="rounded-3xl px-5 py-4 text-right">
                <div className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
                  Projekt
                </div>
                <div className="mt-2 text-[clamp(0.95rem,1.3vw,1.1rem)] leading-none font-semibold break-all text-zinc-950">
                  good-inventions.work
                </div>
              </GlassCard>
            </div>
          </div>
        </header>

        <section className="relative mt-6 overflow-hidden rounded-[36px] border border-white/70 bg-white/48 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl md:p-8">
          <div className="pointer-events-none absolute -top-20 left-10 h-56 w-56 rounded-full bg-red-200/8 blur-3xl" />
          <div className="pointer-events-none absolute right-10 -bottom-20 h-56 w-56 rounded-full bg-blue-200/8 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-center">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.22em] text-zinc-500 uppercase">
                Celkový přehled
              </div>
              <h2 className="mt-4 min-w-0 text-[clamp(2.3rem,6vw,4.8rem)] leading-[0.95] font-semibold tracking-tight text-zinc-950">
                <AnimatedNumber value={total} /> unikátních frází
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                Data ze Seznamu a Googlu (CZ, DE, AT). Crawlery běží non-stop
                přes GitHub Actions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                label="Google.de"
                value={<AnimatedNumber value={deCount} />}
                hint={getStatusText(deState)}
              />
              <TopMetric
                label="Google.at"
                value={<AnimatedNumber value={atCount} />}
                hint={getStatusText(atState)}
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
          />
          <SourcePanel
            title="Google.cz"
            engine="google"
            count={googleCount}
            total={total}
            state={googleState}
            latest={googleLatest}
          />
          <SourcePanel
            title="Google.de"
            engine="google_de"
            count={deCount}
            total={total}
            state={deState}
            latest={deLatest}
          />
          <SourcePanel
            title="Google.at"
            engine="google_at"
            count={atCount}
            total={total}
            state={atState}
            latest={atLatest}
          />
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200/70 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Monitoring crawlerů v reálném čase</span>
          <span>
            {new Date().toLocaleDateString("cs-CZ")} · good-inventions.work
          </span>
        </footer>
      </div>
    </div>
  );
}
