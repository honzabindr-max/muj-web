#!/usr/bin/env bash
# Statická QA pro produkční route Korfu 2026.
# Úmyslně skenuje výhradně app/korfu2026/, nikdy .korfu/ ani harness cesty.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TARGET="app/korfu2026"
FINDINGS=0

run_grep() {
  local label="$1"
  local pattern="$2"
  local results
  results=$(grep -rniE "$pattern" "$TARGET" 2>/dev/null || true)
  if [ -n "$results" ]; then
    echo "NÁLEZ [$label]: $pattern"
    echo "$results"
    FINDINGS=$((FINDINGS + 1))
  else
    echo "OK [$label]"
  fi
}

echo "=== korfu2026-check ==="
echo "Rozsah: $TARGET"

echo "--- Zákazy itineráře ---"
run_grep "den-cislo" "(den[[:space:]]+[0-9]+|[0-9]+\.[[:space:]]*den)"
run_grep "dny-tydne" "(ponděl[ií]|pondeli|úter[yý]|utery|střed[au]|streda|čtvrtek|ctvrtek|pátek|patek|sobota|neděl[ei]|nedele)[[:space:]]*:"
run_grep "itinerary-slova" "(doporučen[ýy][[:space:]]+týden|program[[:space:]]+na|rozvržen[íi][[:space:]]+do[[:space:]]+dn[íi])"
run_grep "dnes-sekce" "(^|[>[:space:]])Dnes([<:{[:space:]]|$)"

echo "--- Geografické a bezpečnostní zákazy ---"
run_grep "albanie-ksamil" "(alb[aá]ni[ea]|albania|ksamil)"
run_grep "kone-u-hotelu" "Silver Beach Hotel.*(je[[:space:]]+výchoz|začíná[[:space:]]+přímo|startuje)"
run_grep "paxos-bezlicencni" "Paxos.*(mal[ýy].*(bezlicenc|bez[[:space:]]+licence).*(vhodn|lze|můž|muze)|bezlicenc.*(Paxos).*(vhodn|lze|můž|muze))"

echo "--- Citlivé údaje ---"
# Veřejné kontakty provozovatelů ze SOURCE_PACKu jsou povolené; hledají se jen
# zakázané identifikátory, přístupové údaje a finanční údaje cestujících.
run_grep "smlouva-rezervace" "(číslo[[:space:]]+(smlouvy|rezervace)|variabiln[íi][[:space:]]+symbol|CS[0-9]{4,})"
run_grep "bankovni-udaje" "(IBAN|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})"
run_grep "privatni-klic" "BEGIN[[:space:]]+(RSA[[:space:]]+)?PRIVATE[[:space:]]+KEY|BEGIN[[:space:]]+OPENSSH"
run_grep "pristupovy-udaj" "(password|passwd|secret|api_?key|apikey|access_?token)[[:space:]]*[:=][[:space:]]*['\"][^'\"]{4,}"

echo "--- Must-see (13) ---"
MUST_SEE_IDS=(
  canal-damour porto-timoni paleokastritsa kassiopi-beach rovinia-beach
  agios-gordios issos-beach avlaki-beach marathias-beach nissaki-beach
  chalikounas-beach myrtiotissa-beach barbati-beach
)

for id in "${MUST_SEE_IDS[@]}"; do
  if grep -Fq -- "\"$id\"" "$TARGET/_data/places.ts"; then
    echo "OK [must-see]: $id"
  else
    echo "NÁLEZ [must-see-chybi]: $id"
    FINDINGS=$((FINDINGS + 1))
  fi
done

if [ "$FINDINGS" -gt 0 ]; then
  echo "Nálezy: $FINDINGS"
  exit 1
fi

echo "Bez nálezů."
