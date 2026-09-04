-- H2 Buddy — h2-runtime — 0016_manually_cleared_job_status
-- BUILD-11 prep: rozšiřuje message_processing_jobs_status_check (0002) o
-- MANUALLY_CLEARED — ruční odklizení stale PENDING jobů před zapojením
-- BUILD-11's produkčního triggeru, odlišné od QUARANTINED (systémové
-- selhání zpracování) i od RESPONSE_READY/DELIVERED (skutečně
-- zpracováno). Aditivní změna, žádná existující hodnota se neodstraňuje.
-- claimNextJob() (h2/processing/lease.ts) vybírá jen status in ('PENDING',
-- 'RETRY_PENDING') — nový stav je tak strukturálně "settled" bez úpravy
-- kódu, stejně jako QUARANTINED/RESPONSE_READY/DELIVERED dnes.

alter table message_processing_jobs drop constraint message_processing_jobs_status_check;

alter table message_processing_jobs add constraint message_processing_jobs_status_check
  check (
    status in ('PENDING', 'PROCESSING', 'RETRY_PENDING', 'RESPONSE_READY', 'DELIVERED', 'QUARANTINED', 'MANUALLY_CLEARED')
  );
