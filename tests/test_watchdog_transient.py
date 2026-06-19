"""Tests pro 2-strike transient HTTP counter v watchdog.py."""
import io, json, time, urllib.error, urllib.request
import pytest
import watchdog


STALE_TS = "2020-01-01T00:00:00+00:00"
FRESH_TS = "2099-01-01T00:00:00+00:00"


def _response(ts):
    return io.BytesIO(json.dumps([{"updated_at": ts}]).encode())


def _raise_522(req, timeout=None):
    raise urllib.error.HTTPError("url", 522, "Bad Gateway", {}, None)


def _raise_401(req, timeout=None):
    raise urllib.error.HTTPError("url", 401, "Unauthorized", {}, None)


def _return_fresh(req, timeout=None):
    return _response(FRESH_TS)


def _return_stale(req, timeout=None):
    return _response(STALE_TS)


# --- Test 1: první 522 → žádný alert, counter=1, exit 0 ---

def test_first_522_no_alert(monkeypatch, tmp_path):
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(tmp_path / "state.json"))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))
    monkeypatch.setattr(urllib.request, "urlopen", _raise_522)

    rc = watchdog.run()

    assert rc == 0
    assert calls == [], "první strike nesmí poslat alert"
    state = json.loads((tmp_path / "state.json").read_text())
    assert state["consecutive_transient_fails"] == 1


# --- Test 2: dvě 522 za sebou → alert při druhém běhu, counter=2 ---

def test_second_522_sends_alert(monkeypatch, tmp_path):
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(tmp_path / "state.json"))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))
    monkeypatch.setattr(urllib.request, "urlopen", _raise_522)

    watchdog.run()          # strike 1 — ticho
    assert calls == []

    watchdog.run()          # strike 2 — alert
    assert len(calls) == 1
    assert "522" in calls[0] or "nedostupný" in calls[0].lower()
    state = json.loads((tmp_path / "state.json").read_text())
    assert state["consecutive_transient_fails"] == 2


# --- Test 3: 522 pak úspěch → counter reset na 0, žádný nový alert ---

def test_522_then_success_resets_counter(monkeypatch, tmp_path):
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(tmp_path / "state.json"))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))

    monkeypatch.setattr(urllib.request, "urlopen", _raise_522)
    watchdog.run()

    monkeypatch.setattr(urllib.request, "urlopen", _return_fresh)
    watchdog.run()

    assert calls == [], "úspěšný běh po 522 nesmí alertovat"
    state = json.loads((tmp_path / "state.json").read_text())
    assert state["consecutive_transient_fails"] == 0


# --- Test 4: ne-transient chyba (401) → alert hned, exit 1 ---

def test_non_transient_alerts_immediately(monkeypatch, tmp_path):
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(tmp_path / "state.json"))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))
    monkeypatch.setattr(urllib.request, "urlopen", _raise_401)

    rc = watchdog.run()

    assert rc == 1, "ne-transient chyba musí vrátit exit 1"
    assert len(calls) == 1
    assert "selhal" in calls[0].lower() or "watchdog" in calls[0].lower()
    # counter nesmí být inkrementován jako transient strike
    assert not (tmp_path / "state.json").exists() or \
        json.loads((tmp_path / "state.json").read_text()).get("consecutive_transient_fails", 0) == 0


# --- Test 5: poškozený state soubor → fail-open, counter=0, žádný crash ---

def test_corrupted_state_file_fail_open(monkeypatch, tmp_path):
    state_path = tmp_path / "state.json"
    state_path.write_text("NOT VALID JSON {{{{")
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(state_path))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))
    monkeypatch.setattr(urllib.request, "urlopen", _raise_522)

    rc = watchdog.run()  # nesmí crashnout

    assert rc == 0, "poškozený state soubor nesmí způsobit crash"
    assert calls == [], "první strike (counter začíná od 0) nesmí alertovat"
    state = json.loads(state_path.read_text())
    assert state["consecutive_transient_fails"] == 1


# --- Test 6: STALE data (origin OK, ale stará) → alert beze změny, counter reset ---

def test_stale_data_still_alerts(monkeypatch, tmp_path):
    monkeypatch.setattr(watchdog, "WATCHDOG_STATE", str(tmp_path / "state.json"))
    monkeypatch.setattr(watchdog, "ALERT_AFTER", 2)
    monkeypatch.setattr(time, "sleep", lambda s: None)
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))
    monkeypatch.setattr(urllib.request, "urlopen", _return_stale)

    rc = watchdog.run()

    assert rc == 0
    assert len(calls) == 1, "STALE musí stále alertovat"
    assert "stojí" in calls[0] or "watchdog" in calls[0].lower()
    state = json.loads((tmp_path / "state.json").read_text())
    assert state["consecutive_transient_fails"] == 0, "STALE běh (úspěšný fetch) resetuje counter"
