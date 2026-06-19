#!/usr/bin/env bash
#
# suggest_proxy_diagnostics.sh
# ----------------------------
# Diagnostika suggest-proxy origin serveru (Hetzner) — primárně pro hon na
# Cloudflare 522 (= origin unreachable). Čte stav read-only, NIC nemění.
#
# Co kontroluje (v tomhle pořadí):
#   1. SYSTEM      — uptime, pending reboot
#   2. SERVICES    — postgresql / pgbouncer / suggest-proxy active?
#   3. PROXY ORIGIN — /verify lokálně (127.0.0.1:8080), tj. mimo Cloudflare
#   4. CF EDGE     — /verify přes suggest.good-inventions.work (zdroj 522)
#   5. RUNNER      — suggest-crawler-runner timer/service + příští spuštění
#   6. GEO-MISMATCH — expected vs actual exit country za posledních 6 h
#   7. GROWTH      — jede vůbec write path? (max created_at + count za 12 h)
#   8. RUNNER LOG  — posledních 30 řádků journalu
#
# Použití (exact copy-paste):
#   ./scripts/suggest_proxy_diagnostics.sh
#
# Override (env, mají defaulty):
#   GATE_HOST=root@100.81.223.20 \
#   SSH_KEY=~/.ssh/gi_gate_ed25519 \
#   EDGE_URL=https://suggest.good-inventions.work \
#   ./scripts/suggest_proxy_diagnostics.sh
#
# Pozn.: token se NIKDY neposílá z lokálu — čte se až na serveru z
#        /etc/suggest-proxy/suggest-proxy.env a používá jen pro 127.0.0.1.
#        Exit IP / session ID se neloguje (pravidlo CLAUDE.md).
#
set -euo pipefail

GATE_HOST="${GATE_HOST:-root@100.81.223.20}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/gi_gate_ed25519}"
EDGE_URL="${EDGE_URL:-https://suggest.good-inventions.work}"

ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$GATE_HOST" "EDGE_URL='$EDGE_URL' bash -s" <<'EOF'
echo "=== SYSTEM ==="
uptime
echo "--- restart required? ---"
ls /var/run/reboot-required 2>/dev/null && echo "REBOOT PENDING" || echo "no reboot flag"
echo
echo "=== SERVICES ==="
systemctl is-active postgresql@17-main pgbouncer suggest-proxy 2>/dev/null
systemctl status suggest-proxy --no-pager -n 5 2>/dev/null | tail -8
echo
echo "=== PROXY ORIGIN (lokálně, mimo Cloudflare) ==="
curl -s -o /dev/null -w "local /verify HTTP %{http_code} (%{time_total}s)\n" \
  -H "Authorization: Bearer $(grep -m1 -oP 'SUGGEST_PROXY_TOKEN=\K.*' /etc/suggest-proxy/suggest-proxy.env)" \
  http://127.0.0.1:8080/verify/queue-status 2>/dev/null || echo "local curl FAIL"
echo
echo "=== CLOUDFLARE EDGE (522 source) ==="
curl -s -o /dev/null -w "edge /verify HTTP %{http_code} (%{time_total}s)\n" \
  "${EDGE_URL}/verify/queue-status" 2>/dev/null || echo "edge curl FAIL"
echo
echo "=== CRAWLER RUNNER ==="
systemctl is-active suggest-crawler-runner.timer suggest-crawler-runner.service 2>/dev/null
systemctl list-timers suggest-crawler-runner.timer --no-pager 2>/dev/null | head -3
echo
echo "=== GEO-MISMATCH (posledních 6h) ==="
sudo -u suggest psql -d suggest_db -tA -c "
SELECT gl,hl,expected_geo_country,actual_geo_country,status,updated_at
FROM runtime.crawler_market_queue
WHERE actual_geo_country IS NOT NULL
  AND expected_geo_country IS DISTINCT FROM actual_geo_country
  AND updated_at > now() - interval '6 hours'
ORDER BY updated_at DESC LIMIT 20;"
echo
echo "=== GROWTH (jede vůbec write path?) ==="
sudo -u suggest psql -d suggest_db -tA -c "
SELECT max(created_at) AS newest, count(*) FILTER (WHERE created_at > now() - interval '12 hours') AS last_12h
FROM google_suggestions_v2;"
echo
echo "=== POSLEDNÍ RUNNER LOG ==="
journalctl -u suggest-crawler-runner.service --no-pager -n 30 2>/dev/null | tail -30
EOF
