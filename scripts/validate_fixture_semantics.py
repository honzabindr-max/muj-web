#!/usr/bin/env python3
"""MEZI VÁMI — validate:fixture-semantics
Deterministic cross-field / referential rules that JSON Schema cannot express.
Required by GPT P1 Readiness Gate patch G1. Runs in CI alongside schema validation."""
import json, sys, datetime

PRECISION_RANK = {"EXACT": 0, "APPROXIMATE": 1, "UNKNOWN": 2}
MODE_CHAR = {"EXACT": "E", "APPROXIMATE": "A", "UNKNOWN": "U"}

def canonical_cohort(mode_a, mode_b):
    """G1.3 canonical UNORDERED pair classification.
    Sort both modes by precision rank E<A<U, concatenate. {U,E} -> 'EU', never 'UE'."""
    modes = sorted([mode_a, mode_b], key=lambda m: PRECISION_RANK[m])
    return MODE_CHAR[modes[0]] + MODE_CHAR[modes[1]]

def _iter_insights(free_dna):
    yield free_dna["r1"]
    for i in free_dna.get("optional_insights", []):
        yield i

def check(doc):
    errs = []
    v = doc.get("view", {})
    state = v.get("state")

    # S1 persons pair integrity + cohort consistency
    persons = v.get("persons") or v.get("birth_data_review")
    if persons:
        slots = [p.get("slot") for p in persons]
        if sorted(slots) != ["A", "B"]:
            errs.append(f"S1 pair must contain exactly one A and one B, got {slots}")
        for p in persons:
            expected = "První osoba" if p.get("slot") == "A" else "Druhá osoba"
            if p.get("ui_label") != expected:
                errs.append(f"S1 ui_label mismatch for slot {p.get('slot')}: {p.get('ui_label')}")
            # calendar validity beyond regex
            try:
                d = datetime.date.fromisoformat(p["birth_date"])
            except Exception:
                errs.append(f"S1 invalid calendar date {p.get('birth_date')}")
            else:
                if d < datetime.date(1900, 1, 1):
                    errs.append(f"S1 birth_date {d} below locked supported_birth_date_min 1900-01-01")
                if d > datetime.date.today():
                    errs.append(f"S1 future birth_date {d} not allowed")

    fd = v.get("free_dna")
    if fd and persons and sorted([p.get("slot") for p in persons]) == ["A", "B"]:
        by_slot = {p["slot"]: p for p in persons}
        expected = canonical_cohort(by_slot["A"]["time_mode"], by_slot["B"]["time_mode"])
        if fd.get("time_coverage_class") != expected:
            errs.append(
                f"S2 time_coverage_class {fd.get('time_coverage_class')} does not match "
                f"person time modes ({by_slot['A']['time_mode']},{by_slot['B']['time_mode']}) "
                f"-> canonical {expected}")

    if fd:
        # S3 no duplicate insight slots
        slots = [i["slot"] for i in _iter_insights(fd)]
        if len(slots) != len(set(slots)):
            errs.append(f"S3 duplicate insight slots: {slots}")
        ids = [i["insight_id"] for i in _iter_insights(fd)]
        if len(ids) != len(set(ids)):
            errs.append(f"S3 duplicate insight_id values: {ids}")

        arr = v.get("analysis", {}).get("analysis_revision_ref")
        for ins in _iter_insights(fd):
            # S4 evidence anchor referential integrity
            for a in ins.get("evidence_anchors", []):
                if a["supports_insight_id"] != ins["insight_id"]:
                    errs.append(f"S4 anchor {a['anchor_id']} supports_insight_id does not match parent insight")
                if arr and a["analysis_revision_ref"] != arr:
                    errs.append(f"S4 anchor {a['anchor_id']} bound to foreign analysis revision")
            # S5 content budget respected
            cb = ins["content_budget"]
            if len(ins["headline"]) > cb["headline_max_chars"]:
                errs.append(f"S5 {ins['slot']} headline exceeds budget ({len(ins['headline'])}>{cb['headline_max_chars']})")
            if len(ins["body"]) > cb["body_max_chars"]:
                errs.append(f"S5 {ins['slot']} body exceeds budget ({len(ins['body'])}>{cb['body_max_chars']})")

        # S6 depth bridge may only reference actually detected insights (G2)
        db = v.get("depth_bridge")
        if db:
            detected = set(ids)
            for t in db["detected_themes"]:
                if t["supports_insight_id"] not in detected:
                    errs.append(f"S6 depth_bridge theme references undetected insight {t['supports_insight_id']}")

        # S7 timed layers honesty
        if fd.get("time_coverage_class") != "EE" and fd.get("timed_layers") == "AVAILABLE_STABLE":
            errs.append("S7 timed_layers AVAILABLE_STABLE requires cohort EE")

    # S8 order shell / fulfillment consistency and signed link window
    order = v.get("order")
    if order:
        if state == "ORDER_DELIVERY_READY" and order.get("fulfillment_state") != "READY":
            errs.append("S8 ORDER_DELIVERY_READY requires fulfillment_state READY")
        if state == "ORDER_CONFIRMED_GENERATING" and order.get("fulfillment_state") not in ("CONFIRMED", "GENERATING"):
            errs.append("S8 ORDER_CONFIRMED_GENERATING requires CONFIRMED or GENERATING")
        sl = order.get("signed_link")
        if sl:
            try:
                exp = datetime.datetime.fromisoformat(sl["expires_at"].replace("Z", "+00:00"))
                pd = datetime.datetime.fromisoformat(order["promised_delivery_at"].replace("Z", "+00:00"))
            except Exception:
                errs.append("S8 invalid date-time in order")
            else:
                if (exp - pd).days > 31:
                    errs.append("S8 signed link window exceeds locked 30 day baseline")

    # S9 price confirmation status must not claim a lock that Control Tower has not made
    for holder in (v.get("offer"), v):
        if isinstance(holder, dict) and isinstance(holder.get("price"), dict):
            if holder["price"].get("confirmation_status") == "LAUNCH_PRICE_LOCKED":
                errs.append("S9 LAUNCH_PRICE_LOCKED requires an explicit Control Tower decision before paid traffic")
    return errs

if __name__ == "__main__":
    doc = json.load(open(sys.argv[1]))
    e = check(doc)
    print("\n".join(e) if e else "OK")
    sys.exit(1 if e else 0)
