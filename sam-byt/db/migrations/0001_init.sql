-- SAM-BYT — 0001_init
-- Izolovaná databáze jen pro /sam-byt (viz zadání bod 1.1). Dva pevné
-- účty (sam, honzik), stav rozhodování per (listing_id, user_id) a
-- historie změn. Katalog bytů (11 sam-XX) NENÍ v DB — čte se ze
-- statického data/sam-byt/listings.json, tahle DB drží jen uživatelský stav.

create table sam_byt_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (username in ('sam', 'honzik')),
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table sam_byt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references sam_byt_users (id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sam_byt_sessions_user_id_idx on sam_byt_sessions (user_id);
create index sam_byt_sessions_expires_at_idx on sam_byt_sessions (expires_at);

-- Rate limiting loginu: počet pokusů za okno se čte agregací, žádná
-- zvláštní logika navíc. Staré řádky lze čistit cronem, není to nutné
-- pro dvě identity s nízkým provozem.
create table sam_byt_login_attempts (
  id bigserial primary key,
  username text not null,
  ip text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index sam_byt_login_attempts_username_idx on sam_byt_login_attempts (username, attempted_at);
create index sam_byt_login_attempts_ip_idx on sam_byt_login_attempts (ip, attempted_at);

-- listing_id není FK (katalog je statický JSON, ne tabulka) — validuje se
-- v aplikaci proti seznamu sam-01..sam-11 před každým zápisem.
create table sam_byt_user_listing_state (
  user_id uuid not null references sam_byt_users (id) on delete cascade,
  listing_id text not null check (listing_id ~ '^sam-(0[1-9]|1[01])$'),
  favorite boolean not null default false,
  decision text not null default 'unreviewed'
    check (decision in ('unreviewed', 'favorite', 'maybe', 'want_viewing', 'reject')),
  notes text not null default '' check (char_length(notes) <= 2000),
  rating_price smallint check (rating_price between 1 and 5),
  rating_pet smallint check (rating_pet between 1 and 5),
  rating_location smallint check (rating_location between 1 and 5),
  rating_balcony smallint check (rating_balcony between 1 and 5),
  rating_furnishing smallint check (rating_furnishing between 1 and 5),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id),
  -- "srdíčko favorit + rozhodnutí nechci" je nejednoznačný stav — DB ho
  -- odmítne, aplikace při nastavení decision='reject' vždy zároveň
  -- pošle favorite=false ve stejném UPDATE.
  constraint sam_byt_no_favorite_reject check (not (favorite and decision = 'reject'))
);

create table sam_byt_decision_events (
  id bigserial primary key,
  user_id uuid not null references sam_byt_users (id) on delete cascade,
  listing_id text not null check (listing_id ~ '^sam-(0[1-9]|1[01])$'),
  field text not null
    check (field in ('favorite', 'decision', 'notes', 'rating_price', 'rating_pet', 'rating_location', 'rating_balcony', 'rating_furnishing')),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index sam_byt_decision_events_listing_idx on sam_byt_decision_events (listing_id, created_at desc);
create index sam_byt_decision_events_user_idx on sam_byt_decision_events (user_id, created_at desc);
