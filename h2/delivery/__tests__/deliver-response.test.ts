import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildTestConnectionString, createRuntimeTestDatabase, dropTestDatabase, TEST_ROLE_PASSWORD } from "../../db/__tests__/helpers";
import { ingestMessage } from "../../ingestion/ingest-message";
import { bumpOwnerControlEpoch } from "../../processing/control-epoch";
import { commitJobResult } from "../../processing/commit";
import { claimNextJob } from "../../processing/lease";
import type { DeliveryProviderConfig } from "../config";
import { deliverResponse } from "../deliver-response";
import type { TelegramSendResult } from "../telegram-send";

const DB_NAME = "h2_test_delivery_deliver_response";
const CREDENTIALS: DeliveryProviderConfig = { telegramBotToken: "bot-token-test" };

const TEST_REGISTRY = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

/**
 * deliverResponse() pod skutečnou omezenou rolí h2_runtime — BUILD-11
 * Rozhodnutí 4/6. AT-10 a Pravidlo 10 jsou POVINNÉ testy tohohle Kroku
 * (BUILD-11-PLAN.md test plán) — mockovaný Telegram send, žádné reálné
 * volání.
 */
describe("deliverResponse() pod rolí h2_runtime", () => {
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
      ["delivery-test-owner-sub", "Honzík", "123456789"],
    );
    ownerId = owner.rows[0].id;
  }, 30_000);

  afterEach(async () => {
    await runtimePool?.end();
    await dropTestDatabase(adminPool, DB_NAME);
  });

  async function commitAResponse(externalEventId: string): Promise<string> {
    const ingestResult = await ingestMessage(runtimePool, TEST_REGISTRY, {
      ownerId,
      channel: "telegram",
      speaker: "USER",
      externalEventId,
      payloadType: "TEXT",
      payloadPlaintext: Buffer.from(`msg-${externalEventId}`, "utf8"),
    });
    if (ingestResult.duplicate || !ingestResult.jobId) throw new Error("unexpected ingest result in test setup");
    const claim = await claimNextJob(runtimePool, ownerId, `processor-${externalEventId}`);
    const { responseId } = await commitJobResult(runtimePool, TEST_REGISTRY, claim!, async () => ({
      responsePayloadPlaintext: Buffer.from(`odpověď na ${externalEventId}`, "utf8"),
    }));
    return responseId;
  }

  function mockSend(result: TelegramSendResult) {
    const calls: unknown[][] = [];
    const fn = async (...args: unknown[]) => {
      calls.push(args);
      return result;
    };
    return { fn, calls };
  }

  it("AT-10: network timeout (AMBIGUOUS) → response_deliveries.status='AMBIGUOUS', incident založen, žádný druhý pokus na opakované volání", async () => {
    const responseId = await commitAResponse("at-10-ambiguous");
    const { fn: sendMessage, calls } = mockSend({ kind: "AMBIGUOUS" });

    const outcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);
    expect(outcome).toBe("AMBIGUOUS");
    expect(calls).toHaveLength(1);

    const delivery = await adminPool.query("select status, last_error_code from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(delivery.rows).toHaveLength(1);
    expect(delivery.rows[0].status).toBe("AMBIGUOUS");

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'DELIVERY_AMBIGUOUS'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);

    // Druhé volání se stejným responseId — AT-10 DoD: "žádná síťová
    // nejistota nevytvoří druhý logical response ani druhý delivery pokus".
    const secondOutcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);
    expect(secondOutcome).toBe("AMBIGUOUS");
    expect(calls).toHaveLength(1); // sendMessage se podruhé NEVOLALO

    const deliveryRows = await adminPool.query("select count(*)::int as n from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(deliveryRows.rows[0].n).toBe(1); // pořád jen jeden řádek
  });

  it("Pravidlo 10 (DEC-007 §8.1): commit response → owner_control_epoch vzroste (STOP) → deliverResponse() odmítne odeslat, sendMessage nebylo zavoláno", async () => {
    const responseId = await commitAResponse("pravidlo-10-stop");

    // STOP mezi commitem a delivery — bumpOwnerControlEpoch simuluje
    // budoucí explicitní PAUSE/STOP command (stejná technika jako AT-71,
    // h2/processing/__tests__/commit.test.ts).
    await bumpOwnerControlEpoch(runtimePool, ownerId);

    const { fn: sendMessage, calls } = mockSend({ kind: "SUCCESS", externalMessageId: "999" });
    const outcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);

    expect(calls).toHaveLength(0); // sendMessage se NIKDY nezavolalo
    expect(outcome).not.toBe("DELIVERED");

    const delivery = await adminPool.query("select status, last_error_code from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(delivery.rows[0].status).not.toBe("DELIVERED");
    expect(delivery.rows[0].status).not.toBe("SENDING");
    expect(delivery.rows[0].last_error_code).toBe("SOVEREIGNTY_EPOCH_STALE");

    const incidents = await adminPool.query(
      "select count(*)::int as n from incidents where owner_id = $1 and incident_type = 'DELIVERY_BLOCKED_STALE_EPOCH'",
      [ownerId],
    );
    expect(incidents.rows[0].n).toBe(1);
  });

  it("úspěšné odeslání → DELIVERED, external_message_id uložen", async () => {
    const responseId = await commitAResponse("success-path");
    const { fn: sendMessage, calls } = mockSend({ kind: "SUCCESS", externalMessageId: "42" });

    const outcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);
    expect(outcome).toBe("DELIVERED");
    expect(calls).toHaveLength(1);

    const delivery = await adminPool.query("select status, external_message_id from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(delivery.rows[0].status).toBe("DELIVERED");
    expect(delivery.rows[0].external_message_id).toBe("42");
  });

  it("web kanál → rovnou DELIVERED, sendMessage se nikdy nevolá (žádná síťová nejistota)", async () => {
    const responseId = await commitAResponse("web-channel");
    const { fn: sendMessage, calls } = mockSend({ kind: "SUCCESS", externalMessageId: "should-not-be-used" });

    const outcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "web", CREDENTIALS, sendMessage);
    expect(outcome).toBe("DELIVERED");
    expect(calls).toHaveLength(0);

    const delivery = await adminPool.query("select status, channel from response_deliveries where response_id = $1", [responseId]);
    expect(delivery.rows[0].status).toBe("DELIVERED");
    expect(delivery.rows[0].channel).toBe("web");
  });

  it("definitivní HTTP chyba → FAILED_RETRYABLE (pod MAX_DELIVERY_ATTEMPTS)", async () => {
    const responseId = await commitAResponse("definitive-error");
    const { fn: sendMessage } = mockSend({ kind: "DEFINITIVE_ERROR", description: "Bad Request: chat not found" });

    const outcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);
    expect(outcome).toBe("FAILED_RETRYABLE");

    const delivery = await adminPool.query("select status, last_error_code, attempt_count from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(delivery.rows[0].status).toBe("FAILED_RETRYABLE");
    expect(delivery.rows[0].last_error_code).toBe("Bad Request: chat not found");
    expect(delivery.rows[0].attempt_count).toBe(1);
  });

  it("definitivní HTTP chyba opakovaně → DEAD_LETTER po vyčerpání MAX_DELIVERY_ATTEMPTS", async () => {
    const responseId = await commitAResponse("exhausted-attempts");
    const { fn: sendMessage } = mockSend({ kind: "DEFINITIVE_ERROR", description: "Bad Request: chat not found" });

    let lastOutcome;
    for (let i = 0; i < 3; i += 1) {
      lastOutcome = await deliverResponse(runtimePool, TEST_REGISTRY, ownerId, responseId, "telegram", CREDENTIALS, sendMessage);
    }
    expect(lastOutcome).toBe("DEAD_LETTER");

    const delivery = await adminPool.query("select status, attempt_count from response_deliveries where response_id = $1", [
      responseId,
    ]);
    expect(delivery.rows[0].status).toBe("DEAD_LETTER");
    expect(delivery.rows[0].attempt_count).toBe(3);
  });
});
