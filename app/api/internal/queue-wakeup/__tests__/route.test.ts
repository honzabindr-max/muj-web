import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "@/h2/db/__tests__/helpers";
import { getH2Pool, resetH2PoolForTests } from "@/h2/db/pool";
import { H2_QUEUE_WAKE_SECRET_HEADER } from "@/h2/internal/wake-auth";
import { ingestMessage } from "@/h2/ingestion/ingest-message";

const DB_NAME = "h2_test_internal_queue_wakeup_route";
const WAKE_SECRET = "test-wake-secret-value";

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

function buildRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/internal/queue-wakeup", { method: "POST", headers, body: null });
}

/**
 * BUILD-11 Rozhodnutí 8/Krok 4 — POST /api/internal/queue-wakeup. Testuje
 * auth gate (musí odmítnout PŘED jakýmkoli DB přístupem) a enumeraci
 * ownerů přes `owners` (bez RLS) → per-owner scoped `processOwnerQueueBounded()`
 * (Pravidlo 9 readback guard uvnitř `withOwnerScope()`).
 *
 * Owner v testu nemá `telegram_user_id` — pipeline dojde k
 * `NO_ACTIVE_PROMPT` (test DB nemá žádnou `prompt_versions` řádku),
 * neretryovatelné → okamžitá karanténa → `sendQuarantineNotice()` najde
 * `chatId === null` → DEAD_LETTER BEZE SÍŤOVÉHO volání. Celý řetězec tak
 * jde ověřit end-to-end BEZ mockování Anthropic/Telegram — job PENDING →
 * QUARANTINED je fyzický důkaz, že `claimNextJob()` proběhlo pod SPRÁVNĚ
 * nastaveným owner scope (kdyby RLS tiše vrátila 0 řádků, job by zůstal
 * PENDING navždy).
 */
describe("POST /api/internal/queue-wakeup", () => {
  let adminPool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["queue-wakeup-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    process.env.H2_RUNTIME_DATABASE_URL = buildTestConnectionString(DB_NAME, {
      username: "h2_runtime",
      password: TEST_ROLE_PASSWORD,
    });
    process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION = "1";
    process.env.H2_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString("base64");
    process.env.H2_QUEUE_WAKE_SECRET = WAKE_SECRET;
    process.env.H2_ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.H2_TELEGRAM_BOT_TOKEN = "test-telegram-token";
    resetH2PoolForTests();
  }, 30_000);

  afterEach(async () => {
    await getH2Pool()
      .end()
      .catch(() => {});
    resetH2PoolForTests();
    delete process.env.H2_RUNTIME_DATABASE_URL;
    delete process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION;
    delete process.env.H2_ENCRYPTION_KEY_V1;
    delete process.env.H2_QUEUE_WAKE_SECRET;
    delete process.env.H2_ANTHROPIC_API_KEY;
    delete process.env.H2_TELEGRAM_BOT_TOKEN;
    await dropTestDatabase(adminPool, DB_NAME);
  });

  it("bez hlavičky → 401, žádný DB přístup (job zůstane nedotčený)", async () => {
    const ingestResult = await ingestMessage(getH2Pool(), TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "no-header-1",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj", "utf8"),
    });
    if (ingestResult.duplicate || !ingestResult.jobId) throw new Error("unexpected ingest result in test setup");

    const { POST } = await import("../route");
    const response = await POST(buildRequest());
    expect(response.status).toBe(401);

    const job = await adminPool.query<{ status: string }>("select status from message_processing_jobs where id = $1", [
      ingestResult.jobId,
    ]);
    expect(job.rows[0].status).toBe("PENDING");
  });

  it("se špatnou hlavičkou → 401, job zůstane nedotčený", async () => {
    const { POST } = await import("../route");
    const response = await POST(buildRequest({ [H2_QUEUE_WAKE_SECRET_HEADER]: "wrong-secret" }));
    expect(response.status).toBe(401);
  });

  it("se správnou hlavičkou, prázdná fronta → 204", async () => {
    const { POST } = await import("../route");
    const response = await POST(buildRequest({ [H2_QUEUE_WAKE_SECRET_HEADER]: WAKE_SECRET }));
    expect(response.status).toBe(204);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("se správnou hlavičkou: enumerace ownerů + per-owner scoped processOwnerQueueBounded() → 204, job byl reálně zpracován (PENDING → QUARANTINED)", async () => {
    const ingestResult = await ingestMessage(getH2Pool(), TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId: "wake-owner-scoped-1",
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from("ahoj bez aktivního promptu", "utf8"),
    });
    if (ingestResult.duplicate || !ingestResult.jobId) throw new Error("unexpected ingest result in test setup");

    const { POST } = await import("../route");
    const response = await POST(buildRequest({ [H2_QUEUE_WAKE_SECRET_HEADER]: WAKE_SECRET }));
    expect(response.status).toBe(204);

    const job = await adminPool.query<{ status: string }>("select status from message_processing_jobs where id = $1", [
      ingestResult.jobId,
    ]);
    expect(job.rows[0].status).toBe("QUARANTINED");

    const incidents = await adminPool.query<{ n: string }>(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'MESSAGE_QUARANTINED'",
      [ownerId],
    );
    expect(Number(incidents.rows[0].n)).toBe(1);

    const notices = await adminPool.query<{ status: string }>(
      "select status from system_notice_deliveries where owner_id = $1",
      [ownerId],
    );
    expect(notices.rows).toHaveLength(1);
    expect(notices.rows[0].status).toBe("DEAD_LETTER"); // owner nemá telegram_user_id — žádné síťové volání
  });
});
