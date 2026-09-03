export class H2IngestAuthError extends Error {
  constructor(public readonly code: "TELEGRAM_SECRET_MISMATCH" | "TELEGRAM_UNKNOWN_SENDER" | "NO_ENROLLED_OWNER") {
    super(`H2 ingest: ${code}`);
    this.name = "H2IngestAuthError";
  }
}
