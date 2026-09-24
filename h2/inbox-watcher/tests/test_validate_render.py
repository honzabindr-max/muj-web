import pytest
from conftest import FIXTURES, NOW, case

from h2iw import render
from h2iw.validate import Invalid, Valid, validate


def test_fixture_set_is_big_enough_and_covers_every_type():
    cases = FIXTURES["cases"]
    assert len(cases) >= 15
    assert {c["expected_type"] for c in cases} == {
        "TASK", "WAITING", "EVENT", "INFO", "BLOCK", "NOTE", "COMMAND", "UNKNOWN"
    }
    assert sum(c["expected_type"] == "NOTE" for c in cases) >= 5


@pytest.mark.parametrize("c", FIXTURES["cases"], ids=lambda c: c["id"])
def test_mock_output_validates_to_expected_type(c):
    v = validate(c["mock_output"], NOW)
    if c["expected_type"] == "UNKNOWN":
        assert isinstance(v, Invalid)
        assert v.reason
    else:
        assert isinstance(v, Valid), getattr(v, "reason", "")
        assert v.type == c["expected_type"]


def _base(**over):
    d = dict(case("task_phone_finance")["mock_output"])
    d.update(over)
    return d


@pytest.mark.parametrize("over,needle", [
    ({"type": "FOCUS"}, "typ"),
    ({"context": "pocitac"}, "kontext"),
    ({"context": "focus"}, "kontext"),
    ({"area": "hobby"}, "oblast"),
    ({"due_date": "zítra"}, "formát"),
    ({"due_date": "2026-02-30"}, "neexistující"),
    ({"due_date": "2031-01-01"}, "okno"),
    ({"due_time": "08:00"}, "bez data"),
    ({"title": "  "}, "název"),
    ({"start": "2026-09-24T10:00"}, "kalendářní"),
])
def test_rejections(over, needle):
    v = validate(_base(**over), NOW)
    assert isinstance(v, Invalid) and needle in v.reason


def test_event_default_end_and_timezone():
    v = validate(case("event_dentist")["mock_output"], NOW)
    assert v.start.utcoffset().total_seconds() == 2 * 3600  # CEST
    assert (v.end - v.start).total_seconds() == 3600
    assert v.notes


def test_event_end_before_start_rejected():
    d = dict(case("event_meeting_range")["mock_output"], end="2026-09-24T09:00")
    assert isinstance(validate(d, NOW), Invalid)


def test_event_longer_than_12h_rejected():
    d = dict(case("event_meeting_range")["mock_output"], end="2026-09-25T11:00")
    assert isinstance(validate(d, NOW), Invalid)


def test_waiting_drops_context():
    d = dict(case("waiting_followup")["mock_output"], context="telefon")
    v = validate(d, NOW)
    assert v.context is None


def test_non_dict_output():
    assert isinstance(validate(None, NOW), Invalid)
    assert isinstance(validate([], NOW), Invalid)


# --- render --------------------------------------------------------------

def test_task_title_order_context_then_area():
    v = validate(case("task_phone_finance")["mock_output"], NOW)
    assert render.task_title(v) == "📞 💰 Zavolat účetní kvůli DPH"
    assert render.task_labels(v) == ["telefon", "fokus"]


def test_waiting_uses_hourglass_and_ceka_label():
    v = validate(case("waiting_followup")["mock_output"], NOW)
    assert render.task_title(v).startswith("⏳ 💼 ")
    assert render.task_labels(v) == ["ceka"]


def test_no_emoji_when_no_context_or_area():
    v = validate(dict(_base(), context=None, area=None), NOW)
    assert render.task_title(v) == "Zavolat účetní kvůli DPH"
    assert render.task_labels(v) == ["fokus"]


def test_calendar_title_is_area_only():
    v = validate(case("event_dentist")["mock_output"], NOW)
    assert render.calendar_title(v) == "🩺 Zubař"


@pytest.mark.parametrize("c", FIXTURES["cases"], ids=lambda c: c["id"])
def test_never_star_top_or_focus(c):
    v = validate(c["mock_output"], NOW)
    if isinstance(v, Valid):
        assert "⭐" not in render.task_title(v)
        assert "focus" not in render.task_labels(v)
        assert "top" not in render.task_labels(v)
        render.summary_line(v)  # renders without error


# --- time must be stated in the source text (live eval finding 2026-09-23) --

def _event(start, t="EVENT"):
    return dict(case("event_dentist")["mock_output"], type=t, start=start)


def test_invented_midnight_event_becomes_all_day_placeholder():
    # Planning OS v0.11 §1/§3/§4: no longer Invalid — a known day with no
    # stated time becomes an all_day_date placeholder, never an invented time.
    v = validate(_event("2026-09-29T00:00"), NOW, "kontrola na chirurgii v úterý")
    assert isinstance(v, Valid) and v.start is None
    assert v.all_day_date.isoformat() == "2026-09-29"
    assert render.calendar_title(v) == "⏳ 🩺 Zubař — čas ❓"


def test_invented_time_without_any_time_signal_becomes_all_day():
    v = validate(_event("2026-09-29T09:00"), NOW, "kontrola na chirurgii v úterý")
    assert isinstance(v, Valid) and v.start is None
    assert v.all_day_date.isoformat() == "2026-09-29"


def test_block_without_stated_time_is_rejected():
    d = dict(case("block_project")["mock_output"])
    assert isinstance(validate(d, NOW, "v sobotu dělám na H2"), Invalid)


def test_stated_time_passes():
    assert isinstance(validate(_event("2026-09-28T14:30"), NOW, "zubař v pondělí ve 14:30"), Valid)
    d = case("info_partner_timed")
    assert isinstance(validate(d["mock_output"], NOW, d["text"]), Valid)


def test_explicit_midnight_passes():
    assert isinstance(validate(_event("2026-09-29T00:00"), NOW, "odjezd o půlnoci v úterý"), Valid)


def test_info_with_invented_time_becomes_all_day():
    d = dict(case("info_partner_timed")["mock_output"])
    v = validate(d, NOW, "Markétka má v pátek firemní akci")
    assert isinstance(v, Valid) and v.start is None
    assert v.all_day_date.isoformat() == "2026-09-25"


def test_task_with_invented_time_keeps_only_date():
    d = dict(case("task_due_time")["mock_output"])
    v = validate(d, NOW, "zítra zavolat do školky")
    assert isinstance(v, Valid) and v.due_time is None and v.due_date is not None


@pytest.mark.parametrize("c", FIXTURES["cases"], ids=lambda c: c["id"])
def test_fixture_expectations_hold_with_source_text(c):
    v = validate(c["mock_output"], NOW, c["text"])
    assert (isinstance(v, Invalid) and c["expected_type"] == "UNKNOWN") or v.type in c.get("accept_types", [c["expected_type"]])


# --- multi-intent guard (owner requirement 2026-09-23) ---------------------

def test_model_flag_multiple_items_is_unknown_with_owner_wording():
    v = validate(case("multiple_items")["mock_output"], NOW, case("multiple_items")["text"])
    assert isinstance(v, Invalid) and v.reason == "více věcí najednou — rozdělit"


def test_partial_classification_observed_in_eval_is_caught():
    # Live eval round 2: model returned only the first item and dropped "v pátek v 17:00 kadeřník".
    c = case("multiple_items")
    partial = dict(case("task_errand")["mock_output"], title="Vyzvednout léky v lékárně",
                   area="zdravi", multiple_items=False)
    v = validate(partial, NOW, c["text"])
    assert isinstance(v, Invalid) and v.reason.startswith("více věcí najednou — rozdělit")


def test_dropped_day_is_caught():
    partial = dict(case("task_phone_finance")["mock_output"], title="Zavolat instalatérovi")
    v = validate(partial, NOW, case("multi_call_and_gift")["text"])
    assert isinstance(v, Invalid) and "více věcí" in v.reason


def test_single_shopping_list_is_not_multi():
    c = case("task_shopping_list_is_one")
    assert validate(c["mock_output"], NOW, c["text"]).type == "TASK"


# --- NOTE ------------------------------------------------------------------

def test_note_subtypes_and_summary():
    for cid, sub in [("note_idea_app", "idea"), ("note_journal", "journal"),
                     ("note_person_partner", "person"), ("note_other_wifi", "other")]:
        c = case(cid)
        v = validate(c["mock_output"], NOW, c["text"])
        assert v.type == "NOTE" and v.note_subtype == sub
        assert render.summary_line(v).startswith("📝 poznámka uložena")


def test_note_with_date_is_rejected():
    d = dict(case("note_idea_app")["mock_output"], due_date="2026-09-24")
    assert isinstance(validate(d, NOW), Invalid)


def test_note_missing_subtype_defaults_to_other():
    d = dict(case("note_idea_app")["mock_output"], note_subtype=None)
    assert validate(d, NOW).note_subtype == "other"


def test_note_invalid_subtype_rejected():
    d = dict(case("note_idea_app")["mock_output"], note_subtype="diary")
    assert isinstance(validate(d, NOW), Invalid)


def test_journal_note_mentioning_today_is_not_multi():
    c = case("note_journal")
    assert validate(c["mock_output"], NOW, c["text"]).type == "NOTE"


# --- COMMAND (owner requirement 2026-09-23) --------------------------------

def test_command_is_valid_and_ignores_dates():
    c = case("command_delete_event")
    d = dict(c["mock_output"], start="2026-09-24T14:30", due_date="2026-09-24")
    v = validate(d, NOW, c["text"])
    assert v.type == "COMMAND" and v.start is None and v.due_date is None


def test_command_verb_never_becomes_task():
    c = case("command_delete_event")
    as_task = dict(case("task_errand")["mock_output"], title="Smazat událost zubař")
    v = validate(as_task, NOW, c["text"])
    assert isinstance(v, Invalid) and "příkaz nebo stavová aktualizace" in v.reason


def test_infinitive_move_is_a_normal_task():
    c = case("task_move_sofa_not_command")
    assert validate(c["mock_output"], NOW, c["text"]).type == "TASK"


def test_command_summary_line():
    line = render.command_line("Smaž zítřejší událost   v kalendáři")
    assert line == "➡️ předáno Plánovači: Smaž zítřejší událost v kalendáři"


def test_status_update_with_waiting_and_reminder_is_one_command():
    c = case("command_status_patrik")
    d = dict(c["mock_output"], multiple_items=True, due_date="2026-09-24")
    v = validate(d, NOW, c["text"])
    assert v.type == "COMMAND"


def test_status_update_misread_as_waiting_stays_in_inbox():
    c = case("command_status_patrik")
    as_waiting = dict(case("waiting_followup")["mock_output"], title="Patrik odpoví")
    v = validate(as_waiting, NOW, c["text"])
    assert isinstance(v, Invalid) and "stavová aktualizace" in v.reason


# --- reminders (owner requirement 2026-09-23) -------------------------------

def test_reminder_with_time_sets_flag_and_bell():
    c = case("task_reminder_imbus")
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "TASK" and v.reminder and v.due_time.isoformat() == "20:15:00"
    assert "🔔" in render.summary_line(v)


def test_reminder_without_time_is_date_only():
    c = case("task_reminder_no_time")
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "TASK" and not v.reminder and v.due_time is None and v.due_date


def test_task_with_time_always_has_reminder_v05():
    c = case("task_due_time")  # "zítra v 8 zavolat do školky", no reminder phrase
    assert validate(c["mock_output"], NOW, c["text"]).reminder


# --- life -----------------------------------------------------------------

def test_event_without_life_stays_none_block_defaults_to_fokus():
    # Planning OS v0.11.1 §2: EVENT never defaults to povinnost any more —
    # apply.calendar_for routes a life-less EVENT to ⚪ H2 · Info instead.
    e = dict(case("event_dentist")["mock_output"], life=None)
    b = dict(case("block_project")["mock_output"], life=None)
    assert validate(e, NOW).life is None
    assert validate(b, NOW).life == "fokus"


def test_invalid_life_rejected():
    d = dict(case("event_dentist")["mock_output"], life="prace")
    assert isinstance(validate(d, NOW), Invalid)


def test_life_ignored_outside_task_event_block():
    d = dict(case("waiting_no_date")["mock_output"], life="domov")
    assert validate(d, NOW).life is None
    assert render.task_labels(validate(d, NOW)) == ["ceka"]


def test_life_fixture_coverage():
    lives = [c.get("expected_life") for c in FIXTURES["cases"] if c.get("expected_life")]
    for life in ["povinnost", "fokus", "regenerace", "lide", "domov", "zazitky"]:
        assert lives.count(life) >= 2, life


def test_status_report_mid_text_never_becomes_waiting():
    c = case("command_status_accountant")
    as_waiting = dict(case("waiting_followup")["mock_output"], title="Účetní se ozve")
    v = validate(as_waiting, NOW, c["text"])
    assert isinstance(v, Invalid) and "stavová aktualizace" in v.reason


def test_future_waiting_is_not_caught_by_status_guard():
    c = case("waiting_no_date")
    assert validate(c["mock_output"], NOW, c["text"]).type == "WAITING"


# --- time range = BLOCK (owner requirement 2026-09-23) ----------------------

def test_range_fixture_is_block_fokus():
    c = case("block_call_patrik_range")
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "BLOCK" and v.life == "fokus"
    assert (v.start.hour, v.end.hour) == (10, 11)


def test_range_misread_as_task_stays_in_inbox():
    c = case("block_call_patrik_range")
    as_task = dict(case("task_due_time")["mock_output"], title="Zavolat Patrikovi",
                   due_time="10:00")
    v = validate(as_task, NOW, c["text"])
    assert isinstance(v, Invalid) and "rozsah" in v.reason


@pytest.mark.parametrize("text,is_range", [
    ("Zítra od 10 do 11 volám Patrikovi", True),
    ("v sobotu 10–12 kolo", True),
    ("v sobotu 9 až 10 najít sedačku", True),
    ("od 8:30 do 9:15 e-maily", True),
    ("zítra v 10 zavolat Patrikovi", False),
    ("do pátku poslat faktury", False),
    ("výlet 5.-7. 10.", False),
    ("koupit 2-3 žárovky", False),
    ("zítra koupit 2-3 žárovky", True),  # known false positive: stays in Inbox with ❓
])
def test_time_range_detection(text, is_range):
    from h2iw.validate import is_time_range
    assert is_time_range(text) is is_range


# --- TASK life label + duration (owner requirement 2026-09-23) --------------

def test_task_life_label_and_colour_line():
    c = case("task_clean_washer")
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.life == "domov" and "domov" in render.task_labels(v)
    line = render.summary_line(v)
    assert line.startswith("🟤 TASK ") and "⏱ 30 min" in line


def test_task_without_life_defaults_to_fokus():
    d = dict(case("task_sport")["mock_output"], life=None)
    v = validate(d, NOW)
    assert v.life == "fokus" and v.notes


def test_invalid_duration_rejected():
    d = dict(case("task_sport")["mock_output"], duration_min=45)
    assert isinstance(validate(d, NOW), Invalid)


def test_duration_only_on_task():
    d = dict(case("waiting_no_date")["mock_output"], duration_min=30)
    assert validate(d, NOW).duration_min is None


def test_task_life_fixture_coverage():
    lives = [c.get("expected_life") for c in FIXTURES["cases"]
             if c["expected_type"] == "TASK" and c.get("expected_life")]
    assert len(lives) >= 10
    for life in ["povinnost", "fokus", "regenerace", "lide", "domov", "zazitky"]:
        assert life in lives, life


# --- Planning OS v0.5 rules --------------------------------------------------

def test_on_the_way_never_calendar():
    c = case("task_on_the_way_bulbs")
    as_block = dict(case("block_carry_sofa")["mock_output"], start="2026-09-23T14:00",
                    end="2026-09-23T15:00")
    v = validate(as_block, NOW, c["text"])
    assert isinstance(v, Invalid) and "cestou" in v.reason
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "TASK" and v.life == "domov" and v.reminder


def test_look_remind_never_calendar():
    c = case("task_look_for_shell")
    as_event = dict(case("event_burcak")["mock_output"], all_day_date="2026-09-30", start=None)
    assert isinstance(validate(as_event, NOW, c["text"]), Invalid)
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "TASK" and v.due_date.isoformat() == "2026-09-30" and not v.reminder


def test_ritual_is_unknown_but_lunch_with_person_is_lide():
    cig = case("ritual_cigarette")
    as_event = dict(case("event_yoga")["mock_output"], title="Cigaretka", start="2026-09-24T07:00")
    v = validate(as_event, NOW, cig["text"])
    assert isinstance(v, Invalid) and "rituál" in v.reason
    lunch = case("event_lunch_dad")
    assert validate(lunch["mock_output"], NOW, lunch["text"]).life == "lide"


def test_all_day_event_is_valid_for_any_life():
    # Planning OS v0.11 §1/§3/§4: no life restriction any more. lide/zazitky
    # etc. stay plain + pinned; povinnost gets the "⏳ … čas ❓" title, never
    # pinned (rule §2's "🔴 bez 📌").
    c = case("event_mushrooms_sasenka")
    v = validate(c["mock_output"], NOW, c["text"])
    assert v.type == "EVENT" and v.life == "lide" and v.all_day_date.isoformat() == "2026-09-28"
    assert render.is_pinned(v) and render.calendar_title(v) == "Houby se Sašenkou"
    doctor = dict(c["mock_output"], life="povinnost")
    v2 = validate(doctor, NOW)
    assert isinstance(v2, Valid) and v2.life == "povinnost"
    assert not render.is_pinned(v2)
    assert render.calendar_title(v2) == "⏳ Houby se Sašenkou — čas ❓"


def test_all_day_event_with_missing_life_stays_none():
    # Planning OS v0.11.1 §2: no default any more — apply.py routes this to
    # ⚪ H2 · Info instead of guessing povinnost.
    c = case("event_mushrooms_sasenka")
    no_life = dict(c["mock_output"], life=None)
    v = validate(no_life, NOW, c["text"])
    assert v.type == "EVENT" and v.life is None
    assert render.calendar_title(v) == "⏳ Houby se Sašenkou"
    assert not render.is_pinned(v)


def test_multi_day_event_gets_end_date_and_plain_title():
    c = case("event_mushrooms_sasenka")
    trip = dict(c["mock_output"], all_day_date="2026-09-25", all_day_end_date="2026-09-27")
    v = validate(trip, NOW)
    assert isinstance(v, Valid) and v.all_day_end_date.isoformat() == "2026-09-27"
    assert render.calendar_title(v) == "Houby se Sašenkou"  # never ⏳❓, even for povinnost
    povinnost_trip = dict(trip, life="povinnost")
    v2 = validate(povinnost_trip, NOW)
    assert render.calendar_title(v2) == "Houby se Sašenkou"


def test_multi_day_event_span_is_capped():
    c = case("event_mushrooms_sasenka")
    too_long = dict(c["mock_output"], all_day_date="2026-09-25", all_day_end_date="2026-11-25")
    assert isinstance(validate(too_long, NOW), Invalid)


def test_multi_day_end_before_start_is_rejected():
    c = case("event_mushrooms_sasenka")
    bad = dict(c["mock_output"], all_day_date="2026-09-27", all_day_end_date="2026-09-25")
    assert isinstance(validate(bad, NOW), Invalid)


def test_all_day_with_invented_time_keeps_all_day():
    c = case("event_mushrooms_sasenka")
    d = dict(c["mock_output"], start="2026-09-28T08:00")
    v = validate(d, NOW, c["text"])
    assert v.type == "EVENT" and v.start is None and v.all_day_date.isoformat() == "2026-09-28"


@pytest.mark.parametrize("text,is_person", [
    ("jdu v pátek v 18 s Petrem na pivo", True),
    ("v pondělí jedu se Sašenkou na houby", True),
    ("zítra ve 12 oběd s tátou", True),
    ("v pátek od 16 mám kluky", True),
    ("v sobotu 10–12 kolo", False),
    ("v pátek ve 20 kino", False),
    ("koupit mléko s sebou", False),
])
def test_with_person_regex(text, is_person):
    from h2iw.validate import WITH_PERSON_RE
    assert bool(WITH_PERSON_RE.search(text)) is is_person


def test_person_overrides_zazitky_to_lide():
    c = case("event_i_go_beer")
    d = dict(c["mock_output"], life="zazitky")
    v = validate(d, NOW, c["text"])
    assert v.life == "lide" and "s konkrétním člověkem → lide" in v.notes
