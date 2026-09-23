"""Static configuration and env loading for the H2 Inbox Watcher.

Secrets come only from the process environment (systemd EnvironmentFile on
the VPS). Nothing here ever logs or prints a secret value.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Prague")

# Planning OS v0.3 targets (verified live 2026-09-23 via Todoist + Calendar MCP).
H2_PROJECT_ID = "6hc925WcvFQ34pp6"
PRIMARY_CALENDAR_ID = "honza.bindr@gmail.com"
INFO_CALENDAR_NAME = "H2 · Info"
BLOCK_CALENDAR_NAME = "H2 · Bloky"
TELEGRAM_CHAT_ID = 6034875251

MODEL = "claude-haiku-4-5"
# Anthropic first-party pricing for Claude Haiku 4.5, USD per million tokens.
PRICE_INPUT_PER_MTOK = 1.00
PRICE_OUTPUT_PER_MTOK = 5.00

DAILY_LLM_CALL_CAP = 200
MONTHLY_USD_CAP = 3.00
MAX_CLASSIFY_ATTEMPTS = 3
RAW_TEXT_RETENTION_DAYS = 30
FAILURE_ALERT_THRESHOLD = 5

EVENT_DEFAULT_MINUTES = 60
BLOCK_DEFAULT_MINUTES = 60
EVENT_REMINDER_MINUTES = 60

DEFAULT_DB_PATH = "/var/lib/h2-inbox-watcher/state.db"


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Secrets:
    todoist_token: str
    anthropic_key: str
    google_client_id: str
    google_client_secret: str
    google_refresh_token: str
    telegram_token: str


REQUIRED_ENV = (
    "TODOIST_API_TOKEN",
    "ANTHROPIC_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "H2_TELEGRAM_BOT_TOKEN",
)


def load_secrets(env: dict[str, str] | None = None) -> Secrets:
    env = os.environ if env is None else env
    missing = [k for k in REQUIRED_ENV if not env.get(k)]
    if missing:
        # Names only, never values.
        raise ConfigError(f"missing env: {', '.join(missing)}")
    return Secrets(
        todoist_token=env["TODOIST_API_TOKEN"],
        anthropic_key=env["ANTHROPIC_API_KEY"],
        google_client_id=env["GOOGLE_CLIENT_ID"],
        google_client_secret=env["GOOGLE_CLIENT_SECRET"],
        google_refresh_token=env["GOOGLE_REFRESH_TOKEN"],
        telegram_token=env["H2_TELEGRAM_BOT_TOKEN"],
    )


def db_path() -> str:
    return os.environ.get("H2IW_DB", DEFAULT_DB_PATH)
