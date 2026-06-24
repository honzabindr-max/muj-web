import os, sys, json, urllib.request
import notify  # Telegram (TELEGRAM_TOKEN/CHAT_ID)

# §2c: supervisor freshness — práh 300 s (5 zmeškaných ticků á 60 s)
SUPERVISOR_STALE_SECONDS = int(os.environ.get("SUPERVISOR_STALE_SECONDS", "300"))
# §2c: growth freshness — práh 1800 s (30 min bez nového záznamu)
GROWTH_STALE_SECONDS = int(os.environ.get("GROWTH_STALE_SECONDS", "1800"))

SUGGEST_PROXY_URL = os.environ.get("SUGGEST_PROXY_URL", "").rstrip("/")
SUGGEST_PROXY_TOKEN = os.environ.get("SUGGEST_PROXY_TOKEN", "")


def fmt_age(sec):
    sec = int(sec)
    d = sec // 86400
    h = (sec % 86400) // 3600
    m = (sec % 3600) // 60
    if d > 0:
        slovo = "den" if d == 1 else ("dny" if d < 5 else "dní")
        return str(d) + " " + slovo + " " + str(h) + " h"
    if h > 0:
        return str(h) + " h " + str(m) + " min"
    return str(m) + " min"


def _proxy_get(path):
    """GET {SUGGEST_PROXY_URL}{path} s Bearer auth. Vrací dict nebo vyhodí výjimku."""
    req = urllib.request.Request(
        SUGGEST_PROXY_URL + path,
        headers={"Authorization": "Bearer " + SUGGEST_PROXY_TOKEN},
    )
    return json.loads(urllib.request.urlopen(req, timeout=15).read().decode())


def check_supervisor_freshness():
    """§2c: supervisor-freshness — GET /ai/v1/supervisor přes suggest-proxy Bearer."""
    if not SUGGEST_PROXY_URL or not SUGGEST_PROXY_TOKEN:
        print("Supervisor: SUGGEST_PROXY_URL/TOKEN not configured — skip check")
        return
    try:
        age = _proxy_get("/ai/v1/supervisor").get("supervisor_age_seconds")
    except Exception as e:
        print("Supervisor: endpoint unreachable (" + str(e) + ") — skip check")
        return

    if age is None:
        print("Supervisor: age=null — skip check (no ticks recorded yet)")
        return

    verdict = "STALE" if age > SUPERVISOR_STALE_SECONDS else "OK"
    print("Supervisor: tick_age=" + fmt_age(age) + " -> " + verdict)

    if age > SUPERVISOR_STALE_SECONDS:
        notify.send(
            "⚠️ *Crawler Supervisor* — dead/stalled\n\n"
            "Poslední tick supervisoru je starý *" + fmt_age(age) + "*.\n"
            "Práh: " + str(SUPERVISOR_STALE_SECONDS) + " s (5 zmeškaných ticků).\n\n"
            "`systemctl status suggest-crawler-supervisor.timer`"
        )
        print("Alert odeslan na Telegram (supervisor stale).")


def check_growth_freshness():
    """Engine check: poslední INSERT do google_suggestions_v2 — GET /ai/v1/growth-age Bearer."""
    if not SUGGEST_PROXY_URL or not SUGGEST_PROXY_TOKEN:
        print("Growth: SUGGEST_PROXY_URL/TOKEN not configured — skip check")
        return
    try:
        age = _proxy_get("/ai/v1/growth-age").get("growth_age_seconds")
    except Exception as e:
        print("Growth: endpoint unreachable (" + str(e) + ") — skip check")
        return

    if age is None:
        print("Growth: age=null — skip check (no data yet)")
        return

    verdict = "STALE" if age > GROWTH_STALE_SECONDS else "OK"
    print("Growth: last_insert_age=" + fmt_age(age) + " -> " + verdict)

    if age > GROWTH_STALE_SECONDS:
        notify.send(
            "⚠️ *Crawler* — stopped / growth stale\n\n"
            "Poslední nový záznam v `google_suggestions_v2` je starý *" + fmt_age(age) + "*.\n"
            "Práh: " + str(GROWTH_STALE_SECONDS) + " s (30 min).\n\n"
            "Zkontroluj GHA nebo supervisor."
        )
        print("Alert odeslan na Telegram (growth stale).")


def main():
    check_supervisor_freshness()
    check_growth_freshness()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            notify.send(
                "⚠️ *Crawler watchdog* selhal\n\n"
                "Nepodařilo se ověřit stav crawlerů:\n`" + str(e) + "`"
            )
        except Exception:
            pass
        print("watchdog error: " + str(e))
        sys.exit(1)
