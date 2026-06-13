import { createClient } from "@supabase/supabase-js";

const PROXY_BASE = "https://suggest.good-inventions.work";
const FETCH_TIMEOUT_MS = 8_000;

type ReadMode = "supabase" | "hetzner_proxy";

function readMode(): ReadMode {
  return process.env.SUGGEST_READ_SOURCE === "hetzner_proxy"
    ? "hetzner_proxy"
    : "supabase";
}

function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function proxyFetch(path: string): Promise<unknown[]> {
  const token = process.env.SUGGEST_PROXY_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROXY_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    return (await res.json()) as unknown[];
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseRpc<T>(rpc: string): Promise<T[]> {
  const { data, error } = await supabaseServer().rpc(rpc);
  if (error || !data) throw new Error(`supabase rpc ${rpc}: ${error?.message}`);
  return data as T[];
}

async function withFallback<T>(proxyPath: string, rpc: string): Promise<T[]> {
  if (readMode() === "supabase") return supabaseRpc<T>(rpc);

  try {
    return (await proxyFetch(proxyPath)) as T[];
  } catch (err) {
    // Fallback active — remove after S3 PASS + 7 days (see infra/evidence/read_cutover_report.md)
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[suggest-reader] proxy error, falling back to supabase: ${msg}`);
    return supabaseRpc<T>(rpc);
  }
}

export function readDashboardRows() {
  return withFallback("/suggest/dashboard-rows", "get_dashboard_rows");
}

export function readDashboardState() {
  return withFallback("/suggest/dashboard-state", "get_dashboard_state");
}

export function readNewPhrases24h() {
  return withFallback("/suggest/new-phrases-24h", "get_new_phrases_24h");
}
