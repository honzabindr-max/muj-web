import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { applyStateMutation, getRecentEvents, getStatesForUser } from "../state/repository";
import { createTestDatabase, dropTestDatabase, insertTestUser } from "./helpers";

describe("state/repository — serverový zápis, konkurence, historie (zadání bod 3.2)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await createTestDatabase("sam_byt_test_repository");
  });

  afterEach(async () => {
    await pool.query(
      "truncate table sam_byt_decision_events, sam_byt_user_listing_state, sam_byt_sessions, sam_byt_login_attempts, sam_byt_users restart identity cascade",
    );
  });

  afterAll(async () => {
    await dropTestDatabase(pool, "sam_byt_test_repository");
  });

  it("první mutace na neexistujícím řádku (expectedVersion=0) vytvoří stav a přetrvá po reloadu", async () => {
    const userId = await insertTestUser(pool, "sam");

    const result = await applyStateMutation(pool, userId, "sam", "sam-01", { favorite: true }, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.favorite).toBe(true);
    expect(result.state.version).toBe(1);

    // "reload" — nezávislé čtení ze stejné DB
    const reloaded = await getStatesForUser(pool, userId, "sam");
    expect(reloaded.get("sam-01")?.favorite).toBe(true);
  });

  it("nastavení decision='reject' vynutí favorite=false (nejednoznačný stav nesmí nastat)", async () => {
    const userId = await insertTestUser(pool, "sam");
    await applyStateMutation(pool, userId, "sam", "sam-02", { favorite: true }, 0);
    const rejected = await applyStateMutation(pool, userId, "sam", "sam-02", { decision: "reject" }, 1);
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.state.decision).toBe("reject");
    expect(rejected.state.favorite).toBe(false);
  });

  it("favoritování dřív odmítnutého bytu ho automaticky vrátí z 'reject' na 'maybe'", async () => {
    const userId = await insertTestUser(pool, "sam");
    await applyStateMutation(pool, userId, "sam", "sam-03", { decision: "reject" }, 0);
    const favored = await applyStateMutation(pool, userId, "sam", "sam-03", { favorite: true }, 1);
    expect(favored.ok).toBe(true);
    if (!favored.ok) return;
    expect(favored.state.favorite).toBe(true);
    expect(favored.state.decision).toBe("maybe");
  });

  it("souběžná úprava se starou verzí vrátí version_conflict a NEPŘEPÍŠE cizí zápis", async () => {
    const userId = await insertTestUser(pool, "sam");
    const first = await applyStateMutation(pool, userId, "sam", "sam-04", { notes: "první" }, 0);
    expect(first.ok).toBe(true);

    // Druhý klient pořád zná starou verzi (0) — simulace dvou souběžných úprav.
    const stale = await applyStateMutation(pool, userId, "sam", "sam-04", { notes: "zastaralé" }, 0);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.reason).toBe("version_conflict");
    expect(stale.current.notes).toBe("první");

    const fresh = await getStatesForUser(pool, userId, "sam");
    expect(fresh.get("sam-04")?.notes).toBe("první");
  });

  it("opakované PATCH se stejnou hodnotou (retry po chybě) je idempotentní na obsah, i když verze roste", async () => {
    const userId = await insertTestUser(pool, "sam");
    const first = await applyStateMutation(pool, userId, "sam", "sam-05", { notes: "text" }, 0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const retry = await applyStateMutation(pool, userId, "sam", "sam-05", { notes: "text" }, first.state.version);
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.state.notes).toBe("text");
  });

  it("changed fields se zapisují do decision_events, beze změny se nezapisuje nic navíc", async () => {
    const userId = await insertTestUser(pool, "sam");
    await applyStateMutation(pool, userId, "sam", "sam-06", { favorite: true, ratingPrice: 4 }, 0);
    const events = await getRecentEvents(pool, 10);
    const fields = events.filter((e) => e.listingId === "sam-06").map((e) => e.field);
    expect(fields).toContain("favorite");
    expect(fields).toContain("rating_price");
    expect(fields).not.toContain("decision");
  });

  it("neplatné hodnocení mimo 1-5 odmítne DB CHECK constraint", async () => {
    const userId = await insertTestUser(pool, "sam");
    await expect(
      pool.query(
        "insert into sam_byt_user_listing_state (user_id, listing_id, rating_price) values ($1, 'sam-07', 9)",
        [userId],
      ),
    ).rejects.toThrow();
  });

  it("dva uživatelé mají oddělený stav pro stejný byt (Honzíkův favorit nepřepíše Samův)", async () => {
    const samId = await insertTestUser(pool, "sam");
    const honzikId = await insertTestUser(pool, "honzik");
    await applyStateMutation(pool, samId, "sam", "sam-08", { decision: "want_viewing" }, 0);
    await applyStateMutation(pool, honzikId, "honzik", "sam-08", { decision: "reject" }, 0);

    const samState = await getStatesForUser(pool, samId, "sam");
    const honzikState = await getStatesForUser(pool, honzikId, "honzik");
    expect(samState.get("sam-08")?.decision).toBe("want_viewing");
    expect(honzikState.get("sam-08")?.decision).toBe("reject");
  });
});
