"""Unit testy pro crawler._dsn_meta.

Invariant: funkce nikdy nesmí vrátit credentials (user/heslo).
Spuštění: pytest test_dsn_meta.py -v
"""
import os
import sys
import types
import unittest

# ---------------------------------------------------------------------------
# Stubs — crawler.py potřebuje yaml a notify při importu
# ---------------------------------------------------------------------------
def _install_stubs():
    if "yaml" not in sys.modules:
        ys = types.ModuleType("yaml")
        ys.safe_load = lambda f: {"defaults": {}, "markets": []}
        sys.modules["yaml"] = ys
    if "notify" not in sys.modules:
        ns = types.ModuleType("notify")
        ns.send = lambda msg: None
        sys.modules["notify"] = ns
    if "psycopg2" not in sys.modules:
        stub = types.ModuleType("psycopg2")
        extras = types.ModuleType("psycopg2.extras")
        extras.RealDictCursor = object
        extras.Json = lambda v: v
        extras.execute_batch = lambda *a, **kw: None
        stub.extras = extras
        stub.Error = Exception
        stub.connect = lambda dsn, **kw: None
        sys.modules["psycopg2"] = stub
        sys.modules["psycopg2.extras"] = extras


_install_stubs()
sys.path.insert(0, os.path.dirname(__file__))
from crawler import _dsn_meta


class TestDsnMeta(unittest.TestCase):

    # ── happy path ─────────────────────────────────────────────────────────

    def test_localhost_is_local(self):
        result = _dsn_meta("postgresql://user:pass@localhost:5432/db")
        self.assertEqual(result["host_class"], "local")
        self.assertEqual(result["port"], 5432)

    def test_loopback_ip_is_local(self):
        result = _dsn_meta("postgresql://user:pass@127.0.0.1:5433/db")
        self.assertEqual(result["host_class"], "local")
        self.assertEqual(result["port"], 5433)

    def test_tailscale_range_is_tailscale(self):
        result = _dsn_meta("postgresql://user:pass@100.64.1.2:5432/db")
        self.assertEqual(result["host_class"], "tailscale")

    def test_remote_host_is_remote(self):
        result = _dsn_meta("postgresql://user:pass@db.example.com:5432/mydb")
        self.assertEqual(result["host_class"], "remote")

    def test_default_port_when_omitted(self):
        result = _dsn_meta("postgresql://user:pass@db.example.com/mydb")
        self.assertEqual(result["port"], 5432)

    # ── edge cases ─────────────────────────────────────────────────────────

    def test_malformed_dsn_falls_through_to_remote(self):
        # urlparse is permissive — no exception raised, hostname=None → "unknown"
        # → not local, not tailscale → "remote" is the fallback class
        result = _dsn_meta("not_a_valid_dsn")
        self.assertEqual(result["host_class"], "remote")

    # ── bezpečnostní invariant: credentials nesmí uniknout ─────────────────

    def test_no_credentials_in_result(self):
        dsn = "postgresql://secret_user:secret_pass@db.example.com/db"
        result = _dsn_meta(dsn)
        dumped = str(result)
        self.assertNotIn("secret_user", dumped)
        self.assertNotIn("secret_pass", dumped)


if __name__ == "__main__":
    unittest.main(verbosity=2)
