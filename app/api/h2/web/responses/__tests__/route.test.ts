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
import { encryptPayload } from "@/h2/crypto/envelope";

const DB_NAME = "h2_test_web_responses_route";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 5)]]),
};

/**
 * GET /api/h2/web/responses (BUILD-11 Rozhodnutí 6) — read-only cursor
 * projekce. Přímé volání route handleru, bez skutečného prohlížeče, stejný
 * vzor jako app/api/h2/web/messages/__tests__/route.test.ts.
 */
describe("GET /api/h2/web/responses", () => {
  let adminPool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name) values ($1, $2) returning id",
      ["web-responses-test-owner", "Honzík"],
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
    mockAuth.mockResolvedValue({ googleSub: "web-responses-test-owner" });
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

  async function insertResponse(inputSequence: number, text: string): Promise<string> {
    const raw = await adminPool.query<{ id: string }>(
      `insert into raw_events (owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, encryption_key_version)
       values ($1, $2, $2, 'web', 'USER', $3, 'TEXT', 1)
       returning id`,
      [ownerId, inputSequence, Buffer.from("placeholder")],
    );
    const { ciphertext, keyVersion } = encryptPayload(Buffer.from(text, "utf8"), TEST_REGISTRY);
    const resp = await adminPool.query<{ id: string }>(
      `insert into responses (owner_id, source_raw_event_id, source_input_sequence, payload_ciphertext, encryption_key_version, stance, owner_control_epoch)
       values ($1, $2, $3, $4, $5, 'BE_WITH', 0)
       returning id`,
      [ownerId, raw.rows[0].id, inputSequence, ciphertext, keyVersion],
    );
    return resp.rows[0].id;
  }

  function buildRequest(query = ""): Request {
    return new Request(`http://localhost/api/h2/web/responses${query}`);
  }

  it("přihlášený owner → vrátí dešifrované responses seřazené podle source_input_sequence", async () => {
    await insertResponse(2, "druhá odpověď");
    await insertResponse(1, "první odpověď");

    const { GET } = await import("../route");
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.responses).toHaveLength(2);
    expect(body.responses[0].text).toBe("první odpověď");
    expect(body.responses[1].text).toBe("druhá odpověď");
  });

  it("cursor after= → vrátí jen responses s vyšší source_input_sequence", async () => {
    await insertResponse(1, "první odpověď");
    await insertResponse(2, "druhá odpověď");

    const { GET } = await import("../route");
    const response = await GET(buildRequest("?after=1"));
    const body = await response.json();
    expect(body.responses).toHaveLength(1);
    expect(body.responses[0].text).toBe("druhá odpověď");
  });

  it("nepřihlášený request → 401, žádná data", async () => {
    mockAuth.mockResolvedValue(null);
    await insertResponse(1, "tajná odpověď");

    const { GET } = await import("../route");
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.responses).toBeUndefined();
  });

  it("žádné responses → prázdné pole, ne chyba", async () => {
    const { GET } = await import("../route");
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.responses).toEqual([]);
  });
});
