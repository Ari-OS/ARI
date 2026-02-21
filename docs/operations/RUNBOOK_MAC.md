# ARI macOS Runbook

**Version**: 2.0.0
**Platform**: macOS 13+ (Ventura or later)
**Last Updated**: 2026-01-28

---

## Overview

This runbook provides complete instructions for running ARI as an always-on service on macOS:

- **Development (MacBook)**: Local testing and development
- **Production (Mac Mini M4)**: 24GB RAM optimized deployment

ARI uses `launchd` for daemon management with automatic startup and crash recovery.

---

## Quick Start

### Development (MacBook)

```bash
cd ~/ARI
npm install && npm run build
npm run gateway:start  # Foreground mode
```

### Production (Mac Mini M4)

```bash
cd ~/ARI
npm install && npm run build
npx ari daemon install --production  # Optimized daemon
```

---

## System Requirements

### Development (MacBook)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| macOS | 13.0 (Ventura) | 14.0+ (Sonoma) |
| Node.js | 20.0.0 | 22.0.0 (LTS) |
| RAM | 8 GB | 16 GB |
| Disk | 1 GB | 5 GB |

### Production (Mac Mini M4)

| Requirement | Specification |
|-------------|---------------|
| Hardware | Mac Mini M4 |
| RAM | 24 GB |
| macOS | 14.0+ (Sonoma/Sequoia) |
| Node.js | 22.x LTS |
| Disk | 10 GB free |
| Network | Always-on connection |

### Software Dependencies

```bash
# Check Node.js version
node --version  # Should be 20.0.0+

# If needed, install via Homebrew
brew install node@20
```

---

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/ARI-OS/ARI.git ~/Work/ARI
cd ~/Work/ARI
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Initialize ARI

```bash
npx ari onboard init
```

This creates:

- `~/.ari/config.json` — Runtime configuration
- `~/.ari/audit.json` — Genesis block for audit chain
- `~/.ari/logs/` — Log directory
- `~/.ari/contexts/` — Context storage

### Step 5: Verify Installation

```bash
npx ari doctor
```

Expected output:

```
✓ Node.js version: 20.x.x
✓ ARI directory exists: ~/.ari
✓ Config file valid
✓ Audit chain valid
✓ Permissions correct
✓ Gateway port available
```

---

## Daemon Setup

### Install Service

**Development (standard)**:

```bash
npx ari daemon install
```

**Production (Mac Mini M4 optimized)**:

```bash
npx ari daemon install --production
```

The `--production` flag enables:

- Increased file descriptor limits (4096 soft, 8192 hard)
- Increased process limits (2048)
- Node.js heap size optimization (4GB max)
- 30-second graceful shutdown timeout

This creates a launchd plist at:

```
~/Library/LaunchAgents/com.ari.gateway.plist
```

### Start Service

```bash
npx ari daemon start
```

Or use launchctl directly:

```bash
launchctl load ~/Library/LaunchAgents/com.ari.daemon.plist
```

### Check Status

```bash
npx ari daemon status
```

Or:

```bash
launchctl list | grep ari
```

### Stop Service

```bash
npx ari daemon stop
```

Or:

```bash
launchctl unload ~/Library/LaunchAgents/com.ari.daemon.plist
```

### Uninstall Service

```bash
npx ari daemon uninstall
```

---

## Data Layout

```
~/.ari/
├── config.json         # Runtime configuration (Zod-validated)
├── audit.json          # SHA-256 hash-chained audit log
├── contexts/           # Life and venture contexts
│   ├── active.json     # Current context marker
│   ├── life_*.json     # Life domain contexts
│   └── venture_*.json  # Venture contexts
└── logs/               # Application logs
    ├── daemon.log      # Daemon process logs
    ├── gateway.log     # Gateway request logs
    └── app.log         # Application logs
```

### Config File Schema

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

---

## Verification

### Health Check

```bash
curl http://127.0.0.1:3141/health
```

Expected:

```json
{"status":"healthy","uptime":123}
```

### Audit Chain Verification

```bash
curl http://127.0.0.1:3141/api/audit/verify
```

Expected:

```json
{"valid":true,"eventCount":42,"lastHash":"abc123..."}
```

### Submit Test Message

```bash
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message", "source": "standard"}'
```

---

## Troubleshooting

### Gateway Won't Start

**Symptom**: Port 3141 already in use

```bash
# Find process using port
lsof -i :3141

# Kill if necessary
kill -9 <PID>
```

### Daemon Not Starting

**Check logs**:

```bash
tail -f ~/.ari/logs/daemon.log
```

**Check launchd status**:

```bash
launchctl list | grep ari
```

**Common issues**:

- Permission denied: Check file permissions on ~/.ari
- Node not found: Ensure Node.js is in PATH
- Build outdated: Run `npm run build`

### Audit Chain Invalid

**Symptom**: `npx ari audit verify` fails

**Recovery**:

1. Check `~/.ari/audit.json` for corruption
2. If corrupt, restore from backup or reinitialize:

   ```bash
   npx ari onboard init --force
   ```

   ⚠️ **Warning**: This creates new genesis block, losing audit history.

---

## Backup

### Manual Backup

```bash
tar -czf ari-backup-$(date +%Y%m%d).tar.gz ~/.ari
```

### Automated Backup (cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * tar -czf ~/Backups/ari-$(date +\%Y\%m\%d).tar.gz ~/.ari
```

### Restore

```bash
# Stop daemon
npx ari daemon stop

# Restore
tar -xzf ari-backup-20260128.tar.gz -C ~/

# Start daemon
npx ari daemon start
```

---

## Monitoring

### Log Monitoring

```bash
# Watch all logs
tail -f ~/.ari/logs/*.log

# Watch gateway only
tail -f ~/.ari/logs/gateway.log

# Watch for errors
grep -i error ~/.ari/logs/*.log
```

### Health Monitoring Script

Create `~/bin/ari-health-check.sh`:

```bash
#!/bin/bash

HEALTH=$(curl -s http://127.0.0.1:3141/health)

if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo "✓ ARI healthy"
    exit 0
else
    echo "✗ ARI unhealthy"
    echo "$HEALTH"
    exit 1
fi
```

### Automated Health Check (cron)

```bash
# Check every 5 minutes
*/5 * * * * ~/bin/ari-health-check.sh >> ~/.ari/logs/health.log 2>&1
```

---

## Workflow Integration

### Recommended Tool Chain

```
Perplexity (research) → Claude (synthesis) → Claude Code (implementation) → Cursor (review)
```

### Messaging Tiers

| Tier | Type | Delivery |
|------|------|----------|
| P0 | Critical security alerts | Immediate |
| P1 | Build failures, test failures | Within 5 minutes |
| P2 | Status updates, summaries | Batched hourly |

### Quiet Hours

- **Window**: 22:00 - 07:00 local time
- **P0/P1**: Still delivered
- **P2**: Deferred until morning

---

## Security Notes

### Loopback-Only

ARI **only** listens on `127.0.0.1`. This is hardcoded and cannot be changed. External network access is not possible.

### Firewall

No firewall rules needed — ARI doesn't accept external connections.

### File Permissions

```bash
# Recommended permissions
chmod 700 ~/.ari
chmod 600 ~/.ari/config.json
chmod 600 ~/.ari/audit.json
```

---

## Uninstallation

### Complete Removal

```bash
# Stop and uninstall daemon
npx ari daemon uninstall

# Remove data directory
rm -rf ~/.ari

# Remove repository (optional)
rm -rf ~/Work/ARI
```

---

---

## Mac Mini M4 Production Setup

### Initial Deployment

```bash
# 1. Clone repository
git clone https://github.com/ARI-OS/ARI.git ~/ARI
cd ~/ARI

# 2. Install and build
npm install
npm run build
npm test

# 3. Install production daemon
npx ari daemon install --production

# 4. Verify
npx ari daemon status
curl http://127.0.0.1:3141/api/health
```

### Production Plist Features

The `--production` flag generates optimized launchd configuration:

```xml
<!-- Resource limits for 24GB Mac Mini -->
<key>SoftResourceLimits</key>
<dict>
    <key>NumberOfFiles</key>
    <integer>4096</integer>
    <key>NumberOfProcesses</key>
    <integer>2048</integer>
</dict>

<!-- Node.js memory optimization -->
<key>NODE_OPTIONS</key>
<string>--max-old-space-size=4096</string>

<!-- Graceful shutdown -->
<key>ExitTimeOut</key>
<integer>30</integer>
```

### Log Rotation Setup

```bash
# Install logrotate
brew install logrotate

# Create config
cat > ~/.ari/logrotate.conf << 'EOF'
~/.ari/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF

# Add to crontab
(crontab -l 2>/dev/null; echo "0 0 * * * /opt/homebrew/bin/logrotate ~/.ari/logrotate.conf") | crontab -
```

### Health Monitoring

```bash
# Create monitoring script
cat > ~/bin/ari-health.sh << 'EOF'
#!/bin/bash
HEALTH=$(curl -s http://127.0.0.1:3141/api/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    exit 0
else
    echo "ARI unhealthy at $(date)" >> ~/.ari/logs/health-alerts.log
    exit 1
fi
EOF
chmod +x ~/bin/ari-health.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/bin/ari-health.sh") | crontab -
```

### Automated Backup

```bash
# Daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * tar -czf ~/Backups/ari-\$(date +\%Y\%m\%d).tar.gz ~/.ari") | crontab -
```

---

**Runbook prepared for ARI v2.0.0 on macOS.**
**Production deployment target: Mac Mini M4 (24GB RAM)**
