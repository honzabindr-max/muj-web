-- H2 Buddy — h2-runtime — 0020_system_notice_deliveries
-- BUILD-11 Rozhodnutí 5 (ROZHODNUTO Honzík, 2026-09-04): systémové notice
-- (dnes jediný typ: "tvoje zpráva se nezpracovala" po karanténě) nejdou
-- přes response_deliveries, protože ta vyžaduje response_id NOT NULL —
-- karanténovaná zpráva žádný responses řádek nemá (proto je karanténovaná).
-- Samostatná, jednodušší tabulka bez vazby na responses — notice nemá
-- delivery states ve stejném smyslu jako Buddy response (žádné SENDING/
-- FAILED_RETRYABLE rozlišení v produktovém smyslu), ale znovu používá
-- stejnou sadu stavů kvůli konzistenci s response_deliveries a
-- deliverResponse()/telegram-send.ts sdílenému kódu.
--
-- idempotency_key = "quarantine_notice:{job_id}" (BUILD-05-PLAN.md
-- Rozhodnutí 3, architekturou pojmenovaný formát). notice_type je volný
-- text (jako incidents.incident_type) — dnes jen 'QUARANTINE', prostor pro
-- budoucí typy beze změny schématu.

create table system_notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  notice_type text not null,
  channel text not null,
  status text not null default 'PENDING',
  idempotency_key text not null,
  external_message_id text null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint system_notice_deliveries_status_check check (
    status in ('PENDING', 'SENDING', 'DELIVERED', 'FAILED_RETRYABLE', 'AMBIGUOUS', 'DEAD_LETTER')
  ),
  constraint system_notice_deliveries_idempotency_key_unique unique (owner_id, idempotency_key)
);

create index system_notice_deliveries_owner_idx on system_notice_deliveries (owner_id, created_at);

-- Owner-scoped RLS, stejný vzor jako 0017_llm_attempts.sql (nová tabulka
-- mimo 0011_roles_and_rls.sql's uzavřenou owner_scoped_tables smyčku —
-- grant/RLS pro novou tabulku patří do vlastní migrace).
alter table system_notice_deliveries enable row level security;
alter table system_notice_deliveries force row level security;
create policy owner_isolation on system_notice_deliveries
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);

grant select, insert, update on system_notice_deliveries to h2_runtime;
