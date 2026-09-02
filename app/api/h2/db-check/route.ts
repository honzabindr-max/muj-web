import { Client } from "pg";

import { logH2Event } from "@/h2/logging/logger";

export const dynamic = "force-dynamic";

/**
 * DOČASNÝ diagnostický endpoint pro KROK 5 (ověření connectivity + reálné
 * RLS enforcement 4 rolí po Neon provisioningu). Neexpozuje credentials,
 * jen role/flags/table count. Read-only s jednou záměrnou UPDATE zkouškou
 * na h2_control, která se OČEKÁVANĚ odmítne (permission denied) — Postgres
 * ji zamítne před jakoukoli zápisovou operací, takže nemění žádná data i
 * proti produkci. Smazat po ověření — není to trvalá součást product surface.
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

async function checkControlRole() {
  const connectionString = process.env.H2_CONTROL_DATABASE_URL;
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

    // Záměrně odmítnutý UPDATE — append-only se vynucuje na úrovni GRANT
    // (žádný UPDATE/DELETE grant), takže Postgres zápis odmítne dřív, než
    // by se čehokoli dotkl. Žádná data se touto zkouškou nemění.
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

export async function GET() {
  const [runtimeResults, controlResult] = await Promise.all([
    Promise.all(RUNTIME_ROLE_VARS.map(({ role, envVar }) => checkRuntimeRole(role, process.env[envVar]))),
    checkControlRole(),
  ]);
  const results = [...runtimeResults, controlResult];
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
