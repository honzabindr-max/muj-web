"""Write phase. Each external effect is one named step recorded in SQLite, so a
crash mid-way resumes without repeating finished steps and without a new LLM
call. Order is chosen so a crash never loses the item:
calendar insert (idempotent id) -> comment -> close / move last.
"""

from __future__ import annotations

from datetime import datetime, time, timezone

from . import config, render
from .gcal import GCalClient, event_id_for
from .store import Store
from .todoist import TodoistClient, TodoistError
from .validate import Valid

TODOIST_TASK_URL = "https://app.todoist.com/app/task/{id}"


def _task_fields(v: Valid, task: dict) -> dict:
    original = (task.get("content") or "").strip()
    existing_desc = (task.get("description") or "").strip()
    desc = f"Původně: {original}"
    if v.deadline_date is not None:
        # H2 pravidla §6: Todoist Free nemá deadline (API pole `deadline_date`
        # je Pro-only, 403) — Watcher ho nikdy neposílá, termín jde do popisu.
        desc += f"\nTermín: {v.deadline_date.day}. {v.deadline_date.month}."
    if existing_desc:
        desc += f"\n\n{existing_desc}"
    ours = [lb for lb in render.task_labels(v) if lb not in config.NEVER_ASSIGNED_LABELS]
    labels = list(dict.fromkeys([*(task.get("labels") or []), *ours]))
    fields: dict = {"content": render.task_title(v), "description": desc, "labels": labels}
    if v.duration_min:
        fields["duration"] = v.duration_min
        fields["duration_unit"] = "minute"
    if v.type == "BLOCK" and v.start is not None:
        # The task behind a block is due at the block start (reminder at that time).
        fields["due_datetime"] = v.start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    elif v.due_date is not None:
        if v.due_time is not None:
            local = datetime.combine(v.due_date, v.due_time, tzinfo=config.TZ)
            fields["due_datetime"] = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        else:
            fields["due_date"] = v.due_date.isoformat()
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
        # Planning OS v0.11 §3: never a celodenní ("date") event — an
        # 8:00-18:00 placeholder instead, flagged in the description
        # (render.ALL_DAY_LINE). Multi-day = one recurring event.
        d = v.all_day_date
        start_t = time(config.ALL_DAY_START_HOUR, 0)
        end_t = time(config.ALL_DAY_END_HOUR, 0)
        body["start"] = {"dateTime": datetime.combine(d, start_t, tzinfo=config.TZ).isoformat(),
                          "timeZone": "Europe/Prague"}
        body["end"] = {"dateTime": datetime.combine(d, end_t, tzinfo=config.TZ).isoformat(),
                        "timeZone": "Europe/Prague"}
        if v.all_day_end_date is not None and v.all_day_end_date > d:
            days = (v.all_day_end_date - d).days + 1
            body["recurrence"] = [f"RRULE:FREQ=DAILY;COUNT={days}"]

    original = (task.get("content") or "").strip()
    uncategorized = kind == "EVENT" and v.life is None
    if kind == "INFO" or uncategorized:
        # Someone else's plan, or MY event with no clear category: FREE, no
        # notification (Planning OS v0.4 §2 / v0.11.1 §2 — the Planner sorts
        # the uncategorized ones out, never guessed as povinnost).
        body["description"] = f"Z Todoist Doručených: {original}"
        if uncategorized:
            body["description"] = f"{render.UNCATEGORIZED_LINE}\n{body['description']}"
        elif v.all_day_date is not None:
            body["description"] = f"{render.ALL_DAY_LINE}\n{body['description']}"
        body["transparency"] = "transparent"
        body["reminders"] = {"useDefault": False, "overrides": []}
        return body
    # Every life calendar is BUSY; 60 min reminder only for povinnost, else 15.
    minutes = (config.EVENT_REMINDER_MINUTES if v.life == "povinnost"
               else config.LIFE_REMINDER_MINUTES)
    body["transparency"] = "opaque"
    # v0.11.1 §1: a "🗓️ celý den" placeholder pops up only when it's a
    # single-day povinnost event; a multi-day series or any other calendar
    # gets no popup. A real timed EVENT/BLOCK always gets one, as before.
    if v.all_day_date is None:
        overrides = [{"method": "popup", "minutes": minutes}]
    elif v.all_day_end_date is None and v.life == "povinnost":
        overrides = [{"method": "popup", "minutes": minutes}]
    else:
        overrides = []
    body["reminders"] = {"useDefault": False, "overrides": overrides}
    if kind == "BLOCK":
        # v0.6 §6: the block links the task it was created with (one line per task).
        body["description"] = f"Úkol: {TODOIST_TASK_URL.format(id=task['id'])}"
    else:
        body["description"] = f"Z Todoist Doručených: {original}"
        header = []
        if render.is_pinned(v):
            # v0.6 §4: first line marks the event PEVNÉ for the Planner.
            header.append(render.PINNED_LINE)
        if v.all_day_date is not None:
            header.append(render.ALL_DAY_LINE)
        if header:
            body["description"] = "\n".join([*header, body["description"]])
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

    def calendar_for(self, v: Valid) -> tuple[str, str]:
        """(calendar id, display name). Raises CalendarMissingError before any write."""
        if v.type == "INFO" or (v.type == "EVENT" and v.life is None):
            # v0.11.1 §2: an EVENT with no clear life lands in ⚪ H2 · Info
            # for the Planner, instead of guessing povinnost.
            return self._cal(config.INFO_CALENDAR_NAME), config.INFO_CALENDAR_NAME
        _, name, display = config.LIFE_CALENDARS[v.life]
        if name is None:
            return config.PRIMARY_CALENDAR_ID, display
        return self._cal(name), display

    def _project(self, name: str) -> str:
        if name not in self._project_ids:
            self._project_ids[name] = self.todoist.project_id_by_name(name)
        return self._project_ids[name]

    # Fields that are refinements, never worth losing the whole task over: if
    # Todoist rejects the write with a 4xx (plan limits, format quirks), drop
    # the offending group and retry once. The value is not lost — it gets a
    # line in the description too, so it stays visible to the owner.
    _DROPPABLE_FIELDS: tuple[tuple[tuple[str, ...], str], ...] = (
        (("duration", "duration_unit"), "odhad délky Todoist odmítl"),
    )

    def _update_task(self, tid: str, v: Valid, task: dict) -> None:
        fields = _task_fields(v, task)
        try:
            self.todoist.update_task(tid, fields)
        except TodoistError as e:
            if "-> 4" not in str(e):
                raise
            for names, note in self._DROPPABLE_FIELDS:
                if any(n in fields for n in names):
                    for n in names:
                        fields.pop(n, None)
                    v.notes.append(note)
                    fields["description"] = f"{fields['description']}\n{note}"
                    self.todoist.update_task(tid, fields)
                    return
            raise

    def _step(self, task_id: str, step: str, fn) -> None:
        if self.store.step_done(task_id, step):
            return
        fn()
        self.store.mark_step(task_id, step)

    def apply(self, v: Valid, task: dict) -> None:
        tid = task["id"]
        s = self._step
        if v.type in ("EVENT", "BLOCK", "INFO"):
            # Resolve the target first: a missing calendar must not leave a
            # half-applied item (e.g. a renamed task) behind.
            cal_id, cal_display = self.calendar_for(v)
        if v.type in ("TASK", "WAITING"):
            s(tid, "todoist_update", lambda: self._update_task(tid, v, task))
            if v.reminder:
                s(tid, "todoist_reminder", lambda: self.todoist.add_reminder(tid))
            s(tid, "todoist_move", lambda: self.todoist.move_task(tid, config.H2_PROJECT_ID))
        elif v.type == "BLOCK":
            s(tid, "todoist_update", lambda: self.todoist.update_task(tid, _task_fields(v, task)))
            if v.reminder:
                s(tid, "todoist_reminder", lambda: self.todoist.add_reminder(tid))
            s(tid, "gcal_insert", lambda: self.gcal.insert_event(
                cal_id, _event_body(v, task, "BLOCK")))
            s(tid, "todoist_move", lambda: self.todoist.move_task(tid, config.H2_PROJECT_ID))
        elif v.type == "EVENT":
            s(tid, "gcal_insert", lambda: self.gcal.insert_event(
                cal_id, _event_body(v, task, "EVENT")))
            comment = "→ kalendář" if cal_id == config.PRIMARY_CALENDAR_ID else f"→ {cal_display}"
            s(tid, "todoist_comment", lambda: self.todoist.add_comment(tid, comment))
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
                cal_id, _event_body(v, task, "INFO")))
            s(tid, "todoist_comment", lambda: self.todoist.add_comment(tid, "→ H2 · Info"))
            s(tid, "todoist_close", lambda: self.todoist.close_task(tid))
        else:  # pragma: no cover - validate() never yields another type
            raise ValueError(v.type)

    def mark_unknown(self, task_id: str, reason: str) -> None:
        self._step(task_id, "todoist_comment_unknown",
                   lambda: self.todoist.add_comment(task_id, f"❓ {reason}"))

    def mark_apply_quarantine(self, task_id: str, reason: str, task: dict) -> None:
        """After config.APPLY_QUARANTINE_ATTEMPTS failed writes: stop retrying every
        minute, tag it for manual triage, leave it open in the Inbox unchanged."""
        labels = list(dict.fromkeys([*(task.get("labels") or []), config.QUARANTINE_LABEL]))
        self._step(task_id, "todoist_label_quarantine",
                   lambda: self.todoist.update_task(task_id, {"labels": labels}))
        self._step(task_id, "todoist_comment_quarantine",
                   lambda: self.todoist.add_comment(task_id, f"❓ Watcher: {reason}"))
