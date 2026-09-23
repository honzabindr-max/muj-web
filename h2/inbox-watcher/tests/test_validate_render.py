import pytest
from conftest import FIXTURES, NOW, case

from h2iw import render
from h2iw.validate import Invalid, Valid, validate


def test_fixture_set_is_big_enough_and_covers_every_type():
    cases = FIXTURES["cases"]
    assert len(cases) >= 15
    assert {c["expected_type"] for c in cases} == {
        "TASK", "WAITING", "EVENT", "INFO", "BLOCK", "NOTE", "UNKNOWN"
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
    assert render.task_labels(v) == ["telefon"]


def test_waiting_uses_hourglass_and_ceka_label():
    v = validate(case("waiting_followup")["mock_output"], NOW)
    assert render.task_title(v).startswith("⏳ 💼 ")
    assert render.task_labels(v) == ["ceka"]


def test_no_emoji_when_no_context_or_area():
    v = validate(dict(_base(), context=None, area=None), NOW)
    assert render.task_title(v) == "Zavolat účetní kvůli DPH"
    assert render.task_labels(v) == []


def test_calendar_title_is_area_only():
    v = validate(case("event_dentist")["mock_output"], NOW)
    assert render.calendar_title(v) == "🩺 Zubař"


@pytest.mark.parametrize("c", FIXTURES["cases"], ids=lambda c: c["id"])
def test_never_star_or_focus(c):
    v = validate(c["mock_output"], NOW)
    if isinstance(v, Valid):
        assert "⭐" not in render.task_title(v)
        assert "focus" not in render.task_labels(v)
        render.summary_line(v)  # renders without error


# --- time must be stated in the source text (live eval finding 2026-09-23) --

def _event(start, t="EVENT"):
    return dict(case("event_dentist")["mock_output"], type=t, start=start)


def test_invented_midnight_event_is_rejected():
    v = validate(_event("2026-09-29T00:00"), NOW, "kontrola na chirurgii v úterý")
    assert isinstance(v, Invalid) and "času" in v.reason


def test_invented_time_without_any_time_signal_is_rejected():
    v = validate(_event("2026-09-29T09:00"), NOW, "kontrola na chirurgii v úterý")
    assert isinstance(v, Invalid)


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
    assert (isinstance(v, Invalid) and c["expected_type"] == "UNKNOWN") or v.type == c["expected_type"]


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
