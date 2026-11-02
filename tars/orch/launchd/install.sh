#!/usr/bin/env bash
# Installs the TARS-ORCH launchd job for the current user (idempotent).
set -euo pipefail
LABEL=work.good-inventions.tars-orch
SRC="$(cd "$(dirname "$0")" && pwd)/$LABEL.plist"
DST="$HOME/Library/LaunchAgents/$LABEL.plist"
plutil -lint "$SRC"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SRC" "$DST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|run interval" || true
