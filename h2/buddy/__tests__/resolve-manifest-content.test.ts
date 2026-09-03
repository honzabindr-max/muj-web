import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ContextManifest } from "../../context/build-context-pack";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { encryptPayload } from "../../crypto/envelope";
import { H2BuddyRuntimeError } from "../errors";
import { resolveManifestContent } from "../resolve-manifest-content";

const DB_NAME = "h2_test_resolve_manifest_content";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

function manifest(items: ContextManifest["items"], purpose: ContextManifest["purpose"] = "BUDDY_RESPONSE"): ContextManifest {
  return { contextRunId: "00000000-0000-0000-0000-000000000000", purpose, items, omittedCount: 0, omissionReason: null };
}

/**
 * resolveManifestContent() — epistemic + privacy filter (I4/I5) nad
 * `buildContextPack()`'s metadata-only manifestem (BUILD-10 nová vrstva).
 */
describe("resolveManifestContent() pod rolí h2_runtime", () => {
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
      ["resolve-manifest-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("resolvuje PROJECT/TASK/EXPERIMENT na plaintext obsah v prioritním pořadí manifestu", async () => {
    const project = await adminPool.query<{ id: string }>(
      "insert into projects (owner_id, name, status) values ($1, 'Refaktoring backendu', 'ACTIVE') returning id",
      [ownerId],
    );
    const experiment = await adminPool.query<{ id: string }>(
      "insert into experiments (owner_id, question) values ($1, 'Pomáhá mi ranní běh?') returning id",
      [ownerId],
    );

    const m = manifest([
      { itemType: "PROJECT", itemId: project.rows[0].id, priority: "P1", reason: "active project" },
      { itemType: "EXPERIMENT", itemId: experiment.rows[0].id, priority: "P1", reason: "active experiment" },
    ]);

    const resolved = await resolveManifestContent(runtimePool, TEST_REGISTRY, ownerId, m);
    expect(resolved).toHaveLength(2);
    expect(resolved.find((r) => r.itemType === "PROJECT")?.contentText).toBe("Refaktoring backendu");
    expect(resolved.find((r) => r.itemType === "EXPERIMENT")?.contentText).toBe("Pomáhá mi ranní běh?");
  });

  it("I4 defense-in-depth: CLAIM se state='HYPOTEZA' v BUDDY_RESPONSE manifestu → hlasitá chyba, ne tichý průchod", async () => {
    const claim = await adminPool.query<{ id: string }>(
      "insert into claims (owner_id, statement, state) values ($1, 'Ranní běh mě nabíjí', 'HYPOTEZA') returning id",
      [ownerId],
    );
    const m = manifest([{ itemType: "CLAIM", itemId: claim.rows[0].id, priority: "P2", reason: "claim" }], "BUDDY_RESPONSE");

    await expect(resolveManifestContent(runtimePool, TEST_REGISTRY, ownerId, m)).rejects.toBeInstanceOf(H2BuddyRuntimeError);
  });

  it("BUDDY_DEEP_DIVE smí resolvovat HYPOTEZA claim, ale explicitně ho označí jako nepotvrzenou hypotézu", async () => {
    const claim = await adminPool.query<{ id: string }>(
      "insert into claims (owner_id, statement, state) values ($1, 'Ranní běh mě nabíjí', 'HYPOTEZA') returning id",
      [ownerId],
    );
    const m = manifest([{ itemType: "CLAIM", itemId: claim.rows[0].id, priority: "P2", reason: "claim" }], "BUDDY_DEEP_DIVE");

    const resolved = await resolveManifestContent(runtimePool, TEST_REGISTRY, ownerId, m);
    expect(resolved[0].contentText).toContain("nepotvrzená hypotéza");
    expect(resolved[0].contentText).toContain("Ranní běh mě nabíjí");
  });

  it("I5: third-party epizoda se dešifruje a explicitně orámuje jako izolovaná, NEAGREGOVAT", async () => {
    const { ciphertext, keyVersion } = encryptPayload(Buffer.from("Petr mi řekl, že se stěhuje.", "utf8"), TEST_REGISTRY);
    const rawEvent = await adminPool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, 1, 1, 'telegram', 'USER', $2, 'TEXT', $3)
       returning id`,
      [ownerId, ciphertext, keyVersion],
    );
    const evidence = await adminPool.query<{ id: string }>(
      "insert into evidence_items (owner_id, raw_event_id, person_id, evidence_type) values ($1, $2, $3, 'OBSERVATION') returning id",
      [ownerId, rawEvent.rows[0].id, "11111111-1111-1111-1111-111111111111"],
    );
    const m = manifest([
      { itemType: "THIRD_PARTY_EPISODE", itemId: evidence.rows[0].id, priority: "P3", reason: "third-party episode" },
    ]);

    const resolved = await resolveManifestContent(runtimePool, TEST_REGISTRY, ownerId, m);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].contentText).toContain("NEAGREGOVAT");
    expect(resolved[0].contentText).toContain("Petr mi řekl, že se stěhuje.");
  });

  it("CURRENT_MESSAGE (P0) se přeskočí — volající už má messageText přímo", async () => {
    const m = manifest([{ itemType: "CURRENT_MESSAGE", itemId: "raw-event-id", priority: "P0", reason: "current message" }]);
    const resolved = await resolveManifestContent(runtimePool, TEST_REGISTRY, ownerId, m);
    expect(resolved).toHaveLength(0);
  });
});
