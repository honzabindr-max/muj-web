#!/usr/bin/env bash
# TARS browser launcher (DR-029 krok 6) — varianta B pod dohledem invariantu I8.
# Skutečný Chrome s izolovaným profilem TARS-agent a ladicím portem jen na 127.0.0.1; Playwright MCP se
# k němu jen připojí (--cdp-endpoint). Spouštění prohlížeče ani MCP nesmí jít jinak než přes tento skript.
#   start   spustí Chrome (jen při běžící zakázce, profil bez Google účtu, port volný) a ověří identitu procesu
#   verify  ověří, že na portu poslouchá právě ten Chrome TARS-agent, který spustil `start`, na 127.0.0.1
#   mcp     verify + exec Playwright MCP připojený k tomuto endpointu (pevná verze, čisté prostředí PLAYWRIGHT_*)
#   stop    ukončí jen ten Chrome, který spustil `start` (pid + čas startu ze souboru, příkazový řádek znovu ověřen)
# Exit 0 = OK, 1 = porušení nebo chyba (důvod na stderr jako "TARS-BROWSER FAIL ..."). Obsah profilu se nečte,
# z Default/Preferences jen klíč account_info (vypisuje se jen počet).
# Profil je kotvený: kanonická cesta musí končit /TARS-agent/chrome-profile (symlinky se rozřeší), nikdy ne
# běžný profil Chrome. TARS_AGENT_PROFILE smí jen přesměrovat celý strom (testy), ne obejít toto pravidlo.
# Testy: TARS_GUARD_REPO, TARS_RUNS_DIR, TARS_AGENT_PROFILE, TARS_CDP_PORT, TARS_CHROME_BIN, TARS_GUARD_PS_CMD,
#        TARS_BROWSER_DRYRUN=1 (mcp jen vypíše příkaz; jen tehdy se berou v úvahu TARS_BROWSER_LISTENER_CMD =
#        příkazový řádek procesu na portu a TARS_BROWSER_BIND_CMD = adresy `lsof -Fn`, takže skutečné připojení
#        nejde podvrhnout proměnnou prostředí).
root="${TARS_GUARD_REPO:-$HOME/Projects/muj-web}"
runs="${TARS_RUNS_DIR:-$root/runs}"
prof_in="${TARS_AGENT_PROFILE:-$HOME/Library/Application Support/TARS-agent/chrome-profile}"
port="${TARS_CDP_PORT:-9333}"
chrome="${TARS_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mcp_pkg="@playwright/mcp@0.0.84"
pidfile="$runs/.chrome.pid"

fail() { echo "TARS-BROWSER FAIL $1" >&2; exit 1; }

case "$port" in ''|*[!0-9]*) fail "neplatný port: $port" ;; esac
[ "$port" -ge 1024 ] && [ "$port" -le 65535 ] || fail "port mimo 1024–65535: $port"

# Kanonická cesta profilu (bez symlinků) musí být přesně …/TARS-agent/chrome-profile.
prof=$(cd "$prof_in" 2>/dev/null && pwd -P)
[ -n "$prof" ] || fail "profil TARS-agent neexistuje: $prof_in"
case "$prof" in
  */TARS-agent/chrome-profile) ;;
  *) fail "profil není …/TARS-agent/chrome-profile (po rozřešení symlinků): $prof" ;;
esac
case "$prof" in */Google/Chrome*) fail "cesta profilu míří na běžný profil Chrome: $prof" ;; esac

need_lock() {
  [ -f "$runs/.lock" ] || fail "žádná běžící zakázka (runs/.lock chybí) – ladicí port smí existovat jen během zakázky"
}

account_check() {
  [ -f "$prof/Default/Preferences" ] || return 0
  local n
  n=$(python3 -c 'import json,sys
try:
    a=json.load(open(sys.argv[1])).get("account_info") or []
    print(len(a))
except Exception:
    print("ERR")' "$prof/Default/Preferences" 2>/dev/null)
  case "$n" in
    0) ;;
    ERR|"") fail "Preferences profilu TARS-agent nečitelné – Google účet UNKNOWN" ;;
    *) fail "v profilu TARS-agent je přihlášený Google účet ($n) – stop" ;;
  esac
}

# Pid procesu, který poslouchá na 127.0.0.1:$port (prázdný = nikdo).
listener_pid() {
  lsof -nP "-iTCP@127.0.0.1:$port" -sTCP:LISTEN -t 2>/dev/null | head -1
}

# Příkazový řádek procesu, který poslouchá na 127.0.0.1:$port (prázdný = nikdo).
listener_cmd() {
  if [ "${TARS_BROWSER_DRYRUN:-}" = "1" ] && [ -n "${TARS_BROWSER_LISTENER_CMD:-}" ]; then eval "$TARS_BROWSER_LISTENER_CMD"; return; fi
  local pid
  pid=$(listener_pid)
  [ -n "$pid" ] && ps -ww -o command= -p "$pid" 2>/dev/null
}

# Všechny adresy, na kterých port poslouchá, musí být loopback.
bind_check() {
  local addrs a
  if [ "${TARS_BROWSER_DRYRUN:-}" = "1" ] && [ -n "${TARS_BROWSER_BIND_CMD:-}" ]; then addrs=$(eval "$TARS_BROWSER_BIND_CMD"); else addrs=$(lsof -nP "-iTCP:$port" -sTCP:LISTEN -Fn 2>/dev/null); fi
  while IFS= read -r a; do
    case "$a" in
      n127.0.0.1:"$port"|n\[::1\]:"$port"|n"localhost:$port"|"") ;;
      n*) fail "ladicí port $port poslouchá mimo 127.0.0.1 ($a)" ;;
    esac
  done <<< "$addrs"
}

# Přesně náš Chrome: spustitelný soubor, jediný --user-data-dir = profil TARS-agent, náš port, adresa 127.0.0.1.
identity_ok() {
  local cmd="$1" rest
  case "$cmd" in "$chrome "*|"$chrome") ;; *) return 1 ;; esac
  case "$cmd" in
    *"--user-data-dir=$prof --"*|*"--user-data-dir=$prof") ;;
    *) return 1 ;;
  esac
  rest="${cmd/--user-data-dir=$prof/}"
  case "$rest" in *--user-data-dir*) return 1 ;; esac
  case "$cmd" in *"--remote-debugging-port=$port"[\ ]*|*"--remote-debugging-port=$port") ;; *) return 1 ;; esac
  case "$cmd" in *"--remote-debugging-address=127.0.0.1"[\ ]*|*"--remote-debugging-address=127.0.0.1") ;; *) return 1 ;; esac
  return 0
}

proc_start() { ps -ww -o lstart= -p "$1" 2>/dev/null | sed 's/^ *//'; }

verify() {
  need_lock
  account_check
  local cmd
  cmd=$(listener_cmd)
  [ -n "$cmd" ] || fail "na 127.0.0.1:$port nikdo neposlouchá – prohlížeč TARS-agent neběží"
  identity_ok "$cmd" || fail "proces na ladicím portu $port není profil TARS-agent na 127.0.0.1 – stop (fail-closed)"
  bind_check
  # Poslouchat musí přímo ten proces, který spustil `start` (ne jiný Chrome se stejnými argumenty).
  if [ "${TARS_BROWSER_DRYRUN:-}" != "1" ]; then
    local own lp
    own=$(cut -d' ' -f1 "$pidfile" 2>/dev/null)
    lp=$(listener_pid)
    [ -n "$own" ] && [ "$own" = "$lp" ] || fail "na portu $port neposlouchá Chrome spuštěný tímto skriptem (pid ${lp:-?} ≠ ${own:-?})"
  fi
}

stop_pid() {
  [ -f "$pidfile" ] || { echo "TARS-BROWSER OK nic ke zavření"; return 0; }
  local pid started cmd i
  pid=$(cut -d' ' -f1 "$pidfile" 2>/dev/null)
  started=$(cut -d' ' -f2- "$pidfile" 2>/dev/null)
  case "$pid" in ''|0|*[!0-9]*) rm -f "$pidfile"; return 0 ;; esac
  cmd=$(ps -ww -o command= -p "$pid" 2>/dev/null)
  if [ -z "$cmd" ]; then rm -f "$pidfile"; echo "TARS-BROWSER OK Chrome už neběží"; return 0; fi
  # Zabíjí se jen proces se stejným časem startu, který je stále přesně náš Chrome TARS-agent.
  [ "$(proc_start "$pid")" = "$started" ] || fail "pid $pid už nepatří Chromu spuštěnému tímto skriptem (jiný čas startu) – nezabíjím"
  identity_ok "$cmd" || fail "pid $pid už není Chrome TARS-agent – nezabíjím"
  kill -TERM "$pid" 2>/dev/null
  for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null; fi
  rm -f "$pidfile"
  echo "TARS-BROWSER OK Chrome TARS-agent zavřen"
}

# Úklid po neúspěšném startu: zabíjí se výhradně proces, který jsme právě spustili sami ($!).
kill_own() {
  local i
  kill -TERM "$1" 2>/dev/null
  for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$1" 2>/dev/null || break; sleep 0.5; done
  if kill -0 "$1" 2>/dev/null; then kill -KILL "$1" 2>/dev/null; fi
  rm -f "$pidfile"
}

start() {
  need_lock
  [ -x "$chrome" ] || fail "Chrome nenalezen: $chrome"
  account_check
  local ps_out l
  ps_out=$(${TARS_GUARD_PS_CMD:-ps -axww -o command=} 2>/dev/null)
  while IFS= read -r l; do
    case "$l" in
      *"Google Chrome"*"--user-data-dir=$prof"*) case "$l" in *--type=*) ;; *) fail "profil TARS-agent je už otevřený bez ladicího portu – zavři jeho okno (Cmd+Q) a zakázku spusť znovu" ;; esac ;;
    esac
  done <<< "$ps_out"
  [ -z "$(listener_cmd)" ] || fail "port $port už někdo poslouchá – stop"
  mkdir -p "$runs"
  # Atomicky (noclobber): dva souběžné starty nepřepíšou pid soubor jeden druhému.
  ( set -C; echo "0" > "$pidfile" ) 2>/dev/null || fail "předchozí Chrome TARS-agent nebyl zavřen ($pidfile) – spusť stop"
  nohup "$chrome" "--user-data-dir=$prof" "--remote-debugging-port=$port" "--remote-debugging-address=127.0.0.1" \
    --no-first-run --no-default-browser-check about:blank >/dev/null 2>&1 &
  own=$!
  echo "$own $(proc_start "$own")" > "$pidfile"
  disown 2>/dev/null
  trap 'kill_own "$own"; exit 1' TERM INT HUP
  local i up=0
  for i in $(seq 1 40); do
    kill -0 "$own" 2>/dev/null || break
    if curl -s --connect-timeout 1 -m 1 -o /dev/null "http://127.0.0.1:$port/json/version"; then up=1; break; fi
    sleep 0.3
  done
  if [ $up -ne 1 ]; then kill_own "$own"; fail "Chrome TARS-agent nenaběhl s ladicím portem"; fi
  ( verify ) || { kill_own "$own"; exit 1; }
  trap - TERM INT HUP
  echo "TARS-BROWSER OK Chrome TARS-agent běží na 127.0.0.1:$port"
}

mcp() {
  verify
  # Playwright MCP čte konfiguraci i z prostředí (PLAYWRIGHT_MCP_CONFIG, _ENDPOINT, _EXTENSION, _USER_DATA_DIR …),
  # a ta by mohla přebít ověřený CDP endpoint. Proto se všechny proměnné PLAYWRIGHT_* zahodí.
  local v
  for v in $(env | sed -n 's/^\(PLAYWRIGHT[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$v"; done
  # Jediný povolený způsob připojení: CDP endpoint na loopbacku. Žádné --user-data-dir, --extension, --config ani
  # --executable-path, takže MCP nemůže otevřít ani převzít jiný (běžný) profil.
  local args=(-y "$mcp_pkg" --cdp-endpoint "http://127.0.0.1:$port" --no-webmcp)
  if [ "${TARS_BROWSER_DRYRUN:-}" = "1" ]; then echo "EXEC npx ${args[*]}"; return 0; fi
  exec npx "${args[@]}"
}

case "${1:-}" in
  start) start ;;
  verify) verify; echo "TARS-BROWSER OK identita ověřena" ;;
  mcp) mcp ;;
  stop) stop_pid ;;
  *) fail "použití: tars-browser.sh start|verify|mcp|stop" ;;
esac
