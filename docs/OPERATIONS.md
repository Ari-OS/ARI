# Operations Guide

## Installation

### Prerequisites

- Node.js 22 or higher
- macOS (for daemon features; gateway works on any OS)

### Setup

```bash
# Clone the repository
git clone https://github.com/PryceHedrick/ari-vnext.git
cd ari-vnext

# Install dependencies
npm install

# Build
npm run build

# Initialize data directories and config
./dist/cli/index.js onboard init

# Run system checks
./dist/cli/index.js doctor --fix
```

## Gateway Management

### Starting the Gateway

```bash
# Foreground mode (for development/debugging)
ari gateway start --foreground

# Custom port
ari gateway start --foreground --port 19000
```

The gateway always binds to `127.0.0.1`. This cannot be changed.

### Checking Status

```bash
ari gateway status
```

Reports whether the daemon is installed and running.

## Daemon Management (macOS)

### Install as Launch Agent

```bash
ari onboard install-daemon
```

This creates a launchd plist at `~/Library/LaunchAgents/com.ari.vnext.plist`
and loads it. ARI will start automatically at login.

### Uninstall

```bash
ari onboard uninstall-daemon
```

### Restart

```bash
ari onboard restart-daemon
```

### Daemon Logs

Standard output and error are written to:
- `~/.ari/logs/ari-stdout.log`
- `~/.ari/logs/ari-stderr.log`

## Audit Log Operations

### List Entries

```bash
# Show recent entries
ari audit list

# Limit to N entries
ari audit list --limit 50

# Filter by action type
ari audit list --action message_received

# Filter by time range
ari audit list --since 2026-01-01T00:00:00Z --until 2026-01-31T23:59:59Z
```

### Verify Integrity

```bash
ari audit verify
```

Checks the hash chain integrity of the entire audit log. Reports:
- Number of entries checked
- Whether the chain is valid
- Location of first invalid entry (if any)

### Tail

```bash
ari audit tail --count 10
```

Shows the last N entries as raw JSON.

## System Diagnostics

```bash
# Run all checks
ari doctor

# Run checks and attempt to fix issues
ari doctor --fix
```

The doctor command checks:
1. Node.js version (requires 22+)
2. Base directory exists (`~/.ari`)
3. Base directory is writable
4. Configuration file is valid
5. Loopback-only binding is enforced
6. Audit log integrity
7. Daemon status (macOS)

## File Locations

| File | Default Path | Purpose |
|------|-------------|---------|
| Config | `~/.ari/config.json` | Application configuration |
| Audit Log | `~/.ari/audit.jsonl` | Hash-chained audit trail |
| PID File | `~/.ari/ari.pid` | Process ID (daemon mode) |
| Logs | `~/.ari/logs/` | Application logs |
| Daemon Plist | `~/Library/LaunchAgents/com.ari.vnext.plist` | macOS launch agent |

## Monitoring

### Health Check via WebSocket

Connect to `ws://127.0.0.1:18789` and send:

```json
{"type": "health", "id": "check-1"}
```

Response includes:
- System status (healthy/degraded/unhealthy)
- Version
- Uptime
- Connection count
- Audit sequence number
- Last message timestamp
- Component check results

### Log Analysis

Application logs are structured JSON (Pino format). Use standard JSON
tools to analyze:

```bash
# View logs
cat ~/.ari/logs/ari.log | jq .

# Filter by level
cat ~/.ari/logs/ari.log | jq 'select(.level == "warn")'
```

## Troubleshooting

### Gateway Won't Start

1. Check if port is in use: `lsof -i :18789`
2. Check Node.js version: `node --version` (requires 22+)
3. Run doctor: `ari doctor --fix`
4. Check logs in `~/.ari/logs/`

### Audit Verification Fails

1. The audit log may have been externally modified
2. Check the error message for the first invalid sequence number
3. Entries before the invalid sequence are still trustworthy
4. A corrupted audit log cannot be repaired (by design)

### Daemon Not Starting

1. Check if plist exists: `ls ~/Library/LaunchAgents/com.ari.vnext.plist`
2. Check launchd status: `launchctl list com.ari.vnext`
3. Review stderr log: `cat ~/.ari/logs/ari-stderr.log`
4. Reinstall: `ari onboard uninstall-daemon && ari onboard install-daemon`
