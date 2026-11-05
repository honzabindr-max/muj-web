#!/usr/bin/env bash
# Installs the TARS-ORCH launchd job for the current user (idempotent).
#   install.sh            → work.good-inventions.tars-orch.plist (StartInterval 1800 s; také backward cesta z PR 2)
#   install.sh wake-gate  → work.good-inventions.tars-orch.wake-gate.plist (minutová brána, etapa 4 PR 2, jen s kartou)
# Obě varianty mají stejný Label, takže nikdy neběží současně. runs/wake/ a runs/next-wake po návratu zůstanou.
set -euo pipefail
LABEL=work.good-inventions.tars-orch
VARIANT="${1:-}"
case "$VARIANT" in
  "") SRC_NAME="$LABEL.plist" ;;
  wake-gate) SRC_NAME="$LABEL.wake-gate.plist" ;;
  *) echo "usage: install.sh [wake-gate]" >&2; exit 2 ;;
esac
SRC="$(cd "$(dirname "$0")" && pwd)/$SRC_NAME"
DST="$HOME/Library/LaunchAgents/$LABEL.plist"
plutil -lint "$SRC"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SRC" "$DST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|run interval|calendar" || true
