import { createHash, randomBytes } from "node:crypto";

import type { Pool } from "pg";

import type { Username } from "@/sam-byt/types";

export const SESSION_COOKIE_NAME = "sam_byt_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 dní

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  userId: string;
  username: Username;
  displayName: string;
}

export async function createSession(
  pool: Pool,
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await pool.query(
    "insert into sam_byt_sessions (user_id, token_hash, user_agent, expires_at) values ($1, $2, $3, $4)",
    [userId, tokenHash, userAgent, expiresAt],
  );
  return { token, expiresAt };
}

export async function verifySessionToken(pool: Pool, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { rows } = await pool.query<{ id: string; username: Username; display_name: string }>(
    `select u.id, u.username, u.display_name
       from sam_byt_sessions s
       join sam_byt_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  void pool.query("update sam_byt_sessions set last_seen_at = now() where token_hash = $1", [tokenHash]);
  return { userId: row.id, username: row.username, displayName: row.display_name };
}

export async function destroySession(pool: Pool, token: string | undefined): Promise<void> {
  if (!token) return;
  await pool.query("delete from sam_byt_sessions where token_hash = $1", [hashToken(token)]);
}
