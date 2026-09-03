import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { withOwnerScope } from "../../db/with-owner-scope";
import { recordIdentityEvent } from "../audit";
import { enrollOrVerifyOwner } from "../owner-enrollment";
import { markRecentReauth } from "../session";

const DB_NAME = "h2_test_production_signin_flow";

/**
 * Reprodukuje přesně to, co dělá auth.ts signIn callback, ale připojené
 * jako skutečná role h2_runtime (ne admin/superuser) — stejná role, kterou
 * v produkci používá H2_RUNTIME_DATABASE_URL. Dva reálné produkční bugy
 * (chybějící INSERT/UPDATE grant na owners, chybějící RLS scope na
 * identity_audit_events) unikly dřívějším testům přesně proto, že žádný
 * test doteď neběžel POD touto omezenou rolí pro celý sign-in flow.
 *
 * Fresh DB per test (beforeEach) — "přesně jeden povolený owner" invariant
 * by se jinak popletl mezi testy sdílejícími jednu databázi.
 */
describe("BUILD-03A sign-in flow pod rolí h2_runtime (reprodukce produkčního AccessDenied bugu)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("první přihlášení: enroll + recent_reauth_at + LOGIN_SUCCESS audit — celé pod h2_runtime", async () => {
    const result = await enrollOrVerifyOwner(runtimePool, "prod-flow-owner-sub", "Honzík");
    expect(result.rejected).toBe(false);
    if (result.rejected) return;

    await markRecentReauth(runtimePool, result.ownerId);
    await withOwnerScope(runtimePool, result.ownerId, (client) =>
      recordIdentityEvent(client, result.ownerId, "LOGIN_SUCCESS"),
    );

    const owner = await adminPool.query<{ recent_reauth_at: Date | null }>(
      "select recent_reauth_at from owners where id = $1",
      [result.ownerId],
    );
    expect(owner.rows[0].recent_reauth_at).not.toBeNull();

    const events = await adminPool.query(
      "select event_type from identity_audit_events where owner_id = $1",
      [result.ownerId],
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].event_type).toBe("LOGIN_SUCCESS");
  });

  it("odmítnuté přihlášení (cizí sub): LOGIN_REJECTED_UNKNOWN_OWNER audit bez owner_id — funguje i bez scope", async () => {
    await enrollOrVerifyOwner(runtimePool, "prod-flow-first-owner", "Honzík");
    const intruder = await enrollOrVerifyOwner(runtimePool, "prod-flow-intruder", "Někdo jiný");
    expect(intruder.rejected).toBe(true);

    await recordIdentityEvent(runtimePool, null, "LOGIN_REJECTED_UNKNOWN_OWNER");

    const events = await adminPool.query(
      "select owner_id from identity_audit_events where event_type = 'LOGIN_REJECTED_UNKNOWN_OWNER'",
    );
    expect(events.rows).toHaveLength(1);
    expect(events.rows[0].owner_id).toBeNull();
  });

  it("regrese: recordIdentityEvent s owner_id BEZ withOwnerScope pod h2_runtime selže na RLS (dokumentuje opravený bug)", async () => {
    const result = await enrollOrVerifyOwner(runtimePool, "prod-flow-unscoped-test", "Test");
    expect(result.rejected).toBe(false);
    if (result.rejected) return;

    await expect(recordIdentityEvent(runtimePool, result.ownerId, "LOGIN_SUCCESS")).rejects.toThrow(
      /row-level security/,
    );
  });
});
