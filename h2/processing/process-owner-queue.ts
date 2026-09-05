import type { Pool } from "pg";

import { runCommandGate } from "@/h2/buddy/command-gate";
import { H2BuddyRuntimeError } from "@/h2/buddy/errors";
import { generateBuddyResponse, readMessageText } from "@/h2/buddy/generate-response";
import { H2_MODELS } from "@/h2/config/models";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import type { DeliveryProviderConfig } from "@/h2/delivery/config";
import { deliverResponse } from "@/h2/delivery/deliver-response";
import { sendQuarantineNotice } from "@/h2/delivery/quarantine-notice";
import { DELIVERY_CALL_TIMEOUT_MS } from "@/h2/delivery/telegram-send";
import { H2ExtractionError } from "@/h2/extraction/errors";
import { extractOperationalCandidates, OPERATIONAL_EXTRACTION_PURPOSE } from "@/h2/extraction/operational-extraction";
import { logH2Event } from "@/h2/logging/logger";
import { CALL_TIMEOUT_MS } from "@/h2/prompts/anthropic-adapter";
import type { PromptProviderConfig } from "@/h2/prompts/config";
import { ANTHROPIC_ERROR_RETRYABLE, H2AnthropicCallError } from "@/h2/prompts/errors";

import { H2FencingError } from "./errors";
import { claimNextJob } from "./lease";
import type { FencingToken } from "./lease";
import { withLlmAttempt } from "./llm-attempts";
import { recordJobFailure } from "./quarantine";

export type ProcessQueueCredentials = PromptProviderConfig & DeliveryProviderConfig;

const BUDDY_RESPONSE_PURPOSE = "BUDDY_RESPONSE";

/**
 * BUILD-11 Rozhodnutí 1 — pesimistický horní odhad hard timeoutů VŠECH
 * stages, co smyčka pro JEDEN job může spustit: OPERATIONAL_EXTRACTION
 * (Haiku) + BUDDY_RESPONSE (Sonnet) sdílejí `CALL_TIMEOUT_MS`
 * (`h2/prompts/anthropic-adapter.ts`), plus Telegram delivery
 * (`DELIVERY_CALL_TIMEOUT_MS`), plus malá režie na DB round-tripy
 * (claim/commit/upsert). NENÍ to očekávaná doba (typický běh je řádově
 * sekundy) — je to horní mez použitá PŘED každým dalším `claimNextJob()`,
 * aby smyčka nikdy nezačala práci, kterou provokativně nemůže stihnout
 * dokončit v rámci zbývajícího function budgetu.
 */
const DB_OVERHEAD_MS = 5_000;
export const WORST_CASE_JOB_DURATION_MS = CALL_TIMEOUT_MS * 2 + DELIVERY_CALL_TIMEOUT_MS + DB_OVERHEAD_MS;

/** Rezerva odečtená z route `maxDuration` PŘED výpočtem `deadlineAt` — místo pro ACK response write / after() scheduling overhead. */
export const DEFAULT_QUEUE_DEADLINE_SAFETY_MARGIN_MS = 5_000;

export function computeQueueDeadline(
  requestStartedAtMs: number,
  routeMaxDurationSeconds: number,
  safetyMarginMs: number = DEFAULT_QUEUE_DEADLINE_SAFETY_MARGIN_MS,
): Date {
  return new Date(requestStartedAtMs + routeMaxDurationSeconds * 1000 - safetyMarginMs);
}

export type ProcessQueueStoppedReason = "QUEUE_EMPTY" | "BUDGET_EXHAUSTED";

export type ProcessQueueOutcome = {
  jobsProcessed: number;
  stoppedReason: ProcessQueueStoppedReason;
};

/**
 * BUILD-11 Rozhodnutí 3 — mapuje zachycenou chybu na `recordJobFailure()`'s
 * `retryable`/`retryAfterSeconds` vstup. `H2AnthropicCallError` čte
 * `ANTHROPIC_ERROR_RETRYABLE` lookup tabulku (`h2/prompts/errors.ts`).
 * Cokoli neznámé je default-deny (neretryovatelné) — stejná filosofie jako
 * `ANTHROPIC_HTTP_ERROR` fallback, aby neočekávaná chyba/bug nezpůsobila
 * tichou nekonečnou retry smyčku.
 */
function classifyError(error: unknown): { reasonCode: string; retryable: boolean; retryAfterSeconds?: number } {
  if (error instanceof H2AnthropicCallError) {
    return {
      reasonCode: error.code,
      retryable: ANTHROPIC_ERROR_RETRYABLE[error.code],
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error instanceof H2BuddyRuntimeError) {
    return { reasonCode: error.code, retryable: false };
  }
  return { reasonCode: "UNKNOWN_ERROR", retryable: false };
}

/**
 * Best-effort (Rozhodnutí 1) — chyba se zaloguje, NIKDY nezablokuje Buddy
 * odpověď. Extrakce sama nevlastní žádný job/response, takže selhání se
 * nemapuje na `recordJobFailure()`.
 */
async function tryExtractOperationalCandidates(
  pool: Pool,
  credentials: PromptProviderConfig,
  token: FencingToken,
  messageText: string,
): Promise<void> {
  try {
    await withLlmAttempt(pool, token, OPERATIONAL_EXTRACTION_PURPOSE, H2_MODELS.extraction, () =>
      extractOperationalCandidates(pool, token.ownerId, token.rawEventId, messageText, credentials),
    );
  } catch (error) {
    logH2Event({
      purpose: "extraction_operational",
      status: "error",
      ownerId: token.ownerId,
      jobId: token.jobId,
      errorCode: error instanceof H2ExtractionError ? error.code : "EXTRACTION_UNKNOWN_ERROR",
    });
  }
}

/**
 * Zpracuje JEDEN claimnutý job — extrakce (best-effort, přeskočena pro
 * control command, stejné pořadí jako §7.1: Command Gate PŘED entity/
 * intent detekcí) → Buddy response (metered přes `withLlmAttempt`,
 * Rozhodnutí 10) → Telegram delivery (Rozhodnutí 4/6). Telegram je jediný
 * kanál s reálnou delivery-timing nejistotou (AT-10) — web je čistě pull
 * projekce (`GET /api/h2/web/responses` čte `responses` přímo, nezávisle
 * na `response_deliveries`), proto se tu nevolá i pro `channel='web'`
 * (Krok 4 orchestrace rozhodnutí, ne z plánu doslovně).
 *
 * `H2FencingError` (token zestárl — jiný procesor mezitím job reklamoval,
 * nebo přišel control command) se NEMAPUJE na `recordJobFailure()` — ten
 * by se stejným tokenem selhal identicky (fencing check uvnitř). Nechá se
 * na tom, kdo job aktuálně vlastní.
 */
async function processOneJob(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  credentials: ProcessQueueCredentials,
  token: FencingToken,
): Promise<void> {
  try {
    const messageText = await readMessageText(pool, registry, token.ownerId, token.rawEventId);

    if (!runCommandGate(messageText).isControlCommand) {
      await tryExtractOperationalCandidates(pool, credentials, token, messageText);
    }

    const result = await withLlmAttempt(pool, token, BUDDY_RESPONSE_PURPOSE, H2_MODELS.buddy, () =>
      generateBuddyResponse(pool, registry, credentials, token),
    );
    await deliverResponse(pool, registry, token.ownerId, result.responseId, "telegram", credentials);
  } catch (error) {
    if (error instanceof H2FencingError) {
      logH2Event({
        purpose: "processing",
        status: "error",
        ownerId: token.ownerId,
        jobId: token.jobId,
        errorCode: "STALE_FENCING_TOKEN",
      });
      return;
    }

    const { reasonCode, retryable, retryAfterSeconds } = classifyError(error);
    try {
      const outcome = await recordJobFailure(pool, token, reasonCode, retryable, String(error).slice(0, 500), retryAfterSeconds);
      if (outcome === "QUARANTINED") {
        await sendQuarantineNotice(pool, token.ownerId, token.jobId, credentials);
      }
    } catch (recordError) {
      if (recordError instanceof H2FencingError) {
        logH2Event({
          purpose: "processing",
          status: "error",
          ownerId: token.ownerId,
          jobId: token.jobId,
          errorCode: "STALE_FENCING_TOKEN_ON_FAILURE_RECORD",
        });
        return;
      }
      throw recordError;
    }
  }
}

/**
 * BUILD-11 Rozhodnutí 1 (revidováno po adversarial gate) — rozpočtem času
 * ohraničená smyčka, volaná z `after()` v obou ingest routách (latence
 * optimalizace) I z nezávislého wake endpointu (Rozhodnutí 8, liveness).
 * Kontrola `remaining < WORST_CASE_JOB_DURATION_MS` proběhne PŘED KAŽDÝM
 * dalším `claimNextJob()`, ne jen na začátku — dvě rychlé zprávy stejného
 * ownera by jinak mohly smyčku natáhnout přes hranici, kde by druhý job
 * zbytečně začal, ale nestihl dokončit. `deadlineAt` je zodpovědnost
 * volajícího (route zná svůj vlastní `maxDuration`) — `computeQueueDeadline()`
 * výše je sdílený helper pro tenhle výpočet.
 */
export async function processOwnerQueueBounded(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  credentials: ProcessQueueCredentials,
  ownerId: string,
  deadlineAt: Date,
): Promise<ProcessQueueOutcome> {
  let jobsProcessed = 0;
  for (;;) {
    const remainingMs = deadlineAt.getTime() - Date.now();
    if (remainingMs < WORST_CASE_JOB_DURATION_MS) {
      return { jobsProcessed, stoppedReason: "BUDGET_EXHAUSTED" };
    }

    const token = await claimNextJob(pool, ownerId);
    if (!token) {
      return { jobsProcessed, stoppedReason: "QUEUE_EMPTY" };
    }

    await processOneJob(pool, registry, credentials, token);
    jobsProcessed += 1;
  }
}
