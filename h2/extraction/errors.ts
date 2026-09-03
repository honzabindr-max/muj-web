/**
 * Typované chyby pro operational extraction (BUILD-08).
 */
export class H2ExtractionError extends Error {
  constructor(public readonly code: "NO_ACTIVE_PROMPT_VERSION") {
    super(`H2 extraction: ${code}`);
    this.name = "H2ExtractionError";
  }
}
