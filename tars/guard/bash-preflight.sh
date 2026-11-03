#!/usr/bin/env bash
# TARS bash-preflight (DR-036, P04) - PreToolUse hook pro nástroj Bash.
# Tenká obálka: logika je v bash-preflight.py (python3, bez jq).
# Selhání hooku (chybí python3 / skript) NEBLOKUJE práci: exit 1 = nezablokující chyba s hláškou na stderr.
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "bash-preflight: python3 chybí, kontrola Bash příkazů je vypnutá (příkaz NEBYL zablokován)." >&2
  exit 1
fi
if [ ! -f "$dir/bash-preflight.py" ]; then
  echo "bash-preflight: chybí $dir/bash-preflight.py, kontrola je vypnutá (příkaz NEBYL zablokován)." >&2
  exit 1
fi
exec python3 -I "$dir/bash-preflight.py"
