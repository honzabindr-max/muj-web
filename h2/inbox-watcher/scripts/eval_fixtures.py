"""Live eval of the classifier against the fixtures, via the Message Batches API.

Spends real money. Every report prints the round's real cost computed from the
API usage of each response (uncached input, cache write, cache read, output,
batch discount). Reads the key from ANTHROPIC_API_KEY or H2_ANTHROPIC_API_KEY.

Modes (exactly one):
    --changed [--base origin/main]   only cases added/changed vs the base ref
    --full                           the whole set (use before a deploy)
    --ids a,b,c                      explicit case ids

Options:
    --sync      plain Messages API instead of a batch (full price; for cache checks)
    --no-warm   do not send the one synchronous request that writes the cache first

    .venv/bin/python scripts/eval_fixtures.py --changed
    .venv/bin/python scripts/eval_fixtures.py --full
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import anthropic  # noqa: E402
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: E402
from anthropic.types.messages.batch_create_params import Request  # noqa: E402

from h2iw import config, render  # noqa: E402
from h2iw.classify import ClassifyResult, parse_response, request_params  # noqa: E402
from h2iw.validate import Invalid, validate  # noqa: E402

FIXTURES = ROOT / "tests/fixtures/inputs.json"


def load_cases() -> tuple[datetime, list[dict]]:
    fx = json.loads(FIXTURES.read_text())
    return datetime.fromisoformat(fx["now"]), fx["cases"]


def changed_ids(cases: list[dict], base: str) -> list[str]:
    top = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=ROOT,
                                       text=True).strip())
    rel = FIXTURES.relative_to(top)
    try:
        old = json.loads(subprocess.check_output(["git", "show", f"{base}:{rel}"], cwd=ROOT,
                                                 text=True, stderr=subprocess.DEVNULL))
    except subprocess.CalledProcessError:
        return [c["id"] for c in cases]
    before = {c["id"]: c for c in old["cases"]}
    return [c["id"] for c in cases if before.get(c["id"]) != c]


def judge(c: dict, res: ClassifyResult, now: datetime) -> tuple[bool, str, str]:
    model_type = (res.data or {}).get("type", f"ERR {res.error}")
    v = validate(res.data, now, c["text"])
    final = "UNKNOWN" if isinstance(v, Invalid) else v.type
    shown = f"UNKNOWN ({v.reason})" if isinstance(v, Invalid) else render.summary_line(v)
    hit = final in c.get("accept_types", [c["expected_type"]])
    if hit and c.get("expected_life"):
        hit = getattr(v, "life", None) == c["expected_life"]
    if hit and "expected_pinned" in c and not isinstance(v, Invalid):
        if render.is_pinned(v) != c["expected_pinned"]:
            hit, shown = False, shown + " [📌 nesedí]"
    mo = c["mock_output"]
    if hit and not isinstance(v, Invalid):
        for field in ("start", "due_date", "deadline_date", "all_day_date"):
            ref, got = mo.get(field), getattr(v, field, None)
            if ref and got is not None and str(got)[:10] != ref[:10]:
                hit, shown = False, shown + f" [DATUM {field}: {str(got)[:10]} ≠ {ref[:10]}]"
    return hit, model_type, shown


def run_sync(client, cases, now) -> dict[str, ClassifyResult]:
    return {c["id"]: parse_response(client.messages.create(**request_params(c["text"], "", now)))
            for c in cases}


def run_batch(client, cases, now) -> dict[str, ClassifyResult]:
    batch = client.messages.batches.create(requests=[
        Request(custom_id=c["id"],
                params=MessageCreateParamsNonStreaming(**request_params(c["text"], "", now)))
        for c in cases
    ])
    print(f"batch {batch.id} submitted ({len(cases)} requests)", file=sys.stderr)
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        time.sleep(10)
    out: dict[str, ClassifyResult] = {}
    for r in client.messages.batches.results(batch.id):
        if r.result.type == "succeeded":
            out[r.custom_id] = parse_response(r.result.message)
        else:
            out[r.custom_id] = ClassifyResult(None, 0, 0, f"batch {r.result.type}")
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--full", action="store_true")
    mode.add_argument("--changed", action="store_true")
    mode.add_argument("--ids")
    p.add_argument("--base", default="origin/main")
    p.add_argument("--sync", action="store_true")
    p.add_argument("--no-warm", action="store_true")
    args = p.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("H2_ANTHROPIC_API_KEY")
    if not key:
        print("missing ANTHROPIC_API_KEY / H2_ANTHROPIC_API_KEY", file=sys.stderr)
        return 2
    now, cases = load_cases()
    if args.changed:
        wanted = set(changed_ids(cases, args.base))
    elif args.ids:
        wanted = set(args.ids.split(","))
    else:
        wanted = {c["id"] for c in cases}
    cases = [c for c in cases if c["id"] in wanted]
    if not cases:
        print("no cases selected")
        return 0
    client = anthropic.Anthropic(api_key=key)

    sync_results: dict[str, ClassifyResult] = {}
    batch_results: dict[str, ClassifyResult] = {}
    if args.sync:
        sync_results = run_sync(client, cases, now)
    else:
        rest = cases
        if not args.no_warm:
            # One synchronous request writes the cache; batch requests can then read it.
            sync_results = run_sync(client, cases[:1], now)
            rest = cases[1:]
        if rest:
            batch_results = run_batch(client, rest, now)

    ok = 0
    tot = {"in": 0, "cw": 0, "cr": 0, "out": 0}
    usd = 0.0
    print("| id | očekáváno (life) | model | po validaci | výsledek | cesta |")
    print("|---|---|---|---|---|---|")
    for c in cases:
        is_batch = c["id"] in batch_results
        res = batch_results.get(c["id"]) or sync_results[c["id"]]
        hit, model_type, shown = judge(c, res, now)
        ok += hit
        for k, val in (("in", res.in_tokens), ("cw", res.cache_write), ("cr", res.cache_read),
                       ("out", res.out_tokens)):
            tot[k] += val
        usd += config.cost_usd(res.in_tokens, res.out_tokens, res.cache_write, res.cache_read,
                               batch=is_batch)
        exp = c["expected_type"] + (f" ({c['expected_life']})" if c.get("expected_life") else "")
        cache = (f"cache read {res.cache_read}" if res.cache_read
                 else f"cache write {res.cache_write}" if res.cache_write else "bez cache")
        path = f"{'batch' if is_batch else 'sync'}, {cache}"
        print(f"| {c['id']} | {exp} | {model_type} | {shown} | {'OK' if hit else 'MISS'} | {path} |")
    full_price = config.cost_usd(tot["in"] + tot["cw"] + tot["cr"], tot["out"])
    print(f"\n{ok}/{len(cases)} shoda · volání {len(cases)} "
          f"(batch {len(batch_results)}, sync {len(sync_results)}) · tokeny: vstup {tot['in']}, "
          f"cache zápis {tot['cw']}, cache čtení {tot['cr']}, výstup {tot['out']} · "
          f"cena kola {usd:.4f} USD (bez cache a batche by to bylo {full_price:.4f} USD)")
    return 0 if ok == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
