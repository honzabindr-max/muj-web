#!/usr/bin/env python3
"""
Proxy Coverage Audit -- IPRoyal sticky residential per gl.

Testuje kazdy unikatni gl kod z google_markets.yml: zvladne IPRoyal vratit
sticky residential IP ve STEJNE zemi jako gl?

DULEZITE: Zadne Google suggest requesty. Jen IP exit check pres ip-api.com.

Env vars: PROXY_URL (povinny)
Vystup: proxy_country_coverage.csv
"""
import csv, json, os, random, re, string, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("chybi pyyaml -- spust: pip install pyyaml")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Konfigurace
# ---------------------------------------------------------------------------
PROXY_URL   = os.environ.get("PROXY_URL", "")
IP_API_URL  = "http://ip-api.com/json/?fields=country,countryCode,query,status,message"
MARKETS_CFG = os.path.join(os.path.dirname(__file__), "config", "google_markets.yml")
OUTPUT_CSV  = "proxy_country_coverage.csv"

REQUESTS_PER_GL       = 2      # IP requesty per gl (sticky consistency check)
PAUSE_BETWEEN_REQ     = 0.8    # sekundy mezi requesty ve stejne sticky session
PAUSE_BETWEEN_GL      = 1.2    # sekundy mezi ruznyma gl kody
IP_CHECK_TIMEOUT      = 10     # timeout pro jeden ip-api.com request
IP_CHECK_MAX_RETRIES  = 3      # max pokusu pri ip_check_error (rate limit / timeout)
IP_CHECK_RETRY_PAUSE  = 3.0    # pauza pred retryem

# Stop condition: pokud tolik po sobe jdoucich proxy_auth_failed, neco je systemicky spatne
CONSECUTIVE_AUTH_FAIL_LIMIT = 15

# Sloupce CSV -- presne dle specifikace
CSV_COLS = [
    "gl", "country_name", "target_country_code", "market_count_for_gl",
    "markets_for_gl", "iproyal_supported", "exit_ip", "exit_country",
    "sticky_consistent", "test_status", "error_type", "error_message",
    "request_count", "fallback_needed", "fallback_country", "fallback_reason",
    "tier", "notes",
]

UA_PROBE = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Proxy helpers (stejny format jako benchmark_1a.py -- overeno pro CZ/DE/AD)
# ---------------------------------------------------------------------------
def _parse_proxy(proxy_url):
    p = urllib.parse.urlparse(proxy_url)
    return p.scheme, p.username or "", p.password or "", p.hostname or "", p.port or 12321


def _base_pwd(password):
    """Odstrani existujici _country-... suffix z hesla (pokud je)."""
    return re.split(r'_country-', password)[0]


def build_sticky_opener(gl, session_id, lifetime_min=10):
    """
    Sestavi IPRoyal sticky URL ve formatu:
      http://USERNAME:BASE_PASSWORD_country-{gl}_session-{sid}_lifetime-10m@host:port
    """
    scheme, user, full_pwd, host, port = _parse_proxy(PROXY_URL)
    base = _base_pwd(full_pwd)
    new_pwd = f"{base}_country-{gl}_session-{session_id}_lifetime-{lifetime_min}m"
    enc_user = urllib.parse.quote(user, safe="%")
    enc_pwd  = urllib.parse.quote(new_pwd, safe="%")
    url = f"{scheme}://{enc_user}:{enc_pwd}@{host}:{port}"
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": url, "https": url})
    )
    return opener


def rand_session(gl):
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"aud{gl}{suffix}"


# ---------------------------------------------------------------------------
# IP check
# ---------------------------------------------------------------------------
def check_ip_once(opener):
    """
    Jeden request na ip-api.com pres proxy.
    Vraci (exit_ip, exit_country_code, error_type, error_message).
    """
    req = urllib.request.Request(IP_API_URL, headers={"User-Agent": UA_PROBE})
    try:
        with opener.open(req, timeout=IP_CHECK_TIMEOUT) as r:
            d = json.loads(r.read().decode())
            if d.get("status") == "fail":
                return None, None, "ip_check_error", d.get("message", "ip-api fail")
            return d.get("query", "?"), d.get("countryCode", "?"), None, None
    except urllib.error.HTTPError as e:
        if e.code == 407:
            return None, None, "proxy_auth_failed", f"HTTP 407"
        return None, None, "proxy_timeout", f"HTTP {e.code}"
    except Exception as ex:
        return None, None, "ip_check_error", str(ex)[:200]


def check_ip_with_retry(opener, gl, req_num):
    """Retry loop pro ip-api errors (rate limit, transient timeout)."""
    for attempt in range(IP_CHECK_MAX_RETRIES):
        ip, cc, etype, emsg = check_ip_once(opener)
        if etype is None:
            return ip, cc, None, None
        if etype == "proxy_auth_failed":
            # 407 = neni co retryovat, proxy zavrhla auth
            return None, None, etype, emsg
        # ip_check_error nebo proxy_timeout -- retry s backoffem
        if attempt < IP_CHECK_MAX_RETRIES - 1:
            pause = IP_CHECK_RETRY_PAUSE * (attempt + 1)
            print(f"    [{gl} req{req_num}] {etype}: {emsg} -- retry za {pause}s")
            time.sleep(pause)
    return None, None, etype, emsg


# ---------------------------------------------------------------------------
# Nacti markety
# ---------------------------------------------------------------------------
def load_markets():
    """
    Vraci:
      unique_gl dict: {gl -> {"country_name": str, "markets": [gl/hl, ...], "count": int}}
    """
    with open(MARKETS_CFG, encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    enabled = [m for m in raw.get("markets", []) if m.get("enabled", False)]
    unique = {}
    for m in enabled:
        gl = m["gl"]
        hl = m["hl"]
        # Jmeno zeme z notes (napr. "Czech Republic")
        name = m.get("notes", gl)
        if gl not in unique:
            unique[gl] = {"country_name": name, "markets": [], "count": 0}
        unique[gl]["markets"].append(f"{gl}/{hl}")
        unique[gl]["count"] += 1
    return unique


# ---------------------------------------------------------------------------
# Tier logika
# ---------------------------------------------------------------------------
def assign_tier(test_status, sticky_consistent, iproyal_supported):
    """
    Tier A = exact country match + sticky_consistent
    Tier B = proxy auth ok, ale country nesedi nebo jine degradovane
    Tier C = proxy_auth_failed nebo nedostupne
    """
    if test_status == "success_exact" and sticky_consistent:
        return "A"
    if iproyal_supported:
        return "B"
    return "C"


# ---------------------------------------------------------------------------
# Hlavni audit loop
# ---------------------------------------------------------------------------
def run_audit(unique_gl):
    results = []
    consecutive_auth_fail = 0
    total = len(unique_gl)

    for i, (gl, meta) in enumerate(sorted(unique_gl.items()), 1):
        country_name       = meta["country_name"]
        market_count       = meta["count"]
        markets_str        = "|".join(meta["markets"])
        target_cc          = gl.upper()  # target country code = gl uppercase

        print(f"\n  [{i:3d}/{total}] {gl} ({country_name})")

        session_id = rand_session(gl)
        opener     = build_sticky_opener(gl, session_id)

        ips, ccs, errors, etypes = [], [], [], []

        for req_num in range(1, REQUESTS_PER_GL + 1):
            if req_num > 1:
                time.sleep(PAUSE_BETWEEN_REQ)
            ip, cc, etype, emsg = check_ip_with_retry(opener, gl, req_num)
            ips.append(ip)
            ccs.append(cc)
            errors.append(emsg)
            etypes.append(etype)
            if ip:
                print(f"      req{req_num}: {ip} ({cc})")
            else:
                print(f"      req{req_num}: {etype} -- {emsg}")
            # Pri prvnim proxy_auth_failed nema smysl delat dalsi requesty
            if etype == "proxy_auth_failed":
                break

        # Agregace
        valid_ccs = [c for c in ccs if c is not None]
        valid_ips = [ip for ip in ips if ip is not None]
        first_etype = next((e for e in etypes if e is not None), None)
        first_emsg  = next((e for e in errors if e is not None), "")

        iproyal_supported = first_etype != "proxy_auth_failed" and len(valid_ccs) > 0
        exit_ip           = valid_ips[0] if valid_ips else None
        exit_country      = valid_ccs[0] if valid_ccs else None
        request_count     = len([ip for ip in ips if ip is not None or etypes[ips.index(ip)] != "proxy_auth_failed"])

        # Sticky consistency: obe IP ve stejne zemi?
        sticky_consistent = (
            len(valid_ccs) == REQUESTS_PER_GL
            and len(set(valid_ccs)) == 1
        )

        # test_status
        if first_etype == "proxy_auth_failed":
            test_status = "proxy_auth_failed"
        elif first_etype in ("proxy_timeout",):
            test_status = "proxy_timeout"
        elif first_etype == "ip_check_error":
            test_status = "ip_check_error"
        elif not valid_ccs:
            test_status = "unknown_error"
        elif exit_country and exit_country.upper() == target_cc:
            test_status = "success_exact"
        else:
            test_status = "country_mismatch"

        tier = assign_tier(test_status, sticky_consistent, iproyal_supported)

        # Fallback
        fallback_needed  = False
        fallback_country = ""
        fallback_reason  = ""
        if test_status == "country_mismatch" and exit_country:
            fallback_needed  = True
            fallback_country = exit_country
            fallback_reason  = (
                f"IPRoyal vraci {exit_country} misto {target_cc}; "
                f"fallback vyzaduje rucni schvaleni"
            )
        elif test_status in ("proxy_auth_failed", "proxy_timeout", "unknown_error"):
            fallback_needed = True
            fallback_reason = f"Proxy nedostupne ({test_status}); Tier C bez fallbacku"

        # Notes
        notes = ""
        if not sticky_consistent and len(valid_ccs) > 1:
            notes = f"sticky inconsistent: {','.join(valid_ccs)}"
        if first_etype == "ip_check_error":
            notes = (notes + f" ip_check_error: {first_emsg}").strip()

        # Status na stdout
        status_icon = "OK" if tier == "A" else ("~~" if tier == "B" else "XX")
        print(f"      -> {status_icon} Tier {tier} | {test_status} | exit={exit_country}")

        row = {
            "gl":                    gl,
            "country_name":          country_name,
            "target_country_code":   target_cc,
            "market_count_for_gl":   market_count,
            "markets_for_gl":        markets_str,
            "iproyal_supported":     str(iproyal_supported).lower(),
            "exit_ip":               exit_ip or "",
            "exit_country":          exit_country or "",
            "sticky_consistent":     str(sticky_consistent).lower(),
            "test_status":           test_status,
            "error_type":            first_etype or "",
            "error_message":         first_emsg or "",
            "request_count":         sum(1 for ip in ips if ip is not None),
            "fallback_needed":       str(fallback_needed).lower(),
            "fallback_country":      fallback_country,
            "fallback_reason":       fallback_reason,
            "tier":                  tier,
            "notes":                 notes,
        }
        results.append(row)

        # Sleduj po sobe jdouci auth faility
        if test_status == "proxy_auth_failed":
            consecutive_auth_fail += 1
            if consecutive_auth_fail >= CONSECUTIVE_AUTH_FAIL_LIMIT:
                print(f"\n  STOP: {consecutive_auth_fail} po sobe jdoucich proxy_auth_failed.")
                print("  Neco je systemicky spatne s proxy auth nebo formatem URL.")
                print("  Zapis dosavadnich vysledku a zastavuji audit.")
                break
        else:
            consecutive_auth_fail = 0

        time.sleep(PAUSE_BETWEEN_GL)

    return results


# ---------------------------------------------------------------------------
# Vystup
# ---------------------------------------------------------------------------
def write_csv(results):
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS)
        w.writeheader()
        w.writerows(results)
    print(f"\n  OK {OUTPUT_CSV} zapsan ({len(results)} radku)")


def print_summary(results):
    tier_a = [r for r in results if r["tier"] == "A"]
    tier_b = [r for r in results if r["tier"] == "B"]
    tier_c = [r for r in results if r["tier"] == "C"]

    # Pocet gl/hl marketu v kazdem tieru
    def gl_hl_count(rows):
        return sum(int(r["market_count_for_gl"]) for r in rows)

    print(f"\n{'='*60}")
    print(f"  PROXY COVERAGE AUDIT -- SHRNUTI")
    print(f"{'='*60}")
    print(f"  Testovano gl: {len(results)}")
    print(f"  Tier A (exact match): {len(tier_a)} gl / {gl_hl_count(tier_a)} gl/hl marketu")
    print(f"  Tier B (degraded/fallback needed): {len(tier_b)} gl / {gl_hl_count(tier_b)} gl/hl marketu")
    print(f"  Tier C (nedostupne): {len(tier_c)} gl / {gl_hl_count(tier_c)} gl/hl marketu")
    print(f"{'='*60}")

    if tier_a:
        print(f"\n  Tier A gl kody ({len(tier_a)}):")
        for r in sorted(tier_a, key=lambda x: x["gl"]):
            print(f"    {r['gl']:6s}  {r['country_name']}")

    if tier_b:
        print(f"\n  Tier B gl kody ({len(tier_b)}) -- vyzaduji rucni schvaleni:")
        for r in sorted(tier_b, key=lambda x: x["gl"]):
            print(f"    {r['gl']:6s}  {r['country_name']}  -> exit={r['exit_country']}  ({r['test_status']})")

    statuses = {}
    for r in results:
        s = r["test_status"]
        statuses[s] = statuses.get(s, 0) + 1
    print(f"\n  test_status breakdown: {statuses}")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    now = datetime.now(timezone.utc).isoformat()
    print(f"\n{'='*60}")
    print(f"  PROXY COVERAGE AUDIT  |  {now[:19]}Z")
    print(f"  proxy={'SET' if PROXY_URL else 'NOT SET'}")
    print(f"  gl codes to test: 200 (unique enabled gl z markets.yml)")
    print(f"  requests per gl: {REQUESTS_PER_GL} (sticky consistency check)")
    print(f"  ip-api.com: HTTP requests skrz proxy (ne prime requesty runneru)")
    print(f"  ZADNE Google suggest requesty.")
    print(f"{'='*60}")

    if not PROXY_URL:
        print("  STOP: PROXY_URL neni nastaven.")
        sys.exit(1)

    unique_gl = load_markets()
    print(f"\n  Nacten markets.yml: {len(unique_gl)} unikatnich gl")

    results = run_audit(unique_gl)
    write_csv(results)
    print_summary(results)


if __name__ == "__main__":
    main()
