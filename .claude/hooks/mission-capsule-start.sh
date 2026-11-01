#!/usr/bin/env bash
# SessionStart: načti kufřík mise do kontextu (jen čtení) jako JSON hookSpecificOutput.additionalContext.
# Chybí-li soubor, nebo je last_verified_at starší než 7 dní (nebo nečitelné), přidej varování.
# Marker běhu: /tmp/mission-capsule-hook.log (mimo repo).
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
echo "$(date -Iseconds) ran root=$root cwd=$(pwd) pid=$$" >> /tmp/mission-capsule-hook.log 2>/dev/null
python3 - "$root/missions/mezi-vami/capsule.md" <<'PY'
import json, re, sys, os
from datetime import datetime, timezone
f = sys.argv[1]
out = []
if not os.path.isfile(f):
    out.append("VAROVÁNÍ: kufřík mise missions/mezi-vami/capsule.md chybí. Nepokračuj, jako by kontext existoval.")
else:
    t = open(f, encoding="utf-8").read()
    m = re.search(r"^last_verified_at:\s*(\S+)", t, re.M)
    try:
        d = datetime.fromisoformat(m.group(1).strip("\"'"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - d).days
        if age > 7:
            out.append(f"VAROVÁNÍ: kufřík mise capsule.md je starší než 7 dní ({age} dní). Ověř stav proti gitu a HANDOFF, než mu uvěříš.")
    except Exception:
        out.append("VAROVÁNÍ: v capsule.md chybí nebo je nečitelné last_verified_at. Stáří kufříku je UNKNOWN.")
    out.append("=== KUFŘÍK MISE: missions/mezi-vami/capsule.md ===\n" + t)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(out)}}, ensure_ascii=False))
PY
exit 0
