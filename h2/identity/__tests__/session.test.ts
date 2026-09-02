import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createRuntimeTestDatabase, dropTestDatabase } from "../../db/__tests__/helpers";
import { H2AuthError, H2ReauthRequiredError } from "../errors";
import { markRecentReauth, requireOwnerSession, requireRecentReauth } from "../session";

const DB_NAME = "h2_test_identity_session";

describe("requireOwnerSession / requireRecentReauth (§31.1, §31.2, AT-64)", () => {
  let pool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    pool = await createRuntimeTestDatabase(DB_NAME);
    const owner = await pool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["session-test-sub", "Test Owner"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await dropTestDatabase(pool, DB_NAME);
  });

  it("requireOwnerSession vrátí ownerId pro platný google sub", async () => {
    const session = await requireOwnerSession(pool, "session-test-sub");
    expect(session.ownerId).toBe(ownerId);
  });

  it("requireOwnerSession selže UNAUTHENTICATED bez google sub", async () => {
    await expect(requireOwnerSession(pool, null)).rejects.toThrow(H2AuthError);
    await expect(requireOwnerSession(pool, undefined)).rejects.toThrow(H2AuthError);
  });

  it("requireOwnerSession selže UNKNOWN_OWNER pro neznámý google sub", async () => {
    let caught: unknown;
    try {
      await requireOwnerSession(pool, "cizi-ucet-sub");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(H2AuthError);
    expect((caught as H2AuthError).code).toBe("UNKNOWN_OWNER");
  });

  it("requireRecentReauth selže REAUTH_REQUIRED, pokud recent_reauth_at nikdy nebylo nastaveno (AT-64)", async () => {
    await expect(requireRecentReauth(pool, ownerId)).rejects.toThrow(H2ReauthRequiredError);
  });

  it("requireRecentReauth projde do 5 minut po markRecentReauth, pak selže (AT-64)", async () => {
    const reauthAt = new Date("2026-09-02T12:00:00Z");
    await markRecentReauth(pool, ownerId, reauthAt);

    await expect(
      requireRecentReauth(pool, ownerId, new Date("2026-09-02T12:04:59Z")),
    ).resolves.toBeUndefined();

    await expect(
      requireRecentReauth(pool, ownerId, new Date("2026-09-02T12:05:01Z")),
    ).rejects.toThrow(H2ReauthRequiredError);
  });

  it("re-auth po expiraci lze obnovit a pokračovat bez změny zamýšlené akce (§31.2 princip)", async () => {
    await markRecentReauth(pool, ownerId, new Date("2026-09-02T10:00:00Z"));
    await expect(
      requireRecentReauth(pool, ownerId, new Date("2026-09-02T10:10:00Z")),
    ).rejects.toThrow(H2ReauthRequiredError);

    await markRecentReauth(pool, ownerId, new Date("2026-09-02T10:10:30Z"));
    await expect(
      requireRecentReauth(pool, ownerId, new Date("2026-09-02T10:11:00Z")),
    ).resolves.toBeUndefined();
  });
});
