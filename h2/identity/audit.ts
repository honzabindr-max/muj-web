import type { Pool } from "pg";

/**
 * "Audit bezpečných identity eventů bez tokenů/payloadu" (§31.1). Nikdy
 * neukládá Google sub, cookie, token ani jiný obsah — jen typ eventu +
 * owner_id (nullable pro odmítnutá/neznámá přihlášení).
 */
export type H2IdentityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_REJECTED_UNKNOWN_OWNER"
  | "REAUTH_SUCCESS"
  | "REAUTH_EXPIRED"
  | "CSRF_REJECTED";

export async function recordIdentityEvent(
  pool: Pool,
  ownerId: string | null,
  eventType: H2IdentityEventType,
): Promise<void> {
  await pool.query("insert into identity_audit_events (owner_id, event_type) values ($1, $2)", [
    ownerId,
    eventType,
  ]);
}
