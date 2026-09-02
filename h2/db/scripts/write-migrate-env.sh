#!/usr/bin/env bash
# Zapíše .env.migrate s migrátorskými connection stringy pro h2-runtime a
# h2-control. Vstup je skrytý (read -s), hodnoty se nikam nevypisují a
# neprochází přes Claude Code chat — .env.migrate je v .gitignore (.env*).
#
# Spustit přímo v terminálu (ne přes Claude Code, ideálně v ČERSTVÉM
# terminálovém okně/tabu, aby v bufferu nezůstalo nic z předchozích příkazů):
#   bash h2/db/scripts/write-migrate-env.sh
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

echo "Vlož connection string h2_migrator role (Neon projekt h2-runtime, výchozí/main větev)."
runtime_url="$(read_and_validate "H2_RUNTIME_MIGRATOR_DATABASE_URL")"

echo "Vlož connection string h2_control_migrator role (Neon projekt h2-control, výchozí/main větev)."
control_url="$(read_and_validate "H2_CONTROL_MIGRATOR_DATABASE_URL")"

cat > .env.migrate <<EOF
H2_RUNTIME_MIGRATOR_DATABASE_URL=${runtime_url}
H2_CONTROL_MIGRATOR_DATABASE_URL=${control_url}
EOF

chmod 600 .env.migrate
echo ".env.migrate zapsán (600, jen pro tebe čitelný). Hodnoty nikam nešly do chatu ani do logů."

# Bezpečné potvrzení: jen hostname z URL (nikdy credential), aby šlo hned
# poznat, jestli se nevložil špatný projekt.
node -e '
process.loadEnvFile(".env.migrate");
for (const key of ["H2_RUNTIME_MIGRATOR_DATABASE_URL", "H2_CONTROL_MIGRATOR_DATABASE_URL"]) {
  try {
    const u = new URL(process.env[key]);
    console.log(key + ": hostname=" + u.hostname);
  } catch {
    console.log(key + ": NEPODAŘILO SE NAPARSOVAT JAKO URL");
  }
}
'
