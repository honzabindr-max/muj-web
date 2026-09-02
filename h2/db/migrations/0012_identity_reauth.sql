-- H2 Buddy — h2-runtime — 0012_identity_reauth
-- BUILD-03A: web identity boundary (§31.1, §31.2). recent_reauth_at nese
-- kdy owner naposledy prošel Google re-authentication; recent re-auth okno
-- je 5 minut (vynucováno v Code, ne v DB). identity_audit_events eviduje
-- bezpečné identity eventy bez tokenů/payloadu (§31.7 log sanitization
-- platí i pro DB audit log, ne jen platform logy).

alter table owners add column recent_reauth_at timestamptz null;

create table identity_audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null references owners (id), -- null pro odmítnuté/neznámé přihlášení
  event_type text not null,
  created_at timestamptz not null default now(),

  constraint identity_audit_events_event_type_check check (
    event_type in (
      'LOGIN_SUCCESS', 'LOGIN_REJECTED_UNKNOWN_OWNER',
      'REAUTH_SUCCESS', 'REAUTH_EXPIRED', 'CSRF_REJECTED'
    )
  )
);

create index identity_audit_events_owner_idx on identity_audit_events (owner_id, created_at);

-- owner_id nullable stejně jako incidents (0011) — stejný policy tvar.
alter table identity_audit_events enable row level security;
alter table identity_audit_events force row level security;
create policy owner_isolation_or_system on identity_audit_events
  using (
    owner_id is null
    or owner_id = nullif(current_setting('app.owner_id', true), '')::uuid
  )
  with check (
    owner_id is null
    or owner_id = nullif(current_setting('app.owner_id', true), '')::uuid
  );
grant select, insert on identity_audit_events to h2_runtime;
