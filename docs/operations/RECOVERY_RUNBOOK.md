# Recovery Runbook

Step-by-step procedures for recovering from common ARI failures.

## Quick Reference

| Problem | Priority | Recovery Time | Procedure |
|---------|----------|---------------|-----------|
| Daemon crashed | P1 | 2 min | [Daemon Restart](#daemon-restart) |
| Audit chain corrupted | P0 | 5 min | [Audit Recovery](#audit-chain-corruption) |
| Budget overrun | P1 | 1 min | [Budget Recovery](#budget-overrun) |
| Notifications not sending | P2 | 5 min | [Notification Recovery](#notification-failure) |
| Mac Mini unreachable | P1 | 10 min | [Mac Mini Recovery](#mac-mini-recovery) |
| Build failure | P2 | 5 min | [Build Recovery](#build-failure) |

## Daemon Restart

**Symptoms**: No health check response, stale logs, no notifications.

```bash
# 1. Check current status
scripts/macos/status.sh

# 2. Check logs for error
scripts/macos/logs.sh -n 50

# 3. Restart the daemon
scripts/macos/restart.sh

# 4. Verify health
curl http://127.0.0.1:3141/health

# 5. If restart fails, uninstall and reinstall
scripts/macos/uninstall.sh
npm run build
scripts/macos/install.sh
```

**If the daemon keeps crashing**: Check `~/.ari/logs/gateway-stderr.log` for the error. Common causes:

- Port 3141 already in use: `lsof -i :3141` then kill the process
- Missing environment variables: Check `~/ARI/.env` exists
- Build corruption: `npm run build` to rebuild

## Audit Chain Corruption

**Symptoms**: P0 alert, `npx ari audit verify` reports broken chain.

```bash
# 1. Stop the daemon
scripts/macos/uninstall.sh

# 2. Verify the chain
npx ari audit verify

# 3. Check if it's a checkpoint mismatch vs chain break
# Chain break = events were modified
# Checkpoint mismatch = chain was replaced

# 4. If backup exists, restore
ls ~/.ari/backups/
# Find latest backup
tar xzf ~/.ari/backups/ari-backup-LATEST.tar.gz -C /tmp/ari-restore/
cp /tmp/ari-restore/.ari/audit.json ~/.ari/audit.json

# 5. If no backup, start fresh (last resort)
mv ~/.ari/audit.json ~/.ari/audit.json.corrupted
mv ~/.ari/audit-checkpoints.json ~/.ari/audit-checkpoints.json.corrupted

# 6. Restart daemon
scripts/macos/install.sh

# 7. Create immediate backup
scripts/backup.sh
```

**Prevention**: Run `scripts/backup.sh` daily. The daemon creates automatic checkpoints every 100 events.

## Budget Overrun

**Symptoms**: P1 alert, autonomous operations paused.

```bash
# 1. Check current budget status
scripts/check-budget-status.sh
# Or via API
curl http://127.0.0.1:3141/api/budget/status

# 2. Budget resets at midnight local time (daily) or month start (monthly)
# Wait for reset, or:

# 3. Manual override (if urgent work needed)
# Restart daemon with aggressive budget profile
# Edit ~/ARI/.env: BUDGET_PROFILE=aggressive
scripts/macos/restart.sh

# 4. Reset to normal after urgent work
# Edit ~/ARI/.env: BUDGET_PROFILE=balanced
scripts/macos/restart.sh
```

**Prevention**: Monitor budget with `scripts/monitor-mac-mini.sh`. The degradation ladder (warning at 80%, reduce at 90%, pause at 95%) gives early warning.

## Notification Failure

**Symptoms**: No Telegram messages, notifications only in logs.

```bash
# 1. Check if Telegram bot token is valid
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe

# 2. Check daemon logs for notification errors
scripts/macos/logs.sh -n 100 | grep -i "telegram\|notification"

# 3. Verify environment variables
grep TELEGRAM ~/ARI/.env

# 4. Test notification manually
curl -X POST http://127.0.0.1:3141/api/test-notification \
  -H 'Content-Type: application/json' \
  -d '{"message": "test", "priority": "normal"}'

# 5. If token expired, get new one from @BotFather on Telegram
# Update TELEGRAM_BOT_TOKEN in ~/ARI/.env
scripts/macos/restart.sh
```

## Mac Mini Recovery

**Symptoms**: Cannot SSH to Mac Mini, no health checks responding.

```bash
# 1. Try SSH
ssh ari@mac-mini.local

# 2. If SSH fails, try Tailscale
ssh ari@100.x.x.x  # Tailscale IP

# 3. If connected, check what happened
uptime                          # Was it rebooted?
scripts/macos/status.sh         # Is daemon running?
scripts/macos/logs.sh -n 100    # Recent logs

# 4. If daemon is down, restart
scripts/macos/restart.sh

# 5. If Mac Mini was rebooted
# LaunchAgent should auto-start the daemon
# If it didn't:
scripts/macos/install.sh

# 6. Verify everything
scripts/health-check.sh
```

## Build Failure

**Symptoms**: `npm run build` fails, TypeScript errors.

```bash
# 1. Check the error
npm run build 2>&1 | head -50

# 2. If it's a dependency issue
rm -rf node_modules
npm install
npm run build

# 3. If it's a TypeScript error
npm run typecheck 2>&1 | head -50
# Fix the reported errors

# 4. If build is fine but tests fail
npm test 2>&1 | tail -20

# 5. After fixing, rebuild and restart
npm run build
scripts/macos/restart.sh
```

## Data Backup and Restore

### Create Backup

```bash
scripts/backup.sh
# Creates: ~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS.tar.gz
```

### Restore from Backup

```bash
# 1. Stop daemon
scripts/macos/uninstall.sh

# 2. List available backups
ls -la ~/.ari/backups/

# 3. Restore
tar xzf ~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS.tar.gz -C /tmp/ari-restore/

# 4. Copy back what you need
cp /tmp/ari-restore/.ari/audit.json ~/.ari/
cp /tmp/ari-restore/.ari/audit-checkpoints.json ~/.ari/
# Don't restore config if you've made intentional changes

# 5. Restart
scripts/macos/install.sh
```

### What Gets Backed Up

| Data | Location | Backed Up |
|------|----------|-----------|
| Audit chain | `~/.ari/audit.json` | Yes |
| Checkpoints | `~/.ari/audit-checkpoints.json` | Yes |
| Logs | `~/.ari/logs/` | Yes |
| Config | `~/.ari/config.json` | Yes |
| Source code | `~/ARI/` | Git (not backup script) |
| Environment | `~/ARI/.env` | No (contains secrets) |

## Safe Mode Boot

If a critical subsystem is broken on startup, ARI should degrade gracefully instead of crashing or running without safety checks.

| Subsystem Failure | Safe Mode Behavior |
|-------------------|--------------------|
| Audit chain fails verification | Start with **no tool execution**. Log-only mode. P0 alert. |
| PolicyEngine fails to initialize | Start **read-only**. No write/execute tools. P0 alert. |
| Budget state corrupted | Default to **conservative** profile ($1/day). P1 alert. |
| Keychain key unavailable | Use ephemeral signing key. Log warning. Checkpoint signatures won't survive next restart. |
| Telegram unavailable | Start normally. Log warnings. Alerts go to local log only. |

**Principle**: If a safety system is broken, restrict capabilities — don't disable safety.

```bash
# Check if ARI started in safe mode
curl http://127.0.0.1:3141/health
# Look for "safeMode": true in the response
```

## Emergency Contacts

If ARI sends a P0 alert:

1. Check the specific error in the alert message
2. Follow the relevant procedure above
3. If unable to resolve, check `~/.ari/logs/gateway-stderr.log`

---

v1.0 - 2026-02-10
