"""Deliberately narrow Google Calendar client: list calendars + insert events.

There is intentionally NO update/patch/delete/move method. Existing events can
never be modified by this process (hard ban). A test asserts this surface.
"""

from __future__ import annotations

import hashlib

import httpx

TOKEN_URL = "https://oauth2.googleapis.com/token"
BASE = "https://www.googleapis.com/calendar/v3"


class GCalError(RuntimeError):
    pass


class CalendarMissingError(GCalError):
    """The target calendar does not exist (or its name is not unique)."""

    def __init__(self, name: str):
        super().__init__(name)
        self.name = name


def event_id_for(task_id: str, kind: str) -> str:
    """Deterministic event id (base32hex alphabet: 0-9a-v). Re-insert -> 409."""
    return hashlib.sha1(f"h2iw:{task_id}:{kind}".encode()).hexdigest()


class GCalClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        http: httpx.Client | None = None,
    ):
        self._http = http or httpx.Client(timeout=20)
        self._creds = (client_id, client_secret, refresh_token)
        self._access: str | None = None

    def _token(self) -> str:
        if self._access is None:
            cid, secret, refresh = self._creds
            r = self._http.post(
                TOKEN_URL,
                data={
                    "client_id": cid,
                    "client_secret": secret,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token",
                },
            )
            if r.status_code >= 400:
                # Body may echo the error kind (invalid_grant) but never the token.
                kind = r.json().get("error", "unknown") if r.content else "unknown"
                raise GCalError(f"token refresh failed: {r.status_code} {kind}")
            self._access = r.json()["access_token"]
        return self._access

    def _h(self) -> dict:
        return {"Authorization": f"Bearer {self._token()}"}

    def calendar_id_by_name(self, name: str) -> str:
        r = self._http.get(f"{BASE}/users/me/calendarList", headers=self._h())
        if r.status_code >= 400:
            raise GCalError(f"calendarList -> {r.status_code}")
        matches = [c["id"] for c in r.json().get("items", []) if c.get("summary") == name]
        if len(matches) != 1:
            raise CalendarMissingError(name)
        return matches[0]

    def insert_event(self, calendar_id: str, event: dict) -> str:
        """Returns 'created' or 'exists' (idempotent re-run with the same id)."""
        if "id" not in event:
            raise GCalError("insert_event requires a deterministic id")
        r = self._http.post(
            f"{BASE}/calendars/{calendar_id}/events", headers=self._h(), json=event
        )
        if r.status_code == 409:
            return "exists"
        if r.status_code >= 400:
            raise GCalError(f"events.insert -> {r.status_code}")
        return "created"
