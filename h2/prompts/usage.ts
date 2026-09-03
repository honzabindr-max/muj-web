import type { PoolClient } from "pg";

/**
 * Usage metering pro Anthropic volání (BUILD-07 plán, Rozhodnutí 3 —
 * Honzíkův výslovný požadavek: od prvního dne, ne odloženo do BUILD-27).
 * Referenční sazby přímo z Technical Architecture v1.2 §28. Dva řádky na
 * volání — input a output tokeny mají různou cenu, nejde je sečíst do
 * jednoho `quantity`. `recordAnthropicUsage` bere `PoolClient`, volá se
 * ZEVNITŘ stejné transakce jako `recordLlmRun()` (atomicita).
 */
export const ANTHROPIC_PRICING_USD_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const TOKENS_PER_MTOK = 1_000_000;

export async function recordAnthropicUsage(
  client: PoolClient,
  ownerId: string,
  purpose: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const pricing = ANTHROPIC_PRICING_USD_PER_MTOK[modelId];
  if (!pricing) {
    throw new Error(`H2 prompts: neznámá cena pro model_id "${modelId}" v ANTHROPIC_PRICING_USD_PER_MTOK`);
  }

  await client.query(
    `insert into usage_ledger (owner_id, purpose, model_id, unit, quantity, cost_usd)
     values ($1, $2, $3, 'tokens_input', $4, $5)`,
    [ownerId, purpose, modelId, inputTokens, (inputTokens / TOKENS_PER_MTOK) * pricing.input],
  );
  await client.query(
    `insert into usage_ledger (owner_id, purpose, model_id, unit, quantity, cost_usd)
     values ($1, $2, $3, 'tokens_output', $4, $5)`,
    [ownerId, purpose, modelId, outputTokens, (outputTokens / TOKENS_PER_MTOK) * pricing.output],
  );
}
