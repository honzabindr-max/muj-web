#!/usr/bin/env bash
# TARS-GUARD I8 — prohlížečová automatizace jen v izolovaném profilu TARS-agent.
#   a) každý Chrome s --remote-debugging-port běží s --user-data-dir profilu TARS-agent (nikdy běžný profil vlastníka)
#   b) ladicí port jen na 127.0.0.1 a jen po dobu zakázky (runs/.lock existuje)
#   c) v profilu TARS-agent není Google účet (z Default/Preferences se čte jen klíč account_info, vypisuje se jen počet)
#   d) Playwright MCP (DR-029 krok 6) se smí připojit jen k ladicímu portu na loopbacku a jen během zakázky; nikdy
#      s --extension (běžný prohlížeč vlastníka), s jiným --user-data-dir než TARS-agent ani na cizí --cdp-endpoint.
#      Spouštění Chromu a MCP řídí tars-browser.sh (ten před připojením ověří identitu procesu na portu).
# Výstup: jeden řádek "I8 OK ..." nebo řádky "I8 ALARM ..."; "I8 WARN ..." pro UNKNOWN. Exit 0 vždy.
# Testy: TARS_AGENT_PROFILE, TARS_GUARD_PS_CMD, TARS_GUARD_REPO přepíší cesty a výpis procesů.
root="${TARS_GUARD_REPO:-$HOME/Projects/muj-web}"
runs="${TARS_RUNS_DIR:-$root/runs}"
prof="${TARS_AGENT_PROFILE:-$HOME/Library/Application Support/TARS-agent/chrome-profile}"
# Kanonická cesta profilu (symlinky rozřešeny), pokud existuje; Chrome se spouští právě s ní.
profc=$(cd "$prof" 2>/dev/null && pwd -P)
[ -n "$profc" ] && prof="$profc"
procs=$(${TARS_GUARD_PS_CMD:-ps -axww -o command=} 2>/dev/null)
alarm=()
warn=()
# Profil TARS-agent je kotvený: proměnná prostředí ho nesmí přesměrovat na jiný (např. běžný) profil.
case "$prof" in
  */TARS-agent/chrome-profile) ;;
  *) alarm+=("cesta profilu TARS-agent není …/TARS-agent/chrome-profile (TARS_AGENT_PROFILE míří jinam)") ;;
esac
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Jen procesy, které jsou samy Playwright MCP: `node [přepínače] <cesta k balíčku>` nebo `npx|npm exec <balíček>` (s
  # přepínači před ním). Běžný proces, který tyto přepínače jen zmiňuje ve svých argumentech (codex, gh, editor,
  # `node report.js playwright-mcp`), poplach nespouští.
  if printf '%s\n' "$line" | grep -Eq '^(/[^ ]*/)?node( .*)? [^ ]*(/@playwright/mcp/|/playwright-mcp)[^ ]*( |$)|^(/[^ ]*/)?(npx|npm exec)( +-[^ ]+)* +(@playwright/mcp|playwright-mcp)'; then
    case "$line" in *"--extension"*) alarm+=("Playwright MCP s --extension míří na běžný prohlížeč vlastníka") ;; esac
    # --user-data-dir (zápis s = i s mezerou): po odebrání povolených výskytů (přesně profil TARS-agent, hranice hodnoty
    # je mezera nebo konec řádku) nesmí žádný zbýt.
    rest="$line "
    rest="${rest//"--user-data-dir=$prof "/}"
    rest="${rest//"--user-data-dir $prof "/}"
    case "$rest" in *--user-data-dir*) alarm+=("Playwright MCP běží s jiným profilem než TARS-agent") ;; esac
    # --cdp-endpoint: po odebrání povolených výskytů (http://127.0.0.1:<port> bez dalších znaků) nesmí žádný zbýt.
    case "$line" in
      *--cdp-endpoint*)
        rest=$(printf '%s\n' "$line" | sed -E 's#--cdp-endpoint[ =]http://127\.0\.0\.1:[0-9]+( |$)##g')
        case "$rest" in *--cdp-endpoint*) alarm+=("Playwright MCP se připojuje na ladicí endpoint mimo 127.0.0.1") ;; esac
        [ -f "$runs/.lock" ] || alarm+=("Playwright MCP je připojený k prohlížeči mimo běžící zakázku")
        ;;
    esac
    continue
  fi
  case "$line" in *--remote-debugging-port*) ;; *) continue ;; esac
  case "$line" in
    *"--user-data-dir=$prof"*)
      [ -f "$runs/.lock" ] || alarm+=("ladicí port profilu TARS-agent je otevřený mimo běžící zakázku")
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
