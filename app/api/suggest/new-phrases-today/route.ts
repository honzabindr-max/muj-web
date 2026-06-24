import { NextResponse } from "next/server";
import { readNewPhrasesToday } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = ["gl", "hl", "new_today"] as const;

function normalize(data: unknown[]): unknown[] {
  if (!data.length || !Array.isArray(data[0])) return data;
  return data.map((row) =>
    Object.fromEntries(KEYS.map((k, i) => [k, (row as unknown[])[i]]))
  );
}

export async function GET() {
  try {
    const data = await readNewPhrasesToday();
    return NextResponse.json(normalize(data));
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
