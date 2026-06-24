#!/usr/bin/env python3
"""
Fáze 1 — DRY-RUN supervisor pro suggest crawler.
Čte signály z suggest_db (§5.2), rozhoduje akce (§5.3), v DRY_RUN je
NEPROVÁDÍ — pouze zapíše co by udělal do runtime.supervisor_audit (§12.1).

Invarianty:
  - NEimportuje crawler.py (write-path izolace)
  - 1 zápis do supervisor_audit na tick
  - SUPERVISOR_DRY_RUN=1 → žádný subprocess/systemctl
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone

# Sentinel: crawler.py NESMÍ být importován (invariant Fáze 1).
# Pokud by byl nutný, přesunout sdílený kód do lib/.
_CRAWLER_IMPORT_FORBIDDEN = True

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 not installed — run: pip install psycopg2-binary")

# ---------------------------------------------------------------------------
# ENV
# ---------------------------------------------------------------------------
DRY_RUN           = os.environ.get("SUPERVISOR_DRY_RUN", "1") in ("1", "true", "yes")
LOW_WATERMARK     = int(os.environ.get("LOW_WATERMARK_READY", "10"))
TARGET_BUFFER     = int(os.environ.get("TARGET_READY_BUFFER", "60"))
NO_CLAIM_MIN      = int(os.environ.get("RUNNER_NO_CLAIM_MINUTES", "5"))
STALE_HB_MIN      = int(os.environ.get("STALE_HEARTBEAT_MINUTES", "20"))
NO_GROWTH_WARN_M  = int(os.environ.get("NO_GROWTH_WARN_MINUTES", "30"))
NO_GROWTH_CRIT_M  = int(os.environ.get("NO_GROWTH_CRIT_MINUTES", "60"))
DB_DSN            = os.environ.get("SUPERVISOR_DB_DSN", "")
SUPERVISOR_VERSION = "1.0.0-dry-run"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("supervisor")

# ---------------------------------------------------------------------------
# §5.2 SIGNALS
# ---------------------------------------------------------------------------
_SIGNALS_SQL = """
SELECT
  count(*) FILTER (
    WHERE status = 'pending'
      AND coalesce(next_run_at,    now()) <= now()
      AND coalesce(quarantine_until, now()) <= now()
  )                                                          AS ready_pending,

  count(*) FILTER (WHERE status = 'pending')                 AS all_pending,

  count(*) FILTER (
    WHERE claimed_at IS NOT NULL
      AND heartbeat_at > now() - interval '10 minutes'
  )                                                          AS active_claimed,

  count(*) FILTER (
    WHERE claimed_at IS NOT NULL
      AND coalesce(heartbeat_at, claimed_at) < now() - interval '20 minutes'
  )                                                          AS stale_claimed,

  count(*) FILTER (WHERE status = 'blocked')                 AS blocked,
  count(*) FILTER (WHERE status = 'failed')                  AS failed,

  extract(epoch FROM (now() - max(updated_at))) / 60.0      AS last_queue_update_age

FROM runtime.crawler_market_queue
"""

_GROWTH_AGE_SQL = """
SELECT extract(epoch FROM (now() - max(created_at))) / 60.0 AS last_growth_age
FROM public.google_suggestions_v2
"""


def _fetch_signals(cur):
    cur.execute(_SIGNALS_SQL)
    r = cur.fetchone()
    cur.execute(_GROWTH_AGE_SQL)
    g = cur.fetchone()
    return {
        "ready_pending":         int(r["ready_pending"] or 0),
        "all_pending":           int(r["all_pending"] or 0),
        "active_claimed":        int(r["active_claimed"] or 0),
        "stale_claimed":         int(r["stale_claimed"] or 0),
        "blocked":               int(r["blocked"] or 0),
        "failed":                int(r["failed"] or 0),
        "last_queue_update_age": float(r["last_queue_update_age"] or 0.0),
        "last_growth_age":       float(g["last_growth_age"] or 0.0),
    }


# ---------------------------------------------------------------------------
# §5.3 DECISION
# ---------------------------------------------------------------------------
def _decide(sig):
    """Vrátí seznam akcí dle prahů §5.3. Neprovádí nic (Fáze 1)."""
    actions = []

    if sig["last_growth_age"] > NO_GROWTH_CRIT_M:
        actions.append({
            "action": "GROWTH_CRIT",
            "detail": (
                f"last_growth_age={sig['last_growth_age']:.1f}m > NO_GROWTH_CRIT={NO_GROWTH_CRIT_M}m"
                f" — Fáze 3: restart crawleru"
            ),
            "phase": 3,
        })
    elif sig["last_growth_age"] > NO_GROWTH_WARN_M:
        actions.append({
            "action": "GROWTH_WARN",
            "detail": (
                f"last_growth_age={sig['last_growth_age']:.1f}m > NO_GROWTH_WARN={NO_GROWTH_WARN_M}m"
            ),
            "phase": 3,
        })

    if sig["ready_pending"] < LOW_WATERMARK:
        actions.append({
            "action": "TOPUP_QUEUE",
            "detail": (
                f"ready_pending={sig['ready_pending']} < LOW_WATERMARK={LOW_WATERMARK}"
                f" — Fáze 2: reseed na TARGET_READY_BUFFER={TARGET_BUFFER}"
            ),
            "phase": 2,
        })

    if sig["active_claimed"] == 0 and sig["last_queue_update_age"] > NO_CLAIM_MIN:
        actions.append({
            "action": "RESTART_RUNNER",
            "detail": (
                f"active_claimed=0, last_queue_update_age={sig['last_queue_update_age']:.1f}m"
                f" > RUNNER_NO_CLAIM={NO_CLAIM_MIN}m — Fáze 2: restart runner"
            ),
            "phase": 2,
        })

    if not actions:
        actions.append({"action": "OK", "detail": "všechny signály v normě", "phase": 0})

    return actions


# ---------------------------------------------------------------------------
# §12.1 AUDIT
# ---------------------------------------------------------------------------
_AUDIT_INSERT = """
INSERT INTO runtime.supervisor_audit
  (tick_at, supervisor_version, signals_json, actions_json, dry_run, executed)
VALUES (now(), %s, %s, %s, %s, false)
"""


def _write_audit(cur, sig, actions):
    cur.execute(
        _AUDIT_INSERT,
        (
            SUPERVISOR_VERSION,
            json.dumps(sig),
            json.dumps(actions),
            True,       # Fáze 1: vždy dry_run=true
        ),
    )


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    if not DB_DSN:
        log.error("SUPERVISOR_DB_DSN není nastaven")
        sys.exit(1)

    mode = "DRY_RUN" if DRY_RUN else "LIVE (přepsáno na DRY_RUN — Fáze 1)"
    log.info("supervisor start version=%s mode=%s", SUPERVISOR_VERSION, mode)

    conn = None
    try:
        conn = psycopg2.connect(
            DB_DSN,
            cursor_factory=psycopg2.extras.RealDictCursor,
            connect_timeout=10,
            application_name="crawler-supervisor-f1",
        )
        conn.autocommit = False

        with conn.cursor() as cur:
            sig = _fetch_signals(cur)
            log.info("signals %s", json.dumps(sig))

            actions = _decide(sig)
            for a in actions:
                log.info(
                    "DRY_RUN action=%s phase=%s — %s",
                    a["action"], a.get("phase", "?"), a["detail"],
                )

            _write_audit(cur, sig, actions)
            conn.commit()

        log.info("supervisor_audit: 1 řádek zapsán (dry_run=true)")

    except psycopg2.Error as exc:
        log.error("DB chyba %s", type(exc).__name__)
        sys.exit(1)
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()
