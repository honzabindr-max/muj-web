-- H2 Buddy — h2-runtime — 0007_evidence
-- Evidence architecture (§10), derivation graph / influence graph (§11),
-- Living OS mechanisms (§17). I2/I3/I6/I8 enforcement živé primárně v Code;
-- tabulky nesou verzování, independence a relation-type allowlist, na kterých
-- se enforcement dá testovat.

create table evidence_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  raw_event_id uuid null references raw_events (id),
  person_id uuid null, -- vyplněno pro third-party evidence (§13)
  evidence_type text not null,
  occurred_at timestamptz null,
  superseded_by_id uuid null references evidence_items (id),
  corrected_by_id uuid null references evidence_items (id),
  created_at timestamptz not null default now()
);

create index evidence_items_owner_idx on evidence_items (owner_id, created_at);
create index evidence_items_person_idx on evidence_items (owner_id, person_id) where person_id is not null;

create table claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  domain_id uuid null references domains (id),
  statement text not null,
  state text not null default 'HYPOTEZA',
  independent_support_count int not null default 0,
  independent_contradiction_count int not null default 0,
  influenced_count int not null default 0,
  unknown_count int not null default 0,
  retest_at timestamptz null,
  superseded_by_id uuid null references claims (id),
  corrected_by_id uuid null references claims (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint claims_state_check check (
    state in ('HYPOTEZA', 'POZOROVANO', 'VZOREC', 'TESTOVANO', 'VALIDOVANO', 'MECHANISMUS', 'LIVING_OS', 'VYRAZENO')
  ),
  -- §10.3: unknown_count > 0 blokuje promotion — vynuceno v Code při
  -- přechodu state, sloupec zde jen nese zdroj pravdy pro tu kontrolu.
  constraint claims_unknown_blocks_validated check (
    state not in ('VALIDOVANO', 'MECHANISMUS', 'LIVING_OS') or unknown_count = 0
  )
);

create index claims_owner_state_idx on claims (owner_id, state);

-- §10.3: claim-evidence vazba vzniká vždy jako UNKNOWN, po influence-linking
-- smí přejít na INDEPENDENT / POSSIBLY_INFLUENCED. Jen INDEPENDENT hlasuje
-- do promotion metrics (vynuceno v Code).
create table claim_evidence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id), -- denormalizováno z claims kvůli jednotné RLS policy
  claim_id uuid not null references claims (id),
  evidence_item_id uuid not null references evidence_items (id),
  relation text not null,
  independence text not null default 'UNKNOWN',
  created_at timestamptz not null default now(),

  constraint claim_evidence_relation_check check (relation in ('SUPPORTS', 'CONTRADICTS')),
  constraint claim_evidence_independence_check check (
    independence in ('UNKNOWN', 'INDEPENDENT', 'POSSIBLY_INFLUENCED')
  ),
  constraint claim_evidence_unique unique (claim_id, evidence_item_id, relation)
);

create index claim_evidence_claim_idx on claim_evidence (claim_id);
create index claim_evidence_independence_idx on claim_evidence (claim_id, independence);

-- §11.1: pouze epistemická genealogie, traversuje se u correction/recompute.
-- Polymorfní uzly (evidence_item nebo claim), allowlist relation types.
create table derivation_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  from_node_type text not null,
  from_node_id uuid not null,
  to_node_type text not null,
  to_node_id uuid not null,
  relation_type text not null,
  created_at timestamptz not null default now(),

  constraint derivation_edges_node_type_check check (
    from_node_type in ('EVIDENCE_ITEM', 'CLAIM') and to_node_type in ('EVIDENCE_ITEM', 'CLAIM')
  ),
  constraint derivation_edges_relation_type_check check (
    relation_type in ('DERIVED_FROM', 'SUPPORTS', 'CONTRADICTS')
  )
);

create index derivation_edges_from_idx on derivation_edges (from_node_type, from_node_id);
create index derivation_edges_to_idx on derivation_edges (to_node_type, to_node_id);

-- §11.2: pouze možné ovlivnění Buddyho intervencí. Correction propagation
-- NIKDY netraverzuje tento graf (vynuceno v Code — derivation_edges je
-- oddělená tabulka právě proto, aby to šlo fyzicky zaručit).
create table influence_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  target_type text not null,
  target_id uuid not null,
  response_id uuid null references responses (id),
  action_execution_id uuid null references action_executions (id),
  relation_type text not null,
  created_at timestamptz not null default now(),

  constraint influence_edges_target_type_check check (target_type in ('EVIDENCE_ITEM', 'CLAIM')),
  constraint influence_edges_relation_type_check check (
    relation_type in (
      'POSSIBLY_INFLUENCED_BY', 'PROMPTED_BY', 'RECOMMENDED_BY',
      'REMINDER_AFTER', 'PROTECT_AFTER', 'HYPOTHESIS_EXPOSURE_AFTER'
    )
  ),
  constraint influence_edges_source_present check (response_id is not null or action_execution_id is not null)
);

create index influence_edges_target_idx on influence_edges (target_type, target_id);

-- §17 Living OS: jen dostatečně podložené praktické mechanismy.
create table mechanisms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  domain_id uuid null references domains (id),
  claim_id uuid null references claims (id),
  statement text not null,
  scope text null,
  conditions jsonb not null default '[]'::jsonb,
  counterexamples jsonb not null default '[]'::jsonb,
  failure_mode text null,
  recovery text null,
  last_tested_at timestamptz null,
  review_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mechanisms_owner_domain_idx on mechanisms (owner_id, domain_id);
