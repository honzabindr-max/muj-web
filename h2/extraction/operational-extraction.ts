import type { Pool } from "pg";

import { H2_MODELS } from "@/h2/config/models";
import { H2ContextBudgetError } from "@/h2/context/errors";
import { CONTEXT_TOKEN_BUDGETS, estimateTokens } from "@/h2/context/token-budget";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import type { AnthropicCallResult } from "@/h2/prompts/anthropic-adapter";
import { callAnthropicModel } from "@/h2/prompts/anthropic-adapter";
import type { PromptProviderConfig } from "@/h2/prompts/config";
import { recordLlmRun } from "@/h2/prompts/llm-run";
import { getActivePromptVersion } from "@/h2/prompts/registry";
import { recordAnthropicUsage } from "@/h2/prompts/usage";

import { H2ExtractionError } from "./errors";
import { OperationalExtractionOutputSchema } from "./operational-schema";

/**
 * Realtime Haiku extrakce strukturovaných operational kandidátů (BUILD-08
 * plán). Zapisuje jen do `operational_extractions.output` (jsonb) — žádné
 * řádky v `tasks`/`commitments`/`open_loops`/`reminders` (Rozhodnutí 1,
 * BUILD-12). Žádný produkční trigger (Rozhodnutí 3, BUILD-10 zapojí).
 *
 * `model_id`/`purpose` jsou od začátku rozlišitelné od Sonnetu/Buddy
 * (Rozhodnutí 5) — `H2_MODELS.extraction`, `purpose='OPERATIONAL_
 * EXTRACTION'`, konzistentně napříč `prompt_versions`/`llm_runs`/
 * `usage_ledger`.
 */
export const OPERATIONAL_EXTRACTION_PURPOSE = "OPERATIONAL_EXTRACTION";
export const OPERATIONAL_EXTRACTION_EXTRACTOR_VERSION = "1";
const OPERATIONAL_EXTRACTION_MAX_OUTPUT_TOKENS = 2048;

export type CallAnthropicModelFn = (
  modelId: string,
  promptContent: string,
  input: string,
  apiKey: string,
  maxOutputTokens?: number,
) => Promise<AnthropicCallResult>;

export type ExtractOperationalCandidatesResult = {
  status: "OK" | "INVALID";
  extractionId: string;
  llmRunId: string;
};

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function extractOperationalCandidates(
  pool: Pool,
  ownerId: string,
  rawEventId: string,
  messageText: string,
  credentials: PromptProviderConfig,
  callModel: CallAnthropicModelFn = callAnthropicModel,
): Promise<ExtractOperationalCandidatesResult> {
  const promptVersion = await getActivePromptVersion(pool, OPERATIONAL_EXTRACTION_PURPOSE);
  if (!promptVersion) {
    throw new H2ExtractionError("NO_ACTIVE_PROMPT_VERSION");
  }

  // BUILD-09 Krok 1 retrofit (BUILD-08 Rozhodnutí 4 debt): input strop PŘED
  // voláním modelu — žádné tiché ořezání user zprávy (stejná disciplína
  // jako h2/context/budget-fit.ts P0-overflow).
  if (estimateTokens(messageText) > CONTEXT_TOKEN_BUDGETS.OPERATIONAL_EXTRACTION.maxInputTokens) {
    throw new H2ContextBudgetError("P0_EXCEEDS_BUDGET");
  }

  const startedAt = Date.now();
  const callResult = await callModel(
    H2_MODELS.extraction,
    promptVersion.content,
    messageText,
    credentials.anthropicApiKey,
    OPERATIONAL_EXTRACTION_MAX_OUTPUT_TOKENS,
  );

  const validation = OperationalExtractionOutputSchema.safeParse(tryParseJson(callResult.text));
  const status: "OK" | "INVALID" = validation.success ? "OK" : "INVALID";
  const output = validation.success ? validation.data : { raw: callResult.text };

  return withOwnerScope(pool, ownerId, async (client) => {
    const llmRunId = await recordLlmRun(client, {
      ownerId,
      purpose: OPERATIONAL_EXTRACTION_PURPOSE,
      modelId: H2_MODELS.extraction,
      promptVersionId: promptVersion.id,
      inputReferenceManifest: { rawEventId },
      inputTokenCount: callResult.inputTokens,
      outputTokenCount: callResult.outputTokens,
      latencyMs: Date.now() - startedAt,
      status: "OK",
    });
    await recordAnthropicUsage(
      client,
      ownerId,
      OPERATIONAL_EXTRACTION_PURPOSE,
      H2_MODELS.extraction,
      callResult.inputTokens,
      callResult.outputTokens,
    );

    const extraction = await client.query<{ id: string }>(
      `insert into operational_extractions (owner_id, raw_event_id, llm_run_id, extractor_version, output, status)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [ownerId, rawEventId, llmRunId, OPERATIONAL_EXTRACTION_EXTRACTOR_VERSION, JSON.stringify(output), status],
    );

    return { status, extractionId: extraction.rows[0].id, llmRunId };
  });
}
