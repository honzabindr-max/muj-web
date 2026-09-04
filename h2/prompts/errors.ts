/**
 * Typované chyby pro prompt registry / model adapter (BUILD-07).
 */
export class H2PromptActivationError extends Error {
  constructor(
    public readonly code: "NO_PASSING_TEST_RUN" | "VERSION_NOT_FOUND" | "VERSION_NOT_PASSING_COMBO",
  ) {
    super(`H2 prompts: ${code}`);
    this.name = "H2PromptActivationError";
  }
}

export type H2AnthropicCallErrorCode =
  | "ANTHROPIC_TIMEOUT"
  | "ANTHROPIC_RATE_LIMITED"
  | "ANTHROPIC_BAD_REQUEST"
  | "ANTHROPIC_AUTH_ERROR"
  | "ANTHROPIC_SERVER_ERROR"
  | "ANTHROPIC_HTTP_ERROR"
  | "ANTHROPIC_REFUSAL"
  | "ANTHROPIC_MAX_TOKENS_TRUNCATED";

export class H2AnthropicCallError extends Error {
  constructor(
    public readonly code: H2AnthropicCallErrorCode,
    public readonly retryAfterSeconds?: number,
  ) {
    super(`H2 prompts: ${code}`);
    this.name = "H2AnthropicCallError";
  }
}

/**
 * BUILD-11 Rozhodnutí 3 — malá lookup tabulka, ne string matching ad hoc.
 * Honzíkova taxonomie: retryovat 429/500/529/síť, nikdy 400/auth/token
 * budget/schema violation/refuz. `ANTHROPIC_HTTP_ERROR` je fallback pro
 * neklasifikované non-ok statusy (dřív mixovalo retryovatelné i
 * neretryovatelné 400/401/403/500/529 dohromady) — defaultně
 * neretryovatelné, protože taxonomie jmenuje jen 429/500/529/síť jako
 * bezpečné k retry, cokoli jiného default-deny.
 */
export const ANTHROPIC_ERROR_RETRYABLE: Readonly<Record<H2AnthropicCallErrorCode, boolean>> = {
  ANTHROPIC_TIMEOUT: true,
  ANTHROPIC_RATE_LIMITED: true,
  ANTHROPIC_SERVER_ERROR: true,
  ANTHROPIC_BAD_REQUEST: false,
  ANTHROPIC_AUTH_ERROR: false,
  ANTHROPIC_HTTP_ERROR: false,
  ANTHROPIC_REFUSAL: false,
  ANTHROPIC_MAX_TOKENS_TRUNCATED: false,
};
