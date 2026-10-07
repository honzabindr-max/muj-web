# PARKED — voice transkripce (BUILD-06 navazující práce)

- **Stav:** PARKED 2026-10-07. Owner Telegram voice notes nepoužívá; diktát z Apple Watch chodí jako TEXT.
- **Fakta z produkce** (`h2/db/scripts/verify-voice.ts`, role `h2_runtime`): 0 VOICE `raw_events`, 0 `voice_transcription` v `llm_runs` i `usage_ledger`.
- **Známá mezera:** `transcribeVoiceJob()` nemá volajícího (`process-owner-queue.ts` ho nevolá). VOICE by prošla do Sonnetu jako dešifrovaný payload bez přepisu (`readMessageText()` bere TEXT i VOICE).
- **Před odparkováním nutné rozhodnutí DEC:** `commitVoiceTranscript()` zapisuje in-place do `raw_events`, což je v konfliktu s Technical Architecture §5 / I3 / I6. Kandidát: varianta B (`raw_event_derivations`, verzovaný odvozený artefakt, raw event zůstane immutable).
- **Levná alternativa při odparkování:** VOICE odmítnout odpovědí „pošli text".
- **Otevřená otázka mimo voice:** 88 `BUDDY_RESPONSE` `llm_runs` vs 12 viditelných `raw_events` (neověřeno).
