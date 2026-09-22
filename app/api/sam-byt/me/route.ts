import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/sam-byt/auth/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ username: user.username, displayName: user.displayName });
}
