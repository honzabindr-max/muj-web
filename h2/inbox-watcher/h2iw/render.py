"""H2 Emoji Dictionary v0.3 — deterministic mapping from validated data.

Order: [⭐] [kontext] [oblast] Název. ⭐ / `top` (formerly `focus`) is NEVER set by the watcher.
"""

from __future__ import annotations

from .validate import Valid

CONTEXT_EMOJI = {"telefon": "📞", "doma": "🏠", "venku": "🚗"}
WAITING_EMOJI = "⏳"
AREA_EMOJI = {
    "prace": "💼",
    "projekty": "🚀",
    "zdravi": "🩺",
    "rodina": "👨‍👩‍👧‍👦",
    "vztah": "❤️",
    "domacnost": "🏡",
    "zvirata": "🐶",
    "urady": "🧾",
    "finance": "💰",
    "pohyb": "🏋️",
}
TYPE_ICON = {
    "TASK": "✅",
    "WAITING": "⏳",
    "EVENT": "📅",
    "INFO": "ℹ️",
    "BLOCK": "🟪",
    "NOTE": "📝",
    "COMMAND": "➡️",
}
NOTE_SUBTYPE_LABEL = {"idea": "nápad", "journal": "deník", "person": "o lidech", "other": "jiné"}


def _join(parts: list[str | None]) -> str:
    return " ".join(p for p in parts if p)


def task_title(v: Valid) -> str:
    """Todoist content for TASK / WAITING / BLOCK."""
    ctx = WAITING_EMOJI if v.type == "WAITING" else CONTEXT_EMOJI.get(v.context or "")
    return _join([ctx, AREA_EMOJI.get(v.area or ""), v.title])


def task_labels(v: Valid) -> list[str]:
    """Context label (telefon/doma/venku, or ceka) + life label for TASK/BLOCK."""
    if v.type == "WAITING":
        return ["ceka"]
    labels = [v.context] if v.context else []
    if v.type in ("TASK", "BLOCK") and v.life:
        labels.append(v.life)
    return labels


def calendar_title(v: Valid) -> str:
    """Calendar summary: [oblast] Název (type is shown by calendar colour)."""
    return _join([AREA_EMOJI.get(v.area or ""), v.title])


DAY_NAMES = ["po", "út", "st", "čt", "pá", "so", "ne"]


def when(v: Valid) -> str:
    if v.start is not None:
        s = v.start
        return f"{DAY_NAMES[s.weekday()]} {s.day}. {s.month}. {s:%H:%M}–{v.end:%H:%M}"
    if v.all_day_date is not None:
        d = v.all_day_date
        return f"{DAY_NAMES[d.weekday()]} {d.day}. {d.month}. celý den"
    parts = []
    if v.due_date is not None:
        d = v.due_date
        t = f" {v.due_time:%H:%M}" if v.due_time else ""
        parts.append(f"📆 {DAY_NAMES[d.weekday()]} {d.day}. {d.month}.{t}")
    if v.deadline_date is not None:
        d = v.deadline_date
        parts.append(f"⚠️ do {d.day}. {d.month}.")
    return " ".join(parts)


def command_line(source_text: str) -> str:
    text = " ".join(source_text.split())[:200]
    return f"➡️ předáno Plánovači: {text}"


PINNED_LINE = "📌 pevné"


def is_pinned(v: Valid) -> bool:
    """Planning OS v0.6 §4: every dictated EVENT outside the primary calendar is
    PEVNÉ (including all-day). povinnost (primary) is fixed by its calendar;
    BLOCK is always FLEX."""
    return v.type == "EVENT" and v.life is not None and v.life != "povinnost"


def calendar_prefix(v: Valid) -> str | None:
    """Colour + calendar name for calendar items (Planning OS v0.4 §2)."""
    from . import config

    if v.type == "INFO":
        return f"{config.INFO_COLOUR} {config.INFO_CALENDAR_NAME}"
    if v.type in ("EVENT", "BLOCK") and v.life in config.LIFE_CALENDARS:
        colour, _, display = config.LIFE_CALENDARS[v.life]
        return f"{colour} {display}"
    return None


def summary_line(v: Valid) -> str:
    if v.type == "NOTE":
        return f"📝 poznámka uložena ({NOTE_SUBTYPE_LABEL[v.note_subtype]}): {v.title}"
    title = task_title(v) if v.type in ("TASK", "WAITING", "BLOCK") else calendar_title(v)
    extra = when(v)
    if v.reminder:
        extra = f"{extra} 🔔"
    notes = f" ({'; '.join(v.notes)})" if v.notes else ""
    prefix = calendar_prefix(v)
    if v.duration_min:
        extra = _join([extra, f"⏱ {v.duration_min} min"])
    if v.type == "TASK" and v.life:
        # "🟤 TASK Vyčistit pračku": the life colour replaces the generic icon.
        from . import config
        icon = config.LIFE_CALENDARS[v.life][0]
    else:
        icon = TYPE_ICON[v.type]
    if is_pinned(v):
        extra = _join([extra, "📌"])
    line = _join([icon, v.type, title, f"· {extra}" if extra else None]) + notes
    return f"{prefix} · {line}" if prefix else line
