import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ingestMessage } from "../../ingestion/ingest-message";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { withOwnerScope } from "../../db/with-owner-scope";
import { commitJobResult } from "../commit";
import { claimNextJob } from "../lease";
import { quarantineJob, recordJobFailure } from "../quarantine";

const DB_NAME = "h2_test_processing_quarantine";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * Retry/backoff/auto-quarantine pod skutečnou omezenou rolí h2_runtime —
 * AT-54 (Build Specification §6, BUILD-05): po vyčerpání pokusů/deadline
 * jde job do QUARANTINED s přesně jedním incidentem a jednou notice, a
 * karanténní mezera neblokuje claim dalšího jobu v pořadí.
 */
describe("quarantine (retry/backoff/terminál) pod rolí h2_runtime", () => {
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
      ["quarantine-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function ingestUserText(externalEventId: string): Promise<{ rawEventId: string; jobId: string }> {
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
    return { rawEventId: result.rawEventId, jobId: result.jobId };
  }

  it("AT-54: po 3 selhaných pokusech jde job do QUARANTINED (přesně 1 incident, 1 notice), gap neblokuje další job", async () => {
    await ingestUserText("seq-1");
    const second = await ingestUserText("seq-2");
    const third = await ingestUserText("seq-3");

    // Zpráva 1 se normálně dokončí, aby min-open-sequence byla zpráva 2.
    const claim1 = await claimNextJob(runtimePool, ownerId, "processor-seq1");
    await commitJobResult(runtimePool, TEST_REGISTRY, claim1!, async () => ({
      responsePayloadPlaintext: Buffer.from("ok", "utf8"),
    }));

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const claim = await claimNextJob(runtimePool, ownerId, `processor-attempt-${attempt}`);
      expect(claim).not.toBeNull();
      expect(claim?.jobId).toBe(second.jobId);
      expect(claim?.attemptCount).toBe(attempt);

      const outcome = await recordJobFailure(runtimePool, claim!, "WORK_THREW", "stub work always throws");
      expect(outcome).toBe("RETRIED");

      const job = await adminPool.query("select status, available_at from message_processing_jobs where id = $1", [
        second.jobId,
      ]);
      expect(job.rows[0].status).toBe("RETRY_PENDING");
      expect(new Date(job.rows[0].available_at).getTime()).toBeGreaterThan(Date.now());

      // Backoff bez reálného čekání — manipulace available_at (BUILD-05
      // plán, stejná legitimní technika jako u lease_until).
      await adminPool.query("update message_processing_jobs set available_at = now() - interval '1 second' where id = $1", [
        second.jobId,
      ]);
    }

    const finalClaim = await claimNextJob(runtimePool, ownerId, "processor-attempt-3");
    expect(finalClaim).not.toBeNull();
    expect(finalClaim?.attemptCount).toBe(3);

    const finalOutcome = await recordJobFailure(runtimePool, finalClaim!, "WORK_THREW", "stub work always throws");
    expect(finalOutcome).toBe("QUARANTINED");

    const quarantinedJob = await adminPool.query(
      "select status, quarantined_at, quarantine_notice_sent_at from message_processing_jobs where id = $1",
      [second.jobId],
    );
    expect(quarantinedJob.rows[0].status).toBe("QUARANTINED");
    expect(quarantinedJob.rows[0].quarantined_at).not.toBeNull();
    expect(quarantinedJob.rows[0].quarantine_notice_sent_at).not.toBeNull();

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'MESSAGE_QUARANTINED'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);

    // Karanténní mezera neblokuje: zpráva 3 (vyšší input_sequence) je
    // claimnutelná i s jobem 2 v karanténě.
    const claimThird = await claimNextJob(runtimePool, ownerId, "processor-seq3");
    expect(claimThird).not.toBeNull();
    expect(claimThird?.rawEventId).toBe(third.rawEventId);
  });

  it("AT-54: souběžný pokus o dvojí karanténu stejného jobu vyprodukuje přesně jeden incident", async () => {
    const { jobId } = await ingestUserText("race-quarantine");

    const [a, b] = await Promise.all([
      withOwnerScope(runtimePool, ownerId, (client) => quarantineJob(client, ownerId, jobId, "RACE_TEST")),
      withOwnerScope(runtimePool, ownerId, (client) => quarantineJob(client, ownerId, jobId, "RACE_TEST")),
    ]);
    void a;
    void b;

    const job = await adminPool.query("select status, quarantine_notice_sent_at from message_processing_jobs where id = $1", [
      jobId,
    ]);
    expect(job.rows[0].status).toBe("QUARANTINED");
    expect(job.rows[0].quarantine_notice_sent_at).not.toBeNull();

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'MESSAGE_QUARANTINED'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);
  });
});
