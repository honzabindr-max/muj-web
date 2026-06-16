#!/usr/bin/env python3
"""
Unified Google Suggest Crawler — google_suggestions_v2 (v2 — resilient)
Nahrazuje crawler_google.py / _at / _de. Seznam (crawler_auto.py) se nedotýká.

Použití:
  python crawler.py [--dry-run true] [--max-depth 1] [--batch-limit 5]
                    [--max-parallel 1] [--market-filter cz/cs]
                    [--run-id abc123] [--resume-from crawler_state_emergency_abc123.json]

Resilience:
  - _req() chytá všechny síťové výjimky (TimeoutError, URLError, SSLError, …) → None
  - DB volání: _req_with_retry() s exponential backoff + jitter (max 6 pokusů)
  - CircuitBreaker: po 3 vyčerpaných flush blocích → emergency_save()
  - emergency_save(): 1) DB save (paused); 2) soubor + log marker
  - status='running' při startu = crash remnant → resumovatelné
    (GH Actions concurrency guard brání skutečně souběžnému běhu)
  - queue ukládána jako nativní JSONB array (ne json.dumps string)
  - load_state() zpětně kompatibilní (zvládá obě varianty)
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, http.client, json, os, random, re, socket, ssl, sys, threading, time
import urllib.request, urllib.parse, uuid
from datetime import datetime, timezone, timedelta, date

try:
    import yaml
except ImportError:
    print("✗ Chybí pyyaml — spusť: pip install pyyaml")
    sys.exit(1)

try:
    from notify import send as _notify_send
except ImportError:

    def _notify_send(msg):
        print(f"  [notify] {msg}")


# ─────────────────────────────────────────────────────────────
# Proxy setup — jeden opener pro celý run (thread-safe pro čtení)
# ─────────────────────────────────────────────────────────────
_PROXY_URL = os.environ.get("PROXY_URL", "")
if _PROXY_URL:
    _GOOGLE_OPENER = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": _PROXY_URL, "https": _PROXY_URL})
    )
else:
    _GOOGLE_OPENER = urllib.request.build_opener()

# ─────────────────────────────────────────────────────────────
# Konfigurace
# ─────────────────────────────────────────────────────────────
SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
SUGGEST_LIMIT = 10
MAX_RETRIES = 3  # Google API retry pokusy
TABLE = "google_suggestions_v2"
STATE_TABLE = "google_crawler_state"
CONTROL_TABLE = "crawler_control"
SAFE = '=&.,()!*:"'

DB_MAX_RETRIES = 6  # Max retry pokusů na jeden DB request
DB_BACKOFF_BASE = 1.0  # Základ exponential backoff (sekundy)
CIRCUIT_BREAKER_THRESHOLD = 3  # Počet vyčerpaných flush bloků před emergency_save

# Sentinel: 2xx s prázdným tělem (return=minimal / 204 No Content).
# Odlišuje "úspěch bez dat" od "selhání" (None).
_EMPTY_SUCCESS = object()

# Zámek pro emergency_save log blok — zabrání míchání EMERGENCY_STATE_SNAPSHOT výstupu ze dvou threadů.
_emergency_lock = threading.Lock()

# ─────────────────────────────────────────────────────────────
# Abecedy pro BFS expand_chars (per hl kód)
# ─────────────────────────────────────────────────────────────
_LATIN_BASE = list("abcdefghijklmnopqrstuvwxyz0123456789 ")
ALPHABETS: dict[str, list[str]] = {
    "latin": _LATIN_BASE,
    "cs": list("aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž0123456789 "),
    "sk": list("aáäbcčdďeéfghiíjklľmnňoóôpqrŕsštťuúvwxyýzž0123456789 "),
    "de": list("abcdefghijklmnopqrstuvwxyzäöüß0123456789 "),
    "fr": list("abcdefghijklmnopqrstuvwxyzàâçéèêëîïôûùü0123456789 "),
    "es": list("abcdefghijklmnopqrstuvwxyzáéíñóúü0123456789 "),
    "pt": list("abcdefghijklmnopqrstuvwxyzàáâãçéêíóôõú0123456789 "),
    "pl": list("abcdefghijklmnopqrstuvwxyzńóśźżąćę0123456789 "),
    "nl": list("abcdefghijklmnopqrstuvwxyz0123456789 "),
    "sv": list("abcdefghijklmnopqrstuvwxyzåäö0123456789 "),
    "da": list("abcdefghijklmnopqrstuvwxyzæøå0123456789 "),
    "no": list("abcdefghijklmnopqrstuvwxyzæøå0123456789 "),
    "fi": list("abcdefghijklmnopqrstuvwxyzäö0123456789 "),
    "ro": list("abcdefghijklmnopqrstuvwxyzăâîșț0123456789 "),
    "hr": list("abcdefghijklmnopqrstuvwxyzčćđšž0123456789 "),
    "sl": list("abcdefghijklmnopqrstuvwxyzčšž0123456789 "),
    "tr": list("abcdefghijklmnopqrstuvwxyzçğıöşü0123456789 "),
    "vi": list("abcdefghijklmnopqrstuvwxyzàáâãèéêìíòóôõùúýăđơư0123456789 "),
    "id": _LATIN_BASE,
    "ms": _LATIN_BASE,
}


def get_alphabet(hl: str) -> list[str]:
    return ALPHABETS.get(hl, _LATIN_BASE)


def get_roots(hl: str) -> list[str]:
    return [c for c in get_alphabet(hl) if c != " "]


# ─────────────────────────────────────────────────────────────
# Normalizace — musí odpovídat SQL v migraci:
#   lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g')))
# ─────────────────────────────────────────────────────────────
def normalize(phrase: str) -> str:
    return re.sub(r"\s+", " ", phrase).strip().lower()


# ─────────────────────────────────────────────────────────────
# Circuit Breaker
# ─────────────────────────────────────────────────────────────
class CircuitBreaker:
    """Čítač po sobě jdoucích DB selhání (každé = 1 vyčerpaný retry blok)."""

    def __init__(self, threshold: int):
        self.threshold = threshold
        self.failures = 0

    def record_success(self):
        self.failures = 0

    def record_failure(self) -> bool:
        """Inkrementuje čítač. Vrátí True pokud byl překročen práh (tripped)."""
        self.failures += 1
        return self.failures >= self.threshold

    @property
    def tripped(self) -> bool:
        return self.failures >= self.threshold


# ─────────────────────────────────────────────────────────────
# DB třída — PostgREST/urllib
# ─────────────────────────────────────────────────────────────
class DB:
    def __init__(s, url, key):
        s.base = url.rstrip("/") + "/rest/v1"
        s.h = {
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        }
        s._control_cache = {"ts": 0.0, "data": None}

    def _req(s, m, p, d=None, eh=None):
        """Jeden HTTP request. Vrací:
          - parsed JSON (dict/list) — úspěch s daty
          - _EMPTY_SUCCESS          — 2xx s prázdným tělem (return=minimal)
          - None                    — jakékoli selhání (síťové, HTTP, timeout)
        Nikdy nevyhazuje výjimku.
        """
        u = s.base + "/" + p
        b = json.dumps(d).encode() if d else None
        h = dict(s.h)
        h.update(eh or {})
        try:
            r = urllib.request.urlopen(
                urllib.request.Request(u, data=b, headers=h, method=m), timeout=30
            )
            t = r.read().decode()
            if not t.strip():
                return _EMPTY_SUCCESS
            return json.loads(t)
        except urllib.error.HTTPError as e:
            code = e.code
            err = e.read().decode()[:200]
            if code not in (409,):
                print(f"  ⚠ HTTP {code}: {err[:120]}")
            return None
        except (
            urllib.error.URLError,  # DNS fail, connection refused, wraps socket.timeout
            TimeoutError,  # Python 3.11+, také read/write timeout
            socket.timeout,  # Python < 3.11
            http.client.RemoteDisconnected,
            http.client.IncompleteRead,
            ConnectionError,  # ConnectionResetError, BrokenPipeError, …
            ssl.SSLError,
            OSError,  # socket-level errors na některých platformách
        ) as e:
            print(f"  ⚠ Network error ({type(e).__name__}): {str(e)[:120]}")
            return None

    def _req_with_retry(
        s,
        m,
        p,
        d=None,
        eh=None,
        max_attempts: int = DB_MAX_RETRIES,
        backoff_base: float = DB_BACKOFF_BASE,
    ):
        """_req() s exponential backoff + jitter. Vrátí None pokud všechny pokusy selžou."""
        for attempt in range(max_attempts):
            result = s._req(m, p, d, eh)
            if (
                result is not None
            ):  # None = failure; vše ostatní (incl. [] a _EMPTY_SUCCESS) = OK
                return result
            if attempt < max_attempts - 1:
                wait = min(60.0, backoff_base * (2**attempt))
                wait *= 0.8 + 0.4 * random.random()  # ±20% jitter
                print(
                    f"  ↺ DB retry {attempt + 1}/{max_attempts - 1}, backoff {wait:.1f}s"
                )
                time.sleep(wait)
        return None

    def select(s, t, p=""):
        res = s._req_with_retry(
            "GET", t + "?" + urllib.parse.quote(p, safe=SAFE), max_attempts=3
        )
        if res is None or res is _EMPTY_SUCCESS:
            return []
        return res if isinstance(res, list) else []

    def update(s, t, p, d):
        return s._req(
            "PATCH",
            t + "?" + urllib.parse.quote(p, safe=SAFE),
            d,
            {"Prefer": "return=minimal"},
        )

    def upsert_batch(s, rows: list):
        """Batch upsert do google_suggestions_v2.
        Vrací: list id-čeků (i prázdný [] = všechno DO NOTHING = OK), nebo None po vyčerpání retry.
        """
        if not rows:
            return []
        res = s._req_with_retry(
            "POST",
            TABLE + "?on_conflict=gl,hl,phrase_norm&select=id",
            rows,
            {"Prefer": "resolution=ignore-duplicates,return=representation"},
        )
        if res is None:
            return None  # trvalé selhání
        if res is _EMPTY_SUCCESS:
            return []  # neočekávané prázdné tělo → treat as no inserts
        return res if isinstance(res, list) else []

    def upsert_state(s, gl: str, hl: str, d: dict) -> bool:
        """Lazy-upsert stavu pro market (gl, hl). Vrací True = úspěch."""
        res = s._req_with_retry(
            "POST",
            STATE_TABLE + "?on_conflict=gl,hl",
            {**d, "gl": gl, "hl": hl},
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        return res is not None  # _EMPTY_SUCCESS nebo data = True; None = False

    def count_market(s, gl: str, hl: str) -> int:
        req = urllib.request.Request(
            s.base + "/" + TABLE + "?gl=eq." + gl + "&hl=eq." + hl + "&select=id"
        )
        req.add_header("apikey", s.h["apikey"])
        req.add_header("Authorization", s.h["Authorization"])
        req.add_header("Range", "0-0")
        req.add_header("Prefer", "count=exact")
        try:
            r = urllib.request.urlopen(req, timeout=10)
            cr = r.headers.get("Content-Range", "")
            return int(cr.split("/")[1]) if "/" in cr else 0
        except Exception:
            return 0

    def get_control(s) -> dict | None:
        """Načte crawler_control se 5s TTL cache (per-instance, thread-safe)."""
        now = time.time()
        if now - s._control_cache["ts"] < 5.0 and s._control_cache["data"] is not None:
            return s._control_cache["data"]
        rows = s._req("GET", CONTROL_TABLE + "?id=eq.1&select=*")
        if rows and isinstance(rows, list):
            s._control_cache = {"ts": now, "data": rows[0]}
            return rows[0]
        return None

    def trip_killswitch(s, reason: str, gl: str, hl: str) -> bool:
        """Nastaví stop_flag=True. Eskalující cooldown: 15 min → 1h → 6h."""
        ctrl = s.get_control()
        if ctrl and ctrl.get("stop_flag"):
            return True  # idempotency guard

        today = datetime.now(timezone.utc).date().isoformat()
        n = 1
        if ctrl and ctrl.get("block_count_date") == today:
            n = (ctrl.get("block_count_today") or 0) + 1

        minutes = {1: 15, 2: 60}.get(n, 360)
        now_dt = datetime.now(timezone.utc)
        cooldown_until = (now_dt + timedelta(minutes=minutes)).isoformat()

        payload = {
            "stop_flag": True,
            "stop_reason": reason[:500],
            "stopped_at": now_dt.isoformat(),
            "cooldown_until": cooldown_until,
            "block_count_today": n,
            "block_count_date": today,
            "updated_at": now_dt.isoformat(),
        }
        ok = s._req(
            "PATCH", CONTROL_TABLE + "?id=eq.1", payload, {"Prefer": "return=minimal"}
        )
        s._control_cache["ts"] = 0.0  # invalidate

        _notify_send(
            f"🛑 Kill-switch aktivován\nMarket: {gl}/{hl}\n"
            f"Důvod: {reason[:200]}\n"
            f"Cooldown: {minutes} min (blok #{n} dnes)\n"
            f"Obnovení: {cooldown_until}"
        )
        return ok is not None

    def reset_killswitch_after_cooldown(s) -> bool:
        """Auto-reset stop_flag po vypršení cooldownu. NE-resetuje emergency stop (cooldown_until=NULL)."""
        ok = s._req_with_retry(
            "PATCH",
            CONTROL_TABLE + "?id=eq.1&stop_flag=eq.true&cooldown_until=not.is.null",
            {
                "stop_flag": False,
                "stop_reason": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {"Prefer": "return=minimal"},
        )
        s._control_cache["ts"] = 0.0  # invalidate cache povinně
        return ok is not None

    def set_shared_delay(s, ms: int) -> None:
        """Nastaví sdílený delay pro všechny thready (fire-and-forget)."""
        s._req(
            "PATCH",
            CONTROL_TABLE + "?id=eq.1",
            {
                "shared_delay_ms": ms,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            {"Prefer": "return=minimal"},
        )
        s._control_cache["ts"] = 0.0


# ─────────────────────────────────────────────────────────────
# HetznerPgWriter — psycopg2 direct-PG write path (S4)
# ─────────────────────────────────────────────────────────────
_PG_COL_SAFE = re.compile(r"^[a-z_][a-z0-9_]*$")

_STATE_COLS_ALLOWED = frozenset(
    {
        "gl",
        "hl",
        "current_depth",
        "current_prefix",
        "queue",
        "next_queue",
        "status",
        "processed",
        "queries_total",
        "new_total",
        "last_started_at",
        "last_finished_at",
        "updated_at",
    }
)

_CONTROL_COLS_ALLOWED = frozenset(
    {
        "stop_flag",
        "stop_reason",
        "stopped_at",
        "cooldown_until",
        "block_count_today",
        "block_count_date",
        "shared_delay_ms",
        "updated_at",
    }
)

_JSONB_COLS = frozenset({"queue", "next_queue"})

_SUGG_INSERT_COLS = (
    "gl",
    "hl",
    "phrase",
    "phrase_norm",
    "depth",
    "parent_prefix",
    "first_seen_at",
    "last_seen_at",
    "seen_count",
)


def _parse_postgrest_eq_filter(p: str) -> list[tuple[str, str]]:
    """PostgREST filter string → list of (col, value) eq. pairs.

    'select=*&gl=eq.cz&hl=eq.cs' → [('gl', 'cz'), ('hl', 'cs')]
    Skips meta-keys (select, order, limit, offset) and non-eq. ops.
    """
    result = []
    for part in p.split("&"):
        if not part or "=" not in part:
            continue
        col, rest = part.split("=", 1)
        col = col.strip()
        if col in ("select", "order", "limit", "offset"):
            continue
        if rest.startswith("eq."):
            result.append((col, rest[3:]))
    return result


def _dsn_meta(dsn: str) -> dict:
    """Extract non-secret host metadata from DSN URL. Never returns credentials."""
    try:
        parsed = urllib.parse.urlparse(dsn)
        host = parsed.hostname or "unknown"
        port = parsed.port or 5432
        if host in ("127.0.0.1", "localhost", "::1"):
            host_class = "local"
        elif host.startswith("100."):  # Tailscale IP range
            host_class = "tailscale"
        else:
            host_class = "remote"
        return {"host_class": host_class, "port": port}
    except Exception:
        return {"host_class": "unknown", "port": "unknown"}


class HetznerPgWriter:
    """psycopg2-based write path for Hetzner PostgreSQL (S4 write cutover).

    Drop-in replacement for DB() with the same public interface.
    DSN is never logged — errors mask the connection string.
    When S4_CANARY_ID env is set, activates canary mode: writes a synthetic
    phrase and an audit row to s4_write_canary_audit (fail-closed).
    """

    def __init__(self, dsn: str) -> None:
        try:
            import psycopg2
            import psycopg2.extras
        except ImportError:
            raise RuntimeError(
                "psycopg2 not installed — run: pip install psycopg2-binary"
            )

        self._psycopg2 = psycopg2
        self._extras = psycopg2.extras

        # Canary mode: S4_CANARY_ID is canonical; S4_CANARY_PILOT_ID accepted as alias
        self._canary_id = os.environ.get("S4_CANARY_ID", "") or os.environ.get(
            "S4_CANARY_PILOT_ID", ""
        )
        self._canary_gl = ""
        self._canary_hl = ""
        self._canary_run_id = ""

        # Safe DSN metadata for logging — credentials are never printed
        meta = _dsn_meta(dsn)
        self._writer_route = f"{meta['host_class']}_{meta['port']}"
        app_name = (
            f"suggest_s4_canary_{self._writer_route}_{self._canary_id}"
            if self._canary_id
            else "suggest_crawler"
        )

        print(
            f"  [HetznerPgWriter] writer_route={self._writer_route} "
            f"db_host_class={meta['host_class']} db_port={meta['port']} "
            f"dsn_secret_printed=false"
            + (f" canary_id={self._canary_id!r}" if self._canary_id else "")
        )

        try:
            self._conn = psycopg2.connect(dsn, application_name=app_name)
            self._conn.autocommit = False
        except psycopg2.Error as exc:
            raise RuntimeError(
                f"HetznerPgWriter: DB connect failed ({type(exc).__name__})"
            ) from None

        self._control_cache: dict = {"ts": 0.0, "data": None}

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    def _cursor(self):
        return self._conn.cursor(cursor_factory=self._extras.RealDictCursor)

    def _exec(self, sql: str, params=None, *, fetch: bool = False):
        """Execute parameterized SQL with commit/rollback. Returns rows if fetch=True."""
        try:
            with self._cursor() as cur:
                cur.execute(sql, params)
                if fetch:
                    rows = [dict(r) for r in cur.fetchall()]
                    self._conn.commit()
                    return rows
                self._conn.commit()
                return True
        except self._psycopg2.Error as exc:
            self._conn.rollback()
            # Redact DSN patterns before logging (psycopg2 embeds DSN in some error messages)
            raw = str(exc)[:400]
            safe = re.sub(
                r"[a-zA-Z][a-zA-Z0-9+\-.]*://[^\s'\"@]*@[^\s'\"]*",
                "<dsn-redacted>",
                raw,
            )
            print(f"  ⚠ PgWriter SQL error ({type(exc).__name__}): {safe[:200]}")
            return None

    def select(self, t: str, p: str = "") -> list:
        """Parse PostgREST eq. filter → SQL SELECT WHERE."""
        if not _PG_COL_SAFE.match(t):
            print(f"  ⚠ PgWriter.select: unsafe table name {t!r}")
            return []
        filters = _parse_postgrest_eq_filter(p)
        where_parts, values = [], []
        for col, val in filters:
            if not _PG_COL_SAFE.match(col):
                continue
            where_parts.append(f"{col} = %s")
            values.append(val)
        where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        result = self._exec(f"SELECT * FROM {t} {where}", values or None, fetch=True)
        return result if result is not None else []

    def get_control(self) -> dict | None:
        """Loads crawler_control with 5s TTL cache (per-instance)."""
        now = time.time()
        if (
            now - self._control_cache["ts"] < 5.0
            and self._control_cache["data"] is not None
        ):
            return self._control_cache["data"]
        rows = self._exec(
            f"SELECT * FROM {CONTROL_TABLE} WHERE id = %s", (1,), fetch=True
        )
        if rows:
            self._control_cache = {"ts": now, "data": rows[0]}
            return rows[0]
        return None

    def count_market(self, gl: str, hl: str) -> int:
        rows = self._exec(
            f"SELECT COUNT(*) AS n FROM {TABLE} WHERE gl = %s AND hl = %s",
            (gl, hl),
            fetch=True,
        )
        return int(rows[0].get("n", 0)) if rows else 0

    def upsert_batch(self, rows: list) -> list | None:
        """Batch insert into google_suggestions_v2. ON CONFLICT (gl,hl,phrase_norm) DO NOTHING.

        In canary mode (S4_CANARY_ID set): additionally inserts a synthetic canary phrase
        and writes an audit row to s4_write_canary_audit (fail-closed on audit failure).
        """
        if not rows:
            return []
        col_list = ", ".join(_SUGG_INSERT_COLS)
        placeholders = ", ".join(["%s"] * len(_SUGG_INSERT_COLS))
        sql = (
            f"INSERT INTO {TABLE} ({col_list}) VALUES ({placeholders}) "
            "ON CONFLICT (gl, hl, phrase_norm) DO NOTHING"
        )
        try:
            with self._cursor() as cur:
                data = [tuple(r.get(c) for c in _SUGG_INSERT_COLS) for r in rows]
                self._extras.execute_batch(cur, sql, data)
                self._conn.commit()
        except self._psycopg2.Error as exc:
            self._conn.rollback()
            print(
                f"  ⚠ PgWriter.upsert_batch error ({type(exc).__name__}): {str(exc)[:200]}"
            )
            if self._canary_id:
                self._write_canary_audit(
                    status="error",
                    suggestions_before=0,
                    suggestions_after=0,
                    state_touched=False,
                    result="upsert_batch_failed",
                    error=type(exc).__name__,
                )
            return None

        # ── Canary synthetic phrase + audit (fail-closed) ──
        if self._canary_id:
            nonce = uuid.uuid4().hex[:8]
            canary_phrase = f"__s4canary__{self._canary_id}__{nonce}"
            now_iso = datetime.now(timezone.utc).isoformat()
            canary_row = {
                "gl": self._canary_gl or (rows[0].get("gl") if rows else "xx"),
                "hl": self._canary_hl or (rows[0].get("hl") if rows else "xx"),
                "phrase": canary_phrase,
                "phrase_norm": canary_phrase,
                "depth": 0,
                "parent_prefix": "__canary__",
                "first_seen_at": now_iso,
                "last_seen_at": now_iso,
                "seen_count": 1,
            }
            canary_ok = False
            try:
                with self._cursor() as cur:
                    cur.execute(
                        sql, tuple(canary_row.get(c) for c in _SUGG_INSERT_COLS)
                    )
                    self._conn.commit()
                    canary_ok = True
            except self._psycopg2.Error as exc:
                self._conn.rollback()
                print(
                    f"  ⚠ PgWriter.canary insert error ({type(exc).__name__}): {str(exc)[:200]}"
                )

            audit_ok = self._write_canary_audit(
                status="success" if canary_ok else "error",
                suggestions_before=0,
                suggestions_after=1 if canary_ok else 0,
                state_touched=False,
                result=(
                    "canary_phrase_inserted" if canary_ok else "canary_insert_failed"
                ),
                error=None if canary_ok else "canary_insert_failed",
            )
            if audit_ok is None:
                raise RuntimeError(
                    f"canary_audit_fail: s4_write_canary_audit write failed "
                    f"(canary_id={self._canary_id!r}) — fail-closed, canary is NOT verified"
                )

        return []  # mirrors DB(): [] on DO NOTHING = OK

    def _write_canary_audit(
        self,
        *,
        status: str,
        suggestions_before: int,
        suggestions_after: int,
        state_touched: bool,
        result: str,
        error: str | None,
    ):
        """Insert/update audit row in s4_write_canary_audit. Returns None on failure."""
        sql = """
            INSERT INTO public.s4_write_canary_audit (
                canary_id, write_target, writer, source,
                gl, hl, first_pg_write_at, status,
                suggestions_before, suggestions_after, state_touched,
                run_id, canary_prefix, expected_batch_size,
                writer_route, application_name, result, error
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, now(), %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s
            )
            ON CONFLICT (canary_id) DO UPDATE SET
                status = EXCLUDED.status,
                suggestions_after = EXCLUDED.suggestions_after,
                result = EXCLUDED.result,
                error = EXCLUDED.error
        """
        app_name = f"suggest_s4_canary_{self._writer_route}_{self._canary_id}"
        params = (
            self._canary_id,
            "hetzner",
            "HetznerPgWriter",
            "crawler_runtime",
            self._canary_gl or None,
            self._canary_hl or None,
            status,
            suggestions_before,
            suggestions_after,
            state_touched,
            self._canary_run_id or None,
            f"__s4canary__{self._canary_id}__",
            None,
            self._writer_route,
            app_name,
            result,
            error,
        )
        return self._exec(sql, params)

    def upsert_state(self, gl: str, hl: str, d: dict) -> bool:
        """Upsert google_crawler_state for (gl,hl). ON CONFLICT (gl,hl) DO UPDATE."""
        if self._canary_id:
            raise RuntimeError(
                f"canary_guard: upsert_state blocked during canary "
                f"(S4_CANARY_ID={self._canary_id!r}) — state must not be touched in canary mode"
            )
        safe_d = {
            k: v
            for k, v in d.items()
            if k in _STATE_COLS_ALLOWED and _PG_COL_SAFE.match(k)
        }
        full = {**safe_d, "gl": gl, "hl": hl}
        cols = list(full.keys())
        col_list = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))
        update_parts = ", ".join(
            f"{c} = EXCLUDED.{c}" for c in cols if c not in ("gl", "hl")
        )
        sql = (
            f"INSERT INTO {STATE_TABLE} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT (gl, hl) DO UPDATE SET {update_parts}"
        )
        values = [
            self._extras.Json(v) if k in _JSONB_COLS else v for k, v in full.items()
        ]
        return self._exec(sql, values) is not None

    def update(self, t: str, p: str, d: dict) -> bool | None:
        """Generic: parse PostgREST eq. filter → SQL UPDATE WHERE."""
        if not _PG_COL_SAFE.match(t):
            print(f"  ⚠ PgWriter.update: unsafe table name {t!r}")
            return None
        allowed = (
            _CONTROL_COLS_ALLOWED
            if t == CONTROL_TABLE
            else _STATE_COLS_ALLOWED if t == STATE_TABLE else None
        )
        safe_d = {
            k: v
            for k, v in d.items()
            if _PG_COL_SAFE.match(k) and (allowed is None or k in allowed)
        }
        if not safe_d:
            return True
        filters = _parse_postgrest_eq_filter(p)
        where_parts, where_vals = [], []
        for col, val in filters:
            if not _PG_COL_SAFE.match(col):
                continue
            where_parts.append(f"{col} = %s")
            where_vals.append(val)
        set_parts = ", ".join(f"{k} = %s" for k in safe_d)
        where = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
        sql = f"UPDATE {t} SET {set_parts} {where}"
        return self._exec(sql, list(safe_d.values()) + where_vals) is not None

    def trip_killswitch(self, reason: str, gl: str, hl: str) -> bool:
        ctrl = self.get_control()
        if ctrl and ctrl.get("stop_flag"):
            return True  # idempotency guard

        today = datetime.now(timezone.utc).date().isoformat()
        n = 1
        if ctrl and ctrl.get("block_count_date") == today:
            n = (ctrl.get("block_count_today") or 0) + 1

        minutes = {1: 15, 2: 60}.get(n, 360)
        now_dt = datetime.now(timezone.utc)
        cooldown_until = (now_dt + timedelta(minutes=minutes)).isoformat()

        sql = (
            f"UPDATE {CONTROL_TABLE} SET "
            "stop_flag = %s, stop_reason = %s, stopped_at = %s, "
            "cooldown_until = %s, block_count_today = %s, block_count_date = %s, "
            "updated_at = %s WHERE id = %s"
        )
        result = self._exec(
            sql,
            (
                True,
                reason[:500],
                now_dt.isoformat(),
                cooldown_until,
                n,
                today,
                now_dt.isoformat(),
                1,
            ),
        )
        self._control_cache["ts"] = 0.0  # invalidate

        _notify_send(
            f"🛑 Kill-switch aktivován\nMarket: {gl}/{hl}\n"
            f"Důvod: {reason[:200]}\n"
            f"Cooldown: {minutes} min (blok #{n} dnes)\n"
            f"Obnovení: {cooldown_until}"
        )
        return result is not None

    def reset_killswitch_after_cooldown(self) -> bool:
        """Auto-reset stop_flag po vypršení cooldownu. NE-resetuje emergency stop (cooldown_until=NULL)."""
        result = self._exec(
            f"UPDATE {CONTROL_TABLE} SET stop_flag = %s, stop_reason = %s, updated_at = %s "
            f"WHERE id = %s AND stop_flag = true AND cooldown_until IS NOT NULL AND cooldown_until < now()",
            (False, None, datetime.now(timezone.utc).isoformat(), 1),
        )
        self._control_cache["ts"] = 0.0  # invalidate cache povinně
        return result is not None

    def set_shared_delay(self, ms: int) -> None:
        self._exec(
            f"UPDATE {CONTROL_TABLE} SET shared_delay_ms = %s, updated_at = %s WHERE id = %s",
            (ms, datetime.now(timezone.utc).isoformat(), 1),
        )
        self._control_cache["ts"] = 0.0


def _create_write_client(
    write_target: str,
    write_cfg: dict,
    *,
    no_db: bool = False,
    dry_run: bool = False,
):
    """Route to the correct write backend.

    Guards (SUGGEST_ALLOW_HETZNER_WRITE / SUGGEST_REQUIRE_S4_GO) are checked
    by the caller before this function is called — this function only constructs.
    Raises RuntimeError on unknown write_target or missing DSN env var.
    """
    if no_db or dry_run:
        return DB("", "")
    if write_target in ("supabase", "supabase_postgrest"):
        dsn_env = write_cfg.get("dsn_env", "SUGGEST_CRAWLER_WRITE_DATABASE_URL")
        supabase_url = os.environ.get("SUPABASE_URL", os.environ.get(dsn_env, ""))
        supabase_key = os.environ.get("SUPABASE_KEY", "")
        return DB(supabase_url, supabase_key)
    if write_target == "hetzner":
        dsn_env = write_cfg.get("dsn_env", "SUGGEST_CRAWLER_WRITE_DATABASE_URL")
        dsn = os.environ.get(dsn_env, "")
        if not dsn:
            raise RuntimeError(f"HetznerPgWriter: env var {dsn_env!r} is not set")
        return HetznerPgWriter(dsn)
    raise RuntimeError(
        f"write_target_guard: unknown write_target={write_target!r} — hard fail"
    )


# ─────────────────────────────────────────────────────────────
# Google Suggest API — adaptivní delay + backoff
# ─────────────────────────────────────────────────────────────
class GoogleAPI:
    def __init__(s, gl: str, hl: str, delay_ms: int = 500, db=None):
        s.gl = gl
        s.hl = hl
        s.delay = delay_ms / 1000.0
        s.base_delay = s.delay
        s.reqs = 0
        s.errs = 0
        s.last = 0.0
        s.db = db
        s._result_window: list[bool] = []
        s._soft_block_strikes = 0
        s._last_conflict_ratio: float = 0.0

    def _check_soft_block(s, last_prefix: str):
        """Detekuje tichý soft-block: <15% non-empty v okně 30 fetchů, 3× za sebou."""
        WINDOW, THRESHOLD, STRIKES = 30, 0.15, 3
        if len(s._result_window) < WINDOW:
            return
        ratio = sum(s._result_window) / WINDOW
        if ratio < THRESHOLD:
            MATURE_CONFLICT_THRESHOLD = 0.85
            if getattr(s, "_last_conflict_ratio", 0.0) >= MATURE_CONFLICT_THRESHOLD:
                print(
                    f"  ℹ Mature duplicate-heavy, NO strike "
                    f"(hit_ratio={ratio:.1%}, conflict_ratio={s._last_conflict_ratio:.2f}, "
                    f"prefix='{last_prefix}')"
                )
                s._soft_block_strikes = 0
                return
            s._soft_block_strikes += 1
            print(
                f"  ⚠ Soft-block podezření: hit_ratio={ratio:.1%}, "
                f"strike {s._soft_block_strikes}/{STRIKES} (prefix='{last_prefix}')"
            )
            if s._soft_block_strikes >= STRIKES and s.db is not None:
                s.db.trip_killswitch(
                    f"tichá degradace hit_ratio={ratio:.1%}", s.gl, s.hl
                )
        else:
            s._soft_block_strikes = 0

    def fetch(s, phrase: str):
        """Vrací list frází, [] pro žádný výsledek, nebo None pro 403 BLOCKED."""
        # Efektivní delay: max(lokální, sdílený z DB)
        effective_delay = s.delay
        if s.db is not None:
            ctrl = s.db.get_control()
            if ctrl:
                effective_delay = max(
                    s.delay, ctrl.get("shared_delay_ms", 300) / 1000.0
                )
        el = time.time() - s.last
        if el < effective_delay:
            time.sleep(effective_delay - el)
        params = {"client": "firefox", "q": phrase, "hl": s.hl, "gl": s.gl}
        url = SUGGEST_URL + "?" + urllib.parse.urlencode(params)
        for attempt in range(MAX_RETRIES):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        ),
                        "Accept": "application/json",
                        "Accept-Language": s.hl + ",en;q=0.5",
                    },
                )
                s.last = time.time()
                with _GOOGLE_OPENER.open(req, timeout=10) as r:
                    d = json.loads(r.read().decode())
                    s.reqs += 1
                    if s.delay > s.base_delay:
                        s.delay = max(s.base_delay, s.delay * 0.95)
                    results = d[1] if isinstance(d, list) and len(d) >= 2 else []
                    # Sliding window pro soft-block detekci
                    s._result_window.append(bool(results))
                    if len(s._result_window) > 30:
                        s._result_window.pop(0)
                    s._check_soft_block(phrase)
                    return results
            except urllib.error.HTTPError as e:
                s.errs += 1
                if e.code in (429, 503):
                    s.delay = min(10.0, s.delay * 2)
                    if s.db is not None:
                        s.db.set_shared_delay(min(10_000, int(s.delay * 2 * 1000)))
                    wait = s.delay * (attempt + 1)
                    print(
                        f"  ⚠ Rate limit ({e.code}), delay={s.delay:.1f}s, "
                        f"čekám {wait:.1f}s (pokus {attempt+1}/{MAX_RETRIES})"
                    )
                    time.sleep(wait)
                elif e.code == 403:
                    print("  ✗ BLOCKED 403 — ukončuji market")
                    return None
                else:
                    print(f"  ⚠ HTTP {e.code}, pokus {attempt+1}")
                    time.sleep(2)
            except Exception as e:
                s.errs += 1
                print(f"  ⚠ {type(e).__name__}: {e}, pokus {attempt+1}")
                time.sleep(2)
        return []


# ─────────────────────────────────────────────────────────────
# State management per (gl, hl)
# ─────────────────────────────────────────────────────────────
def load_state(db: DB, gl: str, hl: str) -> dict | None:
    """Načte stav z DB. Vrací row dict, nebo None pokud neexistuje nebo DB selhala."""
    rows = db.select(STATE_TABLE, f"select=*&gl=eq.{gl}&hl=eq.{hl}")
    if not rows:
        return None
    s = rows[0]
    # Zpětná kompatibilita: queue může být Python list (nový nativní JSONB)
    # nebo JSON string (starý double-serialized formát).
    s["queue"] = (
        s["queue"]
        if isinstance(s["queue"], list)
        else (json.loads(s["queue"]) if s["queue"] else [])
    )
    s["next_queue"] = (
        s["next_queue"]
        if isinstance(s["next_queue"], list)
        else (json.loads(s["next_queue"]) if s["next_queue"] else [])
    )
    return s


def save_state(db: DB, gl: str, hl: str, state: dict) -> bool:
    """Plný zápis stavu (incl. queue jako nativní JSONB array). Vrací True = úspěch."""
    return db.upsert_state(
        gl,
        hl,
        {
            "current_depth": state["current_depth"],
            "current_prefix": state["current_prefix"],
            "queue": state["queue"],  # Python list → nativní JSONB array
            "next_queue": state["next_queue"],  # Python list → nativní JSONB array
            "status": state["status"],
            "processed": state["processed"],
            "queries_total": state["queries_total"],
            "new_total": state["new_total"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def save_heartbeat(db: DB, gl: str, hl: str, state: dict) -> bool:
    """Lehký zápis bez queue — drží updated_at čerstvý. Vrací True = úspěch."""
    return db.upsert_state(
        gl,
        hl,
        {
            "current_depth": state["current_depth"],
            "current_prefix": state["current_prefix"],
            "status": state["status"],
            "processed": state["processed"],
            "queries_total": state["queries_total"],
            "new_total": state["new_total"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )


# ─────────────────────────────────────────────────────────────
# Emergency save — fallback řetězec při selhání DB
# ─────────────────────────────────────────────────────────────
def emergency_save(
    db: DB, gl: str, hl: str, state: dict, run_id: str, reason: str = ""
) -> bool:
    """
    1. Pokus o DB save (status=paused).
    2. Pokud selže: zapíše do souboru crawler_state_emergency_<run_id>.json
       a vypisuje log marker EMERGENCY_STATE_SNAPSHOT.
    Vrací True pokud alespoň jeden zápis uspěl.
    """
    payload = {
        "current_depth": state.get("current_depth", 0),
        "current_prefix": state.get("current_prefix", ""),
        "queue": state.get("queue", []),
        "next_queue": state.get("next_queue", []),
        "status": "paused",
        "processed": state.get("processed", 0),
        "queries_total": state.get("queries_total", 0),
        "new_total": state.get("new_total", 0),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # 1. DB save
    db_ok = db.upsert_state(gl, hl, payload)
    if db_ok:
        print(f"  ✓ Emergency: stav uložen do DB (status=paused, run_id={run_id})")
        return True

    # 2. Soubor
    snapshot = {
        **payload,
        "gl": gl,
        "hl": hl,
        "run_id": run_id,
        "emergency_reason": reason,
        "emergency_at": datetime.now(timezone.utc).isoformat(),
    }
    filename = f"crawler_state_emergency_{run_id}_{gl}_{hl}.json"
    snapshot_json = json.dumps(snapshot, ensure_ascii=False, indent=2)
    snapshot_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()[:16]
    file_ok = False

    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(snapshot_json)
        file_ok = True
    except Exception as write_err:
        print(f"  ✗ Nepodařilo se zapsat emergency soubor: {write_err}")

    # 3. Log marker — atomicky pod zámkem, aby se výstup dvou threadů nemíchal.
    q_len = len(payload["queue"])
    nq_len = len(payload["next_queue"])
    with _emergency_lock:
        print("EMERGENCY_STATE_SNAPSHOT")
        print(f"  soubor:      {filename}")
        print(f"  run_id:      {run_id}")
        print(f"  market:      {gl}/{hl}")
        print(f"  depth:       {payload['current_depth']}")
        print(f"  prefix:      {payload['current_prefix']}")
        print(f"  queue:       {q_len} prefixů")
        print(f"  next_queue:  {nq_len} prefixů")
        print(f"  new_total:   {payload['new_total']}")
        print(f"  queries:     {payload['queries_total']}")
        print(f"  důvod:       {reason[:200]}")
        if file_ok:
            print(f"  hash:        sha256:{snapshot_hash}")
            if len(snapshot_json) < 50_000:
                print("  [JSON < 50 KB, vypisuji celý snapshot do logu]")
                print(snapshot_json)
            else:
                print(
                    f"  [JSON {len(snapshot_json)//1024} KB — jen v souboru/artifactu]"
                )

    return file_ok


def load_emergency_state(path: str, gl: str, hl: str, db: DB) -> dict | None:
    """
    Načte emergency snapshot přes --resume-from.
    Volat POUZE explicitně (přes CLI), nikdy automaticky.
    Validuje gl/hl a porovná timestamp s DB — soubor má přednost jen pokud je novější.
    """
    try:
        with open(path, encoding="utf-8") as f:
            snap = json.load(f)
    except Exception as e:
        print(f"  ✗ Nepodařilo se načíst {path}: {e}")
        return None

    if snap.get("gl") != gl or snap.get("hl") != hl:
        print(
            f"  ✗ Emergency soubor: gl/hl nesedí "
            f"({snap.get('gl')}/{snap.get('hl')} vs {gl}/{hl}) — ignoruji"
        )
        return None

    snap_ts = snap.get("emergency_at", "")
    db_rows = db.select(STATE_TABLE, f"select=updated_at&gl=eq.{gl}&hl=eq.{hl}")

    if db_rows:
        db_ts = db_rows[0].get("updated_at") or ""
        if db_ts and snap_ts and snap_ts < db_ts:
            print(
                f"  ⚠ Soubor ({snap_ts}) starší než DB ({db_ts}) — "
                f"soubor ignoruji, použiju DB stav"
            )
            return None
        print(f"  ↩ Resume ze souboru (snap={snap_ts or '?'}, db={db_ts or '?'})")
    else:
        print(f"  ↩ DB nedostupná nebo bez záznamu — resumuji ze souboru")

    snap["queue"] = (
        snap["queue"]
        if isinstance(snap["queue"], list)
        else (json.loads(snap["queue"]) if snap["queue"] else [])
    )
    snap["next_queue"] = (
        snap["next_queue"]
        if isinstance(snap["next_queue"], list)
        else (json.loads(snap["next_queue"]) if snap["next_queue"] else [])
    )
    return snap


# ─────────────────────────────────────────────────────────────
# BFS session pro jeden market
# ─────────────────────────────────────────────────────────────
def run_market(
    db: DB,
    market: dict,
    cfg: dict,
    dry_run: bool,
    run_id: str,
    resume_from: str = "",
) -> str:
    """
    Spustí / naváže BFS session pro jeden market.
    Vrací: 'done' | 'paused' | 'blocked' | 'emergency'

    Status 'running' v DB při startu = crash remnant.
    GH Actions concurrency guard (cancel-in-progress: false) zabrání
    skutečně souběžnému běhu → 'running' je vždy bezpečné resumovat.
    """
    gl = market["gl"]
    hl = market["hl"]
    max_depth = market.get("max_depth", cfg["max_depth"])
    max_runtime = market.get("max_runtime_minutes", cfg["max_runtime_minutes"]) * 60
    batch_size = market.get("batch_size", cfg["batch_size"])
    delay_ms = market.get("delay_between_requests_ms", cfg["delay_between_requests_ms"])

    expand_chars = get_alphabet(hl)
    all_roots = get_roots(hl)
    label = f"{gl}/{hl}"
    api = GoogleAPI(gl, hl, delay_ms, db=db)

    # ── Načtení stavu ──
    state = None

    if resume_from and not dry_run:
        state = load_emergency_state(resume_from, gl, hl, db)

    if state is None and not dry_run:
        state = load_state(db, gl, hl)

    # Fresh start vs. resume:
    # 'done'    → fresh (nový cyklus)
    # 'pending' bez fronty → fresh
    # 'running' (crash) | 'paused' | 'pending' s frontou → resume
    should_fresh = (
        state is None
        or state.get("status") == "done"
        or (state.get("status") == "pending" and not state.get("queue"))
    )

    if should_fresh:
        state = {
            "current_depth": 0,
            "current_prefix": "",
            "queue": all_roots[:],
            "next_queue": [],
            "status": "running",
            "processed": 0,
            "queries_total": 0,
            "new_total": 0,
        }
        if not dry_run:
            ok = db.upsert_state(
                gl,
                hl,
                {
                    **state,
                    "last_started_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            if not ok:
                print(
                    f"  ⚠ Nepodařilo se inicializovat stav pro {label} — pokračuji in-memory"
                )
    else:
        src = "emergency souboru" if (resume_from and state) else "DB"
        crash_note = (
            " (crash remnant — resumuji)" if state.get("status") == "running" else ""
        )
        print(f"  ↩ Navazuji ze {src} (status={state['status']}{crash_note})")

    depth = state["current_depth"]
    queue = list(state["queue"])
    next_q = list(state["next_queue"])
    processed = state["processed"]
    queries = state["queries_total"]
    new_total = state["new_total"]
    total_in_q = len(queue) + processed

    db_count = db.count_market(gl, hl) if not dry_run else "—"
    print(f"\n{'═'*60}")
    print(f"  Market: {label}  |  depth={depth}/{max_depth}  |  run_id={run_id}")
    print(f"  Queue: {len(queue)} prefixů  |  DB: {db_count} frází")
    if dry_run:
        print("  [DRY RUN — žádný zápis]")
    print(f"{'─'*60}")

    if dry_run:
        print(f"  Plán: projít {len(queue)} prefixů, depth {depth}→{max_depth}")
        return "paused"

    # ── Depth-advance na začátku (přechod z předchozího runu) ──
    if not queue and next_q and depth < max_depth:
        depth += 1
        queue = next_q[:]
        next_q = []
        processed = 0
        total_in_q = len(queue)
        state.update(
            {
                "current_depth": depth,
                "queue": queue,
                "next_queue": next_q,
                "processed": processed,
                "status": "paused",
            }
        )
        print(f"  ⬆ Navazuji na depth {depth} ({total_in_q} prefixů)")
        save_state(db, gl, hl, state)

    if not queue and not next_q:
        print(f"  🏁 Market {label} byl již dokončen.")
        state["status"] = "done"
        save_state(db, gl, hl, state)
        return "done"

    # ── Circuit breaker + write buffer ──
    cb = CircuitBreaker(CIRCUIT_BREAKER_THRESHOLD)
    buffer: list[dict] = []
    start = time.time()
    last_heartbeat = time.time()
    last_full_save = time.time()

    def flush_buffer() -> int:
        """
        Flush write bufferu do DB.
        Vrací:
          >= 0  : počet vložených řádků (0 = všechno DO NOTHING, stále OK)
          -1    : flush selhal, circuit ještě netripped
          -999  : circuit breaker tripped — volající musí ukončit smyčku
        """
        nonlocal new_total
        if not buffer:
            return 0
        api._last_conflict_ratio = (
            0.0  # reset před flush — stale hodnota nesmí přetéct do příštího okna
        )

        res = db.upsert_batch(buffer)
        n = len(buffer)

        if res is None:
            if cb.record_failure():
                print(
                    f"  ✗ Circuit breaker tripped (failures={cb.failures}/{cb.threshold})"
                )
                return -999
            print(
                f"  ✗ flush FAILED (consecutive failures: {cb.failures}/{cb.threshold})"
            )
            return -1  # buffer se nemazá — zkusí se znovu při dalším flush

        cb.record_success()
        inserted = len(res)
        conflict_ratio = round(1 - inserted / n, 2) if n else 0
        api._last_conflict_ratio = conflict_ratio
        new_total += inserted
        state["new_total"] = new_total
        if n >= batch_size or inserted > 0:
            print(
                f"  ↑ flush {n} rows → +{inserted} nových "
                f"(conflict_ratio={conflict_ratio}) | total={new_total}"
            )
        buffer.clear()
        return inserted

    def _update_state_snapshot():
        state.update(
            {
                "queue": queue,
                "next_queue": next_q,
                "processed": processed,
                "queries_total": queries,
                "new_total": new_total,
                "current_depth": depth,
            }
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    result_status = "paused"

    try:
        while queue:
            # Kill-switch check (cached, ~5s TTL) — přeskočit v dry_run
            if not dry_run:
                ctrl = db.get_control()
                if ctrl and ctrl.get("stop_flag"):
                    cooldown = ctrl.get("cooldown_until")
                    if cooldown:
                        if isinstance(cooldown, datetime):
                            cooldown_dt = cooldown
                            if cooldown_dt.tzinfo is None:
                                cooldown_dt = cooldown_dt.replace(tzinfo=timezone.utc)
                        else:
                            try:
                                cooldown_dt = datetime.fromisoformat(str(cooldown))
                                if cooldown_dt.tzinfo is None:
                                    cooldown_dt = cooldown_dt.replace(
                                        tzinfo=timezone.utc
                                    )
                            except (ValueError, TypeError):
                                cooldown_dt = None
                        if cooldown_dt and cooldown_dt <= datetime.now(timezone.utc):
                            db.reset_killswitch_after_cooldown()
                            print(
                                f"  ✓ Cooldown vypršel ({cooldown}) — auto-reset stop_flag, pokračuji v {label}"
                            )
                            continue
                    print(f"  🛑 Kill-switch aktivní — ukončuji {label}")
                    fr = flush_buffer()
                    if fr == -999:
                        _update_state_snapshot()
                        state["status"] = "paused"
                        raise RuntimeError("Kill-switch + circuit breaker tripped")
                    _update_state_snapshot()
                    state["status"] = "paused"
                    save_state(db, gl, hl, state)
                    return "paused"

            elapsed = time.time() - start

            # Safety margin před GH Actions timeoutem
            if elapsed > max_runtime - 60:
                print(
                    f"\n  ⏰ Blížím se max_runtime ({max_runtime//60} min). Ukládám stav..."
                )
                fr = flush_buffer()
                if fr == -999:
                    raise RuntimeError("Circuit breaker tripped při max_runtime flush")
                _update_state_snapshot()
                state["status"] = "paused"
                if not save_state(db, gl, hl, state):
                    raise RuntimeError("save_state selhalo při max_runtime")
                return "paused"

            prefix = queue.pop(0)
            processed += 1
            state["current_prefix"] = prefix

            suggs = api.fetch(prefix)
            queries += 1

            if (
                suggs is None
            ):  # 403 BLOCKED — uložit jako paused (resumovatelné po cooldownu)
                flush_buffer()
                _update_state_snapshot()
                state["status"] = "paused"
                save_state(db, gl, hl, state)
                db.trip_killswitch(f"403 BLOCKED na prefixu '{prefix}'", gl, hl)
                return "blocked"

            if suggs:
                for phrase in suggs:
                    buffer.append(
                        {
                            "gl": gl,
                            "hl": hl,
                            "phrase": phrase,
                            "phrase_norm": normalize(phrase),
                            "depth": depth,
                            "parent_prefix": prefix,
                            "first_seen_at": now_iso,
                            "last_seen_at": now_iso,
                            "seen_count": 1,
                        }
                    )
                if len(buffer) >= batch_size:
                    fr = flush_buffer()
                    if fr == -999:
                        _update_state_snapshot()
                        state["status"] = "paused"
                        raise RuntimeError(
                            f"Circuit breaker po {cb.threshold} vyčerpaných flush blocích"
                        )

            if len(suggs) >= SUGGEST_LIMIT and depth < max_depth:
                for c in expand_chars:
                    next_q.append(prefix + c)

            pct = round(processed / total_in_q * 100) if total_in_q else 0
            elapsed = time.time() - start
            if processed % 20 == 0:
                print(
                    f"  [d{depth} {pct}%] '{prefix}' → {len(suggs)} suggs "
                    f"| q={queries} | {round(elapsed)}s | delay={api.delay:.2f}s"
                )

            # Checkpointing
            t_now = time.time()
            if t_now - last_full_save > 300:
                fr = flush_buffer()
                if fr == -999:
                    _update_state_snapshot()
                    state["status"] = "paused"
                    raise RuntimeError(
                        "Circuit breaker tripped při periodickém checkpointu"
                    )
                _update_state_snapshot()
                state["status"] = "paused"
                if not save_state(db, gl, hl, state):
                    print(
                        "  ⚠ Periodický checkpoint selhal — zkusím při dalším heartbeatu"
                    )
                last_full_save = t_now
                last_heartbeat = t_now
            elif t_now - last_heartbeat > 30:
                _update_state_snapshot()
                state["status"] = "paused"
                save_heartbeat(db, gl, hl, state)
                last_heartbeat = t_now

        # ── Fronta vyprázdněna ──
        fr = flush_buffer()
        if fr == -999:
            _update_state_snapshot()
            state["status"] = "paused"
            raise RuntimeError("Circuit breaker tripped při finálním flush")

        # Depth advance?
        if not queue and next_q and depth < max_depth:
            depth += 1
            queue = next_q[:]
            next_q = []
            processed = 0
            total_in_q = len(queue)
            state.update(
                {
                    "current_depth": depth,
                    "queue": queue,
                    "next_queue": next_q,
                    "processed": processed,
                    "queries_total": queries,
                    "new_total": new_total,
                    "status": "paused",
                }
            )
            print(
                f"  ⬆ Depth {depth} ({total_in_q} prefixů) — ukládám a navazuji v dalším runu"
            )
            save_state(db, gl, hl, state)
            result_status = "paused"
        else:
            result_status = "done"
            state.update(
                {
                    "current_depth": depth,
                    "queue": [],
                    "next_queue": [],
                    "processed": processed,
                    "queries_total": queries,
                    "new_total": new_total,
                    "status": "done",
                    "last_finished_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            save_state(db, gl, hl, state)

    except Exception as e:
        reason = f"{type(e).__name__}: {str(e)[:300]}"
        print(f"  ✗ Exception v marketu {label}: {reason}")
        # Snapshot stavu pro emergency_save (queue/next_q jsou aktuální)
        _update_state_snapshot()
        state["status"] = "paused"
        emergency_save(db, gl, hl, state, run_id, reason)

        elapsed = time.time() - start
        print(f"  Posledně zpracovaný prefix: '{state.get('current_prefix', '')}'")
        print(f"  Zbývá ve frontě: {len(queue)} | next_queue: {len(next_q)}")
        print(f"  new_total: {new_total} | queries: {queries} | čas: {round(elapsed)}s")
        return "emergency"

    elapsed = time.time() - start
    final_count = db.count_market(gl, hl)
    print(f"\n{'═'*60}")
    print(f"  Market: {label}  |  {result_status.upper()}  |  run_id={run_id}")
    print(f"  Processed: {processed}  |  Queries: {queries}  |  New: +{new_total}")
    print(
        f"  Errors: {api.errs}  |  Duration: {round(elapsed)}s ({round(elapsed/60, 1)} min)"
    )
    print(f"  DB total ({label}): {final_count} frází")
    print(f"{'═'*60}")
    return result_status


# ─────────────────────────────────────────────────────────────
# CLI + orchestrace
# ─────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(description="Unified Google Suggest Crawler v2")
    p.add_argument("--dry-run", default="true")
    p.add_argument("--max-parallel", type=int, default=1)
    p.add_argument("--batch-limit", type=int, default=5)
    p.add_argument("--max-depth", type=int, default=1)
    p.add_argument("--market-filter", default="")
    p.add_argument(
        "--run-id",
        default="",
        help="Identifikátor běhu (auto: UUID8). Prochází logy a jménem emergency souboru.",
    )
    p.add_argument(
        "--resume-from",
        default="",
        help="Cesta k crawler_state_emergency_*.json pro explicitní resume.",
    )
    p.add_argument(
        "--runtime-config",
        default=None,
        help="(Runtime mode) Cesta k runtime_config.json od subprocess_adapter.",
    )
    p.add_argument(
        "--runtime-result",
        default=None,
        help="(Runtime mode) Cesta pro zápis runtime_result.json.",
    )
    p.add_argument(
        "--preflight-write-target",
        action="store_true",
        default=False,
        help="(Preflight) Ověří write_target konfiguraci bez DB write. Vypíše stav a skončí.",
    )
    return p.parse_args()


# ─────────────────────────────────────────────────────────────
# Runtime mode — volán z runtime/subprocess_adapter.py
# ─────────────────────────────────────────────────────────────


def map_exception_to_runtime_error(exc: Exception) -> tuple[int, dict]:
    """Map exception to (exit_code, error_dict) dle spec sekce 6."""
    msg = str(exc).lower()
    etype = type(exc).__name__.lower()

    if "write_target_guard" in msg:
        return 50, {
            "code": "write_target_guard",
            "message": str(exc),
            "retryable": False,
            "blocked": True,
        }
    if "geo_mismatch" in msg or "geo mismatch" in msg:
        return 40, {
            "code": "geo_mismatch",
            "message": str(exc),
            "retryable": False,
            "blocked": True,
        }
    if "integrity" in msg or ("psycopg" in etype and "unique" in msg):
        return 51, {
            "code": "db_integrity",
            "message": str(exc),
            "retryable": False,
            "blocked": True,
        }
    if any(
        k in msg
        for k in ("psycopg", "postgres", "database", "db error", "connection refused")
    ):
        return 20, {
            "code": "db_transient",
            "message": str(exc),
            "retryable": True,
            "blocked": False,
        }
    if "proxy" in msg and ("auth" in msg or "407" in msg or "credentials" in msg):
        return 20, {
            "code": "proxy_auth",
            "message": str(exc),
            "retryable": True,
            "blocked": False,
        }
    if "proxy" in msg or ("connection" in msg and "timeout" in msg) or "socks" in msg:
        return 20, {
            "code": "proxy_timeout",
            "message": str(exc),
            "retryable": True,
            "blocked": False,
        }
    if "429" in msg or "rate limit" in msg or "suspicious" in msg or "captcha" in msg:
        return 20, {
            "code": "google_429",
            "message": str(exc),
            "retryable": True,
            "blocked": False,
        }
    if "timeout" in msg or "timed out" in msg:
        return 90, {
            "code": "soft_timeout",
            "message": str(exc),
            "retryable": True,
            "blocked": False,
        }
    return 20, {
        "code": "app_exception",
        "message": str(exc),
        "retryable": True,
        "blocked": False,
    }


def write_runtime_result_atomic(path: str, payload: dict) -> None:
    """Write payload to *path* atomically via .tmp → rename."""
    import tempfile

    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f, indent=2)
    os.rename(tmp, path)


def _build_runtime_result(
    pilot_id: str,
    queue_id: int,
    gl: str,
    hl: str,
    expected_geo: str,
    actual_geo: str,
    write_target: str,
    dry_run: bool,
    no_db: bool,
    exit_code: int,
    status: str,
    metrics: dict,
    artifact_dir: str,
    error: dict | None,
) -> dict:
    summary_path = os.path.join(artifact_dir, "phase-2b-pilot-summary.json")
    return {
        "schema_version": 1,
        "status": status,
        "exit_code": exit_code,
        "pilot_id": pilot_id,
        "queue_id": queue_id,
        "market": {
            "gl": gl,
            "hl": hl,
            "expected_geo_country": expected_geo,
            "actual_geo_country": actual_geo,
        },
        "write_target": write_target,
        "dry_run": dry_run,
        "no_db": no_db,
        "metrics": metrics,
        "artifacts": {
            "summary_path": summary_path if os.path.exists(summary_path) else None
        },
        "error": error,
    }


def _empty_metrics(duration: float = 0.0) -> dict:
    return {
        "rows_inserted": 0,
        "parents_completed": 0,
        "parents_failed": 0,
        "requests_total": 0,
        "google_429": 0,
        "google_suspicious": 0,
        "proxy_timeouts": 0,
        "db_errors": 0,
        "duration_seconds": duration,
    }


def run_preflight_write_target(args) -> int:
    """Preflight: resolve write_target, verify guards + DSN presence, print status, exit.

    Never opens a DB connection. Never prints the DSN value.
    Returns 0 for valid/known targets, 1 for unknown or forbidden targets.
    """
    # Load write_target: runtime_config.json takes priority over env
    if args.runtime_config:
        try:
            with open(args.runtime_config) as f:
                rc = json.load(f)
            write_target = rc.get("write", {}).get(
                "target", os.environ.get("SUGGEST_WRITE_TARGET", "supabase")
            )
        except Exception as exc:
            print(f"preflight_error: cannot read runtime_config: {exc}")
            return 1
    else:
        write_target = os.environ.get("SUGGEST_WRITE_TARGET", "supabase")

    # Hard fail for unknown / forbidden targets (includes "hetzner_pg")
    if write_target not in ("supabase", "supabase_postgrest", "hetzner"):
        print(
            f"preflight_error: unknown or forbidden write_target={write_target!r} — hard fail"
        )
        return 1

    if write_target == "hetzner":
        writer = "HetznerPgWriter"
        dsn = (
            os.environ.get("SUGGEST_CRAWLER_WRITE_DATABASE_URL", "")
            or os.environ.get("HETZNER_DATABASE_URL", "")
            or os.environ.get("HETZNER_WRITE_DATABASE_URL", "")
        )
        hetzner_dsn_present = bool(dsn)
        guard_ok = hetzner_dsn_present
    else:
        writer = "DB"
        hetzner_dsn_present = False
        guard_ok = True

    print(f"write_target={write_target}")
    print(f"writer={writer}")
    print(f"guard_ok={str(guard_ok).lower()}")
    print(f"hetzner_dsn_present={str(hetzner_dsn_present).lower()}")
    print("will_write=false")
    return 0


def run_runtime_mode(config_path: str, result_path: str) -> int:
    """Entry point when --runtime-config and --runtime-result are provided.

    Loads runtime_config.json, enforces write-target guard, runs crawl via
    existing run_market(), writes runtime_result.json atomically, and returns
    an exit code (0=success, 20=retryable failure, 40=geo blocked,
    50=write guard blocked, 51=db integrity blocked, 90=soft timeout).

    GHA path (no --runtime-config) is NEVER touched by this function.
    """
    start_time = time.time()

    with open(config_path) as f:
        rc = json.load(f)

    gl = rc["gl"]
    hl = rc["hl"]
    pilot_id = str(rc.get("pilot_id", ""))
    queue_id = int(rc.get("queue_id", 0))
    artifact_dir = rc.get("artifact_dir", os.path.dirname(result_path))
    no_db = bool(rc.get("no_db", False))
    dry_run = bool(rc.get("dry_run", False)) or no_db  # no_db implies dry_run
    caps = rc.get("caps", {})
    write_cfg = rc.get("write", {})
    proxy_cfg = rc.get("proxy", {})
    expected_geo = rc.get("expected_geo_country", "")

    write_target = write_cfg.get("target", "supabase")

    # ── Write-target guard PŘED jakýmkoli zápisem ──
    allow_hetzner = (
        os.environ.get("SUGGEST_ALLOW_HETZNER_WRITE", "false").lower() == "true"
    )
    require_s4_go = os.environ.get("SUGGEST_REQUIRE_S4_GO", "false").lower() == "true"
    if write_target == "hetzner" and not (allow_hetzner and require_s4_go):
        payload = _build_runtime_result(
            pilot_id=pilot_id,
            queue_id=queue_id,
            gl=gl,
            hl=hl,
            expected_geo=expected_geo,
            actual_geo="",
            write_target=write_target,
            dry_run=dry_run,
            no_db=no_db,
            exit_code=50,
            status="blocked",
            metrics=_empty_metrics(0.0),
            artifact_dir=artifact_dir,
            error={
                "code": "write_target_guard",
                "message": "Hetzner write blocked: SUGGEST_ALLOW_HETZNER_WRITE and/or SUGGEST_REQUIRE_S4_GO not set",
                "retryable": False,
                "blocked": True,
            },
        )
        write_runtime_result_atomic(result_path, payload)
        print(
            "✗ write_target_guard: Hetzner write blocked — S4 flags not set. Exit 50."
        )
        return 50

    # ── Proxy (informativní — opener je nastaven jako global při importu) ──
    proxy_url_env = proxy_cfg.get("url_env", "IPROYAL_PROXY_URL")
    _proxy_used = os.environ.get(proxy_url_env, os.environ.get("PROXY_URL", ""))

    # ── Write-target router ──
    try:
        db = _create_write_client(write_target, write_cfg, no_db=no_db, dry_run=dry_run)
    except RuntimeError as exc:
        payload = _build_runtime_result(
            pilot_id=pilot_id,
            queue_id=queue_id,
            gl=gl,
            hl=hl,
            expected_geo=expected_geo,
            actual_geo="",
            write_target=write_target,
            dry_run=dry_run,
            no_db=no_db,
            exit_code=50,
            status="blocked",
            metrics=_empty_metrics(0.0),
            artifact_dir=artifact_dir,
            error={
                "code": "write_target_guard",
                "message": str(exc),
                "retryable": False,
                "blocked": True,
            },
        )
        write_runtime_result_atomic(result_path, payload)
        print(f"✗ write_target_guard: {exc}. Exit 50.")
        return 50

    # ── Sestavení market + cfg dicts pro run_market ──
    market = {
        "gl": gl,
        "hl": hl,
        "enabled": True,
        "max_depth": caps.get("max_depth", 2),
        "max_runtime_minutes": caps.get("max_runtime_minutes", 28),
        "batch_size": caps.get("batch_size", 100),
        "delay_between_requests_ms": caps.get("delay_between_requests_ms", 150),
    }
    cfg_defaults = {
        "max_depth": caps.get("max_depth", 2),
        "max_runtime_minutes": caps.get("max_runtime_minutes", 28),
        "batch_size": caps.get("batch_size", 100),
        "delay_between_requests_ms": caps.get("delay_between_requests_ms", 150),
    }

    run_id = f"rt-{pilot_id[:8]}-{queue_id}"

    # Propagate canary context to HetznerPgWriter when active
    if isinstance(db, HetznerPgWriter):
        db._canary_gl = gl
        db._canary_hl = hl
        db._canary_run_id = run_id

    # ── Spustit crawl ──
    exit_code = 0
    status = "success"
    error: dict | None = None

    try:
        crawl_status = run_market(
            db,
            market,
            cfg_defaults,
            dry_run,
            run_id=run_id,
            resume_from="",
        )
        # Map run_market status → runtime status
        if crawl_status in ("done", "paused"):
            status, exit_code = "success", 0
        elif crawl_status == "blocked":
            status, exit_code = "blocked", 40
            error = {
                "code": "geo_mismatch",
                "message": "Market blocked by run_market",
                "retryable": False,
                "blocked": True,
            }
        else:  # "emergency"
            status, exit_code = "failed", 20
            error = {
                "code": "app_exception",
                "message": f"run_market returned {crawl_status!r}",
                "retryable": True,
                "blocked": False,
            }

    except Exception as exc:
        exit_code, error = map_exception_to_runtime_error(exc)
        status = "blocked" if (error.get("blocked")) else "failed"
        print(f"✗ Runtime crawl error: {type(exc).__name__}: {exc}")

    duration = time.time() - start_time

    # ── Metriky (best-effort z dry_run; live metriky budou 0 pro now) ──
    metrics = _empty_metrics(round(duration, 2))

    # ── Zapsat phase-2b-pilot-summary.json (doplňkový, runtime ho NEčte jako pravdu) ──
    os.makedirs(artifact_dir, exist_ok=True)
    summary_path = os.path.join(artifact_dir, "phase-2b-pilot-summary.json")
    try:
        summary = {
            "pilot_id": pilot_id,
            "queue_id": queue_id,
            "gl": gl,
            "hl": hl,
            "status": status,
            "exit_code": exit_code,
            "dry_run": dry_run,
            "no_db": no_db,
            "duration_seconds": round(duration, 2),
        }
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)
    except Exception as exc:
        print(f"  ⚠ Could not write summary: {exc}")

    # ── Zapsat runtime_result.json atomicky ──
    payload = _build_runtime_result(
        pilot_id=pilot_id,
        queue_id=queue_id,
        gl=gl,
        hl=hl,
        expected_geo=expected_geo,
        actual_geo="",
        write_target=write_target,
        dry_run=dry_run,
        no_db=no_db,
        exit_code=exit_code,
        status=status,
        metrics=metrics,
        artifact_dir=artifact_dir,
        error=error,
    )
    write_runtime_result_atomic(result_path, payload)
    print(f"  ✓ runtime_result.json written: status={status} exit={exit_code}")
    if isinstance(db, HetznerPgWriter):
        db.close()
    return exit_code


def load_config(max_depth_override: int) -> tuple[dict, list]:
    config_path = os.path.join(
        os.path.dirname(__file__), "config", "google_markets.yml"
    )
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    defaults = raw.get("defaults", {})
    defaults["max_depth"] = max_depth_override
    return defaults, raw.get("markets", [])


def main():
    args = parse_args()

    # Preflight fork — check write_target config without any DB write
    if args.preflight_write_target:
        sys.exit(run_preflight_write_target(args))

    # Runtime mode fork — GHA path is completely untouched when args are absent
    if args.runtime_config and args.runtime_result:
        sys.exit(run_runtime_mode(args.runtime_config, args.runtime_result))

    dry_run = args.dry_run.lower() in ("true", "1", "yes")
    run_id = args.run_id or uuid.uuid4().hex[:8]

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not dry_run and (not url or not key):
        print("✗ Nastav SUPABASE_URL a SUPABASE_KEY")
        sys.exit(1)

    db = DB(url or "", key or "")
    cfg, all_markets = load_config(args.max_depth)

    markets = [m for m in all_markets if m.get("enabled", False)]
    if args.market_filter:
        parts = args.market_filter.split("/")
        gl_f = parts[0] if len(parts) > 0 else ""
        hl_f = parts[1] if len(parts) > 1 else ""
        markets = [
            m
            for m in markets
            if (not gl_f or m["gl"] == gl_f) and (not hl_f or m["hl"] == hl_f)
        ]

    if not dry_run and markets:
        done_set: set[tuple] = set()
        rows = db.select(STATE_TABLE, "select=gl,hl,status&status=eq.done")
        for r in rows:
            done_set.add((r["gl"], r["hl"]))
        pending = [m for m in markets if (m["gl"], m["hl"]) not in done_set]
        skipped = len(markets) - len(pending)
        if skipped:
            print(f"  ↷ Přeskočeno {skipped} dokončených marketů.")
        markets = pending

    markets = markets[: args.batch_limit]

    if _PROXY_URL:
        proxy_host = (
            _PROXY_URL.split("@")[-1]
            if "@" in _PROXY_URL
            else _PROXY_URL.split("//")[-1]
        )
        print(f"  🌐 proxy: ENABLED ({proxy_host})")
    else:
        print("  🌐 proxy: DIRECT")

    print(
        f"🔍 Google Suggest Crawler v2  |  dry_run={dry_run}  "
        f"|  max_depth={args.max_depth}  |  max_parallel={args.max_parallel}  "
        f"|  run_id={run_id}"
    )
    print(f"   Markety v tomto běhu: {len(markets)}")
    for m in markets:
        print(f"   • {m['gl']}/{m['hl']}  ({m.get('notes', '')})")
    if args.resume_from:
        print(f"   --resume-from: {args.resume_from}")
    print()

    results: dict[str, str] = {}

    if args.max_parallel <= 1 or dry_run:
        # Sekvenční — původní chování
        for market in markets:
            label = f"{market['gl']}/{market['hl']}"
            status = run_market(
                db,
                market,
                cfg,
                dry_run,
                run_id=run_id,
                resume_from=args.resume_from,
            )
            results[label] = status
    else:
        # Paralelní — každý thread dostane vlastní DB instanci (thread-safe)
        def _run_one(market: dict) -> tuple:
            thread_db = DB(url, key)
            label = f"{market['gl']}/{market['hl']}"
            status = run_market(
                thread_db,
                market,
                cfg,
                dry_run,
                run_id=run_id,
                resume_from=args.resume_from,
            )
            return label, status

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=args.max_parallel
        ) as pool:
            futures = {pool.submit(_run_one, m): m for m in markets}
            for future in concurrent.futures.as_completed(futures):
                try:
                    label, status = future.result()
                    results[label] = status
                except Exception as e:
                    m = futures[future]
                    label = f"{m['gl']}/{m['hl']}"
                    print(f"  ✗ Thread pro {label} selhal s výjimkou: {e}")
                    results[label] = "emergency"

    print(f"\n{'═'*60}")
    print("  Výsledky běhu:")
    icons = {"done": "✓", "paused": "⏸", "blocked": "✗", "emergency": "🆘"}
    for label, status in results.items():
        print(f"  {icons.get(status, '?')} {label}: {status}")
    print(f"{'═'*60}")

    if any(s == "emergency" for s in results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
