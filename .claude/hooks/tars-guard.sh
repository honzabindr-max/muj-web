#!/usr/bin/env bash
# TARS-GUARD (SessionStart) — bezpečnostní invarianty jádra (DR-022).
# Ověřuje při každém startu session, že agent běží s omezenými právy:
#   I1 žádný klon v ~/Projects nemá SSH remote na GitHub (git jde přes omezený token, ne přes SSH klíč účtu)
#   I2 gh používá fine-grained token (github_pat_), ne OAuth/klasický token
#   I3 token nemá Administration (ochrana větve main vrací 403)
#   I4 ruleset na main je aktivní (deletion, non_fast_forward, pull_request, required_status_checks)
#   I5 SSH klíč na tomto stroji se ke GitHubu nepřihlásí
#   I6 na disku nejsou .env.migrate* starší než 12 h (ty smaže; podle write-migrate-env.sh žijí jen po dobu session)
# Jediná zápisová akce je smazání starých .env.migrate*. Obsah .env ani tokenů se nikdy nečte.
# Výstup: JSON hookSpecificOutput.additionalContext. Log bez tajemství: /tmp/tars-guard.log
# Hook vždy končí exit 0 (nikdy neblokuje start session); porušení hlásí jako ALARM do kontextu.

# Spouští se globálně (~/.claude/settings.json, session často startuje v domovské složce – DR-021),
# proto kontroluje pevně repo jádra TARS a všechny klony v ~/Projects, ne aktuální složku.
root="${TARS_GUARD_REPO:-$HOME/Projects/muj-web}"
projects="${TARS_GUARD_PROJECTS:-$HOME/Projects}"
cd "$root" 2>/dev/null || exit 0
alarm=(); warn=(); ok=()

# I1 žádný klon v ~/Projects nesmí mít SSH remote na GitHub
url=$(git -C "$root" remote get-url origin 2>/dev/null)
slug=$(printf '%s' "$url" | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')
sshclones=""
for d in "$projects"/*/; do
  u=$(git -C "$d" remote get-url origin 2>/dev/null) || continue
  case "$u" in git@github.com:*|ssh://git@github.com/*) sshclones="$sshclones $(basename "$d")" ;; esac
done
if [ -n "$sshclones" ]; then
  alarm+=("I1 klony se SSH remote (obchází omezený token):$sshclones")
else
  ok+=("I1 všechny klony HTTPS")
fi

if command -v gh >/dev/null 2>&1; then
  # I2 typ tokenu (gh auth status token maskuje)
  st=$(gh auth status --hostname github.com 2>&1)
  case "$st" in
    *"Token: github_pat_"*) ok+=("I2 fine-grained token") ;;
    *"Token: gho_"*|*"Token: ghp_"*|*"Token: ghu_"*) alarm+=("I2 gh používá OAuth/klasický token s plnými právy účtu") ;;
    *) warn+=("I2 přihlášení gh UNKNOWN") ;;
  esac
  if [ -n "$slug" ]; then
    # I3 Administration: s omezeným tokenem musí přijít 403
    pr=$(gh api "repos/$slug/branches/main/protection" 2>&1)
    case "$pr" in
      *"Resource not accessible by personal access token"*|*"HTTP 403"*) ok+=("I3 token bez Administration") ;;
      *"error connecting"*|*"dial tcp"*|*"no such host"*|*"timeout"*) warn+=("I3 offline – admin práva tokenu UNKNOWN") ;;
      *) alarm+=("I3 token MÁ Administration na $slug (ochrana main nevrátila 403) – může vypnout ruleset") ;;
    esac
    # I4 ruleset na main
    rules=$(gh api "repos/$slug/rules/branches/main" --jq '[.[].type]|join(",")' 2>/dev/null); rc=$?
    if [ $rc -ne 0 ]; then
      warn+=("I4 pravidla main UNKNOWN (offline nebo chyba API)")
    else
      missing=""
      for t in deletion non_fast_forward pull_request required_status_checks; do
        case ",$rules," in *",$t,"*) ;; *) missing="$missing $t" ;; esac
      done
      if [ -z "$missing" ]; then ok+=("I4 ruleset main aktivní"); else alarm+=("I4 na main chybí pravidla:$missing"); fi
    fi
  fi
else
  warn+=("I2–I4 gh není nainstalováno – UNKNOWN")
fi

# I5 SSH ke GitHubu musí selhat
s=$(ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1)
case "$s" in
  *"successfully authenticated"*) alarm+=("I5 SSH klíč na tomto stroji má přístup ke GitHubu (obchází token, umí měnit workflowy)") ;;
  *"Permission denied"*) ok+=("I5 SSH ke GitHubu zamítnuto") ;;
  *) warn+=("I5 SSH ke GitHubu UNKNOWN (offline?)") ;;
esac

# I6 staré .env.migrate* (jen názvy, obsah se nečte)
stale=$(find "$root" -maxdepth 1 -name '.env.migrate*' -type f -mmin +720 2>/dev/null)
if [ -n "$stale" ]; then
  names=$(printf '%s\n' "$stale" | xargs -n1 basename | tr '\n' ' ')
  find "$root" -maxdepth 1 -name '.env.migrate*' -type f -mmin +720 -delete 2>/dev/null
  warn+=("I6 smazány staré soubory s hesly migrátoru (>12 h): $names")
else
  ok+=("I6 žádné staré .env.migrate*")
fi
fresh=$(find "$root" -maxdepth 1 -name '.env.migrate*' -type f 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' ')
[ -n "$fresh" ] && warn+=("I6 na disku jsou čerstvé $fresh– po dokončení migrace je smaž")
known=""
for f in .env.local .env.verify; do [ -f "$root/$f" ] && known="$known $f"; done

# Výstup
{
  if [ ${#alarm[@]} -gt 0 ]; then
    echo "TARS-GUARD ALARM – porušeny bezpečnostní invarianty jádra (DR-022):"
    for a in "${alarm[@]}"; do echo "- $a"; done
    echo "POKYN: Než uděláš cokoli jiného, nahlas tento ALARM vlastníkovi. Do vyřešení nepracuj s main, secrets, workflowy, nasazením ani produkční DB."
  else
    printf 'TARS-GUARD OK (%s/6):' "${#ok[@]}"; for o in "${ok[@]}"; do printf ' %s;' "$o"; done; echo
  fi
  for w in "${warn[@]}"; do echo "TARS-GUARD upozornění: $w"; done
  [ -n "$known" ] && echo "TARS-GUARD známé riziko (audit c):$known jsou na disku a čitelné přes shell – obsah nečti."
} > /tmp/tars-guard.out.$$
status=$([ ${#alarm[@]} -gt 0 ] && echo ALARM || echo OK)
echo "$(date -Iseconds 2>/dev/null || date) $status root=$root alarm=${#alarm[@]} warn=${#warn[@]}" >> /tmp/tars-guard.log 2>/dev/null
python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":sys.stdin.read()}},ensure_ascii=False))' < /tmp/tars-guard.out.$$
rm -f /tmp/tars-guard.out.$$
exit 0
