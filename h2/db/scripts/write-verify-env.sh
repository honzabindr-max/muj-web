#!/usr/bin/env bash
# Zapíše .env.verify s JEDNÍM connection stringem role h2_runtime (h2-runtime,
# production větev) — pro read-only ad hoc ověření (počty/stavy/časy, nikdy
# payload). Vstup skrytý (read -s), hodnota nikam nejde do chatu ani do logů
# — .env.verify je v .gitignore (.env* pattern).
#
# Spustit přímo v terminálu (ne přes Claude Code):
#   bash h2/db/scripts/write-verify-env.sh
set -euo pipefail

cd "$(dirname "$0")/../../.."

read_and_validate() {
  local prompt_label="$1"
  local value=""
  while true; do
    read -rsp "${prompt_label}: " value
    echo >&2
    if [[ "$value" != postgres://* && "$value" != postgresql://* ]]; then
      echo "Nevypadá to jako Postgres connection string (nezačíná postgres:// ani postgresql://). Zkus to znovu." >&2
      continue
    fi
    if [[ ${#value} -lt 40 ]]; then
      echo "Podezřele krátké (${#value} znaků) na Neon connection string. Zkus to znovu — vlož celý řetězec." >&2
      continue
    fi
    break
  done
  printf '%s' "$value"
}

echo "Vlož connection string role h2_runtime (h2-runtime, production větev)."
runtime_url="$(read_and_validate "H2_RUNTIME_DATABASE_URL")"

cat > .env.verify <<EOF
H2_RUNTIME_DATABASE_URL=${runtime_url}
EOF

chmod 600 .env.verify
echo ".env.verify zapsán (600, jen pro tebe čitelný). Hodnota nikam nešla do chatu ani do logů."

node -e '
process.loadEnvFile(".env.verify");
try {
  const u = new URL(process.env.H2_RUNTIME_DATABASE_URL);
  console.log("H2_RUNTIME_DATABASE_URL: hostname=" + u.hostname + " user=" + u.username);
} catch {
  console.log("H2_RUNTIME_DATABASE_URL: NEPODAŘILO SE NAPARSOVAT JAKO URL");
}
'
