-- H2 Buddy — h2-runtime — 0003_prompts_and_llm
-- Prompt registry (§9.1, SQL doslovně z architektury), LLM run audit (§9.2)
-- a operational/blind extraction (§6).

create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  version int not null,
  status text not null default 'DRAFT',
  content text not null,
  output_schema jsonb null,
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  retired_at timestamptz null,

  constraint prompt_versions_status_check check (status in ('DRAFT', 'TESTING', 'ACTIVE', 'RETIRED')),
  constraint prompt_versions_purpose_version_unique unique (purpose, version)
);

-- ACTIVE status nesmí nastavit obecný runtime CRUD (§9.1) — vynucuje se na
-- aplikační vrstvě přes activatePromptVersion() a GRANT (viz 0011_roles_and_rls.sql),
-- ne přes DB trigger, aby zůstala jedna auditovatelná cesta v kódu.
create unique index prompt_versions_one_active_per_purpose
  on prompt_versions (purpose)
  where status = 'ACTIVE';

create table prompt_test_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_version_id uuid not null references prompt_versions (id),
  model_id text not null,
  schema_version int not null,
  fixture_set_version text not null,
  status text not null,
  results jsonb null,
  run_at timestamptz not null default now(),

  constraint prompt_test_runs_status_check check (status in ('PASS', 'FAIL'))
);

create index prompt_test_runs_lookup_idx
  on prompt_test_runs (prompt_version_id, model_id, schema_version, fixture_set_version, status);

create table llm_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  purpose text not null,
  model_id text not null,
  prompt_version_id uuid null references prompt_versions (id),
  extractor_version text null,
  schema_version int null,
  input_reference_manifest jsonb null,
  input_token_count int null,
  output_token_count int null,
  latency_ms int null,
  status text not null,
  error_code text null,
  created_at timestamptz not null default now(),

  constraint llm_runs_status_check check (status in ('OK', 'ERROR', 'TIMEOUT'))
);

create index llm_runs_owner_purpose_idx on llm_runs (owner_id, purpose, created_at);

alter table responses
  add constraint responses_llm_run_id_fkey foreign key (llm_run_id) references llm_runs (id);

-- Operational extraction (§6.1): realtime, smí znát current message context,
-- nesmí autoritativně vytvářet dlouhodobé psychologické claims.
create table operational_extractions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  raw_event_id uuid not null references raw_events (id),
  llm_run_id uuid not null references llm_runs (id),
  extractor_version text not null,
  output jsonb not null,
  status text not null,
  created_at timestamptz not null default now(),

  constraint operational_extractions_status_check check (status in ('OK', 'INVALID', 'REJECTED'))
);

create index operational_extractions_owner_idx on operational_extractions (owner_id, created_at);

-- Blind extraction (§6.2, §6.3): input_reference_manifest povoluje pouze
-- RAW_USER_EVENT / NON_SEMANTIC_CHANNEL_METADATA; zakázaná reference =
-- fail closed před LLM requestem (vynucuje se v Code, tabulka jen eviduje).
create table blind_extractions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  raw_event_id uuid not null references raw_events (id),
  llm_run_id uuid not null references llm_runs (id),
  extractor_version text not null,
  input_reference_manifest jsonb not null,
  output jsonb not null,
  status text not null,
  created_at timestamptz not null default now(),

  constraint blind_extractions_status_check check (status in ('OK', 'REJECTED_FAIL_CLOSED'))
);

create index blind_extractions_owner_idx on blind_extractions (owner_id, created_at);
