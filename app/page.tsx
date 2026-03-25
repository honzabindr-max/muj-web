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
  return Math.max(
    0,
    Math.min(100, Math.round((state.processed / state.queue_size) * 100))
  );
}

function getElapsedLabel(startedAt?: string) {
  if (!startedAt) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
  );

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  if (state.status === "running") return "Crawluje";
  if (state.status === "completed") return "Dokončeno";
  if (state.status === "paused") return "Pozastaveno";
  return "Idle";
}

function getStatusBadgeClasses(state: CrawlState | null) {
  if (!state) {
    return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }

  if (state.status === "running") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (state.status === "completed") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (state.status === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function getEngineTheme(engine: "seznam" | "google") {
  if (engine === "seznam") {
    return {
      dot: "bg-red-500",
      softBg: "bg-red-50/50",
      panelBorder: "border-red-100",
      topTint: "from-red-50 to-white",
      progress: "from-red-500 to-orange-500",
      progressSoft: "bg-red-100/60",
      pill: "border-red-100 bg-red-50 text-red-700",
    };
  }

  return {
    dot: "bg-blue-500",
    softBg: "bg-blue-50/50",
    panelBorder: "border-blue-100",
    topTint: "from-blue-50 to-white",
    progress: "from-blue-500 to-cyan-500",
    progressSoft: "bg-blue-100/60",
    pill: "border-blue-100 bg-blue-50 text-blue-700",
  };
}

function StatMiniCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </div>
      {hint ? <div className="mt-2 text-sm text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function TopMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-4xl font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </div>
      {hint ? <div className="mt-2 text-sm text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500">{label}</span>
      <span
        className={`text-sm ${
          emphasize ? "font-semibold text-zinc-950" : "font-medium text-zinc-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RecentPhraseItem({ phrase }: { phrase: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-200 hover:bg-white">
      {phrase}
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
  const theme = getEngineTheme(engine);
  const progress = getProgress(state);
  const queueNow = safeQueueLength(state?.queue);
  const queueNext = safeQueueLength(state?.next_queue);

  const processed = state?.processed ?? 0;
  const queueSize = state?.queue_size ?? 0;
  const currentDepth = state?.current_depth ?? 0;
  const isRunning = state?.status === "running";
  const statusText = getStatusText(state);

  return (
    <section
      className={`overflow-hidden rounded-[32px] border ${theme.panelBorder} bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]`}
    >
      <div className={`bg-gradient-to-b ${theme.topTint} px-6 py-6 md:px-8 md:py-7`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${theme.dot} ${
                  isRunning ? "animate-pulse" : ""
                }`}
              />
              <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Zdroj
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {latest ? `Poslední zachycená fráze: ${latest}` : "Zatím bez nových frází"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusBadgeClasses(
                    state
                  )}`}
                >
                  {statusText}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${theme.pill}`}
                >
                  Hloubka {currentDepth}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="text-sm text-zinc-500">Celkem frází</div>
            <div className="mt-2 text-6xl font-semibold leading-none tracking-tight text-zinc-950 md:text-7xl">
              {formatNumber(count)}
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-zinc-950">Průběh crawleru</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Hloubka {currentDepth} — {formatNumber(processed)} / {formatNumber(queueSize)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-900">{progress}%</div>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${theme.progress} transition-all duration-700`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatMiniCard
                label="Dotazy"
                value={state ? formatNumber(state.queries_total) : "—"}
              />
              <StatMiniCard
                label="Nové fráze"
                value={state ? `+${formatNumber(state.new_total)}` : "—"}
              />
              <StatMiniCard
                label="Fronta teď"
                value={formatNumber(queueNow)}
              />
              <StatMiniCard
                label="Další hloubka"
                value={formatNumber(queueNext)}
                hint="prefixů"
              />
            </div>
          </div>

          <div className="flex h-full flex-col rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-medium text-zinc-950">Live detail</div>
                <div className="mt-1 text-sm text-zinc-500">
                  Aktuální stav zdroje a poslední zachycené fráze.
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end">
                <div className="text-xs text-zinc-500">Aktivní prefix</div>
                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono-brand text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  {state?.current_prefix ? `"${state.current_prefix}"` : "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <DetailRow label="Status" value={statusText} emphasize />
              <DetailRow label="Hloubka" value={String(currentDepth || "—")} />
              <DetailRow
                label="Zpracováno"
                value={
                  state
                    ? `${formatNumber(processed)} / ${formatNumber(queueSize)}`
                    : "—"
                }
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

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-950">Poslední fráze</div>
              <div className="text-xs text-zinc-500">
                {recent.length > 0 ? `${recent.length} položek` : "bez dat"}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {recent.length > 0 ? (
                recent.slice(0, 6).map((phrase, index) => (
                  <RecentPhraseItem key={`${phrase}-${index}`} phrase={phrase} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500">
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
        supabase
          .from("google_suggestions")
          .select("*", { count: "exact", head: true }),
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
  const activeCount = [seznamState, googleState].filter(
    (s) => s?.status === "running"
  ).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-[32px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                ← Zpět
              </Link>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
                    Crawler Dashboard
                  </h1>

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                      activeCount > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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
                <div className="mt-2 text-xl font-semibold leading-none text-zinc-950">
                  každé 3 s
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Projekt
                </div>
                <div className="mt-2 text-xl font-semibold leading-none text-zinc-950">
                  good-inventions.work
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-center">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                Celkový přehled
              </div>

              <h2 className="mt-4 text-5xl font-semibold leading-none tracking-tight text-zinc-950 md:text-6xl">
                {formatNumber(total)} unikátních frází
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                Data ze Seznamu a Googlu. Crawlery běží non-stop přes GitHub Actions.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TopMetric
                label="Seznam.cz"
                value={formatNumber(seznamCount)}
                hint={getStatusText(seznamState)}
              />
              <TopMetric
                label="Google.cz"
                value={formatNumber(googleCount)}
                hint={getStatusText(googleState)}
              />
              <TopMetric
                label="Aktivních"
                value={String(activeCount)}
                hint={activeCount > 0 ? "crawluje" : "žádný aktivní"}
              />
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
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

        <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200 px-1 pt-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Monitoring crawlerů v reálném čase</span>
          <span>
            {new Date().toLocaleDateString("cs-CZ")} · good-inventions.work
          </span>
        </footer>
      </div>
    </div>
  );
}