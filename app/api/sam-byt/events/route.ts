import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/sam-byt/auth/require-session";
import { getSamBytPool } from "@/sam-byt/db/pool";
import { getRecentEvents } from "@/sam-byt/state/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Historie rozhodnutí — jen Honzík (bod 3.2 a 8 zadání: "Honzík si rozklikne poslední změny"). */
export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (sessionUser.username !== "honzik") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const events = await getRecentEvents(getSamBytPool(), 100);
  return NextResponse.json({ events });
}
