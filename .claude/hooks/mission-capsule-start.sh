#!/usr/bin/env bash
# SessionStart: načti kufřík mise do kontextu (jen čtení).
# Chybí-li soubor, nebo je last_verified_at starší než 7 dní (nebo nečitelné), vypiš varování.
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
f="$root/missions/mezi-vami/capsule.md"
if [ ! -f "$f" ]; then
  echo "VAROVÁNÍ: kufřík mise missions/mezi-vami/capsule.md chybí. Nepokračuj, jako by kontext existoval."
  exit 0
fi
age_days=$(python3 - "$f" <<'PY'
import re, sys
from datetime import datetime, timezone
t = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"^last_verified_at:\s*(\S+)", t, re.M)
try:
    d = datetime.fromisoformat(m.group(1).strip("\"'"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    print((datetime.now(timezone.utc) - d).days)
except Exception:
    print(-1)
PY
)
if [ "$age_days" = "-1" ]; then
  echo "VAROVÁNÍ: v capsule.md chybí nebo je nečitelné last_verified_at. Stáří kufříku je UNKNOWN."
elif [ "$age_days" -gt 7 ]; then
  echo "VAROVÁNÍ: kufřík mise capsule.md je starší než 7 dní (${age_days} dní). Ověř stav proti gitu a HANDOFF, než mu uvěříš."
fi
echo "=== KUFŘÍK MISE: missions/mezi-vami/capsule.md ==="
cat "$f"
