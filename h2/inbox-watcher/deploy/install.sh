#!/usr/bin/env bash
# Idempotent install on the VPS. Run as root from /opt/h2-inbox-watcher.
# Does NOT enable the timer — that is a separate, explicit step (see RUNBOOK.md).
set -euo pipefail
APP=/opt/h2-inbox-watcher
ETC=/etc/h2-inbox-watcher

id -u h2iw >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin h2iw

python3 -m venv "$APP/.venv"
"$APP/.venv/bin/pip" install -q --upgrade pip
"$APP/.venv/bin/pip" install -q -r "$APP/requirements.txt"
chown -R root:root "$APP"
chmod -R go-w "$APP"
chmod 755 "$APP/deploy/set-secret.sh" "$APP/deploy/install.sh"

install -d -m 700 -o root -g root "$ETC"
[ -f "$ETC/env" ] || install -m 600 -o root -g root /dev/null "$ETC/env"

install -m 644 "$APP/deploy/h2-inbox-watcher.service" /etc/systemd/system/
install -m 644 "$APP/deploy/h2-inbox-watcher.timer" /etc/systemd/system/
systemctl daemon-reload

echo "installed. env keys present:"
grep -oE '^[A-Z0-9_]+=' "$ETC/env" | tr -d '=' || echo "(none yet)"
