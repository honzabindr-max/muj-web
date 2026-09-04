import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ingestMessage } from "../../ingestion/ingest-message";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { commitJobResult } from "../commit";
import { claimNextJob } from "../lease";

const DB_NAME = "h2_test_processing_lease";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * claimNextJob() pod skutečnou omezenou rolí h2_runtime (stejný vzor jako
 * BUILD-04 ingest-message.test.ts) — AT-03, AT-06, AT-07 (Build
 * Specification §6, BUILD-05).
 */
describe("claimNextJob() pod rolí h2_runtime", () => {
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
      ["lease-test-owner-sub", "Honzík"],
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

  it("AT-06: claim respektuje input_sequence pořadí a blokuje claim dokud job 1 běží", async () => {
    const first = await ingestUserText("seq-1");
    const second = await ingestUserText("seq-2");

    const claimA = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claimA).not.toBeNull();
    expect(claimA?.rawEventId).toBe(first.rawEventId);

    // job 1 je PROCESSING (lease neexpiroval) — job 2 nesmí být claimnutelný.
    const blocked = await claimNextJob(runtimePool, ownerId, "processor-blocked");
    expect(blocked).toBeNull();

    await commitJobResult(runtimePool, TEST_REGISTRY, claimA!, async () => ({
      responsePayloadPlaintext: Buffer.from("odpověď 1", "utf8"),
    }));

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.rawEventId).toBe(second.rawEventId);
  });

  it("MANUALLY_CLEARED (migrace 0016, BUILD-11 prep) je settled stejně jako QUARANTINED/RESPONSE_READY — claimNextJob ho přeskočí", async () => {
    const cleared = await ingestUserText("cleared-1");
    const pending = await ingestUserText("pending-2");

    await adminPool.query(
      `update message_processing_jobs set status = 'MANUALLY_CLEARED', finished_at = now() where id = $1`,
      [cleared.jobId],
    );

    const claim = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claim).not.toBeNull();
    expect(claim?.rawEventId).toBe(pending.rawEventId);
  });

  it("AT-03 / AT-07: crash po ACK (lease vyprší bez commitu) → recovery claim + commit uspěje, existuje přesně jedna response", async () => {
    const { rawEventId, jobId } = await ingestUserText("crash-recovery");

    const claimA = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claimA).not.toBeNull();
    expect(claimA?.attemptCount).toBe(1);

    // "crash" = processor A nikdy nezavolá commit. Čas uplyne — simulováno
    // manipulací uloženého lease_until do minulosti (legitimní technika,
    // BUILD-05 plán Rozhodnutí 4 — produkční kód stejně jen porovnává
    // now() proti uloženému razítku).
    await adminPool.query("update owner_processing_state set lease_until = now() - interval '1 minute' where owner_id = $1", [
      ownerId,
    ]);

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.jobId).toBe(jobId);
    expect(claimB?.attemptCount).toBe(2);
    expect(claimB?.leaseEpoch).toBeGreaterThan(claimA!.leaseEpoch);

    await commitJobResult(runtimePool, TEST_REGISTRY, claimB!, async () => ({
      responsePayloadPlaintext: Buffer.from("recovered", "utf8"),
    }));

    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responses.rows[0].n).toBe(1);

    const job = await adminPool.query("select status from message_processing_jobs where id = $1", [jobId]);
    expect(job.rows[0].status).toBe("RESPONSE_READY");
  });

  /**
   * BUILD-11 Rozhodnutí 9 (DEC-008) — ABANDONED_UNKNOWN accounting v reap
   * větvi. min(reap_time - created_at, CALL_TIMEOUT_MS), NIKDY plochá
   * hodnota. `llm_attempts` řádek se přímo insertuje s manipulovaným
   * `created_at` (legitimní technika, stejná jako manipulace
   * `available_at`/`lease_until` v ostatních testech tady) — simuluje
   * procesor, co zmrzl uprostřed LLM volání.
   */
  async function insertStuckCallIntent(jobId: string, createdSecondsAgo: number): Promise<string> {
    const result = await adminPool.query<{ id: string }>(
      `insert into llm_attempts (owner_id, job_id, purpose, model_id, status, created_at)
       values ($1, $2, 'BUDDY_RESPONSE', 'claude-sonnet-5', 'CALL_INTENT', now() - make_interval(secs => $3))
       returning id`,
      [ownerId, jobId, createdSecondsAgo],
    );
    return result.rows[0].id;
  }

  async function expireLease(): Promise<void> {
    await adminPool.query("update owner_processing_state set lease_until = now() - interval '1 minute' where owner_id = $1", [
      ownerId,
    ]);
  }

  it("ABANDONED_UNKNOWN reap: starý CALL_INTENT (nad CALL_TIMEOUT_MS) → charged_processing_ms připočte CAP 60000ms, ne celou uplynulou dobu; job se reklamuje", async () => {
    const { jobId } = await ingestUserText("reap-capped");
    const claimA = await claimNextJob(runtimePool, ownerId, "processor-a");
    expect(claimA?.attemptCount).toBe(1);

    const attemptId = await insertStuckCallIntent(jobId, 70); // 70s > 60s CALL_TIMEOUT_MS
    await expireLease();

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.jobId).toBe(jobId);
    expect(claimB?.attemptCount).toBe(2);
    expect(claimB?.chargedProcessingMs).toBe(60_000); // cap, ne 70_000

    const attempt = await adminPool.query("select status, charged_processing_ms from llm_attempts where id = $1", [attemptId]);
    expect(attempt.rows[0].status).toBe("ABANDONED_UNKNOWN");
    expect(Number(attempt.rows[0].charged_processing_ms)).toBe(60_000);

    const job = await adminPool.query("select charged_processing_ms, status from message_processing_jobs where id = $1", [jobId]);
    expect(Number(job.rows[0].charged_processing_ms)).toBe(60_000);
    expect(job.rows[0].status).toBe("PROCESSING");
  });

  it("ABANDONED_UNKNOWN reap: krátce běžící CALL_INTENT → připočte skutečnou krátkou dobu, ne plochých 60000ms", async () => {
    const { jobId } = await ingestUserText("reap-short");
    await claimNextJob(runtimePool, ownerId, "processor-a");

    const attemptId = await insertStuckCallIntent(jobId, 2); // 2s << 60s CALL_TIMEOUT_MS
    await expireLease();

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    // Tolerance pro test wall-clock (SQL now() vs. JS Date.now() při reapu).
    expect(claimB?.chargedProcessingMs).toBeGreaterThanOrEqual(1_500);
    expect(claimB?.chargedProcessingMs).toBeLessThan(10_000);

    const attempt = await adminPool.query("select status, charged_processing_ms from llm_attempts where id = $1", [attemptId]);
    expect(attempt.rows[0].status).toBe("ABANDONED_UNKNOWN");
    expect(Number(attempt.rows[0].charged_processing_ms)).toBeLessThan(10_000);
  });

  it("ABANDONED_UNKNOWN reap opakovaně vyčerpá processing_budget_ms → KARANTÉNA i když attempt_count < MAX_ATTEMPTS", async () => {
    const { jobId } = await ingestUserText("reap-budget-exhausted");
    await claimNextJob(runtimePool, ownerId, "processor-a");

    // První reap: 70s stuck call → +60_000ms (cap), 60_000 < 120_000 TEXT budget → reklamuje se.
    await insertStuckCallIntent(jobId, 70);
    await expireLease();
    const claimB = await claimNextJob(runtimePool, ownerId, "processor-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.attemptCount).toBe(2);
    expect(claimB?.chargedProcessingMs).toBe(60_000);

    // Druhý reap: dalších 70s stuck call → +60_000ms (cap) = 120_000 celkem,
    // >= 120_000 TEXT budget → KARANTÉNA, i když attempt_count je jen 2 (< MAX_ATTEMPTS=3).
    await insertStuckCallIntent(jobId, 70);
    await expireLease();
    const claimC = await claimNextJob(runtimePool, ownerId, "processor-c");
    expect(claimC).toBeNull(); // job šel do karantény, ne reklamován

    const job = await adminPool.query("select status, charged_processing_ms, attempt_count from message_processing_jobs where id = $1", [
      jobId,
    ]);
    expect(job.rows[0].status).toBe("QUARANTINED");
    expect(Number(job.rows[0].charged_processing_ms)).toBe(120_000);
    expect(job.rows[0].attempt_count).toBe(2);

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'MESSAGE_QUARANTINED'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);
  });
});
