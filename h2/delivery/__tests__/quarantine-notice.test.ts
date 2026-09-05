import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import type { DeliveryProviderConfig } from "../config";
import { sendQuarantineNotice } from "../quarantine-notice";
import type { TelegramSendResult } from "../telegram-send";

const DB_NAME = "h2_test_delivery_quarantine_notice";
const CREDENTIALS: DeliveryProviderConfig = { telegramBotToken: "bot-token-test" };

/**
 * sendQuarantineNotice() pod skutečnou omezenou rolí h2_runtime — BUILD-11
 * Rozhodnutí 5. idempotency_key = "quarantine_notice:{jobId}", žádná
 * epoch kontrola (systémové notice, ne Buddy response — Pravidlo 10 se
 * netýká).
 */
describe("sendQuarantineNotice() pod rolí h2_runtime", () => {
  let adminPool: Pool;
  let runtimePool: Pool;
  let ownerId: string;

  beforeEach(async () => {
    adminPool = await createRuntimeTestDatabase(DB_NAME);
    runtimePool = new PgPool({
      connectionString: buildTestConnectionString(DB_NAME, { username: "h2_runtime", password: TEST_ROLE_PASSWORD }),
    });

    const owner = await adminPool.query<{ id: string }>(
      "insert into owners (google_sub, display_name, telegram_user_id) values ($1, $2, $3) returning id",
      ["quarantine-notice-test-owner-sub", "Honzík", "987654321"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  function mockSend(result: TelegramSendResult) {
    const calls: unknown[][] = [];
    const fn = async (...args: unknown[]) => {
      calls.push(args);
      return result;
    };
    return { fn, calls };
  }

  it("úspěšné odeslání → DELIVERED, idempotency_key = quarantine_notice:{jobId}", async () => {
    const jobId = "11111111-1111-4111-8111-111111111111";
    const { fn: sendMessage, calls } = mockSend({ kind: "SUCCESS", externalMessageId: "77" });

    const outcome = await sendQuarantineNotice(runtimePool, ownerId, jobId, CREDENTIALS, sendMessage);
    expect(outcome).toBe("DELIVERED");
    expect(calls).toHaveLength(1);

    const notice = await adminPool.query(
      "select status, idempotency_key, external_message_id, notice_type from system_notice_deliveries where owner_id = $1",
      [ownerId],
    );
    expect(notice.rows).toHaveLength(1);
    expect(notice.rows[0].status).toBe("DELIVERED");
    expect(notice.rows[0].idempotency_key).toBe(`quarantine_notice:${jobId}`);
    expect(notice.rows[0].notice_type).toBe("QUARANTINE");
  });

  it("dvě volání se stejným jobId → jeden system_notice_deliveries řádek, sendMessage podruhé nevoláno", async () => {
    const jobId = "22222222-2222-4222-8222-222222222222";
    const { fn: sendMessage, calls } = mockSend({ kind: "SUCCESS", externalMessageId: "78" });

    const first = await sendQuarantineNotice(runtimePool, ownerId, jobId, CREDENTIALS, sendMessage);
    const second = await sendQuarantineNotice(runtimePool, ownerId, jobId, CREDENTIALS, sendMessage);
    expect(first).toBe("DELIVERED");
    expect(second).toBe("DELIVERED");
    expect(calls).toHaveLength(1);

    const count = await adminPool.query("select count(*)::int as n from system_notice_deliveries where owner_id = $1", [ownerId]);
    expect(count.rows[0].n).toBe(1);
  });

  it("network timeout → AMBIGUOUS, incident založen, žádný automatický retry", async () => {
    const jobId = "33333333-3333-4333-8333-333333333333";
    const { fn: sendMessage, calls } = mockSend({ kind: "AMBIGUOUS" });

    const outcome = await sendQuarantineNotice(runtimePool, ownerId, jobId, CREDENTIALS, sendMessage);
    expect(outcome).toBe("AMBIGUOUS");

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'QUARANTINE_NOTICE_AMBIGUOUS'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);

    const second = await sendQuarantineNotice(runtimePool, ownerId, jobId, CREDENTIALS, sendMessage);
    expect(second).toBe("AMBIGUOUS");
    expect(calls).toHaveLength(1);
  });
});
