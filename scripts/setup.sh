#!/usr/bin/env bash
set -euo pipefail

# ARI Development Setup
# This script sets up a development environment for ARI

echo "=== ARI Development Setup ==="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js 20 or higher required (found: v$NODE_VERSION)"
  echo "   Install Node.js 20+ from https://nodejs.org"
  exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Check npm version
echo "Checking npm version..."
NPM_VERSION=$(npm --version | cut -d'.' -f1)

if [ "$NPM_VERSION" -lt 9 ]; then
  echo "❌ Error: npm 9 or higher required (found: v$NPM_VERSION)"
  echo "   Upgrade npm: npm install -g npm@latest"
  exit 1
fi

echo "✓ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

echo "✓ Dependencies installed"
echo ""

# Build project
echo "Building project..."
npm run build

echo "✓ Project built"
echo ""

# Run tests
echo "Running tests..."
npm test

echo "✓ All tests passed"
echo ""

# Initialize ARI
echo "Initializing ARI..."

if [ -d "$HOME/.ari" ]; then
  echo "⚠ Warning: ~/.ari already exists. Skipping initialization."
  echo "   To reinitialize, remove ~/.ari and run this script again."
else
  npx ari onboard init
  echo "✓ ARI initialized at ~/.ari"
fi

echo ""

# Run health check
echo "Running health check..."
npx ari doctor

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Start the gateway: npx ari gateway start"
echo "  2. View audit logs: npx ari audit list"
echo "  3. Install daemon (optional): npx ari daemon install"
echo ""
echo "For more information, see docs/operations/RUNBOOK_MAC_MINI.md"
