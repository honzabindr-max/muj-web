#!/usr/bin/env python3
"""
Unified Google Suggest Crawler — google_suggestions_v2
Nahrazuje crawler_google.py / _at / _de. Seznam (crawler_auto.py) se nedotýká.

Použití:
  python crawler.py [--dry-run true] [--max-depth 1] [--batch-limit 5]
                    [--max-parallel 1] [--market-filter cz/cs]

Architektura:
  - Načte config/google_markets.yml (gl+hl kombinace)
  - Sekvenčně (max_parallel=1) projde enabled markety
  - BFS traversal per market s checkpointingem v google_crawler_state
  - Write buffer (batch_size rows) → PostgREST batch upsert → google_suggestions_v2
  - ON CONFLICT (gl, hl, phrase_norm) DO NOTHING
  - Stav se ukládá každých 30s (heartbeat) a 5 min (plný stav s queue)
  - Před vypršením max_runtime: flush bufferu + uložení stavu → navázání v dalším runu
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("✗ Chybí pyyaml — spusť: pip install pyyaml")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────
# Konfigurace
# ─────────────────────────────────────────────────────────────
SUGGEST_URL   = "https://suggestqueries.google.com/complete/search"
SUGGEST_LIMIT = 10
MAX_RETRIES   = 3
TABLE         = "google_suggestions_v2"
STATE_TABLE   = "google_crawler_state"
SAFE          = '=&.,()!*:"'

# Abecedy pro BFS expand_chars (per hl kód → rozšíří latin základ)
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
    """ALL_ROOTS = abeceda bez trailing space."""
    return [c for c in get_alphabet(hl) if c != " "]


# ─────────────────────────────────────────────────────────────
# Normalizace frází — musí odpovídat SQL v migraci:
#   lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g')))
# ─────────────────────────────────────────────────────────────
def normalize(phrase: str) -> str:
    return re.sub(r"\s+", " ", phrase).strip().lower()


# ─────────────────────────────────────────────────────────────
# DB třída — PostgREST/urllib (beze změny oproti crawler_google.py)
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
        u = s.base + "/" + p
        b = json.dumps(d).encode() if d else None
        h = dict(s.h)
        h.update(eh or {})
        try:
            r = urllib.request.urlopen(
                urllib.request.Request(u, data=b, headers=h, method=m), timeout=30
            )
            t = r.read().decode()
            return json.loads(t) if t.strip() else None
        except urllib.error.HTTPError as e:
            code = e.code
            err = e.read().decode()[:200]
            if code != 409:
                print("  ⚠ HTTP " + str(code) + ": " + err[:120])
            return None

    def select(s, t, p=""):
        return s._req("GET", t + "?" + urllib.parse.quote(p, safe=SAFE)) or []

    def update(s, t, p, d):
        return s._req(
            "PATCH",
            t + "?" + urllib.parse.quote(p, safe=SAFE),
            d,
            {"Prefer": "return=minimal"},
        )

    def upsert_batch(s, rows: list) -> list:
        """Batch upsert do google_suggestions_v2.
        Conflict target: (gl, hl, phrase_norm) → DO NOTHING.
        Vrací jen vložené řádky (select=id) — pro počítání new_total.
        """
        if not rows:
            return []
        res = s._req(
            "POST",
            TABLE + "?on_conflict=gl,hl,phrase_norm&select=id",
            rows,
            {"Prefer": "resolution=ignore-duplicates,return=representation"},
        )
        return res if isinstance(res, list) else []

    def upsert_state(s, gl: str, hl: str, d: dict):
        """Lazy-upsert řádku stavu pro market (gl, hl)."""
        return s._req(
            "POST",
            STATE_TABLE + "?on_conflict=gl,hl",
            {**d, "gl": gl, "hl": hl},
            {"Prefer": "resolution=merge-duplicates,return=minimal"},
        )

    def count_market(s, gl: str, hl: str) -> int:
        """Počet frází v google_suggestions_v2 pro daný market."""
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

    def fetch(s, phrase: str) -> list[str]:
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
                    return None  # signál pro caller: přestat tento market
                else:
                    print(f"  ⚠ HTTP {e.code}, pokus {attempt+1}")
                    time.sleep(2)
            except Exception as e:
                s.errs += 1
                print(f"  ⚠ {e}, pokus {attempt+1}")
                time.sleep(2)
        return []


# ─────────────────────────────────────────────────────────────
# State management per (gl, hl)
# ─────────────────────────────────────────────────────────────
def load_state(db: DB, gl: str, hl: str) -> dict | None:
    rows = db.select(STATE_TABLE, f"select=*&gl=eq.{gl}&hl=eq.{hl}")
    if not rows:
        return None
    s = rows[0]
    s["queue"] = s["queue"] if isinstance(s["queue"], list) else (
        json.loads(s["queue"]) if s["queue"] else []
    )
    s["next_queue"] = s["next_queue"] if isinstance(s["next_queue"], list) else (
        json.loads(s["next_queue"]) if s["next_queue"] else []
    )
    return s


def save_state(db: DB, gl: str, hl: str, state: dict):
    """Plný zápis — queue + next_queue. Každých ~5 min a při depth-advance/exit."""
    db.upsert_state(gl, hl, {
        "current_depth":  state["current_depth"],
        "current_prefix": state["current_prefix"],
        "queue":          json.dumps(state["queue"]),
        "next_queue":     json.dumps(state["next_queue"]),
        "status":         state["status"],
        "processed":      state["processed"],
        "queries_total":  state["queries_total"],
        "new_total":      state["new_total"],
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    })


def save_heartbeat(db: DB, gl: str, hl: str, state: dict):
    """Lehký zápis bez queue — drží updated_at čerstvý každých ~30s."""
    db.upsert_state(gl, hl, {
        "current_depth":  state["current_depth"],
        "current_prefix": state["current_prefix"],
        "status":         state["status"],
        "processed":      state["processed"],
        "queries_total":  state["queries_total"],
        "new_total":      state["new_total"],
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────────────────────────
# BFS session pro jeden market
# ─────────────────────────────────────────────────────────────
def run_market(db: DB, market: dict, cfg: dict, dry_run: bool) -> str:
    """Spustí / naváže BFS session pro jeden market.
    Vrací: 'done' | 'paused' | 'blocked' | 'error'
    """
    gl = market["gl"]
    hl = market["hl"]
    max_depth      = market.get("max_depth",              cfg["max_depth"])
    max_runtime    = market.get("max_runtime_minutes",    cfg["max_runtime_minutes"]) * 60
    batch_size     = market.get("batch_size",             cfg["batch_size"])
    delay_ms       = market.get("delay_between_requests_ms", cfg["delay_between_requests_ms"])

    expand_chars = get_alphabet(hl)
    all_roots    = get_roots(hl)
    label        = f"{gl}/{hl}"
    api          = GoogleAPI(gl, hl, delay_ms)

    # ── Načtení / inicializace stavu ──
    state = load_state(db, gl, hl) if not dry_run else None
    if state is None or state.get("status") in ("pending", "done"):
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
            db.upsert_state(gl, hl, {
                **state,
                "queue":      json.dumps(state["queue"]),
                "next_queue": json.dumps(state["next_queue"]),
                "last_started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at":      datetime.now(timezone.utc).isoformat(),
            })
    else:
        state["status"] = "running"

    depth       = state["current_depth"]
    queue       = state["queue"]
    next_q      = state["next_queue"]
    processed   = state["processed"]
    queries     = state["queries_total"]
    new_total   = state["new_total"]
    total_in_q  = len(queue) + processed  # odhad pro % progress

    db_count = db.count_market(gl, hl) if not dry_run else "—"
    print(f"\n{'═'*60}")
    print(f"  Market: {label}  |  depth={depth}/{max_depth}")
    print(f"  Queue: {len(queue)} prefixů  |  DB: {db_count} frází")
    print(f"  {'[DRY RUN — žádný zápis]' if dry_run else ''}")
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
        state["current_depth"] = depth
        state["queue"] = queue
        state["next_queue"] = next_q
        state["processed"] = processed
        print(f"  ⬆ Navazuji na depth {depth} ({total_in_q} prefixů)")
        save_state(db, gl, hl, state)

    if not queue and not next_q:
        print(f"  🏁 Market {label} byl již dokončen.")
        return "done"

    # ── Write buffer ──
    buffer: list[dict] = []
    start = time.time()
    last_heartbeat = time.time()
    last_full_save = time.time()
    blocked = False

    def flush_buffer() -> int:
        nonlocal new_total
        if not buffer:
            return 0
        res = db.upsert_batch(buffer)
        inserted = len(res)
        conflict_ratio = round(1 - inserted / len(buffer), 2) if buffer else 0
        new_total += inserted
        state["new_total"] = new_total
        if len(buffer) >= batch_size or inserted > 0:
            print(
                f"  ↑ flush {len(buffer)} rows → +{inserted} nových "
                f"(conflict_ratio={conflict_ratio}) | total={new_total}"
            )
        buffer.clear()
        return inserted

    now_iso = datetime.now(timezone.utc).isoformat()

    # ── Hlavní BFS smyčka ──
    try:
        while queue:
            elapsed = time.time() - start
            if elapsed > max_runtime - 60:  # 60s safety margin před timeoutem
                print(f"\n  ⏰ Blížím se max_runtime ({max_runtime//60} min). Ukládám stav...")
                flush_buffer()
                state.update({
                    "queue": queue, "next_queue": next_q,
                    "processed": processed, "queries_total": queries,
                    "new_total": new_total, "current_depth": depth,
                    "status": "running",
                })
                save_state(db, gl, hl, state)
                return "paused"

            prefix = queue.pop(0)
            processed += 1
            state["current_prefix"] = prefix
            state["processed"] = processed
            state["queries_total"] = queries

            suggs = api.fetch(prefix)
            queries += 1

            if suggs is None:  # 403 BLOCKED
                flush_buffer()
                state.update({
                    "queue": queue, "next_queue": next_q,
                    "processed": processed, "queries_total": queries,
                    "new_total": new_total, "current_depth": depth,
                    "status": "error",
                })
                save_state(db, gl, hl, state)
                blocked = True
                break

            if suggs:
                for phrase in suggs:
                    buffer.append({
                        "gl": gl, "hl": hl,
                        "phrase":       phrase,
                        "phrase_norm":  normalize(phrase),
                        "depth":        depth,
                        "parent_prefix": prefix,
                        "first_seen_at": now_iso,
                        "last_seen_at":  now_iso,
                        "seen_count":    1,
                    })
                if len(buffer) >= batch_size:
                    flush_buffer()

            if len(suggs) >= SUGGEST_LIMIT and depth < max_depth:
                for c in expand_chars:
                    next_q.append(prefix + c)

            pct = round(processed / total_in_q * 100) if total_in_q else 0
            if processed % 20 == 0:
                print(
                    f"  [d{depth} {pct}%] '{prefix}' → {len(suggs or [])} suggs "
                    f"| q={queries} | {round(elapsed)}s | delay={api.delay:.2f}s"
                )

            # Checkpointing
            t_now = time.time()
            if t_now - last_full_save > 300:
                flush_buffer()
                state.update({
                    "queue": queue, "next_queue": next_q,
                    "processed": processed, "queries_total": queries,
                    "new_total": new_total, "current_depth": depth,
                    "status": "running",
                })
                save_state(db, gl, hl, state)
                last_full_save = t_now
                last_heartbeat = t_now
            elif t_now - last_heartbeat > 30:
                state.update({
                    "processed": processed, "queries_total": queries,
                    "new_total": new_total, "current_depth": depth,
                })
                save_heartbeat(db, gl, hl, state)
                last_heartbeat = t_now

        # Fronta vyprázdněna (nebo blocked)
        if blocked:
            return "blocked"

        flush_buffer()

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
                "status": "running",
            })
            print(f"  ⬆ Depth {depth} ({total_in_q} prefixů) — ukládám a navazuji v dalším runu")
            save_state(db, gl, hl, state)
            return "paused"  # workflow spustí další run

        # Skutečný konec
        result_status = "done"
        state.update({
            "current_depth": depth, "queue": [], "next_queue": [],
            "processed": processed, "queries_total": queries,
            "new_total": new_total, "status": result_status,
            "last_finished_at": datetime.now(timezone.utc).isoformat(),
        })
        save_state(db, gl, hl, state)

    except Exception as e:
        flush_buffer()
        state.update({
            "queue": queue, "next_queue": next_q,
            "processed": processed, "queries_total": queries,
            "new_total": new_total, "current_depth": depth,
            "status": "error",
        })
        save_state(db, gl, hl, state)
        print(f"  ✗ Exception v marketu {label}: {e}")
        return "error"

    dur = time.time() - start
    final_count = db.count_market(gl, hl)
    print(f"\n{'═'*60}")
    print(f"  Market: {label}  |  {result_status.upper()}")
    print(f"  Processed: {processed}  |  Queries: {queries}  |  New: +{new_total}")
    print(f"  Errors: {api.errs}  |  Duration: {round(dur)}s ({round(dur/60,1)} min)")
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
    return p.parse_args()


def load_config(max_depth_override: int) -> tuple[dict, list]:
    config_path = os.path.join(os.path.dirname(__file__), "config", "google_markets.yml")
    with open(config_path) as f:
        raw = yaml.safe_load(f)
    defaults = raw.get("defaults", {})
    # Override max_depth z CLI
    defaults["max_depth"] = max_depth_override
    return defaults, raw.get("markets", [])


def main():
    args = parse_args()
    dry_run = args.dry_run.lower() in ("true", "1", "yes")

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

    # Filtrování enabled + market_filter
    markets = [m for m in all_markets if m.get("enabled", False)]
    if args.market_filter:
        parts = args.market_filter.split("/")
        gl_f = parts[0] if len(parts) > 0 else ""
        hl_f = parts[1] if len(parts) > 1 else ""
        markets = [
            m for m in markets
            if (not gl_f or m["gl"] == gl_f) and (not hl_f or m["hl"] == hl_f)
        ]

    # Přeskočit dokončené markety (status='done') — jen pokud máme DB
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

    print(f"🔍 Google Suggest Crawler v2  |  dry_run={dry_run}  |  max_depth={args.max_depth}")
    print(f"   Markety v tomto běhu: {len(markets)}")
    for m in markets:
        print(f"   • {m['gl']}/{m['hl']}  ({m.get('notes','')})")
    print()

    results: dict[str, str] = {}
    for market in markets:
        label = f"{market['gl']}/{market['hl']}"
        status = run_market(db, market, cfg, dry_run)
        results[label] = status

    print(f"\n{'═'*60}")
    print("  Výsledky běhu:")
    for label, status in results.items():
        icon = {"done": "✓", "paused": "⏸", "blocked": "✗", "error": "✗"}.get(status, "?")
        print(f"  {icon} {label}: {status}")
    print(f"{'═'*60}")


if __name__ == "__main__":
    main()
