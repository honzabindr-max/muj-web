-- §12.1 runtime.supervisor_audit
-- Audit log supervisoru (Fáze 1+). 1 řádek na tick.
-- Idempotentní (CREATE TABLE IF NOT EXISTS).
-- Aplikuj: psql "$SUPERVISOR_DB_DSN" -f migrations/0005_supervisor_audit.sql

CREATE TABLE IF NOT EXISTS runtime.supervisor_audit (
    id                  bigserial PRIMARY KEY,
    tick_at             timestamptz NOT NULL DEFAULT now(),
    supervisor_version  text        NOT NULL,
    signals_json        jsonb       NOT NULL,
    actions_json        jsonb       NOT NULL,
    dry_run             boolean     NOT NULL DEFAULT true,
    executed            boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index pro dotazy posledních N tiků
CREATE INDEX IF NOT EXISTS supervisor_audit_tick_at_idx
    ON runtime.supervisor_audit (tick_at DESC);

-- Komentáře
COMMENT ON TABLE  runtime.supervisor_audit                   IS 'Per-tick audit log supervisoru crawleru (Fáze 1+).';
COMMENT ON COLUMN runtime.supervisor_audit.signals_json      IS '§5.2 signály: ready_pending, active_claimed, last_growth_age, …';
COMMENT ON COLUMN runtime.supervisor_audit.actions_json      IS '§5.3 rozhodnuté akce (pole objektů {action, detail, phase}).';
COMMENT ON COLUMN runtime.supervisor_audit.dry_run           IS 'true = Fáze 1 DRY_RUN, žádná akce nebyla provedena.';
COMMENT ON COLUMN runtime.supervisor_audit.executed          IS 'true = akce byla skutečně provedena (Fáze 2+).';
