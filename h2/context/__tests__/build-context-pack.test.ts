import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { buildContextPack } from "../build-context-pack";
import { H2ContextBudgetError } from "../errors";

const DB_NAME = "h2_test_build_context_pack";
const THIRD_PARTY_ID = "44444444-4444-4444-4444-444444444444";

/**
 * End-to-end `buildContextPack()` testy — uzavírá DoD celého BUILD-09
 * (AT-21, AT-22, AT-23, AT-24, AT-25, AT-58, AT-66 přes celý pipeline,
 * ne jen izolované jednotky z Kroků 1-3) + context manifest snapshot
 * test (Build Specification §2 BUILD-09 DoD).
 */
describe("buildContextPack() pod rolí h2_runtime (BUILD-09 plán Krok 4 — DoD)", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;
  let rawEventId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["build-context-pack-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    const rawEvent = await adminPool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', '\\x00', 'TEXT', 1)
       returning id`,
      [ownerId],
    );
    rawEventId = rawEvent.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function seedEntityExtraction(entities: Array<{ name: string; refType?: string }>): Promise<void> {
    const llmRun = await adminPool.query<{ id: string }>(
      "insert into llm_runs (owner_id, purpose, model_id, status) values ($1, 'OPERATIONAL_EXTRACTION', 'claude-haiku-4-5-20251001', 'OK') returning id",
      [ownerId],
    );
    const candidates = entities.map((e) => ({ type: "ENTITY", payload: { name: e.name, refType: e.refType } }));
    await adminPool.query(
      `insert into operational_extractions (owner_id, raw_event_id, llm_run_id, extractor_version, output, status)
       values ($1, $2, $3, '1', $4, 'OK')`,
      [ownerId, rawEventId, llmRun.rows[0].id, JSON.stringify({ candidates })],
    );
  }

  it("AT-21: čistá emoční zpráva bez project entity → manifest obsahuje jen P0 current message", async () => {
    await adminPool.query("insert into projects (owner_id, name, status) values ($1, 'Nesouvisející projekt', 'ACTIVE')", [
      ownerId,
    ]);

    const manifest = await buildContextPack(runtimePool, ownerId, "BUDDY_RESPONSE", rawEventId, "Dneska mi je smutno.");

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0]).toMatchObject({ itemType: "CURRENT_MESSAGE", priority: "P0" });
  });

  it("AT-22: zpráva explicitně zmiňuje experiment → relevantní experiment context je dostupný", async () => {
    await adminPool.query("insert into experiments (owner_id, question) values ($1, 'Pomáhá mi ranní běhání?')", [ownerId]);
    await seedEntityExtraction([{ name: "Pomáhá mi ranní běhání?", refType: "EXPERIMENT" }]);

    const manifest = await buildContextPack(runtimePool, ownerId, "BUDDY_RESPONSE", rawEventId, "Zase jsem dneska běhal.");

    const experimentItem = manifest.items.find((i) => i.itemType === "EXPERIMENT");
    expect(experimentItem).toBeDefined();
    expect(experimentItem?.priority).toBe("P1");
  });

  it("AT-23: hypotéza se bez explicitního deep-dive nedostane do běžného runtime, s deep-dive ano", async () => {
    await adminPool.query("insert into claims (owner_id, statement, state) values ($1, 'Ranní běh mě nabíjí', 'HYPOTEZA')", [
      ownerId,
    ]);
    await seedEntityExtraction([{ name: "Ranní běh mě nabíjí" }]);

    const normal = await buildContextPack(runtimePool, ownerId, "BUDDY_RESPONSE", rawEventId, "Zase jsem dneska běhal.");
    expect(normal.items.some((i) => i.itemType === "CLAIM")).toBe(false);

    const deepDive = await buildContextPack(runtimePool, ownerId, "BUDDY_DEEP_DIVE", rawEventId, "Zase jsem dneska běhal.");
    expect(deepDive.items.some((i) => i.itemType === "CLAIM")).toBe(true);
  });

  it("AT-24/AT-66/I5: normal runtime načte nejvýše 2 third-party epizody, žádný agregát, žádný nový claim/mechanism", async () => {
    for (let i = 0; i < 6; i++) {
      await adminPool.query("insert into evidence_items (owner_id, person_id, evidence_type) values ($1, $2, 'OBSERVATION')", [
        ownerId,
        THIRD_PARTY_ID,
      ]);
    }

    const manifest = await buildContextPack(runtimePool, ownerId, "BUDDY_RESPONSE", rawEventId, "Markétka byla dneska naštvaná.");

    const episodes = manifest.items.filter((i) => i.itemType === "THIRD_PARTY_EPISODE");
    expect(episodes).toHaveLength(2);
    expect(episodes.every((i) => i.personId === THIRD_PARTY_ID)).toBe(true);
    expect(manifest.items.every((i) => i.itemType !== "PERSON_SUMMARY" && i.itemType !== "PATTERN")).toBe(true);

    const claims = await adminPool.query("select count(*)::int as count from claims where owner_id = $1", [ownerId]);
    const mechanisms = await adminPool.query("select count(*)::int as count from mechanisms where owner_id = $1", [ownerId]);
    expect(claims.rows[0].count).toBe(0);
    expect(mechanisms.rows[0].count).toBe(0);
  });

  it("AT-25/AT-66: relationship deep-dive načte víc epizod (max 10), pořád jen per-episode kandidáti", async () => {
    for (let i = 0; i < 15; i++) {
      await adminPool.query("insert into evidence_items (owner_id, person_id, evidence_type) values ($1, $2, 'OBSERVATION')", [
        ownerId,
        THIRD_PARTY_ID,
      ]);
    }

    const manifest = await buildContextPack(
      runtimePool,
      ownerId,
      "BUDDY_DEEP_DIVE",
      rawEventId,
      "Chci si promluvit o vztahu s Markétkou.",
    );

    const episodes = manifest.items.filter((i) => i.itemType === "THIRD_PARTY_EPISODE");
    expect(episodes).toHaveLength(10);
    expect(manifest.items.every((i) => i.itemType !== "PERSON_SUMMARY" && i.itemType !== "PATTERN")).toBe(true);
  });

  it("AT-58: overflow odřízne jen nižší priority, P0 zůstane, omission je auditovaná v context_runs", async () => {
    const hugeName = "a".repeat(40_000); // ~11430 odhadnutých tokenů, přes OPERATIONAL_EXTRACTION strop 8000
    await adminPool.query("insert into projects (owner_id, name, status) values ($1, $2, 'ACTIVE')", [ownerId, hugeName]);
    await seedEntityExtraction([{ name: hugeName }]);

    const manifest = await buildContextPack(runtimePool, ownerId, "OPERATIONAL_EXTRACTION", rawEventId, "krátká zpráva");

    expect(manifest.items).toHaveLength(1); // jen P0, velký projekt se neveze
    expect(manifest.items[0].itemType).toBe("CURRENT_MESSAGE");
    expect(manifest.omittedCount).toBe(1);
    expect(manifest.omissionReason).toContain("omitted 1 item");

    const run = await adminPool.query("select omission_reason from context_runs where id = $1", [manifest.contextRunId]);
    expect(run.rows[0].omission_reason).toContain("omitted 1 item");
    const omittedItem = await adminPool.query(
      "select included from context_run_items where context_run_id = $1 and item_type = 'PROJECT'",
      [manifest.contextRunId],
    );
    expect(omittedItem.rows[0].included).toBe(false);
  });

  it("AT-58 (P0-overflow): obrovská current message → H2ContextBudgetError, žádný context_runs řádek nevznikne", async () => {
    const hugeMessage = "a".repeat(200_000); // přes OPERATIONAL_EXTRACTION strop 8000 samo o sobě

    await expect(buildContextPack(runtimePool, ownerId, "OPERATIONAL_EXTRACTION", rawEventId, hugeMessage)).rejects.toBeInstanceOf(
      H2ContextBudgetError,
    );

    const runs = await adminPool.query("select count(*)::int as count from context_runs where owner_id = $1", [ownerId]);
    expect(runs.rows[0].count).toBe(0);
  });

  it("context manifest snapshot: stabilní tvar pro reprezentativní scénář (entity match + overflow)", async () => {
    await adminPool.query("insert into experiments (owner_id, question) values ($1, 'Pomáhá mi ranní běhání?')", [ownerId]);
    await adminPool.query("insert into projects (owner_id, name, status) values ($1, 'Nesouvisející projekt', 'ACTIVE')", [
      ownerId,
    ]);
    await seedEntityExtraction([{ name: "Pomáhá mi ranní běhání?", refType: "EXPERIMENT" }]);

    const manifest = await buildContextPack(runtimePool, ownerId, "BUDDY_RESPONSE", rawEventId, "Zase jsem dneska běhal.");

    // contextRunId/itemId jsou generované UUID — pro stabilní snapshot se redaktují.
    const redacted = {
      purpose: manifest.purpose,
      omittedCount: manifest.omittedCount,
      omissionReason: manifest.omissionReason,
      items: manifest.items
        .map(({ itemType, priority, reason }) => ({ itemType, priority, reason }))
        .sort((a, b) => a.itemType.localeCompare(b.itemType)),
    };

    expect(redacted).toEqual({
      purpose: "BUDDY_RESPONSE",
      omittedCount: 0,
      omissionReason: null,
      items: [
        { itemType: "CURRENT_MESSAGE", priority: "P0", reason: "current user turn" },
        { itemType: "EXPERIMENT", priority: "P1", reason: "active experiment" },
      ],
    });
  });
});
