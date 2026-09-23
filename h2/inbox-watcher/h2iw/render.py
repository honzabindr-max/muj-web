"""H2 Emoji Dictionary v0.3 — deterministic mapping from validated data.

Order: [⭐] [kontext] [oblast] Název. ⭐ / `focus` is NEVER set by the watcher.
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
    if v.type == "WAITING":
        return ["ceka"]
    return [v.context] if v.context else []


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


def summary_line(v: Valid) -> str:
    if v.type == "NOTE":
        return f"📝 poznámka uložena ({NOTE_SUBTYPE_LABEL[v.note_subtype]}): {v.title}"
    title = task_title(v) if v.type in ("TASK", "WAITING", "BLOCK") else calendar_title(v)
    extra = when(v)
    if v.reminder:
        extra = f"{extra} 🔔"
    notes = f" ({'; '.join(v.notes)})" if v.notes else ""
    return _join([TYPE_ICON[v.type], v.type, title, f"· {extra}" if extra else None]) + notes
