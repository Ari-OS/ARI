#!/bin/bash
# ARI 24/7 Secure Monitor
#
# SECURITY PRINCIPLES:
# - Never sends data content, only status
# - No tokens/keys in notifications
# - No audit content exposed
# - Logs stored locally only
#
# Install as launchd service for 24/7 monitoring

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARI_URL="http://127.0.0.1:3141"
STATE_FILE="${HOME}/.ari/monitor-state"
LOG_FILE="${HOME}/.ari/monitor.log"

# Ensure .ari directory exists with secure permissions
mkdir -p "${HOME}/.ari"
chmod 700 "${HOME}/.ari"

# Health check - returns only status, no data
check_health() {
  local response=$(curl -s --max-time 5 "${ARI_URL}/health" 2>/dev/null)
  if [ -n "$response" ]; then
    echo "online"
  else
    echo "offline"
  fi
}

# Audit integrity check - returns only valid/invalid, no content
check_integrity() {
  local response=$(curl -s --max-time 10 "${ARI_URL}/api/audit/verify" 2>/dev/null)
  if echo "$response" | grep -q '"valid":true' 2>/dev/null; then
    echo "valid"
  else
    echo "unknown"
  fi
}

# Main monitoring
main() {
  local prev_state=$(cat "$STATE_FILE" 2>/dev/null || echo "unknown")
  local current_state=$(check_health)

  # State change detection (notifications handled by ARI's NotificationManager)
  if [ "$prev_state" != "$current_state" ]; then
    echo "$current_state" > "$STATE_FILE"
  fi

  # Local log only (never sent externally)
  echo "$(date '+%Y-%m-%d %H:%M:%S') | ${current_state}" >> "$LOG_FILE"

  # Rotate log if too large (keep local)
  if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 10000 ]; then
    tail -1000 "$LOG_FILE" > "${LOG_FILE}.tmp"
    mv "${LOG_FILE}.tmp" "$LOG_FILE"
  fi
}

main "$@"
