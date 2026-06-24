#!/usr/bin/env bash
#
# deploy_supervisor.sh — Fáze 1: rsync + systemctl daemon-reload + enable --now
#
# Invarianty:
#   - Žádný ansible-playbook
#   - Deploy: rsync + systemctl daemon-reload + enable --now timer
#   - DB migrace přes psql (idempotentní IF NOT EXISTS)
#   - Supervisor spouštíme s SUPERVISOR_DRY_RUN=1 (Fáze 1)
#
# Použití (přesný copy-paste):
#   ./scripts/deploy_supervisor.sh
#
# Override:
#   GATE_HOST=root@100.81.223.20 SSH_KEY=~/.ssh/gi_gate_ed25519 ./scripts/deploy_supervisor.sh
#
set -euo pipefail

GATE_HOST="${GATE_HOST:-root@100.81.223.20}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/gi_gate_ed25519}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/opt/suggest-crawler"
SYSTEMD_DIR="/etc/systemd/system"

echo "=== [1/5] rsync: runtime/crawler_supervisor.py ==="
rsync -av --mkpath \
  -e "ssh -i $SSH_KEY -o ConnectTimeout=10" \
  "$REPO_ROOT/runtime/crawler_supervisor.py" \
  "$GATE_HOST:$REMOTE_DIR/runtime/"

echo "=== [2/5] rsync: migrations/0005_supervisor_audit.sql ==="
rsync -av \
  -e "ssh -i $SSH_KEY -o ConnectTimeout=10" \
  "$REPO_ROOT/migrations/0005_supervisor_audit.sql" \
  "$GATE_HOST:$REMOTE_DIR/migrations/"

echo "=== [3/5] rsync: systemd units ==="
rsync -av \
  -e "ssh -i $SSH_KEY -o ConnectTimeout=10" \
  "$REPO_ROOT/infra/systemd/suggest-crawler-supervisor.service" \
  "$REPO_ROOT/infra/systemd/suggest-crawler-supervisor.timer" \
  "$GATE_HOST:$SYSTEMD_DIR/"

echo "=== [4/5] DB migrace (psql, idempotentní) ==="
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$GATE_HOST" bash <<'REMOTE'
set -euo pipefail
# DSN čteme z env-file (nikdy z CLI argumentů)
source /etc/suggest-proxy/suggest-proxy.env
psql "${SUPERVISOR_DB_DSN:?SUPERVISOR_DB_DSN není nastaven}" \
  -f /opt/suggest-crawler/migrations/0005_supervisor_audit.sql
echo "migrace OK"
REMOTE

echo "=== [5/5] systemctl: daemon-reload + enable --now timer ==="
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$GATE_HOST" bash <<'REMOTE'
set -euo pipefail
systemctl daemon-reload
systemctl enable --now suggest-crawler-supervisor.timer
echo "timer status:"
systemctl status suggest-crawler-supervisor.timer --no-pager -n 3
echo "první tick (sync):"
systemctl start suggest-crawler-supervisor.service
echo "supervisor první tick OK"
REMOTE

echo ""
echo "=== DEPLOY HOTOV ==="
echo "Ověření na serveru:"
echo "  journalctl -u suggest-crawler-supervisor.service -n 20 --no-pager"
echo "  systemctl list-timers suggest-crawler-supervisor.timer --no-pager"
