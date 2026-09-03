import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetH2ConfigCacheForTests } from "@/h2/config";
import {
  buildTestConnectionString,
  createRuntimeTestDatabase,
  dropTestDatabase,
  TEST_ROLE_PASSWORD,
} from "@/h2/db/__tests__/helpers";
import { getH2Pool, resetH2PoolForTests } from "@/h2/db/pool";

const DB_NAME = "h2_test_web_messages_route";
const ORIGIN = "http://localhost:3000";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

/**
 * AT-48 (Build Specification §6, BUILD-04): web endpoint volá stejnou
 * ingestMessage() jako Telegram webhook. Přímé volání route handleru, bez
 * skutečného prohlížeče.
 */
describe("POST /api/h2/web/messages", () => {
  let adminPool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["web-route-test-owner", "Honzík"],
    );
    ownerId = owner.rows[0].id;

    process.env.H2_RUNTIME_DATABASE_URL = buildTestConnectionString(DB_NAME, {
      username: "h2_runtime",
      password: TEST_ROLE_PASSWORD,
    });
    process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION = "1";
    process.env.H2_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 5).toString("base64");
    resetH2PoolForTests();
    resetH2ConfigCacheForTests();
    mockAuth.mockReset();
    mockAuth.mockResolvedValue({ googleSub: "web-route-test-owner" });
  }, 30_000);

  afterEach(async () => {
    await getH2Pool()
      .end()
      .catch(() => {});
    resetH2PoolForTests();
    resetH2ConfigCacheForTests();
    delete process.env.H2_RUNTIME_DATABASE_URL;
    delete process.env.H2_ENCRYPTION_ACTIVE_KEY_VERSION;
    delete process.env.H2_ENCRYPTION_KEY_V1;
    await dropTestDatabase(adminPool, DB_NAME);
  });

  function buildRequest(body: unknown, options: { origin?: string | null } = {}): Request {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const origin = options.origin === undefined ? ORIGIN : options.origin;
    if (origin !== null) headers.origin = origin;
    return new Request("http://localhost/api/h2/web/messages", { method: "POST", headers, body: JSON.stringify(body) });
  }

  it("AT-48: přihlášený owner z povoleného originu → 201, raw_event + job vzniknou stejnou ingestMessage() jako Telegram", async () => {
    const { POST } = await import("../route");
    const response = await POST(buildRequest({ text: "ahoj z webu", clientMessageId: "11111111-1111-4111-8111-111111111111" }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.duplicate).toBe(false);

    const rawEvents = await adminPool.query(
      "select speaker, channel, input_sequence from raw_events where owner_id = $1",
      [ownerId],
    );
    expect(rawEvents.rows).toHaveLength(1);
    expect(rawEvents.rows[0].channel).toBe("web");
    expect(rawEvents.rows[0].speaker).toBe("USER");
    expect(rawEvents.rows[0].input_sequence).not.toBeNull();

    const jobs = await adminPool.query("select status from message_processing_jobs where owner_id = $1", [ownerId]);
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0].status).toBe("PENDING");
  });

  it("duplicitní clientMessageId → druhý request vrátí 200 duplicate:true, žádný druhý raw_event", async () => {
    const { POST } = await import("../route");
    const payload = { text: "ahoj", clientMessageId: "22222222-2222-4222-8222-222222222222" };
    const first = await POST(buildRequest(payload));
    const second = await POST(buildRequest(payload));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.duplicate).toBe(true);

    const count = await adminPool.query("select count(*)::int as n from raw_events where owner_id = $1", [ownerId]);
    expect(count.rows[0].n).toBe(1);
  });

  it("nepřihlášený request → 401, žádný raw_event", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("../route");
    const response = await POST(buildRequest({ text: "x", clientMessageId: "33333333-3333-3333-3333-333333333333" }));
    expect(response.status).toBe(401);

    const count = await adminPool.query("select count(*)::int as n from raw_events", []);
    expect(count.rows[0].n).toBe(0);
  });

  it("chybějící/cizí Origin hlavička → 403 CSRF_REJECTED, žádný raw_event", async () => {
    const { POST } = await import("../route");
    const response = await POST(buildRequest({ text: "x", clientMessageId: "44444444-4444-4444-4444-444444444444" }, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);

    const count = await adminPool.query("select count(*)::int as n from raw_events", []);
    expect(count.rows[0].n).toBe(0);
  });
});
