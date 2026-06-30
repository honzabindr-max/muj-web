const PROXY_BASE = "https://suggest.good-inventions.work";
const FETCH_TIMEOUT_MS = 8_000;

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

export function readDashboardRows() {
  return proxyFetch("/suggest/dashboard-rows");
}

export function readDashboardState() {
  return proxyFetch("/suggest/dashboard-state");
}

export function readNewPhrases24h() {
  return proxyFetch("/suggest/new-phrases-24h");
}

export function readNewPhrasesToday() {
  return proxyFetch("/suggest/new-phrases-today");
}
