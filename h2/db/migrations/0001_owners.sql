-- H2 Buddy — h2-runtime — 0001_owners
-- Technical Architecture v1.2 §31.1: single-owner systém, owner boundary přes
-- stabilní Google `sub` (web) a přesný Telegram allowlist. Tabulka je malá a
-- prakticky statická (přesně jeden povolený owner), ale je referenční kotva
-- pro owner_id FK a RLS `current_setting('app.owner_id')` napříč zbytkem schématu.

create table owners (
  id uuid primary key default gen_random_uuid(),
  google_sub text unique,
  telegram_user_id text unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owners_has_identity check (google_sub is not null or telegram_user_id is not null)
);
