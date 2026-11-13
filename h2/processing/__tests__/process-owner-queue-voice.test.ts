import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readMessageText } from "../../buddy/generate-response";
import { H2BuddyRuntimeError } from "../../buddy/errors";
import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { ingestMessage } from "../../ingestion/ingest-message";
import { H2VoiceTranscriptionError } from "../../voice/errors";
import { readPendingVoiceHandle } from "../../voice/process-voice-job";
import { encodeVoiceReferenceHandle, isVoiceReferenceHandlePayload } from "../../voice/reference-handle";
import { processOwnerQueueBounded } from "../process-owner-queue";
import type { ProcessQueueCredentials } from "../process-owner-queue";

const DB_NAME = "h2_test_processing_process_owner_queue_voice";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

const CREDENTIALS: ProcessQueueCredentials = {
  anthropicApiKey: "test-anthropic",
  telegramBotToken: "test-telegram",
  openaiApiKey: "test-openai",
};

/**
 * DC-17 — VOICE job musí projít přepisem PŘED extrakcí/Buddy odpovědí.
 * Selhaný přepis → karanténa; reference handle nikdy neodejde do LLM.
 */
describe("DC-17: voice přepis v processOwnerQueueBounded()", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });
    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["process-queue-voice-test-owner-sub", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    // Jediný povolený síťový provoz je Telegram (quarantine notice); Anthropic se volat nesmí.
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  }, 30_000);

  afterEach(async () => {
    vi.unstubAllGlobals();
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function ingestVoice(externalEventId: string) {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "VOICE",
      payloadPlaintext: encodeVoiceReferenceHandle({ telegramFileId: "file-123", durationSeconds: 7 }),
    });
    if (result.duplicate || !result.jobId) throw new Error("unexpected ingest result in test setup");
    return result;
  }

  it("selhaný přepis → job QUARANTINED s kódem chyby, žádné volání Anthropic", async () => {
    const { jobId } = await ingestVoice("voice-fail-1");
    const transcribe = vi.fn(async () => {
      throw new H2VoiceTranscriptionError("WHISPER_HTTP_ERROR");
    });
    const download = vi.fn(async () => ({ audio: Buffer.from("ogg"), mimeType: "audio/ogg" }));

    const outcome = await processOwnerQueueBounded(
      runtimePool,
      TEST_REGISTRY,
      CREDENTIALS,
      ownerId,
      new Date(Date.now() + 10 * 60_000),
      { download, transcribe },
    );

    expect(outcome.jobsProcessed).toBe(1);
    expect(download).toHaveBeenCalledWith("file-123", "test-telegram");
    expect(transcribe).toHaveBeenCalledTimes(1);

    const job = await adminPool.query<{ status: string; quarantine_reason: string }>(
      "select status, quarantine_reason from message_processing_jobs where id = $1",
      [jobId],
    );
    expect(job.rows[0].status).toBe("QUARANTINED");
    expect(job.rows[0].quarantine_reason).toBe("WHISPER_HTTP_ERROR");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("anthropic"))).toBe(false);
  });

  it("nepřepsaný VOICE: readMessageText() odmítne handle, readPendingVoiceHandle() ho vrátí", async () => {
    const { rawEventId } = await ingestVoice("voice-guard-1");

    await expect(readMessageText(runtimePool, TEST_REGISTRY, ownerId, rawEventId)).rejects.toBeInstanceOf(H2BuddyRuntimeError);
    await expect(readPendingVoiceHandle(runtimePool, TEST_REGISTRY, ownerId, rawEventId)).resolves.toEqual({
      telegramFileId: "file-123",
      durationSeconds: 7,
    });
  });

  it("TEXT job: readPendingVoiceHandle() vrací null", async () => {
    const result = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "text-1",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from('{"telegramFileId":"x"}', "utf8"),
    });
    await expect(readPendingVoiceHandle(runtimePool, TEST_REGISTRY, ownerId, result.rawEventId)).resolves.toBeNull();
  });
});

describe("isVoiceReferenceHandlePayload()", () => {
  it("handle (i poškozený) = true, přepis = false", () => {
    expect(isVoiceReferenceHandlePayload(encodeVoiceReferenceHandle({ telegramFileId: "a", durationSeconds: 1 }))).toBe(true);
    expect(isVoiceReferenceHandlePayload(Buffer.from('{"telegramFileId":1}', "utf8"))).toBe(true);
    expect(isVoiceReferenceHandlePayload(Buffer.from("Ahoj, zítra v deset.", "utf8"))).toBe(false);
    expect(isVoiceReferenceHandlePayload(Buffer.from("123", "utf8"))).toBe(false);
  });
});
