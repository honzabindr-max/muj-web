-- H2 Buddy — h2-runtime — 0011_roles_and_rls
-- PostgreSQL role (§31.5) a Row Level Security na owner-scoped tabulkách.
-- h2_migrator (DDL/migrace) běží tuto i všechny předchozí migrace jako table
-- owner/superuser ekvivalent a proto RLS neobchází přes politiku, ale díky
-- BYPASSRLS — jeho credential podle architektury není dostupný runtime.

-- CREATE ROLE nemá IF NOT EXISTS a role jsou cluster-wide (ne per-databázi) —
-- na produkčním Neonu je h2-runtime vlastní projekt/cluster, takže kolize
-- nehrozí, ale lokální/CI testovací databáze sdílejí jeden cluster. Advisory
-- lock serializuje souběžné migrace napříč paralelně běžícími test soubory
-- (bez něj: dvě souběžné CREATE ROLE h2_migrator mohou obě projít kontrolou
-- "existuje?" před tím, než druhá vloží řádek, a spadnout na raw
-- unique_violation na pg_authid místo přátelského duplicate_object — přesně
-- tahle race nastala v CI). DO blok s ošetřením duplicate_object zůstává
-- jako druhá vrstva obrany.
select pg_advisory_xact_lock(hashtext('h2_role_creation'));

do $$
begin
  create role h2_migrator noinherit bypassrls;
exception when duplicate_object then null;
end $$;

do $$
begin
  create role h2_runtime noinherit;
exception when duplicate_object then null;
end $$;

do $$
begin
  create role h2_job noinherit;
exception when duplicate_object then null;
end $$;

do $$
begin
  create role h2_blind_reader noinherit;
exception when duplicate_object then null;
end $$;

grant usage on schema public to h2_runtime, h2_job, h2_blind_reader;

-- Owner-scoped tabulky s přímým sloupcem owner_id: jednotná RLS policy přes
-- SET LOCAL app.owner_id (aplikační vrstva nastavuje na začátku owner
-- transakce). FORCE RLS platí i pro table ownera mimo h2_migrator (bypassrls).
do $$
declare
  t text;
  owner_scoped_tables text[] := array[
    'raw_events', 'message_processing_jobs', 'owner_processing_state',
    'responses', 'response_deliveries',
    'llm_runs', 'operational_extractions', 'blind_extractions',
    'context_packs', 'context_runs', 'context_run_items',
    'projects', 'priorities', 'commitments', 'open_loops', 'tasks', 'reminders',
    'action_permissions', 'action_executions',
    'experiments', 'experiment_observations',
    'evidence_items', 'claims', 'claim_evidence',
    'derivation_edges', 'influence_edges', 'mechanisms',
    'calendar_accounts', 'calendar_event_cache',
    'proactivity_events',
    'usage_ledger'
  ];
begin
  foreach t in array owner_scoped_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      $p$create policy owner_isolation on %I
        using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)
        with check (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid)$p$,
      t
    );
    execute format('grant select, insert, update, delete on %I to h2_runtime', t);
  end loop;
end $$;

-- incidents.owner_id je nullable (systémové incidenty bez konkrétního
-- ownera) — vlastní policy povolující i NULL řádky.
alter table incidents enable row level security;
alter table incidents force row level security;
create policy owner_isolation_or_system on incidents
  using (
    owner_id is null
    or owner_id = nullif(current_setting('app.owner_id', true), '')::uuid
  )
  with check (
    owner_id is null
    or owner_id = nullif(current_setting('app.owner_id', true), '')::uuid
  );
grant select, insert, update on incidents to h2_runtime;

-- Systémové/sdílené tabulky bez owner_id — bez RLS, přístup jen přes GRANT.
grant select on owners to h2_runtime;
grant select on domains to h2_runtime, h2_job;
grant select on prompt_versions, prompt_test_runs to h2_runtime;
grant select on pricing_catalog, provider_policy_catalog to h2_runtime;

-- h2_job: due jobs/queue/background operace v přesném allowlistu (§20, §31.5)
-- — ne blanketní přístup ke všem datům.
grant select, insert, update on job_definitions, job_runs, incidents to h2_job;
grant select, insert, update on message_processing_jobs, owner_processing_state to h2_job;
grant select, insert, update on proactivity_events, calendar_event_cache to h2_job;
grant select, insert, update on backup_runs, encryption_rotation_runs to h2_job;
grant select, insert on usage_ledger to h2_job;

-- h2_blind_reader: defense-in-depth, jen povolené raw-user vstupy a
-- metadata (§6.3, §31.5) — bez claims/reviews/influence.
grant select (id, owner_id, conversation_sequence, input_sequence, channel, speaker, payload_ciphertext, payload_type, created_at, received_at, schema_version, encryption_key_version)
  on raw_events to h2_blind_reader;
alter table raw_events enable row level security;
alter table raw_events force row level security;
create policy blind_reader_owner_isolation on raw_events
  for select
  to h2_blind_reader
  using (owner_id = nullif(current_setting('app.owner_id', true), '')::uuid);
