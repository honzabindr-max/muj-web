import { timingSafeEqual } from "node:crypto";

import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * Telegram identity boundary (§31.1): "přesný allowlist jednoho
 * telegram_user_id + Telegram webhook secret; cizí update se odmítne před
 * uložením payloadu." Na rozdíl od Google OAuth enrollmentu (BUILD-03A) tu
 * NENÍ first-contact enrollment — Telegram update nedokazuje identitu sám o
 * sobě, takže allowlist musí být předem nakonfigurovaná hodnota, ne "kdo se
 * ozve první".
 */

export function verifyTelegramWebhookSecret(
  headerValue: string | null,
  source: Record<string, string | undefined> = process.env,
): boolean {
  const { H2_TELEGRAM_WEBHOOK_SECRET } = requireEnv({ H2_TELEGRAM_WEBHOOK_SECRET: z.string().min(1) }, source);
  if (!headerValue) return false;

  const expected = Buffer.from(H2_TELEGRAM_WEBHOOK_SECRET);
  const actual = Buffer.from(headerValue);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isAllowlistedTelegramSender(
  telegramUserId: number,
  source: Record<string, string | undefined> = process.env,
): boolean {
  const { H2_TELEGRAM_OWNER_USER_ID } = requireEnv({ H2_TELEGRAM_OWNER_USER_ID: z.string().regex(/^\d+$/) }, source);
  return String(telegramUserId) === H2_TELEGRAM_OWNER_USER_ID;
}

/**
 * H2 je single-owner systém; owner řádek vzniká přes Google enrollment
 * (BUILD-03A). Telegram jen připojuje druhý kanál na stejného ownera, nikdy
 * nevytváří nový owner řádek. Pokud web enrollment ještě neproběhl, Telegram
 * zprávu nemá kam zapsat.
 */
export async function resolveEnrolledOwnerId(db: Pool | PoolClient): Promise<string | null> {
  const result = await db.query<{ id: string }>("select id from owners where google_sub is not null limit 1");
  return result.rows[0]?.id ?? null;
}

/** Idempotentní zápis telegram_user_id na owner řádek — čistě informační, allowlist rozhoduje env var, ne tento sloupec. */
export async function linkTelegramUserId(db: Pool | PoolClient, ownerId: string, telegramUserId: number): Promise<void> {
  await db.query("update owners set telegram_user_id = $1 where id = $2 and telegram_user_id is null", [
    String(telegramUserId),
    ownerId,
  ]);
}
