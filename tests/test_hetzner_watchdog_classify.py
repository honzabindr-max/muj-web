"""Tests pro klasifikaci geo/proxy stavů v hetzner_watchdog.py."""
from datetime import datetime, timezone
import pytest
import hetzner_watchdog


# --- Unit testy classify_gm_entry ---

def test_egress_000_is_proxy_unreachable():
    entry = {"http_status": 0, "actual_country": "", "expected_country": "CZ"}
    etype, _, _ = hetzner_watchdog.classify_gm_entry(entry)
    assert etype == "proxy_unreachable", f"egress 000 musí být proxy_unreachable, ne {etype!r}"


def test_502_from_proxy_is_proxy_502():
    entry = {"http_status": 502, "actual_country": "", "expected_country": "DE"}
    etype, _, _ = hetzner_watchdog.classify_gm_entry(entry)
    assert etype == "proxy_502"


def test_timeout_message_is_proxy_timeout():
    entry = {"message": "Connection timed out", "http_status": 0}
    etype, _, _ = hetzner_watchdog.classify_gm_entry(entry)
    assert etype == "proxy_timeout"


def test_real_geo_mismatch_detected():
    entry = {"http_status": 200, "actual_country": "PL", "expected_country": "CZ"}
    etype, actual, expected = hetzner_watchdog.classify_gm_entry(entry)
    assert etype == "geo_mismatch"
    assert actual == "PL"
    assert expected == "CZ"


def test_unknown_country_is_geo_check_failed_not_mismatch():
    entry = {"http_status": 200, "actual_country": None, "expected_country": "CZ"}
    etype, _, _ = hetzner_watchdog.classify_gm_entry(entry)
    assert etype == "geo_check_failed", f"nezjištěná country musí být geo_check_failed, ne {etype!r}"


# --- Integrační test: zdravý /verify → 🟢, žádný geo/proxy alert ---

def test_healthy_verify_sends_green_no_geo_alert(monkeypatch):
    calls = []
    monkeypatch.setattr("notify.send", lambda msg: calls.append(msg))

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def mock_vget(path):
        if "queue-status" in path:
            return [{"status": "completed", "total": 60}]
        if "geo-mismatch" in path:
            return []
        if "growth" in path:
            return [{"total": 177}]
        if "suggestions-count" in path:
            return [{"total": 5000, "max_created": today + "T10:00:00Z"}]
        return []

    monkeypatch.setattr(hetzner_watchdog, "vget", mock_vget)
    hetzner_watchdog.main()

    assert len(calls) == 1
    msg = calls[0]
    assert "geo" not in msg.lower() and "proxy" not in msg.lower(), \
        "zdravý stav nesmí alertovat na geo/proxy"
    assert "✅" in msg or "🟢" in msg, f"zdravý stav musí mít ✅/🟢, dostal: {msg!r}"
