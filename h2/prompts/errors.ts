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

export class H2AnthropicCallError extends Error {
  constructor(
    public readonly code:
      | "ANTHROPIC_TIMEOUT"
      | "ANTHROPIC_RATE_LIMITED"
      | "ANTHROPIC_HTTP_ERROR"
      | "ANTHROPIC_REFUSAL"
      | "ANTHROPIC_MAX_TOKENS_TRUNCATED",
  ) {
    super(`H2 prompts: ${code}`);
    this.name = "H2AnthropicCallError";
  }
}
