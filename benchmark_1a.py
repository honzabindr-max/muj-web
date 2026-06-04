#!/usr/bin/env python3
"""
Benchmark 1A -- Forenzni test integrity dat.
Gatekeeper otazka: meni exit-IP zeme Google suggest vysledky pro stejne gl/hl/prefix?

Varianty:
  A      = produkcni chovani (per-request global rotating proxy, stejne headers jako crawler.py)
  C      = sticky country-matched IP, jinak STEJNE headers jako A
  D-lite = STEJNA sticky session jako C, browser-like UA + Accept-Language
  E      = bez proxy (runner IP) -- volitelny sanity check

Spusteni: python benchmark_1a.py
Env vars: SUPABASE_URL, SUPABASE_KEY, PROXY_URL, [DRY_RUN=false], [SKIP_E=false]
"""
import hashlib, json, os, random, statistics, string, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
PROXY_URL    = os.environ.get("PROXY_URL", "")
DRY_RUN      = os.environ.get("DRY_RUN", "false").lower() in ("true", "1", "yes")
SKIP_E       = os.environ.get("SKIP_E", "false").lower() in ("true", "1", "yes")

SUGGEST_URL  = "https://suggestqueries.google.com/complete/search"
IP_API_URL   = "http://ip-api.com/json/?fields=country,countryCode,query"
BENCH_TABLE  = "suggest_benchmark_runs"
CTRL_TABLE   = "crawler_control"

MARKETS = [
    {"gl": "cz", "hl": "cs"},
    {"gl": "de", "hl": "de"},
    {
        "gl": "ad", "hl": "ca",
        "fallbacks": [
            {"gl": "es", "hl": "ca"},
            {"gl": "es", "hl": "es"},
            {"gl": "fr", "hl": "fr"},
        ],
    },
]

PREFIXES = ["a", "ai", "how", "best", "de", "kf", "apple", "0o"]

UA_PROD = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
UA_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

ACCEPT_DLITE = {
    "cs": "cs-CZ,cs;q=0.9,en;q=0.8",
    "de": "de-DE,de;q=0.9,en;q=0.8",
    "ca": "ca-AD,ca;q=0.9,es;q=0.8",
    "es": "es-ES,es;q=0.9,en;q=0.8",
    "fr": "fr-FR,fr;q=0.9,en;q=0.8",
}


def accept_prod(hl):
    return f"{hl},en;q=0.5"


# ---------------------------------------------------------------------------
# Supabase helper
# ---------------------------------------------------------------------------
def db_req(method, path, data=None, extra=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        if DRY_RUN:
            print(f"  [dry-run] DB {method} /{path}")
        return None
    url = SUPABASE_URL.rstrip("/") + "/rest/v1/" + path
    body = json.dumps(data).encode() if data is not None else None
    hdrs = {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
    }
    if extra:
        hdrs.update(extra)
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode()
            return json.loads(text) if text.strip() else None
    except urllib.error.HTTPError as e:
        print(f"  WARNING DB HTTP {e.code}: {e.read().decode()[:120]}")
        return None
    except Exception as e:
        print(f"  WARNING DB error: {e}")
        return None


def db_insert(row):
    if DRY_RUN:
        print(f"  [dry-run] INSERT {row['variant']} {row['gl']}/{row['hl']} '{row['prefix']}'")
        return
    db_req("POST", BENCH_TABLE, row, {"Prefer": "return=minimal"})


# ---------------------------------------------------------------------------
# Proxy helpers
# ---------------------------------------------------------------------------
def parse_proxy(proxy_url):
    p = urllib.parse.urlparse(proxy_url)
    return p.scheme, p.username or "", p.password or "", p.hostname or "", p.port or 12321


def base_username(username):
    for suf in ("_country-", "_session-", "_lifetime-"):
        idx = username.find(suf)
        if idx >= 0:
            return username[:idx]
    return username


def rotating_opener():
    if not PROXY_URL:
        return urllib.request.build_opener()
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": PROXY_URL, "https": PROXY_URL})
    )


def sticky_opener(country, session_id, lifetime_min=10):
    if not PROXY_URL:
        return urllib.request.build_opener(), "direct"
    scheme, user, pwd, host, port = parse_proxy(PROXY_URL)
    buser = base_username(user)
    new_user = f"{buser}_country-{country}_session-{session_id}_lifetime-{lifetime_min}m"
    sticky_url = f"{scheme}://{new_user}:{pwd}@{host}:{port}"
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": sticky_url, "https": sticky_url})
    )
    return opener, sticky_url


def direct_opener():
    return urllib.request.build_opener()


def rand_session(prefix="bm"):
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


# ---------------------------------------------------------------------------
# IP check
# ---------------------------------------------------------------------------
def check_ip(opener, label=""):
    try:
        req = urllib.request.Request(IP_API_URL, headers={"User-Agent": UA_PROD})
        with opener.open(req, timeout=10) as r:
            d = json.loads(r.read().decode())
            ip = d.get("query", "?")
            cc = d.get("countryCode", "?")
            print(f"    [{label}] exit: {ip} ({cc})")
            return ip, cc
    except Exception as e:
        print(f"    [{label}] IP check error: {e}")
        return "error", "error"


# ---------------------------------------------------------------------------
# Google suggest fetch
# ---------------------------------------------------------------------------
def fetch_suggest(opener, gl, hl, prefix, ua, accept_lang):
    params = urllib.parse.urlencode({"client": "firefox", "q": prefix, "hl": hl, "gl": gl})
    url = SUGGEST_URL + "?" + params
    req = urllib.request.Request(url, headers={
        "User-Agent": ua,
        "Accept": "application/json",
        "Accept-Language": accept_lang,
    })
    t0 = time.time()
    try:
        with opener.open(req, timeout=10) as r:
            lat = int((time.time() - t0) * 1000)
            d = json.loads(r.read().decode())
            suggs = d[1] if isinstance(d, list) and len(d) >= 2 else []
            return 200, suggs, None, lat, url
    except urllib.error.HTTPError as e:
        lat = int((time.time() - t0) * 1000)
        return e.code, [], f"HTTP {e.code}", lat, url
    except Exception as e:
        lat = int((time.time() - t0) * 1000)
        return None, [], str(e)[:200], lat, url


def resp_hash(suggs):
    return hashlib.sha256(
        json.dumps(suggs, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()[:16]


# ---------------------------------------------------------------------------
# KROK A: crawler_control
# ---------------------------------------------------------------------------
def read_ctrl():
    rows = db_req(
        "GET",
        f"{CTRL_TABLE}?id=eq.1&select=stop_flag,stop_reason,stopped_at,cooldown_until",
    )
    return rows[0] if isinstance(rows, list) and rows else None


def set_stop_flag(reason):
    now = datetime.now(timezone.utc).isoformat()
    db_req(
        "PATCH",
        f"{CTRL_TABLE}?id=eq.1",
        {"stop_flag": True, "stop_reason": reason, "stopped_at": now},
        {"Prefer": "return=minimal"},
    )


def restore_ctrl(orig):
    if orig is None:
        print("  WARNING KROK Z: puvodni stav nebyl nacten -- obnovu nelze provest")
        return
    db_req(
        "PATCH",
        f"{CTRL_TABLE}?id=eq.1",
        {
            "stop_flag":      orig["stop_flag"],
            "stop_reason":    orig["stop_reason"],
            "stopped_at":     orig["stopped_at"],
            "cooldown_until": orig["cooldown_until"],
        },
        {"Prefer": "return=minimal"},
    )
    print(
        f"  OK KROK Z: obnoveno -- "
        f"stop_flag={orig['stop_flag']}, reason='{orig['stop_reason']}'"
    )


# ---------------------------------------------------------------------------
# KROK 0: proxy country targeting test
# ---------------------------------------------------------------------------
def test_country(country_code, label, n=3):
    """Overi sticky session pro danou zemi. Vraci (ok, exit_ip, exit_cc)."""
    sid = rand_session("bmt")
    opener, _ = sticky_opener(country_code, sid)
    ips, ccs = [], []
    for i in range(n):
        ip, cc = check_ip(opener, f"{label} {i+1}/{n}")
        ips.append(ip)
        ccs.append(cc)
        if i < n - 1:
            time.sleep(0.5)
    ok = (
        all(c.lower() == country_code.lower() for c in ccs)
        and "error" not in ips
    )
    if ok:
        sticky = "konzistentni" if len(set(ips)) == 1 else "rotuje v ramci country"
        print(f"  OK {label}: country={ccs[0]}, IP {sticky}")
    else:
        print(f"  FAIL {label}: countries={ccs}, ips={ips}")
    return ok, ips[0] if ips else "?", ccs[0] if ccs else "?"


def krok0_proxy_test():
    """Vraci seznam resolved marketu nebo None pokud CZ/DE failnou."""
    if not PROXY_URL:
        print("  WARNING PROXY_URL neni nastaven -- country targeting nelze testovat")
        print("  Pro benchmark bez proxy bezi jen varianta E (zadne A/C/D-lite)")
        return [
            {"gl": "cz", "hl": "cs", "country_code": "cz", "fallback": False},
            {"gl": "de", "hl": "de", "country_code": "de", "fallback": False},
            {"gl": "ad", "hl": "ca", "country_code": "ad", "fallback": False},
        ]

    print("\n=== KROK 0: Proxy country targeting ===")
    resolved = []

    print("\n  Testuji CZ sticky (3 requesty na ip-api.com)...")
    ok_cz, _, _ = test_country("cz", "CZ")
    if not ok_cz:
        print("  STOP: CZ targeting nefunguje -- benchmark nelze provest.")
        return None

    print("\n  Testuji DE sticky (3 requesty na ip-api.com)...")
    ok_de, _, _ = test_country("de", "DE")
    if not ok_de:
        print("  STOP: DE targeting nefunguje -- benchmark nelze provest.")
        return None

    resolved.append({"gl": "cz", "hl": "cs", "country_code": "cz", "fallback": False})
    resolved.append({"gl": "de", "hl": "de", "country_code": "de", "fallback": False})

    # AD + fallbacky v poradi
    ad_candidates = [
        {"gl": "ad", "hl": "ca", "country_code": "ad"},
        {"gl": "es", "hl": "ca", "country_code": "es"},
        {"gl": "es", "hl": "es", "country_code": "es"},
        {"gl": "fr", "hl": "fr", "country_code": "fr"},
    ]
    ad_resolved = None
    for cand in ad_candidates:
        cc = cand["country_code"]
        lbl = f"{cand['gl']}/{cand['hl']}"
        print(f"\n  Testuji {lbl} sticky ({cc.upper()})...")
        ok, _, _ = test_country(cc, lbl)
        if ok:
            is_fallback = cand["gl"] != "ad" or cand["hl"] != "ca"
            ad_resolved = {**cand, "fallback": is_fallback}
            if is_fallback:
                print(f"  WARNING AD/ca nedostupne -- fallback: {cand['gl']}/{cand['hl']}")
            break

    if ad_resolved is None:
        print("  WARNING Zadny AD/fallback nefunguje -- pokracuji s 2 trhy (CZ+DE)")
    else:
        resolved.append(ad_resolved)

    return resolved


# ---------------------------------------------------------------------------
# Analyza: Jaccard + ranked similarity
# ---------------------------------------------------------------------------
MAIN_PAIRS = [("A", "C"), ("A", "D-lite"), ("C", "D-lite")]


def jaccard(a, b):
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0


def ranked_sim(a, b):
    common = set(a) & set(b)
    if not common:
        return 0.0
    max_len = max(len(a), len(b))
    pos_a = {s: i for i, s in enumerate(a)}
    pos_b = {s: i for i, s in enumerate(b)}
    diffs = [abs(pos_a[s] - pos_b[s]) / max_len for s in common]
    return 1.0 - (sum(diffs) / len(diffs))


def analyze(all_rows, resolved_markets):
    """
    all_rows: dict {(gl, hl, prefix, variant): row_dict}
    Vraci (pair_rows_list, pair_results_dict).
    """
    combos = set()
    for gl, hl, prefix, _ in all_rows:
        combos.add((gl, hl, prefix))

    pair_rows = []
    # Collect all variant pairs including E if present
    variants_present = set(v for _, _, _, v in all_rows)
    all_pairs = list(MAIN_PAIRS)
    for v in ("E",):
        if v in variants_present:
            for main_v in ("A", "C", "D-lite"):
                if main_v in variants_present:
                    all_pairs.append((main_v, v))

    stats = {
        p: {"jac_vals": [], "rsim_vals": [], "not_comparable": 0}
        for p in all_pairs
    }
    per_market = {p: {} for p in all_pairs}

    for gl, hl, prefix in sorted(combos):
        for var_l, var_r in all_pairs:
            rl = all_rows.get((gl, hl, prefix, var_l))
            rr = all_rows.get((gl, hl, prefix, var_r))
            if rl is None or rr is None:
                continue

            ok_l = rl.get("status_code") == 200
            ok_r = rr.get("status_code") == 200
            comparable = ok_l and ok_r

            sl = rl.get("suggestions") or []
            sr = rr.get("suggestions") or []
            sa, sb = set(sl), set(sr)
            inter = sa & sb
            union = sa | sb

            jac_val  = jaccard(sl, sr) if comparable else None
            rsim_val = ranked_sim(sl, sr) if comparable else None

            pair_rows.append({
                "run_id":                  rl.get("run_id", ""),
                "created_at":              rl.get("created_at", ""),
                "variant_left":            var_l,
                "variant_right":           var_r,
                "gl":                      gl,
                "hl":                      hl,
                "prefix":                  prefix,
                "status_left":             rl.get("status_code"),
                "status_right":            rr.get("status_code"),
                "comparable":              comparable,
                "set_jaccard":             round(jac_val, 4)  if jac_val  is not None else None,
                "ranked_similarity":       round(rsim_val, 4) if rsim_val is not None else None,
                "suggestions_left_count":  len(sl),
                "suggestions_right_count": len(sr),
                "intersection_count":      len(inter),
                "union_count":             len(union),
                "exit_country_left":       rl.get("exit_country", ""),
                "exit_country_right":      rr.get("exit_country", ""),
                "latency_left_ms":         rl.get("latency_ms"),
                "latency_right_ms":        rr.get("latency_ms"),
            })

            pair_key = (var_l, var_r)
            mkt_label = f"{gl}/{hl}"
            if comparable:
                stats[pair_key]["jac_vals"].append(jac_val)
                stats[pair_key]["rsim_vals"].append(rsim_val)
                per_market[pair_key].setdefault(mkt_label, []).append(jac_val)
            else:
                stats[pair_key]["not_comparable"] += 1

    results = {}
    total_possible = len(PREFIXES) * len(resolved_markets)
    for pair_key in all_pairs:
        jv = stats[pair_key]["jac_vals"]
        rv = stats[pair_key]["rsim_vals"]
        nc = stats[pair_key]["not_comparable"]
        comp = len(jv)
        med_jac  = statistics.median(jv) if jv else None
        med_rsim = statistics.median(rv) if rv else None
        per_mkt  = {}
        for mkt, vals in per_market[pair_key].items():
            per_mkt[mkt] = statistics.median(vals) if vals else None
        results[pair_key] = {
            "median_jaccard":    med_jac,
            "median_ranked":     med_rsim,
            "comparable_count":  comp,
            "not_comparable":    nc,
            "total_possible":    total_possible,
            "per_market_median": per_mkt,
        }

    return pair_rows, results


def decision_band(med_jac):
    if med_jac is None:
        return "insufficient comparable data"
    if med_jac >= 0.95:
        return ">=0.95 -- dataset pravdepodobne cisty (IP nevadi kvalite)"
    elif med_jac >= 0.85:
        return "0.85-0.95 -- pouzitelny opatrne; doporucit sticky country-matched sber"
    elif med_jac >= 0.70:
        return "0.70-0.85 -- noisy/exploratory; NEpouzivat jako presny market signal"
    else:
        return "<0.70 -- STOP deep crawl; zvazit restart s konzistentni metodikou"


def get_decision(pair_results, pair_key, resolved_markets):
    r = pair_results.get(pair_key, {})
    comp = r.get("comparable_count", 0)
    total = r.get("total_possible", len(PREFIXES) * len(resolved_markets))
    if comp < total * 0.5:
        return "insufficient comparable data"
    return decision_band(r.get("median_jaccard"))


# ---------------------------------------------------------------------------
# Variant stats
# ---------------------------------------------------------------------------
def variant_stats(all_rows):
    stats = {}
    for (_, _, _, variant), row in all_rows.items():
        s = stats.setdefault(variant, {"total": 0, "ok200": 0, "rate403": 0, "error": 0})
        s["total"] += 1
        sc = row.get("status_code")
        if sc == 200:
            s["ok200"] += 1
        elif sc == 403:
            s["rate403"] += 1
        else:
            s["error"] += 1
    return stats


# ---------------------------------------------------------------------------
# Vystup: CSV + MD
# ---------------------------------------------------------------------------
CSV_COLS = [
    "run_id", "created_at", "variant_left", "variant_right",
    "gl", "hl", "prefix", "status_left", "status_right",
    "comparable", "set_jaccard", "ranked_similarity",
    "suggestions_left_count", "suggestions_right_count",
    "intersection_count", "union_count",
    "exit_country_left", "exit_country_right",
    "latency_left_ms", "latency_right_ms",
]


def write_csv(pair_rows):
    def fmt(v):
        if v is None:
            return ""
        if isinstance(v, bool):
            return str(v).lower()
        return str(v)

    lines = [",".join(CSV_COLS)]
    for row in pair_rows:
        lines.append(",".join(fmt(row.get(c)) for c in CSV_COLS))
    with open("benchmark_results.csv", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("  OK benchmark_results.csv zapsan")


def write_md(
    run_id, resolved_markets, pair_results, pair_rows,
    all_rows, fallback_used, proxy_test_summary, total_requests,
):
    vstats = variant_stats(all_rows)

    # Treti trh label (AD nebo fallback)
    third_label = f"{resolved_markets[2]['gl']}/{resolved_markets[2]['hl']}" if len(resolved_markets) > 2 else None

    lines = [
        "# Benchmark 1A -- Vysledky",
        "",
        f"**run_id:** `{run_id}`",
        f"**datum:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "---",
        "",
        "## Pouzite trhy",
    ]
    for m in resolved_markets:
        fb = " *(fallback)*" if m.get("fallback") else ""
        lines.append(f"- `{m['gl']}/{m['hl']}`{fb}")

    lines += [
        "",
        "## Varianty",
        "- **A** = produkcni chovani, per-request global rotating proxy",
        "- **C** = sticky country-matched IP, produkcni headers",
        "- **D-lite** = stejna sticky session jako C, browser UA + Accept-Language",
    ]
    e_run = "E" in {v for _, _, _, v in all_rows}
    lines.append("- **E** = bez proxy (runner IP) -- sanity check" if e_run else "- **E** = skipped")

    if fallback_used:
        lines += ["", f"**Fallback za AD/ca:** pouzit `{fallback_used}`"]

    lines += [
        "",
        "## KROK 0 -- Vysledek proxy testu",
        proxy_test_summary,
        "",
        f"## Pocet requestu: {total_requests}",
        "",
        "### Pocty dle varianty",
        "",
        "| Varianta | Total | HTTP 200 | 403 | Chyba |",
        "|----------|-------|----------|-----|-------|",
    ]
    for v in sorted(vstats):
        s = vstats[v]
        lines.append(
            f"| {v} | {s['total']} | {s['ok200']} | {s['rate403']} | {s['error']} |"
        )

    # Jaccard tabulka
    mkt_headers = ["cz/cs", "de/de", third_label or "—"]
    lines += [
        "",
        "## Median SET overlap (Jaccard)",
        "",
        f"| Dvojice | Celkem | {mkt_headers[0]} | {mkt_headers[1]} | {mkt_headers[2]} | not_comparable |",
        f"|---------|--------|{'-'*len(mkt_headers[0])}-|{'-'*len(mkt_headers[1])}-|{'-'*len(mkt_headers[2])}-|----------------|",
    ]
    for pair_key in MAIN_PAIRS:
        r = pair_results.get(pair_key, {})
        med = r.get("median_jaccard")
        pm  = r.get("per_market_median", {})
        nc  = r.get("not_comparable", 0)
        med_s = f"{med:.4f}" if med is not None else "n/a"
        def pm_s(lbl):
            v = pm.get(lbl)
            return f"{v:.4f}" if v is not None else "--"
        lines.append(
            f"| {pair_key[0]} vs {pair_key[1]} | {med_s} | "
            f"{pm_s('cz/cs')} | {pm_s('de/de')} | "
            f"{pm_s(third_label) if third_label else '--'} | {nc} |"
        )

    # Ranked similarity
    lines += [
        "",
        "## Ranked similarity",
        "",
        "| Dvojice | Median |",
        "|---------|--------|",
    ]
    for pair_key in MAIN_PAIRS:
        r = pair_results.get(pair_key, {})
        med = r.get("median_ranked")
        lines.append(f"| {pair_key[0]} vs {pair_key[1]} | {f'{med:.4f}' if med is not None else 'n/a'} |")

    # Rozhodovaci pasmo
    lines += ["", "## Rozhodovaci pasmo", ""]
    for pair_key in [("A", "C"), ("A", "D-lite")]:
        decision = get_decision(pair_results, pair_key, resolved_markets)
        lines.append(f"**{pair_key[0]} vs {pair_key[1]}:** {decision}")

    lines += [
        "",
        "---",
        "",
        "*Tento benchmark nemeni produkcni crawler a nedela produkcni rozhodnuti.*",
    ]

    with open("benchmark_results.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("  OK benchmark_results.md zapsan")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    run_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    now_iso = datetime.now(timezone.utc).isoformat()

    print(f"\n{'='*60}")
    print(f"  BENCHMARK 1A  |  run_id={run_id}  |  {now_iso[:19]}Z")
    print(f"  dry_run={DRY_RUN}  |  proxy={'SET' if PROXY_URL else 'NOT SET'}")
    print(f"  skip_e={SKIP_E}")
    print(f"{'='*60}")

    original_ctrl = None

    try:
        # --- KROK A: nacti + zastav produkci -----------------------------------
        print("\n=== KROK A: crawler_control ===")
        original_ctrl = read_ctrl()
        if original_ctrl:
            print(
                f"  Puvodni stav: stop_flag={original_ctrl['stop_flag']}, "
                f"reason='{original_ctrl['stop_reason']}'"
            )
        else:
            print("  WARNING: crawler_control nelze nacist")

        if not DRY_RUN:
            set_stop_flag("BENCHMARK 1A docasna pauza produkce")
            print("  OK: stop_flag nastaven")
        else:
            print("  [dry-run] stop_flag preskocen")

        # --- KROK 0: proxy country targeting ------------------------------------
        resolved_markets = krok0_proxy_test()
        if resolved_markets is None:
            print("\nZASTAVENO v KROK 0 -- obnova produkce probehne v finally.")
            return

        proxy_test_summary = "OK: " + ", ".join(
            f"{m['gl']}/{m['hl']}" + (" (fallback)" if m.get("fallback") else "")
            for m in resolved_markets
        )
        fallback_used = next(
            (f"{m['gl']}/{m['hl']}" for m in resolved_markets if m.get("fallback")), None
        )

        # --- KROK 3: benchmark requests ----------------------------------------
        variants_label = "A + C + D-lite" + ("" if SKIP_E else " + E")
        print(
            f"\n=== KROK 3: Benchmark "
            f"({len(resolved_markets)} trhy x {len(PREFIXES)} prefixy x [{variants_label}]) ==="
        )

        all_rows = {}  # (gl, hl, prefix, variant) -> row_dict
        request_count = 0

        for market in resolved_markets:
            gl  = market["gl"]
            hl  = market["hl"]
            cc  = market.get("country_code", gl)
            lbl = f"{gl}/{hl}"
            print(f"\n  --- Trh: {lbl} (country_code={cc}) ---")

            # Sdilena sticky session pro C + D-lite
            shared_sid = rand_session(f"bm{run_id[:4]}")
            shared_op, _ = sticky_opener(cc, shared_sid)

            # Exit IP pro C+D-lite (jednou za trh)
            print(f"    Zjistuji exit IP pro C+D-lite session ({shared_sid})...")
            exit_ip_cd, exit_cc_cd = check_ip(shared_op, f"C+D-lite/{lbl}")

            # Exit IP pro A (rotating -- check jednou za trh jako orientacni)
            if PROXY_URL:
                a_op_check = rotating_opener()
                exit_ip_a, exit_cc_a = check_ip(a_op_check, f"A/{lbl}")
            else:
                exit_ip_a, exit_cc_a = "no-proxy", "--"

            # Exit IP pro E
            exit_ip_e, exit_cc_e = "no-proxy", "--"
            if not SKIP_E:
                e_op_check = direct_opener()
                exit_ip_e, exit_cc_e = check_ip(e_op_check, f"E/{lbl}")

            session_idx = 0  # sdileny index pro C+D-lite (1..16)
            a_idx       = 0  # index pro A (1..8)
            e_idx       = 0  # index pro E (1..8)

            for prefix in PREFIXES:
                # ---- Varianta A ----
                a_idx += 1
                a_op = rotating_opener()
                sc, suggs, err, lat, url = fetch_suggest(
                    a_op, gl, hl, prefix, UA_PROD, accept_prod(hl)
                )
                request_count += 1
                status_char = str(sc) if sc else "ERR"
                print(f"    A  '{prefix}': {status_char}, {len(suggs)} suggs, {lat}ms")
                row_a = {
                    "run_id": run_id, "created_at": now_iso,
                    "variant": "A", "gl": gl, "hl": hl, "prefix": prefix,
                    "request_url": url,
                    "query_params": {"client": "firefox", "q": prefix, "hl": hl, "gl": gl},
                    "exit_ip": exit_ip_a, "exit_country": exit_cc_a,
                    "user_agent": UA_PROD, "accept_language": accept_prod(hl),
                    "session_id": "rotating",
                    "request_index_in_session": a_idx,
                    "status_code": sc, "error_text": err, "latency_ms": lat,
                    "suggestions": suggs, "response_hash": resp_hash(suggs),
                }
                all_rows[(gl, hl, prefix, "A")] = row_a
                db_insert(row_a)

                time.sleep(random.uniform(1.0, 2.0))

                # ---- Varianta C ----
                session_idx += 1
                sc, suggs, err, lat, url = fetch_suggest(
                    shared_op, gl, hl, prefix, UA_PROD, accept_prod(hl)
                )
                request_count += 1
                status_char = str(sc) if sc else "ERR"
                print(f"    C  '{prefix}': {status_char}, {len(suggs)} suggs, {lat}ms")
                row_c = {
                    "run_id": run_id, "created_at": now_iso,
                    "variant": "C", "gl": gl, "hl": hl, "prefix": prefix,
                    "request_url": url,
                    "query_params": {"client": "firefox", "q": prefix, "hl": hl, "gl": gl},
                    "exit_ip": exit_ip_cd, "exit_country": exit_cc_cd,
                    "user_agent": UA_PROD, "accept_language": accept_prod(hl),
                    "session_id": shared_sid,
                    "request_index_in_session": session_idx,
                    "status_code": sc, "error_text": err, "latency_ms": lat,
                    "suggestions": suggs, "response_hash": resp_hash(suggs),
                }
                all_rows[(gl, hl, prefix, "C")] = row_c
                db_insert(row_c)

                time.sleep(random.uniform(0.3, 0.7))

                # ---- Varianta D-lite ----
                session_idx += 1
                dl_accept = ACCEPT_DLITE.get(hl, accept_prod(hl))
                sc, suggs, err, lat, url = fetch_suggest(
                    shared_op, gl, hl, prefix, UA_BROWSER, dl_accept
                )
                request_count += 1
                status_char = str(sc) if sc else "ERR"
                print(f"    D  '{prefix}': {status_char}, {len(suggs)} suggs, {lat}ms")
                row_d = {
                    "run_id": run_id, "created_at": now_iso,
                    "variant": "D-lite", "gl": gl, "hl": hl, "prefix": prefix,
                    "request_url": url,
                    "query_params": {"client": "firefox", "q": prefix, "hl": hl, "gl": gl},
                    "exit_ip": exit_ip_cd, "exit_country": exit_cc_cd,
                    "user_agent": UA_BROWSER, "accept_language": dl_accept,
                    "session_id": shared_sid,
                    "request_index_in_session": session_idx,
                    "status_code": sc, "error_text": err, "latency_ms": lat,
                    "suggestions": suggs, "response_hash": resp_hash(suggs),
                }
                all_rows[(gl, hl, prefix, "D-lite")] = row_d
                db_insert(row_d)

                # ---- Varianta E (optional) ----
                if not SKIP_E:
                    e_idx += 1
                    e_op = direct_opener()
                    sc, suggs, err, lat, url = fetch_suggest(
                        e_op, gl, hl, prefix, UA_PROD, accept_prod(hl)
                    )
                    request_count += 1
                    status_char = str(sc) if sc else "ERR"
                    print(f"    E  '{prefix}': {status_char}, {len(suggs)} suggs, {lat}ms")
                    row_e = {
                        "run_id": run_id, "created_at": now_iso,
                        "variant": "E", "gl": gl, "hl": hl, "prefix": prefix,
                        "request_url": url,
                        "query_params": {"client": "firefox", "q": prefix, "hl": hl, "gl": gl},
                        "exit_ip": exit_ip_e, "exit_country": exit_cc_e,
                        "user_agent": UA_PROD, "accept_language": accept_prod(hl),
                        "session_id": "direct",
                        "request_index_in_session": e_idx,
                        "status_code": sc, "error_text": err, "latency_ms": lat,
                        "suggestions": suggs, "response_hash": resp_hash(suggs),
                    }
                    all_rows[(gl, hl, prefix, "E")] = row_e
                    db_insert(row_e)

                time.sleep(random.uniform(1.0, 2.0))

        print(f"\n  Celkem requestu: {request_count}")

        # --- KROK 4: analyza ---------------------------------------------------
        print("\n=== KROK 4: Analyza ===")
        pair_rows, pair_results = analyze(all_rows, resolved_markets)

        for pair_key in MAIN_PAIRS:
            r = pair_results.get(pair_key, {})
            med = r.get("median_jaccard")
            nc  = r.get("not_comparable", 0)
            comp = r.get("comparable_count", 0)
            print(
                f"  {pair_key[0]} vs {pair_key[1]}: "
                f"Jaccard={f'{med:.4f}' if med is not None else 'n/a'}, "
                f"comparable={comp}, not_comparable={nc}"
            )

        # --- KROK 5: vystup ----------------------------------------------------
        print("\n=== KROK 5: Zapisuji vystupy ===")
        write_csv(pair_rows)
        write_md(
            run_id, resolved_markets, pair_results, pair_rows,
            all_rows, fallback_used, proxy_test_summary, request_count,
        )

        # Shrnuti
        print(f"\n{'='*60}")
        print("  SHRNUTI BENCHMARKU 1A")
        print(f"{'='*60}")
        for pair_key in [("A", "C"), ("A", "D-lite")]:
            r = pair_results.get(pair_key, {})
            med  = r.get("median_jaccard")
            comp = r.get("comparable_count", 0)
            nc   = r.get("not_comparable", 0)
            decision = get_decision(pair_results, pair_key, resolved_markets)
            print(
                f"  {pair_key[0]} vs {pair_key[1]}: "
                f"Jaccard={f'{med:.4f}' if med is not None else 'n/a'} | "
                f"comparable={comp}, not_comparable={nc}"
            )
            print(f"    -> {decision}")
        if fallback_used:
            print(f"  Fallback za AD: {fallback_used}")
        print(f"{'='*60}")

    finally:
        # --- KROK Z: vzdy obnov puvodni stav -----------------------------------
        print("\n=== KROK Z: Obnova crawler_control ===")
        if not DRY_RUN:
            restore_ctrl(original_ctrl)
        else:
            print("  [dry-run] Obnova preskocena")


if __name__ == "__main__":
    main()
