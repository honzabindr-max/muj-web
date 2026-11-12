import json, glob, os, hashlib, datetime, sys
from jsonschema import Draft202012Validator, FormatChecker

HERE = os.path.dirname(os.path.abspath(__file__))
CONTRACTS = os.path.join(HERE, "..", "contracts")  # repo layout adaptation (paths only)
sys.path.insert(0, HERE)
from validate_fixture_semantics import check as semantic_check

schema = json.load(open(os.path.join(CONTRACTS, "ui_data_contract_v1.json")))
Draft202012Validator.check_schema(schema)
v = Draft202012Validator(schema, format_checker=FormatChecker())

print("MEZI VÁMI — ui_data_contract_v1 · VALIDATION + COUNTER-FIXTURE REPORT")
print("patch round: GPT P1 READINESS GATE G1")
print("contract_version: 1.0.1")
print("generated:", datetime.datetime.now(datetime.timezone.utc).isoformat())
print(
    "validator: python jsonschema, JSON Schema Draft 2020-12, FORMAT ASSERTION ENABLED"
)
print(
    "semantic validator: validate_fixture_semantics.py (deterministic cross-field/referential rules)"
)
h = hashlib.sha256(
    open(os.path.join(CONTRACTS, "ui_data_contract_v1.json"), "rb").read()
).hexdigest()
print("schema sha256:", h)
print("SCHEMA_WELLFORMED = YES")
print()
pos_ok = neg_ok = 0
pos_n = neg_n = 0
failures = []
for f in sorted(glob.glob(os.path.join(CONTRACTS, "fixtures", "*.json"))):
    name = os.path.basename(f)[:-5]
    doc = json.load(open(f))
    serrs = [e.message for e in v.iter_errors(doc)]
    merrs = [] if serrs else semantic_check(doc)
    rejected = bool(serrs or merrs)
    expect_reject = name.startswith("CF-")
    ok = rejected == expect_reject
    layer = "schema" if serrs else ("semantic" if merrs else "-")
    reason = (serrs[0] if serrs else (merrs[0] if merrs else ""))[:78]
    if expect_reject:
        neg_n += 1
        neg_ok += ok
    else:
        pos_n += 1
        pos_ok += ok
    if not ok:
        failures.append(name)
    print(
        f"{name:32} {'REJECTED' if rejected else 'ACCEPTED':9} expect={'REJECT' if expect_reject else 'ACCEPT':6} "
        f"{'PASS' if ok else 'FAIL':4} [{layer}] {reason}"
    )
print()
print(f"POSITIVE_FIXTURES  {pos_ok}/{pos_n} PASS")
print(f"COUNTER_FIXTURES   {neg_ok}/{neg_n} PASS")
print("FIXTURE_VALIDATION_SUITE =", "PASS" if not failures else f"FAIL {failures}")
