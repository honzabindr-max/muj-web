-- migrations/0001_google_suggestions_v2.sql
-- Sjednocení Google autocomplete dat do jedné tabulky google_suggestions_v2.
-- SEZNAM se NEDOTÝKÁ (tabulka suggestions + suggestion_sources zůstávají beze změny).
--
-- Aplikuj ručně přes Supabase SQL editor po souhlasu (fáze 1).
-- Je idempotentní — bezpečné spustit víckrát.
--
-- Po aplikaci ověř počty samostatným dotazem (viz konec souboru).

begin;

-- ─────────────────────────────────────────────
-- 1) Nová sjednocená Google tabulka
-- ─────────────────────────────────────────────
create table if not exists google_suggestions_v2 (
  id            bigserial primary key,
  gl            text not null,
  hl            text not null,
  phrase        text not null,
  phrase_norm   text not null,
  depth         int,
  parent_prefix text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  seen_count    int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (gl, hl, phrase_norm)
);

-- (gl, hl) pro filtrování per market (dashboard, export)
create index if not exists idx_gsv2_gl_hl
  on google_suggestions_v2 (gl, hl);

-- first_seen_at pro chronologické exporty a dashboard
create index if not exists idx_gsv2_first_seen_at
  on google_suggestions_v2 (first_seen_at);

-- ─────────────────────────────────────────────
-- 2) Checkpoint tabulka per market (gl + hl)
-- ─────────────────────────────────────────────
create table if not exists google_crawler_state (
  gl               text not null,
  hl               text not null,
  current_depth    int  not null default 0,
  current_prefix   text,
  queue            jsonb,         -- zbytek fronty aktuální hloubky (JSON array)
  next_queue       jsonb,         -- fronta další hloubky (JSON array)
  status           text not null default 'pending',
    -- pending | running | done | error
  processed        int  not null default 0,
  queries_total    int  not null default 0,
  new_total        int  not null default 0,
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (gl, hl)
);

-- ─────────────────────────────────────────────
-- 3) Backfill POUZE Google dat — idempotentní
--    Normalizace phrase_norm = lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g')))
--    Musí přesně odpovídat Python funkci normalize() v crawler.py.
--
--    Staré tabulky (google_suggestions, _at, _de) se NEMAŽOU — slouží jako backup.
--    Proveď ověřovací count dotaz po commitu.
-- ─────────────────────────────────────────────

-- Google CZ: 598 458 řádků → gl=cz, hl=cs
insert into google_suggestions_v2
  (gl, hl, phrase, phrase_norm, first_seen_at, last_seen_at, seen_count)
select
  'cz', 'cs',
  phrase,
  lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g'))),
  first_seen_at,
  last_seen_at,
  seen_count
from google_suggestions
on conflict (gl, hl, phrase_norm) do nothing;

-- Google AT: 351 řádků → gl=at, hl=de
insert into google_suggestions_v2
  (gl, hl, phrase, phrase_norm, first_seen_at, last_seen_at, seen_count)
select
  'at', 'de',
  phrase,
  lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g'))),
  first_seen_at,
  last_seen_at,
  seen_count
from google_suggestions_at
on conflict (gl, hl, phrase_norm) do nothing;

-- Google DE: 292 řádků → gl=de, hl=de
insert into google_suggestions_v2
  (gl, hl, phrase, phrase_norm, first_seen_at, last_seen_at, seen_count)
select
  'de', 'de',
  phrase,
  lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g'))),
  first_seen_at,
  last_seen_at,
  seen_count
from google_suggestions_de
on conflict (gl, hl, phrase_norm) do nothing;

commit;

-- ─────────────────────────────────────────────
-- OVĚŘOVACÍ DOTAZ — spusť samostatně po commitu (read-only)
-- ─────────────────────────────────────────────
--
-- select
--   (select count(*) from google_suggestions)    as src_cz,
--   (select count(*) from google_suggestions_at) as src_at,
--   (select count(*) from google_suggestions_de) as src_de,
--   (select count(*) from google_suggestions_v2) as v2_total,
--   (select count(*) from google_suggestions_v2 where gl = 'cz') as v2_cz,
--   (select count(*) from google_suggestions_v2 where gl = 'at') as v2_at,
--   (select count(*) from google_suggestions_v2 where gl = 'de') as v2_de;
--
-- Očekávání:
--   v2_cz  <= src_cz          (rozdíl = dedup uvnitř CZ po phrase_norm)
--   v2_at  <= src_at
--   v2_de  <= src_de
--   v2_total >= v2_at + v2_de (+ unikátní CZ)
--   Staré tabulky nemazat dokud v2_total sedí.
