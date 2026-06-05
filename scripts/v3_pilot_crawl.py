#!/usr/bin/env python3
"""
v3 Pilot Crawl -- seed-only clean sber (depth 0), 7 trhu, 14 prefixy.

Metodika: sticky country-matched proxy (IPRoyal) per market, depth 0.
Zapis do suggest_crawler_runs_v3 + google_suggestions_v3.

DULEZITE: Tento skript se NEDOTYKA crawler_control ani google_crawler_state.
Stop logika: GitHub Actions cancel, input abort=true, env V3_PILOT_ABORT.

Env vars (ze GitHub Secrets / workflow env, nikdy hardcoded):
  SUPABASE_URL      -- Supabase REST API URL
  SUPABASE_KEY      -- Service role key pro zapis do v3 tabulek
  PROXY_URL         -- IPRoyal rotating proxy (base credentials)
  DRY_RUN           -- 'true' = jen IP check, zadny Google, zadny DB zapis
  V3_PILOT_ABORT    -- 'true' = okamzity exit bez crawlu
"""
import hashlib, json, os, random, re, statistics, string, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
PROXY_URL    = os.environ.get("PROXY_URL", "")
DRY_RUN      = os.environ.get("DRY_RUN", "false").lower() in ("true", "1", "yes")
ABORT        = os.environ.get("V3_PILOT_ABORT", "false").lower() in ("true", "1", "yes")

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
IP_API_URL  = "http://ip-api.com/json/?fields=country,countryCode,query"

RUNS_TABLE        = "suggest_crawler_runs_v3"
SUGGESTIONS_TABLE = "google_suggestions_v3"
V2_TABLE          = "google_suggestions_v2"

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

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

LIFETIME_MIN          = 10
PAUSE_BETWEEN_SEEDS   = (0.8, 1.5)
PAUSE_BETWEEN_MARKETS = (2.0, 4.0)
# V dry_run rezimu delsi pauza mezi trhy -- ip-api.com ma rate limit ~45 req/min
PAUSE_DRY_RUN_MARKETS = (3.0, 5.0)
IP_CHECK_RETRIES      = 3
IP_CHECK_RETRY_PAUSE  = 4.0
V2_COMPARE_LIMIT      = 5000


# ---------------------------------------------------------------------------
# GHA maskovani
# ---------------------------------------------------------------------------
def mask_gha(value):
    """Registruje hodnotu jako masked v GitHub Actions logu."""
    if value and os.environ.get("GITHUB_ACTIONS"):
        print(f"::add-mask::{value}", flush=True)


# ---------------------------------------------------------------------------
# Proxy helpers -- format overeny v benchmark_1a.py pro CZ/DE/AD
# ---------------------------------------------------------------------------
def _parse_proxy(proxy_url):
    p = urllib.parse.urlparse(proxy_url)
    return p.scheme, p.username or "", p.password or "", p.hostname or "", p.port or 12321


def _safe_label(url):
    """Log label proxy bez hesla. Ukazuje country/lifetime, maskuje password."""
    try:
        p = urllib.parse.urlparse(url)
        user = p.username or ""
        pwd  = p.password or ""
        country_m  = re.search(r'_country-([a-z]{2,3})', pwd)
        lifetime_m = re.search(r'(_lifetime-\w+)', pwd)
        country_s  = f"_country-{country_m.group(1)}" if country_m else "_country-?"
        lifetime_s = lifetime_m.group(1) if lifetime_m else "_lifetime-?"
        return f"{p.scheme}://{user}:****{country_s}_session-***{lifetime_s}@{p.hostname}:{p.port}"
    except Exception:
        return "[proxy label parse error]"


def _build_sticky_url(country_code, session_id):
    """
    Stavi IPRoyal sticky URL.
    Format shodny s benchmark_1a.py (overeny pro CZ/DE/AD):
      http://USER:BASE_PASS_country-XX_session-ID_lifetime-10m@host:port
    country/session/lifetime se pripoji k PASSWORD, username zustava ciste.
    PROXY_URL musi byt ciste rotating URL bez existujicich country parametru.
    """
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


def sticky_opener(country_code, session_id):
    url = _build_sticky_url(country_code, session_id)
    if url is None:
        print("  WARNING: PROXY_URL neni nastaven -- pouzivam direct (bez country targeting)")
        return urllib.request.build_opener()
    print(f"  [sticky] {_safe_label(url)}")
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": url, "https": url})
    )


def rand_session(prefix="v3p"):
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


# ---------------------------------------------------------------------------
# IP check
# ---------------------------------------------------------------------------
def check_ip(opener, label=""):
    """
    IP check pres ip-api.com s retry logikou.
    ip-api.com ma rate limit ~45 req/min -- pri prazdne odpovedi zkousime znovu.
    """
    for attempt in range(1, IP_CHECK_RETRIES + 1):
        try:
            req = urllib.request.Request(IP_API_URL, headers={"User-Agent": UA})
            with opener.open(req, timeout=15) as r:
                raw = r.read().decode().strip()
                if not raw:
                    raise ValueError("prazdna odpoved ip-api.com")
                d   = json.loads(raw)
                ip  = d.get("query", "?")
                cc  = d.get("countryCode", "?")
                # Exit IP nikdy nevypisujeme v plaintextu -- jen countryCode
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
        "User-Agent": UA,
        "Accept": "application/json",
        "Accept-Language": f"{hl},en;q=0.5",
    })
    t0 = time.time()
    try:
        with opener.open(req, timeout=15) as r:
            lat  = int((time.time() - t0) * 1000)
            data = json.loads(r.read().decode())
            suggs = data[1] if isinstance(data, list) and len(data) >= 2 else []
            return 200, suggs, None, lat
    except urllib.error.HTTPError as e:
        lat = int((time.time() - t0) * 1000)
        return e.code, [], f"HTTP {e.code}", lat
    except Exception as e:
        lat = int((time.time() - t0) * 1000)
        return None, [], str(e)[:200], lat


# ---------------------------------------------------------------------------
# Phrase normalizace
# Stejna logika jako SQL v2: lower(btrim(regexp_replace(phrase, '\s+', ' ', 'g')))
# Poradi operaci: regexp_replace -> btrim -> lower
# Python ekvivalent: re.sub(\s+ -> ' ') -> strip() -> lower()
# ---------------------------------------------------------------------------
def normalize(phrase):
    return re.sub(r'\s+', ' ', phrase).strip().lower()


# ---------------------------------------------------------------------------
# DB helpers (PostgREST, shodny styl jako benchmark_1a.py)
# ---------------------------------------------------------------------------
def _db_req(method, path, data=None, extra_headers=None):
    if DRY_RUN:
        print(f"  [dry-run] DB {method} /{path}")
        return None
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("  WARNING: SUPABASE_URL nebo SUPABASE_KEY neni nastaven")
        return None
    url  = SUPABASE_URL.rstrip("/") + "/rest/v1/" + path
    body = json.dumps(data).encode() if data is not None else None
    hdrs = {
        "apikey":        SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type":  "application/json",
    }
    if extra_headers:
        hdrs.update(extra_headers)
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode()
            return json.loads(text) if text.strip() else True
    except urllib.error.HTTPError as e:
        print(f"  WARNING DB HTTP {e.code}: {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  WARNING DB error: {e}")
        return False


def db_insert_run(row):
    _db_req("POST", RUNS_TABLE, row, {"Prefer": "return=minimal"})


def db_update_run(run_id, updates):
    path = f"{RUNS_TABLE}?crawler_run_id=eq.{urllib.parse.quote(run_id)}"
    _db_req("PATCH", path, updates, {"Prefer": "return=minimal"})


def db_insert_suggestions(rows):
    """
    Batch insert s ON CONFLICT DO NOTHING pres PostgREST resolution=ignore-duplicates.
    Deduplikuje na UNIQUE(source, gl, hl, phrase_norm).
    on_conflict musi byt URL query param (ne HTTP header) -- PostgREST requirement.
    Vraci True pri uspechu, False pri DB chybe.
    """
    path = f"{SUGGESTIONS_TABLE}?on_conflict=source,gl,hl,phrase_norm"
    result = _db_req(
        "POST", path, rows,
        {"Prefer": "return=minimal,resolution=ignore-duplicates"},
    )
    return result is not False


# ---------------------------------------------------------------------------
# Sber jednoho marketu
# ---------------------------------------------------------------------------
def crawl_market(market, run_id, session_id, opener, exit_ip, exit_cc):
    gl          = market["gl"]
    hl          = market["hl"]
    req_country = market["requested_country"]
    now_iso     = datetime.now(timezone.utc).isoformat()

    country_match        = (exit_cc.upper() == req_country.upper()
                            and exit_cc not in ("error", "?"))
    country_match_status = "exact_match" if country_match else "unknown"
    collection_quality   = "clean"       if country_match else "noisy"

    exit_ip_hash    = (hashlib.sha256(exit_ip.encode()).hexdigest()
                       if exit_ip not in ("error", "?") else None)
    session_id_hash = hashlib.sha256(session_id.encode()).hexdigest()

    run_row = {
        "crawler_run_id":       run_id,
        "started_at":           now_iso,
        "source":               "google",
        "collection_method":    "google_suggest",
        "proxy_mode":           "sticky_country_matched",
        "requested_gl":         gl,
        "requested_hl":         hl,
        "requested_country":    req_country,
        "exit_country":         exit_cc if exit_cc not in ("error", "?") else None,
        "country_match_status": country_match_status,
        "collection_quality":   collection_quality,
        "exit_ip_hash":         exit_ip_hash,
        "session_id_hash":      session_id_hash,
        "request_count":        0,
        "status":               "running",
    }
    db_insert_run(run_row)

    if not country_match:
        print(f"  MISMATCH {gl}/{hl}: exit={exit_cc}, expected={req_country} -- SKIP suggestions")
        db_update_run(run_id, {
            "status":      "failed",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "notes":       f"exit_country mismatch: got {exit_cc}, expected {req_country}",
        })
        return {"status": "failed", "requests": 0, "inserted": 0, "seed_results": {}}

    all_suggestions = []
    req_count       = 0
    seed_results    = {}

    for seed in SEED_PREFIXES:
        sc, suggs, err, lat = fetch_suggest(opener, gl, hl, seed)
        req_count += 1
        sc_label = str(sc) if sc else "ERR"
        print(f"  {gl}/{hl} '{seed}': {sc_label}, {len(suggs)} suggs, {lat}ms")

        seed_results[seed] = {
            "status_code": sc,
            "phrases": [normalize(p) for p in suggs],
        }

        for idx, phrase in enumerate(suggs):
            all_suggestions.append({
                "crawler_run_id": run_id,
                "source":         "google",
                "gl":             gl,
                "hl":             hl,
                "phrase":         phrase,
                "phrase_norm":    normalize(phrase),
                "depth":          0,
                "seed_prefix":    seed,
                "parent_phrase":  None,
                "raw_position":   idx,
            })

        time.sleep(random.uniform(*PAUSE_BETWEEN_SEEDS))

    err_seeds = [s for s in SEED_PREFIXES
                 if seed_results.get(s, {}).get("status_code") != 200]
    if err_seeds:
        print(f"  WARNING: {len(err_seeds)} seedu melo ERR: {err_seeds}")

    db_ok = True
    if all_suggestions:
        db_ok = db_insert_suggestions(all_suggestions)
        if not db_ok:
            print(f"  WARNING: DB insert selhal pro {gl}/{hl} -- market bude oznacen failed")
    else:
        print(f"  WARNING: zadne suggestions pro {gl}/{hl}")
        db_ok = False

    final_status = "completed" if db_ok else "failed"
    notes_parts  = []
    if err_seeds:
        notes_parts.append(f"err_seeds={err_seeds}")
    if not db_ok:
        notes_parts.append("db_insert_failed")

    db_update_run(run_id, {
        "status":        final_status,
        "finished_at":   datetime.now(timezone.utc).isoformat(),
        "request_count": req_count,
        **({"notes": "; ".join(notes_parts)} if notes_parts else {}),
    })

    return {
        "status":       final_status,
        "db_ok":        db_ok,
        "requests":     req_count,
        "inserted":     len(all_suggestions) if db_ok else 0,
        "err_seeds":    err_seeds,
        "seed_results": seed_results,
    }


# ---------------------------------------------------------------------------
# v2 porovnani -- per seed per market
# ---------------------------------------------------------------------------
def fetch_v2_phrases(gl, hl, seed):
    """
    Nacte fraze z v2 pro dany market a seed prefix (LIKE aproximace).
    v2 nema seed_prefix -- filtrujeme phrase_norm LIKE seed%.
    READONLY -- zadny zapis do v2.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return set()
    params = urllib.parse.urlencode({
        "select":      "phrase_norm",
        "gl":          f"eq.{gl}",
        "hl":          f"eq.{hl}",
        "phrase_norm": f"like.{seed}%",
        "limit":       str(V2_COMPARE_LIMIT),
    })
    url = SUPABASE_URL.rstrip("/") + f"/rest/v1/{V2_TABLE}?" + params
    hdrs = {
        "apikey":        SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Accept":        "application/json",
    }
    req = urllib.request.Request(url, headers=hdrs, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            rows = json.loads(r.read().decode())
            return {row["phrase_norm"] for row in rows if row.get("phrase_norm")}
    except Exception as e:
        print(f"  WARNING v2 fetch {gl}/{hl} '{seed}': {e}")
        return set()


def run_comparison(market_results):
    """
    Porovnava v3 clean vs v2 noisy na stejnem seed/market prostoru.
    SET overlap (Jaccard) + v2_presence per seed per market.
    Comparable = oba sety maji >= 1 frazi.
    Error/empty = vylouceno (ne overlap=0).
    Median pres comparable dvojice, ne prumer.
    """
    print("\n=== POROVNANI v3 vs v2 ===")
    results = []

    for market_data in market_results:
        if market_data.get("status") != "completed":
            continue
        gl           = market_data["gl"]
        hl           = market_data["hl"]
        seed_results = market_data.get("seed_results", {})
        market_jacs  = []

        for seed in SEED_PREFIXES:
            v3_phrases = set(seed_results.get(seed, {}).get("phrases", []))
            v3_sc      = seed_results.get(seed, {}).get("status_code")
            v3_ok      = v3_sc == 200

            if not v3_ok or not v3_phrases:
                results.append({
                    "gl": gl, "hl": hl, "seed": seed,
                    "comparable": False,
                    "reason": f"v3_status={v3_sc}",
                })
                continue

            v2_phrases = fetch_v2_phrases(gl, hl, seed)
            v2_count   = len(v2_phrases)

            if not v2_phrases:
                results.append({
                    "gl": gl, "hl": hl, "seed": seed,
                    "comparable": False, "reason": "v2_empty",
                    "v3_count": len(v3_phrases), "v2_count": 0,
                })
                continue

            inter     = v3_phrases & v2_phrases
            union     = v3_phrases | v2_phrases
            jaccard   = len(inter) / len(union) if union else 1.0
            v2_pres   = len(inter) / len(v3_phrases) if v3_phrases else 0.0

            results.append({
                "gl": gl, "hl": hl, "seed": seed,
                "comparable":   True,
                "v3_count":     len(v3_phrases),
                "v2_count":     v2_count,
                "intersection": len(inter),
                "union_count":  len(union),
                "jaccard":      round(jaccard, 4),
                "v2_presence":  round(v2_pres, 4),
                "v2_capped":    v2_count >= V2_COMPARE_LIMIT,
            })
            market_jacs.append(jaccard)

            print(
                f"  {gl}/{hl} '{seed}': v3={len(v3_phrases)}, v2={v2_count}, "
                f"inter={len(inter)}, jac={jaccard:.4f}, v2_pres={v2_pres:.4f}"
                + (" [v2 capped]" if v2_count >= V2_COMPARE_LIMIT else "")
            )

        if market_jacs:
            print(f"  => {gl}/{hl} median Jaccard (v3 vs v2): {statistics.median(market_jacs):.4f}")

    return results


# ---------------------------------------------------------------------------
# Report (Markdown)
# ---------------------------------------------------------------------------
def write_report(market_results, compare_results, pilot_id, started_at):
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        "# v3 Pilot vs v2 -- Validacni report",
        "",
        f"**pilot_id:** `{pilot_id}`",
        f"**datum:** {now_str}",
        f"**started_at:** {started_at}",
        "",
        "---",
        "",
        "## Metodicka poznamka",
        "",
        "- **v3** = pilot, 14 seed prefixy, depth 0, sticky country-matched proxy (IPRoyal).",
        "  Kazdy seed vraci max 10 navrhů Google Suggest.",
        "- **v2** = historicky noisy dataset, per-request global rotating proxy, ruzna BFS hloubka.",
        "- Porovnani probiha pouze na srovnatelnem prostoru: stejne gl/hl, stejne seed prefixy.",
        "- v2 nema seed_prefix sloupec -- pouzivame LIKE aproximaci (`phrase_norm LIKE seed||'%'`).",
        "  Pro kratke prefixy (a, b, s) zachycuje sirsi mnozinu nez jen primy seed vysledek.",
        "- Hrube celkove pocty v3 a v2 nejsou symetricke a neslouzi jako dukaz geo-rozdilu.",
        "- **Jaccard** = |v3 ∩ v2| / |v3 ∪ v2| (asymetricke sety -- interpretovat s ohledem na limitace).",
        "- **v2_presence** = |v3 ∩ v2| / |v3| -- jak velka cast v3 frazi je v v2 databazi.",
        "",
        "---",
        "",
        "## Sber per market",
        "",
        "| Market | Status | DB | exit_cc | Requesty | Suggestions (ulozeno) | ERR seeds |",
        "|--------|--------|----|---------|-----------|-----------------------|-----------|",
    ]

    for m in market_results:
        db_status = "OK" if m.get("db_ok", True) else "FAIL"
        err_s     = m.get("err_seeds", [])
        err_label = ", ".join(err_s) if err_s else "—"
        lines.append(
            f"| {m['gl']}/{m['hl']} | {m.get('status','?')} | {db_status} "
            f"| {m.get('exit_cc','?')} | {m.get('requests',0)} "
            f"| {m.get('inserted',0)} | {err_label} |"
        )

    lines += [
        "",
        "## SET overlap: v3 clean vs v2 noisy (per seed)",
        "",
        "| Market | Seed | v3 | v2 | ∩ | Jaccard | v2_presence | Poznamka |",
        "|--------|------|----|----|---|---------|-------------|----------|",
    ]
    for r in compare_results:
        if not r.get("comparable"):
            lines.append(
                f"| {r['gl']}/{r['hl']} | `{r['seed']}` | — | — | — | — | — "
                f"| not_comparable: {r.get('reason','')} |"
            )
        else:
            cap = " [v2 capped]" if r.get("v2_capped") else ""
            lines.append(
                f"| {r['gl']}/{r['hl']} | `{r['seed']}` | {r['v3_count']} "
                f"| {r['v2_count']} | {r['intersection']} "
                f"| {r['jaccard']:.4f} | {r['v2_presence']:.4f} |{cap} |"
            )

    lines += ["", "## Median Jaccard per market (comparable seeds)", ""]
    by_market = {}
    for r in compare_results:
        if r.get("comparable"):
            by_market.setdefault(f"{r['gl']}/{r['hl']}", []).append(r["jaccard"])

    lines += [
        "| Market | Comparable | Median Jaccard | Benchmark #1A A-vs-C |",
        "|--------|-----------|----------------|----------------------|",
    ]
    bm_baseline = {"cz/cs": 0.2500, "de/de": 0.4286, "ad/ca": 0.5385}
    for mkt, vals in sorted(by_market.items()):
        med  = statistics.median(vals) if vals else None
        bm   = bm_baseline.get(mkt)
        bm_s = f"{bm:.4f}" if bm is not None else "—"
        lines.append(
            f"| {mkt} | {len(vals)}/{len(SEED_PREFIXES)} "
            f"| {f'{med:.4f}' if med is not None else 'n/a'} | {bm_s} |"
        )

    lines += [
        "",
        "---",
        "",
        "## Zaver a navrh dalsiho kroku",
        "",
        "*(Doplnit rucne po interpretaci vysledku.)*",
        "",
        "---",
        "",
        "*Report vygenerovan automaticky v3_pilot_crawl.py. Commitovat do docs/ po overeni.*",
    ]

    path = "v3-pilot-vs-v2.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  OK report zapsan: {path}")
    return path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if ABORT:
        print("V3_PILOT_ABORT=true -- okamzity exit.")
        sys.exit(0)

    started_at = datetime.now(timezone.utc).isoformat()
    pilot_id   = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

    print(f"\n{'='*60}")
    print(f"  V3 PILOT  |  pilot_id={pilot_id}  |  {started_at[:19]}Z")
    print(f"  dry_run={DRY_RUN}  |  markets={len(MARKETS)}  |  seeds={len(SEED_PREFIXES)}")
    print("  CRAWLER_CONTROL:       nedotykame se.")
    print("  GOOGLE_CRAWLER_STATE:  nedotykame se.")
    print(f"{'='*60}\n")

    if not PROXY_URL:
        print("STOP: PROXY_URL neni nastaven.")
        sys.exit(1)

    # Maskuj base heslo v GHA (GitHub automaticky maskuje secrets, ale explicitne pro jistotu)
    try:
        _, _, base_pwd, _, _ = _parse_proxy(PROXY_URL)
        base_clean = re.split(r'_country-', base_pwd)[0]
        mask_gha(base_clean)
    except Exception:
        pass
    if SUPABASE_KEY:
        mask_gha(SUPABASE_KEY)

    market_results = []

    for market in MARKETS:
        gl          = market["gl"]
        hl          = market["hl"]
        req_country = market["requested_country"]

        session_id = rand_session(f"v3p{pilot_id[:3]}")
        run_id     = f"{gl}_{hl}_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{pilot_id}"

        print(f"\n--- {gl}/{hl} | country={req_country} | run_id={run_id} ---")

        opener           = sticky_opener(req_country.lower(), session_id)
        exit_ip, exit_cc = check_ip(opener, f"{gl}/{hl}")

        if DRY_RUN:
            match  = (exit_cc.upper() == req_country.upper()
                      and exit_cc not in ("error", "?"))
            status = "ip_ok" if match else "ip_mismatch"
            print(f"  [dry-run] {status}: exit_cc={exit_cc}, expected={req_country}")
            market_results.append({
                "gl": gl, "hl": hl,
                "status":   status,
                "exit_cc":  exit_cc,
                "requests": 0,
                "inserted": 0,
            })
            # Delsi pauza v dry_run rezimu -- ip-api.com rate limit ochrana
            time.sleep(random.uniform(*PAUSE_DRY_RUN_MARKETS))
            continue

        result = crawl_market(market, run_id, session_id, opener, exit_ip, exit_cc)
        market_results.append({
            "gl": gl, "hl": hl, "run_id": run_id,
            "exit_cc": exit_cc,
            **result,
        })

        time.sleep(random.uniform(*PAUSE_BETWEEN_MARKETS))

    # Souhrn
    print(f"\n{'='*60}")
    print("  SOUHRN PILOTU")
    print(f"{'='*60}")
    for m in market_results:
        if DRY_RUN:
            print(f"  {m['gl']}/{m['hl']}: {m['status']} (exit_cc={m['exit_cc']})")
        else:
            db_ok_s   = "DB:OK" if m.get("db_ok", True) else "DB:FAIL"
            err_s     = m.get("err_seeds", [])
            err_label = f", ERR_seeds={err_s}" if err_s else ""
            print(
                f"  {m['gl']}/{m['hl']}: {m.get('status','?')}, "
                f"{db_ok_s}, {m.get('requests',0)} req, "
                f"{m.get('inserted',0)} suggestions{err_label}"
            )
    print(f"{'='*60}")

    if DRY_RUN:
        failed = [m for m in market_results if m["status"] != "ip_ok"]
        if failed:
            print(f"\n  WARNING: {len(failed)} trh(u) neproslo IP checkem: "
                  + ", ".join(f"{m['gl']}/{m['hl']}={m['exit_cc']}" for m in failed))
            sys.exit(1)
        else:
            print("\n  OK: vsechny trhy prosly IP checkem. Zadny Google request, zadny DB zapis.")
        return

    # Ostry beh -- v2 porovnani a report
    compare_results = run_comparison(market_results)
    report_path     = write_report(market_results, compare_results, pilot_id, started_at)

    summary = {
        "pilot_id":      pilot_id,
        "started_at":    started_at,
        "dry_run":       DRY_RUN,
        "markets":       market_results,
        "compare_count": len(compare_results),
        "report_path":   report_path,
    }
    with open("v3_pilot_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    print("  OK v3_pilot_summary.json zapsan")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
