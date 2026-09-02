import { Client } from "pg";

/**
 * KROK 5 — lokální ověření DB/role/RLS stavu proti reálnému Neon, bez
 * jakéhokoli Vercel deploymentu. Čte connection stringy ze .env.rolecheck
 * (přes write-rolecheck-env.sh), spouští se z terminálu, ne přes Code.
 *
 * Ověřuje pro každou roli: current_user odpovídá očekávané roli, role NEMÁ
 * bypassrls, RLS je na raw_events enabled+forced (pro runtime role), a pro
 * h2_control že append-only drží (záměrně odmítnutý UPDATE — Postgres ho
 * zamítne dřív, než by se čehokoli dotkl, takže je to read-safe i proti
 * produkci).
 */
const RUNTIME_ROLE_VARS = [
  { role: "h2_runtime", envVar: "H2_RUNTIME_DATABASE_URL" },
  { role: "h2_job", envVar: "H2_JOB_DATABASE_URL" },
  { role: "h2_blind_reader", envVar: "H2_BLIND_READER_DATABASE_URL" },
] as const;

async function checkRuntimeRole(role: string, connectionString: string | undefined) {
  if (!connectionString) {
    return { role, ok: false, error: "ENV_VAR_MISSING" };
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const identity = await client.query<{ current_user: string; session_user: string }>(
      "select current_user, session_user",
    );
    const currentUser = identity.rows[0].current_user;

    const roleFlags = await client.query<{ rolbypassrls: boolean }>(
      "select rolbypassrls from pg_roles where rolname = $1",
      [currentUser],
    );

    const rlsFlags = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relrowsecurity, relforcerowsecurity from pg_class where relname = 'raw_events'",
    );

    const tableCount = await client.query<{ n: string }>(
      "select count(*)::text as n from pg_tables where schemaname = 'public'",
    );

    return {
      role,
      ok: true,
      connectedAsExpected: currentUser === role,
      actualCurrentUser: currentUser,
      actualSessionUser: identity.rows[0].session_user,
      bypassrls: roleFlags.rows[0]?.rolbypassrls ?? null,
      bypassrlsAsExpected: roleFlags.rows[0]?.rolbypassrls === false,
      rawEventsRlsEnabled: rlsFlags.rows[0]?.relrowsecurity ?? null,
      rawEventsRlsForced: rlsFlags.rows[0]?.relforcerowsecurity ?? null,
      tableCount: Number(tableCount.rows[0].n),
    };
  } catch (error) {
    return { role, ok: false, error: (error as Error).message.slice(0, 200) };
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkControlRole(connectionString: string | undefined) {
  if (!connectionString) {
    return { role: "h2_control", ok: false, error: "ENV_VAR_MISSING" };
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const identity = await client.query<{ current_user: string }>("select current_user");
    const currentUser = identity.rows[0].current_user;

    const roleFlags = await client.query<{ rolbypassrls: boolean }>(
      "select rolbypassrls from pg_roles where rolname = $1",
      [currentUser],
    );

    const tableCount = await client.query<{ n: string }>(
      "select count(*)::text as n from pg_tables where schemaname = 'public'",
    );

    let appendOnlyEnforced = false;
    try {
      await client.query("update deletion_ledger set hmac_key_version = hmac_key_version where false");
      appendOnlyEnforced = false;
    } catch (error) {
      appendOnlyEnforced = /permission denied/i.test((error as Error).message);
    }

    return {
      role: "h2_control",
      ok: true,
      connectedAsExpected: currentUser === "h2_control",
      actualCurrentUser: currentUser,
      bypassrls: roleFlags.rows[0]?.rolbypassrls ?? null,
      bypassrlsAsExpected: roleFlags.rows[0]?.rolbypassrls === false,
      appendOnlyEnforced,
      tableCount: Number(tableCount.rows[0].n),
    };
  } catch (error) {
    return { role: "h2_control", ok: false, error: (error as Error).message.slice(0, 200) };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const envFile = ".env.rolecheck";
  try {
    process.loadEnvFile(envFile);
  } catch {
    throw new Error(`${envFile} neexistuje. Spusť nejdřív: bash h2/db/scripts/write-rolecheck-env.sh`);
  }

  const [runtimeResults, controlResult] = await Promise.all([
    Promise.all(RUNTIME_ROLE_VARS.map(({ role, envVar }) => checkRuntimeRole(role, process.env[envVar]))),
    checkControlRole(process.env.H2_CONTROL_DATABASE_URL),
  ]);

  console.log(JSON.stringify({ results: [...runtimeResults, controlResult] }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
