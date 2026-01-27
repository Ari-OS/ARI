# ARI Operations Runbook - Mac Mini

This runbook provides operational procedures for running ARI on a Mac Mini (or any macOS system).

## Prerequisites

### System Requirements

- **OS**: macOS 12.0 (Monterey) or later
- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **Disk**: 500MB free space (for installation and logs)
- **RAM**: 512MB minimum (1GB recommended)

### Verify Prerequisites

```bash
# Check macOS version
sw_vers

# Check Node.js version
node --version  # Should be v20.x.x or higher

# Check npm version
npm --version   # Should be 9.x.x or higher

# Check available disk space
df -h ~
```

## Installation

### 1. Clone Repository

```bash
cd ~
git clone https://github.com/PryceHedrick/ari.git
cd ari
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- TypeScript compiler
- Fastify (gateway)
- Zod (schema validation)
- Commander (CLI)
- Vitest (testing)

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 4. Initialize ARI

```bash
npx ari onboard init
```

This creates:
- `~/.ari/` directory
- `~/.ari/config.json` (default configuration)
- `~/.ari/audit.json` (with genesis block)
- `~/.ari/logs/` directory
- `~/.ari/contexts/` directory

### 5. Verify Installation

```bash
npx ari doctor
```

This runs 6 health checks:
1. Config file exists and is valid
2. Audit log exists
3. Audit chain integrity
4. Contexts directory exists
5. Logs directory exists
6. Gateway connectivity (if running)

Expected output:
```
✓ Config file exists
✓ Audit log exists
✓ Audit chain valid
✓ Contexts directory exists
✓ Logs directory exists
✓ All checks passed
```

## Daily Operations

### Start Gateway Manually

```bash
npx ari gateway start
```

Expected output:
```
Gateway started on 127.0.0.1:3141
```

Gateway will run in the foreground. Press Ctrl+C to stop.

### Start Gateway with Custom Port

```bash
npx ari gateway start -p 3142
```

### Check Gateway Status

```bash
npx ari gateway status
```

Expected output (if running):
```
Gateway is running on 127.0.0.1:3141
```

Expected output (if stopped):
```
Gateway is not running
```

### View Recent Audit Logs

```bash
# Last 10 events
npx ari audit list -n 10

# Last 50 events
npx ari audit list -n 50
```

### View Security Events Only

```bash
npx ari audit security
```

This shows only events related to:
- Injection detection
- Threat assessments
- Permission denials
- Security violations

### Verify Audit Chain Integrity

```bash
npx ari audit verify
```

Expected output:
```
✓ Audit chain valid (120 events verified)
```

If chain is corrupted:
```
✗ Audit chain corrupted at event 45
```

## Daemon Management

The daemon runs ARI's gateway in the background using macOS launchd.

### Install Daemon

```bash
npx ari daemon install
```

This creates and loads:
- `~/Library/LaunchAgents/com.ari.gateway.plist`

The daemon will:
- Start automatically at login
- Restart on crashes
- Log to `~/.ari/logs/daemon.log`

### Check Daemon Status

```bash
npx ari daemon status
```

Expected output (if running):
```
Daemon is running (PID: 12345)
Gateway on 127.0.0.1:3141
```

Expected output (if stopped):
```
Daemon is not running
```

### Uninstall Daemon

```bash
npx ari daemon uninstall
```

This stops and removes the launchd service.

### Manual Daemon Control

```bash
# Stop daemon
launchctl unload ~/Library/LaunchAgents/com.ari.gateway.plist

# Start daemon
launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist

# View daemon logs
tail -f ~/.ari/logs/daemon.log
```

## Context Management

### Initialize Contexts

```bash
npx ari context init
```

### List All Contexts

```bash
npx ari context list
```

### Create New Context

```bash
# Create venture context
npx ari context create "Project Alpha"

# Create life domain context
npx ari context create "Health Goals"
```

### Select Active Context

```bash
npx ari context select <context_id>
```

### Show Active Context

```bash
npx ari context show
```

## Update Procedure

Follow this procedure to update ARI to a new version.

### 1. Stop Running Services

```bash
# If using daemon
npx ari daemon uninstall

# If running manually
# Press Ctrl+C in gateway terminal
```

### 2. Backup Current State

```bash
# Backup ARI data
mkdir -p ~/ari-backups/$(date +%Y%m%d)
cp -r ~/.ari/* ~/ari-backups/$(date +%Y%m%d)/

# Backup repository (optional)
cd ~/ari
tar -czf ~/ari-backups/ari-repo-$(date +%Y%m%d).tar.gz .
```

### 3. Pull Latest Code

```bash
cd ~/ari
git pull origin main
```

### 4. Install Dependencies

```bash
npm install
```

This updates dependencies if package.json changed.

### 5. Rebuild

```bash
npm run clean
npm run build
```

### 6. Run Tests (Optional but Recommended)

```bash
npm test
```

All 120 tests should pass.

### 7. Verify Audit Chain

```bash
npx ari audit verify
```

Ensure chain integrity after update.

### 8. Restart Services

```bash
# If using daemon
npx ari daemon install

# If running manually
npx ari gateway start
```

### 9. Verify Health

```bash
npx ari doctor
```

All checks should pass.

## Troubleshooting

### Port Already in Use

**Symptom**: Gateway fails to start with "Port 3141 already in use"

**Solution**:

```bash
# Find process using port 3141
lsof -i :3141

# Kill process (replace PID)
kill -9 <PID>

# Or use different port
npx ari gateway start -p 3142
```

### Config File Corrupted

**Symptom**: `npx ari doctor` reports "Config file invalid"

**Solution**:

```bash
# Backup corrupted config
mv ~/.ari/config.json ~/.ari/config.json.backup

# Regenerate default config
npx ari onboard init

# Manually restore custom settings from backup
```

### Audit Chain Corrupted

**Symptom**: `npx ari audit verify` reports chain corruption

**Solution**:

```bash
# Restore from backup
cp ~/ari-backups/<date>/audit.json ~/.ari/audit.json

# Verify restoration
npx ari audit verify
```

**If no backup exists**: Audit chain cannot be repaired. You must reinitialize:

```bash
# DANGER: This destroys audit history
mv ~/.ari/audit.json ~/.ari/audit.json.corrupted
npx ari onboard init
```

### Daemon Not Starting

**Symptom**: `npx ari daemon status` shows "not running" after install

**Solution**:

```bash
# Check launchd logs
tail -50 ~/.ari/logs/daemon.log

# Manually load plist
launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist

# Check for errors
launchctl list | grep com.ari.gateway
```

### High Memory Usage

**Symptom**: ARI process consuming excessive RAM

**Solution**:

```bash
# Check process memory
ps aux | grep node

# Restart gateway
npx ari daemon uninstall
npx ari daemon install

# Review audit log for memory leaks
npx ari audit list -n 100 | grep memory
```

## Backup Procedures

### Automated Daily Backup (Recommended)

Create cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * /bin/bash -c 'mkdir -p ~/ari-backups/$(date +\%Y\%m\%d) && cp -r ~/.ari/* ~/ari-backups/$(date +\%Y\%m\%d)/'
```

### Manual Backup

```bash
# Full backup
mkdir -p ~/ari-backups/$(date +%Y%m%d)
cp -r ~/.ari/* ~/ari-backups/$(date +%Y%m%d)/

# Config only
cp ~/.ari/config.json ~/ari-backups/config-$(date +%Y%m%d).json

# Audit log only
cp ~/.ari/audit.json ~/ari-backups/audit-$(date +%Y%m%d).json

# Contexts only
cp -r ~/.ari/contexts ~/ari-backups/contexts-$(date +%Y%m%d)/
```

### Backup Retention

Recommended retention policy:

- **Daily backups**: Keep 7 days
- **Weekly backups**: Keep 4 weeks
- **Monthly backups**: Keep 12 months

Cleanup script:

```bash
# Delete backups older than 7 days
find ~/ari-backups -type d -mtime +7 -exec rm -rf {} \;
```

## Log Files

### Log Locations

| Log File | Location | Purpose |
|----------|----------|---------|
| Daemon log | `~/.ari/logs/daemon.log` | Background service logs |
| Gateway log | `~/.ari/logs/gateway.log` | Gateway operations |
| Audit log | `~/.ari/audit.json` | Tamper-evident event log |
| Application log | `~/.ari/logs/app.log` | General application logs |

### View Logs

```bash
# Daemon log (tail)
tail -f ~/.ari/logs/daemon.log

# Gateway log (tail)
tail -f ~/.ari/logs/gateway.log

# Audit log (formatted)
npx ari audit list -n 50

# All logs (last 100 lines each)
tail -100 ~/.ari/logs/*.log
```

### Log Rotation

Logs automatically rotate when they exceed 10MB:

- Current: `gateway.log`
- Rotated: `gateway.log.1`, `gateway.log.2`, etc.
- Max files: 5 (oldest deleted)

Manual rotation:

```bash
# Stop services
npx ari daemon uninstall

# Rotate logs
cd ~/.ari/logs
for log in *.log; do
  mv "$log" "$log.$(date +%Y%m%d)"
done

# Restart services
npx ari daemon install
```

## Monitoring

### Health Check Script

Create automated health check:

```bash
# Create script
cat > ~/check-ari-health.sh << 'EOF'
#!/bin/bash
RESULT=$(npx ari doctor 2>&1)
if echo "$RESULT" | grep -q "All checks passed"; then
  echo "$(date): ARI healthy" >> ~/.ari/logs/health.log
  exit 0
else
  echo "$(date): ARI unhealthy" >> ~/.ari/logs/health.log
  echo "$RESULT" >> ~/.ari/logs/health.log
  exit 1
fi
EOF

chmod +x ~/check-ari-health.sh

# Run manually
~/check-ari-health.sh

# Or add to cron (every hour)
crontab -e
# Add: 0 * * * * ~/check-ari-health.sh
```

### System Metrics

Monitor key metrics:

```bash
# Gateway uptime
launchctl list | grep com.ari.gateway

# Audit log size
ls -lh ~/.ari/audit.json

# Log directory size
du -sh ~/.ari/logs/

# Config file age
ls -l ~/.ari/config.json
```

## Emergency Procedures

### Gateway Unresponsive

```bash
# Kill gateway process
pkill -f "ari gateway"

# Verify chain integrity
npx ari audit verify

# Restart
npx ari daemon install
```

### Data Corruption

```bash
# Stop all services
npx ari daemon uninstall

# Restore from most recent backup
cp -r ~/ari-backups/<latest>/* ~/.ari/

# Verify restoration
npx ari audit verify
npx ari doctor

# Restart services
npx ari daemon install
```

### Complete Reinstall

```bash
# Backup current state
cp -r ~/.ari ~/ari-backups/pre-reinstall-$(date +%Y%m%d)

# Remove ARI
rm -rf ~/.ari
cd ~/ari
npm run clean

# Reinstall
npm install
npm run build
npx ari onboard init

# Restore data if needed
cp ~/ari-backups/pre-reinstall-<date>/config.json ~/.ari/
cp ~/ari-backups/pre-reinstall-<date>/audit.json ~/.ari/
cp -r ~/ari-backups/pre-reinstall-<date>/contexts ~/.ari/

# Verify
npx ari doctor
```

## Performance Tuning

### Reduce Audit Log Size

If audit log grows too large:

```bash
# Archive old events
cp ~/.ari/audit.json ~/.ari/audit-archive-$(date +%Y%m%d).json

# Keep only recent events (last 1000)
tail -1000 ~/.ari/audit.json > ~/.ari/audit.json.tmp
mv ~/.ari/audit.json.tmp ~/.ari/audit.json

# Note: This breaks the hash chain. Only do in emergencies.
```

### Optimize Daemon Resources

Edit `~/Library/LaunchAgents/com.ari.gateway.plist`:

```xml
<!-- Add resource limits -->
<key>SoftResourceLimits</key>
<dict>
  <key>NumberOfFiles</key>
  <integer>256</integer>
</dict>
```

Then reload:

```bash
launchctl unload ~/Library/LaunchAgents/com.ari.gateway.plist
launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist
```

## Security Hardening

### File Permissions

```bash
# Restrict access to ARI data
chmod 700 ~/.ari
chmod 600 ~/.ari/config.json
chmod 600 ~/.ari/audit.json
chmod 700 ~/.ari/logs
```

### Firewall Configuration

ARI binds to loopback only, but ensure firewall allows localhost:

```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# ARI doesn't need firewall rules (loopback only)
```

### Verify Loopback-Only

```bash
# Check gateway binding
lsof -i :3141 | grep LISTEN

# Should show 127.0.0.1:3141, NOT 0.0.0.0:3141
```

---

**Last Updated**: 2026-01-27
**Version**: 12.0.0
**Platform**: macOS 12.0+
