#!/usr/bin/env bash
# Zapíše .env.migrate.preview a .env.migrate.production s migrátorskými
# connection stringy pro h2-runtime (preview i production větev zvlášť)
# a h2-control (jeden connection string, zapsaný do obou souborů — h2-control
# nemá dnes v repu doloženou preview/production distinkci, na rozdíl od
# h2-runtime). Vstup je skrytý (read -s), hodnoty se nikam nevypisují a
# neprochází přes Claude Code chat — oba soubory jsou v .gitignore (.env*).
#
# Role: connection stringy dnes reálně nesou roli neondb_owner, ne
# h2_migrator (DEC-006, docs/h2/DECISIONS.md) — h2_migrator existuje ve
# schématu, ale nikdy mu nebylo nastaveno heslo. Vědomá odchylka, funkčně
# bezpečná, remedy odložen do M1 deploy gate.
#
# Spustit přímo v terminálu (ne přes Claude Code, ideálně v ČERSTVÉM
# terminálovém okně/tabu, aby v bufferu nezůstalo nic z předchozích příkazů):
#   bash h2/db/scripts/write-migrate-env.sh
#
# Hesla se vkládají JEDNOU za session (dokud .env.migrate.* nezmizí z disku)
# — migrate-neon-runtime.ts/migrate-neon-control.ts pak přepínají mezi
# preview/production přes CLI argument, ne přepisováním jednoho souboru
# (viz docs/h2/BUILD-STATUS.md, "Migrační env workflow").
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

echo "Vlož connection string pro roli neondb_owner (Neon projekt h2-runtime, PREVIEW větev)."
runtime_preview_url="$(read_and_validate "H2_RUNTIME_MIGRATOR_DATABASE_URL (preview)")"

echo "Vlož connection string pro roli neondb_owner (Neon projekt h2-runtime, PRODUCTION větev)."
runtime_production_url="$(read_and_validate "H2_RUNTIME_MIGRATOR_DATABASE_URL (production)")"

echo "Vlož connection string pro roli neondb_owner (Neon projekt h2-control, výchozí/main větev)."
control_url="$(read_and_validate "H2_CONTROL_MIGRATOR_DATABASE_URL")"

cat > .env.migrate.preview <<EOF
H2_RUNTIME_MIGRATOR_DATABASE_URL=${runtime_preview_url}
H2_CONTROL_MIGRATOR_DATABASE_URL=${control_url}
EOF

cat > .env.migrate.production <<EOF
H2_RUNTIME_MIGRATOR_DATABASE_URL=${runtime_production_url}
H2_CONTROL_MIGRATOR_DATABASE_URL=${control_url}
EOF

chmod 600 .env.migrate.preview .env.migrate.production
echo ".env.migrate.preview a .env.migrate.production zapsány (600, jen pro tebe čitelné). Hodnoty nikam nešly do chatu ani do logů."

# Bezpečné potvrzení: jen hostname z URL (nikdy credential), aby šlo hned
# poznat, jestli se nevložil špatný projekt/větev. Samostatný `node -e` na
# každý soubor — process.loadEnvFile() NEPŘEPISUJE proměnnou, která už je
# v process.env nastavená, takže sdílený proces mezi oběma soubory by u
# druhého souboru tiše vypsal hostname z toho prvního (ověřeno, viz
# git historie tohohle skriptu).
for env_file in .env.migrate.preview .env.migrate.production; do
  node -e '
  process.loadEnvFile(process.argv[1]);
  console.log(process.argv[1] + ":");
  for (const key of ["H2_RUNTIME_MIGRATOR_DATABASE_URL", "H2_CONTROL_MIGRATOR_DATABASE_URL"]) {
    try {
      const u = new URL(process.env[key]);
      console.log("  " + key + ": hostname=" + u.hostname);
    } catch {
      console.log("  " + key + ": NEPODAŘILO SE NAPARSOVAT JAKO URL");
    }
  }
  ' "$env_file"
done
