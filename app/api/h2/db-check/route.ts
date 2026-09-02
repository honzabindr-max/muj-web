import { Client } from "pg";

import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

/**
 * DOČASNÝ diagnostický endpoint pro KROK 5 (ověření connectivity 4 rolí po
 * Neon provisioningu). Neexpozuje credentials, jen role/ok/table count.
 * Smazat po ověření — není to trvalá součást H2 Buddy product surface.
 */
const ROLE_VARS = [
  { role: "h2_runtime", envVar: "H2_RUNTIME_DATABASE_URL" },
  { role: "h2_job", envVar: "H2_JOB_DATABASE_URL" },
  { role: "h2_blind_reader", envVar: "H2_BLIND_READER_DATABASE_URL" },
  { role: "h2_control", envVar: "H2_CONTROL_DATABASE_URL" },
] as const;

async function checkRole(role: string, connectionString: string | undefined) {
  if (!connectionString) {
    return { role, ok: false, error: "ENV_VAR_MISSING" };
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query<{ current_user: string; session_user: string; table_count: string }>(
      "select current_user, session_user, (select count(*) from pg_tables where schemaname = 'public')::text as table_count",
    );
    return {
      role,
      ok: true,
      connectedAsExpected: result.rows[0].current_user === role,
      actualCurrentUser: result.rows[0].current_user,
      actualSessionUser: result.rows[0].session_user,
      tableCount: Number(result.rows[0].table_count),
    };
  } catch (error) {
    return { role, ok: false, error: (error as Error).message.slice(0, 200) };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function GET() {
  const results = await Promise.all(ROLE_VARS.map(({ role, envVar }) => checkRole(role, process.env[envVar])));
  for (const result of results) {
    logH2Event({
      purpose: "config",
      status: result.ok ? "ok" : "error",
      errorCode: result.ok ? undefined : "H2_DB_CHECK_FAILED",
    });
  }
  const environment = process.env.VERCEL_ENV ?? "unknown";
  return Response.json({ environment, results });
}
