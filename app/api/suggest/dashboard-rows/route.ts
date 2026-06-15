import { NextResponse } from "next/server";
import { readDashboardRows } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hetzner proxy returns psycopg tuples serialized as JSON arrays.
// Supabase RPC returns objects. Normalize to objects either way.
const ROW_KEYS = [
  "source", "gl", "hl", "phrase_count", "depth", "depth_pct",
  "processed", "queries_total", "new_total", "queue_len", "next_queue_len",
  "current_prefix", "status", "updated_at", "last_started_at", "last_finished_at",
] as const;

function normalize(data: unknown[]): unknown[] {
  if (!data.length || !Array.isArray(data[0])) return data;
  return data.map((row) =>
    Object.fromEntries(ROW_KEYS.map((k, i) => [k, (row as unknown[])[i]]))
  );
}

export async function GET() {
  try {
    const data = await readDashboardRows();
    return NextResponse.json(normalize(data));
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
