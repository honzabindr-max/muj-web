"use client";

import { useEffect, useMemo, useState } from "react";
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
  updated_at: string;
  started_at: string;
  queue: string;
  next_queue: string;
};

function formatNumber(value: number) {
  return value.toLocaleString("cs-CZ");
}

function formatRelativeDuration(startedAt?: string) {
  if (!startedAt) return "—";
  const sec = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
  );
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);

  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

function safeQueueLength(raw?: string) {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getProgress(state: CrawlState | null) {
  if (!state || !state.queue_size) return 0;
  return Math.max(0, Math.min(100, Math.round((state.processed / state.queue_size) * 100)));
}

function getStatusLabel(state: CrawlState | null) {
  if (!state) return "Neznámý stav";
  if (state.status === "running") return "Běží";
  if (state.status === "completed") return "Dokončeno";
  if (state.status === "paused") return "Pozastaveno";
  return "Idle";
}

function getStatusTone(state: CrawlState | null) {
  if (!state) return "bg-zinc-100 text-zinc-600 border-zinc-200";
  if (state.status === "running") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (state.status === "completed") return "bg-blue-50 text-blue-700 border-blue-200";
  if (state.status === "paused") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-zinc-100 text-zinc-600 border-zinc-200";
}

function getEngineAccent(engine: "seznam" | "google") {
  if (engine === "seznam") {
    return {
      soft: "from-red-500/10 to-orange-500/10",
      border: "border-red-100",
      dot: "bg-red-500",
      progress: "bg-gradient-to-r from-red-500 to-orange-500",
      ring: "ring-red-500/10",
    };
  }

  return {
    soft: "from-blue-500/10 to-cyan-500/10",
    border: "border-blue-100",
    dot: "bg-blue-500",
    progress: "bg-gradient-to-r from-blue-500 to-cyan-500",
    ring: "ring-blue-500/10",
  };
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{value}</div>
      {hint ? <div className="mt-1 text-sm text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function SourcePanel({
  title,
  engine,
  count,
  state,
  latest,
  recent,
}: {
  title: string;
  engine: "seznam" | "google";
  count: number;
  state: CrawlState | null;
  latest: string;
  recent: string[];
}) {
  const accent = getEngineAccent(engine);
  const progress = getProgress(state);
  const isRunning = state?.status === "running";
  const queueNow = safeQueueLength(state?.queue);
  const queueNext = safeQueueLength(state?.next_queue);

  return (
    <section
      className={`rounded-3xl border bg-white shadow-sm ring-1 ${accent.border} ${accent.ring} overflow-hidden`}
    >
      <div className={`bg-gradient-to-br ${accent.soft} px-6 py-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${accent.dot} ${isRunning ? "animate-pulse" : ""}`} />
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                Zdroj
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
            <div className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-sm bg-white/80 text-zinc-700 border-zinc-200">
              {latest ? `Poslední fráze: ${latest}` : "Zatím bez dat"}
            </div>
          </div>

          <div className={`rounded-2xl border px-3 py-2 text-xs font-medium ${getStatusTone(state)}`}>
            {getStatusLabel(state)}
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-500">Celkem frází</div>
            <div className="mt-1 text-5xl font-semibold tracking-tight text-zinc-950 md:text-6xl">
              {formatNumber(count)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-zinc-500">Aktivní prefix</div>
            <div className="mt-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm">
              {state?.current_prefix ? `"${state.current_prefix}"` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-zinc-900">Průběh crawleru</div>
              <div className="text-sm text-zinc-500">
                {state
                  ? `Hloubka ${state.current_depth} • ${formatNumber(state.processed)} / ${formatNumber(
                      state.queue_size
                    )}`
                  : "Stav není k dispozici"}
              </div>
            </div>
            <div className="text-sm font-semibold text-zinc-900">{progress}%</div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${accent.progress} transition-all duration-700`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="Dotazy"
              value={state ? formatNumber(state.queries_total) : "—"}
            />
            <MetricCard
              label="Nové fráze"
              value={state ? formatNumber(state.new_total) : "—"}
            />
            <MetricCard
              label="Fronta teď"
              value={formatNumber(queueNow)}
            />
            <MetricCard
              label="Další hloubka"
              value={formatNumber(queueNext)}
              hint="prefixů"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="text-sm font-medium text-zinc-900">Live detail</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Status</span>
              <span className="font-medium text-zinc-900">{getStatusLabel(state)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Hloubka</span>
              <span className="font-medium text-zinc-900">
                {state ? state.current_depth : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Zpracováno</span>
              <span className="font-medium text-zinc-900">
                {state ? formatNumber(state.processed) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Běží</span>
              <span className="font-medium text-zinc-900">
                {state?.started_at ? formatRelativeDuration(state.started_at) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Aktualizováno</span>
              <span className="font-medium text-zinc-900">
                {state?.updated_at
                  ? new Date(state.updated_at).toLocaleTimeString("cs-CZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
          </div>

          <div className="mt-5 border-t border-zinc-200 pt-5">
            <div className="text-sm font-medium text-zinc-900">Poslední fráze</div>
            <div className="mt-3 space-y-2">
              {recent.length > 0 ? (
                recent.map((phrase, i) => (
                  <div
                    key={`${phrase}-${i}`}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm"
                  >
                    {phrase}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-sm text-zinc-500">
                  Zatím nejsou k dispozici žádné nové fráze.
                </div>
              )}
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
    const iv = setInterval(poll, 3000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const total = useMemo(() => seznamCount + googleCount, [seznamCount, googleCount]);
  const anyRunning = seznamState?.status === "running" || googleState?.status === "running";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Top nav */}
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
            >
              ← Zpět
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Crawler Dashboard
                </h1>
                {anyRunning ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    Standby
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Přehled sběru návrhů, průběhu crawleru a posledních frází v reálném čase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Aktualizace
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">každé 3 s</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Projekt
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                good-inventions.work
              </div>
            </div>
          </div>
        </div>

        {/* Hero stats */}
        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Celkový přehled
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                {formatNumber(total)} unikátních frází
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Dashboard sjednocuje data ze Seznamu a Googlu do jednoho přehledu,
                aby bylo okamžitě vidět tempo růstu, stav zpracování i živá aktivita crawleru.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Seznam.cz"
                value={formatNumber(seznamCount)}
                hint={getStatusLabel(seznamState)}
              />
              <MetricCard
                label="Google.cz"
                value={formatNumber(googleCount)}
                hint={getStatusLabel(googleState)}
              />
              <MetricCard
                label="Aktivních crawlerů"
                value={String([seznamState, googleState].filter((s) => s?.status === "running").length)}
                hint={anyRunning ? "živě běží" : "žádný aktivní"}
              />
            </div>
          </div>
        </section>

        {/* Source panels */}
        <div className="space-y-8">
          <SourcePanel
            title="Seznam.cz"
            engine="seznam"
            count={seznamCount}
            state={seznamState}
            latest={seznamLatest}
            recent={seznamRecent}
          />

          <SourcePanel
            title="Google.cz"
            engine="google"
            count={googleCount}
            state={googleState}
            latest={googleLatest}
            recent={googleRecent}
          />
        </div>

        {/* Footer */}
        <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Realtime monitoring dashboard</span>
          <span>{new Date().toLocaleDateString("cs-CZ")} • good-inventions.work</span>
        </footer>
      </div>
    </div>
  );
}