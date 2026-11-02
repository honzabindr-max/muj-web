#!/usr/bin/env bash
# TARS-GUARD I8 — prohlížečová automatizace jen v izolovaném profilu TARS-agent.
#   a) každý Chrome s --remote-debugging-port běží s --user-data-dir profilu TARS-agent (nikdy běžný profil vlastníka)
#   b) ladicí port jen na 127.0.0.1 a jen po dobu zakázky (runs/.lock existuje)
#   c) v profilu TARS-agent není Google účet (z Default/Preferences se čte jen klíč account_info, vypisuje se jen počet)
# Výstup: jeden řádek "I8 OK ..." nebo řádky "I8 ALARM ..."; "I8 WARN ..." pro UNKNOWN. Exit 0 vždy.
# Testy: TARS_AGENT_PROFILE, TARS_GUARD_PS_CMD, TARS_GUARD_REPO přepíší cesty a výpis procesů.
root="${TARS_GUARD_REPO:-$HOME/Projects/muj-web}"
prof="${TARS_AGENT_PROFILE:-$HOME/Library/Application Support/TARS-agent/chrome-profile}"
procs=$(${TARS_GUARD_PS_CMD:-ps -axww -o command=} 2>/dev/null)
alarm=()
warn=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in *--remote-debugging-port*) ;; *) continue ;; esac
  case "$line" in
    *"--user-data-dir=$prof"*)
      [ -f "$root/runs/.lock" ] || alarm+=("ladicí port profilu TARS-agent je otevřený mimo běžící zakázku")
      ;;
    *) alarm+=("ladicí port Chromu běží mimo profil TARS-agent (automatizace by mířila na jiný profil)") ;;
  esac
  case "$line" in
    *--remote-debugging-address=127.0.0.1*) ;;
    *--remote-debugging-address=*) alarm+=("ladicí port Chromu není omezen na 127.0.0.1") ;;
  esac
done <<< "$procs"
if [ -f "$prof/Default/Preferences" ]; then
  n=$(python3 -c 'import json,sys
try:
    a=json.load(open(sys.argv[1])).get("account_info") or []
    print(len(a))
except Exception:
    print("ERR")' "$prof/Default/Preferences" 2>/dev/null)
  case "$n" in
    0) ;;
    ERR|"") warn+=("Preferences profilu TARS-agent nečitelné – Google účet UNKNOWN") ;;
    *) alarm+=("v profilu TARS-agent je přihlášený Google účet ($n) – profil musí být bez Google účtu") ;;
  esac
fi
for w in "${warn[@]}"; do echo "I8 WARN $w"; done
if [ ${#alarm[@]} -gt 0 ]; then
  for a in "${alarm[@]}"; do echo "I8 ALARM $a"; done
else
  echo "I8 OK prohlížečová automatizace jen v profilu TARS-agent, bez Google účtu"
fi
exit 0
