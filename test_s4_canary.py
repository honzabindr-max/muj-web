"""Tests for S4 canary enablement — write_target unification, preflight, audit write.

Run with: pytest test_s4_canary.py -v
No real DB connection required — psycopg2 is mocked.
"""
from __future__ import annotations

import io
import json
import os
import sys
import types
import unittest
import contextlib
import argparse
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# psycopg2 stub (must install before crawler import)
# ---------------------------------------------------------------------------
def _install_psycopg2_stub():
    """Install psycopg2 stub if not already present (compatible with test_hetzner_writer stub)."""
    if "psycopg2" in sys.modules:
        # Already installed by test_hetzner_writer — ensure connect accepts **kwargs
        stub = sys.modules["psycopg2"]
        original = getattr(stub, "connect", None)
        if original and not callable(getattr(original, "__kwdefaults__", None)):
            # wrap to ensure kwargs are accepted
            _orig = stub.connect
            def _connect_compat(dsn, **kwargs):
                if callable(_orig):
                    try:
                        return _orig(dsn, **kwargs)
                    except TypeError:
                        return _orig(dsn)
            stub.connect = _connect_compat
        return stub

    stub = types.ModuleType("psycopg2")
    extras = types.ModuleType("psycopg2.extras")

    class FakeRealDictCursor:
        pass

    extras.RealDictCursor = FakeRealDictCursor
    extras.Json = lambda v: ("__json__", v)
    extras.execute_batch = MagicMock()

    stub.Error = Exception
    stub.extras = extras

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

    stub.connect = MagicMock(side_effect=connect)
    sys.modules["psycopg2"] = stub
    sys.modules["psycopg2.extras"] = extras
    return stub


_pg2_stub = _install_psycopg2_stub()


# ---------------------------------------------------------------------------
# Import crawler
# ---------------------------------------------------------------------------
def _load_crawler():
    # yaml stub
    if "yaml" not in sys.modules:
        ys = types.ModuleType("yaml")
        ys.safe_load = MagicMock(return_value={"defaults": {}, "markets": []})
        sys.modules["yaml"] = ys
    # notify stub
    if "notify" not in sys.modules:
        ns = types.ModuleType("notify")
        ns.send = MagicMock()
        sys.modules["notify"] = ns

    if "crawler" in sys.modules:
        return sys.modules["crawler"]
    import crawler as c
    return c


_crawler = _load_crawler()
HetznerPgWriter = _crawler.HetznerPgWriter
_create_write_client = _crawler._create_write_client
DB = _crawler.DB
run_preflight_write_target = _crawler.run_preflight_write_target


# ---------------------------------------------------------------------------
# Helper: build HetznerPgWriter with optional canary env
# ---------------------------------------------------------------------------
def _make_writer(canary_id: str = "") -> HetznerPgWriter:
    env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://u:p@127.0.0.1:5432/db"}
    clear_keys = ["S4_CANARY_ID", "S4_CANARY_PILOT_ID"]
    with patch.dict(os.environ, env, clear=False):
        for k in clear_keys:
            os.environ.pop(k, None)
        if canary_id:
            os.environ["S4_CANARY_ID"] = canary_id
        w = HetznerPgWriter("postgresql://u:p@127.0.0.1:5432/db")
    w._canary_gl = "cz"
    w._canary_hl = "cs"
    w._canary_run_id = "rt-test01-1"
    return w


# ---------------------------------------------------------------------------
# 1. write_target routing: "hetzner" → HetznerPgWriter; "hetzner_pg" → hard fail
# ---------------------------------------------------------------------------
class TestWriteTargetUnification(unittest.TestCase):
    def test_hetzner_routes_to_hetzner_pg_writer(self):
        env = {"SUGGEST_CRAWLER_WRITE_DATABASE_URL": "postgresql://u:p@127.0.0.1:5432/db"}
        with patch.dict(os.environ, env):
            client = _create_write_client("hetzner", {}, no_db=False, dry_run=False)
        self.assertIsInstance(client, HetznerPgWriter)
        client.close()

    def test_hetzner_pg_raises_hard_fail(self):
        with self.assertRaises(RuntimeError) as ctx:
            _create_write_client("hetzner_pg", {}, no_db=False, dry_run=False)
        self.assertIn("hard fail", str(ctx.exception))

    def test_unknown_target_raises_hard_fail(self):
        with self.assertRaises(RuntimeError) as ctx:
            _create_write_client("postgres_direct", {}, no_db=False, dry_run=False)
        self.assertIn("hard fail", str(ctx.exception))

    def test_supabase_still_routes_to_db(self):
        client = _create_write_client("supabase", {}, no_db=False, dry_run=False)
        self.assertIsInstance(client, DB)

    def test_dry_run_bypasses_hetzner_pg_routing(self):
        # dry_run=True always returns DB() regardless of target
        client = _create_write_client("hetzner_pg", {}, no_db=False, dry_run=True)
        self.assertIsInstance(client, DB)


# ---------------------------------------------------------------------------
# 2. Preflight: exact 5 keys, will_write=false, no DB write
# ---------------------------------------------------------------------------
class TestPreflight(unittest.TestCase):
    def _args(self, runtime_config=None):
        ns = argparse.Namespace()
        ns.runtime_config = runtime_config
        ns.preflight_write_target = True
        return ns

    def _run_preflight(self, env: dict, runtime_config=None) -> tuple[int, str]:
        args = self._args(runtime_config)
        buf = io.StringIO()
        clear_keys = ["SUGGEST_WRITE_TARGET", "HETZNER_DATABASE_URL",
                      "SUGGEST_CRAWLER_WRITE_DATABASE_URL", "HETZNER_WRITE_DATABASE_URL"]
        base = {k: "" for k in clear_keys}
        base.update(env)
        with patch.dict(os.environ, base, clear=False):
            for k in clear_keys:
                if not base.get(k):
                    os.environ.pop(k, None)
            with contextlib.redirect_stdout(buf):
                code = run_preflight_write_target(args)
        return code, buf.getvalue()

    def test_hetzner_with_dsn_prints_exact_5_lines(self):
        code, out = self._run_preflight({
            "SUGGEST_WRITE_TARGET": "hetzner",
            "HETZNER_DATABASE_URL": "postgresql://dummy",
        })
        self.assertEqual(code, 0)
        lines = out.strip().splitlines()
        self.assertEqual(lines[0], "write_target=hetzner")
        self.assertEqual(lines[1], "writer=HetznerPgWriter")
        self.assertEqual(lines[2], "guard_ok=true")
        self.assertEqual(lines[3], "hetzner_dsn_present=true")
        self.assertEqual(lines[4], "will_write=false")
        self.assertEqual(len(lines), 5)

    def test_preflight_will_write_is_always_false(self):
        _, out = self._run_preflight({
            "SUGGEST_WRITE_TARGET": "hetzner",
            "HETZNER_DATABASE_URL": "postgresql://dummy",
        })
        self.assertIn("will_write=false", out)

    def test_hetzner_pg_hard_fails(self):
        code, out = self._run_preflight({"SUGGEST_WRITE_TARGET": "hetzner_pg"})
        self.assertNotEqual(code, 0)
        self.assertIn("hard fail", out)

    def test_unknown_target_hard_fails(self):
        code, out = self._run_preflight({"SUGGEST_WRITE_TARGET": "my_custom_db"})
        self.assertNotEqual(code, 0)

    def test_hetzner_without_dsn_guard_false(self):
        code, out = self._run_preflight({"SUGGEST_WRITE_TARGET": "hetzner"})
        self.assertEqual(code, 0)
        self.assertIn("hetzner_dsn_present=false", out)
        self.assertIn("guard_ok=false", out)

    def test_runtime_config_overrides_env(self):
        import tempfile, json as _json
        cfg = {"write": {"target": "hetzner"}, "gl": "cz", "hl": "cs"}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            _json.dump(cfg, f)
            tmp = f.name
        try:
            code, out = self._run_preflight(
                {"SUGGEST_WRITE_TARGET": "supabase",  # env says supabase
                 "HETZNER_DATABASE_URL": "postgresql://dummy"},
                runtime_config=tmp,
            )
            # runtime_config says hetzner → should win
            self.assertIn("write_target=hetzner", out)
        finally:
            os.unlink(tmp)

    def test_no_dsn_printed_in_output(self):
        _, out = self._run_preflight({
            "SUGGEST_WRITE_TARGET": "hetzner",
            "HETZNER_DATABASE_URL": "postgresql://secret_user:secret_pass@host/db",
        })
        self.assertNotIn("secret_user", out)
        self.assertNotIn("secret_pass", out)


# ---------------------------------------------------------------------------
# 3. Canary audit write: S4_CANARY_ID → row in s4_write_canary_audit
# ---------------------------------------------------------------------------
class TestCanaryAudit(unittest.TestCase):
    def _make_writer_with_controlled_exec(self, canary_id="test-canary-1"):
        """Return a writer whose _exec is replaced with a recorder."""
        w = _make_writer(canary_id=canary_id)
        executed = []

        def recording_exec(sql, params=None, **kw):
            executed.append({"sql": sql, "params": params})
            return True  # simulate success

        w._exec = recording_exec
        return w, executed

    def _rows(self):
        now = "2026-06-14T00:00:00+00:00"
        return [{
            "gl": "cz", "hl": "cs", "phrase": "test",
            "phrase_norm": "test", "depth": 0, "parent_prefix": "",
            "first_seen_at": now, "last_seen_at": now, "seen_count": 1,
        }]

    def test_audit_row_written_on_canary_upsert_batch(self):
        w, executed = self._make_writer_with_controlled_exec()
        w.upsert_batch(self._rows())
        # _exec should have been called for the audit INSERT
        audit_calls = [e for e in executed if "s4_write_canary_audit" in (e["sql"] or "")]
        self.assertGreater(len(audit_calls), 0, "Audit INSERT must be called during canary upsert_batch")

    def test_audit_row_contains_canary_id(self):
        w, executed = self._make_writer_with_controlled_exec(canary_id="mycanary")
        w.upsert_batch(self._rows())
        audit_params = next(
            e["params"] for e in executed if "s4_write_canary_audit" in (e["sql"] or "")
        )
        self.assertIn("mycanary", audit_params, "canary_id must be in audit row params")

    def test_audit_failure_raises_fail_closed(self):
        w = _make_writer(canary_id="fail-canary")
        # Make _write_canary_audit return None (simulating DB failure)
        w._write_canary_audit = MagicMock(return_value=None)
        with self.assertRaises(RuntimeError) as ctx:
            w.upsert_batch(self._rows())
        self.assertIn("canary_audit_fail", str(ctx.exception))

    def test_no_canary_mode_when_canary_id_empty(self):
        w = _make_writer(canary_id="")
        write_canary_called = []
        w._write_canary_audit = MagicMock(side_effect=lambda **kw: write_canary_called.append(1))
        w.upsert_batch(self._rows())
        self.assertEqual(len(write_canary_called), 0, "Audit must not be called without S4_CANARY_ID")


# ---------------------------------------------------------------------------
# 4. Canary guard: upsert_state must raise during canary mode
# ---------------------------------------------------------------------------
class TestCanaryStateGuard(unittest.TestCase):
    def test_upsert_state_raises_during_canary(self):
        w = _make_writer(canary_id="guard-test")
        with self.assertRaises(RuntimeError) as ctx:
            w.upsert_state("cz", "cs", {"status": "running"})
        self.assertIn("canary_guard", str(ctx.exception))
        self.assertIn("upsert_state blocked", str(ctx.exception))

    def test_upsert_state_allowed_without_canary(self):
        w = _make_writer(canary_id="")
        executed = []

        def recording_exec(sql, params=None, **kw):
            executed.append(sql)
            return True

        w._exec = recording_exec
        result = w.upsert_state("cz", "cs", {"status": "running", "updated_at": "2026-01-01"})
        self.assertTrue(result)
        self.assertTrue(any("INSERT" in s for s in executed))


# ---------------------------------------------------------------------------
# 5. No secret/DSN in log output
# ---------------------------------------------------------------------------
class TestNoSecretInLog(unittest.TestCase):
    def test_init_does_not_print_dsn(self):
        real_dsn = "postgresql://secret_user:secret_pass@hetzner-host/suggest_db"
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            w = _make_writer(canary_id="")
        out = buf.getvalue()
        self.assertNotIn("secret_user", out)
        self.assertNotIn("secret_pass", out)
        self.assertIn("dsn_secret_printed=false", out)

    def test_audit_params_do_not_contain_dsn(self):
        w = _make_writer(canary_id="canary-dsn-check")
        # DSN format = scheme://user:pass@host/db — audit params must NOT contain this pattern
        captured_dsn = []

        def capturing_exec(sql, params=None, **kw):
            if params:
                for p in params:
                    if isinstance(p, str) and "://" in p and "@" in p:
                        captured_dsn.append(p)
            return True

        w._exec = capturing_exec
        now = "2026-06-14T00:00:00+00:00"
        w.upsert_batch([{
            "gl": "cz", "hl": "cs", "phrase": "test",
            "phrase_norm": "test", "depth": 0, "parent_prefix": "",
            "first_seen_at": now, "last_seen_at": now, "seen_count": 1,
        }])
        self.assertEqual(captured_dsn, [], "DSN (scheme://user:pass@host) must not appear in audit params")


if __name__ == "__main__":
    unittest.main()
