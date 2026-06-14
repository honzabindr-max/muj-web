"""Tests for HetznerPgWriter and write-target router (S4 write path).

Run with: pytest test_hetzner_writer.py -v
No DB connection required — all psycopg2 calls are mocked.
"""
from __future__ import annotations

import importlib
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Helpers: build a minimal psycopg2 stub so crawler.py imports without the
# real driver installed.
# ---------------------------------------------------------------------------
def _make_psycopg2_stub():
    stub = types.ModuleType("psycopg2")
    extras = types.ModuleType("psycopg2.extras")

    class FakeRealDictCursor:
        pass

    def Json(v):
        return ("__json__", v)

    extras.RealDictCursor = FakeRealDictCursor
    extras.Json = Json
    extras.execute_batch = MagicMock()

    stub.extras = extras
    stub.Error = Exception

    def connect(dsn, **kwargs):
        conn = MagicMock()
        conn.autocommit = False
        cursor_cm = MagicMock()
        cur = MagicMock()
        cur.fetchall.return_value = []
        cursor_cm.__enter__ = MagicMock(return_value=cur)
        cursor_cm.__exit__ = MagicMock(return_value=False)
        conn.cursor.return_value = cursor_cm
        return conn

    stub.connect = connect
    sys.modules["psycopg2"] = stub
    sys.modules["psycopg2.extras"] = extras
    return stub


_psycopg2_stub = _make_psycopg2_stub()


# ---------------------------------------------------------------------------
# Import crawler module (needs pyyaml + notify stub)
# ---------------------------------------------------------------------------
def _import_crawler():
    try:
        import yaml  # noqa: F401
    except ImportError:
        yaml_stub = types.ModuleType("yaml")
        yaml_stub.safe_load = MagicMock(return_value={"defaults": {}, "markets": []})
        sys.modules["yaml"] = yaml_stub

    # notify stub
    notify_stub = types.ModuleType("notify")
    notify_stub.send = MagicMock()
    sys.modules["notify"] = notify_stub

    # psycopg2 is imported lazily inside HetznerPgWriter.__init__ — no module reload needed.
    # Deleting sys.modules["crawler"] here would break @patch("crawler.x") in other test files.
    if "crawler" in sys.modules:
        return sys.modules["crawler"]
    import crawler
    return crawler


crawler = _import_crawler()
_parse = crawler._parse_postgrest_eq_filter
_PG_COL_SAFE = crawler._PG_COL_SAFE
HetznerPgWriter = crawler.HetznerPgWriter
_create_write_client = crawler._create_write_client
DB = crawler.DB


# ---------------------------------------------------------------------------
# 1. Guard: write_target flag enforcement
# ---------------------------------------------------------------------------
class TestWriteTargetGuard(unittest.TestCase):
    def _run_guard(self, write_target, allow_hetzner="false", require_s4_go="false"):
        env = {
            "SUGGEST_ALLOW_HETZNER_WRITE": allow_hetzner,
            "SUGGEST_REQUIRE_S4_GO": require_s4_go,
        }
        with patch.dict(os.environ, env, clear=False):
            wt = write_target
            allow = os.environ.get("SUGGEST_ALLOW_HETZNER_WRITE", "false").lower() == "true"
            s4go = os.environ.get("SUGGEST_REQUIRE_S4_GO", "false").lower() == "true"
            blocked = wt == "hetzner" and not (allow and s4go)
            return blocked

    def test_hetzner_blocked_no_flags(self):
        self.assertTrue(self._run_guard("hetzner"))

    def test_hetzner_blocked_only_allow(self):
        self.assertTrue(self._run_guard("hetzner", allow_hetzner="true"))

    def test_hetzner_blocked_only_s4go(self):
        self.assertTrue(self._run_guard("hetzner", require_s4_go="true"))

    def test_hetzner_allowed_both_flags(self):
        self.assertFalse(self._run_guard("hetzner", allow_hetzner="true", require_s4_go="true"))

    def test_supabase_never_blocked(self):
        self.assertFalse(self._run_guard("supabase"))


# ---------------------------------------------------------------------------
# 2. Router: _create_write_client returns correct class
# ---------------------------------------------------------------------------
class TestWriteTargetRouter(unittest.TestCase):
    def test_supabase_returns_db(self):
        client = _create_write_client("supabase", {}, no_db=False, dry_run=False)
        self.assertIsInstance(client, DB)

    def test_supabase_postgrest_alias(self):
        client = _create_write_client("supabase_postgrest", {}, no_db=False, dry_run=False)
        self.assertIsInstance(client, DB)

    def test_hetzner_returns_hetzner_pg_writer(self):
        env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://fake:5432/db"}
        with patch.dict(os.environ, env):
            client = _create_write_client("hetzner", {}, no_db=False, dry_run=False)
        self.assertIsInstance(client, HetznerPgWriter)
        client.close()

    def test_hetzner_pg_now_hard_fails(self):
        # Per spec #2: "hetzner_pg" is no longer an alias — it is an unknown target → hard fail
        with self.assertRaises(RuntimeError) as ctx:
            _create_write_client("hetzner_pg", {}, no_db=False, dry_run=False)
        self.assertIn("hard fail", str(ctx.exception))

    def test_dry_run_always_returns_db(self):
        client = _create_write_client("hetzner", {}, no_db=False, dry_run=True)
        self.assertIsInstance(client, DB)

    def test_no_db_always_returns_db(self):
        client = _create_write_client("hetzner", {}, no_db=True, dry_run=False)
        self.assertIsInstance(client, DB)

    def test_unknown_target_raises(self):
        with self.assertRaises(RuntimeError) as ctx:
            _create_write_client("unknown_db", {}, no_db=False, dry_run=False)
        self.assertIn("unknown write_target", str(ctx.exception))

    def test_hetzner_missing_dsn_raises(self):
        env_patch = {k: "" for k in ("SUGGEST_CRAWLER_WRITE_DATABASE_URL",)}
        with patch.dict(os.environ, env_patch):
            os.environ.pop("SUGGEST_CRAWLER_WRITE_DATABASE_URL", None)
            with self.assertRaises(RuntimeError) as ctx:
                _create_write_client("hetzner", {}, no_db=False, dry_run=False)
        self.assertIn("not set", str(ctx.exception))


# ---------------------------------------------------------------------------
# 3. SQL mapping: _parse_postgrest_eq_filter
# ---------------------------------------------------------------------------
class TestParsePostgrestFilter(unittest.TestCase):
    def test_basic_eq(self):
        self.assertEqual(
            _parse("gl=eq.cz&hl=eq.cs"),
            [("gl", "cz"), ("hl", "cs")],
        )

    def test_skips_select_meta(self):
        result = _parse("select=*&gl=eq.cz")
        self.assertEqual(result, [("gl", "cz")])

    def test_skips_order_limit_offset(self):
        result = _parse("order=id&limit=10&offset=0&gl=eq.cz")
        self.assertEqual(result, [("gl", "cz")])

    def test_id_eq_1(self):
        self.assertEqual(_parse("id=eq.1"), [("id", "1")])

    def test_non_eq_op_skipped(self):
        self.assertEqual(_parse("id=gt.1"), [])

    def test_empty_string(self):
        self.assertEqual(_parse(""), [])

    def test_no_eq_marker(self):
        self.assertEqual(_parse("something"), [])


# ---------------------------------------------------------------------------
# 4. upsert_batch: SQL correctness and idempotence (DO NOTHING)
# ---------------------------------------------------------------------------
class TestUpsertBatch(unittest.TestCase):
    def _make_writer(self):
        env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://fake:5432/db"}
        with patch.dict(os.environ, env):
            w = HetznerPgWriter("postgresql://fake:5432/db")
        return w

    def test_empty_rows_returns_empty_list(self):
        w = self._make_writer()
        result = w.upsert_batch([])
        self.assertEqual(result, [])

    def test_batch_calls_execute_batch(self):
        w = self._make_writer()
        rows = [
            {
                "gl": "cz", "hl": "cs", "phrase": "test fráze",
                "phrase_norm": "test fráze", "depth": 1, "parent_prefix": "test",
                "first_seen_at": "2026-06-14T00:00:00+00:00",
                "last_seen_at": "2026-06-14T00:00:00+00:00",
                "seen_count": 1,
            }
        ]
        result = w.upsert_batch(rows)
        self.assertEqual(result, [])
        _psycopg2_stub.extras.execute_batch.assert_called()

    def test_sql_contains_on_conflict(self):
        """Verify ON CONFLICT clause is in the SQL sent to execute_batch."""
        w = self._make_writer()
        rows = [
            {
                "gl": "cz", "hl": "cs", "phrase": "a",
                "phrase_norm": "a", "depth": 0, "parent_prefix": "",
                "first_seen_at": "2026-06-14T00:00:00+00:00",
                "last_seen_at": "2026-06-14T00:00:00+00:00",
                "seen_count": 1,
            }
        ]
        _psycopg2_stub.extras.execute_batch.reset_mock()
        w.upsert_batch(rows)
        call_args = _psycopg2_stub.extras.execute_batch.call_args
        sql_arg = call_args[0][1]  # positional: (cur, sql, data)
        self.assertIn("ON CONFLICT", sql_arg)
        self.assertIn("DO NOTHING", sql_arg)
        self.assertIn("gl, hl, phrase_norm", sql_arg)


# ---------------------------------------------------------------------------
# 5. upsert_state: JSONB wrapping for queue/next_queue
# ---------------------------------------------------------------------------
class TestUpsertState(unittest.TestCase):
    def _make_writer(self):
        env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://fake:5432/db"}
        with patch.dict(os.environ, env):
            return HetznerPgWriter("postgresql://fake:5432/db")

    def test_jsonb_cols_are_wrapped(self):
        w = self._make_writer()
        captured_values = []

        original_exec = w._exec
        def capturing_exec(sql, params=None, **kw):
            if params:
                captured_values.extend(params)
            return True

        w._exec = capturing_exec
        w.upsert_state("cz", "cs", {
            "queue": ["a", "b"],
            "next_queue": ["c"],
            "status": "running",
        })
        # queue and next_queue should be wrapped with Json() stub: ("__json__", ...)
        json_wrapped = [v for v in captured_values if isinstance(v, tuple) and v[0] == "__json__"]
        self.assertEqual(len(json_wrapped), 2, "Both queue and next_queue must be Json-wrapped")

    def test_unknown_cols_filtered(self):
        w = self._make_writer()
        executed = []

        def capturing_exec(sql, params=None, **kw):
            executed.append((sql, params))
            return True

        w._exec = capturing_exec
        w.upsert_state("cz", "cs", {
            "status": "running",
            "dangerous_col; DROP TABLE": "x",  # must be filtered by allowlist
        })
        self.assertTrue(executed)
        sql_used = executed[0][0]
        self.assertNotIn("DROP", sql_used)


# ---------------------------------------------------------------------------
# 6. No secret in log: DSN must not appear in exception messages
# ---------------------------------------------------------------------------
class TestNoSecretInLog(unittest.TestCase):
    def test_connect_failure_hides_dsn(self):
        real_dsn = "postgresql://secret_user:secret_pass@host/db"

        import psycopg2 as pg2
        original_connect = pg2.connect
        pg2.connect = MagicMock(side_effect=pg2.Error("auth failed"))

        try:
            with self.assertRaises(RuntimeError) as ctx:
                HetznerPgWriter(real_dsn)
            error_msg = str(ctx.exception)
            self.assertNotIn("secret_user", error_msg)
            self.assertNotIn("secret_pass", error_msg)
            self.assertNotIn(real_dsn, error_msg)
        finally:
            pg2.connect = original_connect

    def test_sql_error_does_not_expose_connection_string(self):
        env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://u:p@h/db"}
        with patch.dict(os.environ, env):
            w = HetznerPgWriter("postgresql://u:p@h/db")

        import psycopg2 as pg2

        def raising_cursor(**kw):
            cm = MagicMock()
            cur = MagicMock()
            cur.execute.side_effect = pg2.Error("connection to server at 'postgresql://u:p@h/db' lost")
            cm.__enter__ = MagicMock(return_value=cur)
            cm.__exit__ = MagicMock(return_value=False)
            return cm

        w._conn.cursor = raising_cursor

        import io
        import contextlib
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = w._exec("SELECT 1", fetch=True)

        self.assertIsNone(result)
        # The printed error message should exist but not contain the password
        printed = out.getvalue()
        self.assertNotIn(":p@", printed, "Password must not appear in log output")


if __name__ == "__main__":
    unittest.main()
