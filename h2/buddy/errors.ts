/**
 * Typované chyby pro Buddy runtime (BUILD-10).
 */
export class H2BuddyRuntimeError extends Error {
  constructor(
    public readonly code: "NO_ACTIVE_PROMPT" | "INVALID_MODEL_OUTPUT" | "UNEXPECTED_HYPOTHESIS_LEAK",
  ) {
    super(`H2 buddy: ${code}`);
    this.name = "H2BuddyRuntimeError";
  }
}
