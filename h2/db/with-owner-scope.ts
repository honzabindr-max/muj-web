import type { Pool, PoolClient } from "pg";

/**
 * Owner-scoped DB operace (§4.3, RLS policy vzor z BUILD-02): nastaví
 * SET LOCAL app.owner_id na začátku transakce, takže RLS WITH CHECK na
 * owner-scoped tabulkách (identity_audit_events atd.) požadovaný insert
 * povolí. Bez tohohle wrapperu insert s vyplněným owner_id pod rolí
 * h2_runtime spadne na "new row violates row-level security policy" —
 * přesně tahle chyba se stala v produkci u BUILD-03A signIn callbacku.
 */
export class H2OwnerScopeError extends Error {
  constructor(public readonly code: "OWNER_SCOPE_NOT_SET", ownerId: string) {
    super(`H2 db: app.owner_id scope se nenastavil (ownerId=${ownerId}) — FORCE RLS na owner-scoped tabulkách by dál běžela, ale TICHE vyprázdnila výsledky.`);
    this.name = "H2OwnerScopeError";
  }
}

/**
 * Readback guard (BUILD-11 Rozhodnutí 8, Pravidlo 9) — `set_config()` sama
 * o sobě může tiše selhat/no-opnout (např. špatný typ argumentu,
 * connection pooler edge case). Bez ověření by RLS na FORCE-RLS tabulkách
 * (`raw_events`/`message_processing_jobs` atd., migrace 0011) tiše vrátila
 * 0 řádků místo chyby — přesně tahle třída bugu se stala ve
 * `verify-ingestion.ts` PŘED touhle opravou (viz ten skript pro plné
 * zdůvodnění). `withOwnerScope()` je sdílená infrastruktura, kterou volá
 * KAŽDÉ owner-scoped DB volání napříč celým H2 — oprava tady chrání
 * celou frontu, ne jen jednoho volajícího.
 */
export async function withOwnerScope<T>(
  pool: Pool,
  ownerId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.owner_id', $1, true)", [ownerId]);
    const readback = await client.query<{ owner_id_setting: string | null }>(
      "select current_setting('app.owner_id', true) as owner_id_setting",
    );
    if (readback.rows[0]?.owner_id_setting !== ownerId) {
      throw new H2OwnerScopeError("OWNER_SCOPE_NOT_SET", ownerId);
    }
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
