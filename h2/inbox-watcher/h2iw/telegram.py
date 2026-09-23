"""Telegram sender. Messages go only to the owner's chat id."""

from __future__ import annotations

import httpx

from . import config


class TelegramError(RuntimeError):
    pass


class TelegramClient:
    def __init__(self, token: str, http: httpx.Client | None = None):
        self._http = http or httpx.Client(timeout=20)
        self._url = f"https://api.telegram.org/bot{token}/sendMessage"

    def send(self, text: str) -> None:
        r = self._http.post(
            self._url,
            json={
                "chat_id": config.TELEGRAM_CHAT_ID,
                "text": text[:4000],
                "disable_web_page_preview": True,
            },
        )
        if r.status_code >= 400:
            # Never include the URL: it contains the bot token.
            raise TelegramError(f"sendMessage -> {r.status_code}")
