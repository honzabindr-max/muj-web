import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * BUILD-11 Rozhodnutí 8 — auth pro nezávislý queue-wake endpoint
 * (`POST /api/internal/queue-wakeup`, cron-job.org). Stejný constant-time
 * compare vzor jako `h2/ingestion/telegram-auth.ts`'s
 * `verifyTelegramWebhookSecret()` — `H2_QUEUE_WAKE_SECRET` je scoped jen
 * pro tenhle endpoint, rotovatelný nezávisle na Telegram webhook secretu.
 */
export const H2_QUEUE_WAKE_SECRET_HEADER = "x-h2-wake-secret";

export function verifyQueueWakeSecret(
  headerValue: string | null,
  source: Record<string, string | undefined> = process.env,
): boolean {
  const { H2_QUEUE_WAKE_SECRET } = requireEnv({ H2_QUEUE_WAKE_SECRET: z.string().min(1) }, source);
  if (!headerValue) return false;

  const expected = Buffer.from(H2_QUEUE_WAKE_SECRET);
  const actual = Buffer.from(headerValue);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
