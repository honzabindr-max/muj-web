import { NextResponse, type NextRequest } from "next/server";

import { verifyPassword } from "@/sam-byt/auth/password";
import { isLoginRateLimited, recordLoginAttempt } from "@/sam-byt/auth/rate-limit";
import { clientIp } from "@/sam-byt/auth/require-session";
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/sam-byt/auth/session";
import { getSamBytPool } from "@/sam-byt/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if ((username !== "sam" && username !== "honzik") || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const pool = getSamBytPool();
  const ip = clientIp(request);

  if (await isLoginRateLimited(pool, username, ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { rows } = await pool.query<{ id: string; password_hash: string; display_name: string }>(
    "select id, password_hash, display_name from sam_byt_users where username = $1",
    [username],
  );
  const user = rows[0];
  const valid = user ? await verifyPassword(password, user.password_hash) : false;

  await recordLoginAttempt(pool, username, ip, valid);

  if (!user || !valid) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { token } = await createSession(pool, user.id, request.headers.get("user-agent"));

  const response = NextResponse.json({ username, displayName: user.display_name });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
