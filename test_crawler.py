#!/usr/bin/env python3
"""
Mockované testy crawler.py resilience — žádné síťové volání, žádná produkční DB.

Spuštění:
  pip install pyyaml   # jediná závislost crawler.py
  python test_crawler.py -v
"""
import json, os, sys, tempfile, time, unittest
from unittest.mock import MagicMock, patch, call

# Přidej adresář repozitáře do cesty
sys.path.insert(0, os.path.dirname(__file__))
import crawler
from crawler import (
    DB, CircuitBreaker, _EMPTY_SUCCESS,
    CIRCUIT_BREAKER_THRESHOLD, DB_MAX_RETRIES,
    load_state, save_state, emergency_save, load_emergency_state,
    normalize, run_market,
)


# ─────────────────────────────────────────────────────────────
# E1 — _req() chytá síťové výjimky, nikdy je nevyhazuje ven
# ─────────────────────────────────────────────────────────────
class TestReqExceptionHandling(unittest.TestCase):

    def setUp(self):
        self.db = DB("https://test.supabase.co", "test-key")

    def _make_urlopen_error(self, exc):
        return patch("urllib.request.urlopen", side_effect=exc)

    def test_timeout_error_returns_none(self):
        with self._make_urlopen_error(TimeoutError("read timed out")):
            result = self.db._req("GET", "test")
        self.assertIsNone(result)

    def test_connection_reset_returns_none(self):
        with self._make_urlopen_error(ConnectionResetError("reset")):
            result = self.db._req("GET", "test")
        self.assertIsNone(result)

    def test_ssl_error_returns_none(self):
        import ssl
        with self._make_urlopen_error(ssl.SSLError("ssl error")):
            result = self.db._req("GET", "test")
        self.assertIsNone(result)

    def test_url_error_returns_none(self):
        import urllib.error
        with self._make_urlopen_error(urllib.error.URLError("name or service not known")):
            result = self.db._req("GET", "test")
        self.assertIsNone(result)

    def test_http_error_non_409_returns_none(self):
        import urllib.error, io
        err = urllib.error.HTTPError("url", 503, "Service Unavailable", {}, io.BytesIO(b""))
        with self._make_urlopen_error(err):
            result = self.db._req("POST", "test", {"x": 1})
        self.assertIsNone(result)

    def test_empty_2xx_body_returns_sentinel(self):
        mock_resp = MagicMock()
        mock_resp.read.return_value = b""
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        with patch("urllib.request.urlopen", return_value=mock_resp):
            result = self.db._req("POST", "test", {})
        self.assertIs(result, _EMPTY_SUCCESS)

    def test_no_exception_propagates(self):
        """_req() nesmí za žádné situace vyhodit výjimku ven."""
        bad_errors = [
            TimeoutError(), ConnectionResetError(), ConnectionRefusedError(),
            BrokenPipeError(), OSError("low-level"),
        ]
        for exc in bad_errors:
            with self.subTest(exc=type(exc).__name__):
                with patch("urllib.request.urlopen", side_effect=exc):
                    try:
                        result = self.db._req("GET", "test")
                        self.assertIsNone(result)
                    except Exception as e:
                        self.fail(f"_req() vyhazuje {type(e).__name__}: {e}")


# ─────────────────────────────────────────────────────────────
# E2a — retry wrapper: selže N-1×, pak uspěje
# ─────────────────────────────────────────────────────────────
class TestRetryWrapper(unittest.TestCase):

    def setUp(self):
        self.db = DB("https://test.supabase.co", "test-key")

    @patch("time.sleep")
    def test_retries_then_succeeds(self, mock_sleep):
        call_count = [0]

        def fake_req(m, p, d=None, eh=None):
            call_count[0] += 1
            return None if call_count[0] < 4 else [{"id": 1}]

        self.db._req = fake_req
        result = self.db._req_with_retry("POST", "test", max_attempts=6)
        self.assertEqual(result, [{"id": 1}])
        self.assertEqual(call_count[0], 4)
        self.assertEqual(mock_sleep.call_count, 3)  # 3 sleeps mezi 4 pokusy

    @patch("time.sleep")
    def test_all_exhausted_returns_none(self, mock_sleep):
        self.db._req = lambda m, p, d=None, eh=None: None
        result = self.db._req_with_retry("POST", "test", max_attempts=3)
        self.assertIsNone(result)
        self.assertEqual(mock_sleep.call_count, 2)  # sleep po 1. a 2. pokusu; 3. bez sleep


# ─────────────────────────────────────────────────────────────
# E2b — POST [] = úspěch bez retry; None = selhání s retry
# ─────────────────────────────────────────────────────────────
class TestPostEmptyVsFailure(unittest.TestCase):

    def setUp(self):
        self.db = DB("https://test.supabase.co", "test-key")

    @patch("time.sleep")
    def test_empty_list_is_success_no_retry(self, mock_sleep):
        """POST vrátí [] (všechno DO NOTHING) = úspěch, neretryovat."""
        call_count = [0]

        def fake_req(m, p, d=None, eh=None):
            call_count[0] += 1
            return []  # empty list = OK

        self.db._req = fake_req
        result = self.db._req_with_retry("POST", "test", max_attempts=6)
        self.assertEqual(result, [])
        self.assertEqual(call_count[0], 1, "[] musí zastavit retry na prvním pokusu")
        mock_sleep.assert_not_called()

    @patch("time.sleep")
    def test_none_is_failure_retried(self, mock_sleep):
        """POST vrátí None = selhání, má se retryovat."""
        call_count = [0]

        def fake_req(m, p, d=None, eh=None):
            call_count[0] += 1
            return None  # failure every time

        self.db._req = fake_req
        result = self.db._req_with_retry("POST", "test", max_attempts=3)
        self.assertIsNone(result)
        self.assertEqual(call_count[0], 3, "None má vyčerpat všechny pokusy")

    @patch("time.sleep")
    def test_empty_success_sentinel_is_success_no_retry(self, mock_sleep):
        """_EMPTY_SUCCESS (204/return=minimal) = úspěch, žádný retry."""
        call_count = [0]

        def fake_req(m, p, d=None, eh=None):
            call_count[0] += 1
            return _EMPTY_SUCCESS

        self.db._req = fake_req
        result = self.db._req_with_retry("POST", "test", max_attempts=6)
        self.assertIs(result, _EMPTY_SUCCESS)
        self.assertEqual(call_count[0], 1)
        mock_sleep.assert_not_called()


# ─────────────────────────────────────────────────────────────
# E3 — CircuitBreaker třída
# ─────────────────────────────────────────────────────────────
class TestCircuitBreaker(unittest.TestCase):

    def test_trips_after_threshold(self):
        cb = CircuitBreaker(3)
        self.assertFalse(cb.record_failure())  # 1
        self.assertFalse(cb.record_failure())  # 2
        self.assertTrue(cb.record_failure())   # 3 → tripped
        self.assertTrue(cb.tripped)

    def test_resets_on_success(self):
        cb = CircuitBreaker(3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        self.assertFalse(cb.tripped)
        self.assertFalse(cb.record_failure())  # reset: 1 failure

    def test_threshold_1(self):
        cb = CircuitBreaker(1)
        self.assertTrue(cb.record_failure())

    def test_not_tripped_before_threshold(self):
        cb = CircuitBreaker(5)
        for _ in range(4):
            self.assertFalse(cb.record_failure())
        self.assertFalse(cb.tripped)


# ─────────────────────────────────────────────────────────────
# E3 integration — circuit breaker volá emergency_save
# ─────────────────────────────────────────────────────────────
class TestCircuitBreakerIntegration(unittest.TestCase):

    @patch("time.sleep")
    @patch("crawler.emergency_save", return_value=True)
    def test_circuit_breaker_calls_emergency_and_returns_emergency(
        self, mock_emergency_save, mock_sleep
    ):
        """Když upsert_batch vždy selže, circuit breaker musí zavolat emergency_save
        a run_market musí vrátit 'emergency' bez neošetřené výjimky."""
        db = DB("http://test", "key")
        db.upsert_batch   = lambda rows: None   # vždy selže
        db.upsert_state   = lambda gl, hl, d: False
        db.count_market   = lambda gl, hl: 0
        db.select         = lambda t, p: []     # žádný uložený stav

        market = {"gl": "cz", "hl": "cs"}
        cfg    = {
            "max_depth":                   1,
            "max_runtime_minutes":         25,
            "batch_size":                  1,   # každý prefix → flush → failure
            "delay_between_requests_ms":   0,
        }

        with patch.object(crawler.GoogleAPI, "fetch", return_value=["test phrase"]):
            result = run_market(db, market, cfg, dry_run=False, run_id="test1234")

        self.assertEqual(result, "emergency",
                         "circuit breaker musí vést k výsledku 'emergency'")
        mock_emergency_save.assert_called_once()
        args = mock_emergency_save.call_args
        self.assertEqual(args[0][1], "cz")   # gl
        self.assertEqual(args[0][2], "cs")   # hl


# ─────────────────────────────────────────────────────────────
# E4 — emergency_save: DB selže → soubor vytvořen
# ─────────────────────────────────────────────────────────────
class TestEmergencySave(unittest.TestCase):

    def _make_db(self):
        db = DB("http://test", "key")
        db.upsert_state = lambda gl, hl, d: False  # DB vždy selže
        return db

    def test_creates_file_and_returns_true(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            orig = os.getcwd()
            os.chdir(tmpdir)
            try:
                state = {
                    "current_depth":  1,
                    "current_prefix": "ab",
                    "queue":          ["ac", "ad"],
                    "next_queue":     [],
                    "processed":      10,
                    "queries_total":  50,
                    "new_total":      5,
                }
                result = emergency_save(self._make_db(), "cz", "cs", state, "run001", "test")
                self.assertTrue(result)

                fname = "crawler_state_emergency_run001_cz_cs.json"
                self.assertTrue(os.path.exists(fname))

                with open(fname) as f:
                    snap = json.load(f)

                self.assertEqual(snap["gl"], "cz")
                self.assertEqual(snap["hl"], "cs")
                self.assertEqual(snap["queue"], ["ac", "ad"])
                self.assertEqual(snap["current_depth"], 1)
                self.assertEqual(snap["status"], "paused")
                self.assertIn("emergency_at", snap)
            finally:
                os.chdir(orig)

    def test_db_success_skips_file(self):
        """Pokud DB save uspěje, soubor se nevytváří."""
        db = DB("http://test", "key")
        db.upsert_state = lambda gl, hl, d: True  # DB uspěje

        with tempfile.TemporaryDirectory() as tmpdir:
            orig = os.getcwd()
            os.chdir(tmpdir)
            try:
                state = {"current_depth": 0, "current_prefix": "",
                         "queue": [], "next_queue": [],
                         "processed": 0, "queries_total": 0, "new_total": 0}
                result = emergency_save(db, "cz", "cs", state, "run002")
                self.assertTrue(result)
                self.assertFalse(os.path.exists("crawler_state_emergency_run002_cz_cs.json"))
            finally:
                os.chdir(orig)


# ─────────────────────────────────────────────────────────────
# E5 — load_state: status='running' je resumovatelný (ne fresh start)
# ─────────────────────────────────────────────────────────────
class TestLoadState(unittest.TestCase):

    def _db_with_row(self, row):
        db = DB("http://test", "key")
        db.select = lambda t, p: [row]
        return db

    def test_running_status_returns_state_with_queue(self):
        row = {
            "gl": "cz", "hl": "cs", "status": "running",
            "current_depth": 1, "current_prefix": "ab",
            "queue": ["ac", "ad", "ae"], "next_queue": [],
            "processed": 42, "queries_total": 100, "new_total": 10,
            "updated_at": "2026-06-02T08:00:00+00:00",
        }
        state = load_state(self._db_with_row(row), "cz", "cs")
        self.assertIsNotNone(state, "status=running musí vrátit state (ne None)")
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["queue"], ["ac", "ad", "ae"])

    def test_paused_status_returns_state(self):
        row = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "current_depth": 1, "current_prefix": "xy",
            "queue": ["xz"], "next_queue": [],
            "processed": 99, "queries_total": 200, "new_total": 50,
        }
        state = load_state(self._db_with_row(row), "cz", "cs")
        self.assertIsNotNone(state)
        self.assertEqual(state["queue"], ["xz"])

    def test_json_string_queue_decoded(self):
        """Zpětná kompatibilita: queue jako JSON string (starý formát) se dekóduje."""
        row = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "current_depth": 0, "current_prefix": "",
            "queue": '["a", "b", "c"]',   # starý double-serialized formát
            "next_queue": "[]",
            "processed": 0, "queries_total": 0, "new_total": 0,
        }
        state = load_state(self._db_with_row(row), "cz", "cs")
        self.assertEqual(state["queue"], ["a", "b", "c"])
        self.assertEqual(state["next_queue"], [])

    def test_native_list_queue_used_directly(self):
        """Nový formát: queue jako Python list (nativní JSONB) prochází přímo."""
        row = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "current_depth": 0, "current_prefix": "",
            "queue": ["a", "b"],   # nativní list
            "next_queue": [],
            "processed": 0, "queries_total": 0, "new_total": 0,
        }
        state = load_state(self._db_with_row(row), "cz", "cs")
        self.assertEqual(state["queue"], ["a", "b"])

    def test_no_row_returns_none(self):
        db = DB("http://test", "key")
        db.select = lambda t, p: []
        self.assertIsNone(load_state(db, "cz", "cs"))


# ─────────────────────────────────────────────────────────────
# E6 — load_emergency_state: validace gl/hl a timestamp
# ─────────────────────────────────────────────────────────────
class TestLoadEmergencyState(unittest.TestCase):

    def _write_snap(self, snap, tmpdir):
        path = os.path.join(tmpdir, "snap.json")
        with open(path, "w") as f:
            json.dump(snap, f)
        return path

    def _db_with_ts(self, db_ts):
        db = DB("http://test", "key")
        db.select = lambda t, p: [{"updated_at": db_ts}] if db_ts else []
        return db

    def test_newer_file_used_when_db_older(self):
        snap = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "emergency_at": "2026-06-02T10:00:00+00:00",
            "queue": ["ab", "ac"], "next_queue": [],
            "current_depth": 1, "processed": 50,
            "queries_total": 100, "new_total": 5,
        }
        with tempfile.TemporaryDirectory() as d:
            path  = self._write_snap(snap, d)
            db    = self._db_with_ts("2026-06-02T08:00:00+00:00")  # starší DB
            state = load_emergency_state(path, "cz", "cs", db)
        self.assertIsNotNone(state)
        self.assertEqual(state["queue"], ["ab", "ac"])

    def test_older_file_ignored_when_db_newer(self):
        snap = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "emergency_at": "2026-06-02T06:00:00+00:00",  # starší soubor
            "queue": ["old"], "next_queue": [],
        }
        with tempfile.TemporaryDirectory() as d:
            path  = self._write_snap(snap, d)
            db    = self._db_with_ts("2026-06-02T09:00:00+00:00")  # novější DB
            state = load_emergency_state(path, "cz", "cs", db)
        self.assertIsNone(state, "Starší soubor musí být ignorován")

    def test_wrong_market_rejected(self):
        snap = {"gl": "de", "hl": "de", "queue": [], "next_queue": []}
        with tempfile.TemporaryDirectory() as d:
            path  = self._write_snap(snap, d)
            db    = self._db_with_ts(None)
            state = load_emergency_state(path, "cz", "cs", db)
        self.assertIsNone(state, "Jiný market musí být odmítnut")

    def test_no_db_row_uses_file(self):
        """Pokud DB nemá záznam, soubor se použije bez ohledu na timestamp."""
        snap = {
            "gl": "cz", "hl": "cs", "status": "paused",
            "emergency_at": "2026-06-02T10:00:00+00:00",
            "queue": ["xy"], "next_queue": [],
            "current_depth": 0, "processed": 0,
            "queries_total": 0, "new_total": 0,
        }
        with tempfile.TemporaryDirectory() as d:
            path  = self._write_snap(snap, d)
            db    = self._db_with_ts(None)   # žádný DB záznam
            state = load_emergency_state(path, "cz", "cs", db)
        self.assertIsNotNone(state)
        self.assertEqual(state["queue"], ["xy"])


# ─────────────────────────────────────────────────────────────
# E7 — normalize: identická s SQL funkcí
# ─────────────────────────────────────────────────────────────
class TestNormalize(unittest.TestCase):

    def test_lowercase(self):
        self.assertEqual(normalize("HELLO"), "hello")

    def test_strip_whitespace(self):
        self.assertEqual(normalize("  hello world  "), "hello world")

    def test_collapse_whitespace(self):
        self.assertEqual(normalize("foo   bar\ttab"), "foo bar tab")

    def test_diacritics_preserved(self):
        self.assertEqual(normalize("Čeština"), "čeština")
        self.assertEqual(normalize("Über"), "über")

    def test_empty_string(self):
        self.assertEqual(normalize(""), "")


# ─────────────────────────────────────────────────────────────
# E8 — kill-switch: stop_flag zastaví market; 403 tripne killswitch
# ─────────────────────────────────────────────────────────────
class TestKillSwitch(unittest.TestCase):

    @patch("time.sleep")
    def test_killswitch_stops_market(self, mock_sleep):
        """stop_flag=True → run_market vrátí 'paused' bez volání fetch."""
        db = DB("http://test", "key")
        db.get_control  = lambda: {"stop_flag": True}
        db.upsert_state = lambda gl, hl, d: True
        db.upsert_batch = lambda rows: []
        db.count_market = lambda gl, hl: 0
        db.select       = lambda t, p: []
        cfg = {
            "max_depth": 1, "max_runtime_minutes": 25,
            "batch_size": 50, "delay_between_requests_ms": 0,
        }
        with patch.object(crawler.GoogleAPI, "fetch", return_value=["test phrase"]):
            result = run_market(db, {"gl": "cz", "hl": "cs"}, cfg, False, "ks001")
        self.assertEqual(result, "paused",
                         "Kill-switch musí zastavit market a vrátit 'paused'")

    @patch("time.sleep")
    @patch("crawler._notify_send")
    def test_403_trips_killswitch(self, mock_notify, mock_sleep):
        """fetch()=None (403) → trip_killswitch volán, status='paused', return 'blocked'."""
        db = DB("http://test", "key")
        db.get_control     = lambda: {"stop_flag": False, "shared_delay_ms": 300}
        db.upsert_state    = MagicMock(return_value=True)
        db.upsert_batch    = lambda rows: []
        db.count_market    = lambda gl, hl: 0
        db.select          = lambda t, p: []
        db.trip_killswitch = MagicMock(return_value=True)
        cfg = {
            "max_depth": 1, "max_runtime_minutes": 25,
            "batch_size": 50, "delay_between_requests_ms": 0,
        }
        with patch.object(crawler.GoogleAPI, "fetch", return_value=None):
            result = run_market(db, {"gl": "cz", "hl": "cs"}, cfg, False, "ks002")
        self.assertEqual(result, "blocked")
        db.trip_killswitch.assert_called_once()
        call_args = db.trip_killswitch.call_args[0]
        self.assertIn("403", call_args[0])
        self.assertEqual(call_args[1], "cz")
        self.assertEqual(call_args[2], "cs")
        # Stav uložen jako 'paused' (ne 'error')
        self.assertEqual(db.upsert_state.call_args[0][2].get("status"), "paused")


if __name__ == "__main__":
    unittest.main(verbosity=2)
