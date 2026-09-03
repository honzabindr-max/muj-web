import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../../db/__tests__/helpers";
import { getExecutiveCandidates } from "../executive";

const DB_NAME = "h2_test_context_executive";

describe("getExecutiveCandidates() pod rolí h2_runtime (§7.4 P1, BUILD-09 plán Krok 3)", () => {
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
      ["context-executive-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("vrátí jen aktivní řádky s matchLabel z name/statement/title, ignoruje neaktivní", async () => {
    await adminPool.query("insert into projects (owner_id, name, status) values ($1, 'Renovace bytu', 'ACTIVE')", [ownerId]);
    await adminPool.query("insert into projects (owner_id, name, status) values ($1, 'Starý projekt', 'DROPPED')", [ownerId]);

    await adminPool.query(
      "insert into commitments (owner_id, statement, created_by_user, status) values ($1, 'Cvičit 3x týdně', true, 'ACTIVE')",
      [ownerId],
    );
    await adminPool.query(
      "insert into commitments (owner_id, statement, created_by_user, status) values ($1, 'Expirovaný závazek', true, 'EXPIRED')",
      [ownerId],
    );

    const openTask = await adminPool.query<{ id: string }>(
      "insert into tasks (owner_id, title, status) values ($1, 'Koupit mléko', 'OPEN') returning id",
      [ownerId],
    );
    await adminPool.query("insert into tasks (owner_id, title, status) values ($1, 'Hotový úkol', 'DONE')", [ownerId]);

    await adminPool.query(
      "insert into open_loops (owner_id, loop_type, title, status) values ($1, 'IDEA', 'Nápad na výlet', 'OPEN')",
      [ownerId],
    );
    await adminPool.query(
      "insert into open_loops (owner_id, loop_type, title, status) values ($1, 'IDEA', 'Zahozený nápad', 'DROPPED')",
      [ownerId],
    );

    await adminPool.query("insert into reminders (owner_id, task_id, remind_at, status) values ($1, $2, now(), 'PENDING')", [
      ownerId,
      openTask.rows[0].id,
    ]);
    await adminPool.query("insert into reminders (owner_id, task_id, remind_at, status) values ($1, $2, now(), 'DISMISSED')", [
      ownerId,
      openTask.rows[0].id,
    ]);

    const candidates = await getExecutiveCandidates(runtimePool, ownerId);
    const byType = (t: string) => candidates.filter((c) => c.itemType === t);

    expect(byType("PROJECT")).toHaveLength(1);
    expect(byType("PROJECT")[0].matchLabel).toBe("Renovace bytu");
    expect(byType("COMMITMENT")).toHaveLength(1);
    expect(byType("COMMITMENT")[0].matchLabel).toBe("Cvičit 3x týdně");
    expect(byType("TASK")).toHaveLength(1);
    expect(byType("TASK")[0].matchLabel).toBe("Koupit mléko");
    expect(byType("OPEN_LOOP")).toHaveLength(1);
    expect(byType("OPEN_LOOP")[0].matchLabel).toBe("Nápad na výlet");
    expect(byType("REMINDER")).toHaveLength(1);
    expect(byType("REMINDER")[0].matchLabel).toBe("Koupit mléko");

    for (const candidate of candidates) {
      expect(candidate.priority).toBe("P1");
    }
  });

  it("bez žádných řádků → prázdný seznam (produkce před BUILD-12)", async () => {
    const candidates = await getExecutiveCandidates(runtimePool, ownerId);
    expect(candidates).toEqual([]);
  });
});
