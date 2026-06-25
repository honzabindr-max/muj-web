#!/usr/bin/env python3
"""Unit tests for crawler_auto.py DB class (psycopg3 write path).
No real DB connection — psycopg is patched via module-level import mock.
Run: python test_crawler_auto_db.py -v
"""
import os, sys, unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))

# Stub psycopg before crawler_auto imports it so the module loads without the library.
import types

_psycopg_stub = types.ModuleType("psycopg")
_rows_stub = types.ModuleType("psycopg.rows")


def _dict_row_factory(cursor):
    return dict


_rows_stub.dict_row = _dict_row_factory
_psycopg_stub.rows = _rows_stub
_psycopg_stub.connect = MagicMock()
sys.modules["psycopg"] = _psycopg_stub
sys.modules["psycopg.rows"] = _rows_stub

from crawler_auto import DB  # noqa: E402 — must come after stub


def _make_cursor(fetchall=None, fetchone=None):
    cur = MagicMock()
    cur.__enter__ = lambda s: s
    cur.__exit__ = MagicMock(return_value=False)
    cur.fetchall.return_value = fetchall if fetchall is not None else []
    cur.fetchone.return_value = fetchone
    return cur


def _make_conn(cur):
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn


# ──────────────────────────────────────────────
# DB.upsert
# ──────────────────────────────────────────────
class TestDBUpsert(unittest.TestCase):

    _ROWS = [
        {"phrase": "ahoj", "first_seen_at": "2026-01-01T00:00:00+00:00",
         "last_seen_at": "2026-01-01T00:00:00+00:00", "seen_count": 1},
        {"phrase": "světe", "first_seen_at": "2026-01-01T00:00:00+00:00",
         "last_seen_at": "2026-01-01T00:00:00+00:00", "seen_count": 1},
    ]

    def test_empty_input_returns_empty_no_query(self):
        db = DB("postgresql://fake")
        db._conn = _make_conn(_make_cursor())
        result = db.upsert("suggestions", [])
        self.assertEqual(result, [])
        db._conn.cursor.assert_not_called()

    def test_returns_only_newly_inserted_rows(self):
        cur = _make_cursor(fetchall=[{"phrase": "ahoj"}])
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        result = db.upsert("suggestions", self._ROWS)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["phrase"], "ahoj")

    def test_all_conflicts_returns_empty(self):
        cur = _make_cursor(fetchall=[])
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        result = db.upsert("suggestions", self._ROWS)
        self.assertEqual(result, [])

    def test_sql_contains_on_conflict_do_nothing(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.upsert("suggestions", self._ROWS)
        sql = cur.execute.call_args[0][0].upper()
        self.assertIn("ON CONFLICT", sql)
        self.assertIn("DO NOTHING", sql)

    def test_sql_contains_returning(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.upsert("suggestions", self._ROWS)
        sql = cur.execute.call_args[0][0].upper()
        self.assertIn("RETURNING", sql)

    def test_phrases_passed_as_list_param(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.upsert("suggestions", self._ROWS)
        params = cur.execute.call_args[0][1]
        self.assertIsInstance(params[0], list)
        self.assertIn("ahoj", params[0])
        self.assertIn("světe", params[0])


# ──────────────────────────────────────────────
# DB.select
# ──────────────────────────────────────────────
class TestDBSelect(unittest.TestCase):

    def test_returns_crawl_state_rows(self):
        row = {"id": 1, "status": "idle", "queue": "[]", "next_queue": "[]"}
        cur = _make_cursor(fetchall=[row])
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        result = db.select("crawl_state", "select=*&id=eq.1")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["status"], "idle")

    def test_sql_queries_crawl_state_id_1(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.select("crawl_state")
        sql = cur.execute.call_args[0][0]
        self.assertIn("crawl_state", sql)
        self.assertIn("id = 1", sql)

    def test_no_row_returns_empty_list(self):
        cur = _make_cursor(fetchall=[])
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        result = db.select("crawl_state")
        self.assertEqual(result, [])


# ──────────────────────────────────────────────
# DB.update
# ──────────────────────────────────────────────
class TestDBUpdate(unittest.TestCase):

    def test_sql_targets_crawl_state_where_id_1(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.update("crawl_state", "id=eq.1", {"status": "running", "processed": 5})
        sql = cur.execute.call_args[0][0]
        self.assertIn("crawl_state", sql)
        self.assertIn("id = 1", sql)

    def test_all_keys_appear_as_placeholders(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.update("crawl_state", "id=eq.1", {"status": "running", "processed": 5})
        sql = cur.execute.call_args[0][0]
        self.assertIn("status = %s", sql)
        self.assertIn("processed = %s", sql)

    def test_values_passed_as_params(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.update("crawl_state", "id=eq.1", {"status": "running", "processed": 5})
        params = cur.execute.call_args[0][1]
        self.assertIn("running", params)
        self.assertIn(5, params)

    def test_partial_update_single_field(self):
        cur = _make_cursor()
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.update("crawl_state", "id=eq.1", {"started_at": "2026-01-01T00:00:00+00:00"})
        sql = cur.execute.call_args[0][0]
        self.assertIn("started_at = %s", sql)


# ──────────────────────────────────────────────
# DB.count
# ──────────────────────────────────────────────
class TestDBCount(unittest.TestCase):

    def test_returns_count_from_n_key(self):
        cur = _make_cursor(fetchone={"n": 42})
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        self.assertEqual(db.count("suggestions"), 42)

    def test_zero_when_no_row(self):
        cur = _make_cursor(fetchone=None)
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        self.assertEqual(db.count("suggestions"), 0)

    def test_sql_counts_suggestions(self):
        cur = _make_cursor(fetchone={"n": 0})
        db = DB("postgresql://fake")
        db._conn = _make_conn(cur)
        db.count("suggestions")
        sql = cur.execute.call_args[0][0].upper()
        self.assertIn("COUNT(*)", sql)
        self.assertIn("SUGGESTIONS", sql)


# ──────────────────────────────────────────────
# DB.open / close
# ──────────────────────────────────────────────
class TestDBLifecycle(unittest.TestCase):

    def test_open_calls_psycopg_connect(self):
        _psycopg_stub.connect.reset_mock()
        db = DB("postgresql://fake-dsn")
        db.open()
        _psycopg_stub.connect.assert_called_once()
        call_args = _psycopg_stub.connect.call_args
        self.assertEqual(call_args[0][0], "postgresql://fake-dsn")

    def test_close_is_safe_when_not_opened(self):
        db = DB("postgresql://fake-dsn")
        db.close()  # must not raise

    def test_close_calls_conn_close(self):
        db = DB("postgresql://fake-dsn")
        conn_mock = MagicMock()
        db._conn = conn_mock
        db.close()
        conn_mock.close.assert_called_once()
        self.assertIsNone(db._conn)

    def test_open_sets_autocommit_true(self):
        _psycopg_stub.connect.reset_mock()
        db = DB("postgresql://fake-dsn")
        db.open()
        kwargs = _psycopg_stub.connect.call_args[1]
        self.assertTrue(kwargs.get("autocommit"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
