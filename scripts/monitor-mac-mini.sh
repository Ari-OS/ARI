#!/bin/bash

# Real-time monitoring of Mac Mini ARI instance
# Shows live budget usage, recent tasks, and system health

MINI_HOST="${MINI_HOST:-<USER>@<MAC_MINI_IP>}"
SSH_KEY="~/.ssh/id_ed25519"
REFRESH_INTERVAL="${1:-30}"  # Seconds between updates

# Function to run SSH command
ssh_run() {
  ssh -i "$SSH_KEY" "$MINI_HOST" "source ~/.zshrc 2>/dev/null; $1"
}

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear

while true; do
  clear
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║          ARI MAC MINI MONITORING (Live)                          ║"
  echo "║          Refreshing every ${REFRESH_INTERVAL}s                                 ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo ""
  
  # System Info
  echo "━━━ System Status ━━━"
  UPTIME=$(ssh_run "uptime | awk -F'up ' '{print \$2}' | awk -F',' '{print \$1}'")
  HOSTNAME=$(ssh_run "hostname")
  echo "Host: $HOSTNAME"
  echo "Uptime: $UPTIME"
  echo ""
  
  # Daemon Status
  echo "━━━ Daemon Status ━━━"
  DAEMON_STATUS=$(ssh_run "cd ~/ARI && npx ari daemon status 2>/dev/null | grep 'Running:' | awk '{print \$2}'")
  if [ "$DAEMON_STATUS" = "true" ]; then
    echo -e "${GREEN}✓ Daemon Running${NC}"
  else
    echo -e "${RED}✗ Daemon Stopped${NC}"
  fi
  echo ""
  
  # Gateway Health
  echo "━━━ Gateway Health ━━━"
  GATEWAY_HEALTH=$(ssh_run "curl -s http://127.0.0.1:3141/health 2>/dev/null | jq -r '.status'")
  if [ "$GATEWAY_HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✓ Gateway Healthy${NC}"
  else
    echo -e "${RED}✗ Gateway Unhealthy${NC}"
  fi
  echo ""
  
  # Budget Status
  echo "━━━ Token Budget Status ━━━"
  if ssh_run "test -f ~/.ari/token-usage.json"; then
    BUDGET_DATA=$(ssh_run "cat ~/.ari/token-usage.json 2>/dev/null | jq -r '.totalTokens, .totalCost'")
    TOKENS=$(echo "$BUDGET_DATA" | sed -n '1p')
    COST=$(echo "$BUDGET_DATA" | sed -n '2p')
    
    # Calculate percentage (assuming 800k daily budget)
    PERCENT=$(echo "scale=1; ($TOKENS / 800000) * 100" | bc)
    
    if (( $(echo "$PERCENT < 80" | bc -l) )); then
      COLOR=$GREEN
    elif (( $(echo "$PERCENT < 95" | bc -l) )); then
      COLOR=$YELLOW
    else
      COLOR=$RED
    fi
    
    echo -e "Tokens Used: ${COLOR}${TOKENS}${NC} / 800,000 (${PERCENT}%)"
    echo -e "Cost Today: ${COLOR}\$${COST}${NC} / \$2.50"
    
    # Top consumers
    echo ""
    echo "Top Consumers:"
    ssh_run "cat ~/.ari/token-usage.json 2>/dev/null | jq -r '.byTaskType | to_entries | sort_by(-.value.cost) | .[:3] | .[] | \"  • \" + .key + \": $\" + (.value.cost | tostring)'"
  else
    echo "Budget tracker not initialized yet"
  fi
  echo ""
  
  # Recent Tasks
  echo "━━━ Recent Autonomous Work (Last 5) ━━━"
  ssh_run "cd ~/ARI && npx ari audit list -n 5 2>/dev/null | tail -n 6"
  echo ""
  
  # Queue Status
  echo "━━━ Queue Status ━━━"
  if ssh_run "test -f ~/.ari/approval-queue.json"; then
    PENDING=$(ssh_run "cat ~/.ari/approval-queue.json 2>/dev/null | jq -r '.pending | length'")
    if [ "$PENDING" -gt 0 ]; then
      echo -e "${YELLOW}Approval Queue: $PENDING items pending${NC}"
    else
      echo -e "${GREEN}Approval Queue: Empty${NC}"
    fi
  else
    echo "Approval queue not initialized"
  fi
  echo ""
  
  # Error Check
  echo "━━━ Recent Errors ━━━"
  ERROR_COUNT=$(ssh_run "tail -100 ~/Library/Logs/ari-gateway.log 2>/dev/null | grep -i error | wc -l | tr -d ' '")
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $ERROR_COUNT errors in last 100 log lines${NC}"
  else
    echo -e "${GREEN}✓ No recent errors${NC}"
  fi
  echo ""
  
  # Footer
  echo "───────────────────────────────────────────────────────────"
  echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Press Ctrl+C to exit | Refresh interval: ${REFRESH_INTERVAL}s"
  
  # Wait before next refresh
  sleep "$REFRESH_INTERVAL"
done
