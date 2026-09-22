import type { NextRequest } from "next/server";

import { getSamBytPool } from "@/sam-byt/db/pool";

import { SESSION_COOKIE_NAME, verifySessionToken, type SessionUser } from "./session";

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const pool = getSamBytPool();
  return verifySessionToken(pool, token);
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
