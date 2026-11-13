/**
 * Hard timeouty voice síťových volání (BUILD-06), sdílené s rozpočtem
 * processing smyčky (DC-17, `WORST_CASE_JOB_DURATION_MS`).
 */
export const DOWNLOAD_TIMEOUT_MS = 45_000;
export const TRANSCRIBE_TIMEOUT_MS = 45_000;

/** Telegram `getFile` + stažení souboru (2× download timeout) + Whisper. */
export const VOICE_WORST_CASE_DURATION_MS = DOWNLOAD_TIMEOUT_MS * 2 + TRANSCRIBE_TIMEOUT_MS;
