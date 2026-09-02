import type { Pool } from "pg";

import { H2AuthError, H2ReauthRequiredError } from "./errors";

/**
 * §31.1/§31.2 — typed helpery, které Build Specification u BUILD-03A
 * výslovně vyžaduje: requireOwnerSession() a requireRecentReauth(maxAge=5m).
 * "Destructive/admin capabilities nesmějí implementovat vlastní alternativní
 * auth cestu" — tyto dvě funkce jsou JEDINÁ cesta, jak to ověřit.
 */
export type H2OwnerSession = {
  ownerId: string;
  googleSub: string;
};

const RECENT_REAUTH_WINDOW_MS = 5 * 60 * 1000;

/**
 * `googleSub` přichází z Auth.js session (JWT/cookie) — tahle funkce ho
 * jen ověří proti enrollnutému owner záznamu v DB. Nevytváří session,
 * jen ji validuje.
 */
export async function requireOwnerSession(
  pool: Pool,
  googleSub: string | undefined | null,
): Promise<H2OwnerSession> {
  if (!googleSub) {
    throw new H2AuthError("UNAUTHENTICATED");
  }
  const result = await pool.query<{ id: string }>("select id from owners where google_sub = $1", [googleSub]);
  if (result.rows.length === 0) {
    throw new H2AuthError("UNKNOWN_OWNER");
  }
  return { ownerId: result.rows[0].id, googleSub };
}

export async function requireRecentReauth(pool: Pool, ownerId: string, now: Date = new Date()): Promise<void> {
  const result = await pool.query<{ recent_reauth_at: Date | null }>(
    "select recent_reauth_at from owners where id = $1",
    [ownerId],
  );
  const reauthAt = result.rows[0]?.recent_reauth_at;
  if (!reauthAt || now.getTime() - new Date(reauthAt).getTime() > RECENT_REAUTH_WINDOW_MS) {
    throw new H2ReauthRequiredError();
  }
}

export async function markRecentReauth(pool: Pool, ownerId: string, now: Date = new Date()): Promise<void> {
  await pool.query("update owners set recent_reauth_at = $1 where id = $2", [now, ownerId]);
}
