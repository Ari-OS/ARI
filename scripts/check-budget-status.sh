#!/bin/bash

# Quick budget status check for Mac Mini
# Usage: ./scripts/check-budget-status.sh

MINI_HOST="${MINI_HOST:-<USER>@<MAC_MINI_IP>}"
SSH_KEY="~/.ssh/id_ed25519"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          ARI Budget Status (Mac Mini)                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if budget tracker exists
if ! ssh -i "$SSH_KEY" "$MINI_HOST" "test -f ~/.ari/token-usage.json"; then
  echo "⚠ Budget tracker not initialized yet"
  echo "This is normal if autonomous mode just started"
  exit 0
fi

# Get budget data
BUDGET_JSON=$(ssh -i "$SSH_KEY" "$MINI_HOST" "cat ~/.ari/token-usage.json 2>/dev/null")

# Parse and display
echo "Date: $(echo "$BUDGET_JSON" | jq -r '.date')"
echo ""

TOKENS=$(echo "$BUDGET_JSON" | jq -r '.totalTokens')
COST=$(echo "$BUDGET_JSON" | jq -r '.totalCost')

echo "━━━ Usage ━━━"
echo "Tokens: $(printf "%'d" $TOKENS) / 800,000"
echo "Cost: \$$COST / \$2.50"
echo ""

# Calculate percentage
PERCENT=$(echo "scale=1; ($TOKENS / 800000) * 100" | bc)
echo "Percentage: ${PERCENT}%"
echo ""

# Status indicator
if (( $(echo "$PERCENT < 80" | bc -l) )); then
  echo "Status: ✓ HEALTHY (plenty of budget remaining)"
elif (( $(echo "$PERCENT < 95" | bc -l) )); then
  echo "Status: ⚠ THROTTLED (approaching limit)"
else
  echo "Status: 🔴 CRITICAL (budget nearly exhausted)"
fi
echo ""

# By model
echo "━━━ Usage by Model ━━━"
echo "$BUDGET_JSON" | jq -r '.byModel | to_entries | .[] | "  • " + .key + ": " + (.value.tokens | tostring) + " tokens ($" + (.value.cost | tostring) + ")"'
echo ""

# By task type
echo "━━━ Top Task Types ━━━"
echo "$BUDGET_JSON" | jq -r '.byTaskType | to_entries | sort_by(-.value.cost) | .[:5] | .[] | "  • " + .key + ": $" + (.value.cost | tostring) + " (" + (.value.count | tostring) + " calls)"'
echo ""

# Projection
RESET_AT=$(echo "$BUDGET_JSON" | jq -r '.resetAt')
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "━━━ Projection ━━━"
echo "Reset at: $RESET_AT"

# Calculate hours until reset (simplified to midnight)
CURRENT_HOUR=$(date +%H)
HOURS_UNTIL_RESET=$((24 - CURRENT_HOUR))

if [ "$HOURS_UNTIL_RESET" -gt 0 ] && [ "$TOKENS" -gt 0 ]; then
  # Calculate hours elapsed (simplified)
  HOURS_ELAPSED=$((CURRENT_HOUR))
  if [ "$HOURS_ELAPSED" -gt 0 ]; then
    RATE=$(echo "scale=0; $TOKENS / $HOURS_ELAPSED" | bc)
    PROJECTED=$(echo "scale=0; $RATE * 24" | bc)
    echo "Projected end-of-day: $(printf "%'d" $PROJECTED) tokens"
    
    if [ "$PROJECTED" -gt 800000 ]; then
      echo "⚠ Warning: Projected to exceed budget"
    else
      echo "✓ Projected to stay within budget"
    fi
  fi
fi
echo ""

# Recent activity
echo "━━━ Recent Activity ━━━"
ssh -i "$SSH_KEY" "$MINI_HOST" "source ~/.zshrc 2>/dev/null; cd ~/ARI && npx ari audit list -n 3 2>/dev/null | tail -n 4"
