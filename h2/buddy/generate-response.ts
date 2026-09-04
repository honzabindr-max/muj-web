import type { Pool } from "pg";

import { H2_MODELS } from "@/h2/config/models";
import { buildContextPack } from "@/h2/context/build-context-pack";
import { CONTEXT_TOKEN_BUDGETS } from "@/h2/context/token-budget";
import { decryptPayload } from "@/h2/crypto/envelope";
import type { EncryptionKeyRegistry } from "@/h2/crypto/keys";
import { withOwnerScope } from "@/h2/db/with-owner-scope";
import type { AnthropicCallResult } from "@/h2/prompts/anthropic-adapter";
import { callAnthropicModel } from "@/h2/prompts/anthropic-adapter";
import type { PromptProviderConfig } from "@/h2/prompts/config";
import { recordLlmRun } from "@/h2/prompts/llm-run";
import { getActivePromptVersion } from "@/h2/prompts/registry";
import { recordAnthropicUsage } from "@/h2/prompts/usage";
import { commitJobResult } from "@/h2/processing/commit";
import type { FencingToken } from "@/h2/processing/lease";

import { runCommandGate } from "./command-gate";
import { H2BuddyRuntimeError } from "./errors";
import { findExistingResponse } from "./find-existing-response";
import { parseBuddyResponseOutput } from "./parse-model-output";
import { renderBuddyPromptInput } from "./render-prompt-input";
import { resolveManifestContent } from "./resolve-manifest-content";
import type { BuddyIntent, BuddyStance } from "./stance-intent-schema";

const BUDDY_RESPONSE_PURPOSE = "BUDDY_RESPONSE";

export type CallAnthropicModelFn = (
  modelId: string,
  promptContent: string,
  input: string,
  apiKey: string,
  maxOutputTokens?: number,
) => Promise<AnthropicCallResult>;

export type GenerateBuddyResponseResult =
  | { responseId: string; reused: true }
  | {
      responseId: string;
      reused: false;
      isControlCommandAck: boolean;
      stance: BuddyStance | null;
      intent: BuddyIntent[] | null;
    };

async function readMessageText(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  ownerId: string,
  rawEventId: string,
): Promise<string> {
  return withOwnerScope(pool, ownerId, async (client) => {
    const result = await client.query<{ payload_ciphertext: Buffer; encryption_key_version: number }>(
      `select payload_ciphertext, encryption_key_version from raw_events where id = $1 and payload_type = 'TEXT'`,
      [rawEventId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("H2 buddy: raw_event not found or not TEXT payload_type");
    }
    return decryptPayload(row.payload_ciphertext, row.encryption_key_version, registry).toString("utf8");
  });
}

/**
 * generateBuddyResponse() — BUILD-10's job-type function, stejný vzor
 * jako `transcribeVoiceJob()` (BUILD-06): bere claimnutý `FencingToken`,
 * orchestruje §7.1 pipeline, vrací výsledek. NEPOLYKÁ chyby (Command
 * Gate/context/Sonnet/fencing) — volající (test, budoucí BUILD-23
 * scheduler trigger) je odchytí a zavolá `h2/processing/quarantine.ts`
 * `recordJobFailure()`, přesně jako u voice/extraction.
 *
 * Pořadí (BUILD-10-PLAN.md "Návrh API"):
 * 1. AT-09/AT-62 dedup pre-check (`findExistingResponse`) — PŘED
 *    čímkoliv jiným, aby retry po úspěšném commitu nevolalo Sonnet znovu.
 * 2. Command Gate (DEC-007 bod 5) — re-detekce fast path control
 *    commandu, no-op potvrzení, žádný druhý epoch bump.
 * 3. `buildContextPack()` (BUILD-09) → `resolveManifestContent()`
 *    (BUILD-10, I4/I5 filtr) → `getActivePromptVersion()` (BUILD-07).
 * 4. Sonnet volání uvnitř `commitJobResult()`'s `work()` — AT-50 zod
 *    validace PŘED návratem `work()`; neplatný výstup throwne (žádný
 *    `responses` řádek), ale `llm_runs`/`usage_ledger` se zapíšou i tak
 *    (DEC-007 I7.5: "zavolalo se, zaplatilo se" je nezávislé na fencing
 *    výsledku i na validaci výstupu).
 */
export async function generateBuddyResponse(
  pool: Pool,
  registry: EncryptionKeyRegistry,
  credentials: PromptProviderConfig,
  token: FencingToken,
  callModel: CallAnthropicModelFn = callAnthropicModel,
): Promise<GenerateBuddyResponseResult> {
  const existing = await findExistingResponse(pool, registry, token.ownerId, token.rawEventId);
  if (existing) {
    return { responseId: existing.responseId, reused: true };
  }

  const messageText = await readMessageText(pool, registry, token.ownerId, token.rawEventId);

  const gate = runCommandGate(messageText);
  if (gate.isControlCommand) {
    const { responseId } = await commitJobResult(pool, registry, token, async () => ({
      responsePayloadPlaintext: Buffer.from(gate.confirmationText, "utf8"),
      stance: null,
    }));
    return { responseId, reused: false, isControlCommandAck: true, stance: null, intent: null };
  }

  const manifest = await buildContextPack(pool, token.ownerId, BUDDY_RESPONSE_PURPOSE, token.rawEventId, messageText);
  const contextItems = await resolveManifestContent(pool, registry, token.ownerId, manifest);

  const promptVersion = await getActivePromptVersion(pool, BUDDY_RESPONSE_PURPOSE);
  if (!promptVersion) {
    throw new H2BuddyRuntimeError("NO_ACTIVE_PROMPT");
  }

  const promptInput = renderBuddyPromptInput(messageText, contextItems);
  const outputBox: { value: { stance: BuddyStance; intent: BuddyIntent[] } | null } = { value: null };

  const { responseId } = await commitJobResult(pool, registry, token, async () => {
    const startedAt = Date.now();
    const callResult = await callModel(
      H2_MODELS.buddy,
      promptVersion.content,
      promptInput,
      credentials.anthropicApiKey,
      CONTEXT_TOKEN_BUDGETS[BUDDY_RESPONSE_PURPOSE].maxOutputTokens,
    );

    const parsed = parseBuddyResponseOutput(callResult.text);

    // Metering nezávislé na výsledku validace ani na fencing checku, který
    // teprve přijde (DEC-007 I7.5) — "zavolalo se, zaplatilo se". `extraction
    // Used` jde do manifestu, aby šlo dohledat/změřit, jak často tolerantní
    // parser (parse-model-output.ts) skutečně zasáhl, ne aby to zmizelo z
    // dohledu (Honzíkovo zadání 2026-09-04).
    await withOwnerScope(pool, token.ownerId, async (client) => {
      await recordLlmRun(client, {
        ownerId: token.ownerId,
        purpose: BUDDY_RESPONSE_PURPOSE,
        modelId: H2_MODELS.buddy,
        promptVersionId: promptVersion.id,
        inputReferenceManifest: {
          rawEventId: token.rawEventId,
          contextRunId: manifest.contextRunId,
          extractionUsed: parsed.extractionUsed,
        },
        inputTokenCount: callResult.inputTokens,
        outputTokenCount: callResult.outputTokens,
        latencyMs: Date.now() - startedAt,
        status: "OK",
      });
      await recordAnthropicUsage(
        client,
        token.ownerId,
        BUDDY_RESPONSE_PURPOSE,
        H2_MODELS.buddy,
        callResult.inputTokens,
        callResult.outputTokens,
      );
    });

    // AT-50 — neplatný/zfalšovaný výstup se nikdy nestane přímou DB state
    // transition. Throw tady znamená, že `commitJobResult()` NEPROVEDE
    // fencing check ani insert do `responses` (viz h2/processing/commit.ts:
    // `work()` se volá PŘED otevřením zapisovací transakce).
    if (!parsed.success) {
      throw new H2BuddyRuntimeError("INVALID_MODEL_OUTPUT");
    }

    outputBox.value = { stance: parsed.data.stance, intent: parsed.data.intent };
    return { responsePayloadPlaintext: Buffer.from(parsed.data.responseText, "utf8"), stance: parsed.data.stance };
  });

  return {
    responseId,
    reused: false,
    isControlCommandAck: false,
    stance: outputBox.value?.stance ?? null,
    intent: outputBox.value?.intent ?? null,
  };
}
