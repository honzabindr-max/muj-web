import type { Pool, PoolClient } from "pg";

import { decryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { DeliveryProviderConfig } from "./config";
import { sendTelegramMessage } from "./telegram-send";
import type { SendTelegramMessageFn } from "./telegram-send";

export const MAX_DELIVERY_ATTEMPTS = 3;

export type DeliveryChannel = "telegram" | "web";
export type DeliveryOutcome = "DELIVERED" | "FAILED_RETRYABLE" | "DEAD_LETTER" | "AMBIGUOUS" | "SENDING";

type DeliveryRow = { id: string; status: string; attempt_count: number };

/**
 * Idempotentní find-or-create — `unique(owner_id, idempotency_key)` chrání
 * proti duplicitě, `on conflict do nothing` + fallback SELECT je bezpečné
 * i pod souběžným voláním (BUILD-11 test plán: "dva processOwnerQueueBounded()
 * běhy nad stejným responseId → jeden response_deliveries řádek").
 */
async function upsertDeliveryRow(
  client: PoolClient,
  ownerId: string,
  responseId: string,
  channel: DeliveryChannel,
  idempotencyKey: string,
): Promise<DeliveryRow> {
  const inserted = await client.query<DeliveryRow>(
    `insert into response_deliveries (owner_id, response_id, channel, status, idempotency_key)
     values ($1, $2, $3, 'PENDING', $4)
     on conflict (owner_id, idempotency_key) do nothing
     returning id, status, attempt_count`,
    [ownerId, responseId, channel, idempotencyKey],
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const existing = await client.query<DeliveryRow>(
    `select id, status, attempt_count from response_deliveries where owner_id = $1 and idempotency_key = $2`,
    [ownerId, idempotencyKey],
  );
  return existing.rows[0];
}

/**
 * `deliverResponse()` — BUILD-11 Rozhodnutí 6 (Telegram outbound + web
 * projekce) + Rozhodnutí 4 (`owner_control_epoch` kontrola, Pravidlo 10).
 * **Nikým nevolané v produkci** — Krok 4 tuhle funkci teprve zapojí do
 * `processOwnerQueueBounded()`.
 *
 * Žádná fáze nedrží DB transakci otevřenou přes `sendTelegramMessage()`'s
 * network round-trip (až `DELIVERY_CALL_TIMEOUT_MS`) — stejná disciplína
 * jako `withLlmAttempt()` (BUILD-11 Rozhodnutí 10): více krátkých
 * transakcí, síťové volání mezi nimi mimo transakci.
 *
 * Terminální/in-flight stavy (`DELIVERED`, `AMBIGUOUS`, `DEAD_LETTER`,
 * `SENDING`) se při opakovaném volání se stejným `idempotencyKey` nikdy
 * neopakují — AT-10 vyžaduje, že síťová nejistota nikdy nevytvoří druhý
 * pokus/druhou logickou odpověď. `SENDING` je tu záměrně mezi terminálními
 * (ne jen `DELIVERED`/`AMBIGUOUS`/`DEAD_LETTER`) — pokud procesor spadne
 * mezi nastavením `SENDING` a zápisem výsledku, nevíme, jestli Telegram
 * zprávu doručil. Bezpečnější je nechat řádek "zaseknutý" (vyžaduje
 * budoucí reap mechanismus, forward-pointer pro Krok 4/BUILD-23) než
 * riskovat druhé fyzické odeslání.
 */
export async function deliverResponse(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  responseId: string,
  channel: DeliveryChannel,
  credentials: DeliveryProviderConfig,
  sendMessage: SendTelegramMessageFn = sendTelegramMessage,
): Promise<DeliveryOutcome> {
  const idempotencyKey = `${responseId}:${channel}`;

  const delivery = await withOwnerScope(pool, ownerId, (client) =>
    upsertDeliveryRow(client, ownerId, responseId, channel, idempotencyKey),
  );

  if (
    delivery.status === "DELIVERED" ||
    delivery.status === "AMBIGUOUS" ||
    delivery.status === "DEAD_LETTER" ||
    delivery.status === "SENDING"
  ) {
    return delivery.status as DeliveryOutcome;
  }

  if (channel === "web") {
    // Rozhodnutí 6 — web kanál nemá síťovou nejistotu ve stejném smyslu
    // jako Telegram (žádné externí push API, žádný "send" krok, co může
    // timeoutnout uprostřed) — jakmile je responses řádek committed, jde
    // rovnou na DELIVERED. GET /api/h2/web/responses je nezávislá read-only
    // projekce, tenhle status přechod na ní nezávisí.
    await withOwnerScope(pool, ownerId, (client) =>
      client.query(`update response_deliveries set status = 'DELIVERED', updated_at = now() where id = $1`, [delivery.id]),
    );
    return "DELIVERED";
  }

  const prep = await withOwnerScope(pool, ownerId, async (client) => {
    const responseRow = await client.query<{
      payload_ciphertext: Buffer;
      encryption_key_version: number;
      owner_control_epoch: string;
    }>(`select payload_ciphertext, encryption_key_version, owner_control_epoch from responses where id = $1`, [responseId]);
    const response = responseRow.rows[0];
    if (!response) {
      throw new Error("H2 delivery: responses řádek nenalezen");
    }
    const stateResult = await client.query<{ owner_control_epoch: string }>(
      `select owner_control_epoch from owner_processing_state where owner_id = $1`,
      [ownerId],
    );
    const ownerResult = await client.query<{ telegram_user_id: string | null }>(
      `select telegram_user_id from owners where id = $1`,
      [ownerId],
    );
    return {
      payloadCiphertext: response.payload_ciphertext,
      encryptionKeyVersion: response.encryption_key_version,
      committedEpoch: BigInt(response.owner_control_epoch),
      currentEpoch: BigInt(stateResult.rows[0]?.owner_control_epoch ?? "0"),
      chatId: ownerResult.rows[0]?.telegram_user_id ?? null,
    };
  });

  // Rozhodnutí 4 / Pravidlo 10 (DEC-007 §8.1) — committed-ale-ještě-
  // nedoručená odpověď se nesmí odeslat, pokud control epoch mezitím
  // vzrostl (PAUSE/STOP). Epoch je monotónní, jakmile current > committed
  // zůstane tak navždy — retry by nikdy neuspěl, proto DEAD_LETTER, ne
  // FAILED_RETRYABLE.
  if (prep.currentEpoch > prep.committedEpoch) {
    await withOwnerScope(pool, ownerId, async (client) => {
      await client.query(
        `update response_deliveries set status = 'DEAD_LETTER', last_error_code = 'SOVEREIGNTY_EPOCH_STALE', updated_at = now() where id = $1`,
        [delivery.id],
      );
      await client.query(
        `insert into incidents (owner_id, incident_type, severity, detail_code) values ($1, 'DELIVERY_BLOCKED_STALE_EPOCH', 'WARNING', $2)`,
        [ownerId, `responseId=${responseId}`],
      );
    });
    return "DEAD_LETTER";
  }

  if (!prep.chatId) {
    // Telegram kanál nikdy nepřipojen (owners.telegram_user_id null) —
    // stejná třída jako definitivní chyba, retry by nikdy neuspěl.
    await withOwnerScope(pool, ownerId, (client) =>
      client.query(
        `update response_deliveries set status = 'DEAD_LETTER', last_error_code = 'NO_TELEGRAM_CHAT_ID', attempt_count = attempt_count + 1, updated_at = now() where id = $1`,
        [delivery.id],
      ),
    );
    return "DEAD_LETTER";
  }

  const plaintext = decryptPayload(prep.payloadCiphertext, prep.encryptionKeyVersion, registry).toString("utf8");

  await withOwnerScope(pool, ownerId, (client) =>
    client.query(`update response_deliveries set status = 'SENDING', attempt_count = attempt_count + 1, updated_at = now() where id = $1`, [
      delivery.id,
    ]),
  );

  const result = await sendMessage(prep.chatId, plaintext, credentials.telegramBotToken);

  if (result.kind === "SUCCESS") {
    await withOwnerScope(pool, ownerId, (client) =>
      client.query(`update response_deliveries set status = 'DELIVERED', external_message_id = $2, updated_at = now() where id = $1`, [
        delivery.id,
        result.externalMessageId,
      ]),
    );
    return "DELIVERED";
  }

  if (result.kind === "AMBIGUOUS") {
    // AT-10 — network timeout/nejasný výsledek: NIKDY automatický retry.
    // Incident se založí, recovery policy pracuje s původním response ID
    // a incidentem (§4.4), ne slepým znovu-odesláním.
    await withOwnerScope(pool, ownerId, async (client) => {
      await client.query(
        `update response_deliveries set status = 'AMBIGUOUS', last_error_code = 'DELIVERY_TIMEOUT', updated_at = now() where id = $1`,
        [delivery.id],
      );
      await client.query(
        `insert into incidents (owner_id, incident_type, severity, detail_code) values ($1, 'DELIVERY_AMBIGUOUS', 'WARNING', $2)`,
        [ownerId, `responseId=${responseId}`],
      );
    });
    return "AMBIGUOUS";
  }

  // DEFINITIVE_ERROR — Telegram request přijal a zpracoval, definitivně
  // odmítl (např. špatný chat_id). attempt_count už je navýšený o tenhle
  // pokus (SENDING update výše) — po vyčerpání MAX_DELIVERY_ATTEMPTS jde
  // rovnou na DEAD_LETTER, ne do nekonečného FAILED_RETRYABLE.
  const attemptsAfterThis = delivery.attempt_count + 1;
  const nextStatus: DeliveryOutcome = attemptsAfterThis >= MAX_DELIVERY_ATTEMPTS ? "DEAD_LETTER" : "FAILED_RETRYABLE";
  await withOwnerScope(pool, ownerId, (client) =>
    client.query(`update response_deliveries set status = $2, last_error_code = $3, updated_at = now() where id = $1`, [
      delivery.id,
      nextStatus,
      result.description,
    ]),
  );
  return nextStatus;
}
