-- H2 Buddy — h2-runtime — 0008_calendar
-- Google Calendar integrace (§18, BUILD-13 vlastní implementaci). Tabulky
-- jsou tu jen jako datová vrstva; OAuth flow a sync logika patří BUILD-13.

create table calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  provider text not null default 'google',
  oauth_tokens_ciphertext bytea not null,
  encryption_key_version int not null,
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz not null default now(),
  revoked_at timestamptz null,

  constraint calendar_accounts_owner_provider_unique unique (owner_id, provider)
);

-- Cache je jen OBSERVE surface (§18); event payload může nést third-party
-- jména/obsah, proto encryption_key_version stejně jako u raw_events.
create table calendar_event_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id),
  calendar_account_id uuid not null references calendar_accounts (id),
  external_event_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  payload_ciphertext bytea not null,
  encryption_key_version int not null,
  synced_at timestamptz not null default now(),

  constraint calendar_event_cache_account_external_id_unique
    unique (calendar_account_id, external_event_id)
);

create index calendar_event_cache_owner_starts_idx on calendar_event_cache (owner_id, starts_at);
