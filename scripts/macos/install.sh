#!/usr/bin/env bash
set -euo pipefail

# ARI Gateway - macOS LaunchAgent Installation
# Installs and starts the ARI Gateway as a background service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST_NAME="com.ari.gateway"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"
LOG_DIR="$HOME/.ari/logs"

echo "Installing ARI Gateway..."
echo ""

# Step 1: Build the project
echo "1. Building project..."
cd "$PROJECT_ROOT"
if ! npm run build; then
    echo "Error: Build failed"
    exit 1
fi
echo "   ✓ Build complete"
echo ""

# Step 2: Create log directory
echo "2. Creating log directories..."
mkdir -p "$LOG_DIR"
echo "   ✓ Log directory created: $LOG_DIR"
echo ""

# Step 3: Copy plist to LaunchAgents (with placeholder substitution)
echo "3. Installing LaunchAgent..."
mkdir -p "$LAUNCH_AGENTS_DIR"
if [ -f "$SCRIPT_DIR/com.ari.gateway.plist" ]; then
    NODE_BIN="$(which node 2>/dev/null || echo '/usr/local/bin/node')"
    sed -e "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
        -e "s|__HOME__|$HOME|g" \
        -e "s|/usr/local/bin/node|$NODE_BIN|g" \
        "$SCRIPT_DIR/com.ari.gateway.plist" > "$PLIST_PATH"
    echo "   ✓ Plist installed: $PLIST_PATH"
    echo "   ✓ Node: $NODE_BIN"
else
    echo "Error: Plist template not found at $SCRIPT_DIR/com.ari.gateway.plist"
    exit 1
fi
echo ""

# Step 4: Load the service
echo "4. Loading service..."
if launchctl list | grep -q "$PLIST_NAME"; then
    echo "   Service already loaded, reloading..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    sleep 1
fi
launchctl load "$PLIST_PATH"
echo "   ✓ Service loaded"
echo ""

# Step 5: Verify service is running
echo "5. Verifying service..."
sleep 2
if launchctl list | grep -q "$PLIST_NAME"; then
    echo "   ✓ Service is running"
    echo ""
    echo "Installation complete!"
    echo ""
    echo "The ARI Gateway is now running as a background service."
    echo "It will start automatically on login."
    echo ""
    echo "Commands:"
    echo "  Status:    $SCRIPT_DIR/status.sh"
    echo "  Logs:      $SCRIPT_DIR/logs.sh"
    echo "  Restart:   $SCRIPT_DIR/restart.sh"
    echo "  Uninstall: $SCRIPT_DIR/uninstall.sh"
else
    echo "   ✗ Service failed to start"
    echo ""
    echo "Check logs for errors:"
    echo "  $LOG_DIR/gateway-stderr.log"
    exit 1
fi
