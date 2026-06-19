#!/usr/bin/env python3
"""Odhaduje zbývající IPRoyal traffic z anchor souboru. Fail-open."""
import os, sys, json, argparse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
import notify

BASE = "https://suggest.good-inventions.work"
ANCHOR_PATH = os.environ.get("PROXY_ANCHOR_PATH", "proxy_data_anchor.json")
KB_PER_PHRASE = float(os.environ.get("KB_PER_PHRASE", "1.5"))
AUTO_TOPUP_THRESHOLD_GB = float(os.environ.get("AUTO_TOPUP_THRESHOLD_GB", "5.0"))
AUTO_TOPUP_GB = float(os.environ.get("AUTO_TOPUP_GB", "10.0"))
MAX_AUTO_TOPUPS_WARN = int(os.environ.get("MAX_AUTO_TOPUPS_WARN", "2"))
ANCHOR_STALE_DAYS = int(os.environ.get("ANCHOR_STALE_DAYS", "30"))

TOKEN = os.environ.get("SUGGEST_VERIFY_TOKEN", "")


def _vget(path):
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def _first_total(rows, default=0):
    if isinstance(rows, list) and rows and isinstance(rows[0], dict):
        return int(rows[0].get("total", default))
    if isinstance(rows, dict):
        return int(rows.get("total", default))
    return default


def fetch_current_total():
    return _first_total(_vget("/verify/suggestions-count"))


def fetch_daily_growth():
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return _first_total(_vget(f"/verify/growth?since={since}"))


def load_anchor():
    if not os.path.exists(ANCHOR_PATH):
        return None
    try:
        with open(ANCHOR_PATH) as f:
            data = json.load(f)
        if (data.get("baseline_total_phrases") is not None
                and data.get("topup_gb") is not None
                and data.get("anchor_timestamp") is not None):
            return data
    except Exception:
        pass
    return None


def save_anchor(total_phrases, topup_gb):
    anchor = {
        "baseline_total_phrases": total_phrases,
        "topup_gb": topup_gb,
        "anchor_timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with open(ANCHOR_PATH, "w") as f:
        json.dump(anchor, f, indent=2)
    return anchor


def compute_remaining(total_phrases, anchor):
    baseline = anchor["baseline_total_phrases"]
    topup_gb = float(anchor["topup_gb"])
    phrases_since = max(0, total_phrases - baseline)
    consumed_gb = phrases_since * KB_PER_PHRASE / 1_000_000

    # Model auto top-ups: každý propad pod práh přidá jeden balík
    pool = topup_gb
    auto_topups = 0
    while (pool - consumed_gb) < AUTO_TOPUP_THRESHOLD_GB and auto_topups < MAX_AUTO_TOPUPS_WARN + 1:
        pool += AUTO_TOPUP_GB
        auto_topups += 1

    return consumed_gb, pool - consumed_gb, auto_topups


def anchor_age_days(anchor):
    try:
        ts = datetime.fromisoformat(anchor["anchor_timestamp"].replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - ts).total_seconds() / 86400
    except Exception:
        return 9999


def build_alert(remaining_gb, auto_topups_applied, days_to_empty, anchor_age, daily_gb):
    msgs = []

    if anchor_age > ANCHOR_STALE_DAYS:
        msgs.append(
            f"🟠 *Proxy anchor zastaralý* ({anchor_age:.0f} dní)\n"
            f"Odhad/projekce jsou nepřesné — spusť `--set-anchor` po dobití."
        )

    if auto_topups_applied >= MAX_AUTO_TOPUPS_WARN:
        msgs.append(
            f"🟠 *Proxy běží na auto top-up {auto_topups_applied}× bez ručního resetu*\n"
            f"Odhad: spotřebovány {auto_topups_applied} auto top-up balíky bez ručního dobití — "
            f"ověř účet/fakturaci IPRoyal a resetuj anchor (`--set-anchor`)."
        )

    if remaining_gb <= 1:
        msgs.append(
            f"🔴 *Proxy data KRITICKY: odhad ~{remaining_gb:.1f} GB zbývá*\n"
            f"Projekce days_to_empty ~{days_to_empty:.1f} d. Hrozí stop crawlu — "
            f"zkontroluj IPRoyal účet + zda auto top-up funguje."
        )
    elif remaining_gb <= AUTO_TOPUP_THRESHOLD_GB and auto_topups_applied == 0:
        msgs.append(
            f"🟠 *Proxy data: odhad zbývá ~{remaining_gb:.1f} GB* (projekce, ne přesné)\n"
            f"Auto top-up by měl aktivovat při <{AUTO_TOPUP_THRESHOLD_GB:.0f} GB. "
            f"Projekce days_to_empty ~{days_to_empty:.1f} d."
        )

    return msgs


def main_monitor():
    anchor = load_anchor()
    if anchor is None:
        notify.send(
            "🟠 *Proxy data monitor: anchor chybí/neplatný*\n"
            "Odhad nelze vypočítat — po ručním dobití spusť:\n"
            "`python proxy_data_monitor.py --set-anchor <GB>`"
        )
        return

    age = anchor_age_days(anchor)

    try:
        total_phrases = fetch_current_total()
    except Exception as e:
        notify.send(
            f"🟠 *Proxy monitor: /verify nedostupné*\n"
            f"Odhad/projekce přeskočena: `{type(e).__name__}`."
        )
        return

    try:
        daily_phrases = fetch_daily_growth()
    except Exception:
        daily_phrases = 0

    consumed_gb, remaining_gb, auto_topups = compute_remaining(total_phrases, anchor)
    daily_gb = daily_phrases * KB_PER_PHRASE / 1_000_000
    days_to_empty = remaining_gb / daily_gb if daily_gb > 0 else 9999

    msgs = build_alert(remaining_gb, auto_topups, days_to_empty, age, daily_gb)
    if msgs:
        for m in msgs:
            notify.send(m)
    else:
        suffix = f" (auto top-up {auto_topups}×)" if auto_topups else ""
        print(
            f"✅ Proxy data OK: odhad ~{remaining_gb:.1f} GB zbývá{suffix}. "
            f"Projekce days_to_empty ~{days_to_empty:.1f} d."
        )


def main_set_anchor(topup_gb):
    print("Čtu aktuální total z /verify...")
    try:
        total = fetch_current_total()
    except Exception as e:
        print(f"❌ /verify nedostupné: {e}")
        sys.exit(1)
    anchor = save_anchor(total, topup_gb)
    print(
        f"✅ Anchor nastaven:\n"
        f"   baseline_total_phrases = {total:,}\n"
        f"   topup_gb               = {topup_gb}\n"
        f"   timestamp              = {anchor['anchor_timestamp']}\n"
        f"Commituj {ANCHOR_PATH} do gitu."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Proxy data traffic monitor")
    parser.add_argument(
        "--set-anchor",
        type=float,
        metavar="TOPUP_GB",
        help="Reset anchor po ručním dobití. Arg = velikost dobití v GB.",
    )
    args = parser.parse_args()
    if args.set_anchor is not None:
        main_set_anchor(args.set_anchor)
    else:
        main_monitor()
