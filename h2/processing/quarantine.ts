import type { Pool, PoolClient } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import { H2FencingError } from "./errors";
import type { FencingToken } from "./lease";

/**
 * Deadline/retry/backoff/quarantine (Technical Architecture v1.2 §4.3,
 * BUILD-05 plán). Backoff 5s→15s→30s, max 3 pokusy.
 *
 * BUILD-11 Rozhodnutí 9 (DEC-008): "vyčerpán čas" test se přesunul z
 * wall-clock `processing_deadline_at` (dřívější BUILD-05 sémantika,
 * měřilo čas od prvního pokusu včetně čekání na volný executor) na
 * ACTIVE/stage processing budget (`processing_budget_ms` vs.
 * `charged_processing_ms`, měřeno přes `llm_attempts` — Rozhodnutí 10).
 * Lease expiry a backoff/`available_at` zůstávají wall clock beze změny
 * (§4.3) — DEC-008 mění výhradně tenhle jeden test.
 */
export const RETRY_BACKOFF_SECONDS: readonly number[] = [5, 15, 30];
export const MAX_ATTEMPTS = 3;
export const PROCESSING_BUDGET_MS: Readonly<Record<"TEXT" | "VOICE", number>> = { TEXT: 120_000, VOICE: 300_000 };

export type JobFailureOutcome = "RETRIED" | "QUARANTINED" | "ALREADY_QUARANTINED";

type JobExhaustionSnapshot = {
  attempt_count: number;
  charged_processing_ms: number;
  processing_budget_ms: number | null;
};

export function processingBudgetMsFor(payloadType: string): number {
  return payloadType === "VOICE" ? PROCESSING_BUDGET_MS.VOICE : PROCESSING_BUDGET_MS.TEXT;
}

/**
 * Terminální přechod do QUARANTINED — atomická UPDATE ... WHERE status <>
 * 'QUARANTINED' garantuje, že incident vznikne přesně jednou i při
 * souběžném pokusu o dvojí karanténu (AT-54). quarantine_notice_sent_at má
 * VLASTNÍ nezávislý WHERE IS NULL guard (BUILD-05 plán, Rozhodnutí 3) —
 * exactly-once notice marker, i kdyby se sem někdy vstoupilo dvěma
 * nezávislými cestami pro stejný job.
 */
export async function quarantineJob(
  client: PoolClient,
  ownerId: string,
  jobId: string,
  reasonCode: string,
): Promise<void> {
  const statusTransition = await client.query(
    `update message_processing_jobs
     set status = 'QUARANTINED', quarantined_at = now(), quarantine_reason = $2, updated_at = now()
     where id = $1 and status <> 'QUARANTINED'
     returning id`,
    [jobId, reasonCode],
  );
  if ((statusTransition.rowCount ?? 0) > 0) {
    await client.query(
      `insert into incidents (owner_id, incident_type, severity, detail_code) values ($1, 'MESSAGE_QUARANTINED', 'WARNING', $2)`,
      [ownerId, reasonCode],
    );
  }
  await client.query(
    `update message_processing_jobs set quarantine_notice_sent_at = now() where id = $1 and quarantine_notice_sent_at is null`,
    [jobId],
  );
  await client.query(
    `update owner_processing_state set active_job_id = null, lease_until = null, updated_at = now() where owner_id = $1 and active_job_id = $2`,
    [ownerId, jobId],
  );
}

export function isJobExhausted(job: JobExhaustionSnapshot): boolean {
  if (job.attempt_count >= MAX_ATTEMPTS) return true;
  if (job.processing_budget_ms !== null && job.charged_processing_ms >= job.processing_budget_ms) return true;
  return false;
}

/**
 * Součet `charged_processing_ms` z `llm_attempts` vzniklých BĚHEM
 * aktuálního pokusu. `claimSpecificJob()` (`h2/processing/lease.ts`)
 * nastavuje `started_at = now()` na KAŽDÉM claimu (první i retry), takže
 * `created_at >= attemptStartedAt` přirozeně odděluje "tenhle pokus" od
 * předchozích bez potřeby dalšího bookkeeping sloupce na `llm_attempts`.
 * Jen `SUCCEEDED`/`FAILED_CONFIRMED` — `ABANDONED_UNKNOWN` se účtuje
 * výhradně v reap větvi (`h2/processing/lease.ts`), ne tady (`CALL_INTENT`
 * řádek, který by tu `resolveJobFailure()` viděla, patří k PRÁVĚ
 * běžícímu pokusu, ne dokončenému — `withLlmAttempt()` vždy stihne
 * volání vyřešit dřív, než chyba propaguje sem).
 */
async function sumAttemptChargedMs(client: PoolClient, jobId: string, attemptStartedAt: Date): Promise<number> {
  const result = await client.query<{ total: string }>(
    `select coalesce(sum(charged_processing_ms), 0) as total
     from llm_attempts
     where job_id = $1 and status in ('SUCCEEDED', 'FAILED_CONFIRMED') and created_at >= $2`,
    [jobId, attemptStartedAt],
  );
  return Number(result.rows[0].total);
}

/**
 * Sdílená rozhodovací logika pro EXPLICITNÍ nahlášené selhání (work()
 * throwl) — na rozdíl od pasivního vypršení leasu (h2/processing/lease.ts
 * reap), tady procesor ví HNED, že pokus selhal, takže se uplatní backoff
 * před dalším pokusem (nehádá se "je mrtvý, nebo jen pomalý").
 *
 * BUILD-11 Rozhodnutí 3 — `retryable` je vstupní klasifikace, kterou
 * volající odvodí z chyby (např. `H2AnthropicCallError.code` přes
 * `ANTHROPIC_ERROR_RETRYABLE` lookup tabulku, `h2/prompts/errors.ts`), ne
 * něco, co si `resolveJobFailure` hádá ze `reasonCode` stringu samo.
 * `retryable === false` → okamžitá karanténa bez ohledu na
 * `attempt_count` (neretryovatelná chyba jako auth/bad request/refuz by
 * jinak čekala 3 marné pokusy s exponenciálním backoffem, než by šla do
 * karantény zbytečně). `retryAfterSeconds` (z `retry-after` hlavičky
 * 429 odpovědi) přebije `RETRY_BACKOFF_SECONDS` ladder, pokud je
 * přítomný.
 *
 * BUILD-11 Rozhodnutí 9 (DEC-008) — `charged_processing_ms` se navýší o
 * měřenou dobu tohohle pokusu PŘED `isJobExhausted()` kontrolou, a to i
 * na neretryovatelné/karanténní větvi (práce se stala, i když se
 * nebude opakovat — accounting má odrážet skutečnou spotřebu).
 */
async function resolveJobFailure(
  client: PoolClient,
  ownerId: string,
  jobId: string,
  reasonCode: string,
  errorDetail: string | null,
  retryable: boolean,
  retryAfterSeconds?: number,
): Promise<JobFailureOutcome> {
  const jobResult = await client.query<{
    status: string;
    attempt_count: number;
    charged_processing_ms: string;
    processing_budget_ms: string | null;
    started_at: Date | null;
  }>(
    `select status, attempt_count, charged_processing_ms, processing_budget_ms, started_at
     from message_processing_jobs where id = $1`,
    [jobId],
  );
  const job = jobResult.rows[0];
  if (job.status === "QUARANTINED") return "ALREADY_QUARANTINED";

  const attemptChargedMs = job.started_at !== null ? await sumAttemptChargedMs(client, jobId, job.started_at) : 0;
  const newChargedMs = Number(job.charged_processing_ms) + attemptChargedMs;
  await client.query(`update message_processing_jobs set charged_processing_ms = $2, updated_at = now() where id = $1`, [
    jobId,
    newChargedMs,
  ]);

  const exhausted = isJobExhausted({
    attempt_count: job.attempt_count,
    charged_processing_ms: newChargedMs,
    processing_budget_ms: job.processing_budget_ms !== null ? Number(job.processing_budget_ms) : null,
  });

  if (!retryable || exhausted) {
    await quarantineJob(client, ownerId, jobId, reasonCode);
    return "QUARANTINED";
  }

  const backoffSeconds =
    retryAfterSeconds ?? RETRY_BACKOFF_SECONDS[Math.min(job.attempt_count - 1, RETRY_BACKOFF_SECONDS.length - 1)];
  await client.query(
    `update message_processing_jobs
     set status = 'RETRY_PENDING',
         available_at = now() + make_interval(secs => $2),
         last_error_code = $3,
         last_error_detail = $4,
         updated_at = now()
     where id = $1`,
    [jobId, backoffSeconds, reasonCode, errorDetail],
  );
  await client.query(
    `update owner_processing_state set active_job_id = null, lease_until = null, updated_at = now() where owner_id = $1 and active_job_id = $2`,
    [ownerId, jobId],
  );
  return "RETRIED";
}

/**
 * Veřejné API: procesor explicitně nahlásí, že jeho work() selhal
 * (throwlo). Fencing-chráněné stejným epoch-check vzorem jako
 * commitJobResult — jinak by mohl neaktuální procesor omylem poslat do
 * retry/karantény job, který mezitím reklamoval a už zpracoval někdo jiný.
 *
 * `retryable` (BUILD-11 Rozhodnutí 3): volající musí zachycenou chybu
 * napřed zmapovat na retryable/retryAfterSeconds (viz `resolveJobFailure`
 * doc výše) — dnes nikdo v produkci `recordJobFailure()` nevolá (BUILD-11's
 * trigger je Krok 4), takže tohle mapování zatím dělají jen testy.
 */
export async function recordJobFailure(
  pool: Pool,
  token: FencingToken,
  reasonCode: string,
  retryable: boolean,
  errorDetail: string | null = null,
  retryAfterSeconds?: number,
): Promise<JobFailureOutcome> {
  return withOwnerScope(pool, token.ownerId, async (client) => {
    const stateResult = await client.query<{ lease_epoch: string; owner_control_epoch: string }>(
      `select lease_epoch, owner_control_epoch from owner_processing_state where owner_id = $1 for update`,
      [token.ownerId],
    );
    const state = stateResult.rows[0];
    if (
      !state ||
      BigInt(state.lease_epoch) !== token.leaseEpoch ||
      BigInt(state.owner_control_epoch) !== token.ownerControlEpoch
    ) {
      throw new H2FencingError("STALE_FENCING_TOKEN", token.jobId);
    }
    return resolveJobFailure(client, token.ownerId, token.jobId, reasonCode, errorDetail, retryable, retryAfterSeconds);
  });
}
