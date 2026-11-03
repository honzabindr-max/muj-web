#!/usr/bin/env bash
# Spuštění Codex review na pozadí (nahrazuje: cd <wt> && nohup sh -c 'codex exec ...' &).
# Použití: tars/orch/review-launch.sh <worktree> <prompt-file> <out-file>
# Vrací hned (exit 0); výsledek přibude do <out-file>, poslední řádek je EXIT=<kód>.
# Je v allowlistu tars/guard/bash-preflight.allow, takže nevyvolá ruční schvalování.
if [ "$#" -ne 3 ]; then
  echo "Použití: review-launch.sh <worktree> <prompt-file> <out-file>" >&2
  exit 2
fi
wt="$1"
prompt="$2"
out="$3"
case "$prompt" in /*) ;; *) prompt="$PWD/$prompt" ;; esac
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac
if [ ! -d "$wt" ]; then
  echo "review-launch: worktree neexistuje: $wt" >&2
  exit 1
fi
if [ ! -r "$prompt" ]; then
  echo "review-launch: prompt nelze číst: $prompt" >&2
  exit 1
fi
cd "$wt" || exit 1
nohup sh -c 'codex exec -s read-only "$(cat "$1")" < /dev/null > "$2" 2>&1; echo "EXIT=$?" >> "$2"' sh "$prompt" "$out" > /dev/null 2>&1 &
echo "review-launch: spuštěno, výstup: $out"
exit 0
