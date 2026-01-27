# ARI Scripts

This directory contains operational scripts for managing ARI Gateway on macOS.

## Setup

First, make the scripts executable:

```bash
node scripts/make-executable.js
```

Or manually:

```bash
chmod +x scripts/macos/*.sh scripts/backup.sh
```

## macOS Scripts

Located in `scripts/macos/`:

### install.sh

Installs the ARI Gateway as a macOS LaunchAgent service.

```bash
./scripts/macos/install.sh
```

This script:
1. Builds the project (`npm run build`)
2. Creates log directories (`~/.ari/logs/`)
3. Copies the plist to `~/Library/LaunchAgents/`
4. Loads the service with `launchctl`
5. Verifies the service is running

### uninstall.sh

Removes the ARI Gateway LaunchAgent.

```bash
./scripts/macos/uninstall.sh
```

This script:
1. Stops the service (`launchctl unload`)
2. Removes the plist file
3. Prints cleanup information (logs remain)

### status.sh

Checks the current status of the ARI Gateway service.

```bash
./scripts/macos/status.sh
```

Displays:
- Installation status
- Running status (PID)
- Health check (HTTP endpoint)
- Recent log entries

### restart.sh

Restarts the ARI Gateway service.

```bash
./scripts/macos/restart.sh
```

This script:
1. Stops the service
2. Starts the service
3. Waits and checks health

### logs.sh

Views ARI Gateway log files.

```bash
./scripts/macos/logs.sh [-f] [-n lines]
```

Options:
- `-f, --follow`: Follow log output (like `tail -f`)
- `-n, --lines N`: Show last N lines (default: 50)

Examples:
```bash
./scripts/macos/logs.sh              # Last 50 lines
./scripts/macos/logs.sh -n 100       # Last 100 lines
./scripts/macos/logs.sh -f           # Follow in real-time
```

### com.ari.gateway.plist

LaunchAgent plist template with:
- Label: `com.ari.gateway`
- Auto-start on login (`RunAtLoad`)
- Auto-restart on crashes (`KeepAlive.SuccessfulExit: false`)
- Throttle interval: 10 seconds
- Background process type
- Separate stdout/stderr logs
- Environment variables (PATH, NODE_ENV)

**Note**: The install.sh script uses this template. You don't need to edit it manually.

### logrotate.conf

Log rotation configuration for ARI Gateway logs.

To use with logrotate (requires `brew install logrotate`):

```bash
logrotate -f scripts/macos/logrotate.conf
```

Configuration:
- Rotate daily
- Keep 7 days of logs
- Compress old logs
- Targets: `~/.ari/logs/*.log`

## Backup Script

Located in `scripts/`:

### backup.sh

Creates a timestamped backup of ARI data.

```bash
./scripts/backup.sh
```

This script:
1. Creates a backup directory (`~/.ari/backups/`)
2. Copies configuration and data files:
   - `config.json`
   - `audit.json`
   - `contexts/` directory
   - `data/` directory (if exists)
3. Creates a compressed tarball
4. Prints backup summary

Backup location: `~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS.tar.gz`

To restore from backup:
```bash
tar -xzf ~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS.tar.gz -C ~/.ari/backups/
cp -R ~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS/* ~/.ari/
```

## CLI Commands

You can also manage the daemon through the ARI CLI:

```bash
# Install the daemon
npx ari daemon install [-p port]

# Uninstall the daemon
npx ari daemon uninstall

# Check daemon status
npx ari daemon status

# View logs
npx ari daemon logs [-f] [-n lines]
```

## Log Files

The gateway logs are stored at:
- `~/.ari/logs/gateway-stdout.log` - Standard output
- `~/.ari/logs/gateway-stderr.log` - Standard error

## Troubleshooting

### Service won't start

1. Check logs: `./scripts/macos/logs.sh`
2. Verify build: `npm run build`
3. Check plist: `cat ~/Library/LaunchAgents/com.ari.gateway.plist`
4. Check launchctl: `launchctl list | grep com.ari.gateway`

### Permission denied

Make scripts executable:
```bash
node scripts/make-executable.js
```

### Health check fails

1. Verify port is correct (default: 3141)
2. Check if another service is using the port: `lsof -i :3141`
3. Check stderr log for errors

## Directory Structure

```
scripts/
├── macos/
│   ├── install.sh              # Install LaunchAgent
│   ├── uninstall.sh            # Remove LaunchAgent
│   ├── restart.sh              # Restart service
│   ├── status.sh               # Check service status
│   ├── logs.sh                 # View logs
│   ├── com.ari.gateway.plist   # LaunchAgent plist template
│   └── logrotate.conf          # Log rotation config
├── backup.sh                   # Backup ARI data
├── make-executable.js          # Helper to chmod scripts
└── README.md                   # This file
```

## Notes

- All scripts use `set -euo pipefail` for safety
- Scripts are idempotent (safe to run multiple times)
- Logs are never deleted by uninstall (manual cleanup required)
- The gateway runs in the background (ProcessType: Background)
- Auto-restarts on crashes with 10-second throttle
