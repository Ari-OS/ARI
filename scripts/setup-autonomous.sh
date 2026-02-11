#!/bin/bash
# ARI Autonomous Agent Setup
#
# This script configures ARI for autonomous operation with:
# - Claude API integration
# - Telegram + Notion notifications (primary)
# - SMS emergency notifications
# - 24/7 monitoring
#
# Prerequisites:
# - Anthropic API key for Claude
# - Telegram Bot Token (from @BotFather)
# - Notion API key (optional)
#
# Security:
# - All credentials stored with 600 permissions
# - Credentials never logged or transmitted in notifications

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARI_ROOT="$(dirname "$SCRIPT_DIR")"
ARI_DIR="${HOME}/.ari"

echo "======================================================"
echo "         ARI AUTONOMOUS AGENT SETUP                    "
echo "======================================================"
echo ""

# Create .ari directory with secure permissions
mkdir -p "$ARI_DIR"
chmod 700 "$ARI_DIR"

# Check for Claude API key
echo ""
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "✓ Claude API key found in environment"
  CLAUDE_KEY="$ANTHROPIC_API_KEY"
else
  read -p "Enter Anthropic API Key (or press Enter to skip): " CLAUDE_KEY
fi

# Create autonomous config
echo ""
echo "Creating autonomous agent configuration..."

cat > "$ARI_DIR/autonomous.json" << EOF
{
  "enabled": true,
  "pollIntervalMs": 5000,
  "maxConcurrentTasks": 1,
  "claude": {
    "apiKey": "${CLAUDE_KEY:-}",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4096
  },
  "security": {
    "requireConfirmation": true,
    "allowedCommands": [],
    "blockedPatterns": ["rm -rf", "sudo", "password", "secret"]
  }
}
EOF
chmod 600 "$ARI_DIR/autonomous.json"
echo "✓ Autonomous config created"

# Create initial state
cat > "$ARI_DIR/agent-state.json" << EOF
{
  "running": false,
  "startedAt": null,
  "tasksProcessed": 0,
  "lastActivity": null,
  "errors": 0
}
EOF
chmod 600 "$ARI_DIR/agent-state.json"

# Create queue directory
mkdir -p "$ARI_DIR/queue"
echo "[]" > "$ARI_DIR/queue/tasks.json"
chmod 600 "$ARI_DIR/queue/tasks.json"

# Setup monitoring cron job
echo ""
echo "Setting up monitoring cron job..."
CRON_CMD="*/5 * * * * $ARI_ROOT/scripts/ari-monitor.sh >> $ARI_DIR/monitor.log 2>&1"

# Check if already installed
if crontab -l 2>/dev/null | grep -q "ari-monitor.sh"; then
  echo "✓ Monitor cron job already installed"
else
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "✓ Monitor cron job installed (runs every 5 minutes)"
fi

echo ""
echo "======================================================"
echo "                 SETUP COMPLETE                        "
echo "======================================================"
echo ""
echo "  Autonomous agent is configured!"
echo ""
echo "  To start:"
echo "    npx ari daemon install    (installs as service)"
echo "    npx ari gateway start     (starts gateway)"
echo ""
echo "  To test:"
echo "    npx ari autonomous test   (tests connections)"
echo ""
echo "  Notifications go through:"
echo "    - Telegram (primary)"
echo "    - Notion (records + async)"
echo "    - SMS (P0 emergency only)"
echo ""
if [ -z "$CLAUDE_KEY" ]; then
echo "  Warning: Claude API not configured - add key for full autonomy"
echo "    npx ari autonomous setup --claude-key YOUR_KEY"
echo ""
fi
