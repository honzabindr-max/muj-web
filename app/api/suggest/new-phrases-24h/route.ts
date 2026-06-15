import { NextResponse } from "next/server";
import { readNewPhrases24h } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEW24H_KEYS = ["gl", "hl", "new_24h"] as const;

function normalize(data: unknown[]): unknown[] {
  if (!data.length || !Array.isArray(data[0])) return data;
  return data.map((row) =>
    Object.fromEntries(NEW24H_KEYS.map((k, i) => [k, (row as unknown[])[i]]))
  );
}

export async function GET() {
  try {
    const data = await readNewPhrases24h();
    return NextResponse.json(normalize(data));
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
