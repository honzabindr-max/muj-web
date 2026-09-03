import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetH2ConfigCacheForTests } from "@/h2/config";
import {
  buildTestConnectionString,
  createRuntimeTestDatabase,
  dropTestDatabase,
  TEST_ROLE_PASSWORD,
} from "@/h2/db/__tests__/helpers";
import { getH2Pool, resetH2PoolForTests } from "@/h2/db/pool";
import { decryptPayload } from "@/h2/crypto/envelope";
import { decodeVoiceReferenceHandle } from "@/h2/voice/reference-handle";

const DB_NAME = "h2_test_telegram_webhook_voice_route";
const OWNER_USER_ID = "6034875251";
const WEBHOOK_SECRET = "test-webhook-secret";

/**
 * AT-04 "okamžitý ACK" (Build Specification §6, BUILD-06) — voice ingest
 * větev webhook routy. Route modul neimportuje download/transcribe (jen
 * `encodeVoiceReferenceHandle`), takže strukturálně nemůže synchronně
 * volat žádné síťové API — ACK je čistě po `ingestMessage()` commitu.
 */
describe("POST /api/h2/telegram/webhook — voice", () => {
  let adminPool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["webhook-voice-route-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    process.env.H2_RUNTIME_DATABASE_URL = buildTestConnectionString(DB_NAME, {
      username: "h2_runtime",
      password: TEST_ROLE_PASSWORD,
    });
    process.env.H2_TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.H2_TELEGRAM_OWNER_USER_ID = OWNER_USER_ID;
    process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION = "1";
    process.env.H2_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 3).toString("base64");
    resetH2PoolForTests();
    resetH2ConfigCacheForTests();
  }, 30_000);

  afterEach(async () => {
    await getH2Pool()
      .end()
      .catch(() => {});
    resetH2PoolForTests();
    resetH2ConfigCacheForTests();
    delete process.env.H2_RUNTIME_DATABASE_URL;
    delete process.env.H2_TELEGRAM_WEBHOOK_SECRET;
    delete process.env.H2_TELEGRAM_OWNER_USER_ID;
    delete process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION;
    delete process.env.H2_ENCRYPTION_KEY_V1;
    await dropTestDatabase(adminPool, DB_NAME);
  });

  function buildRequest(body: unknown): Request {
    return new Request("http://localhost/api/h2/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
      body: JSON.stringify(body),
    });
  }

  it("AT-04: voice update → okamžitý 200 ACK po commitu, raw_event drží reference handle (ne audio)", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      buildRequest({
        update_id: 600,
        message: { message_id: 7, from: { id: Number(OWNER_USER_ID) }, voice: { file_id: "tg-voice-file-1", duration: 180 } },
      }),
    );
    expect(response.status).toBe(200);

    const rawEvents = await adminPool.query<{
      speaker: string;
      payload_type: string;
      input_sequence: string | null;
      payload_ciphertext: Buffer;
      encryption_key_version: number;
    }>("select speaker, payload_type, input_sequence, payload_ciphertext, encryption_key_version from raw_events where owner_id = $1", [
      ownerId,
    ]);
    expect(rawEvents.rows).toHaveLength(1);
    expect(rawEvents.rows[0].speaker).toBe("USER");
    expect(rawEvents.rows[0].payload_type).toBe("VOICE");
    expect(rawEvents.rows[0].input_sequence).not.toBeNull();

    const registry = { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 3)]]) };
    const decrypted = decryptPayload(
      rawEvents.rows[0].payload_ciphertext,
      rawEvents.rows[0].encryption_key_version,
      registry,
    );
    const handle = decodeVoiceReferenceHandle(decrypted);
    expect(handle).toEqual({ telegramFileId: "tg-voice-file-1", durationSeconds: 180 });

    const jobs = await adminPool.query("select status from message_processing_jobs where owner_id = $1", [ownerId]);
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0].status).toBe("PENDING");
  });

  it("duplicitní voice update_id poslaný dvakrát → jeden raw_event", async () => {
    const { POST } = await import("../route");
    const update = {
      update_id: 601,
      message: { message_id: 8, from: { id: Number(OWNER_USER_ID) }, voice: { file_id: "tg-voice-file-2", duration: 12 } },
    };

    const first = await POST(buildRequest(update));
    const second = await POST(buildRequest(update));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rawEvents = await adminPool.query(
      "select count(*)::int as n from raw_events where owner_id = $1 and channel = 'telegram' and external_event_id = '601'",
      [ownerId],
    );
    expect(rawEvents.rows[0].n).toBe(1);
  });
});
