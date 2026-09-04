-- H2 Buddy — h2-runtime — 0017_llm_attempts
-- BUILD-11 Rozhodnutí 10: nová tabulka pro před-voláním commit intent na
-- LLM volání. Řeší dvě věci zároveň: (1) metering gap zavedený PR #38
-- (ANTHROPIC_REFUSAL/ANTHROPIC_MAX_TOKENS_TRUNCATED throwují dřív, než
-- generateBuddyResponse() stihne zavolat recordLlmRun()/recordAnthropicUsage(),
-- takže dnes nemají žádný záznam spotřeby), (2) vstupní data pro
-- Rozhodnutí 9's (DEC-008) ABANDONED_UNKNOWN accounting v Kroku 2 — reap
-- větev potřebuje vědět, jestli bylo volání v letu, když procesor
-- zmrzl/spadl, a jaké stage patřilo.
--
-- Komplementární k llm_runs (0003_prompts_and_llm.sql, BUILD-07) — llm_runs
-- se zapisuje PO volání jako audit log dokončeného runu, llm_attempts PŘED
-- voláním jako commit intent. Dvě různé odpovědnosti, ne duplicitní schema.
--
-- "Ve stejné transakci jako claim" (Honzíkovo zadání) — výklad (b),
-- ROZHODNUTO 2026-09-04 (viz BUILD-11-PLAN.md Rozhodnutí 10): insert
-- llm_attempts řádku JE svůj vlastní atomický commit, který "claimuje"
-- konkrétní volání, analogicky k tomu, jak claimNextJob() claimuje job —
-- ne doslovně uvnitř claimNextJob()'s transakce (v okamžiku claimu ještě
-- nevíme, kolik/jaká volání proběhnou).

create table llm_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  job_id uuid not null references message_processing_jobs (id),
  purpose text not null, -- BUDDY_RESPONSE | OPERATIONAL_EXTRACTION
  model_id text not null,
  status text not null default 'CALL_INTENT',
  charged_processing_ms bigint null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,

  constraint llm_attempts_status_check check (
    status in ('CALL_INTENT', 'SUCCEEDED', 'FAILED_CONFIRMED', 'ABANDONED_UNKNOWN')
  )
);

create index llm_attempts_job_id_idx on llm_attempts (job_id);

-- Owner-scoped RLS, stejný vzor jako owner_scoped_tables smyčka v
-- 0011_roles_and_rls.sql (nová tabulka mimo tu smyčku, protože 0011 je
-- uzavřená migrace — grant/RLS pro novou tabulku patří do vlastní
-- migrace, stejně jako 0015_prompt_registry_runtime_grants.sql).
alter table llm_attempts enable row level security;
alter table llm_attempts force row level security;
create policy owner_isolation on llm_attempts
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
  with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);

grant select, insert, update on llm_attempts to h2_runtime;
