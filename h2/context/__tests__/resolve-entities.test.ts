import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { resolveMessageEntities } from "../resolve-entities";

const DB_NAME = "h2_test_resolve_entities";

describe("resolveMessageEntities() pod rolí h2_runtime (BUILD-09 plán Krok 2, Rozhodnutí 1)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;
  let rawEventId: string;
  let llmRunId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["resolve-entities-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    const rawEvent = await adminPool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)
       returning id`,
      [ownerId],
    );
    rawEventId = rawEvent.rows[0].id;

    const llmRun = await adminPool.query<{ id: string }>(
      "insert into llm_runs (owner_id, purpose, model_id, status) values ($1, 'OPERATIONAL_EXTRACTION', 'claude-haiku-4-5-20251001', 'OK') returning id",
      [ownerId],
    );
    llmRunId = llmRun.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function seedExtraction(output: unknown, status: "OK" | "INVALID" = "OK"): Promise<void> {
    await adminPool.query(
      `insert into operational_extractions (owner_id, raw_event_id, llm_run_id, extractor_version, output, status)
       values ($1, $2, $3, '1', $4, $5)`,
      [ownerId, rawEventId, llmRunId, JSON.stringify(output), status],
    );
  }

  it("mapuje ENTITY kandidáty na ResolvedEntity[] a ignoruje ostatní typy", async () => {
    await seedExtraction({
      candidates: [
        { type: "ENTITY", payload: { name: "Ranní běhání", refType: "EXPERIMENT" } },
        { type: "TASK", payload: { name: "Koupit mléko" } },
      ],
    });

    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);

    expect(entities).toEqual([{ refType: "EXPERIMENT", label: "Ranní běhání" }]);
  });

  it("žádná extrakce pro raw_event → prázdný seznam", async () => {
    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);
    expect(entities).toEqual([]);
  });

  it("ignoruje INVALID extrakce, čte jen status='OK'", async () => {
    await seedExtraction({ raw: "malformed" }, "INVALID");

    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);
    expect(entities).toEqual([]);
  });

  it("chybějící label field → ENTITY kandidát se přeskočí", async () => {
    await seedExtraction({ candidates: [{ type: "ENTITY", payload: { confidence: 0.9 } }] });

    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);
    expect(entities).toEqual([]);
  });

  it("bez refType/entityType v payloadu → refType defaultuje na UNKNOWN", async () => {
    await seedExtraction({ candidates: [{ type: "ENTITY", payload: { label: "Markétka" } }] });

    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);
    expect(entities).toEqual([{ refType: "UNKNOWN", label: "Markétka" }]);
  });

  it("čte nejnovější OK extrakci, pokud jich pro stejný raw_event existuje víc", async () => {
    await seedExtraction({ candidates: [{ type: "ENTITY", payload: { name: "Stará entita" } }] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await seedExtraction({ candidates: [{ type: "ENTITY", payload: { name: "Nová entita" } }] });

    const entities = await resolveMessageEntities(runtimePool, ownerId, rawEventId);
    expect(entities).toEqual([{ refType: "UNKNOWN", label: "Nová entita" }]);
  });
});
