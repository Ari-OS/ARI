#!/bin/bash

# Sync Mac Mini with latest ARI code
# Simple sync without full deployment

set -e

MINI_HOST="ari@100.81.73.34"
MINI_PATH="~/ARI"
SSH_KEY="~/.ssh/id_ed25519"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Sync Mac Mini with Latest Code                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Function to run SSH command
ssh_run() {
  ssh -i "$SSH_KEY" "$MINI_HOST" "source ~/.zshrc 2>/dev/null; $1"
}

# Check connection
echo "━━━ Checking Connection ━━━"
if ! ssh_run "hostname" > /dev/null 2>&1; then
  echo "✗ Cannot connect to Mac Mini"
  exit 1
fi
echo "✓ Connected"
echo ""

# Stash changes
echo "━━━ Stashing Local Changes ━━━"
ssh_run "cd $MINI_PATH && git stash push -m 'Sync stash $(date)'"
echo "✓ Changes stashed"
echo ""

# Pull latest
echo "━━━ Pulling Latest Code ━━━"
ssh_run "cd $MINI_PATH && git pull origin main"
echo "✓ Code updated"
echo ""

# Install dependencies
echo "━━━ Installing Dependencies ━━━"
ssh_run "cd $MINI_PATH && npm install"
echo "✓ Dependencies installed"
echo ""

# Build
echo "━━━ Building ━━━"
ssh_run "cd $MINI_PATH && npm run build"
echo "✓ Build complete"
echo ""

# Restart daemon
echo "━━━ Restarting Daemon ━━━"
ssh_run "cd $MINI_PATH && npx ari daemon restart"
echo "✓ Daemon restarted"
echo ""

# Verify
echo "━━━ Verification ━━━"
sleep 3
ssh_run "cd $MINI_PATH && npx ari daemon status"
echo ""

echo "✓ Sync complete!"
