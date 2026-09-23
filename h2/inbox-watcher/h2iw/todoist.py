"""Deliberately narrow Todoist API v1 client.

Hard bans (Planning OS v0.3 + slice approval) are enforced here, not in the
caller: every write re-fetches the task and refuses to touch it unless it is
still an open task in the Inbox. There is no delete method and no way to
touch tasks outside the Inbox.
"""

from __future__ import annotations

import httpx

BASE = "https://api.todoist.com/api/v1"


class TodoistError(RuntimeError):
    pass


class NotInInboxError(TodoistError):
    """Raised when a write targets a task that is no longer in the Inbox."""


class TodoistClient:
    def __init__(self, token: str, http: httpx.Client | None = None):
        self._http = http or httpx.Client(timeout=20)
        self._headers = {"Authorization": f"Bearer {token}"}
        self._inbox_id: str | None = None

    # --- reads ------------------------------------------------------------
    def _get(self, path: str, params: dict | None = None) -> dict:
        r = self._http.get(f"{BASE}{path}", headers=self._headers, params=params)
        if r.status_code >= 400:
            raise TodoistError(f"GET {path} -> {r.status_code}")
        return r.json()

    def _paged(self, path: str, params: dict) -> list[dict]:
        out: list[dict] = []
        cursor = None
        while True:
            p = dict(params, limit=200)
            if cursor:
                p["cursor"] = cursor
            data = self._get(path, p)
            if "results" not in data:
                # Fail loudly: a silent empty list would look like "Inbox empty".
                raise TodoistError(f"GET {path}: unexpected response shape")
            out.extend(data["results"])
            cursor = data.get("next_cursor")
            if not cursor:
                return out

    def inbox_id(self) -> str:
        if self._inbox_id is None:
            projects = self._paged("/projects", {})
            inbox = [p for p in projects if p.get("inbox_project")]
            if len(inbox) != 1:
                raise TodoistError("could not resolve a single Inbox project")
            self._inbox_id = inbox[0]["id"]
        return self._inbox_id

    def project_id_by_name(self, name: str) -> str:
        matches = [p["id"] for p in self._paged("/projects", {}) if p.get("name") == name]
        if len(matches) != 1:
            raise TodoistError(f"project '{name}' not found exactly once")
        return matches[0]

    def list_inbox(self) -> list[dict]:
        return self._paged("/tasks", {"project_id": self.inbox_id()})

    def get_task(self, task_id: str) -> dict:
        return self._get(f"/tasks/{task_id}")

    # --- guarded writes ---------------------------------------------------
    def _assert_in_inbox(self, task_id: str) -> None:
        t = self.get_task(task_id)
        if t.get("project_id") != self.inbox_id() or t.get("checked") or t.get("is_deleted"):
            raise NotInInboxError(task_id)

    def _post(self, path: str, body: dict | None = None) -> dict | None:
        r = self._http.post(f"{BASE}{path}", headers=self._headers, json=body or {})
        if r.status_code >= 400:
            raise TodoistError(f"POST {path} -> {r.status_code}")
        return r.json() if r.content else None

    def update_task(self, task_id: str, fields: dict) -> None:
        allowed = {"content", "description", "labels", "due_date", "due_datetime", "deadline_date",
                   "duration", "duration_unit"}
        extra = set(fields) - allowed
        if extra:
            raise TodoistError(f"update_task: forbidden fields {sorted(extra)}")
        self._assert_in_inbox(task_id)
        self._post(f"/tasks/{task_id}", fields)

    def move_task(self, task_id: str, project_id: str) -> None:
        self._assert_in_inbox(task_id)
        self._post(f"/tasks/{task_id}/move", {"project_id": project_id})

    def close_task(self, task_id: str) -> None:
        self._assert_in_inbox(task_id)
        self._post(f"/tasks/{task_id}/close")

    def add_reminder(self, task_id: str) -> None:
        """Push reminder at the task's due time (relative, 0 min). Inbox tasks only."""
        self._assert_in_inbox(task_id)
        self._post("/reminders", {"task_id": task_id, "type": "relative",
                                  "minute_offset": 0, "service": "push"})

    def add_comment(self, task_id: str, content: str) -> None:
        self._assert_in_inbox(task_id)
        self._post("/comments", {"task_id": task_id, "content": content})
