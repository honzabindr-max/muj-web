import os, sys, json, urllib.request, urllib.error, time
from datetime import datetime, timezone
import notify  # znovupoužití existujícího Telegram odesílání (TELEGRAM_TOKEN/CHAT_ID)

FETCH_TIMEOUT = int(os.environ.get("FETCH_TIMEOUT", "30"))
FETCH_RETRIES = int(os.environ.get("FETCH_RETRIES", "3"))
FETCH_BACKOFF = float(os.environ.get("FETCH_BACKOFF", "5"))

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Práh: engine je "stojí", když je updated_at starší než tolik hodin. Laditelné přes env.
STALE_HOURS = float(os.environ.get("STALE_HOURS", "6"))
STALE_SECONDS = STALE_HOURS * 3600

# (zobrazované jméno, emoji, tabulka stavu)
ENGINES = [
    ("Seznam", "\U0001f534", "crawl_state"),
]


def fetch_updated_at(table):
    h = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY}
    url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq.1&select=updated_at"
    last_exc = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=h)
            r = urllib.request.urlopen(req, timeout=FETCH_TIMEOUT)
            rows = json.loads(r.read().decode())
            return rows[0].get("updated_at") if rows else None
        except (urllib.error.URLError, OSError) as e:
            last_exc = e
            print(
                "fetch_updated_at pokus "
                + str(attempt)
                + "/"
                + str(FETCH_RETRIES)
                + " selhal: "
                + str(e)
            )
            if attempt < FETCH_RETRIES:
                time.sleep(FETCH_BACKOFF * attempt)
    raise last_exc


def parse_ts(s):
    if not s:
        return None
    t = s.strip().replace(" ", "T")
    # normalizace timezone "+00" -> "+00:00" (PostgREST někdy vrací zkrácený offset)
    if len(t) >= 3 and t[-3] in "+-" and t[-2:].isdigit():
        t = t + ":00"
    try:
        dt = datetime.fromisoformat(t)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


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


def main():
    now = datetime.now(timezone.utc)
    stale = []

    for name, emoji, table in ENGINES:
        ts = fetch_updated_at(table)
        dt = parse_ts(ts)
        if dt is None:
            print(
                name + ": updated_at chybi/neparsovatelne (" + repr(ts) + ") -> STALE"
            )
            stale.append((name, emoji, None, None))
            continue
        age = (now - dt).total_seconds()
        verdict = "STALE" if age > STALE_SECONDS else "OK"
        print(
            name
            + ": updated_at="
            + str(ts)
            + " stari="
            + fmt_age(age)
            + " -> "
            + verdict
        )
        if age > STALE_SECONDS:
            stale.append((name, emoji, dt, age))

    if not stale:
        print(
            "OK: oba enginy v poradku (prah "
            + ("%g" % STALE_HOURS)
            + " h). Nic neposilam."
        )
        return

    lines = ["⚠️ *Crawler watchdog* — problém", ""]
    lines.append(
        "Práh: engine *stojí*, když je `updated_at` starší než "
        + ("%g" % STALE_HOURS)
        + " h."
    )
    lines.append("")
    for name, emoji, dt, age in stale:
        lines.append(emoji + " *" + name + "* stojí")
        if dt is None:
            lines.append("   • `updated_at` chybí nebo se nepodařilo načíst")
        else:
            lines.append(
                "   • naposledy aktivní: " + dt.strftime("%Y-%m-%d %H:%M") + " UTC"
            )
            lines.append("   • stáří: před " + fmt_age(age))
        lines.append("")

    notify.send("\n".join(lines).strip())
    print("Alert odeslan na Telegram (" + str(len(stale)) + " engine).")


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
