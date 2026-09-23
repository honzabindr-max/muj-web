#!/usr/bin/env bash
# Store one secret in /etc/h2-inbox-watcher/env without echoing it.
#   interactive:  ssh -t hz /opt/h2-inbox-watcher/deploy/set-secret.sh TODOIST_API_TOKEN
#   piped:        some-command | ssh hz /opt/h2-inbox-watcher/deploy/set-secret.sh GOOGLE_REFRESH_TOKEN
set -euo pipefail
ENV_FILE=/etc/h2-inbox-watcher/env
ALLOWED="TODOIST_API_TOKEN ANTHROPIC_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN H2_TELEGRAM_BOT_TOKEN"
key="${1:-}"
if [[ " $ALLOWED " != *" $key "* ]]; then
  echo "usage: set-secret.sh <one of: $ALLOWED>" >&2
  exit 2
fi
if [ -t 0 ]; then
  read -rsp "$key (vlož a Enter, nic se nezobrazí): " val
  echo
else
  IFS= read -r val
fi
val="${val//$'\r'/}"
val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
if [ -z "$val" ]; then
  echo "prázdná hodnota — nic nezměněno" >&2
  exit 1
fi
umask 077
tmp="$(mktemp "$ENV_FILE.XXXXXX")"
grep -v "^$key=" "$ENV_FILE" > "$tmp" 2>/dev/null || true
printf '%s=%s\n' "$key" "$val" >> "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$ENV_FILE"
echo "$key uloženo (${#val} znaků). Nastavené klíče:"
grep -oE '^[A-Z0-9_]+=' "$ENV_FILE" | tr -d '='
