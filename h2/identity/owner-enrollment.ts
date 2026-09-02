import type { Pool } from "pg";

/**
 * První owner enrollment (§31.1): "při prvním enrollmentu se uloží stabilní
 * Google sub, nikoli pouze e-mail. Pouze tento owner může vytvořit session."
 *
 * "Přesně jeden povolený owner" se vynucuje TADY, na úrovni web auth
 * enrollmentu — ne jako DB-wide constraint na owners tabulce. Owners
 * tabulka musí zůstat schopná nést víc řádků (testovací fixtures napříč
 * BUILD-02/03 testy už na tom stavějí), takže "jeden owner" je invariant
 * vynucovaný tímto modulem, ne schématem.
 *
 * Race-safe: advisory lock serializuje souběžné první přihlášení, aby dva
 * odlišné Google účty nemohly "vyhrát" enrollment současně.
 */
const ENROLLMENT_LOCK_KEY = "h2_owner_enrollment";

export type OwnerEnrollmentResult =
  | { rejected: false; ownerId: string; enrolled: boolean }
  | { rejected: true };

export async function enrollOrVerifyOwner(
  pool: Pool,
  googleSub: string,
  displayName: string,
): Promise<OwnerEnrollmentResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [ENROLLMENT_LOCK_KEY]);

    const existing = await client.query<{ id: string; google_sub: string }>(
      "select id, google_sub from owners where google_sub is not null limit 1",
    );

    if (existing.rows.length === 0) {
      const inserted = await client.query<{ id: string }>(
        "insert into owners (google_sub, display_name) values ($1, $2) returning id",
        [googleSub, displayName],
      );
      await client.query("commit");
      return { rejected: false, ownerId: inserted.rows[0].id, enrolled: true };
    }

    if (existing.rows[0].google_sub !== googleSub) {
      await client.query("rollback");
      return { rejected: true };
    }

    await client.query("commit");
    return { rejected: false, ownerId: existing.rows[0].id, enrolled: false };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
