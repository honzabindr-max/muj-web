#!/usr/bin/env python3
"""Hetzner 60-market crawl watchdog -> Telegram (notify.py).
Cte /verify endpointy (Bearer), posle 1 zpravu o stavu."""
import os, sys, json, urllib.request, urllib.error
from datetime import datetime, timezone
import notify

BASE = "https://suggest.good-inventions.work"
TOKEN = os.environ["SUGGEST_VERIFY_TOKEN"]
SEED_H = 3  # seed 03:15 UTC; po 03:30 ma novy cyklus existovat

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
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError) as e:
        notify.send(f"🔴 *Hetzner watchdog FAIL*\nVerify endpoint nedostupný: `{type(e).__name__}`. Proxy/server down?")
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

    # 1) geo-mismatch = poplach
    if geo_n > 0:
        notify.send(f"🔴 *Hetzner geo-mismatch: {geo_n}*\nZkontroluj proxy selector. 📂 {total} frází celkem")
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
