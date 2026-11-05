#!/bin/sh
# TARS minutová brána probuzení (etapa 4 PR 2, NAVRH-v6 §10.2). launchd ji spouští každou minutu
# (StartCalendarInterval, po probuzení Macu doběhne jednou). Rozhodne, zda spustit plný tick, a nic víc.
#
# Čistý /bin/sh: jen date, cat, mkdir, ln, mv, kill -0, read, printf, od + tr (nonce) a aritmetika $(( )).
# Bez node, modelu a guardu.
#
# Výlučnost (FIX2 nález 1): žádný sdílený zámek, který by se přebíral přesunem. Generace = první řádek
# last-gate-start (0, když chybí). Právo spustit tick z generace G vzniká jedinou atomickou create-only operací:
# `ln` souboru s identitou brány ("pid start nonce") na unikátní jméno claims/G/<n>. link(2) selže, když jméno
# existuje, a soubor má obsah od první chvíle (žádný stav „zámek bez PID“). Pro jedno jméno uspěje nejvýš jedna brána.
# Mrtvý nárok (držitel neběží) se jen označí souborem claims/G/<n>.dead a brána zkusí další jméno <n+1>; nikdy ho
# nepřesouvá ani nevrací. Nárok <n+1> vznikne jen po smrti držitele <n>, takže v generaci žije nejvýš jeden držitel.
# Těsně před startem brána znovu ověří vlastnictví: last-gate-start je stále G a claims/G/<n> nese její identitu.
# Po MAX_CLAIMS mrtvých nárocích (např. opakovaně selhal zápis last-gate-start) generace nezamrzne: fail-safe nárok
# claims/G/f<NOW/SAFETY_S> (create-only ln, jeden na 30min okno) a kontrola, že jiný fail-safe nárok nemá živého držitele.
# Teprve pak zapíše last-gate-start = "now\nidentita" (tmp + mv), čímž generaci G uzavře, a spustí tick.
# Druhý řádek last-gate-start (identita) drží předchozí tick: dokud jeho brána žije, další tick nezačne.
#
# Plný tick se spustí, když platí jedno z:
#   (a) next-wake.epoch <= now a last-gate-start < next-wake.epoch (probuzení platí a od té doby žádný tick nezačal),
#   (c) re-entry po locked / guard_alarm: next-wake.epoch <= now, poslední spuštění (last-gate-start >= epoch) má
#       výsledek locked nebo guard_alarm, k = počet takových výsledků s názvem >= epoch, 1 <= k <= 5,
#       now >= last-gate-start + backoff(k) (1, 2, 5, 10, 30 min),
#   (b) pojistka: od last-gate-start uplynulo >= 30 min (nebo last-gate-start chybí).
# next-wake brána jen čte (pole epoch), nikdy ho nezapisuje. Nic nemaže: nároky i identity zůstávají jako záznam.
#
# Prostředí:
#   TARS_RUNS_DIR    adresář runs/ (výchozí $HOME/Projects/muj-web/runs)
#   TARS_GATE_TICK   příkaz plného ticku (spustí se přes /bin/sh -c, dostane TARS_GATE_START=<epoch>); povinný
#   TARS_GATE_NOW    jen testy: falešné hodiny (epocha v sekundách)
#   TARS_GATE_TEST_HOOK  jen testy: příkaz spuštěný v pojmenovaném bodě (TARS_GATE_HOOK_POINT=after-dead-claim
#                        po zjištění mrtvého nároku, before-start po získání nároku před ověřením a startem)
#   TARS_GATE_SAFETY_S    pojistka (výchozí 1800 s)
#   TARS_GATE_LOCK_MAX_S  identita živého PID starší než tolik sekund = mrtvá (ochrana před recyklací PID, výchozí 43200)

RUNS=${TARS_RUNS_DIR:-$HOME/Projects/muj-web/runs}
W=$RUNS/wake
SAFETY_S=${TARS_GATE_SAFETY_S:-1800}
LOCK_MAX_S=${TARS_GATE_LOCK_MAX_S:-43200}
MAX_CLAIMS=20

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

if ! mkdir -p "$W/outcomes" "$W/claims" "$W/gate-ids"; then
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

# Generace teď: první řádek last-gate-start, jen číslo (jinak prázdná).
lgs_now() {
  g=$(first_line "$W/last-gate-start")
  is_num "$g" || g=""
  printf '%s' "$g"
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

# Žije držitel identity "pid start nonce"? Mrtvý = bez čísla PID, PID neběží, nebo je identita starší než LOCK_MAX_S.
alive_id() {
  set -f
  # shellcheck disable=SC2086
  set -- $1
  set +f
  is_num "${1:-}" || return 1
  kill -0 "$1" 2>/dev/null || return 1
  if is_num "${2:-}" && [ $((NOW - $2)) -ge "$LOCK_MAX_S" ]; then return 1; fi
  return 0
}

# Jen testy: příkaz spuštěný v pojmenovaném bodě (souběh bran nad mrtvým nárokem).
test_hook() {
  if [ -n "${TARS_GATE_TEST_HOOK:-}" ]; then
    TARS_GATE_HOOK_POINT=$1 /bin/sh -c "$TARS_GATE_TEST_HOOK"
  fi
}

# Identita brány: "pid start nonce" (nonce z /dev/urandom; PID i čas se mohou opakovat, nonce ne).
NONCE=$(od -An -tx1 -N8 /dev/urandom 2>/dev/null | tr -d ' \n')
case $NONCE in
  '' | *[!0-9a-f]*) NONCE="x$$x$NOW" ;;
esac
ID="$$ $NOW $NONCE"

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
LGS_ID=""
if [ -f "$W/last-gate-start" ]; then
  {
    read -r LGS || true
    read -r LGS_ID || true
  } <"$W/last-gate-start"
  if ! is_num "$LGS"; then
    LGS=""
    LGS_ID=""
  fi
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

# Předchozí tick ještě běží (jeho brána žije): další nezačne.
if [ -n "$LGS_ID" ] && alive_id "$LGS_ID"; then
  log "skip: tick generace $LGS ještě běží (pid ${LGS_ID%% *})"
  exit 0
fi
if [ -n "$LGS" ] && [ "$NOW" -le "$LGS" ]; then
  log "skip: hodiny nejsou za generací $LGS"
  exit 0
fi

if [ -z "${TARS_GATE_TICK:-}" ]; then
  log "chyba: TARS_GATE_TICK není nastavený, tick nespuštěn"
  exit 1
fi

# ── nárok na generaci: create-only ln na unikátní jméno ──
GEN=${LGS:-0}
CD=$W/claims/$GEN
DAY=$((NOW / 86400))
IDF=$W/gate-ids/$DAY/$NOW-$$-$NONCE
if ! mkdir -p "$CD" "$W/gate-ids/$DAY" || ! printf '%s\n' "$ID" >"$IDF"; then
  log "chyba: nárok na generaci $GEN nejde připravit, tick nespuštěn"
  exit 1
fi
SLOT_S=$SAFETY_S
[ "$SLOT_S" -gt 0 ] || SLOT_S=1
N=0
while :; do
  CLAIM=$CD/$N
  if ln "$IDF" "$CLAIM" 2>/dev/null; then break; fi
  if [ ! -f "$CD/$N" ]; then
    log "chyba: nárok $GEN/$N nejde vytvořit, tick nespuštěn"
    exit 1
  fi
  holder=$(first_line "$CD/$N")
  if alive_id "$holder"; then
    log "skip: generaci $GEN drží jiná brána (nárok $N, pid ${holder%% *})"
    exit 0
  fi
  test_hook after-dead-claim
  if [ "$(lgs_now)" != "$LGS" ]; then
    log "skip: generace $GEN už pokročila (nárok $N dokončen)"
    exit 0
  fi
  # Mrtvý nárok se jen označí (nikdy nepřesouvá); další brána zkusí stejné další jméno a uspěje nejvýš jedna.
  if [ ! -f "$CD/$N.dead" ]; then
    printf '%s %s\n' "$NOW" "$ID" >"$CD/$N.dead" 2>/dev/null
    log "mrtvý nárok $GEN/$N (pid ${holder%% *}) označen, zkouším $GEN/$((N + 1))"
  fi
  N=$((N + 1))
  if [ "$N" -ge "$MAX_CLAIMS" ]; then
    # FIX3: vyčerpané nároky (typicky opakovaně selhal zápis last-gate-start) nesmí generaci zastavit natrvalo.
    # Fail-safe: jeden nárok na časové okno SLOT_S (claims/G/f<okno>, create-only ln), pak kontrola, že žádný jiný
    # fail-safe nárok generace nemá živého držitele (vytvoř-pak-ověř: ze dvou souběžných aspoň jeden druhého uvidí).
    SLOT=$((NOW / SLOT_S))
    CLAIM=$CD/f$SLOT
    if ! ln "$IDF" "$CLAIM" 2>/dev/null; then
      if [ ! -f "$CLAIM" ]; then
        log "chyba: fail-safe nárok $GEN/f$SLOT nejde vytvořit, tick nespuštěn"
        exit 1
      fi
      log "skip: $MAX_CLAIMS mrtvých nároků v generaci $GEN, fail-safe okno $SLOT už použito, tick nespuštěn"
      exit 0
    fi
    for f in "$CD"/f*; do
      [ -f "$f" ] && [ "$f" != "$CLAIM" ] || continue
      n=${f##*/}
      is_num "${n#f}" || continue
      holder=$(first_line "$f")
      if alive_id "$holder"; then
        log "skip: fail-safe generace $GEN drží jiná brána (nárok ${n}, pid ${holder%% *})"
        exit 0
      fi
    done
    log "fail-safe: $MAX_CLAIMS mrtvých nároků v generaci $GEN (start opakovaně selhal), nárok $GEN/f$SLOT, nejvýš 1 tick za $SLOT_S s"
    break
  fi
done

# ── opětovné ověření vlastnictví těsně před startem ──
test_hook before-start
CN=${CLAIM##*/}
if [ "$(lgs_now)" != "$LGS" ]; then
  log "skip: generace $GEN mezitím pokročila, nárok $GEN/$CN se nepoužije"
  exit 0
fi
if [ "$(first_line "$CLAIM")" != "$ID" ]; then
  log "skip: nárok $GEN/$CN nenese identitu této brány"
  exit 0
fi

# ── start: last-gate-start "now\nidentita" přes tmp + mv (shell neumí fsync; ztráta = nejvýš jeden tick navíc) ──
TMP=$W/last-gate-start.tmp.$$.$NONCE
if ! printf '%s\n%s\n' "$NOW" "$ID" >"$TMP" || ! mv -f "$TMP" "$W/last-gate-start"; then
  log "chyba: last-gate-start nejde zapsat, tick nespuštěn"
  exit 1
fi
case $REASON in
  a) log "tick reason=a next_wake=$NW wake_late_by_s=$((NOW - NW)) claim=$GEN/$CN" ;;
  c) log "tick reason=c next_wake=$NW k=$K claim=$GEN/$CN" ;;
  *) log "tick reason=b claim=$GEN/$CN" ;;
esac
TARS_GATE_START=$NOW
export TARS_GATE_START
/bin/sh -c "$TARS_GATE_TICK"
rc=$?
# Konec ticku: identitu z last-gate-start odebrat (jen když tam je ještě naše), ať recyklovaný PID této brány
# později neblokuje další tick. Generaci nikdo jiný posunout nemohl: dokud brána žije, ostatní končí skipem.
if [ "$(first_line "$W/last-gate-start")" = "$NOW" ]; then
  {
    read -r _l1 || true
    read -r cur || true
  } <"$W/last-gate-start"
  if [ "$cur" = "$ID" ]; then
    printf '%s\n' "$NOW" >"$TMP" && mv -f "$TMP" "$W/last-gate-start"
  fi
fi
log "tick end rc=$rc"
exit 0
