/**
 * Typované chyby pro Context Engine (BUILD-09).
 */
export class H2ContextBudgetError extends Error {
  constructor(public readonly code: "P0_EXCEEDS_BUDGET") {
    super(`H2 context: ${code}`);
    this.name = "H2ContextBudgetError";
  }
}
