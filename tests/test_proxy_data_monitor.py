"""Tests for proxy_data_monitor.py"""
import json, os, sys
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import proxy_data_monitor as pdm


# ---- helpers ----------------------------------------------------------------

def _anchor(baseline=0, topup_gb=10.0, ts="2026-01-01T00:00:00+00:00"):
    return {"baseline_total_phrases": baseline, "topup_gb": topup_gb, "anchor_timestamp": ts}


# ---- unit tests -------------------------------------------------------------

def test_consumed_gb_calculation():
    """1M frází × 1,5 KB = 1,5 GB."""
    with patch.object(pdm, "KB_PER_PHRASE", 1.5):
        consumed, _, _ = pdm.compute_remaining(1_000_000, _anchor(baseline=0, topup_gb=10))
    assert abs(consumed - 1.5) < 0.001


def test_remaining_above_5_no_alert():
    """remaining > 5 GB → žádný alert."""
    _, remaining, auto = pdm.compute_remaining(0, _anchor(baseline=0, topup_gb=10))
    msgs = pdm.build_alert(remaining, auto, days_to_empty=30, anchor_age=1, daily_gb=0.1)
    assert msgs == []


def test_remaining_at_3_orange_alert():
    """remaining <= 5 → 🟠 s 'odhad' nebo 'projekce'."""
    msgs = pdm.build_alert(3.0, 0, days_to_empty=5, anchor_age=1, daily_gb=0.6)
    assert any("🟠" in m for m in msgs)
    assert any("odhad" in m.lower() or "projekce" in m.lower() for m in msgs)


def test_remaining_critical_red_alert():
    """remaining <= 1 → 🔴 s 'odhad' nebo 'projekce'."""
    msgs = pdm.build_alert(0.5, 0, days_to_empty=1, anchor_age=1, daily_gb=0.5)
    assert any("🔴" in m for m in msgs)
    assert any("odhad" in m.lower() or "projekce" in m.lower() for m in msgs)


def test_anchor_missing_fail_open(tmp_path):
    """Anchor chybí → 🟠 varování, žádný crash."""
    sent = []
    with patch.object(pdm, "ANCHOR_PATH", str(tmp_path / "nonexistent.json")):
        with patch.object(pdm.notify, "send", side_effect=sent.append):
            pdm.main_monitor()
    assert len(sent) == 1
    assert "🟠" in sent[0]


def test_verify_unavailable_fail_open(tmp_path):
    """/verify nedostupné → 🟠, žádný crash."""
    anchor_file = tmp_path / "anchor.json"
    anchor_file.write_text(json.dumps(_anchor(baseline=1_000_000, topup_gb=10)))
    sent = []
    with patch.object(pdm, "ANCHOR_PATH", str(anchor_file)), \
         patch.object(pdm, "fetch_current_total", side_effect=Exception("connection refused")), \
         patch.object(pdm.notify, "send", side_effect=sent.append):
        pdm.main_monitor()
    assert len(sent) == 1
    assert "🟠" in sent[0]


def test_auto_topup_modeling():
    """consumed překročí práh → remaining připočte auto_topup_gb."""
    # topup=10 GB, consumed=6 GB → remaining=4 < threshold(5) → auto top-up: pool=20, remaining=14
    phrases = 4_000_000  # = 6 GB při KB_PER_PHRASE=1.5
    with patch.object(pdm, "KB_PER_PHRASE", 1.5), \
         patch.object(pdm, "AUTO_TOPUP_THRESHOLD_GB", 5.0), \
         patch.object(pdm, "AUTO_TOPUP_GB", 10.0), \
         patch.object(pdm, "MAX_AUTO_TOPUPS_WARN", 2):
        consumed, remaining, auto = pdm.compute_remaining(phrases, _anchor(baseline=0, topup_gb=10))
    assert abs(consumed - 6.0) < 0.01
    assert auto >= 1
    assert remaining > 5.0


def test_all_alerts_contain_odhad_or_projekce():
    """Každý alert musí obsahovat slovo 'odhad' nebo 'projekce'."""
    cases = [
        (3.0, 0, 5, 1, 0.6),    # orange: remaining <= threshold
        (0.5, 0, 1, 1, 0.5),    # red: remaining <= 1
        (8.0, 3, 20, 1, 0.4),   # auto top-up warn (auto >= MAX_AUTO_TOPUPS_WARN=2)
        (8.0, 0, 20, 35, 0.4),  # stale anchor warn (age > ANCHOR_STALE_DAYS=30)
    ]
    for remaining_gb, auto, dte, age, daily in cases:
        msgs = pdm.build_alert(remaining_gb, auto, dte, age, daily)
        assert msgs, f"Očekávám alespoň jeden alert pro {cases}"
        for m in msgs:
            assert "odhad" in m.lower() or "projekce" in m.lower(), \
                f"Alert bez odhad/projekce: {m!r}"
