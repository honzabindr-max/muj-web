import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestConnectionString, createControlTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "./helpers";

const DB_NAME = "h2_test_control";

describe("h2-control — deletion_ledger append-only hash chain (§23.1)", () => {
  let adminPool: Pool;
  let controlPool: Pool;

  beforeAll(async () => {
    adminPool = await createControlTestDatabase(DB_NAME);
    // Heslo pro h2_control nastavuje jednou globalSetup (ensure-test-roles.ts),
    // ne tento soubor — viz BUILD-04 poznámka v rls.test.ts.
    controlPool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_control", password: TEST_ROLE_PASSWORD }),
    });

    await adminPool.query(
      `insert into deletion_ledger
         (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash)
       values (gen_random_uuid(), 'GENESIS', gen_random_uuid(), 0, 1, '\\x00')`,
    );
  }, 30_000);

  afterAll(async () => {
    await controlPool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("GENESIS musí mít manifest_version = 0", async () => {
    await expect(
      adminPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash)
         values (gen_random_uuid(), 'GENESIS', gen_random_uuid(), 5, 1, '\\x00')`,
      ),
    ).rejects.toThrow(/deletion_ledger_genesis_manifest_zero|deletion_ledger_single_genesis/);
  });

  it("nejvýše jeden GENESIS záznam v celém ledgeru", async () => {
    // deletion_ledger_genesis_manifest_zero nutí každý GENESIS na
    // manifest_version=0, což ho zezávisle na unique(manifest_version) i na
    // partial unique indexu deletion_ledger_single_genesis dělá fakticky
    // neopakovatelným — libovolný z těchto dvou constraintů může zafungovat
    // první, test proto ověřuje jen že insert je odmítnutý, ne který z nich.
    await expect(
      adminPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash)
         values (gen_random_uuid(), 'GENESIS', gen_random_uuid(), 0, 1, '\\x00')`,
      ),
    ).rejects.toThrow(/deletion_ledger_single_genesis|unique constraint/);
  });

  it("DELETE_INTENT musí mít previous_record_hash (jen GENESIS smí být NULL)", async () => {
    await expect(
      adminPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash)
         values (gen_random_uuid(), 'DELETE_INTENT', gen_random_uuid(), 1, 1, '\\x00')`,
      ),
    ).rejects.toThrow(/deletion_ledger_previous_hash_presence/);
  });

  it("stejné deletion_id smí mít nejvýše jeden DELETE_INTENT — druhý intent selže", async () => {
    const deletionId = "11111111-1111-1111-1111-111111111111";
    await adminPool.query(
      `insert into deletion_ledger
         (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash, previous_record_hash)
       values ($1, 'DELETE_INTENT', gen_random_uuid(), 2, 1, '\\x01', '\\x00')`,
      [deletionId],
    );
    await expect(
      adminPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash, previous_record_hash)
         values ($1, 'DELETE_INTENT', gen_random_uuid(), 3, 1, '\\x02', '\\x01')`,
        [deletionId],
      ),
    ).rejects.toThrow(/deletion_ledger_deletion_id_record_type_unique/);

    // Ale DELETE_APPLIED se stejným deletion_id je v pořádku — je to
    // pokračování téhož logického výmazu, ne duplicitní intent (§23.1).
    await expect(
      adminPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash, previous_record_hash)
         values ($1, 'DELETE_APPLIED', gen_random_uuid(), 4, 1, '\\x03', '\\x02')`,
        [deletionId],
      ),
    ).resolves.toBeDefined();
  });

  it("h2_control role je append-only: SELECT a INSERT ano, UPDATE a DELETE ne", async () => {
    await expect(controlPool.query("select * from deletion_ledger")).resolves.toBeDefined();
    await expect(
      controlPool.query(
        `insert into deletion_ledger
           (deletion_id, record_type, owner_id, manifest_version, hmac_key_version, record_hash, previous_record_hash)
         values (gen_random_uuid(), 'DELETE_INTENT', gen_random_uuid(), 10, 1, '\\x09', '\\x00')`,
      ),
    ).resolves.toBeDefined();
    await expect(
      controlPool.query("update deletion_ledger set hmac_key_version = 2 where record_type = 'GENESIS'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      controlPool.query("delete from deletion_ledger where record_type = 'GENESIS'"),
    ).rejects.toThrow(/permission denied/);
  });
});
