import { NextResponse } from "next/server";
import { readDashboardState } from "@/lib/suggest-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readDashboardState();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
