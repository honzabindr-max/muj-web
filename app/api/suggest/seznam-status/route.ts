import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_BASE = "https://suggest.good-inventions.work";
const FETCH_TIMEOUT_MS = 8_000;

export async function GET() {
  const token = process.env.SUGGEST_PROXY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "proxy not configured" }, { status: 503 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROXY_BASE}/suggest/seznam-status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
