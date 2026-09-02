/**
 * Pinned model IDs — Technical Architecture v1.2 §1 „Uzamčená technická rozhodnutí".
 * Změna kterékoliv hodnoty invaliduje předchozí test certification pro daný
 * purpose (§9.1) a vyžaduje nový passing test run před aktivací. Health
 * (BUILD-23) porovnává tuto konfiguraci s poslední certified kombinací.
 */
export const H2_MODELS = {
  buddy: "claude-sonnet-5",
  extraction: "claude-haiku-4-5-20251001",
  transcription: "whisper-1",
} as const;

export type H2ModelPurpose = keyof typeof H2_MODELS;
