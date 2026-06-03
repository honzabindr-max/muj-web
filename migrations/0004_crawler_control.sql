begin;

CREATE TABLE IF NOT EXISTS crawler_control (
  id                integer     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stop_flag         boolean     NOT NULL DEFAULT false,
  stop_reason       text,
  stopped_at        timestamptz,
  cooldown_until    timestamptz,
  shared_delay_ms   integer     NOT NULL DEFAULT 300,
  block_count_today integer     NOT NULL DEFAULT 0,
  block_count_date  date,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO crawler_control (id) VALUES (1) ON CONFLICT DO NOTHING;

commit;
