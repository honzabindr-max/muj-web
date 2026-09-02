#!/usr/bin/env bash
# Zapíše .env.rolecheck se 4 runtime role connection stringy (stejné, jaké
# jsou ve Vercelu jako Secret). Vstup skrytý (read -s), hodnoty se nikam
# nevypisují a neprochází přes chat s modelem — .env.rolecheck je v
# .gitignore (.env* pattern).
#
# Spustit přímo v terminálu (ne přes Claude Code):
#   bash h2/db/scripts/write-rolecheck-env.sh
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

echo "Vlož connection string role h2_job (h2-runtime, production větev)."
job_url="$(read_and_validate "H2_JOB_DATABASE_URL")"

echo "Vlož connection string role h2_blind_reader (h2-runtime, production větev)."
blind_reader_url="$(read_and_validate "H2_BLIND_READER_DATABASE_URL")"

echo "Vlož connection string role h2_control (h2-control, production větev)."
control_url="$(read_and_validate "H2_CONTROL_DATABASE_URL")"

cat > .env.rolecheck <<EOF
H2_RUNTIME_DATABASE_URL=${runtime_url}
H2_JOB_DATABASE_URL=${job_url}
H2_BLIND_READER_DATABASE_URL=${blind_reader_url}
H2_CONTROL_DATABASE_URL=${control_url}
EOF

chmod 600 .env.rolecheck
echo ".env.rolecheck zapsán (600, jen pro tebe čitelný). Hodnoty nikam nešly do chatu ani do logů."

node -e '
process.loadEnvFile(".env.rolecheck");
for (const key of ["H2_RUNTIME_DATABASE_URL", "H2_JOB_DATABASE_URL", "H2_BLIND_READER_DATABASE_URL", "H2_CONTROL_DATABASE_URL"]) {
  try {
    const u = new URL(process.env[key]);
    console.log(key + ": hostname=" + u.hostname);
  } catch {
    console.log(key + ": NEPODAŘILO SE NAPARSOVAT JAKO URL");
  }
}
'
