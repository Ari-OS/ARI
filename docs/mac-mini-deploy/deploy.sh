#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ARI Mac Mini Deployment Script
# Run from MacBook to deploy to Mac Mini
# ═══════════════════════════════════════════════════════════════

set -e

MAC_MINI="ari@100.81.73.34"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_CMD="ssh -o ConnectTimeout=10 -i $SSH_KEY $MAC_MINI"
REMOTE_DIR="/Users/ari/ARI"

echo "=== ARI Deployment Script ==="
echo ""

# Step 1: Check SSH connectivity
echo "[1/8] Checking SSH connection..."
$SSH_CMD "echo 'Connected to Mac Mini'" || {
    echo "ERROR: Cannot connect to Mac Mini. Is Tailscale running?"
    exit 1
}

# Step 2: Push latest code to GitHub first
echo "[2/8] Ensuring latest code is pushed..."
git status --short
echo "Make sure all changes are committed and pushed before continuing."
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi

# Step 3: Pull on Mac Mini
echo "[3/8] Pulling latest on Mac Mini..."
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR && git pull origin main"

# Step 4: Install dependencies
echo "[4/8] Installing dependencies..."
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR && NODE_ENV=development npm install --ignore-scripts"

# Step 5: Rebuild native modules
echo "[5/8] Rebuilding native modules..."
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR/node_modules/better-sqlite3 && npx node-gyp rebuild"

# Step 6: Build
echo "[6/8] Building TypeScript..."
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR && NODE_ENV=development npm run build"

# Step 7: Deploy workspace files
echo "[7/8] Deploying workspace files..."
$SSH_CMD "mkdir -p ~/.ari/workspace ~/.ari/conversations ~/.ari/data/analytics"
scp -i $SSH_KEY $HOME/.ari/workspace/*.md $MAC_MINI:~/.ari/workspace/

# Step 8: Restart daemon
echo "[8/8] Restarting daemon..."
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR && npx ari daemon stop 2>/dev/null; sleep 2; npx ari daemon start --production"

# Verify
echo ""
echo "=== Verifying Deployment ==="
sleep 3
$SSH_CMD "source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null; cd $REMOTE_DIR && npx ari daemon status"
echo ""
$SSH_CMD "curl -s http://127.0.0.1:3141/health" || echo "Health endpoint not responding yet (may need a moment)"

echo ""
echo "=== Deployment Complete ==="
echo "Next steps:"
echo "  1. Send /status to @ari_pryce_bot on Telegram"
echo "  2. Check logs: ssh $MAC_MINI 'tail -50 ~/.ari/logs/gateway-stdout.log'"
echo "  3. Wait for 6:30 AM for morning briefing"
