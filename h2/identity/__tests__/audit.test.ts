import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRuntimeTestDatabase, dropTestDatabase } from "../../db/__tests__/helpers";
import { recordIdentityEvent } from "../audit";

const DB_NAME = "h2_test_identity_audit";

describe("recordIdentityEvent (§31.1 — audit bez tokenů/payloadu)", () => {
  let pool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    pool = await createRuntimeTestDatabase(DB_NAME);
    const owner = await pool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["audit-test-sub", "Test Owner"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await dropTestDatabase(pool, DB_NAME);
  });

  it("zapíše event s owner_id", async () => {
    await recordIdentityEvent(pool, ownerId, "LOGIN_SUCCESS");
    const rows = await pool.query("select owner_id, event_type from identity_audit_events where owner_id = $1", [
      ownerId,
    ]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].event_type).toBe("LOGIN_SUCCESS");
  });

  it("zapíše event bez owner_id pro odmítnuté/neznámé přihlášení", async () => {
    await recordIdentityEvent(pool, null, "LOGIN_REJECTED_UNKNOWN_OWNER");
    const rows = await pool.query(
      "select owner_id, event_type from identity_audit_events where event_type = 'LOGIN_REJECTED_UNKNOWN_OWNER'",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].owner_id).toBeNull();
  });

  it("odmítne neplatný event_type (DB check constraint)", async () => {
    await expect(
      pool.query("insert into identity_audit_events (owner_id, event_type) values ($1, $2)", [
        ownerId,
        "NOT_A_REAL_EVENT",
      ]),
    ).rejects.toThrow(/identity_audit_events_event_type_check/);
  });
});
