/**
 * Typované chyby pro voice download/transkripci (BUILD-06). `code` jde
 * beze změny do `h2/processing/quarantine.ts` `recordJobFailure()` jako
 * `errorCode` — je to jen observabilita (`last_error_code`,
 * `incidents.detail_code`), neřídí control flow (docs/h2/BUILD-06-PLAN.md
 * Rozhodnutí 6 — žádná klasifikace retryable/non-retryable).
 */
export class H2VoiceDownloadError extends Error {
  constructor(public readonly code: "TELEGRAM_DOWNLOAD_TIMEOUT" | "TELEGRAM_DOWNLOAD_HTTP_ERROR") {
    super(`H2 voice: ${code}`);
    this.name = "H2VoiceDownloadError";
  }
}

export class H2VoiceTranscriptionError extends Error {
  constructor(public readonly code: "WHISPER_TIMEOUT" | "WHISPER_RATE_LIMITED" | "WHISPER_HTTP_ERROR") {
    super(`H2 voice: ${code}`);
    this.name = "H2VoiceTranscriptionError";
  }
}
