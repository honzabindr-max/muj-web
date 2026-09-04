import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { withOwnerScope } from "@/h2/db/with-owner-scope";
import { CALL_TIMEOUT_MS } from "@/h2/prompts/anthropic-adapter";

import { H2FencingError } from "./errors";
import { isJobExhausted, processingBudgetMsFor, quarantineJob } from "./quarantine";

/**
 * Fencing token — vrací ho claimNextJob(), spotřebovává commitJobResult()
 * a recordJobFailure() (Technical Architecture v1.2 §4.2/§4.3, BUILD-05
 * plán). leaseEpoch/ownerControlEpoch jsou owner-globální (jeden aktivní
 * job na ownera najednou — §4.3 striktní pořadí podle input_sequence),
 * takže jeden pár epoch stačí k fencingu, ne per-job counter.
 */
export type FencingToken = {
  ownerId: string;
  jobId: string;
  rawEventId: string;
  processorId: string;
  leaseEpoch: bigint;
  ownerControlEpoch: bigint;
  attemptCount: number;
  processingBudgetMs: number;
  chargedProcessingMs: number;
};

export const LEASE_DURATION_SECONDS = 60;

type OwnerStateRow = {
  active_job_id: string | null;
  lease_until: Date | null;
  lease_epoch: string;
  owner_control_epoch: string;
};

type CandidateJobRow = {
  id: string;
  raw_event_id: string;
  attempt_count: number;
  payload_type: string;
};

/**
 * Reap větev (BUILD-11 Rozhodnutí 9/DEC-008) potřebuje navíc
 * charged_processing_ms/processing_budget_ms pro isJobExhausted()
 * kontrolu PŘED rozhodnutím karanténa-vs-reklaimovat — CandidateJobRow
 * pro čerstvý claim tyhle sloupce nepotřebuje (claimSpecificJob() je
 * čte fresh z RETURNING).
 */
type ActiveJobRow = CandidateJobRow & {
  charged_processing_ms: string;
  processing_budget_ms: string | null;
};

async function claimSpecificJob(
  client: PoolClient,
  ownerId: string,
  job: CandidateJobRow,
  currentLeaseEpoch: bigint,
  currentControlEpoch: bigint,
  processorId: string,
): Promise<FencingToken> {
  const newLeaseEpoch = currentLeaseEpoch + BigInt(1);
  const leaseUntil = new Date(Date.now() + LEASE_DURATION_SECONDS * 1000);
  const budgetMs = processingBudgetMsFor(job.payload_type);

  await client.query(
    `update owner_processing_state
     set active_job_id = $2, lease_until = $3, lease_epoch = $4, updated_at = now()
     where owner_id = $1`,
    [ownerId, job.id, leaseUntil, newLeaseEpoch],
  );

  const jobUpdate = await client.query<{ attempt_count: number; charged_processing_ms: string; processing_budget_ms: string }>(
    `update message_processing_jobs
     set status = 'PROCESSING',
         attempt_count = attempt_count + 1,
         first_started_at = coalesce(first_started_at, now()),
         started_at = now(),
         lease_until = $2,
         processor_id = $3,
         processing_budget_ms = coalesce(processing_budget_ms, $4),
         updated_at = now()
     where id = $1
     returning attempt_count, charged_processing_ms, processing_budget_ms`,
    [job.id, leaseUntil, processorId, budgetMs],
  );

  return {
    ownerId,
    jobId: job.id,
    rawEventId: job.raw_event_id,
    processorId,
    leaseEpoch: newLeaseEpoch,
    ownerControlEpoch: currentControlEpoch,
    attemptCount: jobUpdate.rows[0].attempt_count,
    processingBudgetMs: Number(jobUpdate.rows[0].processing_budget_ms),
    chargedProcessingMs: Number(jobUpdate.rows[0].charged_processing_ms),
  };
}

const OPEN_JOB_CANDIDATE_QUERY = `
  select mpj.id, mpj.raw_event_id, mpj.attempt_count, re.payload_type
  from message_processing_jobs mpj
  join raw_events re on re.id = mpj.raw_event_id
  where mpj.owner_id = $1
    and mpj.status in ('PENDING', 'RETRY_PENDING')
    and mpj.available_at <= now()
    and re.input_sequence = (
      select min(re2.input_sequence)
      from message_processing_jobs mpj2
      join raw_events re2 on re2.id = mpj2.raw_event_id
      where mpj2.owner_id = $1
        and mpj2.status in ('PENDING', 'PROCESSING', 'RETRY_PENDING')
    )
  limit 1
`;

/**
 * ABANDONED_UNKNOWN accounting (BUILD-11 Rozhodnutí 9/DEC-008) — reklamuje
 * jakýkoli v letu zaseklý `llm_attempts` `CALL_INTENT` řádek pro
 * reapovaný job: `min(reap_time - created_at, CALL_TIMEOUT_MS)` se
 * připočte k `charged_processing_ms`, NIKDY plochá hodnota a NIKDY doba,
 * po kterou job ležel bez executoru (opravený nález oproti v1 tohohle
 * rozhodnutí — "NEJVÝŠE" hard timeout stage, ne "vždy přesně": plochá
 * hodnota by vynucovala 60s i pro pokus, co spadl prakticky okamžitě po
 * insertu, a vracela by zpátky přesně tu asymetrii, kvůli které DEC-008
 * vznikl). Pokud žádný `CALL_INTENT` řádek neexistuje (procesor spadl
 * dřív, než stihl zavolat cokoliv externího), nepřipočte se nic. Vrací
 * nový součet `charged_processing_ms` na jobu (po připočtení), aby ho
 * volající mohl rovnou použít pro `isJobExhausted()` bez dalšího SELECTu.
 */
async function reapAbandonedLlmAttempts(client: PoolClient, jobId: string, priorChargedMs: number): Promise<number> {
  const reapTime = new Date();
  const inFlight = await client.query<{ id: string; created_at: Date }>(
    `select id, created_at from llm_attempts where job_id = $1 and status = 'CALL_INTENT'`,
    [jobId],
  );
  if ((inFlight.rowCount ?? 0) === 0) return priorChargedMs;

  let abandonedTotalMs = 0;
  for (const row of inFlight.rows) {
    const elapsedMs = reapTime.getTime() - row.created_at.getTime();
    const chargedMs = Math.min(elapsedMs, CALL_TIMEOUT_MS);
    abandonedTotalMs += chargedMs;
    await client.query(
      `update llm_attempts set status = 'ABANDONED_UNKNOWN', charged_processing_ms = $2, resolved_at = $3 where id = $1`,
      [row.id, chargedMs, reapTime],
    );
  }

  const newChargedMs = priorChargedMs + abandonedTotalMs;
  await client.query(`update message_processing_jobs set charged_processing_ms = $2, updated_at = now() where id = $1`, [
    jobId,
    newChargedMs,
  ]);
  return newChargedMs;
}

/**
 * claimNextJob() — nejnižší dostupná processable sequence (§4.3). Jeden
 * job na ownera najednou; QUARANTINED a RESPONSE_READY/DELIVERED jsou
 * "settled" a neblokují (BUILD-05 plán).
 *
 * Owner-scoped transakce zamyká owner_processing_state řádek (`for
 * update`) — to samo serializuje konkurentní claimNextJob() volání pro
 * stejného ownera, žádný samostatný advisory lock není potřeba.
 *
 * Reap větev: pokud má aktivní job vypršelý lease (procesor zmrzl/spadl
 * bez explicitního nahlášení selhání), buď se okamžitě reklamuje jako nový
 * pokus (bez backoff — vypršení leasu SAMO je ta čekací doba, AT-07/AT-67),
 * nebo — pokud jsou vyčerpané pokusy/deadline — jde do karantény a claim
 * pokračuje na dalším jobu v pořadí (AT-54).
 */
export async function claimNextJob(pool: Pool, ownerId: string, processorId: string = randomUUID()): Promise<FencingToken | null> {
  return withOwnerScope(pool, ownerId, async (client) => {
    await client.query(`insert into owner_processing_state (owner_id) values ($1) on conflict (owner_id) do nothing`, [
      ownerId,
    ]);
    const stateResult = await client.query<OwnerStateRow>(
      `select active_job_id, lease_until, lease_epoch, owner_control_epoch
       from owner_processing_state where owner_id = $1 for update`,
      [ownerId],
    );
    const state = stateResult.rows[0];
    const leaseEpoch = BigInt(state.lease_epoch);
    const controlEpoch = BigInt(state.owner_control_epoch);
    const now = new Date();

    if (state.active_job_id !== null && state.lease_until !== null && state.lease_until <= now) {
      const activeJobResult = await client.query<ActiveJobRow>(
        `select mpj.id, mpj.raw_event_id, mpj.attempt_count, mpj.charged_processing_ms, mpj.processing_budget_ms, re.payload_type
         from message_processing_jobs mpj
         join raw_events re on re.id = mpj.raw_event_id
         where mpj.id = $1 and mpj.status = 'PROCESSING'`,
        [state.active_job_id],
      );
      const activeJob = activeJobResult.rows[0];
      if (activeJob) {
        const chargedAfterReap = await reapAbandonedLlmAttempts(client, activeJob.id, Number(activeJob.charged_processing_ms));
        const exhausted = isJobExhausted({
          attempt_count: activeJob.attempt_count,
          charged_processing_ms: chargedAfterReap,
          processing_budget_ms: activeJob.processing_budget_ms !== null ? Number(activeJob.processing_budget_ms) : null,
        });
        if (exhausted) {
          await quarantineJob(client, ownerId, activeJob.id, "LEASE_EXPIRED_ATTEMPTS_EXHAUSTED");
        } else {
          return claimSpecificJob(client, ownerId, activeJob, leaseEpoch, controlEpoch, processorId);
        }
      }
    }

    const candidateResult = await client.query<CandidateJobRow>(OPEN_JOB_CANDIDATE_QUERY, [ownerId]);
    const candidate = candidateResult.rows[0];
    if (!candidate) return null;

    return claimSpecificJob(client, ownerId, candidate, leaseEpoch, controlEpoch, processorId);
  });
}

/**
 * Heartbeat pro dlouho běžící pokus — prodlouží lease beze změny epoch.
 * Fencing-chráněné stejným vzorem jako commitJobResult/recordJobFailure:
 * pokud mezitím někdo jiný reklamoval job (nebo přišel control command),
 * token je neaktuální a volání selže explicitně.
 */
export async function renewLease(
  pool: Pool,
  token: FencingToken,
  extendSeconds: number = LEASE_DURATION_SECONDS,
): Promise<FencingToken> {
  return withOwnerScope(pool, token.ownerId, async (client) => {
    const leaseUntil = new Date(Date.now() + extendSeconds * 1000);
    const result = await client.query(
      `update owner_processing_state
       set lease_until = $2, updated_at = now()
       where owner_id = $1 and lease_epoch = $3 and owner_control_epoch = $4
       returning lease_until`,
      [token.ownerId, leaseUntil, token.leaseEpoch, token.ownerControlEpoch],
    );
    if ((result.rowCount ?? 0) === 0) {
      throw new H2FencingError("STALE_FENCING_TOKEN", token.jobId);
    }
    await client.query(`update message_processing_jobs set lease_until = $2, updated_at = now() where id = $1`, [
      token.jobId,
      leaseUntil,
    ]);
    return { ...token };
  });
}
