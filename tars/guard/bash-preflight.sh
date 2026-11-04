#!/usr/bin/env bash
# TARS bash-preflight (DR-036, P04) - PreToolUse hook pro nástroj Bash.
# Tenká obálka: logika je v bash-preflight.py (python3, bez jq).
# Fail-closed (Radar 2026-11-03 #4): selhání hooku (chybí python3 / skript) skončí exit 2.
# Exit 2 zablokuje volání Bash vždy, i bez nastavení; v .claude/settings.json má hook navíc
# onFailure: "block", takže zablokuje i timeout, pád nebo jiný neočekávaný exit kód.
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "bash-preflight: python3 chybí, kontrolu Bash příkazů nelze provést. Příkaz byl ZABLOKOVÁN (fail-closed)." >&2
  exit 2
fi
if [ ! -f "$dir/bash-preflight.py" ]; then
  echo "bash-preflight: chybí $dir/bash-preflight.py, kontrolu nelze provést. Příkaz byl ZABLOKOVÁN (fail-closed)." >&2
  exit 2
fi
exec python3 -I "$dir/bash-preflight.py"
