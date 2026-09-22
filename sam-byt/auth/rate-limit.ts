import type { Pool } from "pg";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_USERNAME = 8;
const MAX_ATTEMPTS_PER_IP = 20;

export async function isLoginRateLimited(pool: Pool, username: string, ip: string): Promise<boolean> {
  const { rows } = await pool.query<{ by_username: string; by_ip: string }>(
    `select
       (select count(*) from sam_byt_login_attempts
          where username = $1 and success = false and attempted_at > now() - interval '${WINDOW_MINUTES} minutes') as by_username,
       (select count(*) from sam_byt_login_attempts
          where ip = $2 and success = false and attempted_at > now() - interval '${WINDOW_MINUTES} minutes') as by_ip`,
    [username, ip],
  );
  const byUsername = Number(rows[0]?.by_username ?? 0);
  const byIp = Number(rows[0]?.by_ip ?? 0);
  return byUsername >= MAX_ATTEMPTS_PER_USERNAME || byIp >= MAX_ATTEMPTS_PER_IP;
}

export async function recordLoginAttempt(pool: Pool, username: string, ip: string, success: boolean): Promise<void> {
  await pool.query("insert into sam_byt_login_attempts (username, ip, success) values ($1, $2, $3)", [
    username,
    ip,
    success,
  ]);
}
