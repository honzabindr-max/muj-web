import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../../db/__tests__/helpers";
import { getThirdPartyEpisodeCandidates } from "../episodes";

const DB_NAME = "h2_test_context_episodes";
const PERSON_A = "11111111-1111-1111-1111-111111111111";
const PERSON_B = "22222222-2222-2222-2222-222222222222";

describe("getThirdPartyEpisodeCandidates() pod rolí h2_runtime (§31.10, BUILD-09 plán Krok 3)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["context-episodes-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function seedEvidence(personId: string, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await adminPool.query("insert into evidence_items (owner_id, person_id, evidence_type) values ($1, $2, 'OBSERVATION')", [
        ownerId,
        personId,
      ]);
    }
  }

  it("AT-66: normal runtime načte nejvýše 2 epizody o jedné třetí osobě, i když jich existuje víc", async () => {
    await seedEvidence(PERSON_A, 5);

    const candidates = await getThirdPartyEpisodeCandidates(runtimePool, ownerId, "BUDDY_RESPONSE");

    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.personId === PERSON_A)).toBe(true);
  });

  it("AT-66: explicit deep-dive může načíst více epizod (max 10), cap zůstává per osobu", async () => {
    await seedEvidence(PERSON_A, 15);

    const candidates = await getThirdPartyEpisodeCandidates(runtimePool, ownerId, "BUDDY_DEEP_DIVE");

    expect(candidates).toHaveLength(10);
  });

  it("cap je per osobu, ne globální — dvě osoby, každá dostane vlastní strop", async () => {
    await seedEvidence(PERSON_A, 5);
    await seedEvidence(PERSON_B, 5);

    const candidates = await getThirdPartyEpisodeCandidates(runtimePool, ownerId, "BUDDY_RESPONSE");

    expect(candidates.filter((c) => c.personId === PERSON_A)).toHaveLength(2);
    expect(candidates.filter((c) => c.personId === PERSON_B)).toHaveLength(2);
  });

  it("AT-24/AT-25/I5: third_party_aggregation_allowed vždy false — jen per-episode kandidáti, žádný agregát, žádný nový claim/mechanism řádek", async () => {
    await seedEvidence(PERSON_A, 15);

    const candidates = await getThirdPartyEpisodeCandidates(runtimePool, ownerId, "BUDDY_DEEP_DIVE");

    // Strukturální I5 záruka: výhradně THIRD_PARTY_EPISODE, nikdy agregát/pattern/summary o osobě.
    expect(candidates.every((c) => c.itemType === "THIRD_PARTY_EPISODE")).toBe(true);
    expect(candidates.every((c) => c.priority === "P3" && c.requiredForAction === true)).toBe(true);

    const claims = await adminPool.query("select count(*)::int as count from claims where owner_id = $1", [ownerId]);
    const mechanisms = await adminPool.query("select count(*)::int as count from mechanisms where owner_id = $1", [ownerId]);
    expect(claims.rows[0].count).toBe(0);
    expect(mechanisms.rows[0].count).toBe(0);
  });

  it("first-person evidence (person_id null) se do third-party výsledku nepočítá", async () => {
    await adminPool.query("insert into evidence_items (owner_id, person_id, evidence_type) values ($1, null, 'SELF_REPORT')", [
      ownerId,
    ]);

    const candidates = await getThirdPartyEpisodeCandidates(runtimePool, ownerId, "BUDDY_RESPONSE");
    expect(candidates).toEqual([]);
  });
});
