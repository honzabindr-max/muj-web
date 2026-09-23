"""Read-only credential check. Prints OK/FAIL per service, never a value.

    systemd-run ... python -m h2iw.preflight   (see RUNBOOK.md)
"""

from __future__ import annotations

import sys

import anthropic
import httpx

from . import config
from .gcal import GCalClient, GCalError
from .main import quiet_http_loggers
from .todoist import TodoistClient, TodoistError


def main() -> int:
    quiet_http_loggers()
    s = config.load_secrets()
    ok = True

    def check(name, fn):
        nonlocal ok
        try:
            detail = fn()
            print(f"OK   {name}{': ' + detail if detail else ''}")
        except (TodoistError, GCalError) as e:  # our messages carry path + HTTP code only
            ok = False
            print(f"FAIL {name}: {e}")
        except Exception as e:  # other messages may echo request data: type only
            ok = False
            print(f"FAIL {name}: {type(e).__name__}")

    todoist = TodoistClient(s.todoist_token)
    check("todoist inbox", lambda: f"project {todoist.inbox_id()}, {len(todoist.list_inbox())} items")

    gcal = GCalClient(s.google_client_id, s.google_client_secret, s.google_refresh_token)
    check("google token refresh", lambda: (gcal._token(), "")[1])
    check(f"calendar '{config.INFO_CALENDAR_NAME}'",
          lambda: (gcal.calendar_id_by_name(config.INFO_CALENDAR_NAME), "found")[1])
    check(f"calendar '{config.BLOCK_CALENDAR_NAME}'",
          lambda: (gcal.calendar_id_by_name(config.BLOCK_CALENDAR_NAME), "found")[1])

    def telegram():
        r = httpx.get(f"https://api.telegram.org/bot{s.telegram_token}/getMe", timeout=20)
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}")
        return "@" + r.json()["result"]["username"]

    check("telegram getMe", telegram)

    def llm():
        m = anthropic.Anthropic(api_key=s.anthropic_key).models.retrieve(config.MODEL)
        return m.id

    check("anthropic model", llm)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
