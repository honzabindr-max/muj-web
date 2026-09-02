-- H2 Buddy — h2-runtime — 0010_billing_and_ops
-- Usage ledger + pricing/provider policy catalog (§3, §28 — usage_ledger a
-- tvrdý strop 35 USD jsou dle M1 poznámky v BUILD-STATUS.md potřeba už na
-- M1, ne až v BUILD-27), backups a key rotation audit (§24, §25, §26).

create table usage_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  purpose text not null,
  model_id text null,
  unit text not null,
  quantity numeric not null,
  cost_usd numeric(10, 4) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint usage_ledger_unit_check check (
    unit in ('tokens_input', 'tokens_output', 'minutes', 'compute_hours', 'storage_gb')
  ),
  constraint usage_ledger_quantity_positive check (quantity >= 0),
  constraint usage_ledger_cost_positive check (cost_usd >= 0)
);

create index usage_ledger_owner_occurred_idx on usage_ledger (owner_id, occurred_at);

create table pricing_catalog (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  unit text not null,
  unit_price_usd numeric(12, 6) not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now(),

  constraint pricing_catalog_unit_check check (
    unit in ('tokens_input', 'tokens_output', 'minutes', 'compute_hours', 'storage_gb')
  )
);

create index pricing_catalog_resource_idx on pricing_catalog (resource, effective_from);

-- §3: provider retention snapshot zobrazený v Privacy/Delete UI.
create table provider_policy_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  policy_url text not null,
  retention_statement text not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index provider_policy_catalog_provider_idx on provider_policy_catalog (provider, checked_at);

create table backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null,
  status text not null default 'RUNNING',
  size_bytes bigint null,
  error_code text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,

  constraint backup_runs_type_check check (
    backup_type in ('LOGICAL_DAILY', 'LOGICAL_MONTHLY', 'RESTORE_DRILL', 'DELETION_LEDGER_SYNC_CHECK')
  ),
  constraint backup_runs_status_check check (status in ('RUNNING', 'SUCCEEDED', 'FAILED'))
);

create index backup_runs_type_status_idx on backup_runs (backup_type, status, started_at);

create table encryption_rotation_runs (
  id uuid primary key default gen_random_uuid(),
  key_version_from int not null,
  key_version_to int not null,
  status text not null default 'RUNNING',
  rows_total bigint null,
  rows_migrated bigint null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  verified_at timestamptz null,

  constraint encryption_rotation_runs_status_check check (
    status in ('RUNNING', 'VERIFYING', 'SUCCEEDED', 'FAILED')
  )
);

create index encryption_rotation_runs_status_idx on encryption_rotation_runs (status, started_at);
