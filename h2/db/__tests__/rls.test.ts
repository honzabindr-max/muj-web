import type { Pool, PoolClient } from "pg";
import { Pool as PgPool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "./helpers";

const DB_NAME = "h2_test_rls";

async function withOwnerScope<T>(client: PoolClient, ownerId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query("select set_config('app.owner_id', $1, true)", [ownerId]);
    const result = await fn();
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describe("h2-runtime — Row Level Security (§31.5)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let jobPool: Pool;
  let blindReaderPool: Pool;
  let ownerAId: string;
  let ownerBId: string;

  beforeAll(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    // Test-only: LOGIN+password se v produkci nastavuje na úrovni Neon
    // credentials, portable migrace ho záměrně negrantuje (viz
    // 0011_roles_and_rls.sql). Heslo je nutné i lokálně-vypadajícím
    // spojením v CI (Postgres service container = síťové spojení, ne
    // unix socket trust auth).
    await adminPool.query(`alter role h2_runtime login password '${TEST_ROLE_PASSWORD}'`);
    await adminPool.query(`alter role h2_job login password '${TEST_ROLE_PASSWORD}'`);
    await adminPool.query(`alter role h2_blind_reader login password '${TEST_ROLE_PASSWORD}'`);

    const ownerA = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["owner-a-sub", "Owner A"],
    );
    const ownerB = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["owner-b-sub", "Owner B"],
    );
    ownerAId = ownerA.rows[0].id;
    ownerBId = ownerB.rows[0].id;

    await adminPool.query(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)`,
      [ownerAId],
    );
    await adminPool.query(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)`,
      [ownerBId],
    );

    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });
    jobPool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_job", password: TEST_ROLE_PASSWORD }),
    });
    blindReaderPool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, {
        username: "h2_blind_reader",
        password: TEST_ROLE_PASSWORD,
      }),
    });
  }, 30_000);

  afterAll(async () => {
    await runtimePool?.end();
    await jobPool?.end();
    await blindReaderPool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("h2_runtime se SET LOCAL app.owner_id vidí jen vlastní owner data (I4)", async () => {
    const client = await runtimePool.connect();
    try {
      const rows = await withOwnerScope(client, ownerAId, async () => {
        const result = await client.query("select owner_id from raw_events");
        return result.rows;
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].owner_id).toBe(ownerAId);
    } finally {
      client.release();
    }
  });

  it("h2_runtime bez nastaveného app.owner_id nevidí žádná data (fail closed, ne fail open)", async () => {
    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      const result = await client.query("select owner_id from raw_events");
      expect(result.rows).toHaveLength(0);
      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  it("h2_runtime nesmí INSERTnout řádek s cizím owner_id, i když má vlastní app.owner_id nastavené (WITH CHECK)", async () => {
    const client = await runtimePool.connect();
    try {
      await expect(
        withOwnerScope(client, ownerAId, async () => {
          await client.query(
            `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
             values ($1, 99, 99, 'telegram', 'USER', '\\x00', 'TEXT', 1)`,
            [ownerBId],
          );
        }),
      ).rejects.toThrow(/row-level security/);
    } finally {
      client.release();
    }
  });

  it("h2_blind_reader vidí raw_events jen v rámci nastaveného owner_id (§6.3 defense-in-depth)", async () => {
    const client = await blindReaderPool.connect();
    try {
      const rows = await withOwnerScope(client, ownerAId, async () => {
        const result = await client.query("select owner_id from raw_events");
        return result.rows;
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].owner_id).toBe(ownerAId);
    } finally {
      client.release();
    }
  });

  it("h2_blind_reader nemá žádný přístup ke claims (bez claims/reviews per §31.5)", async () => {
    const client = await blindReaderPool.connect();
    try {
      await expect(client.query("select * from claims")).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  it("h2_job smí pracovat s job_definitions/job_runs, ale nemá přístup ke claims", async () => {
    const client = await jobPool.connect();
    try {
      await expect(client.query("select * from job_definitions")).resolves.toBeDefined();
      await expect(client.query("select * from claims")).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  it("h2_runtime nemá přístup k DDL (bez CREATE/DROP práva) — role bez DDL per §31.5", async () => {
    const client = await runtimePool.connect();
    try {
      await expect(client.query("create table h2_runtime_should_not_ddl (id int)")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      client.release();
    }
  });
});
