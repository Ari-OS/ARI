#!/usr/bin/env bash
# ARI Mac Mini Deploy Script
# Run from your MacBook after Mac Mini is back online:
#   bash scripts/deploy-mac-mini.sh
#
# What it does:
#   1. Verifies Mac Mini is reachable
#   2. SSHs in, pulls latest code, builds
#   3. Sets up Telegram env vars (if not already set)
#   4. Restarts the ARI daemon
#   5. Verifies health

set -euo pipefail

MAC_MINI="ari@100.81.73.34"
SSH_KEY="$HOME/.ssh/id_ed25519"
ARI_DIR="~/ARI"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# ─── Step 1: Check connectivity ──────────────────────────────────────
info "Checking Mac Mini connectivity..."
if ! ping -c 1 -W 3 100.81.73.34 >/dev/null 2>&1; then
  fail "Mac Mini is not reachable. Check that it's powered on and Tailscale is running."
fi
info "Mac Mini is online!"

# ─── Step 2: Verify SSH ──────────────────────────────────────────────
info "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -i "$SSH_KEY" "$MAC_MINI" "echo ok" >/dev/null 2>&1; then
  fail "SSH connection failed. Check your SSH key and that sshd is running on Mac Mini."
fi
info "SSH connection verified."

# ─── Step 3: Pull latest code and build ──────────────────────────────
info "Pulling latest code and building..."
ssh -i "$SSH_KEY" "$MAC_MINI" bash -s <<'REMOTE'
set -euo pipefail
cd ~/ARI

echo "[remote] Git pull..."
git pull --ff-only

echo "[remote] Installing dependencies..."
npm install --no-audit --no-fund

echo "[remote] Building..."
npm run build

echo "[remote] Running tests..."
npm test -- --reporter=dot 2>&1 | tail -5

echo "[remote] Build complete."
REMOTE
info "Code updated and built successfully."

# ─── Step 4: Check Telegram env vars ─────────────────────────────────
info "Checking Telegram configuration..."
TELEGRAM_CONFIGURED=$(ssh -i "$SSH_KEY" "$MAC_MINI" bash -c '
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_OWNER_USER_ID:-}" ]]; then
    echo "yes"
  else
    echo "no"
  fi
')

if [ "$TELEGRAM_CONFIGURED" = "no" ]; then
  warn "Telegram env vars not set on Mac Mini!"
  echo ""
  echo "  SSH into the Mac Mini and add these to ~/.zshrc or ~/.bashrc:"
  echo ""
  echo "    export TELEGRAM_BOT_TOKEN=\"your-bot-token-from-botfather\""
  echo "    export TELEGRAM_OWNER_USER_ID=\"your-numeric-user-id\""
  echo ""
  echo "  Then run: source ~/.zshrc && npx ari daemon restart"
  echo ""
else
  info "Telegram env vars are configured."
fi

# ─── Step 5: Restart daemon ──────────────────────────────────────────
info "Restarting ARI daemon..."
ssh -i "$SSH_KEY" "$MAC_MINI" bash -s <<'REMOTE'
set -euo pipefail
cd ~/ARI

# Check if daemon is installed
if launchctl list 2>/dev/null | grep -q "com.ari.daemon"; then
  echo "[remote] Stopping existing daemon..."
  npx ari daemon stop 2>/dev/null || true
  sleep 2
fi

echo "[remote] Starting daemon..."
npx ari daemon start

echo "[remote] Daemon started."
REMOTE
info "Daemon restarted."

# ─── Step 6: Verify health ──────────────────────────────────────────
info "Waiting 5 seconds for startup..."
sleep 5

info "Checking health..."
ssh -i "$SSH_KEY" "$MAC_MINI" bash -s <<'REMOTE'
set -euo pipefail
cd ~/ARI

# Check if daemon process is running
if pgrep -f "ari.*daemon" >/dev/null 2>&1; then
  echo "  Daemon: RUNNING"
else
  echo "  Daemon: NOT RUNNING (check logs)"
fi

# Check gateway
if curl -sf http://127.0.0.1:3141/health >/dev/null 2>&1; then
  echo "  Gateway: HEALTHY"
else
  echo "  Gateway: NOT RESPONDING (may still be starting)"
fi

# Show recent logs
echo ""
echo "  Recent logs:"
tail -5 ~/.ari/logs/ari.log 2>/dev/null || echo "  (no logs yet)"
REMOTE

echo ""
info "Deploy complete! Mac Mini is updated and running."
echo ""
echo "  Monitor: ssh $MAC_MINI 'tail -f ~/.ari/logs/ari.log'"
echo "  Status:  ssh $MAC_MINI 'cd ~/ARI && npx ari status'"
echo ""
