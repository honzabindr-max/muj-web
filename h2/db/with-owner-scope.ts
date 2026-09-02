import type { Pool, PoolClient } from "pg";

/**
 * Owner-scoped DB operace (§4.3, RLS policy vzor z BUILD-02): nastaví
 * SET LOCAL app.owner_id na začátku transakce, takže RLS WITH CHECK na
 * owner-scoped tabulkách (identity_audit_events atd.) požadovaný insert
 * povolí. Bez tohohle wrapperu insert s vyplněným owner_id pod rolí
 * h2_runtime spadne na "new row violates row-level security policy" —
 * přesně tahle chyba se stala v produkci u BUILD-03A signIn callbacku.
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
