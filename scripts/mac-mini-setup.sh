#!/bin/bash
#═══════════════════════════════════════════════════════════════════════════════
#  ARI Mac Mini Setup Script
#  Purpose: Configure a fresh Mac Mini to run ARI 24/7
#  Author: ARI System
#  Usage: bash mac-mini-setup.sh
#═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running on macOS
check_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        print_error "This script is for macOS only"
        exit 1
    fi
    print_success "Running on macOS $(sw_vers -productVersion)"
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 1: SYSTEM PREREQUISITES
#───────────────────────────────────────────────────────────────────────────────

install_xcode_tools() {
    print_header "Phase 1: Installing Xcode Command Line Tools"

    if xcode-select -p &>/dev/null; then
        print_success "Xcode Command Line Tools already installed"
    else
        print_step "Installing Xcode Command Line Tools..."
        xcode-select --install
        echo ""
        print_warning "A dialog will appear. Click 'Install' and wait for completion."
        print_warning "Press ENTER when the installation is complete..."
        read -r
    fi
}

install_homebrew() {
    print_header "Phase 1: Installing Homebrew"

    if command -v brew &>/dev/null; then
        print_success "Homebrew already installed"
    else
        print_step "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add Homebrew to PATH for Apple Silicon
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi

        print_success "Homebrew installed"
    fi
}

install_essentials() {
    print_header "Phase 1: Installing Essential Packages"

    print_step "Updating Homebrew..."
    brew update

    # Node.js 20
    if command -v node &>/dev/null && [[ "$(node -v)" == v20* ]]; then
        print_success "Node.js 20 already installed: $(node -v)"
    else
        print_step "Installing Node.js 20..."
        brew install node@20
        brew link node@20 --force --overwrite 2>/dev/null || true
        print_success "Node.js installed: $(node -v)"
    fi

    # Git
    if command -v git &>/dev/null; then
        print_success "Git already installed: $(git --version)"
    else
        print_step "Installing Git..."
        brew install git
        print_success "Git installed"
    fi

    # tmux (for persistent sessions)
    if command -v tmux &>/dev/null; then
        print_success "tmux already installed"
    else
        print_step "Installing tmux..."
        brew install tmux
        print_success "tmux installed"
    fi
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 2: CLONE & BUILD ARI
#───────────────────────────────────────────────────────────────────────────────

setup_ari() {
    print_header "Phase 2: Setting Up ARI"

    ARI_DIR="$HOME/Work/ARI"

    # Create Work directory
    mkdir -p "$HOME/Work"

    # Clone or update ARI
    if [[ -d "$ARI_DIR" ]]; then
        print_step "ARI directory exists, pulling latest..."
        cd "$ARI_DIR"
        git pull origin main || git pull origin master || print_warning "Could not pull (may be on different branch)"
    else
        print_step "Cloning ARI repository..."
        cd "$HOME/Work"
        git clone https://github.com/PryceHedrick/ARI.git
    fi

    cd "$ARI_DIR"
    print_success "ARI repository ready at $ARI_DIR"

    # Install dependencies
    print_step "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed"

    # Build
    print_step "Building ARI..."
    npm run build
    print_success "ARI built successfully"

    # Initialize
    print_step "Initializing ARI system..."
    npx ari onboard init 2>/dev/null || print_warning "ARI may already be initialized"
    print_success "ARI initialized"

    # Health check
    print_step "Running health check..."
    npx ari doctor
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 3: INSTALL DAEMON
#───────────────────────────────────────────────────────────────────────────────

install_daemon() {
    print_header "Phase 3: Installing ARI Daemon (24/7 Service)"

    cd "$HOME/Work/ARI"

    print_step "Installing ARI as background daemon..."
    npx ari daemon install 2>/dev/null || {
        print_warning "Daemon install command not available, using manual method..."

        # Manual LaunchAgent setup
        PLIST_DIR="$HOME/Library/LaunchAgents"
        PLIST_FILE="$PLIST_DIR/com.ari.gateway.plist"

        mkdir -p "$PLIST_DIR"
        mkdir -p "$HOME/.ari/logs"

        cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ari.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$HOME/Work/ARI/dist/cli/index.js</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$HOME/Work/ARI</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$HOME/.ari/logs/gateway-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.ari/logs/gateway-stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
EOF

        # Load the daemon
        launchctl unload "$PLIST_FILE" 2>/dev/null || true
        launchctl load "$PLIST_FILE"
    }

    sleep 2

    # Verify daemon is running
    if curl -s http://127.0.0.1:3141/health &>/dev/null; then
        print_success "ARI daemon is running on 127.0.0.1:3141"
    else
        print_warning "Daemon may still be starting. Check with: curl http://127.0.0.1:3141/health"
    fi
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 4: INSTALL CLAUDE CODE
#───────────────────────────────────────────────────────────────────────────────

install_claude_code() {
    print_header "Phase 4: Installing Claude Code"

    if command -v claude &>/dev/null; then
        print_success "Claude Code already installed: $(claude --version 2>/dev/null || echo 'installed')"
    else
        print_step "Installing Claude Code globally..."
        npm install -g @anthropic-ai/claude-code
        print_success "Claude Code installed"
    fi

    echo ""
    print_warning "You'll need to authenticate Claude Code manually."
    print_warning "Run 'claude' in terminal and follow the prompts."
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 5: SYSTEM SETTINGS REMINDERS
#───────────────────────────────────────────────────────────────────────────────

print_manual_steps() {
    print_header "Phase 5: Manual System Settings Required"

    echo -e "${YELLOW}Please configure these settings manually in System Settings:${NC}"
    echo ""
    echo "1. DISABLE SLEEP:"
    echo "   System Settings → Energy → Prevent automatic sleeping: ON"
    echo "   System Settings → Energy → Put hard disks to sleep: OFF"
    echo ""
    echo "2. ENABLE SSH (Remote Login):"
    echo "   System Settings → General → Sharing → Remote Login: ON"
    echo ""
    echo "3. AUTO-LOGIN (Optional):"
    echo "   System Settings → Users & Groups → Login Options"
    echo "   → Automatic login: ari"
    echo ""
    echo "4. DISABLE SCREEN LOCK (Optional):"
    echo "   System Settings → Lock Screen → Require password: Never"
    echo ""
}

#───────────────────────────────────────────────────────────────────────────────
# PHASE 6: OPTIONAL TOOLS
#───────────────────────────────────────────────────────────────────────────────

install_optional_tools() {
    print_header "Phase 6: Optional Tools"

    echo "Would you like to install Tailscale for secure remote access? (y/n)"
    read -r install_tailscale

    if [[ "$install_tailscale" == "y" || "$install_tailscale" == "Y" ]]; then
        print_step "Installing Tailscale..."
        brew install --cask tailscale
        print_success "Tailscale installed. Open it from Applications to set up."
    fi
}

#───────────────────────────────────────────────────────────────────────────────
# FINAL VERIFICATION
#───────────────────────────────────────────────────────────────────────────────

final_verification() {
    print_header "Final Verification"

    echo "Checking all components..."
    echo ""

    # Node.js
    if command -v node &>/dev/null; then
        print_success "Node.js: $(node -v)"
    else
        print_error "Node.js: NOT FOUND"
    fi

    # npm
    if command -v npm &>/dev/null; then
        print_success "npm: $(npm -v)"
    else
        print_error "npm: NOT FOUND"
    fi

    # Git
    if command -v git &>/dev/null; then
        print_success "Git: $(git --version | cut -d' ' -f3)"
    else
        print_error "Git: NOT FOUND"
    fi

    # ARI directory
    if [[ -d "$HOME/Work/ARI" ]]; then
        print_success "ARI Repository: $HOME/Work/ARI"
    else
        print_error "ARI Repository: NOT FOUND"
    fi

    # ARI built
    if [[ -f "$HOME/Work/ARI/dist/cli/index.js" ]]; then
        print_success "ARI Build: Complete"
    else
        print_error "ARI Build: NOT FOUND"
    fi

    # ARI daemon
    if curl -s http://127.0.0.1:3141/health &>/dev/null; then
        print_success "ARI Gateway: Running on 127.0.0.1:3141"
    else
        print_warning "ARI Gateway: Not responding (may need manual start)"
    fi

    # Claude Code
    if command -v claude &>/dev/null; then
        print_success "Claude Code: Installed"
    else
        print_warning "Claude Code: Not installed (run: npm install -g @anthropic-ai/claude-code)"
    fi

    echo ""
    print_header "Setup Complete!"

    echo "Next steps:"
    echo "  1. Configure manual system settings (see above)"
    echo "  2. Authenticate Claude Code: run 'claude' in terminal"
    echo "  3. Verify ARI: curl http://127.0.0.1:3141/health"
    echo "  4. View ARI logs: tail -f ~/.ari/logs/gateway-stdout.log"
    echo ""
    echo "ARI is ready to run 24/7 on this Mac Mini."
    echo ""
}

#───────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
#───────────────────────────────────────────────────────────────────────────────

main() {
    clear
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                               ║${NC}"
    echo -e "${CYAN}║              ARI MAC MINI SETUP SCRIPT                        ║${NC}"
    echo -e "${CYAN}║                                                               ║${NC}"
    echo -e "${CYAN}║   This script will configure your Mac Mini to run ARI 24/7   ║${NC}"
    echo -e "${CYAN}║                                                               ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_macos

    echo ""
    echo "This script will install:"
    echo "  • Xcode Command Line Tools"
    echo "  • Homebrew"
    echo "  • Node.js 20"
    echo "  • Git & tmux"
    echo "  • ARI (clone, build, initialize)"
    echo "  • ARI Daemon (24/7 background service)"
    echo "  • Claude Code"
    echo ""
    echo -e "${YELLOW}Press ENTER to begin setup, or Ctrl+C to cancel...${NC}"
    read -r

    install_xcode_tools
    install_homebrew
    install_essentials
    setup_ari
    install_daemon
    install_claude_code
    print_manual_steps
    install_optional_tools
    final_verification
}

# Run main function
main "$@"
