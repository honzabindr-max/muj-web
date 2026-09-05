import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { ingestMessage } from "../../ingestion/ingest-message";
import { processOwnerQueueBounded, WORST_CASE_JOB_DURATION_MS } from "../process-owner-queue";
import type { ProcessQueueCredentials } from "../process-owner-queue";

const DB_NAME = "h2_test_processing_process_owner_queue";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

// Nikdy se nepoužije v žádném z testů níže — obě scénáře (BUDGET_EXHAUSTED,
// QUEUE_EMPTY) se rozhodnou PŘED prvním voláním generateBuddyResponse()/
// deliverResponse(), takže reálné credentials nejsou potřeba.
const UNUSED_CREDENTIALS: ProcessQueueCredentials = {
  anthropicApiKey: "unused",
  telegramBotToken: "unused",
};

/**
 * BUILD-11 Rozhodnutí 1/Krok 4 — rozpočtem času ohraničená smyčka. Testuje
 * jen samotnou budget gate logiku (PŘED claimNextJob()) a prázdnou frontu
 * — plné zpracování jednoho jobu (Sonnet/Haiku/Telegram) je pokryté
 * samostatně v generate-response.test.ts / deliver-response.test.ts, tady
 * by jen duplikovalo mockování bez přidané hodnoty pro tenhle konkrétní
 * mechanismus (rozpočtová smyčka).
 */
describe("processOwnerQueueBounded() pod rolí h2_runtime", () => {
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
      ["process-queue-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("rozpočtová smyčka: deadlineAt blízko now() → BUDGET_EXHAUSTED PŘED prvním claimNextJob(), fronta zůstane nedotčená i když není prázdná", async () => {
    const ingestResult = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "budget-exhausted-1",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj", "utf8"),
    });
    if (ingestResult.duplicate || !ingestResult.jobId) throw new Error("unexpected ingest result in test setup");

    // deadlineAt jen 1s od teď — remaining (~1000ms) << WORST_CASE_JOB_DURATION_MS.
    expect(WORST_CASE_JOB_DURATION_MS).toBeGreaterThan(1_000);
    const deadlineAt = new Date(Date.now() + 1_000);

    const outcome = await processOwnerQueueBounded(runtimePool, TEST_REGISTRY, UNUSED_CREDENTIALS, ownerId, deadlineAt);

    expect(outcome).toEqual({ jobsProcessed: 0, stoppedReason: "BUDGET_EXHAUSTED" });

    const job = await adminPool.query<{ status: string }>("select status from message_processing_jobs where id = $1", [
      ingestResult.jobId,
    ]);
    expect(job.rows[0].status).toBe("PENDING"); // claimNextJob() se nikdy nezavolalo
  });

  it("prázdná fronta → QUEUE_EMPTY, žádný claim, žádná chyba", async () => {
    const deadlineAt = new Date(Date.now() + 10 * 60_000); // 10 min — víc než dost budgetu
    const outcome = await processOwnerQueueBounded(runtimePool, TEST_REGISTRY, UNUSED_CREDENTIALS, ownerId, deadlineAt);
    expect(outcome).toEqual({ jobsProcessed: 0, stoppedReason: "QUEUE_EMPTY" });
  });
});
