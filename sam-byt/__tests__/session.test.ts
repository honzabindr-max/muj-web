import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createSession, destroySession, verifySessionToken } from "../auth/session";
import { createTestDatabase, dropTestDatabase, insertTestUser } from "./helpers";

describe("session (HttpOnly cookie backend)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await createTestDatabase("sam_byt_test_session");
  });

  afterEach(async () => {
    await pool.query(
      "truncate table sam_byt_decision_events, sam_byt_user_listing_state, sam_byt_sessions, sam_byt_login_attempts, sam_byt_users restart identity cascade",
    );
  });

  afterAll(async () => {
    await dropTestDatabase(pool, "sam_byt_test_session");
  });

  it("vytvořená session se ověří a nese správného uživatele", async () => {
    const userId = await insertTestUser(pool, "sam");
    const { token } = await createSession(pool, userId, "vitest");
    const verified = await verifySessionToken(pool, token);
    expect(verified?.userId).toBe(userId);
    expect(verified?.username).toBe("sam");
  });

  it("neplatný/neexistující token se neověří", async () => {
    expect(await verifySessionToken(pool, "not-a-real-token")).toBeNull();
    expect(await verifySessionToken(pool, undefined)).toBeNull();
  });

  it("po destroySession se token přestane ověřovat (odhlášení funguje)", async () => {
    const userId = await insertTestUser(pool, "sam");
    const { token } = await createSession(pool, userId, "vitest");
    await destroySession(pool, token);
    expect(await verifySessionToken(pool, token)).toBeNull();
  });

  it("dva uživatelé mají naprosto oddělené sessions (žádné sdílené identity)", async () => {
    const samId = await insertTestUser(pool, "sam");
    const honzikId = await insertTestUser(pool, "honzik");
    const samSession = await createSession(pool, samId, "vitest");
    const honzikSession = await createSession(pool, honzikId, "vitest");
    const samVerified = await verifySessionToken(pool, samSession.token);
    const honzikVerified = await verifySessionToken(pool, honzikSession.token);
    expect(samVerified?.username).toBe("sam");
    expect(honzikVerified?.username).toBe("honzik");
    expect(await verifySessionToken(pool, honzikSession.token)).not.toEqual(samVerified);
  });
});
