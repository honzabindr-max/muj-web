import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ingestMessage } from "../../ingestion/ingest-message";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { claimNextJob } from "../lease";
import { withLlmAttempt } from "../llm-attempts";

const DB_NAME = "h2_test_processing_llm_attempts";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * BUILD-11 Rozhodnutí 10 — `llm_attempts` CALL_INTENT metering pod
 * skutečnou omezenou rolí h2_runtime.
 */
describe("withLlmAttempt() pod rolí h2_runtime", () => {
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
      ["llm-attempts-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function claimFreshJob(externalEventId: string) {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from(`msg-${externalEventId}`, "utf8"),
    });
    if (result.duplicate) throw new Error("unexpected duplicate in test setup");
    if (!result.jobId) throw new Error("expected job for USER speaker");
    const claim = await claimNextJob(runtimePool, ownerId, `processor-${externalEventId}`);
    if (!claim) throw new Error("expected claim to succeed");
    return claim;
  }

  it("úspěšné fn() → CALL_INTENT řádek existuje před voláním, po úspěchu SUCCEEDED s charged_processing_ms", async () => {
    const claim = await claimFreshJob("attempt-success");
    let rowDuringCall: { status: string; resolved_at: Date | null } | undefined;

    const result = await withLlmAttempt(runtimePool, claim, "BUDDY_RESPONSE", "claude-sonnet-5", async () => {
      const during = await adminPool.query(
        "select status, resolved_at from llm_attempts where owner_id = $1 and job_id = $2",
        [ownerId, claim.jobId],
      );
      rowDuringCall = during.rows[0];
      return "ok";
    });

    expect(result).toBe("ok");
    expect(rowDuringCall?.status).toBe("CALL_INTENT");
    expect(rowDuringCall?.resolved_at).toBeNull();

    const after = await adminPool.query(
      "select status, charged_processing_ms, resolved_at, purpose, model_id from llm_attempts where owner_id = $1 and job_id = $2",
      [ownerId, claim.jobId],
    );
    expect(after.rows[0].status).toBe("SUCCEEDED");
    expect(after.rows[0].purpose).toBe("BUDDY_RESPONSE");
    expect(after.rows[0].model_id).toBe("claude-sonnet-5");
    expect(after.rows[0].charged_processing_ms).not.toBeNull();
    expect(Number(after.rows[0].charged_processing_ms)).toBeGreaterThanOrEqual(0);
    expect(after.rows[0].resolved_at).not.toBeNull();
  });

  it("fn() throwne → CALL_INTENT řádek vytvořen PŘED voláním, po throwu FAILED_CONFIRMED s charged_processing_ms, chyba propaguje", async () => {
    const claim = await claimFreshJob("attempt-failure");

    await expect(
      withLlmAttempt(runtimePool, claim, "OPERATIONAL_EXTRACTION", "claude-haiku-4-5-20251001", async () => {
        throw new Error("simulated Anthropic call failure");
      }),
    ).rejects.toThrow("simulated Anthropic call failure");

    const after = await adminPool.query(
      "select status, charged_processing_ms, resolved_at, purpose, model_id from llm_attempts where owner_id = $1 and job_id = $2",
      [ownerId, claim.jobId],
    );
    expect(after.rows[0].status).toBe("FAILED_CONFIRMED");
    expect(after.rows[0].purpose).toBe("OPERATIONAL_EXTRACTION");
    expect(after.rows[0].model_id).toBe("claude-haiku-4-5-20251001");
    expect(after.rows[0].charged_processing_ms).not.toBeNull();
    expect(after.rows[0].resolved_at).not.toBeNull();
  });
});
