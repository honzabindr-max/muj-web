from conftest import FIXTURES, NOW, FakeClassifier, FakeTodoist, case

from h2iw import config
from h2iw.apply import Applier
from h2iw.gcal import event_id_for
from h2iw.main import Report, Runner, format_summary
from h2iw.store import Store


def _run(env):
    return env.runner.run_once(NOW)


# --- cost guarantees -------------------------------------------------------

def test_empty_inbox_makes_no_llm_call_and_no_summary(env):
    r = _run(env)
    assert env.clf.calls == 0
    assert format_summary(r) is None
    assert env.todoist.list_calls == 1


def test_nothing_new_makes_no_llm_call(env):
    env.todoist.add("t1", case("task_phone_finance")["text"])
    _run(env)
    assert env.clf.calls == 1
    for _ in range(5):
        r = _run(env)
        assert format_summary(r) is None
    assert env.clf.calls == 1


def test_unknown_item_is_not_reclassified(env):
    env.todoist.add("u1", case("nonsense_vague")["text"])
    _run(env)
    _run(env)
    assert env.clf.calls == 1
    assert env.store.get("u1")["status"] == "UNKNOWN_MARKED"


def test_first_run_baseline_skips_existing_items(tmp_path):
    store = Store(str(tmp_path / "s.db"))
    todo, clf = FakeTodoist(), FakeClassifier()
    from conftest import FakeGCal
    runner = Runner(store, todo, Applier(store, todo, FakeGCal()), clf)
    todo.add("old", case("task_errand")["text"])
    r = runner.run_once(NOW)
    assert r.baseline == 1 and clf.calls == 0
    assert store.get("old")["raw_text"] is None  # baseline keeps no text
    todo.add("new", case("task_errand")["text"])
    runner.run_once(NOW)
    assert clf.calls == 1
    assert store.get("old")["status"] == "BASELINE"
    assert store.get("new")["status"] == "APPLIED"


def test_daily_cap_blocks_llm(env, monkeypatch):
    monkeypatch.setattr(config, "DAILY_LLM_CALL_CAP", 1)
    env.todoist.add("a", case("task_errand")["text"])
    env.todoist.add("b", case("task_sport")["text"])
    r = _run(env)
    assert env.clf.calls == 1
    assert env.store.get("b")["status"] == "SKIPPED_CAP"
    assert any("strop" in line for line in r.lines)
    r2 = _run(env)
    assert env.clf.calls == 1
    assert not any("strop" in line for line in r2.lines)  # notice once per day


def test_monthly_usd_cap_blocks_llm(env, monkeypatch):
    monkeypatch.setattr(config, "MONTHLY_USD_CAP", 0.0)
    env.todoist.add("a", case("task_errand")["text"])
    _run(env)
    assert env.clf.calls == 0


def test_llm_cost_is_logged(env):
    env.todoist.add("a", case("task_errand")["text"])
    _run(env)
    row = env.store.conn.execute("select * from llm_calls").fetchone()
    assert row["in_tokens"] == 900 and row["out_tokens"] == 120
    assert abs(row["cost_usd"] - (900 * 1 + 120 * 5) / 1e6) < 1e-12


def test_prefilters_skip_llm(env):
    env.todoist.add("r", "zalít kytky", due={"is_recurring": True, "date": "2026-09-24"})
    env.todoist.add("s", "podúkol", parent_id="p1")
    env.todoist.add("e", "   ")
    _run(env)
    assert env.clf.calls == 0
    for tid in ("r", "s", "e"):
        assert env.store.get(tid)["status"] == "UNKNOWN_MARKED"


# --- actions per type ------------------------------------------------------

def test_task_is_renamed_labelled_and_moved(env):
    env.todoist.add("t", case("task_deadline")["text"])
    r = _run(env)
    ops = [c[0] for c in env.todoist.calls]
    assert ops == ["update", "move"]
    fields = env.todoist.calls[0][2]
    assert fields["content"] == "💼 Poslat faktury klientovi"
    assert fields["deadline_date"] == "2026-09-25"
    assert "due_date" not in fields  # „do pátku" is a deadline, not a planned day
    assert fields["description"].startswith("Původně: do pátku poslat faktury klientovi")
    assert env.todoist.calls[1][2] == config.H2_PROJECT_ID
    assert env.gcal.insert_calls == 0
    assert "TASK" in r.lines[0]


def test_task_due_time_goes_as_utc_datetime(env):
    env.todoist.add("t", case("task_due_time")["text"])
    _run(env)
    fields = env.todoist.calls[0][2]
    assert fields["due_datetime"] == "2026-09-24T06:00:00Z"
    assert fields["labels"] == ["telefon"]


def test_existing_labels_are_kept(env):
    env.todoist.add("t", case("task_errand")["text"], labels=["focus"])
    _run(env)
    assert env.todoist.calls[0][2]["labels"] == ["focus", "venku"]


def test_waiting_gets_ceka_and_followup(env):
    env.todoist.add("w", case("waiting_followup")["text"])
    _run(env)
    f = env.todoist.calls[0][2]
    assert f["labels"] == ["ceka"] and f["due_date"] == "2026-09-24"
    assert f["content"].startswith("⏳")


def test_event_goes_to_primary_busy_with_reminder_then_closes(env):
    env.todoist.add("e", case("event_dentist")["text"])
    _run(env)
    (cal, eid), ev = next(iter(env.gcal.events.items()))
    assert cal == config.PRIMARY_CALENDAR_ID
    assert eid == event_id_for("e", "EVENT")
    assert ev["transparency"] == "opaque"
    assert ev["reminders"] == {"useDefault": False,
                               "overrides": [{"method": "popup", "minutes": 60}]}
    assert ev["summary"] == "🩺 Zubař"
    assert ev["start"] == {"dateTime": "2026-09-28T14:30:00+02:00", "timeZone": "Europe/Prague"}
    assert [c[0] for c in env.todoist.calls] == ["comment", "close"]
    assert env.todoist.calls[0][2] == "→ kalendář"


def test_info_is_free_without_reminders(env):
    env.todoist.add("i", case("info_kids_allday")["text"])
    _run(env)
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-info"
    assert ev["transparency"] == "transparent"
    assert ev["reminders"] == {"useDefault": False, "overrides": []}
    assert ev["start"] == {"date": "2026-09-26"} and ev["end"] == {"date": "2026-09-27"}
    assert env.todoist.calls[0][2] == "→ H2 · Info"


def test_block_creates_task_and_linked_event(env):
    env.todoist.add("b", case("block_project")["text"])
    _run(env)
    assert [c[0] for c in env.todoist.calls] == ["update", "move"]
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-bloky"
    assert ev["description"] == "Úkol: https://app.todoist.com/app/task/b"


def test_unknown_stays_in_inbox_with_comment(env):
    env.todoist.add("u", case("event_no_time")["text"])
    r = _run(env)
    assert env.todoist.calls == [("comment", "u", "❓ pevný termín bez jasného času")]
    assert env.todoist.tasks["u"]["project_id"] == "inbox-1"
    assert r.lines[0].startswith("❓")


# --- idempotence / resume --------------------------------------------------

def test_crash_between_steps_resumes_without_duplicates(env):
    env.todoist.add("e", case("event_meeting_range")["text"])
    env.todoist.fail_once.add("close")
    r1 = _run(env)
    assert r1.errors and env.store.get("e")["status"] == "CLASSIFIED"
    r2 = _run(env)
    assert env.clf.calls == 1           # no second LLM call
    assert len(env.gcal.events) == 1    # event not duplicated
    assert [c[0] for c in env.todoist.calls] == ["comment", "close"]  # comment once
    assert env.store.get("e")["status"] == "APPLIED" and not r2.errors


def test_gcal_insert_is_idempotent_even_if_step_not_recorded(env):
    env.todoist.add("e", case("event_dentist")["text"])
    _run(env)
    ev = next(iter(env.gcal.events.values()))
    assert env.gcal.insert_event(config.PRIMARY_CALENDAR_ID, ev) == "exists"


def test_item_moved_away_by_owner_becomes_gone(env):
    env.todoist.add("t", case("task_errand")["text"])
    env.todoist.fail_once.add("update")
    _run(env)
    env.todoist.tasks["t"]["project_id"] = "somewhere-else"
    _run(env)
    assert env.store.get("t")["status"] == "GONE"


def test_one_bad_item_does_not_block_others(env):
    env.todoist.add("x", "neznámý text který fake classifier nezná")
    env.todoist.add("t", case("task_sport")["text"])
    r = _run(env)
    assert env.store.get("t")["status"] == "APPLIED"
    assert env.store.get("x")["status"] == "UNKNOWN_MARKED"
    assert len(r.lines) == 2


def test_classifier_exception_retries_then_gives_up(env):
    def boom(text, desc, now):
        raise TimeoutError()

    env.runner.classifier = boom
    env.todoist.add("t", case("task_sport")["text"])
    for _ in range(config.MAX_CLASSIFY_ATTEMPTS):
        _run(env)
    assert env.store.get("t")["status"] == "UNKNOWN_MARKED"
    assert env.store.get("t")["attempts"] == config.MAX_CLASSIFY_ATTEMPTS


def test_dry_run_writes_nothing(env):
    env.runner.dry = True
    env.todoist.add("e", case("event_dentist")["text"])
    r = _run(env)
    assert env.todoist.calls == [] and env.gcal.events == {}
    assert env.store.get("e") is None
    assert r.lines[0].startswith("[dry-run]")


# --- summary ---------------------------------------------------------------

def test_one_telegram_message_for_whole_run(env):
    for c in FIXTURES["cases"][:6]:
        env.todoist.add(c["id"], c["text"])
    r = _run(env)
    text = format_summary(r)
    assert text.count("\n") >= 6
    assert "6 položek" in text


def test_summary_none_when_nothing_done():
    assert format_summary(Report()) is None


def test_runner_rejects_invented_time_end_to_end(env):
    env.clf.by_text["kontrola v úterý"] = dict(case("event_dentist")["mock_output"],
                                                start="2026-09-29T00:00")
    env.todoist.add("k", "kontrola v úterý")
    _run(env)
    assert env.gcal.events == {}
    assert env.store.get("k")["status"] == "UNKNOWN_MARKED"
