import { NextResponse } from "next/server";
import { readNewPhrases24h } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readNewPhrases24h();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
