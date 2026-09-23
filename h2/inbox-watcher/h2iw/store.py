"""SQLite state: idempotence, raw input, per-step progress, LLM cost ledger."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from . import config
from .crypto import Key, encrypt

NOTES_DDL = """create table if not exists notes (
    id integer primary key autoincrement,
    todoist_task_id text not null unique,
    subtype text not null check (subtype in ('idea','journal','person','other')),
    ciphertext blob not null,
    key_id text not null,
    created_at text not null
)"""
COMMANDS_DDL = """create table if not exists commands (
    id integer primary key autoincrement,
    todoist_task_id text not null unique,
    ciphertext blob not null,
    key_id text not null,
    created_at text not null
)"""

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
-- NOTE items (ideas, journal, people) and COMMAND items (change requests the
-- watcher refuses to execute). Kept permanently, AES-256-GCM encrypted
-- (h2iw/crypto.py); the plaintext copy in `items` is scrubbed after insert.
{notes_ddl};
{commands_ddl};
create table if not exists meta (
    key text primary key,
    value text not null
);
""".replace("{notes_ddl}", NOTES_DDL).replace("{commands_ddl}", COMMANDS_DDL)

REDACTED_TITLE = "[šifrováno]"

# Statuses in which an item still needs work on a later run.
RESUMABLE = ("RECEIVED", "CLASSIFIED", "FAILED_RETRYABLE", "SKIPPED_CAP")
# Terminal statuses. An item in one of these is never touched again.
TERMINAL = ("APPLIED", "UNKNOWN_MARKED", "BASELINE", "GONE")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str, key: Key | None = None):
        self.key = key
        self.conn = sqlite3.connect(path, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        # Zero freed content so scrubbed plaintext does not linger in free pages.
        self.conn.execute("pragma secure_delete=on")
        self.conn.execute("pragma journal_mode=wal")
        self._migrate_plaintext_notes()
        self.conn.executescript(SCHEMA)

    # --- encryption migration (v1 notes had a plaintext raw_text column) ---
    def _migrate_plaintext_notes(self) -> None:
        cols = {r["name"] for r in self.conn.execute("pragma table_info(notes)")}
        if "raw_text" not in cols:
            return
        if self.key is None:
            raise RuntimeError("plaintext notes present but no encryption key loaded")
        rows = self.conn.execute(
            "select todoist_task_id, subtype, raw_text, created_at from notes").fetchall()
        self.conn.execute("begin")
        self.conn.execute("alter table notes rename to notes_plain_v1")
        self.conn.execute(NOTES_DDL)
        for r in rows:
            self.conn.execute(
                "insert into notes(todoist_task_id, subtype, ciphertext, key_id, created_at) "
                "values(?,?,?,?,?)",
                (r["todoist_task_id"], r["subtype"], encrypt(self.key, r["raw_text"]),
                 self.key.key_id, r["created_at"]),
            )
            self._scrub_item(r["todoist_task_id"])
        self.conn.execute("drop table notes_plain_v1")
        self.conn.execute("commit")
        self.purge_file_remnants()

    def purge_file_remnants(self) -> None:
        """Rewrite the file so no old plaintext page survives in the DB or WAL."""
        self.conn.execute("pragma wal_checkpoint(truncate)")
        self.conn.execute("vacuum")
        self.conn.execute("pragma wal_checkpoint(truncate)")

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

    # --- notes / commands (encrypted) ---------------------------------------
    def _require_key(self) -> Key:
        if self.key is None:
            raise RuntimeError("encryption key not loaded")
        return self.key

    def insert_note(self, task_id: str, subtype: str, raw_text: str) -> None:
        """Idempotent per Todoist task id. Stores ciphertext only."""
        key = self._require_key()
        self.conn.execute(
            "insert or ignore into notes(todoist_task_id, subtype, ciphertext, key_id, "
            "created_at) values(?,?,?,?,?)",
            (task_id, subtype, encrypt(key, raw_text), key.key_id, _iso(utcnow())),
        )

    def insert_command(self, task_id: str, raw_text: str) -> None:
        key = self._require_key()
        self.conn.execute(
            "insert or ignore into commands(todoist_task_id, ciphertext, key_id, created_at) "
            "values(?,?,?,?)",
            (task_id, encrypt(key, raw_text), key.key_id, _iso(utcnow())),
        )

    def _scrub_item(self, task_id: str) -> None:
        row = self.get(task_id)
        if row is None:
            return
        cls = json.loads(row["classification_json"]) if row["classification_json"] else None
        if cls is not None:
            cls["title"] = REDACTED_TITLE
            cls["reason"] = ""
        self.conn.execute(
            "update items set raw_text=null, raw_description=null, classification_json=? "
            "where task_id=?",
            (json.dumps(cls, ensure_ascii=False) if cls is not None else None, task_id),
        )

    def scrub_item(self, task_id: str) -> None:
        """Drop the plaintext copy of an item once its encrypted row exists."""
        self._scrub_item(task_id)

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
