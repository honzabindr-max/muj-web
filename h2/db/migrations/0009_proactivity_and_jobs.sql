-- H2 Buddy — h2-runtime — 0009_proactivity_and_jobs
-- Proactivity/attention budget (§19) a scheduler/jobs/health (§20).
-- job_definitions SQL převzato doslovně z architektury.

create table proactivity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  why_now_reason text not null,
  response_id uuid null references responses (id),
  outcome text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint proactivity_events_why_now_check check (
    why_now_reason in (
      'reminder', 'commitment', 'experiment', 'calendar_event',
      'parked_item_return', 'agreed_checkin', 'system_incident'
    )
  ),
  constraint proactivity_events_outcome_check check (
    outcome in ('sent', 'opened_if_known', 'answered', 'ignored', 'explicitly_dismissed')
  )
);

create index proactivity_events_owner_idx on proactivity_events (owner_id, created_at);

create table job_definitions (
  job_name text primary key,
  schedule_kind text not null,
  next_due_at timestamptz null,
  last_due_at timestamptz null,
  last_started_at timestamptz null,
  last_succeeded_at timestamptz null,
  last_failed_at timestamptz null,
  health_grace_seconds int not null
);

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null references job_definitions (job_name),
  scheduled_for timestamptz not null,
  status text not null default 'CLAIMED',
  claimed_by text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  error_code text null,
  created_at timestamptz not null default now(),

  constraint job_runs_status_check check (status in ('CLAIMED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  -- §20: současné probuzení GHA + cron-job.org nesmí vytvořit dvojí job.
  constraint job_runs_job_name_scheduled_for_unique unique (job_name, scheduled_for)
);

create index job_runs_status_idx on job_runs (job_name, status);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references owners (id),
  incident_type text not null,
  severity text not null default 'WARNING',
  detail_code text null,
  created_at timestamptz not null default now(),
  notified_at timestamptz null,
  resolved_at timestamptz null,

  constraint incidents_severity_check check (severity in ('INFO', 'WARNING', 'CRITICAL'))
);

create index incidents_open_idx on incidents (incident_type, created_at) where resolved_at is null;
