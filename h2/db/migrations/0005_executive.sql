-- H2 Buddy — h2-runtime — 0005_executive
-- Projects/priorities/commitments/open loops/tasks/reminders (§14, §15) a
-- Executive Engine capability/action model (§18).

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  name text not null,
  purpose text null,
  status text not null default 'IDEA',
  success_definition text null,
  milestone text null,
  deadline timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint projects_status_check check (
    status in ('IDEA', 'RESEARCH', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED')
  )
);

create index projects_owner_status_idx on projects (owner_id, status);

-- Today priority stack (§29): řazení libovolné vlastněné entity per owner.
create table priorities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  entity_type text not null, -- PROJECT | TASK | COMMITMENT
  entity_id uuid not null,
  rank int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint priorities_owner_entity_unique unique (owner_id, entity_type, entity_id)
);

create index priorities_owner_rank_idx on priorities (owner_id, rank);

-- §14.2: commitment je explicitní Honzíkovo rozhodnutí, ne LLM inference —
-- created_by_user je proto not null a defaultuje na true jen přes aplikační
-- vrstvu (žádný default zde, aby ho nešlo omylem vynechat).
create table commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  project_id uuid null references projects (id),
  statement text not null,
  reason text null,
  created_by_user boolean not null,
  scope text null,
  expires_on_event text null,
  review_at timestamptz null,
  buddy_can_remind boolean not null default false,
  buddy_can_protect boolean not null default false,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint commitments_status_check check (status in ('ACTIVE', 'RECONSIDERING', 'EXPIRED', 'DROPPED')),
  -- §14.2: událostní expiry má vždy i review_at.
  constraint commitments_event_expiry_needs_review check (
    expires_on_event is null or review_at is not null
  )
);

create index commitments_owner_status_idx on commitments (owner_id, status);

create table open_loops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  project_id uuid null references projects (id),
  domain_id uuid null references domains (id),
  commitment_id uuid null references commitments (id),
  loop_type text not null,
  title text not null,
  status text not null default 'OPEN',
  return_at timestamptz null,
  return_condition text null,
  parked_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint open_loops_type_check check (
    loop_type in ('IDEA', 'QUESTION', 'RESEARCH', 'DECISION', 'CONCERN', 'FOLLOW_UP')
  ),
  constraint open_loops_status_check check (
    status in ('OPEN', 'PARKED', 'RESUMED', 'CONVERTED', 'DROPPED', 'EXPIRED')
  )
);

create index open_loops_owner_status_idx on open_loops (owner_id, status);
create index open_loops_return_at_idx on open_loops (return_at) where status = 'PARKED';

create table tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  project_id uuid null references projects (id),
  title text not null,
  status text not null default 'OPEN',
  due_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_status_check check (status in ('OPEN', 'DONE', 'CANCELLED'))
);

create index tasks_owner_status_idx on tasks (owner_id, status);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  task_id uuid null references tasks (id),
  commitment_id uuid null references commitments (id),
  open_loop_id uuid null references open_loops (id),
  remind_at timestamptz not null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),

  constraint reminders_status_check check (status in ('PENDING', 'SENT', 'DISMISSED'))
);

create index reminders_owner_remind_at_idx on reminders (owner_id, remind_at) where status = 'PENDING';

-- §18: capability model je per action, ne globální. ACT je vždy default off.
create table action_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  integration text not null, -- google_calendar | ...
  capability text not null,
  enabled boolean not null default false,
  granted_via_reauth_at timestamptz null,
  updated_at timestamptz not null default now(),

  constraint action_permissions_capability_check check (capability in ('OBSERVE', 'SUGGEST', 'ACT')),
  constraint action_permissions_owner_integration_capability_unique
    unique (owner_id, integration, capability)
);

create table action_executions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  action_type text not null,
  integration text not null,
  capability_required text not null,
  idempotency_key text not null,
  commitment_id uuid null references commitments (id), -- PROTECT musí citovat commitment (§14.3)
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_executions_capability_check check (capability_required in ('OBSERVE', 'SUGGEST', 'ACT')),
  constraint action_executions_status_check check (status in ('PENDING', 'EXECUTED', 'FAILED', 'REJECTED')),
  constraint action_executions_owner_idempotency_key_unique unique (owner_id, idempotency_key)
);

create index action_executions_owner_idx on action_executions (owner_id, created_at);
