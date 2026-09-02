import type { Pool, PoolClient } from "pg";

/**
 * "Audit bezpečných identity eventů bez tokenů/payloadu" (§31.1). Nikdy
 * neukládá Google sub, cookie, token ani jiný obsah — jen typ eventu +
 * owner_id (nullable pro odmítnutá/neznámá přihlášení).
 *
 * Přijímá Pool i PoolClient: řádky s vyplněným owner_id podléhají RLS na
 * identity_audit_events, takže volající MUSÍ použít PoolClient z
 * h2/db/with-owner-scope.ts (SET LOCAL app.owner_id), jinak insert pod
 * rolí h2_runtime spadne na row-level security violation. Řádky s
 * owner_id=null (odmítnuté přihlášení) fungují i s obyčejným Pool.
 */
export type H2IdentityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_REJECTED_UNKNOWN_OWNER"
  | "REAUTH_SUCCESS"
  | "REAUTH_EXPIRED"
  | "CSRF_REJECTED";

export async function recordIdentityEvent(
  db: Pool | PoolClient,
  ownerId: string | null,
  eventType: H2IdentityEventType,
): Promise<void> {
  await db.query("insert into identity_audit_events (owner_id, event_type) values ($1, $2)", [
    ownerId,
    eventType,
  ]);
}
