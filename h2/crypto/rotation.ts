import type { Pool } from "pg";

import { decryptPayload, encryptPayload } from "./envelope";
import type { EncryptionKeyRegistry } from "./keys";

/**
 * Resumable batch re-encryption (§24 key rotation flow: CREATE NEW KEY →
 * NEW WRITES USE NEW KEY → BATCH RE-ENCRYPT OLD ROWS → VERIFY → RETIRE OLD
 * KEY; AT-41/AT-42). `config` je vždy hardcoded konstanta v kódu volajícího
 * modulu, NIKDY z externího vstupu — table/column names se interpolují do
 * SQL bez parametrizace, protože nejde o uživatelský vstup.
 */
export type RotationTableConfig = {
  tableName: string;
  idColumn: string;
  payloadColumn: string;
  keyVersionColumn: string;
};

export type RotationProgress = {
  rowsMigrated: number;
};

/**
 * Idempotentní a resumable: každá dávka cílí WHERE keyVersionColumn =
 * fromVersion, takže crash uprostřed jen znamená, že příští spuštění
 * pokračuje na zbývajících starých řádcích (AT-42) — žádný stav mimo DB.
 * Mezi dávkami zůstávají mixed v_old/v_new řádky čitelné (AT-41), protože
 * registry během celé rotace drží oba klíče.
 */
export async function rotateTableKeyVersion(
  pool: Pool,
  config: RotationTableConfig,
  fromVersion: number,
  registry: EncryptionKeyRegistry,
  batchSize = 500,
): Promise<RotationProgress> {
  if (registry.activeVersion === fromVersion) {
    throw new Error(
      "H2 crypto: rotace vyžaduje, aby registry.activeVersion byl už nová cílová verze, ne fromVersion",
    );
  }
  if (!registry.keys.has(fromVersion)) {
    throw new Error(`H2 crypto: stará key version ${fromVersion} musí zůstat v registru, dokud rotace neskončí`);
  }

  let rowsMigrated = 0;
  for (;;) {
    const migratedInBatch = await migrateOneBatch(pool, config, fromVersion, registry, batchSize);
    if (migratedInBatch === 0) break;
    rowsMigrated += migratedInBatch;
  }
  return { rowsMigrated };
}

async function migrateOneBatch(
  pool: Pool,
  config: RotationTableConfig,
  fromVersion: number,
  registry: EncryptionKeyRegistry,
  batchSize: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const selectSql = `select ${config.idColumn} as id, ${config.payloadColumn} as payload
      from ${config.tableName}
      where ${config.keyVersionColumn} = $1
      order by ${config.idColumn}
      limit $2
      for update skip locked`;
    const result = await client.query<{ id: string; payload: Buffer }>(selectSql, [fromVersion, batchSize]);

    for (const row of result.rows) {
      const plaintext = decryptPayload(row.payload, fromVersion, registry);
      const { ciphertext, keyVersion } = encryptPayload(plaintext, registry);
      const updateSql = `update ${config.tableName}
        set ${config.payloadColumn} = $1, ${config.keyVersionColumn} = $2
        where ${config.idColumn} = $3 and ${config.keyVersionColumn} = $4`;
      await client.query(updateSql, [ciphertext, keyVersion, row.id, fromVersion]);
    }

    await client.query("commit");
    return result.rows.length;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** §24 "VERIFY COUNTS + SAMPLE DECRYPT" — před retire staré verze klíče. */
export async function verifyRotationSample(
  pool: Pool,
  config: RotationTableConfig,
  keyVersion: number,
  registry: EncryptionKeyRegistry,
  sampleSize = 20,
): Promise<{ sampled: number; allDecrypted: boolean }> {
  const client = await pool.connect();
  try {
    const sql = `select ${config.payloadColumn} as payload
      from ${config.tableName}
      where ${config.keyVersionColumn} = $1
      order by random()
      limit $2`;
    const result = await client.query<{ payload: Buffer }>(sql, [keyVersion, sampleSize]);
    let allDecrypted = true;
    for (const row of result.rows) {
      try {
        decryptPayload(row.payload, keyVersion, registry);
      } catch {
        allDecrypted = false;
        break;
      }
    }
    return { sampled: result.rows.length, allDecrypted };
  } finally {
    client.release();
  }
}

export async function countRowsWithKeyVersion(
  pool: Pool,
  config: RotationTableConfig,
  keyVersion: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    const sql = `select count(*)::int as n from ${config.tableName} where ${config.keyVersionColumn} = $1`;
    const result = await client.query<{ n: number }>(sql, [keyVersion]);
    return result.rows[0].n;
  } finally {
    client.release();
  }
}
