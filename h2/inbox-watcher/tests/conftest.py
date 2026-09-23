from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from h2iw import config  # noqa: E402
from h2iw.apply import Applier  # noqa: E402
from h2iw.classify import ClassifyResult  # noqa: E402
from h2iw.crypto import Key  # noqa: E402
from h2iw.main import Runner  # noqa: E402
from h2iw.store import Store  # noqa: E402
from h2iw.todoist import NotInInboxError  # noqa: E402

FIXTURES = json.loads((Path(__file__).parent / "fixtures" / "inputs.json").read_text())
NOW = datetime.fromisoformat(FIXTURES["now"])
INBOX = "inbox-1"
TEST_KEY = Key("h2iw", bytes(range(32)))


def case(case_id: str) -> dict:
    return next(c for c in FIXTURES["cases"] if c["id"] == case_id)


class FakeTodoist:
    """In-memory Todoist honouring the same Inbox guard as the real client."""

    def __init__(self):
        self.tasks: dict[str, dict] = {}
        self.calls: list[tuple] = []
        self.fail_once: set[str] = set()
        self.list_calls = 0

    def add(self, tid: str, content: str, **extra) -> dict:
        t = {"id": tid, "content": content, "description": "", "labels": [],
             "project_id": INBOX, "added_at": "2026-09-23T08:00:00Z", **extra}
        self.tasks[tid] = t
        return t

    def project_id_by_name(self, name):
        return {config.COMMANDS_PROJECT_NAME: "proj-prikazy"}[name]

    def list_inbox(self):
        self.list_calls += 1
        return [dict(t) for t in self.tasks.values() if t["project_id"] == INBOX]

    def _guard(self, tid, op):
        if op in self.fail_once:
            self.fail_once.discard(op)
            raise RuntimeError(f"injected {op} failure")
        t = self.tasks.get(tid)
        if t is None or t["project_id"] != INBOX:
            raise NotInInboxError(tid)
        return t

    def update_task(self, tid, fields):
        t = self._guard(tid, "update")
        self.calls.append(("update", tid, fields))
        t.update(fields)

    def move_task(self, tid, project_id):
        t = self._guard(tid, "move")
        self.calls.append(("move", tid, project_id))
        t["project_id"] = project_id

    def close_task(self, tid):
        t = self._guard(tid, "close")
        self.calls.append(("close", tid))
        t["project_id"] = "closed"

    def add_reminder(self, tid):
        self._guard(tid, "reminder")
        self.calls.append(("reminder", tid))

    def add_comment(self, tid, content):
        self._guard(tid, "comment")
        self.calls.append(("comment", tid, content))


class FakeGCal:
    def __init__(self):
        self.events: dict[tuple[str, str], dict] = {}
        self.insert_calls = 0
        self.calendars = {
            config.INFO_CALENDAR_NAME: "cal-info",
            "H2 · Fokus": "cal-fokus",
            "H2 · Regenerace": "cal-regenerace",
            "H2 · Lidé": "cal-lide",
            "H2 · Domov": "cal-domov",
            "H2 · Zážitky": "cal-zazitky",
        }

    def calendar_id_by_name(self, name):
        from h2iw.gcal import CalendarMissingError

        if name not in self.calendars:
            raise CalendarMissingError(name)
        return self.calendars[name]

    def insert_event(self, calendar_id, event):
        self.insert_calls += 1
        key = (calendar_id, event["id"])
        if key in self.events:
            return "exists"
        self.events[key] = event
        return "created"


class FakeClassifier:
    def __init__(self, by_text: dict[str, dict] | None = None):
        self.by_text = by_text or {c["text"]: c["mock_output"] for c in FIXTURES["cases"]}
        self.calls = 0

    def __call__(self, text, desc, now):
        self.calls += 1
        return ClassifyResult(self.by_text.get(text), 900, 120, None if text in self.by_text else "x")


@pytest.fixture
def env(tmp_path):
    store = Store(str(tmp_path / "state.db"), TEST_KEY)
    store.set_meta("baseline_done", "test")
    todoist, gcal, clf = FakeTodoist(), FakeGCal(), FakeClassifier()
    runner = Runner(store, todoist, Applier(store, todoist, gcal), clf)

    class Env:
        pass

    e = Env()
    e.store, e.todoist, e.gcal, e.clf, e.runner = store, todoist, gcal, clf, runner
    e.db_path = tmp_path / "state.db"
    return e
