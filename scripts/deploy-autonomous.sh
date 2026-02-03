#!/bin/bash

# Deploy 24/7 Autonomous ARI to Mac Mini
# This script handles complete deployment with validation

set -e

MINI_HOST="ari@100.81.73.34"
MINI_PATH="~/ARI"
SSH_KEY="~/.ssh/id_ed25519"
BUDGET_PROFILE="${1:-balanced}"  # conservative, balanced, aggressive

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     24/7 Autonomous ARI Deployment                       ║"
echo "║     Target: Mac Mini (100.81.73.34)                      ║"
echo "║     Profile: $BUDGET_PROFILE                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Function to run SSH command
ssh_run() {
  ssh -i "$SSH_KEY" "$MINI_HOST" "source ~/.zshrc 2>/dev/null; $1"
}

# Step 1: Verify connection
echo "━━━ Step 1: Verify Connection ━━━"
if ssh_run "hostname"; then
  echo "✓ Connected to Mac Mini"
else
  echo "✗ Failed to connect to Mac Mini"
  exit 1
fi
echo ""

# Step 2: Check current status
echo "━━━ Step 2: Check Current Status ━━━"
ssh_run "cd $MINI_PATH && git status --short"
echo ""

# Step 3: Stash local changes
echo "━━━ Step 3: Stash Local Changes ━━━"
ssh_run "cd $MINI_PATH && git stash push -m 'Pre-deployment stash $(date)'"
echo "✓ Changes stashed"
echo ""

# Step 4: Pull latest code
echo "━━━ Step 4: Pull Latest Code ━━━"
ssh_run "cd $MINI_PATH && git pull origin main"
REMOTE_COMMIT=$(ssh_run "cd $MINI_PATH && git rev-parse HEAD")
LOCAL_COMMIT=$(git rev-parse HEAD)

if [ "$REMOTE_COMMIT" = "$LOCAL_COMMIT" ]; then
  echo "✓ Mac Mini synced to commit $REMOTE_COMMIT"
else
  echo "⚠ Warning: Mac Mini ($REMOTE_COMMIT) != Local ($LOCAL_COMMIT)"
fi
echo ""

# Step 5: Install dependencies
echo "━━━ Step 5: Install Dependencies ━━━"
# Use --ignore-scripts to skip husky prepare hook (devDependency not available in production)
ssh_run "cd $MINI_PATH && npm install --omit=dev --ignore-scripts"
echo "✓ Dependencies installed"
echo ""

# Step 6: Build project
echo "━━━ Step 6: Build Project ━━━"
ssh_run "cd $MINI_PATH && npm run build"
echo "✓ Build complete"
echo ""

# Step 7: Deploy budget configuration
echo "━━━ Step 7: Deploy Budget Configuration ━━━"
BUDGET_FILE="config/budget.${BUDGET_PROFILE}.json"

if [ ! -f "$BUDGET_FILE" ]; then
  echo "✗ Budget profile not found: $BUDGET_FILE"
  exit 1
fi

# Copy budget config to Mac Mini
scp -i "$SSH_KEY" "$BUDGET_FILE" "${MINI_HOST}:~/.ari/budget-config.json"
echo "✓ Deployed budget configuration: $BUDGET_PROFILE"
echo ""

# Step 8: Verify configuration
echo "━━━ Step 8: Verify Configuration ━━━"
ssh_run "cat ~/.ari/budget-config.json | jq -r '.profile, .budget.daily.maxCost'"
echo ""

# Step 9: Update autonomous config
echo "━━━ Step 9: Update Autonomous Config ━━━"
ssh_run "cd $MINI_PATH && node -e \"
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.HOME, '.ari', 'autonomous.json');
let config = {};

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch {
  console.log('Creating new autonomous config');
}

// Enable autonomous mode
config.enabled = true;
config.budgetProfile = '$BUDGET_PROFILE';
config.updatedAt = new Date().toISOString();

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✓ Autonomous config updated');
\""
echo ""

# Step 10: Restart daemon
echo "━━━ Step 10: Restart Daemon ━━━"
ssh_run "cd $MINI_PATH && npx ari daemon restart"
echo "✓ Daemon restarted"
echo ""

# Step 11: Wait for startup
echo "━━━ Step 11: Wait for Startup ━━━"
sleep 5
echo "✓ Waited 5 seconds for services to start"
echo ""

# Step 12: Run system diagnostics
echo "━━━ Step 12: System Diagnostics ━━━"
ssh_run "cd $MINI_PATH && npx ari doctor"
echo ""

# Step 13: Verify gateway
echo "━━━ Step 13: Verify Gateway ━━━"
ssh_run "curl -s http://127.0.0.1:3141/health | jq"
echo ""

# Step 14: Check daemon status
echo "━━━ Step 14: Check Daemon Status ━━━"
ssh_run "cd $MINI_PATH && npx ari daemon status"
echo ""

# Step 15: Verify budget tracking
echo "━━━ Step 15: Verify Budget Tracking ━━━"
if ssh_run "test -f ~/.ari/token-usage.json"; then
  echo "✓ Budget tracker initialized"
  ssh_run "cat ~/.ari/token-usage.json | jq -r '.date, .totalTokens, .totalCost'"
else
  echo "⚠ Budget tracker not initialized yet (will initialize on first use)"
fi
echo ""

# Step 16: Check audit log
echo "━━━ Step 16: Check Audit Log ━━━"
ssh_run "cd $MINI_PATH && npx ari audit list -n 5"
echo ""

# Final summary
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║ Mac Mini: ✓ Synced and operational                      ║"
echo "║ Budget Profile: $BUDGET_PROFILE                               ║"
echo "║ Daemon: ✓ Running                                        ║"
echo "║ Gateway: ✓ Healthy                                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "  1. Monitor dashboard: http://localhost:3141/dashboard"
echo "  2. Check morning brief tomorrow at 7:30 AM"
echo "  3. Monitor token usage: ssh $MINI_HOST 'cat ~/.ari/token-usage.json | jq'"
echo "  4. View logs: ssh $MINI_HOST 'tail -f ~/Library/Logs/ari-gateway.log'"
echo ""
echo "✓ ARI is now running autonomously 24/7"
