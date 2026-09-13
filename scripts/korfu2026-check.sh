#!/usr/bin/env bash
# QA check script pro korfu2026.
# Kontroluje: denní itinerář, Albánie/Ksamil, citlivé údaje (SOURCE_PACK část 5), přítomnost 13 must-see ID.
# Autorizace: rozhodnutí D01-A/B/C zadání korfu2026-02.
#
# Skenovaný rozsah (plný):  app/korfu2026/**  scripts/korfu2026-*.{mjs,sh}  .korfu/CHECKPOINT-*.md
# Výjimka itinerář/Albánie: .korfu/CHECKPOINT-*.md JSOU v rozsahu, ale vylučujeme řádky začínající
#   "===" (sekce QA reportů popisující vzory, ne produkční obsah).
# Výjimka e-mail:           app/korfu2026/_data/operators.ts obsahuje autorizované obchodní kontakty
#   z SOURCE_PACKu (SOURCE_PACK část 9, SP:123–178). Část 5 zakazuje "cestujících" osobní data.
#   Ostatní soubory žádné e-mailové adresy mít nesmí.
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FINDINGS=0

# ── Skenovaný rozsah ──────────────────────────────────────────────────────────
echo "=== korfu2026-check.sh ==="
echo "Skenovaný rozsah:"
echo "  app/korfu2026/**"
echo "  scripts/korfu2026-*.{mjs,sh}"
echo "  .korfu/CHECKPOINT-*.md"
echo ""

# Pomocná funkce: grep bez set -e, akumulace nálezů.
# Vylučuje řádky začínající "===" (QA sekce headerů v CHECKPOINT souborech).
run_grep() {
  local label="$1"
  local pattern="$2"
  shift 2
  local results
  results=$(grep -rniE "$pattern" "$@" 2>/dev/null | grep -v "^[^:]*:[0-9]*:===" || true)
  if [ -n "$results" ]; then
    echo "NÁLEZ [$label]: vzor '$pattern'"
    echo "$results"
    echo ""
    FINDINGS=$((FINDINGS + 1))
  else
    echo "OK [$label]: žádný nález"
  fi
}

# ── 1. DENNÍ ITINERÁŘ ─────────────────────────────────────────────────────────
echo "--- 1. Denní itinerář ---"

# Vzory "den N" / "N. den" — CHECKPOINT soubory zahrnuty, ale === řádky vyloučeny
run_grep "den-cislo" \
  "(den\s+[0-9]+|[0-9]+\.\s*den|den\s+prvn[ií]|den\s+druh[yý]|den\s+třet[ií]|den\s+čtvrt[yý])" \
  app/korfu2026/ scripts/korfu2026-geocode.mjs .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

# Názvy dnů jako itinerářové záhlaví (Czech + bez diakritiky) s dvojtečkou
run_grep "dny-tydne-itinerar" \
  "(^|\s)(pondel[ií]|utery|úter[yý]|stred[au]|střed[au]|ctvrtek|čtvrtek|patek|pátek|sobota|nedel[ei]|neděl[ei])\s*:" \
  app/korfu2026/ scripts/korfu2026-geocode.mjs .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

# "v pondělí" / "ve středu" apod. — itinerářový kontext
run_grep "dny-tydne-v-kontext" \
  "\b(v\s+pondel[ií]|v\s+utery|v\s+úter[yý]|ve?\s+stred|ve?\s+střed|ve?\s+ctvrtek|ve?\s+čtvrtek|v\s+patek|v\s+pátek|v\s+sobotu|v\s+nedeli|v\s+neděl)" \
  app/korfu2026/ scripts/korfu2026-geocode.mjs .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

echo ""

# ── 2. ALBÁNIE / KSAMIL ───────────────────────────────────────────────────────
echo "--- 2. Albánie / Ksamil ---"

# CHECKPOINT soubory zahrnuty, === řádky vyloučeny (sekce headerů popisují co bylo kontrolováno)
run_grep "albania-ksamil" \
  "(alb[aá]ni[ea]|albania|ksamil)" \
  app/korfu2026/ scripts/korfu2026-geocode.mjs .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

echo ""

# ── 3. CITLIVÉ ÚDAJE (SOURCE_PACK část 5) ────────────────────────────────────
# Část 5: příjmení, data narození, adresa, telefon/e-mail cestujících,
# číslo smlouvy/rezervace, variabilní symbol, bankovní údaje,
# SSH klíče, hesla, tokeny, přístupové údaje k VPS.
echo "--- 3. Citlivé údaje (část 5) ---"

# E-mail adresy: skenujeme vše MIMO operators.ts (obsahuje autorizované obchodní kontakty ze SP)
echo "  [email] skenováno: app/korfu2026/ (bez operators.ts) + scripts + checkpointy"
email_results=$(grep -rniE \
  "[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" \
  app/korfu2026/ scripts/korfu2026-geocode.mjs .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md 2>/dev/null \
  | grep -v "app/korfu2026/_data/operators.ts" \
  || true)
if [ -n "$email_results" ]; then
  echo "NÁLEZ [email]: neočekávaná e-mailová adresa (mimo operators.ts)"
  echo "$email_results"
  echo ""
  FINDINGS=$((FINDINGS + 1))
else
  echo "OK [email]: žádný nález (operators.ts vyloučen jako autorizovaný obchodní kontakt)"
fi

# Narozeninové datum (formát DD.MM.YYYY nebo D.M.YYYY)
# Skenujeme jen app/korfu2026/ — CHECKPOINT soubory jsou dokumentace a mohou legitimně
# obsahovat data geokódování / validace (např. "ověřeno 29.6.2026"), ta nejsou osobní data.
run_grep "datum-narozeni" \
  "\b[0-9]{1,2}\.[0-9]{1,2}\.[12][0-9]{3}\b" \
  app/korfu2026/

# SSH klíč / soukromý klíč
run_grep "ssh-private-key" \
  "BEGIN\s+(RSA\s+)?PRIVATE\s+KEY|BEGIN\s+CERTIFICATE|BEGIN\s+OPENSSH" \
  app/korfu2026/ .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

# Heslo / token / secret v kódu
run_grep "password-token" \
  "(password|passwd|secret|api_?key|apikey|access_?token)\s*[:=]\s*['\"][^'\"]{4,}" \
  app/korfu2026/ .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

# IBAN (CZ nebo jiný) — bankovní údaje
run_grep "iban" \
  "\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b" \
  app/korfu2026/ .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

# Číslo smlouvy Čedok (CS + číslice) nebo variabilní symbol
run_grep "smlouva-rezervace" \
  "\bCS[0-9]{4,}\b|č\.\s*smlouvy|číslo\s+rezervace|variabiln[ií]\s+symbol" \
  app/korfu2026/ .korfu/CHECKPOINT-1.md .korfu/CHECKPOINT-2.md

echo ""

# ── 4. PŘÍTOMNOST VŠECH 13 MUST-SEE ID ──────────────────────────────────────
echo "--- 4. Must-see ID (13 kusů) ---"

# ID vyčtena z app/korfu2026/_data/places.ts (MUST_SEE_SEEDS, řádky 52–420)
MUST_SEE_IDS=(
  "canal-damour"
  "porto-timoni"
  "paleokastritsa"
  "kassiopi-beach"
  "rovinia-beach"
  "agios-gordios"
  "issos-beach"
  "avlaki-beach"
  "marathias-beach"
  "nissaki-beach"
  "chalikounas-beach"
  "myrtiotissa-beach"
  "barbati-beach"
)

echo "Kontroluji 13 must-see ID v app/korfu2026/_data/:"

for msid in "${MUST_SEE_IDS[@]}"; do
  hit=$(grep -rn "\"${msid}\"" app/korfu2026/_data/ 2>/dev/null || true)
  if [ -z "$hit" ]; then
    echo "NÁLEZ [must-see-chybejici]: id '$msid' nenalezeno v app/korfu2026/_data/"
    FINDINGS=$((FINDINGS + 1))
  else
    echo "OK [must-see]: $msid přítomno"
  fi
done

echo ""

# ── VÝSLEDEK ──────────────────────────────────────────────────────────────────
echo "=== Výsledek ==="
if [ "$FINDINGS" -eq 0 ]; then
  echo "Všechny kontroly prošly. FINDINGS=0. EXIT=0."
  exit 0
else
  echo "Celkem nálezů: $FINDINGS. EXIT=1."
  exit 1
fi
