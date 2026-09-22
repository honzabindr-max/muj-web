import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/sam-byt/auth/require-session";
import { getSamBytPool } from "@/sam-byt/db/pool";
import { getStatesForUser } from "@/sam-byt/state/repository";
import { getAllListings } from "@/sam-byt/data/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapToObject<V>(map: Map<string, V>): Record<string, V> {
  return Object.fromEntries(map.entries());
}

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pool = getSamBytPool();
  const own = await getStatesForUser(pool, sessionUser.userId, sessionUser.username);

  const body: { own: Record<string, unknown>; sam?: Record<string, unknown> } = {
    own: mapToObject(own),
  };

  // Jen Honzík vidí Samův výběr (bod 8 zadání). Sam vidí jen svoje.
  if (sessionUser.username === "honzik") {
    const { rows } = await pool.query<{ id: string }>("select id from sam_byt_users where username = 'sam'");
    const samUserId = rows[0]?.id;
    if (samUserId) {
      const samState = await getStatesForUser(pool, samUserId, "sam");
      body.sam = mapToObject(samState);
    }
  }

  return NextResponse.json({ ...body, listingIds: getAllListings().map((l) => l.id) });
}
