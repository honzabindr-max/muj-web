import { CrawlState, STALE_THRESHOLD_S } from "./types";

export function formatNumber(value: number) {
  return value.toLocaleString("cs-CZ");
}

export function safeQueueLength(raw?: string) {
  if (!raw) return 0;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.length : 0;
  } catch {
    return 0;
  }
}

export function getProgress(state: CrawlState | null) {
  if (!state || !state.queue_size) return 0;
  return Math.max(0, Math.min(100, Math.round((state.processed / state.queue_size) * 100)));
}

export function isActuallyRunning(state: CrawlState | null) {
  if (!state || state.status !== "running") return false;
  if (!state.updated_at) return false;
  return (Date.now() - new Date(state.updated_at).getTime()) / 1000 < STALE_THRESHOLD_S;
}

export function getRealAdded(state: CrawlState | null) {
  if (!state) return 0;
  return Math.max(0, (state.count_after ?? 0) - (state.count_before ?? 0));
}

export function getElapsedLabel(startedAt?: string) {
  if (!startedAt) return "\u2014";
  const s = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getUpdatedTime(updatedAt?: string) {
  if (!updatedAt) return "\u2014";
  return new Date(updatedAt).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getStatusText(state: CrawlState | null) {
  if (!state) return "Nezn\u00e1m\u00fd stav";
  if (state.status === "running") {
    return isActuallyRunning(state) ? "Crawluje" : "\u010cek\u00e1 na dal\u0161\u00ed b\u011bh";
  }
  if (state.status === "completed") return "Dokon\u010deno";
  if (state.status === "paused") return "Pozastaveno";
  return "Idle";
}

export function getStatusBadgeClasses(state: CrawlState | null) {
  if (!state) return "border-white/70 bg-white/55 text-zinc-600";
  if (state.status === "running" && isActuallyRunning(state)) {
    return "border-emerald-200/80 bg-emerald-50/80 text-emerald-700 shadow-[0_0_0_4px_rgba(16,185,129,0.06)]";
  }
  if (state.status === "completed") return "border-blue-200/80 bg-blue-50/80 text-blue-700";
  if (state.status === "paused") return "border-amber-200/80 bg-amber-50/80 text-amber-700";
  return "border-white/70 bg-white/55 text-zinc-600";
}

export function buildSparklineSeries(
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
    Math.max(8, Math.round(base + i * (p / 2.4) + Math.sin(i * 0.78) * amp + ((i % 3) - 1) * r * 4))
  );
}
