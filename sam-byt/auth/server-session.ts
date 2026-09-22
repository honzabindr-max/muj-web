import { cookies } from "next/headers";

import { getSamBytPool } from "@/sam-byt/db/pool";

import { SESSION_COOKIE_NAME, verifySessionToken, type SessionUser } from "./session";

/** Session čtená ze Server Components (RSC) — next/headers cookies() je v Next 16 async. */
export async function getServerSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(getSamBytPool(), token);
}
