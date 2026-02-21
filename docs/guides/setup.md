# ARI Complete Setup Guide

**Version**: 2.0.0
**Platform**: macOS (primary), Linux/Windows (partial support)
**Last Updated**: 2026-01-28

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running ARI](#running-ari)
6. [Dashboard Setup](#dashboard-setup)
7. [Daemon Setup](#daemon-setup)
8. [Development Environment](#development-environment)
9. [Troubleshooting](#troubleshooting)
10. [Uninstallation](#uninstallation)

---

## Quick Start

```bash
# Clone
git clone https://github.com/Ari-OS/ARI.git
cd ARI

# Install and build
npm install
npm run build

# Initialize
npx ari onboard init

# Verify
npx ari doctor

# Start
npx ari gateway start
```

---

## Prerequisites

### Required

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 20.0.0+ | `node --version` |
| npm | 10.0.0+ | `npm --version` |
| Git | 2.0+ | `git --version` |

### Optional

| Requirement | Version | Purpose |
|-------------|---------|---------|
| macOS | 13+ (Ventura) | Daemon support (launchd) |
| curl | Any | API testing |
| jq | Any | JSON parsing |

### Install Node.js (if needed)

**macOS (Homebrew)**:

```bash
brew install node@20
```

**macOS (nvm)**:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

**Linux (Ubuntu/Debian)**:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows**:
Download from <https://nodejs.org/> (LTS version)

---

## Installation

### Step 1: Clone Repository

```bash
# HTTPS
git clone https://github.com/Ari-OS/ARI.git

# SSH (if configured)
git clone git@github.com:Ari-OS/ARI.git

# Navigate to directory
cd ARI
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:

- Fastify (HTTP server)
- Zod (schema validation)
- Commander (CLI)
- Pino (logging)
- Vitest (testing)
- And other dependencies...

### Step 3: Build

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Initialize ARI

```bash
npx ari onboard init
```

This creates:

- `~/.ari/` — Data directory
- `~/.ari/config.json` — Configuration
- `~/.ari/audit.json` — Genesis block for audit chain
- `~/.ari/logs/` — Log directory
- `~/.ari/contexts/` — Context storage

### Step 5: Verify Installation

```bash
npx ari doctor
```

Expected output:

```
ARI Doctor - System Health Check
─────────────────────────────────
✓ Node.js version: 20.x.x (minimum: 20.0.0)
✓ ARI directory exists: ~/.ari
✓ Config file valid: ~/.ari/config.json
✓ Audit chain valid: 1 events, chain intact
✓ Permissions correct: config readable/writable
✓ Gateway port available: 3141

All 6 checks passed. ARI is ready.
```

---

## Configuration

### Config File Location

```
~/.ari/config.json
```

### Default Configuration

```json
{
  "version": "2.0.0",
  "gateway": {
    "port": 3141,
    "host": "127.0.0.1"
  },
  "logging": {
    "level": "info",
    "pretty": true
  },
  "security": {
    "trustLevel": "standard",
    "riskThreshold": 0.8
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gateway.port` | number | 3141 | Gateway port (1024-65535) |
| `gateway.host` | string | 127.0.0.1 | **Immutable** — always loopback |
| `logging.level` | string | info | Log level (debug, info, warn, error) |
| `logging.pretty` | boolean | true | Pretty-print logs |
| `security.trustLevel` | string | standard | Default trust level |
| `security.riskThreshold` | number | 0.8 | Auto-block threshold |

### Environment Variables

```bash
# Log level override
export LOG_LEVEL=debug

# Port override (gateway only)
export ARI_PORT=3142
```

---

## Running ARI

### Start Gateway

```bash
npx ari gateway start
```

Output:

```
ARI Gateway starting...
✓ Config loaded
✓ Audit chain initialized (42 events)
✓ Sanitizer loaded (42 patterns)
✓ EventBus ready
✓ Listening on http://127.0.0.1:3141

Press Ctrl+C to stop.
```

### Custom Port

```bash
npx ari gateway start -p 3142
```

### Check Status

```bash
npx ari gateway status
```

### Health Check (curl)

```bash
curl http://127.0.0.1:3141/health
```

Response:

```json
{"status":"healthy","uptime":123}
```

### Submit a Message

```bash
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello ARI", "source": "standard"}'
```

### View Audit Log

```bash
npx ari audit list -n 10
```

### Verify Audit Chain

```bash
npx ari audit verify
```

---

## Dashboard Setup

### Prerequisites

The dashboard requires the gateway to be running.

### Install Dashboard Dependencies

```bash
cd dashboard
npm install
```

### Development Mode

```bash
npm run dev
```

Open <http://localhost:5173> in your browser.

### Production Build

```bash
npm run build
```

Static files are output to `dashboard/dist/`.

### Dashboard Pages

| Page | Description |
|------|-------------|
| Home | System overview, agent status |
| Agents | Agent details and metrics |
| Governance | Council, Arbiter, Overseer status |
| Memory | Memory search and browse |
| Tools | Tool registry and permissions |
| Audit | Audit log viewer and chain status |

---

## Daemon Setup

### macOS Only

The daemon uses `launchd` for background operation.

### Install Daemon

```bash
npx ari daemon install
```

This creates:

```
~/Library/LaunchAgents/com.ari.daemon.plist
```

### Start Daemon

```bash
npx ari daemon start
```

Or:

```bash
launchctl load ~/Library/LaunchAgents/com.ari.daemon.plist
```

### Check Status

```bash
npx ari daemon status
```

### View Logs

```bash
tail -f ~/.ari/logs/daemon.log
```

### Stop Daemon

```bash
npx ari daemon stop
```

### Uninstall Daemon

```bash
npx ari daemon uninstall
```

---

## Development Environment

### IDE Setup

**VS Code** (Recommended):

Extensions:

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Vitest

Settings:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Development Commands

```bash
# Watch mode (rebuild on change)
npm run dev

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint

# Lint and fix
npm run lint:fix

# Clean build
npm run clean && npm run build
```

### Running Tests

```bash
# All tests
npm test

# Coverage report
npm run test:coverage

# Specific test file
npx vitest run tests/unit/kernel/sanitizer.test.ts

# Watch specific file
npx vitest tests/unit/kernel/sanitizer.test.ts
```

### Git Hooks

ARI uses Husky for Git hooks:

- **pre-commit**: Runs lint
- **commit-msg**: Validates commit message format

Commit message format:

```
type(scope): description

feat(agents): add new planner capability
fix(gateway): handle timeout errors
docs(readme): update quickstart
```

---

## Troubleshooting

### "Port already in use"

```bash
# Find process using port
lsof -i :3141

# Kill process
kill -9 <PID>
```

### "Config file not found"

```bash
# Reinitialize
npx ari onboard init
```

### "Audit chain invalid"

```bash
# Check audit file
cat ~/.ari/audit.json | jq .

# Reinitialize (WARNING: loses history)
npx ari onboard init --force
```

### "Build errors"

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### "Tests failing"

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test
npx vitest run tests/unit/kernel/sanitizer.test.ts
```

### "TypeScript errors"

```bash
# Check types
npm run typecheck

# Clear TypeScript cache
rm -rf node_modules/.cache
```

---

## Uninstallation

### Stop Services

```bash
# Stop gateway (if running)
# Ctrl+C in terminal

# Stop daemon (if installed)
npx ari daemon uninstall
```

### Remove Data

```bash
# Remove ARI data directory
rm -rf ~/.ari
```

### Remove Repository

```bash
# Remove cloned repo
rm -rf /path/to/ARI
```

### Complete Cleanup

```bash
# All of the above
npx ari daemon uninstall 2>/dev/null
rm -rf ~/.ari
rm -rf /path/to/ARI
```

---

## Directory Structure

### Repository

```
ARI/
├── src/                 # Source code
│   ├── kernel/          # Kernel layer
│   ├── system/          # System layer
│   ├── agents/          # Agent layer
│   ├── governance/      # Governance layer
│   ├── ops/             # Operations layer
│   ├── cli/             # CLI layer
│   ├── api/             # API routes
│   └── mcp/             # MCP server
├── dashboard/           # React dashboard
├── tests/               # Test files
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── dist/                # Compiled output
└── node_modules/        # Dependencies
```

### User Data

```
~/.ari/
├── config.json          # Configuration
├── audit.json           # Audit log
├── logs/                # Application logs
│   ├── daemon.log
│   ├── gateway.log
│   └── app.log
└── contexts/            # Context storage
    ├── active.json
    └── *.json
```

---

## Next Steps

1. **Explore the CLI**: `npx ari --help`
2. **Read the architecture**: [docs/architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
3. **Understand security**: [docs/SECURITY.md](SECURITY.md)
4. **Run the dashboard**: `cd dashboard && npm run dev`
5. **Review the API**: [README.md API section](../README.md#api)

---

**Setup guide for ARI v2.0.0**
