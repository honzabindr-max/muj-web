import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildTestConnectionString,
  createRuntimeTestDatabase,
  dropTestDatabase,
  TEST_ROLE_PASSWORD,
} from "@/h2/db/__tests__/helpers";
import { resetH2ConfigCacheForTests } from "@/h2/config";
import { getH2Pool, resetH2PoolForTests } from "@/h2/db/pool";

const DB_NAME = "h2_test_telegram_webhook_route";
const OWNER_USER_ID = "6034875251";
const WEBHOOK_SECRET = "test-webhook-secret";

/**
 * AT-01, AT-02 (Build Specification §6, BUILD-04) přes přímé volání route
 * handleru — bez tunelu/reálného Telegramu, přesně jak vyžaduje slice plán.
 * DB vrstva pod skutečnou omezenou rolí h2_runtime.
 */
describe("POST /api/h2/telegram/webhook", () => {
  let adminPool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["webhook-route-test-owner", "Honzík"],
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
    // Route handler drží vlastní cachovaný Pool (getH2Pool()) — musí se
    // zavřít PŘED drop database, jinak Postgres odmítne DROP s "being
    // accessed by other users" (otevřené TCP spojení z pg-pool).
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

  function buildRequest(body: unknown, secretHeader: string | null = WEBHOOK_SECRET): Request {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (secretHeader !== null) headers["x-telegram-bot-api-secret-token"] = secretHeader;
    return new Request("http://localhost/api/h2/telegram/webhook", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("AT-01: validní text update od allowlistovaného sendera → 200 teprve po durable commitu raw_event + job", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      buildRequest({
        update_id: 100,
        message: { message_id: 1, text: "ahoj Buddy", from: { id: Number(OWNER_USER_ID) } },
      }),
    );
    expect(response.status).toBe(200);

    const rawEvents = await adminPool.query(
      "select speaker, input_sequence from raw_events where owner_id = $1 and channel = 'telegram'",
      [ownerId],
    );
    expect(rawEvents.rows).toHaveLength(1);
    expect(rawEvents.rows[0].speaker).toBe("USER");
    expect(rawEvents.rows[0].input_sequence).not.toBeNull();

    const jobs = await adminPool.query("select status from message_processing_jobs where owner_id = $1", [ownerId]);
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0].status).toBe("PENDING");
  });

  it("AT-02: stejný update_id poslaný dvakrát → jeden raw_event", async () => {
    const { POST } = await import("../route");
    const update = { update_id: 200, message: { message_id: 2, text: "ahoj", from: { id: Number(OWNER_USER_ID) } } };

    const first = await POST(buildRequest(update));
    const second = await POST(buildRequest(update));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rawEvents = await adminPool.query(
      "select count(*)::int as n from raw_events where owner_id = $1 and channel = 'telegram' and external_event_id = '200'",
      [ownerId],
    );
    expect(rawEvents.rows[0].n).toBe(1);
  });

  it("cizí telegram_user_id → 200 (Telegram by jinak opakoval doručení donekonečna), payload se neuloží, audit event bez obsahu", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      buildRequest({
        update_id: 300,
        message: { message_id: 3, text: "cizí zpráva", from: { id: 999999999 } },
      }),
    );
    expect(response.status).toBe(200);

    const rawEvents = await adminPool.query("select count(*)::int as n from raw_events where owner_id = $1", [
      ownerId,
    ]);
    expect(rawEvents.rows[0].n).toBe(0);

    const audit = await adminPool.query(
      "select owner_id, event_type from identity_audit_events where event_type = 'TELEGRAM_MESSAGE_REJECTED_UNKNOWN_SENDER'",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].owner_id).toBeNull();
  });

  it("chybějící/neplatný webhook secret → 401, žádný DB zápis (request není prokazatelně od Telegramu)", async () => {
    const { POST } = await import("../route");

    const wrongSecret = await POST(
      buildRequest(
        { update_id: 400, message: { message_id: 4, text: "x", from: { id: Number(OWNER_USER_ID) } } },
        "wrong-secret",
      ),
    );
    expect(wrongSecret.status).toBe(401);

    const missingSecret = await POST(
      buildRequest({ update_id: 401, message: { message_id: 5, text: "x", from: { id: Number(OWNER_USER_ID) } } }, null),
    );
    expect(missingSecret.status).toBe(401);

    const rawEvents = await adminPool.query("select count(*)::int as n from raw_events", []);
    expect(rawEvents.rows[0].n).toBe(0);
    const audit = await adminPool.query("select count(*)::int as n from identity_audit_events", []);
    expect(audit.rows[0].n).toBe(0);
  });

  it("update bez text pole (např. voice — mimo scope BUILD-04) → 200, no-op, žádný raw_event", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      buildRequest({
        update_id: 500,
        message: { message_id: 6, from: { id: Number(OWNER_USER_ID) }, voice: { file_id: "abc" } },
      }),
    );
    expect(response.status).toBe(200);

    const rawEvents = await adminPool.query("select count(*)::int as n from raw_events", []);
    expect(rawEvents.rows[0].n).toBe(0);
  });
});
