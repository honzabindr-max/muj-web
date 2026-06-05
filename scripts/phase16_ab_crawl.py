#!/usr/bin/env python3
"""
Phase 1.6 Geo A/B Test -- CLEAN vs CONTROL, artifact-only.

Metodika:
  CLEAN  leg: sticky country-matched proxy (IPRoyal _country-XX_session-ID_lifetime-10m)
  CONTROL leg: global rotating proxy (IPRoyal base URL, bez country/session/lifetime)
  Oba legs: 7 trhu x 14 seedu = 98 req kazdy, interleaved per market (min temporal gap).

DULEZITE: Zadne DB operace. Zadne SUPABASE_* env vars.
  Tento skript se NEDOTYKA:
    - google_suggestions_v3 (NEPI SE ani NECTEME)
    - google_suggestions_v2 (NEPI SE ani NECTEME)
    - crawler_control (nedotykame se)
    - google_crawler_state (nedotykame se)
  Vystup: pouze GitHub Actions artifacts (CSV, MD, JSON).

Env vars:
  PROXY_URL    -- IPRoyal rotating proxy (base credentials), povinny
  DRY_RUN      -- 'true' = jen IP checks pro oba legs, zadne Google requesty
  V3_AB_ABORT  -- 'true' = okamzity exit
"""
import csv, io, json, os, random, re, statistics, string, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------
PROXY_URL = os.environ.get("PROXY_URL", "")
DRY_RUN   = os.environ.get("DRY_RUN", "false").lower() in ("true", "1", "yes")
ABORT     = os.environ.get("V3_AB_ABORT", "false").lower() in ("true", "1", "yes")

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"
IP_API_URL  = "http://ip-api.com/json/?fields=country,countryCode,query"

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

LIFETIME_MIN            = 10
PAUSE_BETWEEN_SEEDS     = (0.8, 1.5)
PAUSE_BETWEEN_LEGS      = (2.0, 3.0)   # mezi CLEAN a CONTROL v ramci marketu
PAUSE_BETWEEN_MARKETS   = (2.0, 4.0)
PAUSE_DRY_RUN_CHECKS    = (3.0, 5.0)   # mezi IP checks v dry_run (ip-api rate limit)
IP_CHECK_RETRIES        = 3
IP_CHECK_RETRY_PAUSE    = 4.0

# Primary seed group per seed -- pro CSV a report
PRIMARY_GROUP = {
    "a": "single_char",      "b": "single_char",    "s": "single_char",
    "jak": "language_specific", "wie": "language_specific",
    "apple": "global_brand", "youtube": "global_brand", "amazon": "global_brand",
    "ai": "benchmark_core",  "how": "benchmark_core", "best": "benchmark_core",
    "de": "benchmark_core",  "kf": "benchmark_core",  "0o": "benchmark_core",
}


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
        p = urllib.parse.urlparse(url)
        pwd = p.password or ""
        country_m  = re.search(r'_country-([a-z]{2,3})', pwd)
        lifetime_m = re.search(r'(_lifetime-\w+)', pwd)
        country_s  = f"_country-{country_m.group(1)}" if country_m else ""
        lifetime_s = lifetime_m.group(1) if lifetime_m else ""
        suffix     = f"{country_s}_session-***{lifetime_s}" if country_s else "[global-rotating]"
        return f"{p.scheme}://{p.username}:****{suffix}@{p.hostname}:{p.port}"
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


def _build_global_url():
    """Global rotating proxy -- bez country/session/lifetime parametru."""
    if not PROXY_URL:
        return None
    scheme, user, base_pwd, host, port = _parse_proxy(PROXY_URL)
    base_clean = re.split(r'_country-', base_pwd)[0]
    enc_user   = urllib.parse.quote(user, safe="%")
    enc_pwd    = urllib.parse.quote(base_clean, safe="%")
    return f"{scheme}://{enc_user}:{enc_pwd}@{host}:{port}"


def sticky_opener(country_code, session_id):
    url = _build_sticky_url(country_code, session_id)
    if url is None:
        print("  WARNING: PROXY_URL neni nastaven -- pouzivam direct connection")
        return urllib.request.build_opener()
    print(f"  [sticky] {_safe_label(url)}")
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": url, "https": url})
    )


def global_opener():
    url = _build_global_url()
    if url is None:
        print("  WARNING: PROXY_URL neni nastaven -- pouzivam direct connection")
        return urllib.request.build_opener()
    print(f"  [global] {_safe_label(url)}")
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": url, "https": url})
    )


def rand_session(prefix="ab16"):
    return prefix + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


# ---------------------------------------------------------------------------
# IP check
# ---------------------------------------------------------------------------
def check_ip(opener, label=""):
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
# Phrase normalizace (stejna logika jako SQL v2 a v3_pilot_crawl.py)
# ---------------------------------------------------------------------------
def normalize(phrase):
    return re.sub(r'\s+', ' ', phrase).strip().lower()


# ---------------------------------------------------------------------------
# Crawl jednoho legu (CLEAN nebo CONTROL) pro jeden market
# Zadne DB operace.
# ---------------------------------------------------------------------------
def crawl_leg(market, leg_name, opener, exit_cc):
    gl  = market["gl"]
    hl  = market["hl"]
    req_country = market["requested_country"]

    country_match = (exit_cc.upper() == req_country.upper()
                     and exit_cc not in ("error", "?"))

    seed_results = {}
    req_count    = 0

    for seed in SEED_PREFIXES:
        sc, suggs, err, lat = fetch_suggest(opener, gl, hl, seed)
        req_count += 1
        sc_label = str(sc) if sc is not None else "ERR"
        print(f"  [{leg_name}] {gl}/{hl} '{seed}': {sc_label}, {len(suggs)} suggs, {lat}ms")

        normalized = [normalize(p) for p in suggs]
        seed_results[seed] = {
            "status_code": sc,
            "error":       err,
            "phrases":     normalized,
            "positions":   {phrase: idx for idx, phrase in enumerate(normalized)},
        }

        time.sleep(random.uniform(*PAUSE_BETWEEN_SEEDS))

    return {
        "leg":           leg_name,
        "gl":            gl,
        "hl":            hl,
        "exit_cc":       exit_cc,
        "country_match": country_match,
        "req_count":     req_count,
        "seed_results":  seed_results,
    }


# ---------------------------------------------------------------------------
# A/B metriky per seed
# ---------------------------------------------------------------------------
def _top_k_overlap(clean_phrases, control_phrases, k):
    top_c    = set(clean_phrases[:k])
    top_ctrl = set(control_phrases[:k])
    if not top_c or not top_ctrl:
        return None
    return round(len(top_c & top_ctrl) / k, 4)


def compute_ab_metrics(clean_result, control_result, market, ab_id):
    gl          = market["gl"]
    hl          = market["hl"]
    clean_cc    = clean_result["exit_cc"]
    control_cc  = control_result["exit_cc"]
    rows        = []

    for seed in SEED_PREFIXES:
        c_data   = clean_result["seed_results"].get(seed, {})
        ctrl_data = control_result["seed_results"].get(seed, {})

        c_phrases    = c_data.get("phrases", [])
        ctrl_phrases = ctrl_data.get("phrases", [])
        c_sc         = c_data.get("status_code")
        ctrl_sc      = ctrl_data.get("status_code")

        c_ok    = (c_sc == 200 and len(c_phrases) > 0)
        ctrl_ok = (ctrl_sc == 200 and len(ctrl_phrases) > 0)

        if not c_ok and not ctrl_ok:
            notes      = "both_err"
            comparable = False
        elif not c_ok:
            notes      = "clean_err"
            comparable = False
        elif not ctrl_ok:
            notes      = "control_err"
            comparable = False
        else:
            notes      = ""
            comparable = True

        if comparable:
            c_set      = set(c_phrases)
            ctrl_set   = set(ctrl_phrases)
            inter      = c_set & ctrl_set
            union      = c_set | ctrl_set
            inter_n    = len(inter)
            union_n    = len(union)
            jaccard    = round(inter_n / union_n, 4) if union_n else 1.0
            c_in_ctrl  = round(inter_n / len(c_set),    4) if c_set    else 0.0
            ctrl_in_c  = round(inter_n / len(ctrl_set), 4) if ctrl_set else 0.0
            top3       = _top_k_overlap(c_phrases, ctrl_phrases, 3)
            top5       = _top_k_overlap(c_phrases, ctrl_phrases, 5)

            c_pos    = c_data.get("positions", {})
            ctrl_pos = ctrl_data.get("positions", {})
            shared   = list(inter)
            deltas   = [abs(c_pos[p] - ctrl_pos[p]) for p in shared
                        if p in c_pos and p in ctrl_pos]
            med_delta = round(statistics.median(deltas), 2) if deltas else None

            c_only     = [p for p in c_phrases    if p not in ctrl_set]
            ctrl_only  = [p for p in ctrl_phrases if p not in c_set]
        else:
            inter_n = union_n = 0
            jaccard = c_in_ctrl = ctrl_in_c = None
            top3 = top5 = med_delta = None
            c_only = ctrl_only = []

        rows.append({
            "ab_id":                 ab_id,
            "gl":                    gl,
            "hl":                    hl,
            "seed":                  seed,
            "seed_group":            PRIMARY_GROUP.get(seed, "other"),
            "clean_exit_cc":         clean_cc,
            "control_exit_cc":       control_cc,
            "clean_count":           len(c_phrases),
            "control_count":         len(ctrl_phrases),
            "intersection_count":    inter_n,
            "union_count":           union_n,
            "jaccard":               jaccard,
            "clean_in_control":      c_in_ctrl,
            "control_in_clean":      ctrl_in_c,
            "top3_overlap":          top3,
            "top5_overlap":          top5,
            "median_pos_delta":      med_delta,
            "clean_only_count":      len(c_only),
            "control_only_count":    len(ctrl_only),
            "clean_only_examples":   c_only[:5],
            "control_only_examples": ctrl_only[:5],
            "comparable":            comparable,
            "clean_status":          c_sc,
            "control_status":        ctrl_sc,
            "notes":                 notes,
        })

    return rows


# ---------------------------------------------------------------------------
# Agregace pro report (median per market / seed group)
# ---------------------------------------------------------------------------
def _median_or_none(values):
    vals = [v for v in values if v is not None]
    return round(statistics.median(vals), 4) if vals else None


def _market_summary(ab_rows, gl, hl):
    rows  = [r for r in ab_rows if r["gl"] == gl and r["hl"] == hl and r["comparable"]]
    return {
        "comparable_count":       len(rows),
        "median_jaccard":         _median_or_none([r["jaccard"]           for r in rows]),
        "median_clean_in_ctrl":   _median_or_none([r["clean_in_control"]  for r in rows]),
        "median_control_in_clean":_median_or_none([r["control_in_clean"]  for r in rows]),
        "median_top3":            _median_or_none([r["top3_overlap"]       for r in rows]),
        "median_top5":            _median_or_none([r["top5_overlap"]       for r in rows]),
    }


def _group_summary(ab_rows, group):
    rows = [r for r in ab_rows if r["seed_group"] == group and r["comparable"]]
    return {
        "comparable_count":     len(rows),
        "median_jaccard":       _median_or_none([r["jaccard"]          for r in rows]),
        "median_clean_in_ctrl": _median_or_none([r["clean_in_control"] for r in rows]),
    }


# ---------------------------------------------------------------------------
# Zapis artifaktu
# ---------------------------------------------------------------------------
CSV_COLS = [
    "ab_id", "gl", "hl", "seed", "seed_group", "clean_exit_cc", "control_exit_cc",
    "clean_count", "control_count", "intersection_count", "union_count",
    "jaccard", "clean_in_control", "control_in_clean",
    "top3_overlap", "top5_overlap", "median_pos_delta",
    "clean_only_count", "control_only_count",
    "comparable", "clean_status", "control_status",
    "clean_only_examples", "control_only_examples", "notes",
]


def write_csv(ab_rows, path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS, extrasaction="ignore")
        w.writeheader()
        for row in ab_rows:
            flat = dict(row)
            flat["clean_only_examples"]   = "|".join(row.get("clean_only_examples",   []))
            flat["control_only_examples"] = "|".join(row.get("control_only_examples", []))
            w.writerow(flat)
    print(f"  OK CSV zapsan: {path} ({len(ab_rows)} radku)")


def write_markdown(ab_rows, market_summaries, run_meta, path):
    now_str  = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    ab_id    = run_meta["ab_id"]
    started  = run_meta.get("started_at", "?")[:19] + "Z"

    lines = [
        "# Phase 1.6 — Geo A/B Test Report",
        "",
        f"**ab_id:** `{ab_id}`",
        f"**datum:** {now_str}",
        f"**started_at:** {started}",
        "**CLEAN proxy:** country-matched sticky (IPRoyal `_country-XX_session-ID_lifetime-10m`)",
        "**CONTROL proxy:** global rotating (IPRoyal base URL, bez country targeting)",
        "",
        "---",
        "",
        "## Metodicka poznamka",
        "",
        "- CLEAN leg: sticky proxy nucene do cílové země → reprezentuje geo-specifické výsledky.",
        "- CONTROL leg: global rotating proxy bez country targeting → baseline bez geo signálu.",
        "- Oba legs fetchují stejné seedy na stejném trhu back-to-back (min temporal gap ~60-90s).",
        "- Comparable = oba legs vratily HTTP 200 a alespon 1 frázi.",
        "- not_comparable = error/timeout/403/prazdna odpoved; vylouceno z agreagaci.",
        "- **Jaccard** = |CLEAN ∩ CONTROL| / |CLEAN ∪ CONTROL|",
        "- **clean_in_control** = |∩| / |CLEAN| -- jaka cast geo-navrhů existuje i bez targetingu",
        "- **control_in_clean** = |∩| / |CONTROL| -- jaka cast globalních navrhů je geo-specifická",
        "",
        "---",
        "",
        "## IP Check",
        "",
        "| Market | CLEAN exit_cc | CLEAN match? | CONTROL exit_cc |",
        "|--------|--------------|--------------|-----------------|",
    ]

    for ms in market_summaries:
        gl         = ms["gl"]
        hl         = ms["hl"]
        c_cc       = ms.get("clean_exit_cc", "?")
        ctrl_cc    = ms.get("control_exit_cc", "?")
        req        = ms.get("requested_country", "?")
        match_ok   = (c_cc.upper() == req.upper() and c_cc not in ("error", "?"))
        match_str  = "✓" if match_ok else "MISMATCH"
        status     = ms.get("status", "?")
        if status == "ip_mismatch_clean":
            lines.append(f"| {gl}/{hl} | {c_cc} | MISMATCH — skip | — |")
        else:
            lines.append(f"| {gl}/{hl} | {c_cc} | {match_str} | {ctrl_cc} |")

    lines += [
        "",
        "---",
        "",
        "## SET Overlap per Market (comparable seeds)",
        "",
        "| Market | Comparable | Median Jaccard | Median clean_in_ctrl | Median top3 | Median top5 |",
        "|--------|-----------|----------------|---------------------|-------------|-------------|",
    ]

    for ms in market_summaries:
        gl   = ms["gl"]
        hl   = ms["hl"]
        if ms.get("status") == "ip_mismatch_clean":
            lines.append(f"| {gl}/{hl} | — | — | — | — | — |")
            continue
        agg = _market_summary(ab_rows, gl, hl)
        n   = agg["comparable_count"]
        lines.append(
            f"| {gl}/{hl} | {n}/{len(SEED_PREFIXES)} "
            f"| {agg['median_jaccard'] or 'n/a'} "
            f"| {agg['median_clean_in_ctrl'] or 'n/a'} "
            f"| {agg['median_top3'] or 'n/a'} "
            f"| {agg['median_top5'] or 'n/a'} |"
        )

    lines += [
        "",
        "---",
        "",
        "## Seed Group Analysis",
        "",
        "| Group | Comparable | Median Jaccard | Median clean_in_ctrl |",
        "|-------|-----------|----------------|---------------------|",
    ]
    for group in ("single_char", "language_specific", "global_brand", "benchmark_core"):
        agg = _group_summary(ab_rows, group)
        lines.append(
            f"| {group} | {agg['comparable_count']} "
            f"| {agg['median_jaccard'] or 'n/a'} "
            f"| {agg['median_clean_in_ctrl'] or 'n/a'} |"
        )

    lines += ["", "---", "", "## Per-Market Detail", ""]

    for ms in market_summaries:
        gl   = ms["gl"]
        hl   = ms["hl"]
        c_cc = ms.get("clean_exit_cc", "?")
        ctrl_cc = ms.get("control_exit_cc", "?")
        lines += [
            f"### {gl}/{hl}  (CLEAN exit_cc={c_cc}, CONTROL exit_cc={ctrl_cc})",
            "",
            "| Seed | Group | clean | ctrl | ∩ | Jaccard | clean_in_ctrl | top3 | top5 | Δpos | status |",
            "|------|-------|-------|------|---|---------|----------------|------|------|------|--------|",
        ]
        market_rows = [r for r in ab_rows if r["gl"] == gl and r["hl"] == hl]
        clean_only_notable   = []
        control_only_notable = []

        for r in market_rows:
            seed  = r["seed"]
            group = r["seed_group"]
            if r["comparable"]:
                row_str = (
                    f"| `{seed}` | {group} "
                    f"| {r['clean_count']} | {r['control_count']} "
                    f"| {r['intersection_count']} "
                    f"| {r['jaccard']:.4f} "
                    f"| {r['clean_in_control']:.4f} "
                    f"| {r['top3_overlap'] if r['top3_overlap'] is not None else '—'} "
                    f"| {r['top5_overlap'] if r['top5_overlap'] is not None else '—'} "
                    f"| {r['median_pos_delta'] if r['median_pos_delta'] is not None else '—'} "
                    f"| OK |"
                )
                if r["clean_only_examples"]:
                    clean_only_notable.append((seed, r["clean_only_examples"]))
                if r["control_only_examples"]:
                    control_only_notable.append((seed, r["control_only_examples"]))
            else:
                row_str = (
                    f"| `{seed}` | {group} | — | — | — | — | — | — | — | — "
                    f"| not_comparable: {r['notes']} |"
                )
            lines.append(row_str)

        if clean_only_notable:
            lines += ["", "**Notable clean_only (geo-specific fraze):**"]
            for seed, examples in clean_only_notable[:5]:
                lines.append(f"- `{seed}`: {', '.join(examples)}")

        if control_only_notable:
            lines += ["", "**Notable control_only (globalní fraze):**"]
            for seed, examples in control_only_notable[:5]:
                lines.append(f"- `{seed}`: {', '.join(examples)}")

        lines.append("")

    lines += [
        "---",
        "",
        "## Zaver",
        "",
        "*(Doplnit rucne po interpretaci vysledku.)*",
        "",
        "---",
        "",
        "*Report vygenerovan automaticky phase16_ab_crawl.py.*",
    ]

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  OK Markdown zapsan: {path}")


def write_json_summary(ab_rows, market_summaries, run_meta, path):
    markets_out = []
    for ms in market_summaries:
        gl   = ms["gl"]
        hl   = ms["hl"]
        agg  = _market_summary(ab_rows, gl, hl)
        markets_out.append({
            "gl":                   gl,
            "hl":                   hl,
            "requested_country":    ms.get("requested_country", "?"),
            "clean_exit_cc":        ms.get("clean_exit_cc", "?"),
            "control_exit_cc":      ms.get("control_exit_cc", "?"),
            "status":               ms.get("status", "?"),
            "comparable_seeds":     agg["comparable_count"],
            "median_jaccard":       agg["median_jaccard"],
            "median_clean_in_ctrl": agg["median_clean_in_ctrl"],
            "median_top3":          agg["median_top3"],
            "median_top5":          agg["median_top5"],
            "err_seeds_clean":      ms.get("err_seeds_clean", []),
            "err_seeds_control":    ms.get("err_seeds_control", []),
        })

    seed_groups_out = {}
    for group in ("single_char", "language_specific", "global_brand", "benchmark_core"):
        seed_groups_out[group] = _group_summary(ab_rows, group)

    summary = {
        "ab_id":                   run_meta["ab_id"],
        "started_at":              run_meta.get("started_at", "?"),
        "dry_run":                 DRY_RUN,
        "markets_count":           len(MARKETS),
        "seeds_count":             len(SEED_PREFIXES),
        "total_rows":              len(ab_rows),
        "total_comparable":        sum(1 for r in ab_rows if r["comparable"]),
        "total_not_comparable":    sum(1 for r in ab_rows if not r["comparable"]),
        "markets":                 markets_out,
        "seed_groups":             seed_groups_out,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    print(f"  OK JSON summary zapsan: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if ABORT:
        print("V3_AB_ABORT=true -- okamzity exit.")
        sys.exit(0)

    started_at = datetime.now(timezone.utc).isoformat()
    ab_id      = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))

    print(f"\n{'='*60}")
    print(f"  PHASE 1.6 GEO A/B TEST  |  ab_id={ab_id}  |  {started_at[:19]}Z")
    print(f"  dry_run={DRY_RUN}  |  markets={len(MARKETS)}  |  seeds={len(SEED_PREFIXES)}")
    print("  DB:                    zadne DB operace (artifact-only)")
    print("  CRAWLER_CONTROL:       nedotykame se.")
    print("  GOOGLE_CRAWLER_STATE:  nedotykame se.")
    print(f"{'='*60}\n")

    if not PROXY_URL:
        print("STOP: PROXY_URL neni nastaven.")
        sys.exit(1)

    # Maskuj base heslo proxy v GHA
    try:
        _, _, base_pwd, _, _ = _parse_proxy(PROXY_URL)
        base_clean = re.split(r'_country-', base_pwd)[0]
        mask_gha(base_clean)
    except Exception:
        pass

    # -----------------------------------------------------------------------
    # DRY RUN -- pouze IP checks pro oba legs
    # -----------------------------------------------------------------------
    if DRY_RUN:
        print("=== DRY RUN: IP checks pro CLEAN (sticky) a CONTROL (global) ===\n")
        dry_results = []

        for market in MARKETS:
            gl          = market["gl"]
            hl          = market["hl"]
            req_country = market["requested_country"]
            print(f"--- {gl}/{hl} (expected country: {req_country}) ---")

            # CLEAN leg IP check
            session_id   = rand_session(f"ab16c{ab_id[:3]}")
            c_opener     = sticky_opener(req_country.lower(), session_id)
            c_ip, c_cc   = check_ip(c_opener, f"clean/{gl}")
            c_match      = (c_cc.upper() == req_country.upper()
                            and c_cc not in ("error", "?"))
            c_status     = "ip_ok" if c_match else "ip_mismatch"
            print(f"  [dry-run/CLEAN] {c_status}: exit_cc={c_cc}, expected={req_country}")

            time.sleep(random.uniform(*PAUSE_DRY_RUN_CHECKS))

            # CONTROL leg IP check
            ctrl_opener    = global_opener()
            ctrl_ip, ctrl_cc = check_ip(ctrl_opener, f"ctrl/{gl}")
            ctrl_ok        = ctrl_cc not in ("error", "?")
            ctrl_status    = "ip_ok" if ctrl_ok else "ip_error"
            print(f"  [dry-run/CTRL]  {ctrl_status}: exit_cc={ctrl_cc}")

            dry_results.append({
                "gl": gl, "hl": hl, "requested_country": req_country,
                "clean_exit_cc": c_cc,   "clean_status": c_status,
                "control_exit_cc": ctrl_cc, "control_status": ctrl_status,
            })

            time.sleep(random.uniform(*PAUSE_DRY_RUN_CHECKS))

        print(f"\n{'='*60}")
        print("  DRY RUN SOUHRN")
        print(f"{'='*60}")
        print(f"  {'Market':<10} {'CLEAN':>8} {'Match?':>8} {'CONTROL':>10}")
        print(f"  {'-'*40}")
        for r in dry_results:
            match_s = "OK" if r["clean_status"] == "ip_ok" else "MISMATCH"
            print(f"  {r['gl']}/{r['hl']:<6} {r['clean_exit_cc']:>8} {match_s:>8} {r['control_exit_cc']:>10}")
        print(f"{'='*60}")

        failed_clean   = [r for r in dry_results if r["clean_status"] != "ip_ok"]
        failed_control = [r for r in dry_results if r["control_status"] != "ip_ok"]

        if failed_clean:
            print(f"\n  WARNING: CLEAN IP mismatch u {len(failed_clean)} trhu: "
                  + ", ".join(f"{r['gl']}/{r['hl']}={r['clean_exit_cc']}" for r in failed_clean))
        if failed_control:
            print(f"\n  WARNING: CONTROL IP error u {len(failed_control)} trhu: "
                  + ", ".join(f"{r['gl']}/{r['hl']}" for r in failed_control))

        if failed_clean or failed_control:
            print("\n  EXIT 1: dry_run neproslo. Oprav proxy konfiguraci pred ostrym behem.")
            sys.exit(1)

        print("\n  OK: vsechny IP checks prosly. Zadny Google request, zadny DB zapis.")
        print("  Spust znovu s DRY_RUN=false pro ostry A/B sber.")
        return

    # -----------------------------------------------------------------------
    # PRODUCTION RUN
    # -----------------------------------------------------------------------
    print("=== OSTRY BEH: CLEAN + CONTROL back-to-back per market ===\n")
    ab_rows          = []
    market_summaries = []

    for market in MARKETS:
        gl          = market["gl"]
        hl          = market["hl"]
        req_country = market["requested_country"]
        print(f"\n{'='*50}")
        print(f"  MARKET: {gl}/{hl}  (expected: {req_country})")
        print(f"{'='*50}")

        # === CLEAN LEG ===
        print(f"\n  [CLEAN leg]")
        session_id = rand_session(f"ab16c{ab_id[:3]}")
        c_opener   = sticky_opener(req_country.lower(), session_id)
        c_ip, c_cc = check_ip(c_opener, f"clean/{gl}")

        c_match = (c_cc.upper() == req_country.upper() and c_cc not in ("error", "?"))
        if not c_match:
            print(f"  SKIP {gl}/{hl}: CLEAN IP mismatch (exit={c_cc}, expected={req_country})")
            market_summaries.append({
                "gl": gl, "hl": hl, "requested_country": req_country,
                "clean_exit_cc": c_cc, "control_exit_cc": "—",
                "status": "ip_mismatch_clean",
                "err_seeds_clean": [], "err_seeds_control": [],
            })
            time.sleep(random.uniform(*PAUSE_BETWEEN_MARKETS))
            continue

        clean_result = crawl_leg(market, "clean", c_opener, c_cc)
        time.sleep(random.uniform(*PAUSE_BETWEEN_LEGS))

        # === CONTROL LEG ===
        print(f"\n  [CONTROL leg]")
        ctrl_opener        = global_opener()
        ctrl_ip, ctrl_cc   = check_ip(ctrl_opener, f"ctrl/{gl}")
        if ctrl_cc in ("error", "?"):
            print(f"  WARNING: CONTROL IP check failed pro {gl}/{hl} -- pokracuji, fraze mohou chybet")

        control_result = crawl_leg(market, "control", ctrl_opener, ctrl_cc)

        # === A/B METRIKY (in memory) ===
        market_rows = compute_ab_metrics(clean_result, control_result, market, ab_id)
        ab_rows.extend(market_rows)

        err_c    = [s for s in SEED_PREFIXES
                    if clean_result["seed_results"].get(s, {}).get("status_code") != 200]
        err_ctrl = [s for s in SEED_PREFIXES
                    if control_result["seed_results"].get(s, {}).get("status_code") != 200]
        comp_n   = sum(1 for r in market_rows if r["comparable"])

        print(f"\n  {gl}/{hl}: CLEAN={clean_result['req_count']} req, "
              f"CONTROL={control_result['req_count']} req, "
              f"comparable={comp_n}/{len(SEED_PREFIXES)}")
        if err_c:
            print(f"  WARNING CLEAN err_seeds: {err_c}")
        if err_ctrl:
            print(f"  WARNING CONTROL err_seeds: {err_ctrl}")

        market_summaries.append({
            "gl": gl, "hl": hl, "requested_country": req_country,
            "clean_exit_cc":    c_cc,
            "control_exit_cc":  ctrl_cc,
            "status":           "completed",
            "comparable_seeds": comp_n,
            "err_seeds_clean":  err_c,
            "err_seeds_control":err_ctrl,
        })

        time.sleep(random.uniform(*PAUSE_BETWEEN_MARKETS))

    # === SOUHRN ===
    print(f"\n{'='*60}")
    print("  SOUHRN A/B BEHU")
    print(f"{'='*60}")
    total_comp   = sum(1 for r in ab_rows if r["comparable"])
    total_not    = sum(1 for r in ab_rows if not r["comparable"])
    for ms in market_summaries:
        status = ms.get("status", "?")
        if status == "ip_mismatch_clean":
            print(f"  {ms['gl']}/{ms['hl']}: SKIP (clean IP mismatch: {ms['clean_exit_cc']})")
        else:
            agg = _market_summary(ab_rows, ms["gl"], ms["hl"])
            print(
                f"  {ms['gl']}/{ms['hl']}: clean={ms['clean_exit_cc']}, "
                f"ctrl={ms['control_exit_cc']}, "
                f"comparable={agg['comparable_count']}/{len(SEED_PREFIXES)}, "
                f"median_jac={agg['median_jaccard']}, "
                f"median_c_in_ctrl={agg['median_clean_in_ctrl']}"
            )
    print(f"  Celkem: {total_comp} comparable, {total_not} not_comparable")
    print(f"{'='*60}")

    # === WRITE ARTIFACTS ===
    run_meta = {"ab_id": ab_id, "started_at": started_at}
    write_csv(ab_rows,          "phase-1-6-geo-ab-results.csv")
    write_markdown(ab_rows, market_summaries, run_meta, "phase-1-6-geo-ab-results.md")
    write_json_summary(ab_rows, market_summaries, run_meta, "phase-1-6-geo-ab-summary.json")

    print(f"\n  OK: vsechny artifakty zapsany. ab_id={ab_id}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
