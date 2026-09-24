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
from .classify import AREAS, CONTEXTS, LIVES, NOTE_SUBTYPES, TYPES

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

# Multi-intent guard (owner requirement 2026-09-23). Live eval round 2 showed
# "vyzvednout léky … a v pátek v 17:00 kadeřník" -> TASK "Vyzvednout léky",
# silently dropping the second item. If the text states an explicit clock time
# or a day, but the accepted classification uses no time / no date at all,
# something was dropped -> UNKNOWN, never a partial write.
MULTI_REASON = "více věcí najednou — rozdělit"
CLOCK_RE = re.compile(
    r"(?<!\w)([01]?\d|2[0-3])[:.][0-5]\d(?![\d.])"
    r"|\b(v|ve|od|do|kolem|před|po)\s+([01]?\d|2[0-3])(?![\d.:\w])",
    re.IGNORECASE,
)
DAY_RE = re.compile(
    r"\b(dnes|dneska|zítra|pozítří|pondělí|úterý|středa|středu|čtvrtek|pátek|sobota|sobotu|"
    r"neděle|neděli)\b|(?<!\w)\d{1,2}\.\s?\d{1,2}\.",
    re.IGNORECASE,
)

# Change requests addressed to the assistant ("smaž…", "přesuň…"). If the text
# opens with one and the model did not say COMMAND, nothing is written.
COMMAND_VERB_RE = re.compile(
    r"^\W*(smaž|smazat|vymaž|přesuň|přejmenuj|zruš|posuň|odlož|odškrtni|označ|hotovo|splněno|"
    r"vyřízeno|uprav|změň|nedovolal|nedovolala|nestihl|nestihla|nezvládl|nezvládla)\b",
    re.IGNORECASE,
)
# Past-tense status report anywhere in the text ("účetní se neozvala, …"):
# it refers to something already tracked, so it must never become a new
# TASK/WAITING (that would duplicate the existing task).
STATUS_REPORT_RE = re.compile(
    r"\b(neozval[aoi]?|nedovolal[aoi]?|nestihl[aoi]?|nezvládl[aoi]?|nevyšl[oa])\b",
    re.IGNORECASE,
)
# A time RANGE means reserved time (BLOCK/EVENT/INFO with start+end), never a
# TASK with a single due time. If the model returns TASK/WAITING anyway, the
# end of the range was dropped -> stay in the Inbox.
FROM_TO_RANGE_RE = re.compile(
    r"\bod\s+([01]?\d|2[0-3])([:.][0-5]\d)?\s+do\s+([01]?\d|2[0-3])\b", re.IGNORECASE)
DASH_RANGE_RE = re.compile(
    r"(?<![\d.])([01]?\d|2[0-3])([:.][0-5]\d)?\s*(–|-|až)\s*([01]?\d|2[0-3])([:.][0-5]\d)?(?![\d.])",
    re.IGNORECASE)


def is_time_range(text: str) -> bool:
    """"od 10 do 11" always; "10–12" / "9 až 10" only next to a day word or
    with minutes, so quantities like "koupit 2-3 žárovky" are not ranges."""
    if FROM_TO_RANGE_RE.search(text):
        return True
    m = DASH_RANGE_RE.search(text)
    return bool(m) and (DAY_RE.search(text) is not None or ":" in m.group(0))
RANGE_AS_TASK_REASON = "časový rozsah patří do kalendáře jako blok — zkontrolovat"
COMMAND_GUARD_REASON = "vypadá jako příkaz nebo stavová aktualizace — neprovádím, napiš to do chatu s Claudem"

# Explicit reminder request in the text. A TASK/WAITING with an explicit time
# then gets a Todoist push reminder at due time; without a time only the date.
REMINDER_RE = re.compile(r"\b(připom[eě]\w*|připomín\w*|upozorn\w*)", re.IGNORECASE)

# Planning OS v0.5 guards (never trust the model alone for these):
# - things done "cestou" are a TASK with a time, never a calendar item
# - "podívat se / nezapomenout / připomeň" are Todoist reminders, never calendar
# - rituals and lunch (cigaretka, kafe, oběd) are managed by the Planner: ❓
ON_THE_WAY_RE = re.compile(r"\bcestou\b", re.IGNORECASE)
LOOK_REMIND_RE = re.compile(r"\b(podívat\s+se|se\s+podívat|podívej\s+se|mrknout|nezapomen\w*|připom[eě]\w*|upozorn\w*)",
                            re.IGNORECASE)
RITUAL_RE = re.compile(r"\b(cigaret\w*|cigár\w*|kaf[eí]\w*|kafíčk\w*|oběd\w*)", re.IGNORECASE)
# v0.5: time spent WITH a specific person is lide, even a trip or a pub.
WITH_PERSON_RE = re.compile(
    r"\b(se?|spolu\s+s)\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+"
    r"|\bs(e)?\s+(dětmi|dětma|klukama|kluky|holkama|tátou|taťkou|mámou|mamkou|babičkou|dědou|"
    r"rodinou|kamarád\w*|kámo\w*|přítel\w*)\b"
    r"|\bmám\s+kluky\b",
)
ON_THE_WAY_REASON = "věc „cestou\" patří do úkolu s časem, ne do kalendáře — zkontrolovat"
LOOK_REMIND_REASON = "připomínka patří do úkolu s datem, ne do kalendáře — zkontrolovat"
RITUAL_REASON = "rituál / oběd do kalendáře nezakládám — spravuje Plánovač"

MAX_DAYS_AHEAD = 400
MAX_TIMED_HOURS = 12
MAX_MULTI_DAY_SPAN = 21  # Planning OS v0.11 §3: cap a recurring all-day span


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
    all_day_end_date: date | None = None
    note_subtype: str | None = None
    reminder: bool = False
    life: str | None = None
    duration_min: int | None = None
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
    if (isinstance(raw, dict) and source_text and raw.get("all_day_date") and raw.get("start")
            and TIME_SIGNAL_RE.search(source_text) is None):
        # Model gave an all-day date AND an invented time: keep the all-day date.
        raw = dict(raw, start=None, end=None)
    try:
        v = _validate(raw, now)
    except _Reject as e:
        return Invalid(str(e))
    if isinstance(v, Valid) and source_text and v.type != "COMMAND":
        if COMMAND_VERB_RE.search(source_text):
            return Invalid(COMMAND_GUARD_REASON)
        if v.type in ("TASK", "WAITING") and STATUS_REPORT_RE.search(source_text):
            return Invalid(COMMAND_GUARD_REASON)
        if v.type in ("TASK", "WAITING") and is_time_range(source_text):
            return Invalid(RANGE_AS_TASK_REASON)
        v = _check_time_is_stated(v, source_text)
        if isinstance(v, Valid):
            v = _check_nothing_dropped(v, source_text)
        if isinstance(v, Valid):
            v = _check_v05_rules(v, source_text)
        if isinstance(v, Valid):
            # v0.5 §5: a task with a time ALWAYS gets a reminder at that time,
            # including the task behind a BLOCK (due = block start).
            v.reminder = ((v.type in ("TASK", "WAITING") and v.due_time is not None)
                          or (v.type == "BLOCK" and v.start is not None))
    return v


def _check_v05_rules(v: Valid, text: str) -> Valid | Invalid:
    calendar = v.type in ("EVENT", "BLOCK", "INFO")
    if (v.type in ("EVENT", "BLOCK", "TASK") and v.life in ("zazitky", "regenerace")
            and WITH_PERSON_RE.search(text)):
        v.life = "lide"
        v.notes.append("s konkrétním člověkem → lide")
    if v.type in ("EVENT", "BLOCK") and ON_THE_WAY_RE.search(text):
        return Invalid(ON_THE_WAY_REASON)
    if calendar and LOOK_REMIND_RE.search(text):
        return Invalid(LOOK_REMIND_REASON)
    if RITUAL_RE.search(text):
        if v.type in ("EVENT", "BLOCK") and v.life != "lide":  # "oběd s dětmi" stays
            return Invalid(RITUAL_REASON)
        if v.type == "TASK" and v.life == "regenerace":
            return Invalid(RITUAL_REASON)
    return v


def _check_nothing_dropped(v: Valid, text: str) -> Valid | Invalid:
    if v.type == "NOTE":
        return v  # journal/person notes mention days naturally; nothing is scheduled
    uses_time = v.start is not None or v.due_time is not None
    uses_date = uses_time or any(
        d is not None for d in (v.due_date, v.deadline_date, v.all_day_date)
    )
    if CLOCK_RE.search(text) and not uses_time:
        return Invalid(f"{MULTI_REASON} (čas ze vstupu nebyl použit)")
    if DAY_RE.search(text) and not uses_date:
        return Invalid(f"{MULTI_REASON} (den ze vstupu nebyl použit)")
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
    if v.type in ("INFO", "EVENT") and v.start is not None:
        # Someone else's plan, or a fixed EVENT, with an invented time: keep
        # the day, drop the time (Planning OS v0.11 §1/§3 — never Invalid,
        # apply.py turns the day into an 8:00-18:00 placeholder).
        v.all_day_date, v.start, v.end = v.start.date(), None, None
        v.notes.append("čas ve vstupu není → celý den")
        return v
    if v.type in ("TASK", "WAITING"):
        v.due_time = None
        v.notes.append("čas ve vstupu není → jen datum")
        return v
    return Invalid("blok bez jasného času")


def _validate(raw, now: datetime) -> Valid | Invalid:
    if not isinstance(raw, dict):
        raise _Reject("výstup modelu není objekt")
    today = now.astimezone(config.TZ).date()

    t = raw.get("type")
    if t not in TYPES:
        raise _Reject("neznámý typ")
    reason = raw.get("reason") if isinstance(raw.get("reason"), str) else ""
    reason = reason.strip()[:200]
    if t == "COMMAND":
        # Never executed, only handed to the Planner as one item: dates, times and
        # several changes inside it describe targets, not plans of the watcher.
        title = raw.get("title") if isinstance(raw.get("title"), str) else ""
        return Valid(type="COMMAND", title=" ".join(title.split())[:120], reason=reason)
    if raw.get("multiple_items") is True:
        return Invalid(MULTI_REASON)
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

    life = raw.get("life")
    if life is not None and life not in LIVES:
        raise _Reject("neplatný druh času")
    duration = raw.get("duration_min")
    if duration is not None and duration not in config.TASK_DURATIONS_MIN:
        raise _Reject("neplatný odhad délky")
    v = Valid(type=t, title=title, area=area, reason=reason,
              life=life if t in ("TASK", "EVENT", "BLOCK") else None,
              duration_min=duration if t == "TASK" else None)
    if t == "TASK" and v.life is None:
        v.life = "fokus"
        v.notes.append("druh času nezadán → fokus")
    v.due_date = _date(raw.get("due_date"), "due_date", today)
    v.deadline_date = _date(raw.get("deadline_date"), "deadline_date", today)
    v.all_day_date = _date(raw.get("all_day_date"), "all_day_date", today)
    v.all_day_end_date = _date(raw.get("all_day_end_date"), "all_day_end_date", today)
    if v.all_day_end_date is not None and v.all_day_date is None:
        raise _Reject("konec vícedenní akce bez začátku")
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

    if t in ("TASK", "WAITING") and (v.start or v.end or v.all_day_date or v.all_day_end_date):
        raise _Reject("úkol nesmí mít kalendářní čas")
    if t == "NOTE":
        if any(x is not None for x in (v.due_date, v.due_time, v.deadline_date, v.start,
                                       v.end, v.all_day_date, v.all_day_end_date)):
            raise _Reject("poznámka s termínem — zkontrolovat")
        sub = raw.get("note_subtype")
        if sub is not None and sub not in NOTE_SUBTYPES:
            raise _Reject("neplatný typ poznámky")
        v.note_subtype = sub or "other"
        v.context = v.area = None
    return _validate_calendar(v)


def _validate_calendar(v: Valid) -> Valid | Invalid:
    t = v.type
    if t in ("TASK", "WAITING", "NOTE"):
        return v

    if t == "EVENT" and v.start is None and v.all_day_date is not None:
        # Planning OS v0.11 §1/§3/§4: EVENT with a known day but no exact
        # time is never all-day on the calendar — apply.py turns it into an
        # 8:00-18:00 placeholder. render.calendar_title flags a single-day
        # povinnost placeholder ("⏳ … čas ❓"); every other life stays plain.
        if v.life is None:
            v.life = "povinnost"
            v.notes.append("druh času nezadán → povinnost")
        if v.all_day_end_date is not None:
            if v.all_day_end_date < v.all_day_date:
                raise _Reject("konec vícedenní akce je před začátkem")
            days = (v.all_day_end_date - v.all_day_date).days + 1
            if days > MAX_MULTI_DAY_SPAN:
                return Invalid(f"vícedenní akce déle než {MAX_MULTI_DAY_SPAN} dní — zkontrolovat")
        v.due_date = v.due_time = v.deadline_date = None
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
        life = v.life
        if life is None:
            v.life = "povinnost" if t == "EVENT" else "fokus"
            v.notes.append(f"druh času nezadán → {v.life}")
        if t == "EVENT" and (v.due_date or v.due_time or v.deadline_date):
            v.due_date = v.due_time = v.deadline_date = None  # irrelevant, task gets closed
    elif t == "INFO":
        if v.start is None and v.all_day_date is None:
            return Invalid("info bez data")
        if v.start is not None and (v.all_day_date is not None or v.all_day_end_date is not None):
            raise _Reject("info nesmí být časované i celodenní")
        if v.start is not None and v.end is None:
            v.end = v.start + timedelta(minutes=config.EVENT_DEFAULT_MINUTES)
            v.notes.append(f"konec nezadán → {config.EVENT_DEFAULT_MINUTES} min")
        if v.all_day_date is not None and v.all_day_end_date is not None:
            if v.all_day_end_date < v.all_day_date:
                raise _Reject("konec vícedenní akce je před začátkem")
            days = (v.all_day_end_date - v.all_day_date).days + 1
            if days > MAX_MULTI_DAY_SPAN:
                return Invalid(f"vícedenní akce déle než {MAX_MULTI_DAY_SPAN} dní — zkontrolovat")
        v.due_date = v.due_time = v.deadline_date = None

    if v.start is not None:
        if v.end <= v.start:
            raise _Reject("konec je před začátkem")
        if v.end - v.start > timedelta(hours=MAX_TIMED_HOURS):
            raise _Reject("událost delší než 12 h")
    return v
