#!/usr/bin/env python3
"""Hetzner 60-market crawl watchdog -> Telegram (notify.py).
Cte /verify endpointy (Bearer), posle 1 zpravu o stavu."""
import os, sys, json, urllib.request, urllib.error
from datetime import datetime, timezone
import notify

BASE = "https://suggest.good-inventions.work"
TOKEN = os.environ["SUGGEST_VERIFY_TOKEN"]
SEED_H = 3  # seed 03:15 UTC; po 03:30 ma novy cyklus existovat

_ISSUE_LABEL = {
    "proxy_unreachable": ("🔴", "Proxy nedostupná (egress 000).\nZkontroluj IPRoyal balík (vyčerpaný traffic?) + auto top-up."),
    "proxy_502":         ("🟠", "Proxy 502 (provider blip). Pokud >2 cykly: session rotation / provider."),
    "proxy_timeout":     ("🟠", "Proxy timeout. Pool kvalita dané země / dočasné."),
    "geo_check_failed":  ("🟠", "Geo check neproběhl (egress country nezjištěn) — NEgeo-mismatch, spíš proxy."),
    "geo_mismatch":      ("🔴", "SKUTEČNÝ geo-mismatch: riziko kontaminace — STOP a prověř proxy_selector."),
}
_ISSUE_ORDER = ["proxy_unreachable", "geo_mismatch", "proxy_502", "proxy_timeout", "geo_check_failed"]


def classify_gm_entry(entry):
    """Klasifikuje jeden záznam z /verify/geo-mismatch.
    Vrací (typ, actual_country, expected_country).
    Bezpečný default: proxy_unreachable — nikdy nepředpokládáme geo_mismatch bez důkazu."""
    if not isinstance(entry, dict):
        return "proxy_unreachable", "", ""

    http_code = 0
    try:
        http_code = int(entry.get("http_status") or entry.get("status_code") or 0)
    except (ValueError, TypeError):
        pass

    actual = str(entry.get("actual_country") or entry.get("egress_country") or "").upper()
    expected = str(entry.get("expected_country") or entry.get("target_country") or "").upper()
    error_msg = str(entry.get("error") or entry.get("message") or "").lower()
    ec = str(entry.get("error_type") or entry.get("classification") or "").lower()

    # Explicitní klasifikace z API
    if ec in ("proxy_unreachable", "egress_000", "connection_refused"):
        return "proxy_unreachable", actual, expected
    if ec == "proxy_502":
        return "proxy_502", actual, expected
    if ec in ("proxy_timeout", "timeout"):
        return "proxy_timeout", actual, expected
    if ec in ("geo_check_failed", "country_unknown"):
        return "geo_check_failed", actual, expected
    if ec == "geo_mismatch":
        return "geo_mismatch", actual, expected

    # Best-effort z HTTP statusu + dostupných polí
    if "timeout" in error_msg or "timed out" in error_msg:
        return "proxy_timeout", actual, expected
    if "refused" in error_msg or "connection" in error_msg:
        return "proxy_unreachable", actual, expected
    if http_code == 502:
        return "proxy_502", actual, expected
    if http_code == 504:
        return "proxy_timeout", actual, expected
    if http_code == 200 and actual and expected and actual != expected:
        return "geo_mismatch", actual, expected
    if http_code == 200 and not actual:
        return "geo_check_failed", actual, expected
    # Fallback: egress selhání → proxy_unreachable, ne geo_mismatch
    return "proxy_unreachable", actual, expected


def _build_geo_alert(gm, total):
    """Sestaví Telegram zprávu pro geo/proxy issues s rozlišením typů."""
    if isinstance(gm, list):
        counts = {}
        geo_example = None
        for entry in gm:
            etype, actual, expected = classify_gm_entry(entry)
            counts[etype] = counts.get(etype, 0) + 1
            if etype == "geo_mismatch" and geo_example is None and actual and expected:
                geo_example = (actual, expected)
        total_issues = len(gm)
    else:
        n = int(gm.get("count", 0)) if isinstance(gm, dict) else 0
        counts = {"proxy_unreachable": n}
        geo_example = None
        total_issues = n

    lines = [f"*Hetzner: crawl issues* ({total_issues} záznamů)", ""]
    for etype in _ISSUE_ORDER:
        n = counts.get(etype, 0)
        if not n:
            continue
        emoji, action = _ISSUE_LABEL[etype]
        label = f"{emoji} *{etype.replace('_', ' ')}* — {n}×"
        if etype == "geo_mismatch" and geo_example:
            actual, expected = geo_example
            label += f" (egress {actual} ≠ expected {expected})"
        lines.append(label)
        lines.append(f"   → {action}")
        lines.append("")
    lines.append(f"📂 {total} frází celkem")
    return "\n".join(lines).strip()


def vget(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def status_map(rows):
    # [{"status":"running","total":1},...] -> {"running":1,...}
    out = {}
    if isinstance(rows, list):
        for x in rows:
            if isinstance(x, dict) and "status" in x:
                out[x["status"]] = int(x.get("total", 0))
    return out

def first_total(rows, default=0):
    # [{"total":177}] -> 177 ; [{"total":N,"max_created":..}] -> N
    if isinstance(rows, list) and rows and isinstance(rows[0], dict):
        return int(rows[0].get("total", default))
    if isinstance(rows, dict):
        return int(rows.get("total", default))
    return default

def main():
    now = datetime.now(timezone.utc)
    try:
        qs = status_map(vget("/verify/queue-status"))
        gm = vget("/verify/geo-mismatch")
        gr = first_total(vget("/verify/growth?since=" + now.replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")))
        scr = vget("/verify/suggestions-count")
    except urllib.error.HTTPError as e:
        if e.code == 403:
            notify.send(f"🔴 *Hetzner watchdog FAIL — 403 Forbidden*\nToken neplatný (SUGGEST_VERIFY_TOKEN v GHA ≠ token na serveru). Server BĚŽÍ — to není outage.")
        elif e.code == 401:
            notify.send(f"🔴 *Hetzner watchdog FAIL — 401 Unauthorized*\nAuthorization header chybí nebo špatný formát.")
        else:
            notify.send(f"🔴 *Hetzner watchdog FAIL — HTTP {e.code}*\nVerify endpoint vrátil chybu. Zkontroluj suggest-proxy logy na serveru.")
        sys.exit(0)
    except (urllib.error.URLError, KeyError) as e:
        notify.send(f"🔴 *Hetzner watchdog FAIL — síť/connection*\nVerify endpoint nedostupný: `{type(e).__name__}`. Proxy/server down?")
        sys.exit(0)

    total = first_total(scr)
    max_created = ""
    if isinstance(scr, list) and scr and isinstance(scr[0], dict):
        max_created = str(scr[0].get("max_created", ""))
    geo_n = len(gm) if isinstance(gm, list) else int(gm.get("count", 0)) if isinstance(gm, dict) else 0
    running = qs.get("running", 0)
    pending = qs.get("pending", 0)
    completed = qs.get("completed", 0)
    failed = qs.get("failed", 0)

    # 1) geo/proxy issues → klasifikuj a alertuj
    if geo_n > 0:
        notify.send(_build_geo_alert(gm, total))
        return
    # 2) fronta aktivni -> bezi
    if running > 0 or pending > 0:
        notify.send(f"🟢 *Hetzner 60-market běží*\n✅ {completed} done / 🔄 {running} running / ⏳ {pending} pending"
                    + (f" / 🔴 {failed} failed" if failed else "")
                    + f"\n📈 +{gr} frází/h · 📂 {total} celkem")
        return
    # 3) fronta prazdna -> hotovo dnes / benigni cekani / selhani seedu
    # cerstvost dle max_created (misto pilot_id ktery endpoint nevraci)
    fresh_today = max_created.startswith(now.strftime("%Y-%m-%d"))
    after_seed = (now.hour > SEED_H) or (now.hour == SEED_H and now.minute >= 30)
    if fresh_today:
        notify.send(f"✅ *Hetzner cyklus hotový* ({completed}/60)\n📈 +{gr} frází/h · 📂 {total} celkem\nDalší seed 03:15 UTC")
    elif after_seed:
        notify.send(f"🔴 *Hetzner: seed NESEEDOVAL*\nJe {now.strftime('%H:%M')} UTC (po 03:30), fronta prázdná, poslední data `{max_created}` (ne dnešní). Provoz STOJÍ → zkontroluj suggest-seed-auto-batch-60.timer")
    else:
        notify.send(f"⏸️ *Hetzner: čeká na seed* (benigní)\nVečerní cyklus doběhl, další 03:15 UTC. 📂 {total} celkem")

if __name__ == "__main__":
    main()
