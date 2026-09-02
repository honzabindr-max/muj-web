-- H2 Buddy — h2-runtime — 0004_context
-- 24 canonical domains (§17), Context Pack per domain a runtime context-run
-- audit trail (§7.4 token budget contract, §13 third-person boundary audit).

create table domains (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  definition text not null,
  canonical_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table context_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  domain_id uuid not null references domains (id),
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),

  constraint context_packs_owner_domain_unique unique (owner_id, domain_id)
);

-- §7.4 Token Budget Contract: povinná pole pro auditovatelnost odřezávání.
create table context_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  llm_run_id uuid null references llm_runs (id),
  purpose text not null, -- BUDDY_RESPONSE | BUDDY_DEEP_DIVE | ... (§7.4)
  input_tokens_estimated int not null,
  input_tokens_actual int null,
  max_input_tokens int not null,
  max_output_tokens int not null,
  output_tokens_actual int null,
  omission_reason text null,
  created_at timestamptz not null default now()
);

create index context_runs_owner_idx on context_runs (owner_id, created_at);

-- §13: eviduje, které third-party položky vstoupily do daného runu, aby šel
-- third-party runtime cap (§31.10, max 2 / max 10 deep-dive) testovat a auditovat.
create table context_run_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id), -- denormalizováno z context_runs kvůli jednotné RLS policy
  context_run_id uuid not null references context_runs (id),
  item_type text not null, -- PROJECT | COMMITMENT | EXPERIMENT | MECHANISM | EPISODE | THIRD_PARTY_EPISODE | ...
  item_id uuid not null,
  priority text not null, -- P0 | P1 | P2 | P3 | P4 (§7.4)
  included boolean not null,
  person_id uuid null, -- vyplněno jen pro THIRD_PARTY_EPISODE položky
  reason text null,

  constraint context_run_items_priority_check check (priority in ('P0', 'P1', 'P2', 'P3', 'P4'))
);

create index context_run_items_context_run_idx on context_run_items (context_run_id);
create index context_run_items_person_idx on context_run_items (context_run_id, person_id) where person_id is not null;
