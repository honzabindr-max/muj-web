#!/usr/bin/env python3
"""
Phase 2A Depth-1 Pilot -- depth 0 + depth 1, DB writes.

Zapisuje POUZE do:
  suggest_depth_pilot_runs
  suggest_depth_pilot_suggestions
  suggest_depth_pilot_parent_queries

NEDOTYKA SE:
  google_suggestions_v3, google_suggestions_v2,
  crawler_control, google_crawler_state

Env vars:
  PROXY_URL     -- IPRoyal sticky proxy (povinny)
  SUPABASE_URL  -- Supabase REST URL (povinny v production)
  SUPABASE_KEY  -- Supabase service key (povinny v production)
  DRY_RUN       -- 'true' = jen IP checks, zadny Google req, zadny DB zapis
  PHASE2A_ABORT -- 'true' = okamzity exit
"""
import json, os, random, re, string, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------
PROXY_URL    = os.environ.get("PROXY_URL", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
DRY_RUN      = os.environ.get("DRY_RUN", "false").lower() in ("true", "1", "yes")
ABORT        = os.environ.get("PHASE2A_ABORT", "false").lower() in ("true", "1", "yes")

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
IP_API_URL  = "http://ip-api.com/json/?fields=country,countryCode,query"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

TABLE_RUNS = "suggest_depth_pilot_runs"
TABLE_SUGG = "suggest_depth_pilot_suggestions"
TABLE_PQ   = "suggest_depth_pilot_parent_queries"

# Limity
MAX_DEPTH                             = 1
MAX_DEPTH1_PARENT_QUERIES_PER_MARKET  = 140   # further capped by actual depth-0 unique count
MAX_DEPTH1_CHILDREN_PER_PARENT        = 10
MAX_REQUESTS_PER_MARKET               = 180
ERROR_RATE_STOP                       = 0.15
ERROR_RATE_MIN_REQUESTS               = 10
GLOBAL_STOP_FAILED_MARKETS            = 3
GLOBAL_CAP_REQUESTS                   = 1150
DB_CHUNK_SIZE                         = 500

LIFETIME_MIN          = 10
PAUSE_BETWEEN_SEEDS   = (1.5, 3.0)
PAUSE_BETWEEN_MARKETS = (8.0, 12.0)
PAUSE_DRY_RUN         = (3.0, 5.0)
IP_CHECK_RETRIES      = 3
IP_CHECK_RETRY_PAUSE  = 4.0

SEED_PREFIXES = [
    "a", "ai", "how", "best", "de", "kf", "apple", "0o",
    "s", "b", "jak", "wie", "youtube", "amazon",
]

MARKETS = [
    {"gl": "cz", "hl": "cs", "requested_country": "CZ"},
    {"gl": "de", "hl": "de", "requested_country": "DE"},
    {"gl": "ad", "hl": "ca", "requested_country": "AD"},
    {"gl": "us", "hl": "en", "requested_country": "US"},
    {"gl": "fr", "hl": "fr", "requested_country": "FR"},
    {"gl": "br", "hl": "pt", "requested_country": "BR"},
    {"gl": "jp", "hl": "ja", "requested_country": "JP"},
]


# ---------------------------------------------------------------------------
# GHA maskovani
# ---------------------------------------------------------------------------
def mask_gha(value):
    if value and os.environ.get("GITHUB_ACTIONS"):
        print(f"::add-mask::{value}", flush=True)


# ---------------------------------------------------------------------------
# Proxy helpers
# ---------------------------------------------------------------------------
def _parse_proxy(proxy_url):
    p = urllib.parse.urlparse(proxy_url)
    return p.scheme, p.username or "", p.password or "", p.hostname or "", p.port or 12321


def _safe_label(url):
    try:
        p          = urllib.parse.urlparse(url)
        pwd        = p.password or ""
        country_m  = re.search(r'_country-([a-z]{2,3})', pwd)
        lifetime_m = re.search(r'(_lifetime-\w+)', pwd)
        country_s  = f"_country-{country_m.group(1)}" if country_m else ""
        lifetime_s = lifetime_m.group(1) if lifetime_m else ""
        suffix     = f"{country_s}_session-***{lifetime_s}" if country_s else "[global-rotating]"
        return f"{p.scheme}://****:****{suffix}@{p.hostname}:{p.port}"
    except Exception:
        return "[proxy label parse error]"


def _build_sticky_url(country_code, session_id):
    if not PROXY_URL:
        return None
    scheme, user, base_pwd, host, port = _parse_proxy(PROXY_URL)
    base_clean = re.split(r'_country-', base_pwd)[0]
    safe_base  = urllib.parse.quote(base_clean, safe="%")
    new_pwd    = (
        f"{safe_base}_country-{country_code.lower()}"
        f"_session-{session_id}_lifetime-{LIFETIME_MIN}m"
    )
    enc_user = urllib.parse.quote(user, safe="%")
    return f"{scheme}://{enc_user}:{new_pwd}@{host}:{port}"


def sticky_opener(market, session_id):
    url = _build_sticky_url(market["requested_country"].lower(), session_id)
    if url is None:
        print("  WARNING: PROXY_URL neni nastaven -- pouzivam direct connection")
        return urllib.request.build_opener()
    print(f"  [sticky/{market['gl']}] {_safe_label(url)}")
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": url, "https": url})
    )


def rand_session(prefix="2a"):
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def utcnow():
    return datetime.now(timezone.utc).isoformat()


def normalize(phrase):
    return re.sub(r'\s+', ' ', phrase).strip().lower()


# ---------------------------------------------------------------------------
# IP check
# ---------------------------------------------------------------------------
def check_ip(opener, label=""):
    """Vraci (exit_ip, exit_cc). exit_ip se NIKDY neloguje ani neuklada."""
    for attempt in range(1, IP_CHECK_RETRIES + 1):
        try:
            req = urllib.request.Request(IP_API_URL, headers={"User-Agent": UA})
            with opener.open(req, timeout=15) as r:
                raw = r.read().decode().strip()
                if not raw:
                    raise ValueError("prazdna odpoved ip-api.com")
                d  = json.loads(raw)
                ip = d.get("query", "?")
                cc = d.get("countryCode", "?")
                print(f"  [ip-check/{label}] exit_cc={cc} (attempt {attempt})")
                return ip, cc
        except Exception as e:
            print(f"  [ip-check/{label}] attempt {attempt}/{IP_CHECK_RETRIES} error: {e}")
            if attempt < IP_CHECK_RETRIES:
                time.sleep(IP_CHECK_RETRY_PAUSE)
    return "error", "error"


# ---------------------------------------------------------------------------
# Google Suggest fetch
# ---------------------------------------------------------------------------
def fetch_suggest(opener, gl, hl, prefix):
    params = urllib.parse.urlencode({
        "client": "firefox", "q": prefix, "hl": hl, "gl": gl,
    })
    url = SUGGEST_URL + "?" + params
    req = urllib.request.Request(url, headers={
        "User-Agent":      UA,
        "Accept":          "application/json",
        "Accept-Language": f"{hl},en;q=0.5",
    })
    t0 = time.time()
    try:
        with opener.open(req, timeout=15) as r:
            lat   = int((time.time() - t0) * 1000)
            data  = json.loads(r.read().decode())
            suggs = data[1] if isinstance(data, list) and len(data) >= 2 else []
            return 200, suggs, None, lat
    except urllib.error.HTTPError as e:
        lat = int((time.time() - t0) * 1000)
        return e.code, [], f"HTTP {e.code}", lat
    except Exception as e:
        lat = int((time.time() - t0) * 1000)
        return None, [], str(e)[:200], lat


# ---------------------------------------------------------------------------
# Supabase REST API
# ---------------------------------------------------------------------------
def supabase_request(method, path, data=None, extra_headers=None):
    url     = SUPABASE_URL.rstrip("/") + "/rest/v1/" + path
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    body = json.dumps(data, ensure_ascii=False).encode() if data is not None else None
    req  = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else True
    except urllib.error.HTTPError as e:
        body_err = ""
        try:
            body_err = e.read()[:300].decode(errors="replace")
        except Exception:
            pass
        print(f"  DB HTTP {e.code}: {body_err}")
        return False
    except Exception as ex:
        print(f"  DB error: {ex}")
        return False


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
def create_run_row(pilot_id, market, exit_cc, country_match):
    row = {
        "pilot_id":                             pilot_id,
        "source":                               "google",
        "gl":                                   market["gl"],
        "hl":                                   market["hl"],
        "requested_country":                    market["requested_country"],
        "exit_country":                         exit_cc if exit_cc not in ("error", "?") else None,
        "country_match":                        country_match,
        "proxy_mode":                           "sticky_country",
        "max_depth":                            MAX_DEPTH,
        "max_requests_per_market":              MAX_REQUESTS_PER_MARKET,
        "max_depth1_parent_queries_per_market": MAX_DEPTH1_PARENT_QUERIES_PER_MARKET,
        "max_depth1_children_per_parent":       MAX_DEPTH1_CHILDREN_PER_PARENT,
        "error_rate_stop":                      ERROR_RATE_STOP,
        "status":                               "running",
    }
    result = supabase_request(
        "POST", TABLE_RUNS, data=row,
        extra_headers={"Prefer": "return=representation"},
    )
    if isinstance(result, list) and result:
        return result[0]["run_id"]
    print(f"  WARNING: create_run_row unexpected: {result}")
    return None


def update_run_row(run_id, updates):
    ok = supabase_request(
        "PATCH", f"{TABLE_RUNS}?run_id=eq.{run_id}",
        data=updates,
        extra_headers={"Prefer": "return=minimal"},
    )
    if ok is False:
        print(f"  WARNING: update_run_row failed pro run_id={run_id}")


def db_upsert_suggestions(rows):
    """ON CONFLICT (pilot_id,source,gl,hl,phrase_norm) → ignore. URL query param."""
    if not rows:
        return
    path = f"{TABLE_SUGG}?on_conflict=pilot_id,source,gl,hl,phrase_norm"
    for i in range(0, len(rows), DB_CHUNK_SIZE):
        chunk = rows[i : i + DB_CHUNK_SIZE]
        ok = supabase_request("POST", path, data=chunk, extra_headers={
            "Prefer": "return=minimal,resolution=ignore-duplicates",
        })
        if ok is False:
            print(f"  WARNING: suggestions upsert chunk {i // DB_CHUNK_SIZE} failed")


def db_insert_parent_queries(rows):
    """Bez UNIQUE constraintu -- vsechny requesty vcetne dead branches."""
    if not rows:
        return
    for i in range(0, len(rows), DB_CHUNK_SIZE):
        chunk = rows[i : i + DB_CHUNK_SIZE]
        ok = supabase_request("POST", TABLE_PQ, data=chunk, extra_headers={
            "Prefer": "return=minimal",
        })
        if ok is False:
            print(f"  WARNING: parent_queries insert chunk {i // DB_CHUNK_SIZE} failed")


# ---------------------------------------------------------------------------
# Depth-1 parent selection
# ---------------------------------------------------------------------------
def select_depth1_parents(d0_rows, max_count):
    """
    Vraci list dict s info o parentu pro depth-1.
    Dedup pres phrase_norm, poradi prvniho vyskytu, cap na max_count.
    parent_position = pořadí v rámci origin_seed (ne v celém marketu).
    """
    seen                  = set()
    parents               = []
    seed_position_counter = {}
    for row in d0_rows:
        pn   = row["phrase_norm"]
        seed = row["seed_prefix"]
        if pn not in seen:
            seen.add(pn)
            pos = seed_position_counter.get(seed, 0)
            seed_position_counter[seed] = pos + 1
            parents.append({
                "parent_phrase_raw":          row["phrase_raw"],
                "parent_phrase_norm":         pn,
                "origin_seed":                seed,
                "parent_depth0_raw_position": row["raw_position"],
                "parent_position":            pos,
            })
        if len(parents) >= max_count:
            break
    return parents


# ---------------------------------------------------------------------------
# Error tracker -- kumulativni per market (depth-0 + depth-1)
# ---------------------------------------------------------------------------
class ErrorTracker:
    def __init__(self):
        self._total    = 0
        self._errors   = 0
        self._http200  = 0
        self._http_err = 0
        self._timeouts = 0

    def record(self, sc, err):
        self._total += 1
        is_timeout = (
            sc is None and bool(err)
            and any(t in err.lower() for t in ("timed out", "timeout"))
        )
        if is_timeout:
            self._timeouts += 1
            self._errors   += 1
        elif sc == 200:
            self._http200 += 1
        else:
            self._http_err += 1
            self._errors   += 1

    def rate(self):
        return round(self._errors / self._total, 4) if self._total else 0.0

    def should_stop(self):
        return self._total >= ERROR_RATE_MIN_REQUESTS and self.rate() >= ERROR_RATE_STOP

    @property
    def total(self):    return self._total
    @property
    def http_200(self): return self._http200
    @property
    def http_err(self): return self._http_err
    @property
    def timeouts(self): return self._timeouts


# ---------------------------------------------------------------------------
# Summary artifact
# ---------------------------------------------------------------------------
def write_summary(pilot_id, started_at, market_summaries, global_requests, path):
    summary = {
        "pilot_id":        pilot_id,
        "started_at":      started_at,
        "completed_at":    utcnow(),
        "global_requests": global_requests,
        "markets":         market_summaries,
        "totals": {
            "d0_unique_phrases":   sum(s.get("d0_unique",          0) for s in market_summaries),
            "d1_parents_selected": sum(s.get("d1_parents_selected",0) for s in market_summaries),
            "d1_queried":          sum(s.get("d1_queried",          0) for s in market_summaries),
            "d1_new_phrases":      sum(s.get("d1_new",              0) for s in market_summaries),
            "dead_branches":       sum(s.get("dead_branches",       0) for s in market_summaries),
        },
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    print(f"\n  OK artifact: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if ABORT:
        print("PHASE2A_ABORT=true -- okamzity exit.")
        sys.exit(0)

    started_at = utcnow()
    pilot_id   = "2a_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=5))

    print(f"\n{'='*65}")
    print(f"  PHASE 2A DEPTH-1 PILOT  |  pilot_id={pilot_id}")
    print(f"  {started_at[:19]}Z  |  dry_run={DRY_RUN}")
    print(f"  markets={len(MARKETS)}  seeds={len(SEED_PREFIXES)}")
    print(f"  max_d1_parents/market={MAX_DEPTH1_PARENT_QUERIES_PER_MARKET}")
    print(f"  max_children/parent={MAX_DEPTH1_CHILDREN_PER_PARENT}")
    print(f"  max_reqs/market={MAX_REQUESTS_PER_MARKET}  global_cap={GLOBAL_CAP_REQUESTS}")
    print(f"  error_rate_stop={ERROR_RATE_STOP:.0%} (min {ERROR_RATE_MIN_REQUESTS} req)")
    print(f"  global_stop_failed_markets={GLOBAL_STOP_FAILED_MARKETS}")
    print(f"  Tabulky: {TABLE_RUNS}, {TABLE_SUGG}, {TABLE_PQ}")
    print(f"  NEDOTYKAME SE: google_suggestions_v2/v3, crawler_control, google_crawler_state")
    print(f"{'='*65}\n")

    if not PROXY_URL:
        print("STOP: PROXY_URL neni nastaven.")
        sys.exit(1)

    # Maskuj proxy credentials v GHA
    try:
        _, user, base_pwd, _, _ = _parse_proxy(PROXY_URL)
        base_clean = re.split(r'_country-', base_pwd)[0]
        mask_gha(PROXY_URL)
        mask_gha(user)
        mask_gha(base_clean)
    except Exception:
        pass

    # -----------------------------------------------------------------------
    # DRY RUN -- pouze sticky country IP checks
    # -----------------------------------------------------------------------
    if DRY_RUN:
        print("=== DRY RUN: pouze sticky IP checks (7 markets) ===\n")
        failed  = 0
        results = []
        for market in MARKETS:
            gl, hl, req_cc = market["gl"], market["hl"], market["requested_country"]
            print(f"--- {gl}/{hl} (expected={req_cc}) ---")
            session_id        = rand_session("2adr")
            opener            = sticky_opener(market, session_id)
            _exit_ip, exit_cc = check_ip(opener, f"{gl}/{hl}")
            match = exit_cc.upper() == req_cc.upper() and exit_cc not in ("error", "?")
            print(f"  exit_cc={exit_cc} [{'OK' if match else 'MISMATCH'}]")
            results.append({
                "gl": gl, "hl": hl,
                "req_cc": req_cc, "exit_cc": exit_cc, "match": match,
            })
            if not match:
                failed += 1
            time.sleep(random.uniform(*PAUSE_DRY_RUN))

        print(f"\n{'='*52}")
        print(f"  {'Market':<10} {'Exit CC':>8} {'Expected':>10} {'Match?':>8}")
        print(f"  {'-'*42}")
        for r in results:
            s = "OK" if r["match"] else "MISMATCH"
            print(f"  {r['gl']}/{r['hl']:<6} {r['exit_cc']:>8} {r['req_cc']:>10} {s:>8}")
        print(f"{'='*52}")

        if failed:
            print(f"\nEXIT 1: {failed} IP mismatch(y). Oprav proxy konfiguraci.")
            sys.exit(1)
        print("\nDRY RUN OK: zadny Google request, zadny DB zapis, zadny artifact.")
        return

    # -----------------------------------------------------------------------
    # PRODUCTION
    # -----------------------------------------------------------------------
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("STOP: SUPABASE_URL nebo SUPABASE_KEY neni nastaven.")
        sys.exit(1)

    global_requests  = 0
    failed_markets   = 0
    market_summaries = []

    for market in MARKETS:
        gl, hl, req_cc = market["gl"], market["hl"], market["requested_country"]

        if global_requests >= GLOBAL_CAP_REQUESTS:
            print(f"\n  GLOBAL CAP: {GLOBAL_CAP_REQUESTS} requestu dosazeno. Zastavuji.")
            break
        if failed_markets >= GLOBAL_STOP_FAILED_MARKETS:
            print(f"\n  GLOBAL STOP: {failed_markets} failed markets. Zastavuji.")
            break

        print(f"\n{'='*55}")
        print(f"  MARKET: {gl}/{hl}  (expected={req_cc})")
        print(f"  global_req={global_requests}/{GLOBAL_CAP_REQUESTS}"
              f"  failed={failed_markets}/{GLOBAL_STOP_FAILED_MARKETS}")
        print(f"{'='*55}")

        # IP check
        session_id        = rand_session("2aprd")
        opener            = sticky_opener(market, session_id)
        _exit_ip, exit_cc = check_ip(opener, f"{gl}/{hl}")
        country_match     = (
            exit_cc.upper() == req_cc.upper()
            and exit_cc not in ("error", "?")
        )

        if not country_match:
            print(f"  IP MISMATCH: exit={exit_cc} expected={req_cc}. Skip.")
            run_id = create_run_row(pilot_id, market, exit_cc, False)
            if run_id:
                update_run_row(run_id, {"status": "ip_mismatch", "finished_at": utcnow()})
            failed_markets += 1
            market_summaries.append({
                "gl": gl, "hl": hl, "run_id": run_id, "exit_cc": exit_cc,
                "status": "ip_mismatch", "requests": 0,
                "d0_unique": 0, "d1_parents_selected": 0, "d1_queried": 0,
                "d1_new": 0, "dead_branches": 0, "error_rate": 0.0,
            })
            continue

        print(f"  IP OK: exit_cc={exit_cc}")

        # Vytvor run row -- ziska run_id
        run_id = create_run_row(pilot_id, market, exit_cc, True)
        if run_id is None:
            print(f"  DB ERROR: nelze vytvorit run row. Skip.")
            failed_markets += 1
            continue
        print(f"  run_id={run_id}")

        # Stav pro tento market
        seen            = set()   # intra-run dedup per market (phrase_norm)
        error_tracker   = ErrorTracker()
        market_requests = 0

        d0_rows        = []
        d0_suggest_raw = 0   # raw phrases returned z depth-0 (pred dedup)
        d0_query_count = 0
        dup_intra_d0   = 0
        cap_hit        = False
        stop_reason    = None

        # -------------------------------------------------------------------
        # DEPTH 0
        # -------------------------------------------------------------------
        print(f"\n  [DEPTH 0] {len(SEED_PREFIXES)} seeds")
        for seed in SEED_PREFIXES:
            if market_requests >= MAX_REQUESTS_PER_MARKET:
                cap_hit     = True
                stop_reason = "max_requests_per_market"
                print(f"  CAP (d0): max_requests_per_market={MAX_REQUESTS_PER_MARKET}")
                break
            if global_requests >= GLOBAL_CAP_REQUESTS:
                cap_hit     = True
                stop_reason = "global_cap"
                print(f"  CAP (d0): global_cap={GLOBAL_CAP_REQUESTS}")
                break

            sc, phrases, err, lat = fetch_suggest(opener, gl, hl, seed)
            market_requests += 1
            global_requests += 1
            d0_query_count  += 1
            error_tracker.record(sc, err)
            d0_suggest_raw  += len(phrases)

            sc_label = str(sc) if sc is not None else "ERR"
            print(f"    d0 '{seed}': {sc_label}, {len(phrases)} suggs, {lat}ms")

            for idx, phrase in enumerate(phrases):
                pn = normalize(phrase)
                if pn in seen:
                    dup_intra_d0 += 1
                    continue
                seen.add(pn)
                d0_rows.append({
                    "run_id":             run_id,
                    "pilot_id":           pilot_id,
                    "source":             "google",
                    "gl":                 gl,
                    "hl":                 hl,
                    "depth":              0,
                    "seed_prefix":        seed,
                    "parent_phrase_raw":  None,
                    "parent_phrase_norm": None,
                    "phrase_raw":         phrase,
                    "phrase_norm":        pn,
                    "raw_position":       idx,
                })

            time.sleep(random.uniform(*PAUSE_BETWEEN_SEEDS))

        # Uloz depth-0 suggestions
        db_upsert_suggestions(d0_rows)
        d0_unique_count = len(d0_rows)
        print(f"  d0 done: {d0_query_count} req, {d0_unique_count} unique phrases"
              f", {dup_intra_d0} intra-dups, raw={d0_suggest_raw}")

        # -------------------------------------------------------------------
        # SELECT PARENTS PRO DEPTH 1
        # -------------------------------------------------------------------
        max_parents = min(d0_unique_count, MAX_DEPTH1_PARENT_QUERIES_PER_MARKET)
        parents     = select_depth1_parents(d0_rows, max_parents)

        # -------------------------------------------------------------------
        # DEPTH 1
        # -------------------------------------------------------------------
        d1_rows        = []
        pq_rows        = []
        d1_suggest_raw = 0
        d1_query_count = 0
        d1_new_count   = 0
        dup_intra_d1   = 0
        dead_branches  = 0

        print(f"\n  [DEPTH 1] {len(parents)} parents"
              f" (cap=min({d0_unique_count},{MAX_DEPTH1_PARENT_QUERIES_PER_MARKET})={max_parents})")

        for p_idx, parent in enumerate(parents):
            if market_requests >= MAX_REQUESTS_PER_MARKET:
                cap_hit     = True
                stop_reason = "max_requests_per_market"
                print(f"  CAP (d1): max_requests_per_market={MAX_REQUESTS_PER_MARKET}")
                break
            if global_requests >= GLOBAL_CAP_REQUESTS:
                cap_hit     = True
                stop_reason = "global_cap"
                print(f"  CAP (d1): global_cap={GLOBAL_CAP_REQUESTS}")
                break
            if error_tracker.should_stop():
                stop_reason = "error_rate_stop"
                print(f"  ERROR RATE STOP: rate={error_tracker.rate():.2%} >= {ERROR_RATE_STOP:.0%}"
                      f" (total={error_tracker.total})")
                break

            parent_norm = parent["parent_phrase_norm"]
            parent_raw  = parent["parent_phrase_raw"]
            origin_seed = parent["origin_seed"]
            d0_raw_pos  = parent["parent_depth0_raw_position"]
            p_pos       = parent["parent_position"]

            this_d1_idx = d1_query_count
            sc, phrases, err, lat = fetch_suggest(opener, gl, hl, parent_norm)
            market_requests += 1
            global_requests += 1
            d1_query_count  += 1
            error_tracker.record(sc, err)

            # Cap children per parent request
            phrases        = phrases[:MAX_DEPTH1_CHILDREN_PER_PARENT]
            d1_suggest_raw += len(phrases)

            # Dedup a pocitani novych frazi
            new_cnt = 0
            dup_cnt = 0
            for idx, phrase in enumerate(phrases):
                pn = normalize(phrase)
                if pn in seen:
                    dup_cnt      += 1
                    dup_intra_d1 += 1
                    continue
                seen.add(pn)
                new_cnt += 1
                d1_rows.append({
                    "run_id":             run_id,
                    "pilot_id":           pilot_id,
                    "source":             "google",
                    "gl":                 gl,
                    "hl":                 hl,
                    "depth":              1,
                    "seed_prefix":        origin_seed,
                    "parent_phrase_raw":  parent_raw,
                    "parent_phrase_norm": parent_norm,
                    "phrase_raw":         phrase,
                    "phrase_norm":        pn,
                    "raw_position":       idx,
                })

            d1_new_count += new_cnt
            # is_dead_branch = zadna nova fraze po dedupu (vcetne HTTP erroru a prazdnych odpovedi)
            is_dead = (new_cnt == 0)
            if is_dead:
                dead_branches += 1

            sc_label = str(sc) if sc is not None else "ERR"
            print(f"    d1 [{this_d1_idx}] '{parent_norm}':"
                  f" {sc_label}, ret={len(phrases)}, new={new_cnt},"
                  f" dup={dup_cnt}, dead={is_dead}, lat={lat}ms")

            pq_rows.append({
                "run_id":                    run_id,
                "pilot_id":                  pilot_id,
                "source":                    "google",
                "gl":                        gl,
                "hl":                        hl,
                "parent_phrase_raw":         parent_raw,
                "parent_phrase_norm":        parent_norm,
                "origin_seed":               origin_seed,
                "parent_position":           p_pos,
                "parent_depth0_raw_position": d0_raw_pos,
                "request_index":             this_d1_idx,
                "status_code":               sc,
                "latency_ms":                lat,
                "error":                     err,
                "returned_count":            len(phrases),
                "new_phrase_count":          new_cnt,
                "duplicate_count":           dup_cnt,
                "is_dead_branch":            is_dead,
            })

            time.sleep(random.uniform(*PAUSE_BETWEEN_SEEDS))

        # Uloz depth-1 a parent queries
        db_upsert_suggestions(d1_rows)
        db_insert_parent_queries(pq_rows)

        # Finalni status
        if stop_reason == "error_rate_stop":
            final_status = "aborted_error_rate"
            failed_markets += 1
        elif cap_hit:
            final_status = "completed_cap_hit"
        else:
            final_status = "completed"

        dup_intra_total = dup_intra_d0 + dup_intra_d1
        req_count_total = d0_query_count + d1_query_count

        update_run_row(run_id, {
            "request_count":        req_count_total,
            "depth0_query_count":   d0_query_count,
            "depth1_query_count":   d1_query_count,
            "depth0_suggest_count": d0_suggest_raw,
            "depth1_suggest_count": d1_suggest_raw,
            "new_phrase_count":     d1_new_count,
            "dup_intra_count":      dup_intra_total,
            "dup_db_count":         0,
            "dead_branch_count":    dead_branches,
            "http_200_count":       error_tracker.http_200,
            "http_error_count":     error_tracker.http_err,
            "timeout_count":        error_tracker.timeouts,
            "error_rate":           error_tracker.rate(),
            "cap_hit":              cap_hit,
            "status":               final_status,
            "stop_reason":          stop_reason,
            "finished_at":          utcnow(),
        })

        print(f"\n  {gl}/{hl} done: {req_count_total} req"
              f", d0_unique={d0_unique_count}, d1_new={d1_new_count}"
              f", dead={dead_branches}, err_rate={error_tracker.rate():.2%}"
              f", status={final_status}")

        market_summaries.append({
            "gl":                gl,
            "hl":                hl,
            "run_id":            run_id,
            "exit_cc":           exit_cc,
            "status":            final_status,
            "requests":          req_count_total,
            "d0_unique":         d0_unique_count,
            "d1_parents_selected": len(parents),
            "d1_queried":        d1_query_count,
            "d1_new":            d1_new_count,
            "dead_branches":     dead_branches,
            "error_rate":        error_tracker.rate(),
        })

        time.sleep(random.uniform(*PAUSE_BETWEEN_MARKETS))

    # -----------------------------------------------------------------------
    # Souhrn
    # -----------------------------------------------------------------------
    print(f"\n{'='*65}")
    print(f"  SOUHRN PHASE 2A PILOT  |  pilot_id={pilot_id}")
    print(f"{'='*65}")
    for s in market_summaries:
        print(
            f"  {s['gl']}/{s['hl']}: exit={s['exit_cc']}"
            f" d0={s['d0_unique']} d1_sel={s['d1_parents_selected']}"
            f" d1_q={s['d1_queried']} d1_new={s['d1_new']}"
            f" dead={s['dead_branches']} err={s['error_rate']:.2%}"
            f" status={s['status']}"
        )
    total_d0   = sum(s.get("d0_unique",          0) for s in market_summaries)
    total_sel  = sum(s.get("d1_parents_selected",0) for s in market_summaries)
    total_q    = sum(s.get("d1_queried",          0) for s in market_summaries)
    total_d1   = sum(s.get("d1_new",              0) for s in market_summaries)
    total_dead = sum(s.get("dead_branches",        0) for s in market_summaries)
    print(f"  Celkem: global_req={global_requests}"
          f" d0_unique={total_d0} d1_sel={total_sel}"
          f" d1_queried={total_q} d1_new={total_d1} dead={total_dead}")
    print(f"{'='*65}")

    write_summary(pilot_id, started_at, market_summaries, global_requests,
                  "phase-2a-pilot-summary.json")

    print(f"\n  OK: Phase 2A pilot dokoncen. pilot_id={pilot_id}")
    print(f"{'='*65}")


if __name__ == "__main__":
    main()
