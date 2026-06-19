import os, sys, json, urllib.request, urllib.error, time
from datetime import datetime, timezone
import notify  # znovupoužití existujícího Telegram odesílání (TELEGRAM_TOKEN/CHAT_ID)

FETCH_TIMEOUT = int(os.environ.get("FETCH_TIMEOUT", "30"))
FETCH_RETRIES = int(os.environ.get("FETCH_RETRIES", "3"))
FETCH_BACKOFF = float(os.environ.get("FETCH_BACKOFF", "5"))
ALERT_AFTER = int(os.environ.get("WATCHDOG_ALERT_AFTER", "2"))
WATCHDOG_STATE = os.environ.get("WATCHDOG_STATE_FILE", "/tmp/suggest_watchdog_state.json")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

# Práh: engine je "stojí", když je updated_at starší než tolik hodin. Laditelné přes env.
STALE_HOURS = float(os.environ.get("STALE_HOURS", "6"))
STALE_SECONDS = STALE_HOURS * 3600

# Cloudflare/gateway blip kódy — přechodné stavy, nespouštějí alert hned
TRANSIENT_HTTP = {502, 503, 504, 520, 521, 522, 523, 524}

# (zobrazované jméno, emoji, tabulka stavu)
ENGINES = [
    ("Seznam", "\U0001f534", "crawl_state"),
]


class TransientFetchError(Exception):
    def __init__(self, code):
        super().__init__("Transient HTTP " + str(code))
        self.code = code


def _read_state():
    try:
        with open(WATCHDOG_STATE) as f:
            return json.load(f)
    except Exception:
        return {"consecutive_transient_fails": 0, "last_fail_code": None, "updated_at": None}


def _write_state(data):
    tmp = WATCHDOG_STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, WATCHDOG_STATE)


def fetch_updated_at(table):
    h = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY}
    url = SUPABASE_URL + "/rest/v1/" + table + "?id=eq.1&select=updated_at"
    last_exc = None
    last_transient_code = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=h)
            r = urllib.request.urlopen(req, timeout=FETCH_TIMEOUT)
            rows = json.loads(r.read().decode())
            return rows[0].get("updated_at") if rows else None
        except urllib.error.HTTPError as e:
            last_exc = e
            print(
                "fetch_updated_at pokus "
                + str(attempt)
                + "/"
                + str(FETCH_RETRIES)
                + " selhal: HTTP "
                + str(e.code)
            )
            if e.code not in TRANSIENT_HTTP:
                raise  # ne-transient (401, 403 …) → probublat okamžitě
            last_transient_code = e.code
            if attempt < FETCH_RETRIES:
                time.sleep(FETCH_BACKOFF * attempt)
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
    if last_transient_code is not None:
        raise TransientFetchError(last_transient_code)
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


def run():
    """Entry point s 2-strike counter pro transient HTTP chyby."""
    try:
        main()
        _write_state({
            "consecutive_transient_fails": 0,
            "last_fail_code": None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return 0
    except TransientFetchError as e:
        state = _read_state()
        n = state.get("consecutive_transient_fails", 0) + 1
        _write_state({
            "consecutive_transient_fails": n,
            "last_fail_code": e.code,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        if n < ALERT_AFTER:
            print(
                "transient HTTP "
                + str(e.code)
                + ", strike "
                + str(n)
                + "/"
                + str(ALERT_AFTER)
                + ", mlčím"
            )
            return 0
        try:
            notify.send(
                "⚠️ *Crawler watchdog* — origin nedostupný "
                + str(n)
                + "× po sobě (poslední HTTP "
                + str(e.code)
                + ") — možný výpadek nebo Cloudflare"
            )
        except Exception:
            pass
        print(
            "watchdog alert (transient "
            + str(n)
            + "/"
            + str(ALERT_AFTER)
            + "): HTTP "
            + str(e.code)
        )
        return 0
    except Exception as e:
        try:
            notify.send(
                "⚠️ *Crawler watchdog* selhal\n\n"
                "Nepodařilo se ověřit stav crawlerů:\n`" + str(e) + "`"
            )
        except Exception:
            pass
        print("watchdog error: " + str(e))
        return 1


if __name__ == "__main__":
    sys.exit(run())
