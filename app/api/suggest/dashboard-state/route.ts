import { NextResponse } from "next/server";
import { readDashboardState } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_KEYS = [
  "gl", "hl", "depth", "depth_pct", "processed", "queries_total",
  "new_total", "queue_len", "next_queue_len", "current_prefix", "status", "updated_at",
] as const;

function normalize(data: unknown[]): unknown[] {
  if (!data.length || !Array.isArray(data[0])) return data;
  return data.map((row) =>
    Object.fromEntries(STATE_KEYS.map((k, i) => [k, (row as unknown[])[i]]))
  );
}

export async function GET() {
  try {
    const data = await readDashboardState();
    return NextResponse.json(normalize(data));
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
