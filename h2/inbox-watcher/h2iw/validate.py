"""Deterministic validation of the model proposal.

Pure function: (raw model JSON, now) -> Valid(normalized) | Invalid(reason).
Anything not explicitly allowed is rejected; rejected items stay in the Inbox
as UNKNOWN with a comment.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from . import config
from .classify import AREAS, CONTEXTS, TYPES

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")
DT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")

# Deterministic check that the source text states a clock time at all: a
# clock-like number (0-23, optional :mm) or a Czech number/time word. Guards
# against the model inventing a time (observed in live eval 2026-09-23:
# "kontrola na chirurgii v úterý" -> EVENT at 00:00).
TIME_SIGNAL_RE = re.compile(
    r"(?<!\w)([01]?\d|2[0-3])([:.][0-5]\d)?(?!\w)|\b(půl|čtvrt|poledn|půlnoc|jedn|dv[aěou]|tř[iíe]|čtyř|pět|šest|sedm|osm|"
    r"devět|devít|deset|jedenáct|dvanáct)",
    re.IGNORECASE,
)
MIDNIGHT_RE = re.compile(r"půlnoc|\b0?0[:.]00\b|\b24[:.]00\b", re.IGNORECASE)

MAX_DAYS_AHEAD = 400
MAX_TIMED_HOURS = 12


@dataclass
class Valid:
    type: str
    title: str
    context: str | None = None
    area: str | None = None
    due_date: date | None = None
    due_time: time | None = None
    deadline_date: date | None = None
    start: datetime | None = None  # tz-aware, Europe/Prague
    end: datetime | None = None
    all_day_date: date | None = None
    reason: str = ""
    notes: list[str] = field(default_factory=list)  # e.g. defaulted end time


@dataclass
class Invalid:
    reason: str


class _Reject(Exception):
    pass


def _date(value, name: str, today: date) -> date | None:
    if value is None:
        return None
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise _Reject(f"{name}: neplatný formát data")
    try:
        d = date.fromisoformat(value)
    except ValueError:
        raise _Reject(f"{name}: neexistující datum")
    if d < today - timedelta(days=1) or d > today + timedelta(days=MAX_DAYS_AHEAD):
        raise _Reject(f"{name}: datum mimo rozumné okno")
    return d


def _dt(value, name: str, today: date) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str) or not DT_RE.match(value):
        raise _Reject(f"{name}: neplatný formát času")
    try:
        naive = datetime.fromisoformat(value)
    except ValueError:
        raise _Reject(f"{name}: neexistující čas")
    _date(naive.date().isoformat(), name, today)
    return naive.replace(tzinfo=config.TZ)


def validate(raw: dict | None, now: datetime, source_text: str = "") -> Valid | Invalid:
    try:
        v = _validate(raw, now)
    except _Reject as e:
        return Invalid(str(e))
    if isinstance(v, Valid) and source_text:
        return _check_time_is_stated(v, source_text)
    return v


def _check_time_is_stated(v: Valid, text: str) -> Valid | Invalid:
    timed = v.start is not None or v.due_time is not None
    if not timed:
        return v
    stated = TIME_SIGNAL_RE.search(text) is not None
    midnight = (v.start is not None and v.start.hour == 0 and v.start.minute == 0) or (
        v.due_time is not None and v.due_time.hour == 0 and v.due_time.minute == 0
    )
    if stated and not (midnight and not MIDNIGHT_RE.search(text)):
        return v
    if v.type == "INFO" and v.start is not None:
        # Someone else's plan with an invented time: keep it, but as all-day (FREE).
        v.all_day_date, v.start, v.end = v.start.date(), None, None
        v.notes.append("čas ve vstupu není → celý den")
        return v
    if v.type in ("TASK", "WAITING"):
        v.due_time = None
        v.notes.append("čas ve vstupu není → jen datum")
        return v
    return Invalid("pevný termín bez jasného času" if v.type == "EVENT" else "blok bez jasného času")


def _validate(raw, now: datetime) -> Valid | Invalid:
    if not isinstance(raw, dict):
        raise _Reject("výstup modelu není objekt")
    today = now.astimezone(config.TZ).date()

    t = raw.get("type")
    if t not in TYPES:
        raise _Reject("neznámý typ")
    reason = raw.get("reason") if isinstance(raw.get("reason"), str) else ""
    reason = reason.strip()[:200]
    if t == "UNKNOWN":
        return Invalid(reason or "model položku nerozpoznal")

    title = raw.get("title")
    if not isinstance(title, str) or not title.strip():
        raise _Reject("chybí název")
    title = " ".join(title.split())
    if len(title) > 120:
        raise _Reject("název je příliš dlouhý")

    ctx = raw.get("context")
    if ctx is not None and ctx not in CONTEXTS:
        raise _Reject("neplatný kontext")
    area = raw.get("area")
    if area is not None and area not in AREAS:
        raise _Reject("neplatná oblast")

    v = Valid(type=t, title=title, area=area, reason=reason)
    v.due_date = _date(raw.get("due_date"), "due_date", today)
    v.deadline_date = _date(raw.get("deadline_date"), "deadline_date", today)
    v.all_day_date = _date(raw.get("all_day_date"), "all_day_date", today)
    v.start = _dt(raw.get("start"), "start", today)
    v.end = _dt(raw.get("end"), "end", today)

    due_time = raw.get("due_time")
    if due_time is not None:
        if not isinstance(due_time, str) or not TIME_RE.match(due_time):
            raise _Reject("due_time: neplatný formát")
        try:
            v.due_time = time.fromisoformat(due_time)
        except ValueError:
            raise _Reject("due_time: neexistující čas")
        if v.due_date is None:
            raise _Reject("čas úkolu bez data")

    # WAITING: `ceka` replaces context (Planning OS §3/§4).
    v.context = None if t == "WAITING" else ctx

    if t in ("TASK", "WAITING") and (v.start or v.end or v.all_day_date):
        raise _Reject("úkol nesmí mít kalendářní čas")
    return _validate_calendar(v)


def _validate_calendar(v: Valid) -> Valid | Invalid:
    t = v.type
    if t in ("TASK", "WAITING"):
        return v

    if t in ("EVENT", "BLOCK"):
        if v.start is None:
            return Invalid("pevný termín bez jasného času" if t == "EVENT" else "blok bez času začátku")
        if v.all_day_date:
            raise _Reject("časovaná událost nesmí být celodenní")
        if v.end is None:
            minutes = config.EVENT_DEFAULT_MINUTES if t == "EVENT" else config.BLOCK_DEFAULT_MINUTES
            v.end = v.start + timedelta(minutes=minutes)
            v.notes.append(f"konec nezadán → {minutes} min")
        if t == "EVENT" and (v.due_date or v.due_time or v.deadline_date):
            v.due_date = v.due_time = v.deadline_date = None  # irrelevant, task gets closed
    elif t == "INFO":
        if v.start is None and v.all_day_date is None:
            return Invalid("info bez data")
        if v.start is not None and v.all_day_date is not None:
            raise _Reject("info nesmí být časované i celodenní")
        if v.start is not None and v.end is None:
            v.end = v.start + timedelta(minutes=config.EVENT_DEFAULT_MINUTES)
            v.notes.append(f"konec nezadán → {config.EVENT_DEFAULT_MINUTES} min")
        v.due_date = v.due_time = v.deadline_date = None

    if v.start is not None:
        if v.end <= v.start:
            raise _Reject("konec je před začátkem")
        if v.end - v.start > timedelta(hours=MAX_TIMED_HOURS):
            raise _Reject("událost delší než 12 h")
    return v
