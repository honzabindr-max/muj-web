"""SQLite state: idempotence, raw input, per-step progress, LLM cost ledger."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from . import config

SCHEMA = """
create table if not exists items (
    task_id text primary key,
    raw_text text,
    raw_description text,
    todoist_added_at text,
    seen_at text not null,
    status text not null,
    classification_json text,
    error text,
    attempts integer not null default 0,
    updated_at text not null
);
create table if not exists steps (
    task_id text not null,
    step text not null,
    done_at text not null,
    primary key (task_id, step)
);
create table if not exists llm_calls (
    id integer primary key autoincrement,
    task_id text not null,
    at text not null,
    model text not null,
    in_tokens integer not null,
    out_tokens integer not null,
    cost_usd real not null
);
create table if not exists meta (
    key text primary key,
    value text not null
);
"""

# Statuses in which an item still needs work on a later run.
RESUMABLE = ("RECEIVED", "CLASSIFIED", "FAILED_RETRYABLE", "SKIPPED_CAP")
# Terminal statuses. An item in one of these is never touched again.
TERMINAL = ("APPLIED", "UNKNOWN_MARKED", "BASELINE", "GONE")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("pragma journal_mode=wal")
        self.conn.executescript(SCHEMA)

    # --- meta -------------------------------------------------------------
    def get_meta(self, key: str) -> str | None:
        row = self.conn.execute("select value from meta where key=?", (key,)).fetchone()
        return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        self.conn.execute(
            "insert into meta(key,value) values(?,?) "
            "on conflict(key) do update set value=excluded.value",
            (key, value),
        )

    # --- items ------------------------------------------------------------
    def known_ids(self) -> set[str]:
        return {r["task_id"] for r in self.conn.execute("select task_id from items")}

    def is_empty(self) -> bool:
        return self.conn.execute("select 1 from items limit 1").fetchone() is None

    def get(self, task_id: str) -> sqlite3.Row | None:
        return self.conn.execute("select * from items where task_id=?", (task_id,)).fetchone()

    def resumable_ids(self) -> set[str]:
        q = f"select task_id from items where status in ({','.join('?' * len(RESUMABLE))})"
        return {r["task_id"] for r in self.conn.execute(q, RESUMABLE)}

    def insert_raw(self, task: dict, status: str = "RECEIVED") -> None:
        """Persist the raw input BEFORE anything else happens to it."""
        now = _iso(utcnow())
        self.conn.execute(
            "insert or ignore into items(task_id, raw_text, raw_description, "
            "todoist_added_at, seen_at, status, updated_at) values(?,?,?,?,?,?,?)",
            (
                task["id"],
                task.get("content"),
                task.get("description"),
                task.get("added_at"),
                now,
                status,
                now,
            ),
        )

    def set_status(self, task_id: str, status: str, error: str | None = None) -> None:
        self.conn.execute(
            "update items set status=?, error=?, updated_at=? where task_id=?",
            (status, error, _iso(utcnow()), task_id),
        )

    def set_classification(self, task_id: str, classification: dict) -> None:
        self.conn.execute(
            "update items set classification_json=?, status='CLASSIFIED', error=null, "
            "updated_at=? where task_id=?",
            (json.dumps(classification, ensure_ascii=False), _iso(utcnow()), task_id),
        )

    def bump_attempts(self, task_id: str) -> int:
        self.conn.execute("update items set attempts=attempts+1 where task_id=?", (task_id,))
        return self.get(task_id)["attempts"]

    # --- steps ------------------------------------------------------------
    def step_done(self, task_id: str, step: str) -> bool:
        return (
            self.conn.execute(
                "select 1 from steps where task_id=? and step=?", (task_id, step)
            ).fetchone()
            is not None
        )

    def mark_step(self, task_id: str, step: str) -> None:
        self.conn.execute(
            "insert or ignore into steps(task_id, step, done_at) values(?,?,?)",
            (task_id, step, _iso(utcnow())),
        )

    # --- LLM ledger -------------------------------------------------------
    def record_llm_call(self, task_id: str, model: str, in_tok: int, out_tok: int) -> float:
        cost = (
            in_tok * config.PRICE_INPUT_PER_MTOK + out_tok * config.PRICE_OUTPUT_PER_MTOK
        ) / 1_000_000
        self.conn.execute(
            "insert into llm_calls(task_id, at, model, in_tokens, out_tokens, cost_usd) "
            "values(?,?,?,?,?,?)",
            (task_id, _iso(utcnow()), model, in_tok, out_tok, cost),
        )
        return cost

    def llm_calls_today(self, now: datetime | None = None) -> int:
        local = (now or utcnow()).astimezone(config.TZ)
        start = local.replace(hour=0, minute=0, second=0, microsecond=0)
        return self.conn.execute(
            "select count(*) c from llm_calls where at >= ?", (_iso(start),)
        ).fetchone()["c"]

    def llm_cost_this_month(self, now: datetime | None = None) -> float:
        local = (now or utcnow()).astimezone(config.TZ)
        start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return self.conn.execute(
            "select coalesce(sum(cost_usd),0) s from llm_calls where at >= ?", (_iso(start),)
        ).fetchone()["s"]

    # --- retention --------------------------------------------------------
    def purge_raw_text(self, now: datetime | None = None) -> int:
        cutoff = (now or utcnow()) - timedelta(days=config.RAW_TEXT_RETENTION_DAYS)
        cur = self.conn.execute(
            "update items set raw_text=null, raw_description=null "
            "where seen_at < ? and raw_text is not null and status in "
            f"({','.join('?' * len(TERMINAL))})",
            (_iso(cutoff), *TERMINAL),
        )
        return cur.rowcount
