import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRuntimeTestDatabase, dropTestDatabase } from "../../db/__tests__/helpers";
import { decryptPayload, encryptPayload } from "../envelope";
import type { EncryptionKeyRegistry } from "../keys";
import { countRowsWithKeyVersion, rotateTableKeyVersion, verifyRotationSample } from "../rotation";

const DB_NAME = "h2_test_rotation";
const KEY_V1 = Buffer.alloc(32, 1);
const KEY_V2 = Buffer.alloc(32, 2);

const RAW_EVENTS_CONFIG = {
  tableName: "raw_events",
  idColumn: "id",
  payloadColumn: "payload_ciphertext",
  keyVersionColumn: "encryption_key_version",
};

describe("key rotation proti reálné Postgres (AT-41, AT-42)", () => {
  let pool: Pool;
  let ownerId: string;

  beforeAll(async () => {
    pool = await createRuntimeTestDatabase(DB_NAME);
    const owner = await pool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["rotation-test-owner", "Rotation Test"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await dropTestDatabase(pool, DB_NAME);
  });

  it("AT-41: mixed v1/v2 rows jsou čitelné během rotace a všechny skončí na v2 se správným plaintextem", async () => {
    const registryV1 = { activeVersion: 1, keys: new Map([[1, KEY_V1]]) } as EncryptionKeyRegistry;
    const plaintexts = ["zpráva jedna", "zpráva dvě", "zpráva tři", "zpráva čtyři", "zpráva pět"];

    for (let i = 0; i < plaintexts.length; i += 1) {
      const { ciphertext, keyVersion } = encryptPayload(Buffer.from(plaintexts[i], "utf8"), registryV1);
      await pool.query(
        `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
         values ($1, $2, $2, 'telegram', 'USER', $3, 'TEXT', $4)`,
        [ownerId, 100 + i, ciphertext, keyVersion],
      );
    }

    const registryDuringRotation: EncryptionKeyRegistry = {
      activeVersion: 2,
      keys: new Map([
        [1, KEY_V1],
        [2, KEY_V2],
      ]),
    };

    const progress = await rotateTableKeyVersion(pool, RAW_EVENTS_CONFIG, 1, registryDuringRotation, 2);
    expect(progress.rowsMigrated).toBe(plaintexts.length);

    const remainingV1 = await countRowsWithKeyVersion(pool, RAW_EVENTS_CONFIG, 1);
    expect(remainingV1).toBe(0);

    const rows = await pool.query<{ payload_ciphertext: Buffer; encryption_key_version: number }>(
      "select payload_ciphertext, encryption_key_version from raw_events where owner_id = $1 order by conversation_sequence",
      [ownerId],
    );
    expect(rows.rows).toHaveLength(plaintexts.length);
    for (let i = 0; i < rows.rows.length; i += 1) {
      expect(rows.rows[i].encryption_key_version).toBe(2);
      const decrypted = decryptPayload(rows.rows[i].payload_ciphertext, 2, registryDuringRotation);
      expect(decrypted.toString("utf8")).toBe(plaintexts[i]);
    }

    const sample = await verifyRotationSample(pool, RAW_EVENTS_CONFIG, 2, registryDuringRotation, 10);
    expect(sample.allDecrypted).toBe(true);
    expect(sample.sampled).toBe(plaintexts.length);
  });

  it("AT-42: rotace pokračuje tam, kde 'předchozí běh havaroval' — už migrované řádky nechá být, zbytek dokončí", async () => {
    const registryV1 = { activeVersion: 1, keys: new Map([[1, KEY_V1]]) } as EncryptionKeyRegistry;
    const plaintexts = ["A", "B", "C", "D"];
    const insertedIds: string[] = [];

    for (let i = 0; i < plaintexts.length; i += 1) {
      const { ciphertext, keyVersion } = encryptPayload(Buffer.from(plaintexts[i], "utf8"), registryV1);
      const inserted = await pool.query<{ id: string }>(
        `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
         values ($1, $2, $2, 'telegram', 'USER', $3, 'TEXT', $4) returning id`,
        [ownerId, 200 + i, ciphertext, keyVersion],
      );
      insertedIds.push(inserted.rows[0].id);
    }

    const registryDuringRotation: EncryptionKeyRegistry = {
      activeVersion: 2,
      keys: new Map([
        [1, KEY_V1],
        [2, KEY_V2],
      ]),
    };

    // Simuluje, že "předchozí běh" stihl přešifrovat jen první dva řádky
    // před crashem — ručně je posuneme na v2 a zbytek necháme na v1.
    for (const id of insertedIds.slice(0, 2)) {
      const original = await pool.query<{ payload_ciphertext: Buffer }>(
        "select payload_ciphertext from raw_events where id = $1",
        [id],
      );
      const plaintext = decryptPayload(original.rows[0].payload_ciphertext, 1, registryDuringRotation);
      const reEncrypted = encryptPayload(plaintext, registryDuringRotation);
      await pool.query("update raw_events set payload_ciphertext = $1, encryption_key_version = $2 where id = $3", [
        reEncrypted.ciphertext,
        reEncrypted.keyVersion,
        id,
      ]);
    }

    // "Resumed" běh — musí dokončit jen zbývající dva v1 řádky, ne
    // duplikovat práci na už migrovaných.
    const progress = await rotateTableKeyVersion(pool, RAW_EVENTS_CONFIG, 1, registryDuringRotation, 10);
    expect(progress.rowsMigrated).toBe(2);

    const remainingV1 = await pool.query<{ n: string }>(
      "select count(*)::text as n from raw_events where id = any($1) and encryption_key_version = 1",
      [insertedIds],
    );
    expect(Number(remainingV1.rows[0].n)).toBe(0);

    const finalRows = await pool.query<{ id: string; payload_ciphertext: Buffer }>(
      "select id, payload_ciphertext from raw_events where id = any($1) order by conversation_sequence",
      [insertedIds],
    );
    for (let i = 0; i < finalRows.rows.length; i += 1) {
      const decrypted = decryptPayload(finalRows.rows[i].payload_ciphertext, 2, registryDuringRotation);
      expect(decrypted.toString("utf8")).toBe(plaintexts[i]);
    }
  });
});
