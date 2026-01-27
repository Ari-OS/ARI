# ARI Operations Guide

Version 12.0.0 — Aurora Protocol

## Build and Development

### Prerequisites
- Node.js 20.0.0 or later
- npm (comes with Node.js)
- macOS (primary target platform)

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd ari

# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Initialize ARI system
npx ari onboard init

# Verify installation
npx ari doctor
```

### Build Commands

```bash
# Full build (TypeScript compilation)
npm run build

# Clean build artifacts
npm run clean

# Clean + rebuild
npm run clean && npm run build

# Development mode (auto-rebuild on changes)
npm run dev

# Type checking only (no JavaScript output)
npm run typecheck

# Linting
npm run lint
```

### Testing

```bash
# Run all tests once
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

Expected: 187 tests passing (18 test files).

## Running the Gateway

### Start Gateway

```bash
# Start on default port (3141)
npx ari gateway start

# Start on custom port
npx ari gateway start -p 3142

# Run in background (future: launchd integration)
npx ari gateway start &
```

**Security Note:** Gateway binds to 127.0.0.1 only (loopback). No remote access.

### Check Gateway Status

```bash
# Check if running
npx ari gateway status

# Check on custom port
npx ari gateway status -p 3142
```

Expected output if running:
```
Gateway is running at http://127.0.0.1:3141
Health: OK
```

### Stop Gateway

Currently manual (kill process). Future: daemon management.

```bash
# Find process
lsof -i :3141

# Kill by PID
kill <PID>

# Or kill all node processes (use with caution)
killall node
```

## Daemon Operations (Future: launchd)

### Planned launchd Integration

**Not yet implemented.** Phase 4 feature.

Planned file: `~/Library/LaunchAgents/com.pryceless.ari.plist`

```xml
<!-- Future launchd plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pryceless.ari</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/ari/dist/cli/index.js</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/username/.ari/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/username/.ari/logs/stderr.log</string>
</dict>
</plist>
```

Planned commands:
```bash
# Load daemon (start on boot)
launchctl load ~/Library/LaunchAgents/com.pryceless.ari.plist

# Unload daemon
launchctl unload ~/Library/LaunchAgents/com.pryceless.ari.plist

# Check status
launchctl list | grep ari
```

## Log Locations

### Application Logs

**Location:** ~/.ari/logs/

```bash
# View latest logs
tail -f ~/.ari/logs/ari.log

# Search logs
grep "ERROR" ~/.ari/logs/ari.log

# View logs from specific date
ls -lt ~/.ari/logs/
```

**Log Format:** Pino JSON (structured logging)

Example:
```json
{
  "level": 30,
  "time": 1706400000000,
  "pid": 12345,
  "hostname": "mac-mini",
  "msg": "Gateway started on 127.0.0.1:3141"
}
```

### Audit Logs

**Location:** ~/.ari/audit.json

```bash
# View recent audit events
npx ari audit list

# View last 20 events
npx ari audit list -n 20

# Verify integrity
npx ari audit verify

# Security events only
npx ari audit security

# Raw audit file (JSON)
cat ~/.ari/audit.json | jq '.'
```

### Context Storage

**Location:** ~/.ari/contexts/

```bash
# List all contexts
npx ari context list

# View active context
npx ari context show

# View specific context
npx ari context show my-venture

# Raw context file
cat ~/.ari/contexts/{context-id}.json | jq '.'
```

## Troubleshooting

### Gateway Won't Start

**Problem:** `Error: EADDRINUSE`

**Cause:** Port already in use.

**Solution:**
```bash
# Find process using port 3141
lsof -i :3141

# Kill the process
kill <PID>

# Or start on different port
npx ari gateway start -p 3142
```

### Gateway Not Reachable

**Problem:** `ari doctor` reports gateway not reachable.

**Cause:** Gateway not running or crashed.

**Solution:**
```bash
# Check if process is running
ps aux | grep "ari gateway"

# Check logs for errors
tail -n 50 ~/.ari/logs/ari.log

# Restart gateway
npx ari gateway start

# Verify health
curl http://127.0.0.1:3141/health
```

### Audit Chain Broken

**Problem:** `ari audit verify` fails.

**Cause:** Audit file tampered or corrupted.

**Solution:**
```bash
# Check for specific error
npx ari audit verify

# If corrupted, restore from backup (future: automated backups)
# For now, manual recovery required

# If no backup, reinitialize (LOSES HISTORY)
rm ~/.ari/audit.json
npx ari onboard init
```

**Prevention:**
- Regular backups of ~/.ari/audit.json
- Read-only file permissions (future)
- Encrypted backups (Phase 4)

### Config Invalid

**Problem:** `ari doctor` reports invalid config.

**Cause:** Manual edit broke Zod schema validation.

**Solution:**
```bash
# Check specific error
npx ari doctor

# View config
cat ~/.ari/config.json

# Reset to defaults (LOSES CUSTOM CONFIG)
rm ~/.ari/config.json
npx ari onboard init

# Or manually fix JSON and re-run doctor
npx ari doctor
```

### Context Not Found

**Problem:** `ari context show my-context` returns "not found".

**Cause:** Context not created or wrong name.

**Solution:**
```bash
# List all contexts
npx ari context list

# Check spelling
npx ari context list | grep my-context

# Create if missing
npx ari context create my-context venture
```

### Tests Failing

**Problem:** `npm test` shows failures.

**Cause:** Code changes broke tests or environment issue.

**Solution:**
```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test tests/unit/kernel/sanitizer.test.ts

# Clean and rebuild
npm run clean
npm run build
npm test

# Check Node version
node --version  # Should be 20.0.0+
```

## Migration

### From Fresh Install

No migration needed. Run:
```bash
npm install
npm run build
npx ari onboard init
```

### From v3 (Kagemusha)

**Context:** v12 is a superset of v3. Kernel layer preserved.

**Steps:**
1. Backup existing ~/.ari/ directory
   ```bash
   cp -r ~/.ari ~/.ari.backup.$(date +%Y%m%d)
   ```

2. Pull v12 code
   ```bash
   git pull origin main
   ```

3. Rebuild
   ```bash
   npm run clean
   npm install
   npm run build
   ```

4. Verify health
   ```bash
   npx ari doctor
   ```

5. Initialize contexts (new in v12)
   ```bash
   npx ari context init
   ```

6. Test
   ```bash
   npm test
   ```

**Expected:** All 187 tests pass. Audit chain preserved.

### From v12 Snapshots

**Context:** Restoring from backup.

**Steps:**
1. Stop gateway
   ```bash
   # Find and kill gateway process
   lsof -i :3141
   kill <PID>
   ```

2. Restore ~/.ari/ directory
   ```bash
   rm -rf ~/.ari
   cp -r ~/.ari.backup.YYYYMMDD ~/.ari
   ```

3. Verify integrity
   ```bash
   npx ari doctor
   npx ari audit verify
   ```

4. Restart gateway
   ```bash
   npx ari gateway start
   ```

## Backup Procedures

### Manual Backup

```bash
# Full backup of ARI data
tar -czf ari-backup-$(date +%Y%m%d).tar.gz ~/.ari

# Backup to external drive
rsync -av ~/.ari /Volumes/Backup/ari-backup-$(date +%Y%m%d)/

# Verify backup
tar -tzf ari-backup-$(date +%Y%m%d).tar.gz
```

### Automated Backup (Future)

**Not yet implemented.** Phase 4 feature.

Planned:
- Hourly snapshots of audit.json
- Daily backups of full ~/.ari/
- Retention: 7 days hourly, 30 days daily, 12 months monthly
- Encrypted backups with operator key

## Performance Monitoring

### Health Check

```bash
# Run full health check
npx ari doctor

# Expected: 6/6 checks passing
```

### Gateway Metrics (Future)

**Not yet implemented.** Phase 3 (UI Console).

Planned metrics:
- Requests per minute
- Sanitization hit rate
- Audit log size
- Context routing accuracy
- Average response time

### Resource Usage

```bash
# Check memory usage
ps aux | grep "ari gateway"

# Check disk usage
du -sh ~/.ari

# Check audit log size
du -sh ~/.ari/audit.json

# Check context storage size
du -sh ~/.ari/contexts/
```

## Development Workflow

### Local Development

```bash
# Watch mode (auto-rebuild)
npm run dev

# In separate terminal, run gateway
npx ari gateway start

# In another terminal, run tests in watch mode
npm run test:watch

# Make changes, save, tests auto-run
```

### Adding New Features

1. Create feature branch
   ```bash
   git checkout -b feature/new-feature
   ```

2. Write tests first (TDD)
   ```bash
   # Create test file
   touch tests/unit/kernel/new-feature.test.ts

   # Write failing tests
   npm test
   ```

3. Implement feature
   ```bash
   # Create source file
   touch src/kernel/new-feature.ts

   # Implement until tests pass
   npm run dev
   npm test
   ```

4. Verify health
   ```bash
   npm run build
   npx ari doctor
   npm test
   ```

5. Commit
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Release Process (Future)

**Not yet implemented.** Requires governance process (v12 spec).

Planned:
1. Run full test suite (all 187 tests passing)
2. Update CHANGELOG.md
3. Bump version in package.json
4. Tag release
5. Build distributable (npm pack)
6. Sign with GPG key
7. Publish to registry (future: npm or internal)

---

*Operations guide for ARI V12.0*
