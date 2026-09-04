-- H2 Buddy — h2-runtime — 0018_processing_budget
-- BUILD-11 Rozhodnutí 9 (DEC-008): deadline sémantika split — nahrazuje
-- wall-clock processing_deadline_at (§4.2 doslovné znění, wall clock od
-- first_started_at) za ACTIVE/stage processing budget měřený přes
-- llm_attempts (0017). Lease expiry (owner_processing_state.lease_until)
-- a backoff/available_at zůstávají wall clock beze změny (§4.3) —
-- DEC-008 mění výhradně "vyčerpán čas" test (isJobExhausted()).
--
-- processing_budget_ms — nastaven jednou při prvním přechodu do
-- PROCESSING podle payload_type (TEXT: 120_000, VOICE: 300_000 — stejné
-- hodnoty jako dřívější DEADLINE_SECONDS*1000, jen reinterpretované jako
-- budget součtu charged time, ne jako wall-clock okno), přes
-- coalesce(processing_budget_ms, ...) stejně jako dřívější
-- processing_deadline_at nastavení — nemění se mezi retry.
--
-- charged_processing_ms — kumulativní účtovaný čas napříč pokusy.
-- Známý výsledek (resolveJobFailure()): měřená doba llm_attempts řádků
-- vzniklých během PRÁVĚ končícího pokusu. ABANDONED_UNKNOWN (lease.ts
-- reap větev): min(reap_time - llm_attempts.created_at, CALL_TIMEOUT_MS)
-- pro každý v letu zaseklý CALL_INTENT řádek — nikdy plochá hodnota,
-- nikdy doba, po kterou job ležel bez executoru.
--
-- processing_deadline_at DROPPED — 0 řádků v produkci dnes (BUILD-10/11
-- evidence, žádné reálné Sonnet volání), drop je bezpečný bez migrace
-- dat. Ponechaný nečtený sloupec vedle nových by byl matoucí duplicitní
-- koncept (ROZHODNUTO Honzíkem 2026-09-04, viz DECISIONS.md DEC-008 a
-- BUILD-11-PLAN.md Rozhodnutí 9).

alter table message_processing_jobs
  add column processing_budget_ms bigint null,
  add column charged_processing_ms bigint not null default 0,
  drop column processing_deadline_at;
