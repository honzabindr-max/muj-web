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
import argparse, hashlib, http.client, json, os, random, re, socket, ssl, sys, time
import urllib.request, urllib.parse, uuid
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("✗ Chybí pyyaml — spusť: pip install pyyaml")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────
# Konfigurace
# ─────────────────────────────────────────────────────────────
SUGGEST_URL              = "https://suggestqueries.google.com/complete/search"
SUGGEST_LIMIT            = 10
MAX_RETRIES              = 3      # Google API retry pokusy
TABLE                    = "google_suggestions_v2"
STATE_TABLE              = "google_crawler_state"
SAFE                     = '=&.,()!*:"'

DB_MAX_RETRIES            = 6    # Max retry pokusů na jeden DB request
DB_BACKOFF_BASE           = 1.0  # Základ exponential backoff (sekundy)
CIRCUIT_BREAKER_THRESHOLD = 3    # Počet vyčerpaných flush bloků před emergency_save

# Sentinel: 2xx s prázdným tělem (return=minimal / 204 No Content).
# Odlišuje "úspěch bez dat" od "selhání" (None).
_EMPTY_SUCCESS = object()

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
            urllib.error.URLError,       # DNS fail, connection refused, wraps socket.timeout
            TimeoutError,                # Python 3.11+, také read/write timeout
            socket.timeout,              # Python < 3.11
            http.client.RemoteDisconnected,
            http.client.IncompleteRead,
            ConnectionError,             # ConnectionResetError, BrokenPipeError, …
            ssl.SSLError,
            OSError,                     # socket-level errors na některých platformách
        ) as e:
            print(f"  ⚠ Network error ({type(e).__name__}): {str(e)[:120]}")
            return None

    def _req_with_retry(s, m, p, d=None, eh=None,
                        max_attempts: int = DB_MAX_RETRIES,
                        backoff_base: float = DB_BACKOFF_BASE):
        """_req() s exponential backoff + jitter. Vrátí None pokud všechny pokusy selžou."""
        for attempt in range(max_attempts):
            result = s._req(m, p, d, eh)
            if result is not None:  # None = failure; vše ostatní (incl. [] a _EMPTY_SUCCESS) = OK
                return result
            if attempt < max_attempts - 1:
                wait = min(60.0, backoff_base * (2 ** attempt))
                wait *= (0.8 + 0.4 * random.random())  # ±20% jitter
                print(f"  ↺ DB retry {attempt + 1}/{max_attempts - 1}, backoff {wait:.1f}s")
                time.sleep(wait)
        return None

    def select(s, t, p=""):
        res = s._req_with_retry("GET", t + "?" + urllib.parse.quote(p, safe=SAFE), max_attempts=3)
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
            return None     # trvalé selhání
        if res is _EMPTY_SUCCESS:
            return []       # neočekávané prázdné tělo → treat as no inserts
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


# ─────────────────────────────────────────────────────────────
# Google Suggest API — adaptivní delay + backoff
# ─────────────────────────────────────────────────────────────
class GoogleAPI:
    def __init__(s, gl: str, hl: str, delay_ms: int = 500):
        s.gl = gl
        s.hl = hl
        s.delay = delay_ms / 1000.0
        s.base_delay = s.delay
        s.reqs = 0
        s.errs = 0
        s.last = 0.0

    def fetch(s, phrase: str):
        """Vrací list frází, [] pro žádný výsledek, nebo None pro 403 BLOCKED."""
        el = time.time() - s.last
        if el < s.delay:
            time.sleep(s.delay - el)
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
                with urllib.request.urlopen(req, timeout=10) as r:
                    d = json.loads(r.read().decode())
                    s.reqs += 1
                    if s.delay > s.base_delay:
                        s.delay = max(s.base_delay, s.delay * 0.95)
                    return d[1] if isinstance(d, list) and len(d) >= 2 else []
            except urllib.error.HTTPError as e:
                s.errs += 1
                if e.code in (429, 503):
                    s.delay = min(10.0, s.delay * 2)
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
    s["queue"] = s["queue"] if isinstance(s["queue"], list) else (
        json.loads(s["queue"]) if s["queue"] else []
    )
    s["next_queue"] = s["next_queue"] if isinstance(s["next_queue"], list) else (
        json.loads(s["next_queue"]) if s["next_queue"] else []
    )
    return s


def save_state(db: DB, gl: str, hl: str, state: dict) -> bool:
    """Plný zápis stavu (incl. queue jako nativní JSONB array). Vrací True = úspěch."""
    return db.upsert_state(gl, hl, {
        "current_depth":  state["current_depth"],
        "current_prefix": state["current_prefix"],
        "queue":          state["queue"],       # Python list → nativní JSONB array
        "next_queue":     state["next_queue"],  # Python list → nativní JSONB array
        "status":         state["status"],
        "processed":      state["processed"],
        "queries_total":  state["queries_total"],
        "new_total":      state["new_total"],
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    })


def save_heartbeat(db: DB, gl: str, hl: str, state: dict) -> bool:
    """Lehký zápis bez queue — drží updated_at čerstvý. Vrací True = úspěch."""
    return db.upsert_state(gl, hl, {
        "current_depth":  state["current_depth"],
        "current_prefix": state["current_prefix"],
        "status":         state["status"],
        "processed":      state["processed"],
        "queries_total":  state["queries_total"],
        "new_total":      state["new_total"],
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────────────────────────
# Emergency save — fallback řetězec při selhání DB
# ─────────────────────────────────────────────────────────────
def emergency_save(db: DB, gl: str, hl: str, state: dict, run_id: str, reason: str = "") -> bool:
    """
    1. Pokus o DB save (status=paused).
    2. Pokud selže: zapíše do souboru crawler_state_emergency_<run_id>.json
       a vypisuje log marker EMERGENCY_STATE_SNAPSHOT.
    Vrací True pokud alespoň jeden zápis uspěl.
    """
    payload = {
        "current_depth":  state.get("current_depth", 0),
        "current_prefix": state.get("current_prefix", ""),
        "queue":          state.get("queue", []),
        "next_queue":     state.get("next_queue", []),
        "status":         "paused",
        "processed":      state.get("processed", 0),
        "queries_total":  state.get("queries_total", 0),
        "new_total":      state.get("new_total", 0),
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    }

    # 1. DB save
    db_ok = db.upsert_state(gl, hl, payload)
    if db_ok:
        print(f"  ✓ Emergency: stav uložen do DB (status=paused, run_id={run_id})")
        return True

    # 2. Soubor
    snapshot = {
        **payload,
        "gl": gl, "hl": hl,
        "run_id": run_id,
        "emergency_reason": reason,
        "emergency_at": datetime.now(timezone.utc).isoformat(),
    }
    filename = f"crawler_state_emergency_{run_id}.json"
    snapshot_json = json.dumps(snapshot, ensure_ascii=False, indent=2)
    snapshot_hash = hashlib.sha256(snapshot_json.encode()).hexdigest()[:16]
    file_ok = False

    try:
        with open(filename, "w", encoding="utf-8") as f:
            f.write(snapshot_json)
        file_ok = True
    except Exception as write_err:
        print(f"  ✗ Nepodařilo se zapsat emergency soubor: {write_err}")

    # 3. Log marker (shrnutí — celý JSON jen pokud < 50 KB)
    q_len  = len(payload["queue"])
    nq_len = len(payload["next_queue"])
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
            print(f"  [JSON {len(snapshot_json)//1024} KB — jen v souboru/artifactu]")

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

    snap["queue"] = snap["queue"] if isinstance(snap["queue"], list) else (
        json.loads(snap["queue"]) if snap["queue"] else []
    )
    snap["next_queue"] = snap["next_queue"] if isinstance(snap["next_queue"], list) else (
        json.loads(snap["next_queue"]) if snap["next_queue"] else []
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
    max_depth   = market.get("max_depth",              cfg["max_depth"])
    max_runtime = market.get("max_runtime_minutes",    cfg["max_runtime_minutes"]) * 60
    batch_size  = market.get("batch_size",             cfg["batch_size"])
    delay_ms    = market.get("delay_between_requests_ms", cfg["delay_between_requests_ms"])

    expand_chars = get_alphabet(hl)
    all_roots    = get_roots(hl)
    label        = f"{gl}/{hl}"
    api          = GoogleAPI(gl, hl, delay_ms)

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
            "current_depth":  0,
            "current_prefix": "",
            "queue":          all_roots[:],
            "next_queue":     [],
            "status":         "running",
            "processed":      0,
            "queries_total":  0,
            "new_total":      0,
        }
        if not dry_run:
            ok = db.upsert_state(gl, hl, {
                **state,
                "last_started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at":      datetime.now(timezone.utc).isoformat(),
            })
            if not ok:
                print(f"  ⚠ Nepodařilo se inicializovat stav pro {label} — pokračuji in-memory")
    else:
        src = "emergency souboru" if (resume_from and state) else "DB"
        crash_note = " (crash remnant — resumuji)" if state.get("status") == "running" else ""
        print(f"  ↩ Navazuji ze {src} (status={state['status']}{crash_note})")

    depth      = state["current_depth"]
    queue      = list(state["queue"])
    next_q     = list(state["next_queue"])
    processed  = state["processed"]
    queries    = state["queries_total"]
    new_total  = state["new_total"]
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
        state.update({
            "current_depth": depth, "queue": queue,
            "next_queue": next_q, "processed": processed,
            "status": "paused",
        })
        print(f"  ⬆ Navazuji na depth {depth} ({total_in_q} prefixů)")
        save_state(db, gl, hl, state)

    if not queue and not next_q:
        print(f"  🏁 Market {label} byl již dokončen.")
        state["status"] = "done"
        save_state(db, gl, hl, state)
        return "done"

    # ── Circuit breaker + write buffer ──
    cb     = CircuitBreaker(CIRCUIT_BREAKER_THRESHOLD)
    buffer: list[dict] = []
    start           = time.time()
    last_heartbeat  = time.time()
    last_full_save  = time.time()

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

        res = db.upsert_batch(buffer)
        n   = len(buffer)

        if res is None:
            if cb.record_failure():
                print(f"  ✗ Circuit breaker tripped (failures={cb.failures}/{cb.threshold})")
                return -999
            print(f"  ✗ flush FAILED (consecutive failures: {cb.failures}/{cb.threshold})")
            return -1  # buffer se nemazá — zkusí se znovu při dalším flush

        cb.record_success()
        inserted       = len(res)
        conflict_ratio = round(1 - inserted / n, 2) if n else 0
        new_total     += inserted
        state["new_total"] = new_total
        if n >= batch_size or inserted > 0:
            print(
                f"  ↑ flush {n} rows → +{inserted} nových "
                f"(conflict_ratio={conflict_ratio}) | total={new_total}"
            )
        buffer.clear()
        return inserted

    def _update_state_snapshot():
        state.update({
            "queue": queue, "next_queue": next_q,
            "processed": processed, "queries_total": queries,
            "new_total": new_total, "current_depth": depth,
        })

    now_iso       = datetime.now(timezone.utc).isoformat()
    result_status = "paused"

    try:
        while queue:
            elapsed = time.time() - start

            # Safety margin před GH Actions timeoutem
            if elapsed > max_runtime - 60:
                print(f"\n  ⏰ Blížím se max_runtime ({max_runtime//60} min). Ukládám stav...")
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

            if suggs is None:  # 403 BLOCKED — jediný případ se status='error'
                flush_buffer()
                _update_state_snapshot()
                state["status"] = "error"
                save_state(db, gl, hl, state)
                return "blocked"

            if suggs:
                for phrase in suggs:
                    buffer.append({
                        "gl": gl, "hl": hl,
                        "phrase":        phrase,
                        "phrase_norm":   normalize(phrase),
                        "depth":         depth,
                        "parent_prefix": prefix,
                        "first_seen_at": now_iso,
                        "last_seen_at":  now_iso,
                        "seen_count":    1,
                    })
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

            pct     = round(processed / total_in_q * 100) if total_in_q else 0
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
                    raise RuntimeError("Circuit breaker tripped při periodickém checkpointu")
                _update_state_snapshot()
                state["status"] = "paused"
                if not save_state(db, gl, hl, state):
                    print("  ⚠ Periodický checkpoint selhal — zkusím při dalším heartbeatu")
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
            state.update({
                "current_depth": depth, "queue": queue,
                "next_queue": next_q, "processed": processed,
                "queries_total": queries, "new_total": new_total,
                "status": "paused",
            })
            print(f"  ⬆ Depth {depth} ({total_in_q} prefixů) — ukládám a navazuji v dalším runu")
            save_state(db, gl, hl, state)
            result_status = "paused"
        else:
            result_status = "done"
            state.update({
                "current_depth": depth, "queue": [], "next_queue": [],
                "processed": processed, "queries_total": queries,
                "new_total": new_total, "status": "done",
                "last_finished_at": datetime.now(timezone.utc).isoformat(),
            })
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

    elapsed     = time.time() - start
    final_count = db.count_market(gl, hl)
    print(f"\n{'═'*60}")
    print(f"  Market: {label}  |  {result_status.upper()}  |  run_id={run_id}")
    print(f"  Processed: {processed}  |  Queries: {queries}  |  New: +{new_total}")
    print(f"  Errors: {api.errs}  |  Duration: {round(elapsed)}s ({round(elapsed/60, 1)} min)")
    print(f"  DB total ({label}): {final_count} frází")
    print(f"{'═'*60}")
    return result_status


# ─────────────────────────────────────────────────────────────
# CLI + orchestrace
# ─────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(description="Unified Google Suggest Crawler v2")
    p.add_argument("--dry-run",       default="true")
    p.add_argument("--max-parallel",  type=int, default=1)
    p.add_argument("--batch-limit",   type=int, default=5)
    p.add_argument("--max-depth",     type=int, default=1)
    p.add_argument("--market-filter", default="")
    p.add_argument("--run-id",        default="",
                   help="Identifikátor běhu (auto: UUID8). Prochází logy a jménem emergency souboru.")
    p.add_argument("--resume-from",   default="",
                   help="Cesta k crawler_state_emergency_*.json pro explicitní resume.")
    return p.parse_args()


def load_config(max_depth_override: int) -> tuple[dict, list]:
    config_path = os.path.join(os.path.dirname(__file__), "config", "google_markets.yml")
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    defaults = raw.get("defaults", {})
    defaults["max_depth"] = max_depth_override
    return defaults, raw.get("markets", [])


def main():
    args    = parse_args()
    dry_run = args.dry_run.lower() in ("true", "1", "yes")
    run_id  = args.run_id or uuid.uuid4().hex[:8]

    if args.max_parallel > 1:
        print(
            "⚠  max_parallel > 1 není v fázi 1 podporováno. "
            "Paralelní zápis je povolen až po ověření stability na Micro (fáze 5)."
        )
        print("   Pokračuji se max_parallel=1.")

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
        gl_f  = parts[0] if len(parts) > 0 else ""
        hl_f  = parts[1] if len(parts) > 1 else ""
        markets = [
            m for m in markets
            if (not gl_f or m["gl"] == gl_f) and (not hl_f or m["hl"] == hl_f)
        ]

    if not dry_run and markets:
        done_set: set[tuple] = set()
        rows = db.select(STATE_TABLE, "select=gl,hl,status&status=eq.done")
        for r in rows:
            done_set.add((r["gl"], r["hl"]))
        pending  = [m for m in markets if (m["gl"], m["hl"]) not in done_set]
        skipped  = len(markets) - len(pending)
        if skipped:
            print(f"  ↷ Přeskočeno {skipped} dokončených marketů.")
        markets = pending

    markets = markets[: args.batch_limit]

    print(
        f"🔍 Google Suggest Crawler v2  |  dry_run={dry_run}  "
        f"|  max_depth={args.max_depth}  |  run_id={run_id}"
    )
    print(f"   Markety v tomto běhu: {len(markets)}")
    for m in markets:
        print(f"   • {m['gl']}/{m['hl']}  ({m.get('notes', '')})")
    if args.resume_from:
        print(f"   --resume-from: {args.resume_from}")
    print()

    results: dict[str, str] = {}
    for market in markets:
        label = f"{market['gl']}/{market['hl']}"
        status = run_market(
            db, market, cfg, dry_run,
            run_id=run_id,
            resume_from=args.resume_from,
        )
        results[label] = status

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
