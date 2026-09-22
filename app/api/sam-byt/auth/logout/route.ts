import { NextResponse, type NextRequest } from "next/server";

import { verifySameOrigin } from "@/sam-byt/auth/csrf";
import { destroySession, SESSION_COOKIE_NAME } from "@/sam-byt/auth/session";
import { getSamBytPool } from "@/sam-byt/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(getSamBytPool(), token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
