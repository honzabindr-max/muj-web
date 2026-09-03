import type { Pool, PoolClient } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";

import { H2FencingError } from "./errors";
import type { FencingToken } from "./lease";

/**
 * Deadline/retry/backoff/quarantine (Technical Architecture v1.2 §4.3,
 * BUILD-05 plán). Backoff 5s→15s→30s, max 3 pokusy, text deadline 120s /
 * voice deadline 300s (§4.2 processing_deadline_at, počítané od PRVNÍHO
 * pokusu — nemění se mezi retry).
 */
export const RETRY_BACKOFF_SECONDS: readonly number[] = [5, 15, 30];
export const MAX_ATTEMPTS = 3;
export const DEADLINE_SECONDS: Readonly<Record<"TEXT" | "VOICE", number>> = { TEXT: 120, VOICE: 300 };

export type JobFailureOutcome = "RETRIED" | "QUARANTINED" | "ALREADY_QUARANTINED";

type JobSnapshot = {
  status: string;
  attempt_count: number;
  processing_deadline_at: Date | null;
};

export function deadlineSecondsFor(payloadType: string): number {
  return payloadType === "VOICE" ? DEADLINE_SECONDS.VOICE : DEADLINE_SECONDS.TEXT;
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

export function isJobExhausted(job: JobSnapshot, now: Date): boolean {
  if (job.attempt_count >= MAX_ATTEMPTS) return true;
  if (job.processing_deadline_at !== null && now > job.processing_deadline_at) return true;
  return false;
}

/**
 * Sdílená rozhodovací logika pro EXPLICITNÍ nahlášené selhání (work()
 * throwl) — na rozdíl od pasivního vypršení leasu (h2/processing/lease.ts
 * reap), tady procesor ví HNED, že pokus selhal, takže se uplatní backoff
 * před dalším pokusem (nehádá se "je mrtvý, nebo jen pomalý").
 */
async function resolveJobFailure(
  client: PoolClient,
  ownerId: string,
  jobId: string,
  reasonCode: string,
  errorDetail: string | null,
): Promise<JobFailureOutcome> {
  const jobResult = await client.query<JobSnapshot>(
    `select status, attempt_count, processing_deadline_at from message_processing_jobs where id = $1`,
    [jobId],
  );
  const job = jobResult.rows[0];
  if (job.status === "QUARANTINED") return "ALREADY_QUARANTINED";

  if (isJobExhausted(job, new Date())) {
    await quarantineJob(client, ownerId, jobId, reasonCode);
    return "QUARANTINED";
  }

  const backoffSeconds = RETRY_BACKOFF_SECONDS[Math.min(job.attempt_count - 1, RETRY_BACKOFF_SECONDS.length - 1)];
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
 */
export async function recordJobFailure(
  pool: Pool,
  token: FencingToken,
  reasonCode: string,
  errorDetail: string | null = null,
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
    return resolveJobFailure(client, token.ownerId, token.jobId, reasonCode, errorDetail);
  });
}
