#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Comprehensive deployment validation for ARI 24/7 autonomous system
# Validates all components after deployment to Mac Mini
# ═══════════════════════════════════════════════════════════════════════════

# Note: set -e removed to allow warnings without immediate exit

MINI_HOST="${MINI_HOST:-<USER>@<MAC_MINI_IP>}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_ed25519}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          ARI Deployment Validation                       ║"
echo "║          Target: $MINI_HOST                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

check() {
  local name="$1"
  local cmd="$2"

  if eval "$cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗${NC} $name"
    ((FAIL++))
    return 1
  fi
}

ssh_check() {
  local name="$1"
  local cmd="$2"

  if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes "$MINI_HOST" "source ~/.zshrc 2>/dev/null; $cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗${NC} $name"
    ((FAIL++))
    return 1
  fi
}

ssh_warn() {
  local name="$1"
  local cmd="$2"

  if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes "$MINI_HOST" "source ~/.zshrc 2>/dev/null; $cmd" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name"
    ((PASS++))
    return 0
  else
    echo -e "${YELLOW}⚠${NC} $name (non-critical)"
    ((WARN++))
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Validation Checks
# ─────────────────────────────────────────────────────────────────────────────

echo "━━━ Connectivity ━━━"
check "SSH connection" "ssh -i $SSH_KEY -o ConnectTimeout=5 -o BatchMode=yes $MINI_HOST 'echo ok'"
echo ""

echo "━━━ Core Services ━━━"
ssh_check "Node.js available" "node --version"
ssh_check "ARI directory exists" "test -d ~/ARI"
ssh_check "Dependencies installed" "test -d ~/ARI/node_modules"
ssh_check "Build complete" "test -d ~/ARI/dist"
echo ""

echo "━━━ Daemon Status ━━━"
ssh_check "Daemon running" "cd ~/ARI && npx ari daemon status 2>&1 | grep -q 'Running: true'"
ssh_warn "Daemon plist installed" "test -f ~/Library/LaunchAgents/com.ari.gateway.plist"
echo ""

echo "━━━ Gateway Health ━━━"
ssh_check "Gateway responding" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3141/health | grep -q '200'"
ssh_check "Gateway healthy status" "curl -s http://127.0.0.1:3141/health | grep -q 'healthy'"
echo ""

echo "━━━ Budget System ━━━"
ssh_check "Budget config exists" "test -f ~/.ari/budget-config.json"
ssh_warn "Token usage file exists" "test -f ~/.ari/token-usage.json"
ssh_check "Budget API responds" "curl -s http://127.0.0.1:3141/api/budget/status | grep -q 'profile'"
echo ""

echo "━━━ Budget Profile ━━━"
PROFILE=$(ssh -i "$SSH_KEY" "$MINI_HOST" "cat ~/.ari/budget-config.json 2>/dev/null | grep -o '\"profile\":[^,]*' | cut -d':' -f2 | tr -d '\" '" 2>/dev/null || echo "unknown")
echo "  Active profile: $PROFILE"

if [[ "$PROFILE" =~ ^(conservative|balanced|aggressive)$ ]]; then
  echo -e "  ${GREEN}✓${NC} Valid profile"
  ((PASS++))
else
  echo -e "  ${YELLOW}⚠${NC} Profile not set or invalid"
  ((WARN++))
fi
echo ""

echo "━━━ Autonomous System ━━━"
ssh_warn "Autonomous config exists" "test -f ~/.ari/autonomous.json"
ssh_warn "Autonomous enabled" "cat ~/.ari/autonomous.json 2>/dev/null | grep -q '\"enabled\":.*true'"
ssh_warn "Scheduler state exists" "test -f ~/.ari/scheduler-state.json"
echo ""

echo "━━━ Dashboard ━━━"
ssh_warn "Dashboard accessible" "curl -s http://127.0.0.1:3141/ 2>/dev/null | grep -q 'ARI'"
echo ""

echo "━━━ Audit Chain ━━━"
ssh_check "Audit log exists" "test -f ~/.ari/audit.json"
ssh_check "Audit chain valid" "cd ~/ARI && npx ari audit verify 2>&1 | grep -qi 'valid\|verified\|intact'"
echo ""

echo "━━━ API Endpoints ━━━"
ssh_check "Health endpoint" "curl -s http://127.0.0.1:3141/api/health | grep -q 'status'"
ssh_check "Agents endpoint" "curl -s http://127.0.0.1:3141/api/agents | grep -q '\['"
ssh_warn "Scheduler endpoint" "curl -s http://127.0.0.1:3141/api/scheduler/status | grep -q 'running'"
echo ""

echo "━━━ File Permissions ━━━"
ssh_check "ARI directory readable" "test -r ~/ARI"
ssh_check "Config directory writable" "test -w ~/.ari"
ssh_check "Log directory writable" "test -w ~/Library/Logs 2>/dev/null || test -w ~/.ari"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Budget Status Report
# ─────────────────────────────────────────────────────────────────────────────

echo "━━━ Current Budget Status ━━━"
BUDGET_STATUS=$(ssh -i "$SSH_KEY" "$MINI_HOST" "curl -s http://127.0.0.1:3141/api/budget/status 2>/dev/null" || echo "{}")

if echo "$BUDGET_STATUS" | grep -q "profile"; then
  PROFILE_NAME=$(echo "$BUDGET_STATUS" | grep -o '"profile":"[^"]*"' | cut -d'"' -f4)
  PERCENT_USED=$(echo "$BUDGET_STATUS" | grep -o '"percentUsed":[0-9.]*' | cut -d':' -f2)
  TOKENS_USED=$(echo "$BUDGET_STATUS" | grep -o '"tokensUsed":[0-9]*' | cut -d':' -f2)
  THROTTLE=$(echo "$BUDGET_STATUS" | grep -o '"level":"[^"]*"' | head -1 | cut -d'"' -f4)

  echo "  Profile: $PROFILE_NAME"
  echo "  Tokens Used: $TOKENS_USED"
  echo "  Usage: ${PERCENT_USED:-0}%"
  echo "  Throttle Level: ${THROTTLE:-normal}"
else
  echo "  Budget API not responding or not configured"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  ALL CRITICAL CHECKS PASSED                               ║${NC}"
  echo -e "${GREEN}║  ARI is ready for 24/7 autonomous operation               ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  exit 0
elif [ "$FAIL" -lt 3 ]; then
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  SOME CHECKS FAILED                                       ║${NC}"
  echo -e "${YELLOW}║  Review failures above before proceeding                  ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
  exit 1
else
  echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  DEPLOYMENT VALIDATION FAILED                             ║${NC}"
  echo -e "${RED}║  Multiple critical checks failed                          ║${NC}"
  echo -e "${RED}║  Run deploy-autonomous.sh to fix issues                   ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
  exit 2
fi
