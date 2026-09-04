import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptPayload } from "../../crypto/envelope";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { ingestMessage } from "../../ingestion/ingest-message";
import { bumpOwnerControlEpoch } from "../../processing/control-epoch";
import { commitJobResult } from "../../processing/commit";
import { H2FencingError } from "../../processing/errors";
import { claimNextJob } from "../../processing/lease";
import { recordJobFailure } from "../../processing/quarantine";
import { commitVoiceTranscript } from "../commit-transcript";
import { H2VoiceTranscriptionError } from "../errors";
import { encodeVoiceReferenceHandle } from "../reference-handle";
import { transcribeVoiceJob } from "../process-voice-job";

const DB_NAME = "h2_test_voice_process_job";
const CREDENTIALS = { telegramBotToken: "bot-token-test", openaiApiKey: "sk-test-key" };

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

const fakeDownload = async () => ({ audio: Buffer.from([9, 9, 9]), mimeType: "audio/ogg" });

/**
 * transcribeVoiceJob()/commitVoiceTranscript() pod skutečnou omezenou rolí
 * h2_runtime — AT-04, AT-05 + voice deadline 300s test s jedním retry +
 * metering atomicita (docs/h2/BUILD-06-PLAN.md, Rozhodnutí 4/6).
 */
describe("voice job processing pod rolí h2_runtime", () => {
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
      ["voice-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function ingestVoice(externalEventId: string, durationSeconds: number): Promise<{ rawEventId: string; jobId: string }> {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "VOICE",
      payloadPlaintext: encodeVoiceReferenceHandle({ telegramFileId: `tg-file-${externalEventId}`, durationSeconds }),
    });
    if (result.duplicate) throw new Error("unexpected duplicate in test setup");
    if (!result.jobId) throw new Error("expected job for USER speaker");
    return { rawEventId: result.rawEventId, jobId: result.jobId };
  }

  it("AT-04: 3min voice → okamžitý claim s 300000ms processing budget, transcript in-place, přesně jedna odpověď a jeden usage_ledger řádek", async () => {
    const { rawEventId } = await ingestVoice("voice-3min", 180);

    const claim = await claimNextJob(runtimePool, ownerId, "processor-voice-a");
    expect(claim).not.toBeNull();
    expect(claim!.processingBudgetMs).toBe(300_000);
    expect(claim!.chargedProcessingMs).toBe(0);

    const { transcriptText } = await transcribeVoiceJob(runtimePool, TEST_REGISTRY, claim!, CREDENTIALS, {
      download: fakeDownload,
      transcribe: async () => ({ text: "ahoj z hlasovky" }),
    });
    expect(transcriptText).toBe("ahoj z hlasovky");

    const rawEvent = await adminPool.query<{ payload_ciphertext: Buffer; encryption_key_version: number; payload_type: string }>(
      "select payload_ciphertext, encryption_key_version, payload_type from raw_events where id = $1",
      [rawEventId],
    );
    expect(rawEvent.rows[0].payload_type).toBe("VOICE");
    const decrypted = decryptPayload(rawEvent.rows[0].payload_ciphertext, rawEvent.rows[0].encryption_key_version, TEST_REGISTRY);
    expect(decrypted.toString("utf8")).toBe("ahoj z hlasovky");

    const usage = await adminPool.query(
      "select purpose, model_id, unit, quantity, cost_usd from usage_ledger where owner_id = $1",
      [ownerId],
    );
    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0].purpose).toBe("voice_transcription");
    expect(usage.rows[0].model_id).toBe("whisper-1");
    expect(usage.rows[0].unit).toBe("minutes");
    expect(Number(usage.rows[0].quantity)).toBeCloseTo(3, 5);
    expect(Number(usage.rows[0].cost_usd)).toBeCloseTo(0.018, 5);

    // Retrofit BUILD-07 (docs/h2/BUILD-07-PLAN.md Rozhodnutí 5): commitVoiceTranscript()
    // teď zapisuje i llm_runs provenance pro Whisper, atomicky se stejnou transakcí.
    const llmRuns = await adminPool.query(
      "select purpose, model_id, prompt_version_id, status from llm_runs where owner_id = $1",
      [ownerId],
    );
    expect(llmRuns.rows).toHaveLength(1);
    expect(llmRuns.rows[0].purpose).toBe("voice_transcription");
    expect(llmRuns.rows[0].model_id).toBe("whisper-1");
    expect(llmRuns.rows[0].prompt_version_id).toBeNull();
    expect(llmRuns.rows[0].status).toBe("OK");

    // "odpověď bez duplicity" — stejný vzor jako BUILD-05 AT-03, stub work.
    await commitJobResult(runtimePool, TEST_REGISTRY, claim!, async () => ({
      responsePayloadPlaintext: Buffer.from("stub odpověď", "utf8"),
    }));
    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responses.rows[0].n).toBe(1);
    const job = await adminPool.query("select status from message_processing_jobs where raw_event_id = $1", [rawEventId]);
    expect(job.rows[0].status).toBe("RESPONSE_READY");
  });

  it("AT-05: uměle zpožděný/timeoutlý Whisper → retry bez druhého raw eventu", async () => {
    const { rawEventId } = await ingestVoice("voice-delayed-whisper", 60);

    const claimA = await claimNextJob(runtimePool, ownerId, "processor-voice-a");
    expect(claimA).not.toBeNull();
    expect(claimA?.attemptCount).toBe(1);

    await expect(
      transcribeVoiceJob(runtimePool, TEST_REGISTRY, claimA!, CREDENTIALS, {
        download: fakeDownload,
        transcribe: async () => {
          throw new H2VoiceTranscriptionError("WHISPER_TIMEOUT");
        },
      }),
    ).rejects.toBeInstanceOf(H2VoiceTranscriptionError);

    const outcome = await recordJobFailure(runtimePool, claimA!, "WHISPER_TIMEOUT", true, "simulated delayed whisper");
    expect(outcome).toBe("RETRIED");

    await adminPool.query("update message_processing_jobs set available_at = now() - interval '1 second' where id = $1", [
      claimA!.jobId,
    ]);

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-voice-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.jobId).toBe(claimA?.jobId);
    expect(claimB?.attemptCount).toBe(2);

    const { transcriptText } = await transcribeVoiceJob(runtimePool, TEST_REGISTRY, claimB!, CREDENTIALS, {
      download: fakeDownload,
      transcribe: async () => ({ text: "druhý pokus uspěl" }),
    });
    expect(transcriptText).toBe("druhý pokus uspěl");

    const rawEvents = await adminPool.query("select count(*)::int as n from raw_events where owner_id = $1", [ownerId]);
    expect(rawEvents.rows[0].n).toBe(1);

    await commitJobResult(runtimePool, TEST_REGISTRY, claimB!, async () => ({
      responsePayloadPlaintext: Buffer.from("stub odpověď 2", "utf8"),
    }));
    const responses = await adminPool.query("select count(*)::int as n from responses where source_raw_event_id = $1", [
      rawEventId,
    ]);
    expect(responses.rows[0].n).toBe(1);

    // Selhaný pokus nevolal commitVoiceTranscript → nezapsal usage. Jen jeden řádek z úspěšného pokusu.
    const usage = await adminPool.query("select count(*)::int as n from usage_ledger where owner_id = $1", [ownerId]);
    expect(usage.rows[0].n).toBe(1);
  });

  it("voice processing budget 300000ms s jedním retry: druhý pokus v rámci budgetu uspěje bez karantény", async () => {
    const { jobId } = await ingestVoice("voice-one-retry-in-budget", 30);

    const claimA = await claimNextJob(runtimePool, ownerId, "processor-voice-a");
    expect(claimA!.processingBudgetMs).toBe(300_000);

    const outcome = await recordJobFailure(runtimePool, claimA!, "WHISPER_HTTP_ERROR", true, "transient");
    expect(outcome).toBe("RETRIED");
    await adminPool.query("update message_processing_jobs set available_at = now() - interval '1 second' where id = $1", [
      jobId,
    ]);

    const claimB = await claimNextJob(runtimePool, ownerId, "processor-voice-b");
    expect(claimB).not.toBeNull();
    expect(claimB?.attemptCount).toBe(2);

    await transcribeVoiceJob(runtimePool, TEST_REGISTRY, claimB!, CREDENTIALS, {
      download: fakeDownload,
      transcribe: async () => ({ text: "ok v rámci deadline" }),
    });

    const job = await adminPool.query("select status from message_processing_jobs where id = $1", [jobId]);
    expect(job.rows[0].status).toBe("PROCESSING");
    expect(job.rows[0].status).not.toBe("QUARANTINED");
  });

  it("metering atomicita: fencing selže mezi claim a commit → nula usage_ledger řádků, transcript se nezapíše", async () => {
    const { rawEventId } = await ingestVoice("voice-fencing-race", 45);
    const claim = await claimNextJob(runtimePool, ownerId, "processor-voice-a");
    expect(claim).not.toBeNull();

    const newControlEpoch = await bumpOwnerControlEpoch(runtimePool, ownerId);
    expect(newControlEpoch).toBeGreaterThan(claim!.ownerControlEpoch);

    await expect(commitVoiceTranscript(runtimePool, TEST_REGISTRY, claim!, Buffer.from("stale transcript", "utf8"), 45)).rejects.toBeInstanceOf(
      H2FencingError,
    );

    const usage = await adminPool.query("select count(*)::int as n from usage_ledger where owner_id = $1", [ownerId]);
    expect(usage.rows[0].n).toBe(0);

    const llmRuns = await adminPool.query("select count(*)::int as n from llm_runs where owner_id = $1", [ownerId]);
    expect(llmRuns.rows[0].n).toBe(0);

    const rawEvent = await adminPool.query<{ payload_ciphertext: Buffer; encryption_key_version: number }>(
      "select payload_ciphertext, encryption_key_version from raw_events where id = $1",
      [rawEventId],
    );
    const decrypted = decryptPayload(rawEvent.rows[0].payload_ciphertext, rawEvent.rows[0].encryption_key_version, TEST_REGISTRY);
    expect(JSON.parse(decrypted.toString("utf8"))).toMatchObject({ telegramFileId: "tg-file-voice-fencing-race" });
  });
});
