import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../../db/__tests__/helpers";
import { getKnowledgeCandidates } from "../knowledge";

const DB_NAME = "h2_test_context_knowledge";

describe("getKnowledgeCandidates() pod rolí h2_runtime (§7.4 P1/P2, BUILD-09 plán Krok 3)", () => {
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
      ["context-knowledge-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("HYPOTEZA claim → isHypothesis: true (AT-23 zdroj), validovaný claim → isHypothesis: false", async () => {
    await adminPool.query("insert into claims (owner_id, statement, state) values ($1, 'Ranní běh mě nabíjí', 'HYPOTEZA')", [
      ownerId,
    ]);
    await adminPool.query("insert into claims (owner_id, statement, state) values ($1, 'Spím líp bez kofeinu', 'VALIDOVANO')", [
      ownerId,
    ]);

    const candidates = await getKnowledgeCandidates(runtimePool, ownerId);
    const hypothesis = candidates.find((c) => c.matchLabel === "Ranní běh mě nabíjí");
    const validated = candidates.find((c) => c.matchLabel === "Spím líp bez kofeinu");

    expect(hypothesis?.isHypothesis).toBe(true);
    expect(validated?.isHypothesis).toBe(false);
    for (const c of [hypothesis, validated]) {
      expect(c?.itemType).toBe("CLAIM");
      expect(c?.priority).toBe("P2");
    }
  });

  it("mechanisms → P2 kandidáti bez isHypothesis", async () => {
    await adminPool.query("insert into mechanisms (owner_id, statement) values ($1, 'Když nespím, jsem podrážděný')", [ownerId]);

    const candidates = await getKnowledgeCandidates(runtimePool, ownerId);
    const mechanism = candidates.find((c) => c.itemType === "MECHANISM");

    expect(mechanism).toMatchObject({ priority: "P2", matchLabel: "Když nespím, jsem podrážděný" });
    expect(mechanism?.isHypothesis).toBeUndefined();
  });

  it("AT-22 zdroj: experiments → P1 kandidáti s matchLabel=question, CANCELLED se vynechá", async () => {
    await adminPool.query("insert into experiments (owner_id, question) values ($1, 'Pomáhá mi ranní běhání?')", [ownerId]);
    await adminPool.query(
      "insert into experiments (owner_id, question, status) values ($1, 'Zrušený experiment', 'CANCELLED')",
      [ownerId],
    );

    const candidates = await getKnowledgeCandidates(runtimePool, ownerId);
    const experiments = candidates.filter((c) => c.itemType === "EXPERIMENT");

    expect(experiments).toHaveLength(1);
    expect(experiments[0]).toMatchObject({ priority: "P1", matchLabel: "Pomáhá mi ranní běhání?" });
  });

  it("bez žádných řádků → prázdný seznam (produkce před BUILD-16/17)", async () => {
    const candidates = await getKnowledgeCandidates(runtimePool, ownerId);
    expect(candidates).toEqual([]);
  });
});
