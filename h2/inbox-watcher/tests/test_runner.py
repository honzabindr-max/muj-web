from conftest import FIXTURES, NOW, TEST_KEY, FakeClassifier, FakeTodoist, case

from h2iw.crypto import decrypt

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
    store = Store(str(tmp_path / "s.db"), TEST_KEY)
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
    assert fields["labels"] == ["telefon", "fokus"]


def test_existing_labels_are_kept(env):
    env.todoist.add("t", case("task_errand")["text"], labels=["top"])
    _run(env)
    assert env.todoist.calls[0][2]["labels"] == ["top", "venku", "fokus"]


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
    # Planning OS v0.11 §3: never a celodenní ("date") event — 8:00-18:00 instead.
    assert ev["start"] == {"dateTime": "2026-09-26T08:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["end"] == {"dateTime": "2026-09-26T18:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["description"].startswith("🗓️ celý den\n")
    assert env.todoist.calls[0][2] == "→ H2 · Info"


def test_block_creates_task_and_linked_event(env):
    env.todoist.add("b", case("block_project")["text"])
    _run(env)
    assert [c[0] for c in env.todoist.calls] == ["update", "reminder", "move"]
    assert env.todoist.calls[0][2]["due_datetime"] == "2026-09-26T08:00:00Z"  # block start
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-fokus"
    assert ev["description"] == "Úkol: https://app.todoist.com/app/task/b"


def test_unknown_stays_in_inbox_with_comment(env):
    c = case("nonsense_vague")
    env.todoist.add("u", c["text"])
    r = _run(env)
    assert env.todoist.calls == [("comment", "u", f"❓ {c['mock_output']['reason']}")]
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
    assert "neodpovídej" not in text


def test_summary_none_when_nothing_done():
    assert format_summary(Report()) is None


def test_runner_downgrades_invented_time_to_all_day_placeholder(env):
    # Planning OS v0.11 §1/§3/§4: no longer UNKNOWN — an invented, unstated
    # time downgrades to the day-only placeholder (povinnost -> "⏳ … čas ❓").
    env.clf.by_text["kontrola v úterý"] = dict(case("event_dentist")["mock_output"],
                                                start="2026-09-29T00:00")
    env.todoist.add("k", "kontrola v úterý")
    _run(env)
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == config.PRIMARY_CALENDAR_ID
    assert ev["start"] == {"dateTime": "2026-09-29T08:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["summary"] == "⏳ 🩺 Zubař — čas ❓"
    assert ev["description"].startswith("🗓️ celý den\n")
    assert env.store.get("k")["status"] == "APPLIED"


def test_note_is_stored_commented_and_closed_nothing_else(env):
    c = case("note_person_colleague")
    env.todoist.add("n", c["text"], description="potkali jsme se na firemní akci")
    r = _run(env)
    row = env.store.conn.execute("select * from notes").fetchone()
    assert row["todoist_task_id"] == "n" and row["subtype"] == "person"
    assert decrypt(TEST_KEY, row["ciphertext"]) == c["text"] + "\n\npotkali jsme se na firemní akci"
    assert row["key_id"] == "h2iw"
    assert env.todoist.calls == [("comment", "n", "→ H2 poznámky"), ("close", "n")]
    assert env.gcal.insert_calls == 0
    assert r.lines == ["📝 poznámka uložena (o lidech): Petr z práce — děti Adam a Eva, kolo"]
    assert env.store.get("n")["status"] == "APPLIED"


def test_note_resume_does_not_duplicate(env):
    env.todoist.add("n", case("note_idea_app")["text"])
    env.todoist.fail_once.add("close")
    _run(env)
    _run(env)
    assert env.store.conn.execute("select count(*) c from notes").fetchone()["c"] == 1
    assert [c[0] for c in env.todoist.calls] == ["comment", "close"]


def test_multi_item_stays_in_inbox_with_split_comment(env):
    env.todoist.add("m", case("multiple_items")["text"])
    _run(env)
    assert env.todoist.calls == [("comment", "m", "❓ více věcí najednou — rozdělit")]
    assert env.todoist.tasks["m"]["project_id"] == "inbox-1"


# --- COMMAND ---------------------------------------------------------------

def test_command_is_recorded_and_moved_open_and_unchanged(env):
    c = case("command_delete_event")
    env.todoist.add("c", c["text"], description="původní popis")
    r = _run(env)
    assert env.gcal.insert_calls == 0
    # only a move: no rename, no comment, no close, nothing else touched
    assert env.todoist.calls == [("move", "c", "proj-prikazy")]
    t = env.todoist.tasks["c"]
    assert t["content"] == c["text"] and t["description"] == "původní popis"
    row = env.store.conn.execute("select * from commands").fetchone()
    assert decrypt(TEST_KEY, row["ciphertext"]) == c["text"] + "\n\npůvodní popis"
    assert r.lines == [f"➡️ předáno Plánovači: {c['text']}"]


def test_status_update_goes_to_planner(env):
    c = case("command_status_patrik")
    env.todoist.add("p", c["text"])
    r = _run(env)
    assert env.todoist.calls == [("move", "p", "proj-prikazy")]
    assert r.lines[0].startswith("➡️ předáno Plánovači: Nedovolal jsem se Patrikovi")


def test_command_misclassified_as_task_stays_in_inbox(env):
    c = case("command_move_task")
    env.clf.by_text[c["text"]] = dict(case("task_errand")["mock_output"], title="Přesunout úkol")
    env.todoist.add("c", c["text"])
    _run(env)
    assert env.todoist.calls[0][0] == "comment" and "příkaz nebo stavová aktualizace" in env.todoist.calls[0][2]
    assert len(env.todoist.calls) == 1 and env.todoist.tasks["c"]["project_id"] == "inbox-1"


# --- encryption at rest ----------------------------------------------------

def _file_bytes(path):
    out = b""
    for suffix in ("", "-wal", "-shm", "-journal"):
        p = path.parent / (path.name + suffix)
        if p.exists():
            out += p.read_bytes()
    return out


def test_note_and_command_text_not_readable_in_db_files(env):
    secret_note = "Markétka nemá ráda koriandr"
    secret_cmd = "Smaž zítřejší událost v kalendáři která se jmenuje zubař"
    env.todoist.add("n", secret_note)
    env.todoist.add("c", secret_cmd)
    _run(env)
    env.store.conn.close()
    blob = _file_bytes(env.db_path)
    for needle in ("koriandr", "Markétka nemá", "zubař", "Smaž zítřejší", "kalendáři"):
        assert needle.encode("utf-8") not in blob, needle
    # the rest of the pipeline still works on the encrypted rows
    from h2iw.store import Store
    s2 = Store(str(env.db_path), TEST_KEY)
    rows = s2.conn.execute("select ciphertext from notes union all select ciphertext from commands")
    assert sorted(decrypt(TEST_KEY, r[0]) for r in rows) == sorted([secret_note, secret_cmd])


def test_v1_plaintext_notes_are_migrated_and_scrubbed(tmp_path):
    import sqlite3

    db = tmp_path / "v1.db"
    raw = "Dostal jsem nápad že by mohlo být týdenní shrnutí z HW v neděli večer"
    c = sqlite3.connect(db)
    c.executescript("""
    pragma journal_mode=wal;
    create table items (task_id text primary key, raw_text text, raw_description text,
      todoist_added_at text, seen_at text not null, status text not null,
      classification_json text, error text, attempts integer not null default 0,
      updated_at text not null);
    create table notes (id integer primary key autoincrement, todoist_task_id text not null unique,
      subtype text not null, raw_text text not null, created_at text not null);
    """)
    c.execute("insert into items values('t1',?,'', null,'2026-09-23T15:10:32+00:00','APPLIED',?,null,1,'x')",
              (raw, '{"type": "NOTE", "title": "Týdenní shrnutí z HW v neděli večer", "note_subtype": "idea"}'))
    c.execute("insert into notes(todoist_task_id, subtype, raw_text, created_at) values('t1','idea',?,'2026-09-23T15:11:07+00:00')", (raw,))
    c.commit()
    c.close()

    from h2iw.store import Store
    s = Store(str(db), TEST_KEY)
    row = s.conn.execute("select * from notes").fetchone()
    assert decrypt(TEST_KEY, row["ciphertext"]) == raw and row["created_at"].startswith("2026-09-23T15:11")
    assert s.get("t1")["raw_text"] is None
    assert "HW" not in s.get("t1")["classification_json"]
    s.conn.close()
    blob = _file_bytes(db)
    assert "týdenní shrnutí".encode() not in blob.lower() and b"HW v ned" not in blob


def test_missing_key_refuses_to_store_notes(tmp_path):
    from h2iw.store import Store
    import pytest
    s = Store(str(tmp_path / "k.db"))
    with pytest.raises(RuntimeError):
        s.insert_note("t", "idea", "x")


def test_reminder_is_added_before_move(env):
    c = case("task_reminder_imbus")
    env.todoist.add("r", c["text"])
    _run(env)
    assert [x[0] for x in env.todoist.calls] == ["update", "reminder", "move"]
    assert env.todoist.calls[0][2]["due_datetime"] == "2026-09-23T18:15:00Z"


def test_no_reminder_call_without_time(env):
    env.todoist.add("r", case("task_reminder_no_time")["text"])
    _run(env)
    assert [x[0] for x in env.todoist.calls] == ["update", "move"]


# --- life calendars (Planning OS v0.4) -------------------------------------

import pytest  # noqa: E402

LIFE_CASES = [
    ("event_rehab", "povinnost", config.PRIMARY_CALENDAR_ID, 60, "🔴 Hlavní"),
    ("block_find_sofa_online", "fokus", "cal-fokus", 15, "🟣 H2 · Fokus"),
    ("event_bike_saturday", "regenerace", "cal-regenerace", 15, "🌿 H2 · Regenerace"),
    ("event_dinner_marketka", "lide", "cal-lide", 15, "🩷 H2 · Lidé"),
    ("block_carry_sofa", "domov", "cal-domov", 15, "🟤 H2 · Domov"),
    ("event_burcak", "zazitky", "cal-zazitky", 15, "🟡 H2 · Zážitky"),
]


@pytest.mark.parametrize("cid,life,cal,minutes,prefix", LIFE_CASES)
def test_life_routes_to_calendar_busy_with_reminder(env, cid, life, cal, minutes, prefix):
    env.todoist.add("x", case(cid)["text"])
    r = _run(env)
    (cal_id, _), ev = next(iter(env.gcal.events.items()))
    assert cal_id == cal
    assert ev["transparency"] == "opaque"
    assert ev["reminders"]["overrides"] == [{"method": "popup", "minutes": minutes}]
    assert r.lines[0].startswith(prefix + " · ")


def test_info_line_has_grey_prefix(env):
    env.todoist.add("i", case("info_partner_party")["text"])
    r = _run(env)
    assert r.lines[0].startswith("⚪ H2 · Info · ")


def test_missing_life_calendar_stays_in_inbox_nothing_written(env):
    del env.gcal.calendars["H2 · Domov"]
    env.todoist.add("b", case("block_carry_sofa")["text"])
    r = _run(env)
    assert env.gcal.events == {}
    assert env.todoist.calls == [("comment", "b", "❓ chybí kalendář H2 · Domov")]
    assert env.todoist.tasks["b"]["project_id"] == "inbox-1"
    assert env.todoist.tasks["b"]["content"] == case("block_carry_sofa")["text"]  # not renamed
    assert "chybí kalendář H2 · Domov" in r.lines[0]
    assert env.store.get("b")["status"] == "UNKNOWN_MARKED"


def test_event_in_life_calendar_comment_names_it(env):
    env.todoist.add("d", case("event_dinner_marketka")["text"])
    _run(env)
    assert ("comment", "d", "→ H2 · Lidé") in env.todoist.calls


# --- TASK life label + duration --------------------------------------------

def test_task_gets_life_label_and_duration(env):
    c = case("task_clean_washer")
    env.todoist.add("w", c["text"])
    r = _run(env)
    f = env.todoist.calls[0][2]
    assert f["labels"] == ["doma", "domov"]
    assert f["duration"] == 30 and f["duration_unit"] == "minute"
    assert r.lines[0].startswith("🟤 TASK 🏠 🏡 Vyčistit pračku")


def test_duration_rejected_by_todoist_is_dropped_not_fatal(env):
    from h2iw.todoist import TodoistError

    real = env.todoist.update_task

    def picky(tid, fields):
        if "duration" in fields:
            raise TodoistError("POST /tasks/w -> 400")
        return real(tid, fields)

    env.todoist.update_task = picky
    env.todoist.add("w", case("task_clean_washer")["text"])
    r = _run(env)
    assert "duration" not in env.todoist.calls[0][2]
    assert env.store.get("w")["status"] == "APPLIED"
    assert "odhad délky Todoist odmítl" in r.lines[0]


def test_block_task_also_gets_life_label(env):
    env.todoist.add("b", case("block_carry_sofa")["text"])
    _run(env)
    assert "domov" in env.todoist.calls[0][2]["labels"]


def test_top_label_never_added(env):
    d = dict(case("task_sport")["mock_output"], context="top")  # invalid context -> rejected
    env.clf.by_text["x"] = d
    env.todoist.add("x", "x")
    _run(env)
    assert all("top" not in (c[2].get("labels", []) if len(c) > 2 and isinstance(c[2], dict) else [])
               for c in env.todoist.calls)


def test_all_day_life_event_busy_with_popup_and_pinned_line(env):
    env.todoist.add("h", case("event_mushrooms_sasenka")["text"])
    r = _run(env)
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-lide" and ev["transparency"] == "opaque"
    # Planning OS v0.11 §1/§5: 8:00-18:00 placeholder, same reminder logic as
    # any timed event (LIFE_REMINDER_MINUTES for a non-povinnost life).
    assert ev["start"] == {"dateTime": "2026-09-28T08:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["reminders"]["overrides"] == [{"method": "popup", "minutes": config.LIFE_REMINDER_MINUTES}]
    assert ev["description"] == "📌 pevné\n🗓️ celý den\nZ Todoist Doručených: v pondělí jedu se Sašenkou na houby"
    assert r.lines[0].startswith("🩷 H2 · Lidé · ")


def test_multi_day_event_creates_recurring_placeholder(env):
    d = dict(case("event_mushrooms_sasenka")["mock_output"],
              all_day_date="2026-09-25", all_day_end_date="2026-09-27")
    env.clf.by_text["hory"] = d
    env.todoist.add("m", "hory")
    _run(env)
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-lide"
    assert ev["start"] == {"dateTime": "2026-09-25T08:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["end"] == {"dateTime": "2026-09-25T18:00:00+02:00", "timeZone": "Europe/Prague"}
    assert ev["recurrence"] == ["RRULE:FREQ=DAILY;COUNT=3"]
    assert ev["summary"] == "Houby se Sašenkou"  # never ⏳❓ for a multi-day span


def test_every_timed_task_path_adds_reminder(env):
    for tid, cid in [("a", "task_on_the_way_bulbs"), ("b", "task_due_time"),
                     ("c", "block_car_to_house")]:
        env.todoist.add(tid, case(cid)["text"])
    _run(env)
    reminded = {c[1] for c in env.todoist.calls if c[0] == "reminder"}
    assert reminded == {"a", "b", "c"}


# --- Planning OS v0.6 -------------------------------------------------------

@pytest.mark.parametrize("cid,pinned", [
    ("event_dinner_marketka_sat", True),    # lide
    ("event_trip_mikulov", True),           # zazitky, all-day
    ("event_mushrooms_sasenka", True),      # lide, all-day
    ("event_car_to_doctor", False),         # povinnost -> primary, no pin
])
def test_pinned_first_line_on_events_outside_primary(env, cid, pinned):
    env.todoist.add("e", case(cid)["text"])
    r = _run(env)
    ev = next(iter(env.gcal.events.values()))
    assert ev["description"].startswith("📌 pevné\n") is pinned
    assert ("📌" in r.lines[0]) is pinned


def test_block_never_pinned_and_links_its_task(env):
    env.todoist.add("blk1", case("block_car_bedroom")["text"])
    _run(env)
    (cal, _), ev = next(iter(env.gcal.events.items()))
    assert cal == "cal-domov"
    assert "📌" not in ev["description"]
    assert ev["description"] == "Úkol: https://app.todoist.com/app/task/blk1"
    # the linked task really is the one moved to H2
    assert env.todoist.tasks["blk1"]["project_id"] == config.H2_PROJECT_ID


def test_watcher_never_touches_anything_outside_the_inbox(env):
    """v0.6 §1: only creates; never changes or deletes existing tasks/events."""
    import copy

    existing_tasks = {
        "old-h2": {"id": "old-h2", "content": "Starý úkol", "project_id": config.H2_PROJECT_ID,
                   "labels": ["fokus"], "description": ""},
        "old-cmd": {"id": "old-cmd", "content": "Starý příkaz", "project_id": "proj-prikazy",
                    "labels": [], "description": ""},
    }
    env.todoist.tasks.update(copy.deepcopy(existing_tasks))
    pre_event_key = ("cal-lide", "preexisting")
    env.gcal.events[pre_event_key] = {"id": "preexisting", "summary": "Moje událost"}
    snapshot_event = copy.deepcopy(env.gcal.events[pre_event_key])

    inbox_ids = []
    for i, c in enumerate(FIXTURES["cases"]):
        tid = f"in{i}"
        inbox_ids.append(tid)
        env.todoist.add(tid, c["text"])
    _run(env)
    _run(env)  # a second run must not touch anything either

    touched = {c[1] for c in env.todoist.calls}
    assert touched <= set(inbox_ids), touched - set(inbox_ids)
    for tid, t in existing_tasks.items():
        assert env.todoist.tasks[tid] == t
    assert env.gcal.events[pre_event_key] == snapshot_event
    # every calendar write is an insert of a new, deterministic id
    assert all(k[1] != "preexisting" for k in env.gcal.events if k != pre_event_key)
    assert env.gcal.insert_calls == len(env.gcal.events) - 1


def test_credit_exhausted_keeps_items_waiting_without_burning_attempts(env):
    class CreditError(Exception):
        pass

    def broke(text, desc, now):
        raise CreditError("Error code: 400 - Your credit balance is too low to access the Anthropic API")

    env.runner.classifier = broke
    env.todoist.add("t", case("task_sport")["text"])
    r1 = _run(env)
    for _ in range(5):
        _run(env)
    row = env.store.get("t")
    assert row["status"] == "SKIPPED_CAP" and row["attempts"] == 0
    assert env.todoist.calls == []  # nothing written, no ❓ comment
    assert any("došel kredit" in line for line in r1.lines)
    # credit topped up -> processed automatically
    env.runner.classifier = env.clf
    _run(env)
    assert env.store.get("t")["status"] == "APPLIED"
