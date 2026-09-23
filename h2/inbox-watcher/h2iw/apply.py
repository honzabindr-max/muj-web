"""Write phase. Each external effect is one named step recorded in SQLite, so a
crash mid-way resumes without repeating finished steps and without a new LLM
call. Order is chosen so a crash never loses the item:
calendar insert (idempotent id) -> comment -> close / move last.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import config, render
from .gcal import GCalClient, event_id_for
from .store import Store
from .todoist import TodoistClient
from .validate import Valid

TODOIST_TASK_URL = "https://app.todoist.com/app/task/{id}"


def _task_fields(v: Valid, task: dict) -> dict:
    original = (task.get("content") or "").strip()
    existing_desc = (task.get("description") or "").strip()
    desc = f"Původně: {original}"
    if existing_desc:
        desc += f"\n\n{existing_desc}"
    labels = list(dict.fromkeys([*(task.get("labels") or []), *render.task_labels(v)]))
    fields: dict = {"content": render.task_title(v), "description": desc, "labels": labels}
    if v.due_date is not None:
        if v.due_time is not None:
            local = datetime.combine(v.due_date, v.due_time, tzinfo=config.TZ)
            fields["due_datetime"] = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            fields["due_date"] = v.due_date.isoformat()
    if v.deadline_date is not None:
        fields["deadline_date"] = v.deadline_date.isoformat()
    return fields


def _event_body(v: Valid, task: dict, kind: str) -> dict:
    body: dict = {
        "id": event_id_for(task["id"], kind),
        "summary": render.calendar_title(v),
    }
    if v.start is not None:
        body["start"] = {"dateTime": v.start.isoformat(), "timeZone": "Europe/Prague"}
        body["end"] = {"dateTime": v.end.isoformat(), "timeZone": "Europe/Prague"}
    else:
        d = v.all_day_date
        body["start"] = {"date": d.isoformat()}
        body["end"] = {"date": (d + timedelta(days=1)).isoformat()}

    original = (task.get("content") or "").strip()
    if kind == "EVENT":
        body["description"] = f"Z Todoist Doručených: {original}"
        body["transparency"] = "opaque"
        body["reminders"] = {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": config.EVENT_REMINDER_MINUTES}],
        }
    elif kind == "INFO":
        body["description"] = f"Z Todoist Doručených: {original}"
        body["transparency"] = "transparent"
        body["reminders"] = {"useDefault": False, "overrides": []}
    elif kind == "BLOCK":
        body["description"] = f"Úkol: {TODOIST_TASK_URL.format(id=task['id'])}"
    return body


def _note_text(task: dict) -> str:
    content = (task.get("content") or "").strip()
    desc = (task.get("description") or "").strip()
    return f"{content}\n\n{desc}" if desc else content


class Applier:
    def __init__(self, store: Store, todoist: TodoistClient, gcal: GCalClient):
        self.store = store
        self.todoist = todoist
        self.gcal = gcal
        self._cal_ids: dict[str, str] = {}
        self._project_ids: dict[str, str] = {}

    def _cal(self, name: str) -> str:
        if name not in self._cal_ids:
            self._cal_ids[name] = self.gcal.calendar_id_by_name(name)
        return self._cal_ids[name]

    def _project(self, name: str) -> str:
        if name not in self._project_ids:
            self._project_ids[name] = self.todoist.project_id_by_name(name)
        return self._project_ids[name]

    def _step(self, task_id: str, step: str, fn) -> None:
        if self.store.step_done(task_id, step):
            return
        fn()
        self.store.mark_step(task_id, step)

    def apply(self, v: Valid, task: dict) -> None:
        tid = task["id"]
        s = self._step
        if v.type in ("TASK", "WAITING"):
            s(tid, "todoist_update", lambda: self.todoist.update_task(tid, _task_fields(v, task)))
            if v.reminder:
                s(tid, "todoist_reminder", lambda: self.todoist.add_reminder(tid))
            s(tid, "todoist_move", lambda: self.todoist.move_task(tid, config.H2_PROJECT_ID))
        elif v.type == "BLOCK":
            s(tid, "todoist_update", lambda: self.todoist.update_task(tid, _task_fields(v, task)))
            s(tid, "gcal_insert", lambda: self.gcal.insert_event(
                self._cal(config.BLOCK_CALENDAR_NAME), _event_body(v, task, "BLOCK")))
            s(tid, "todoist_move", lambda: self.todoist.move_task(tid, config.H2_PROJECT_ID))
        elif v.type == "EVENT":
            s(tid, "gcal_insert", lambda: self.gcal.insert_event(
                config.PRIMARY_CALENDAR_ID, _event_body(v, task, "EVENT")))
            s(tid, "todoist_comment", lambda: self.todoist.add_comment(tid, "→ kalendář"))
            s(tid, "todoist_close", lambda: self.todoist.close_task(tid))
        elif v.type == "NOTE":
            s(tid, "note_insert", lambda: self.store.insert_note(
                tid, v.note_subtype, _note_text(task)))
            s(tid, "scrub", lambda: self.store.scrub_item(tid))
            s(tid, "todoist_comment", lambda: self.todoist.add_comment(tid, "→ H2 poznámky"))
            s(tid, "todoist_close", lambda: self.todoist.close_task(tid))
        elif v.type == "COMMAND":
            # Hard ban stays: the watcher never executes a command or touches the
            # task it refers to. It records it (encrypted) and hands the item,
            # unchanged and open, to the Planner's project.
            s(tid, "command_insert", lambda: self.store.insert_command(tid, _note_text(task)))
            s(tid, "scrub", lambda: self.store.scrub_item(tid))
            s(tid, "todoist_move", lambda: self.todoist.move_task(
                tid, self._project(config.COMMANDS_PROJECT_NAME)))
        elif v.type == "INFO":
            s(tid, "gcal_insert", lambda: self.gcal.insert_event(
                self._cal(config.INFO_CALENDAR_NAME), _event_body(v, task, "INFO")))
            s(tid, "todoist_comment", lambda: self.todoist.add_comment(tid, "→ H2 · Info"))
            s(tid, "todoist_close", lambda: self.todoist.close_task(tid))
        else:  # pragma: no cover - validate() never yields another type
            raise ValueError(v.type)

    def mark_unknown(self, task_id: str, reason: str) -> None:
        self._step(task_id, "todoist_comment_unknown",
                   lambda: self.todoist.add_comment(task_id, f"❓ {reason}"))
