import type { Pool, PoolClient } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { DeliveryProviderConfig } from "./config";
import type { DeliveryOutcome } from "./deliver-response";
import { sendTelegramMessage } from "./telegram-send";
import type { SendTelegramMessageFn } from "./telegram-send";

const QUARANTINE_NOTICE_TEXT =
  "Tvoje poslední zpráva se bohužel nepodařilo zpracovat a byla odložena stranou. Omlouvám se za to.";

type NoticeRow = { id: string; status: string };

async function upsertNoticeRow(client: PoolClient, ownerId: string, idempotencyKey: string): Promise<NoticeRow> {
  const inserted = await client.query<NoticeRow>(
    `insert into system_notice_deliveries (owner_id, notice_type, channel, status, idempotency_key)
     values ($1, 'QUARANTINE', 'telegram', 'PENDING', $2)
     on conflict (owner_id, idempotency_key) do nothing
     returning id, status`,
    [ownerId, idempotencyKey],
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const existing = await client.query<NoticeRow>(
    `select id, status from system_notice_deliveries where owner_id = $1 and idempotency_key = $2`,
    [ownerId, idempotencyKey],
  );
  return existing.rows[0];
}

/**
 * `sendQuarantineNotice()` — BUILD-11 Rozhodnutí 5 (ROZHODNUTO Honzík,
 * 2026-09-04). Volaná ze stejného místa jako `quarantineJob()` (uvnitř
 * budoucí `processOwnerQueueBounded()`'s catch větve, Krok 4) —
 * **nikým nevolané v produkci dnes**. `idempotency_key =
 * "quarantine_notice:{jobId}"` (architekturou pojmenovaný formát,
 * BUILD-05-PLAN.md Rozhodnutí 3).
 *
 * Beze epoch kontroly (na rozdíl od `deliverResponse()`) — systémové
 * notice nejsou Buddy odpověď fencovaná Pravidlem 10, jsou to systémová
 * oznámení nezávislá na `owner_control_epoch`.
 */
export async function sendQuarantineNotice(
  pool: Pool,
  ownerId: string,
  jobId: string,
  credentials: DeliveryProviderConfig,
  sendMessage: SendTelegramMessageFn = sendTelegramMessage,
): Promise<DeliveryOutcome> {
  const idempotencyKey = `quarantine_notice:${jobId}`;

  const notice = await withOwnerScope(pool, ownerId, (client) => upsertNoticeRow(client, ownerId, idempotencyKey));

  if (
    notice.status === "DELIVERED" ||
    notice.status === "AMBIGUOUS" ||
    notice.status === "DEAD_LETTER" ||
    notice.status === "SENDING"
  ) {
    return notice.status as DeliveryOutcome;
  }

  const chatId = await withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ telegram_user_id: string | null }>(`select telegram_user_id from owners where id = $1`, [
      ownerId,
    ]);
    return result.rows[0]?.telegram_user_id ?? null;
  });

  if (!chatId) {
    await withOwnerScope(pool, ownerId, (client) =>
      client.query(
        `update system_notice_deliveries set status = 'DEAD_LETTER', last_error_code = 'NO_TELEGRAM_CHAT_ID', updated_at = now() where id = $1`,
        [notice.id],
      ),
    );
    return "DEAD_LETTER";
  }

  await withOwnerScope(pool, ownerId, (client) =>
    client.query(`update system_notice_deliveries set status = 'SENDING', updated_at = now() where id = $1`, [notice.id]),
  );

  const result = await sendMessage(chatId, QUARANTINE_NOTICE_TEXT, credentials.telegramBotToken);

  if (result.kind === "SUCCESS") {
    await withOwnerScope(pool, ownerId, (client) =>
      client.query(`update system_notice_deliveries set status = 'DELIVERED', external_message_id = $2, updated_at = now() where id = $1`, [
        notice.id,
        result.externalMessageId,
      ]),
    );
    return "DELIVERED";
  }

  if (result.kind === "AMBIGUOUS") {
    await withOwnerScope(pool, ownerId, async (client) => {
      await client.query(
        `update system_notice_deliveries set status = 'AMBIGUOUS', last_error_code = 'DELIVERY_TIMEOUT', updated_at = now() where id = $1`,
        [notice.id],
      );
      await client.query(
        `insert into incidents (owner_id, incident_type, severity, detail_code) values ($1, 'QUARANTINE_NOTICE_AMBIGUOUS', 'WARNING', $2)`,
        [ownerId, `jobId=${jobId}`],
      );
    });
    return "AMBIGUOUS";
  }

  await withOwnerScope(pool, ownerId, (client) =>
    client.query(`update system_notice_deliveries set status = 'FAILED_RETRYABLE', last_error_code = $2, updated_at = now() where id = $1`, [
      notice.id,
      result.description,
    ]),
  );
  return "FAILED_RETRYABLE";
}
