#!/bin/sh
# TARS minutová brána probuzení (etapa 4 PR 2, NAVRH-v6 §10.2). launchd ji spouští každou minutu
# (StartCalendarInterval, po probuzení Macu doběhne jednou). Rozhodne, zda spustit plný tick, a nic víc.
#
# Čistý /bin/sh: jen date, cat, ls, mkdir, mv, kill -0, read, printf a aritmetika $(( )). Bez node, modelu a guardu.
# Plný tick se spustí, když platí jedno z:
#   (a) next-wake.epoch <= now a last-gate-start < next-wake.epoch (probuzení platí a od té doby žádný tick nezačal),
#   (c) re-entry po locked / guard_alarm: next-wake.epoch <= now, poslední spuštění (last-gate-start >= epoch) má
#       výsledek locked nebo guard_alarm, k = počet takových výsledků s názvem >= epoch, 1 <= k <= 5,
#       now >= last-gate-start + backoff(k) (1, 2, 5, 10, 30 min),
#   (b) pojistka: od last-gate-start uplynulo >= 30 min (nebo last-gate-start chybí).
# next-wake brána jen čte (pole epoch), nikdy ho nezapisuje. Nic nemaže: zámky se přejmenují do archivu.
#
# Prostředí:
#   TARS_RUNS_DIR    adresář runs/ (výchozí $HOME/Projects/muj-web/runs)
#   TARS_GATE_TICK   příkaz plného ticku (spustí se přes /bin/sh -c, dostane TARS_GATE_START=<epoch>); povinný
#   TARS_GATE_NOW    jen testy: falešné hodiny (epocha v sekundách)
#   TARS_GATE_SAFETY_S    pojistka (výchozí 1800 s)
#   TARS_GATE_LOCK_MAX_S  zámek živého PID starší než tolik sekund = zastaralý (ochrana před recyklací PID, výchozí 43200)

RUNS=${TARS_RUNS_DIR:-$HOME/Projects/muj-web/runs}
W=$RUNS/wake
L=$W/gate.lock.d
SAFETY_S=${TARS_GATE_SAFETY_S:-1800}
LOCK_MAX_S=${TARS_GATE_LOCK_MAX_S:-43200}
HAVE_LOCK=0

is_num() {
  case $1 in
    '' | *[!0-9]*) return 1 ;;
  esac
  [ ${#1} -le 12 ]
}

if [ -n "${TARS_GATE_NOW:-}" ]; then NOW=$TARS_GATE_NOW; else NOW=$(date +%s); fi
if ! is_num "$NOW"; then
  echo "wake-gate: neplatný čas" >&2
  exit 1
fi
is_num "$SAFETY_S" || SAFETY_S=1800
is_num "$LOCK_MAX_S" || LOCK_MAX_S=43200

if ! mkdir -p "$W/outcomes" "$W/stale-locks" "$W/gate-locks"; then
  echo "wake-gate: nejde založit $W" >&2
  exit 1
fi

log() {
  printf '%s %s\n' "$NOW" "$*" >>"$W/gate.log"
  printf 'wake-gate %s %s\n' "$NOW" "$*"
}

first_line() {
  fl=""
  if [ -f "$1" ]; then read -r fl <"$1" || true; fi
  printf '%s' "$fl"
}

backoff() {
  case $1 in
    1) echo 60 ;;
    2) echo 120 ;;
    3) echo 300 ;;
    4) echo 600 ;;
    *) echo 1800 ;;
  esac
}

take_lock() {
  if mkdir "$L" 2>/dev/null; then
    HAVE_LOCK=1
    printf '%s %s\n' "$$" "$NOW" >"$L/pid"
    return 0
  fi
  return 1
}

release_lock() {
  if [ "$HAVE_LOCK" = 1 ]; then
    HAVE_LOCK=0
    day=$((NOW / 86400))
    mkdir -p "$W/gate-locks/$day" && mv "$L" "$W/gate-locks/$day/$NOW-$$"
  fi
}

trap release_lock EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# ── zámek brány (není lease, nic v runs/<wo>/ neodemyká) ──
if ! take_lock; then
  holder=""
  started=""
  if [ -f "$L/pid" ]; then read -r holder started <"$L/pid" || true; fi
  stale=0
  if is_num "$holder"; then
    if kill -0 "$holder" 2>/dev/null; then
      if is_num "$started" && [ $((NOW - started)) -ge "$LOCK_MAX_S" ]; then stale=1; fi
    else
      stale=1
    fi
  elif [ -f "$L/pidless-seen" ]; then
    # Zámek bez PID už při minulém spuštění: držitel spadl mezi mkdir a zápisem PID.
    stale=1
  else
    : >"$L/pidless-seen" 2>/dev/null
  fi
  if [ "$stale" != 1 ]; then
    log "skip: zámek drží jiná brána (pid ${holder:-?})"
    exit 0
  fi
  if ! mv "$L" "$W/stale-locks/$NOW-$$"; then
    log "skip: zastaralý zámek nejde přesunout"
    exit 0
  fi
  log "zastaralý zámek (pid ${holder:-?}) přesunut do stale-locks/$NOW-$$"
  if ! take_lock; then
    log "skip: zámek mezitím získala jiná brána"
    exit 0
  fi
fi

# ── stav ──
NW=""
if [ -f "$RUNS/next-wake" ]; then
  c=$(cat "$RUNS/next-wake" 2>/dev/null) || c=""
  case $c in
    '{"epoch":'*)
      v=${c#'{"epoch":'}
      v=${v%%[!0-9]*}
      if is_num "$v"; then NW=$v; fi
      ;;
  esac
  # Nečitelný next-wake = neplatí; spoléhá se na pojistku (b).
fi
LGS=""
if [ -f "$W/last-gate-start" ]; then
  LGS=$(first_line "$W/last-gate-start")
  is_num "$LGS" || LGS=""
fi

# ── rozhodnutí ──
REASON=""
K=0
if [ -n "$NW" ] && [ "$NW" -le "$NOW" ]; then
  if [ -z "$LGS" ] || [ "$LGS" -lt "$NW" ]; then
    REASON=a
  else
    case $(first_line "$W/outcomes/$LGS") in
      locked | guard_alarm)
        for f in "$W/outcomes"/*; do
          [ -f "$f" ] || continue
          n=${f##*/}
          is_num "$n" || continue
          [ "$n" -ge "$NW" ] || continue
          case $(first_line "$f") in
            locked | guard_alarm) K=$((K + 1)) ;;
          esac
        done
        if [ "$K" -ge 1 ] && [ "$K" -le 5 ] && [ "$NOW" -ge $((LGS + $(backoff "$K"))) ]; then
          REASON=c
        fi
        ;;
    esac
  fi
fi
if [ -z "$REASON" ]; then
  if [ -z "$LGS" ] || [ $((NOW - LGS)) -ge "$SAFETY_S" ]; then REASON=b; fi
fi
if [ -z "$REASON" ]; then exit 0; fi

if [ -z "${TARS_GATE_TICK:-}" ]; then
  log "chyba: TARS_GATE_TICK není nastavený, tick nespuštěn"
  exit 1
fi

# ── start: last-gate-start přes tmp + mv (shell neumí fsync; ztráta = nejvýš jeden tick navíc) ──
if ! printf '%s\n' "$NOW" >"$W/last-gate-start.tmp.$$" || ! mv -f "$W/last-gate-start.tmp.$$" "$W/last-gate-start"; then
  log "chyba: last-gate-start nejde zapsat, tick nespuštěn"
  exit 1
fi
case $REASON in
  a) log "tick reason=a next_wake=$NW wake_late_by_s=$((NOW - NW))" ;;
  c) log "tick reason=c next_wake=$NW k=$K" ;;
  *) log "tick reason=b" ;;
esac
TARS_GATE_START=$NOW
export TARS_GATE_START
/bin/sh -c "$TARS_GATE_TICK"
rc=$?
log "tick end rc=$rc"
exit 0
