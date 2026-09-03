import type { PoolClient } from "pg";

import { WHISPER_MODEL_ID } from "./transcribe";

/**
 * Usage metering pro Whisper (BUILD-06 plán, Rozhodnutí 4 — "M1 deploy gate
 * vyžaduje usage_ledger zápis hotový už teď, ne odloženě do BUILD-27").
 * Referenční sazba přímo z Technical Architecture v1.2 §28 ("Whisper-1:
 * $0.006 / min") — `pricing_catalog` lookup je BUILD-27, ne BUILD-06.
 *
 * `recordWhisperUsage` bere `PoolClient`, ne `Pool` — volá se ZEVNITŘ
 * `commitVoiceTranscript`ovy transakce, aby transcript i usage záznam
 * vznikly atomicky (buď oba, nebo žádný).
 */
export const WHISPER_PURPOSE = "voice_transcription";
export const WHISPER_RATE_USD_PER_MINUTE = 0.006;

export async function recordWhisperUsage(client: PoolClient, ownerId: string, durationSeconds: number): Promise<void> {
  const quantityMinutes = durationSeconds / 60;
  const costUsd = quantityMinutes * WHISPER_RATE_USD_PER_MINUTE;
  await client.query(
    `insert into usage_ledger (owner_id, purpose, model_id, unit, quantity, cost_usd)
     values ($1, $2, $3, 'minutes', $4, $5)`,
    [ownerId, WHISPER_PURPOSE, WHISPER_MODEL_ID, quantityMinutes, costUsd],
  );
}
