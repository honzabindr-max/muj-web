-- H2 Buddy — h2-runtime — 0002_messaging
-- Raw Event Log, durable processing queue, owner-level serializace, response
-- persistence a delivery. Sloupce a constraints převzaté doslovně z Technical
-- Architecture v1.2 §4.2, §4.3, §5 — toto je normativní SQL, ne Code návrh.

create table raw_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  conversation_sequence bigint not null,
  input_sequence bigint null, -- pouze USER; BUDDY/SYSTEM = NULL
  channel text not null,
  external_event_id text null,
  speaker text not null, -- USER | BUDDY | SYSTEM
  payload_ciphertext bytea not null,
  payload_type text not null, -- TEXT | VOICE | SYSTEM_EVENT
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  schema_version int not null default 1,
  encryption_key_version int not null,

  constraint raw_events_speaker_check check (speaker in ('USER', 'BUDDY', 'SYSTEM')),
  constraint raw_events_payload_type_check check (payload_type in ('TEXT', 'VOICE', 'SYSTEM_EVENT')),
  -- input_sequence IS NOT NULL pouze pro speaker=USER (§5)
  constraint raw_events_input_sequence_only_user check (
    (input_sequence is null) or (speaker = 'USER')
  ),
  constraint raw_events_owner_conversation_sequence_unique unique (owner_id, conversation_sequence)
);

-- partial unique unique(owner_id, input_sequence) WHERE input_sequence IS NOT NULL (§5)
create unique index raw_events_owner_input_sequence_unique
  on raw_events (owner_id, input_sequence)
  where input_sequence is not null;

-- external event uniqueness per channel, kde identifier existuje (§5)
create unique index raw_events_channel_external_event_unique
  on raw_events (owner_id, channel, external_event_id)
  where external_event_id is not null;

create index raw_events_owner_created_at_idx on raw_events (owner_id, created_at);

create table message_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  raw_event_id uuid not null unique references raw_events (id),
  status text not null,
  attempt_count int not null default 0,
  available_at timestamptz not null default now(),
  first_started_at timestamptz null,
  processing_deadline_at timestamptz null,
  lease_until timestamptz null,
  processor_id text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  quarantined_at timestamptz null,
  quarantine_reason text null,
  quarantine_notice_sent_at timestamptz null,
  last_error_code text null,
  last_error_detail text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint message_processing_jobs_status_check check (
    status in ('PENDING', 'PROCESSING', 'RETRY_PENDING', 'RESPONSE_READY', 'DELIVERED', 'QUARANTINED')
  )
);

create index message_processing_jobs_owner_status_idx
  on message_processing_jobs (owner_id, status, available_at);

create table owner_processing_state (
  owner_id uuid primary key references owners (id),
  active_job_id uuid null references message_processing_jobs (id),
  lease_until timestamptz null,
  lease_epoch bigint not null default 0,
  owner_control_epoch bigint not null default 0,
  last_settled_input_sequence bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Response persistence (§4.4, §4.5): nejvýše jeden logical response per
-- source_raw_event_id, a unikátní (owner_id, source_input_sequence,
-- response_kind='BUDDY') přes partial unique index.
create table responses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  source_raw_event_id uuid not null unique references raw_events (id),
  source_input_sequence bigint not null,
  response_kind text not null default 'BUDDY',
  payload_ciphertext bytea not null,
  encryption_key_version int not null,
  stance text null, -- BE_WITH | EXPLORE | ACT (§7.2)
  llm_run_id uuid null, -- FK přidán v 0003 po vytvoření llm_runs
  created_at timestamptz not null default now(),

  constraint responses_response_kind_check check (response_kind in ('BUDDY')),
  constraint responses_stance_check check (stance is null or stance in ('BE_WITH', 'EXPLORE', 'ACT'))
);

create unique index responses_owner_input_sequence_buddy_unique
  on responses (owner_id, source_input_sequence)
  where response_kind = 'BUDDY';

-- Response delivery (§4.4): PENDING/SENDING/DELIVERED/FAILED_RETRYABLE/AMBIGUOUS/DEAD_LETTER,
-- idempotentní delivery key (BUILD-11).
create table response_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  response_id uuid not null references responses (id),
  channel text not null, -- telegram | web
  status text not null default 'PENDING',
  idempotency_key text not null,
  attempt_count int not null default 0,
  external_message_id text null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint response_deliveries_status_check check (
    status in ('PENDING', 'SENDING', 'DELIVERED', 'FAILED_RETRYABLE', 'AMBIGUOUS', 'DEAD_LETTER')
  ),
  constraint response_deliveries_idempotency_key_unique unique (owner_id, idempotency_key)
);

create index response_deliveries_response_id_idx on response_deliveries (response_id);
