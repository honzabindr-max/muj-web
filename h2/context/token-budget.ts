/**
 * Token Budget Contract (Technical Architecture v1.2 §7.4, BUILD-09 plán
 * Krok 1) — pinned `max_input_tokens`/`max_output_tokens` stropy podle
 * LLM purpose. Tyto limity jsou stropy, ne cílová velikost promptu.
 */
export type ContextPurpose =
  | "BUDDY_RESPONSE"
  | "BUDDY_DEEP_DIVE"
  | "OPERATIONAL_EXTRACTION"
  | "BLIND_EXTRACTION"
  | "WEEKLY_FACTUAL_REVIEW"
  | "WEEKLY_EPISTEMIC_REVIEW"
  | "MONTHLY_REVIEW";

export type TokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
};

export const CONTEXT_TOKEN_BUDGETS: Readonly<Record<ContextPurpose, TokenBudget>> = {
  BUDDY_RESPONSE: { maxInputTokens: 24_000, maxOutputTokens: 2_048 },
  BUDDY_DEEP_DIVE: { maxInputTokens: 48_000, maxOutputTokens: 8_192 },
  OPERATIONAL_EXTRACTION: { maxInputTokens: 8_000, maxOutputTokens: 2_048 },
  BLIND_EXTRACTION: { maxInputTokens: 8_000, maxOutputTokens: 2_048 },
  WEEKLY_FACTUAL_REVIEW: { maxInputTokens: 32_000, maxOutputTokens: 4_096 },
  WEEKLY_EPISTEMIC_REVIEW: { maxInputTokens: 48_000, maxOutputTokens: 6_144 },
  MONTHLY_REVIEW: { maxInputTokens: 80_000, maxOutputTokens: 8_192 },
};

/**
 * Konzervativní odhad počtu tokenů před voláním modelu (repo nemá
 * tokenizer knihovnu — `context_runs.input_tokens_estimated` vs
 * `input_tokens_actual` ve schématu už počítá s tím, že estimate je
 * aproximace, actual přijde z API response po volání). Nižší chars/token
 * poměr než obvyklý anglický odhad (~4) záměrně nadhodnocuje počet
 * tokenů u české diakritiky — bezpečnější je spustit budget guard dřív,
 * ne později.
 */
const CHARS_PER_TOKEN_ESTIMATE = 3.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}
