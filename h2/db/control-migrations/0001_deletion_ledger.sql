-- H2 Buddy — h2-control — 0001_deletion_ledger
-- Samostatný Neon projekt, oddělený od h2-runtime (§23.1). Append-only hash
-- chain: GENESIS (manifest_version=0) → DELETE_INTENT → DELETE_APPLIED.
-- Žádná cross-database FK na owners(h2-runtime) — owner_id je plain uuid.

create table deletion_ledger (
  id uuid primary key default gen_random_uuid(),
  deletion_id uuid not null,
  record_type text not null,
  owner_id uuid not null,
  scope_type text null,
  target_selector_hmac bytea null,
  created_at timestamptz not null default now(),
  requested_by text null,
  manifest_version bigint not null unique,
  hmac_key_version int not null,
  previous_record_hash bytea null,
  record_hash bytea not null,

  constraint deletion_ledger_record_type_check check (
    record_type in ('GENESIS', 'DELETE_INTENT', 'DELETE_APPLIED')
  ),
  -- Stejné deletion_id smí mít nejvýše jeden INTENT a nejvýše jeden APPLIED
  -- záznam (§23.1: "původní intent se nikdy nemutuje", APPLIED odkazuje na
  -- stejné deletion_id).
  constraint deletion_ledger_deletion_id_record_type_unique unique (deletion_id, record_type),
  -- GENESIS je jediný záznam bez konkrétního deletion cíle a je vždy manifest_version = 0,
  -- takže "žádné výmazy" je kryptograficky odlišitelné od "ledger není dostupný" (§23.1).
  constraint deletion_ledger_genesis_manifest_zero check (
    (record_type = 'GENESIS' and manifest_version = 0) or (record_type <> 'GENESIS')
  ),
  -- Jen GENESIS smí mít previous_record_hash NULL (první záznam řetězu).
  constraint deletion_ledger_previous_hash_presence check (
    (record_type = 'GENESIS' and previous_record_hash is null)
    or (record_type <> 'GENESIS' and previous_record_hash is not null)
  )
);

create unique index deletion_ledger_single_genesis on deletion_ledger (record_type)
  where record_type = 'GENESIS';
create index deletion_ledger_deletion_id_idx on deletion_ledger (deletion_id);
create index deletion_ledger_owner_idx on deletion_ledger (owner_id);

-- Viz komentář v h2-runtime 0011_roles_and_rls.sql: role jsou cluster-wide,
-- advisory lock serializuje souběžné migrace napříč paralelně běžícími
-- test soubory (race na pg_authid), DO blok je druhá vrstva obrany.
select pg_advisory_xact_lock(hashtext('h2_role_creation'));

do $$
begin
  create role h2_control_migrator noinherit bypassrls;
exception when duplicate_object then null;
end $$;

do $$
begin
  create role h2_control noinherit;
exception when duplicate_object then null;
end $$;

grant usage on schema public to h2_control;
-- Append-only: žádný UPDATE/DELETE grant. Restore/reapply (§23.2) čte přes
-- SELECT a nikdy nemutuje existující řádky.
grant select, insert on deletion_ledger to h2_control;
