#!/usr/bin/env bash
# Zapíše .env.migrate s migrátorskými connection stringy pro h2-runtime a
# h2-control. Vstup je skrytý (read -s), hodnoty se nikam nevypisují a
# neprochází přes Claude Code chat — .env.migrate je v .gitignore (.env*).
#
# Spustit přímo v terminálu (ne přes Claude Code): bash h2/db/scripts/write-migrate-env.sh
set -euo pipefail

cd "$(dirname "$0")/../../.."

echo "Vlož connection string h2_migrator role (Neon projekt h2-runtime, výchozí/main větev)."
read -rsp "H2_RUNTIME_MIGRATOR_DATABASE_URL: " runtime_url
echo

echo "Vlož connection string h2_control_migrator role (Neon projekt h2-control)."
read -rsp "H2_CONTROL_MIGRATOR_DATABASE_URL: " control_url
echo

cat > .env.migrate <<EOF
H2_RUNTIME_MIGRATOR_DATABASE_URL=${runtime_url}
H2_CONTROL_MIGRATOR_DATABASE_URL=${control_url}
EOF

chmod 600 .env.migrate
echo ".env.migrate zapsán (600, jen pro tebe čitelný). Hodnoty nikam nešly do chatu ani do logů."
