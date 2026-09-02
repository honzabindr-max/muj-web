-- H2 Buddy — h2-runtime — 0006_experiments
-- Experiment lifecycle (§16): DRAFT → ACTIVE → PAUSED → COMPLETED / CANCELLED,
-- verdict KEEP/MODIFY/DROP/INCONCLUSIVE. Absence dat je NO_DATA, ne FAILED —
-- vynuceno přes is_no_data flag na observation, ne přes chybějící řádek.

create table experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  domain_id uuid null references domains (id),
  question text not null,
  hypothesis text null,
  status text not null default 'DRAFT',
  checkin_rule jsonb null,
  objective_metrics jsonb not null default '[]'::jsonb,
  subjective_metrics jsonb not null default '[]'::jsonb,
  verdict text null,
  started_at timestamptz null,
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint experiments_status_check check (
    status in ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')
  ),
  constraint experiments_verdict_check check (
    verdict is null or verdict in ('KEEP', 'MODIFY', 'DROP', 'INCONCLUSIVE')
  )
);

create index experiments_owner_status_idx on experiments (owner_id, status);

create table experiment_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id), -- denormalizováno z experiments kvůli jednotné RLS policy
  experiment_id uuid not null references experiments (id),
  observed_at timestamptz not null default now(),
  is_no_data boolean not null default false,
  data jsonb null,
  created_at timestamptz not null default now(),

  -- NO_DATA observation nemá měřená data; jinak musí mít data (§16, §27 "14 dní bez používání").
  constraint experiment_observations_data_presence check (
    (is_no_data = true and data is null) or (is_no_data = false and data is not null)
  )
);

create index experiment_observations_experiment_idx on experiment_observations (experiment_id, observed_at);
