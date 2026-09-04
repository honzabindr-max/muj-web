import type { Pool } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import type { FencingToken } from "./lease";

/**
 * BUILD-11 Rozhodnutí 10 — `llm_attempts` CALL_INTENT metering.
 *
 * `withLlmAttempt()` insertne `CALL_INTENT` řádek v jedné krátké
 * transakci (to je "claim" volání ve výkladu (b), ROZHODNUTO 2026-09-04 —
 * viz BUILD-11-PLAN.md Rozhodnutí 10), pak zavolá `fn()` MIMO transakci
 * (externí síťové volání se nedrží DB transakce otevřené přes network
 * round-trip, stejný vzor jako `commitJobResult()`), pak podle výsledku
 * updatne řádek na `SUCCEEDED`/`FAILED_CONFIRMED` a zapíše měřenou dobu
 * do `charged_processing_ms`.
 *
 * `ABANDONED_UNKNOWN` přechod (reap větev po vypršelém leasu) je BUILD-11
 * Krok 2 (DEC-008, Rozhodnutí 9) — mimo scope tohoto helperu, dnes nikdo
 * tenhle status nenastavuje.
 */
export async function withLlmAttempt<T>(
  pool: Pool,
  token: FencingToken,
  purpose: string,
  modelId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const attemptId = await withOwnerScope(pool, token.ownerId, async (client) => {
    const inserted = await client.query<{ id: string }>(
      `insert into llm_attempts (owner_id, job_id, purpose, model_id, status)
       values ($1, $2, $3, $4, 'CALL_INTENT')
       returning id`,
      [token.ownerId, token.jobId, purpose, modelId],
    );
    return inserted.rows[0].id;
  });

  const startedAt = Date.now();
  try {
    const value = await fn();
    await withOwnerScope(pool, token.ownerId, (client) =>
      client.query(
        `update llm_attempts set status = 'SUCCEEDED', charged_processing_ms = $2, resolved_at = now() where id = $1`,
        [attemptId, Date.now() - startedAt],
      ),
    );
    return value;
  } catch (error) {
    await withOwnerScope(pool, token.ownerId, (client) =>
      client.query(
        `update llm_attempts set status = 'FAILED_CONFIRMED', charged_processing_ms = $2, resolved_at = now() where id = $1`,
        [attemptId, Date.now() - startedAt],
      ),
    );
    throw error;
  }
}
