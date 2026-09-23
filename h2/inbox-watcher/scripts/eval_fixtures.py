"""Run every fixture through the real model + validator and report agreement.

Spends real money (~20 Haiku calls, well under 0.05 USD). Reads the key from
ANTHROPIC_API_KEY or H2_ANTHROPIC_API_KEY; never prints it.

    .venv/bin/python scripts/eval_fixtures.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import anthropic  # noqa: E402

from h2iw import config, render  # noqa: E402
from h2iw.classify import classify  # noqa: E402
from h2iw.validate import Invalid, validate  # noqa: E402


def main() -> int:
    key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("H2_ANTHROPIC_API_KEY")
    if not key:
        print("missing ANTHROPIC_API_KEY / H2_ANTHROPIC_API_KEY", file=sys.stderr)
        return 2
    fx = json.loads((Path(__file__).resolve().parents[1] / "tests/fixtures/inputs.json").read_text())
    now = datetime.fromisoformat(fx["now"])
    client = anthropic.Anthropic(api_key=key)

    ok = 0
    in_tok = out_tok = 0
    print("| id | očekáváno (life) | model | po validaci | výsledek |")
    print("|---|---|---|---|---|")
    for c in fx["cases"]:
        res = classify(client, c["text"], "", now)
        in_tok += res.in_tokens
        out_tok += res.out_tokens
        model_type = (res.data or {}).get("type", f"ERR {res.error}")
        v = validate(res.data, now, c["text"])
        final = "UNKNOWN" if isinstance(v, Invalid) else v.type
        shown = f"UNKNOWN ({v.reason})" if isinstance(v, Invalid) else render.summary_line(v)
        hit = final in c.get("accept_types", [c["expected_type"]])
        if hit and c.get("expected_life"):
            hit = getattr(v, "life", None) == c["expected_life"]
        # Dates must match the reference answer (a wrong day is worse than a wrong type).
        mo = c["mock_output"]
        if hit and not isinstance(v, Invalid):
            for field in ("start", "due_date", "deadline_date", "all_day_date"):
                ref, got = mo.get(field), getattr(v, field, None)
                if ref and got is not None and str(got)[:10] != ref[:10]:
                    hit = False
                    shown += f" [DATUM {field}: {str(got)[:10]} ≠ {ref[:10]}]"
        ok += hit
        exp = c["expected_type"] + (f" ({c['expected_life']})" if c.get("expected_life") else "")
        print(f"| {c['id']} | {exp} | {model_type} | {shown} | {'OK' if hit else 'MISS'} |")
    cost = (in_tok * config.PRICE_INPUT_PER_MTOK + out_tok * config.PRICE_OUTPUT_PER_MTOK) / 1e6
    print(f"\n{ok}/{len(fx['cases'])} shoda typu · tokens in={in_tok} out={out_tok} · {cost:.4f} USD")
    return 0 if ok == len(fx["cases"]) else 1


if __name__ == "__main__":
    sys.exit(main())
