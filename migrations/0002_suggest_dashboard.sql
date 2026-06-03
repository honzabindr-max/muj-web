-- Dashboard v2: materialized view + singleton counter + 3 RPCs + pg_cron refresh
-- Applied 2026-06-03 to project tjwumduiadkpzigmerza

BEGIN;

-- pg_cron enabled separately: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) Materialized view: phrase counts per (gl, hl)
--    Refreshed by pg_cron every 5 minutes, never on hot path
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_phrase_counts AS
  SELECT gl, hl, COUNT(*) AS phrase_count
  FROM google_suggestions_v2
  GROUP BY gl, hl
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_phrase_counts_gl_hl
  ON mv_phrase_counts (gl, hl);

-- 2) Singleton counter for Seznam (suggestions has no gl/hl)
CREATE TABLE IF NOT EXISTS seznam_phrase_count (
  id           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phrase_count BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO seznam_phrase_count (id, phrase_count)
  SELECT 1, COUNT(*) FROM suggestions
ON CONFLICT (id) DO UPDATE
  SET phrase_count = EXCLUDED.phrase_count, updated_at = NOW();

-- 3) pg_cron: refresh MV every 5 minutes
SELECT cron.schedule(
  'refresh-phrase-counts',
  '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_phrase_counts'
);

-- 4) RPC: full init load (phrase_count + state)
CREATE OR REPLACE FUNCTION get_dashboard_rows()
RETURNS TABLE (
  source          TEXT,
  gl              TEXT,
  hl              TEXT,
  phrase_count    BIGINT,
  depth           INT,
  depth_pct       NUMERIC,
  processed       INT,
  queries_total   INT,
  new_total       INT,
  queue_len       INT,
  next_queue_len  INT,
  current_prefix  TEXT,
  status          TEXT,
  updated_at      TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    'google'::TEXT,
    s.gl, s.hl,
    COALESCE(m.phrase_count, 0),
    s.current_depth,
    CASE
      WHEN s.processed + COALESCE(jsonb_array_length(s.queue), 0) = 0 THEN NULL
      WHEN COALESCE(jsonb_array_length(s.queue), 0) = 0              THEN 100::NUMERIC
      ELSE ROUND(
        s.processed::NUMERIC
        / (s.processed + COALESCE(jsonb_array_length(s.queue), 0)) * 100, 1
      )
    END,
    s.processed, s.queries_total, s.new_total,
    COALESCE(jsonb_array_length(s.queue), 0),
    COALESCE(jsonb_array_length(s.next_queue), 0),
    s.current_prefix, s.status, s.updated_at,
    s.last_started_at, s.last_finished_at
  FROM google_crawler_state s
  LEFT JOIN mv_phrase_counts m USING (gl, hl)

  UNION ALL

  SELECT
    'seznam'::TEXT, 'cz'::TEXT, 'cs'::TEXT,
    COALESCE(c.phrase_count, 0),
    NULL::INT, NULL::NUMERIC, NULL::INT, NULL::INT, NULL::INT,
    NULL::INT, NULL::INT, NULL::TEXT, NULL::TEXT,
    NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ
  FROM seznam_phrase_count c WHERE c.id = 1;
$$;

-- 5) RPC: lightweight 3s poll (state only, no phrase counts)
CREATE OR REPLACE FUNCTION get_dashboard_state()
RETURNS TABLE (
  gl             TEXT, hl            TEXT,
  depth          INT,  depth_pct     NUMERIC,
  processed      INT,  queries_total INT, new_total INT,
  queue_len      INT,  next_queue_len INT,
  current_prefix TEXT, status        TEXT,
  updated_at     TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    s.gl, s.hl, s.current_depth,
    CASE
      WHEN s.processed + COALESCE(jsonb_array_length(s.queue), 0) = 0 THEN NULL
      WHEN COALESCE(jsonb_array_length(s.queue), 0) = 0              THEN 100::NUMERIC
      ELSE ROUND(
        s.processed::NUMERIC
        / (s.processed + COALESCE(jsonb_array_length(s.queue), 0)) * 100, 1
      )
    END,
    s.processed, s.queries_total, s.new_total,
    COALESCE(jsonb_array_length(s.queue), 0),
    COALESCE(jsonb_array_length(s.next_queue), 0),
    s.current_prefix, s.status, s.updated_at
  FROM google_crawler_state s;
$$;

-- 6) RPC: new phrases in last 24h per market (slow poll, every 60s)
--    TODO: as google_suggestions_v2 grows to hundreds of millions of rows,
--    move new_24h into mv_phrase_counts (add column, refresh by cron) to
--    avoid the COUNT scan on the hot path entirely.
CREATE OR REPLACE FUNCTION get_new_phrases_24h()
RETURNS TABLE (gl TEXT, hl TEXT, new_24h BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT gl, hl, COUNT(*) AS new_24h
  FROM google_suggestions_v2
  WHERE first_seen_at >= NOW() - INTERVAL '24 hours'
  GROUP BY gl, hl;
$$;

COMMIT;
