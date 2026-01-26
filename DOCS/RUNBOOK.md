# ARI OPERATIONS RUNBOOK
## Day-2 Operations, Debugging & Incident Response | V11.0

**Status:** Production Ready  
**Last Updated:** January 26, 2026

---

## QUICK REFERENCE

### Emergency Contacts

| Issue | First Response | Escalation |
|-------|----------------|------------|
| System down | Check logs, restart | Review backup |
| Security incident | Isolate, preserve logs | Full investigation |
| Data corruption | Stop writes, assess | Restore from backup |
| Performance degradation | Check resources | Scale or optimize |

### Critical Commands

```bash
# Check system status
~/ari/scripts/health_check.sh

# View recent logs
tail -f ~/ari/logs/events/$(date +%Y-%m-%d).jsonl | jq

# Stop ARI gracefully
~/ari/scripts/stop.sh

# Start ARI
~/ari/scripts/start.sh

# Emergency stop (immediate)
pkill -f "ari"

# Restore from backup
~/ari/scripts/restore.sh [backup-date]
```

---

## DAILY OPERATIONS

### Morning Checklist

```markdown
## Daily Health Check

- [ ] System running: `pgrep -f ari`
- [ ] No critical errors: Check error log
- [ ] Memory DB healthy: Integrity check
- [ ] Backups current: Check backup timestamp
- [ ] Disk space adequate: > 10GB free
- [ ] API quotas OK: Check usage
```

### Health Check Script

```bash
#!/bin/bash
# health_check.sh

echo "=== ARI Health Check ==="
echo "Timestamp: $(date)"
echo

# Check process
if pgrep -f "ari" > /dev/null; then
    echo "✅ Process: Running"
else
    echo "❌ Process: NOT RUNNING"
fi

# Check database
if sqlite3 ~/ari/memory/ari.db "SELECT 1" > /dev/null 2>&1; then
    echo "✅ Database: Accessible"
else
    echo "❌ Database: ERROR"
fi

# Check disk space
DISK_FREE=$(df -h ~ | awk 'NR==2 {print $4}')
echo "📊 Disk Free: $DISK_FREE"

# Check recent errors
ERROR_COUNT=$(wc -l < ~/ari/logs/errors/$(date +%Y-%m-%d).jsonl 2>/dev/null || echo 0)
echo "📊 Errors Today: $ERROR_COUNT"

# Check last backup
LAST_BACKUP=$(ls -t ~/ari/backups/*.tar.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    BACKUP_AGE=$(( ($(date +%s) - $(stat -f %m "$LAST_BACKUP")) / 3600 ))
    echo "📊 Last Backup: ${BACKUP_AGE}h ago"
else
    echo "⚠️ No backups found"
fi

# Check memory integrity
python3 -c "
from ari.memory import verify_integrity
result = verify_integrity()
print(f'{'✅' if result else '❌'} Memory Integrity: {'OK' if result else 'FAILED'}')
" 2>/dev/null || echo "⚠️ Memory check skipped"

echo
echo "=== End Health Check ==="
```

---

## COMMON ISSUES & SOLUTIONS

### Issue: ARI Not Responding

**Symptoms:**
- No response to commands
- Process appears running but unresponsive

**Diagnosis:**
```bash
# Check if process is running
ps aux | grep ari

# Check CPU/memory usage
top -pid $(pgrep -f ari)

# Check recent logs
tail -100 ~/ari/logs/events/$(date +%Y-%m-%d).jsonl | jq '.event_type'
```

**Solutions:**
1. **Restart gracefully:**
   ```bash
   ~/ari/scripts/stop.sh
   sleep 5
   ~/ari/scripts/start.sh
   ```

2. **Force restart (if unresponsive):**
   ```bash
   pkill -9 -f ari
   ~/ari/scripts/start.sh
   ```

3. **Check for resource exhaustion:**
   ```bash
   df -h  # Disk space
   free -h  # Memory
   ```

---

### Issue: Database Locked

**Symptoms:**
- "database is locked" errors
- Writes failing, reads may work

**Diagnosis:**
```bash
# Check for multiple processes
fuser ~/ari/memory/ari.db

# Check database status
sqlite3 ~/ari/memory/ari.db "PRAGMA integrity_check;"
```

**Solutions:**
1. **Wait and retry** (usually resolves in seconds)

2. **Stop all processes:**
   ```bash
   pkill -f ari
   sqlite3 ~/ari/memory/ari.db "PRAGMA integrity_check;"
   ~/ari/scripts/start.sh
   ```

3. **Recover if corrupted:**
   ```bash
   sqlite3 ~/ari/memory/ari.db ".recover" | sqlite3 ~/ari/memory/ari_recovered.db
   mv ~/ari/memory/ari.db ~/ari/memory/ari_corrupted.db
   mv ~/ari/memory/ari_recovered.db ~/ari/memory/ari.db
   ```

---

### Issue: Memory Integrity Failure

**Symptoms:**
- Hash verification failures
- Inconsistent data

**Diagnosis:**
```bash
# Run integrity check
python3 -c "
from ari.memory import verify_all_hashes
failed = verify_all_hashes()
for mem in failed:
    print(f'Failed: {mem.id} - {mem.type}')
"
```

**Solutions:**
1. **Quarantine suspicious memories:**
   ```bash
   python3 -c "
   from ari.memory import quarantine_by_ids
   quarantine_by_ids(['mem-id-1', 'mem-id-2'])
   "
   ```

2. **Rollback to checkpoint:**
   ```bash
   ~/ari/scripts/rollback.sh [checkpoint-id]
   ```

3. **Full restore from backup:**
   ```bash
   ~/ari/scripts/restore.sh [backup-date]
   ```

---

### Issue: Approval Stuck

**Symptoms:**
- Action waiting for approval indefinitely
- No approval prompt shown

**Diagnosis:**
```bash
# Check pending approvals
jq 'select(.event_type == "APPROVAL_REQUEST" and .security.approval_status == "PENDING")' \
    ~/ari/logs/audit/$(date +%Y-%m-%d).jsonl
```

**Solutions:**
1. **Manually approve/deny:**
   ```bash
   python3 -c "
   from ari.approvals import respond_to_pending
   respond_to_pending('request-id', 'APPROVED', 'Manual approval')
   "
   ```

2. **Clear stale approvals (timeout):**
   ```bash
   python3 -c "
   from ari.approvals import timeout_old_requests
   timeout_old_requests(hours=24)
   "
   ```

---

### Issue: High Error Rate

**Symptoms:**
- Many errors in logs
- Degraded functionality

**Diagnosis:**
```bash
# Count errors by type
jq -s 'group_by(.error.code) | map({code: .[0].error.code, count: length}) | sort_by(-.count)' \
    ~/ari/logs/errors/$(date +%Y-%m-%d).jsonl
```

**Solutions:**
1. **Identify root cause from error messages**
2. **Check external dependencies (APIs, network)**
3. **Review recent changes**
4. **Restart if transient errors**

---

## INCIDENT RESPONSE

### Severity Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **SEV1** | System down, data breach | Immediate | Complete outage, secrets exposed |
| **SEV2** | Major degradation | < 1 hour | Partial outage, security alert |
| **SEV3** | Minor issue | < 24 hours | Feature broken, high error rate |
| **SEV4** | Cosmetic/minor | Best effort | UI glitch, non-critical bug |

### Incident Response Flow

```
┌─────────────────────────────────────────────────────────┐
│                 INCIDENT DETECTED                        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 1. ASSESS — Determine severity                          │
│    • What's the impact?                                 │
│    • Who/what is affected?                              │
│    • Is it ongoing or resolved?                         │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 2. CONTAIN — Stop the bleeding                          │
│    • Isolate affected components                        │
│    • Stop destructive actions                           │
│    • Preserve evidence (don't delete logs)              │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 3. COMMUNICATE — Notify stakeholders                    │
│    • SEV1-2: Immediate notification                     │
│    • SEV3-4: Document for review                        │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 4. INVESTIGATE — Find root cause                        │
│    • Review logs                                        │
│    • Check recent changes                               │
│    • Identify attack vector (if security)               │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 5. REMEDIATE — Fix the issue                            │
│    • Apply fix                                          │
│    • Verify fix works                                   │
│    • Monitor for recurrence                             │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│ 6. DOCUMENT — Record for future                         │
│    • Write incident report                              │
│    • Update runbook                                     │
│    • Implement preventive measures                      │
└─────────────────────────────────────────────────────────┘
```

### Incident Report Template

```markdown
# Incident Report: [Title]

**Incident ID:** INC-YYYY-MM-DD-XXX
**Date:** [Date]
**Severity:** [SEV1/SEV2/SEV3/SEV4]
**Status:** [Open/Resolved]
**Duration:** [Time to resolution]

## Summary

[One paragraph summary of what happened]

## Timeline

| Time | Event |
|------|-------|
| HH:MM | [First symptom observed] |
| HH:MM | [Action taken] |
| HH:MM | [Resolution] |

## Impact

- **Users affected:** [Number/description]
- **Data affected:** [Description]
- **Duration:** [How long impact lasted]

## Root Cause

[What caused the incident]

## Resolution

[How it was fixed]

## Prevention

- [ ] [Action item 1]
- [ ] [Action item 2]

## Lessons Learned

[What we learned]
```

---

## BACKUP & RESTORE

### Backup Schedule

| Data | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Memory DB | Daily | 30 days | ~/ari/backups/ |
| Config | On change | All versions | Git repo |
| Logs | Daily (archive) | Per retention policy | ~/ari/logs/archive/ |
| Full system | Weekly | 4 weeks | ~/ari/backups/full/ |

### Manual Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y-%m-%d_%H%M)
BACKUP_DIR=~/ari/backups

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup memory database
cp ~/ari/memory/ari.db $BACKUP_DIR/ari_$DATE.db

# Backup config
tar -czf $BACKUP_DIR/config_$DATE.tar.gz ~/ari/config/

# Backup logs (current day)
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz ~/ari/logs/*/$(date +%Y-%m-%d).jsonl

# Create full backup
tar -czf $BACKUP_DIR/full/ari_full_$DATE.tar.gz \
    ~/ari/memory/ \
    ~/ari/config/ \
    ~/ari/logs/

echo "Backup complete: $BACKUP_DIR/*_$DATE*"

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR/full -name "*.tar.gz" -mtime +28 -delete
```

### Restore Procedure

```bash
#!/bin/bash
# restore.sh [backup-date]

BACKUP_DATE=$1
BACKUP_DIR=~/ari/backups

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: restore.sh YYYY-MM-DD"
    echo "Available backups:"
    ls -la $BACKUP_DIR/*.db
    exit 1
fi

# Stop ARI
echo "Stopping ARI..."
pkill -f ari

# Backup current state
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mv ~/ari/memory/ari.db ~/ari/memory/ari_pre_restore_$TIMESTAMP.db

# Restore database
echo "Restoring database from $BACKUP_DATE..."
cp $BACKUP_DIR/ari_$BACKUP_DATE*.db ~/ari/memory/ari.db

# Verify restore
echo "Verifying database..."
sqlite3 ~/ari/memory/ari.db "PRAGMA integrity_check;"

# Restart ARI
echo "Starting ARI..."
~/ari/scripts/start.sh

echo "Restore complete. Previous database saved as ari_pre_restore_$TIMESTAMP.db"
```

---

## MAINTENANCE TASKS

### Weekly Tasks

```bash
#!/bin/bash
# weekly_maintenance.sh

echo "=== Weekly Maintenance ==="
echo

# Archive old logs
echo "Archiving logs..."
~/ari/scripts/archive_logs.sh

# Verify backups
echo "Verifying backups..."
for backup in ~/ari/backups/*.db; do
    sqlite3 "$backup" "PRAGMA integrity_check;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ $backup"
    else
        echo "❌ $backup - CORRUPTED"
    fi
done

# Verify audit log integrity
echo "Verifying audit logs..."
for log in ~/ari/logs/audit/*.jsonl; do
    python3 -c "from ari.logging import verify_audit_chain; exit(0 if verify_audit_chain('$log') else 1)"
    if [ $? -eq 0 ]; then
        echo "✅ $log"
    else
        echo "❌ $log - INTEGRITY FAILURE"
    fi
done

# Cleanup temp files
echo "Cleaning up..."
find ~/ari/workspace/temp -mtime +7 -delete

echo "=== Maintenance Complete ==="
```

### Monthly Tasks

- Review error patterns
- Update detection patterns
- Rotate API keys (if needed)
- Review and prune old memories
- Performance analysis
- Security audit

---

## DEBUGGING

### Enable Debug Logging

```bash
# Temporarily enable verbose logging
export ARI_LOG_LEVEL=DEBUG
~/ari/scripts/start.sh

# Or modify config
jq '.logging.level = "DEBUG"' ~/ari/config/defaults.json > tmp.json && mv tmp.json ~/ari/config/defaults.json
```

### Debug Specific Agent

```bash
# Watch specific agent's actions
tail -f ~/ari/logs/events/$(date +%Y-%m-%d).jsonl | jq 'select(.agent == "development")'
```

### Trace Request

```bash
# Follow a specific request through the system
REQUEST_ID="req-abc123"
jq "select(.context.request_id == \"$REQUEST_ID\")" ~/ari/logs/events/$(date +%Y-%m-%d).jsonl
```

---

## PERFORMANCE TUNING

### Monitoring Metrics

```bash
# Response time percentiles
jq -s '[.[].timing.duration_ms] | sort | .[length * 0.5], .[length * 0.95], .[length * 0.99]' \
    ~/ari/logs/events/$(date +%Y-%m-%d).jsonl

# Tool execution frequency
jq -s '[.[] | select(.event_type == "TOOL_CALL")] | group_by(.action) | map({tool: .[0].action, count: length})' \
    ~/ari/logs/events/$(date +%Y-%m-%d).jsonl
```

### Optimization Tips

1. **Memory queries slow:** Add indexes to frequently queried fields
2. **Tool calls slow:** Check rate limits, implement caching
3. **Disk filling up:** Adjust retention, archive more aggressively
4. **High CPU:** Profile to identify hot paths

---

**Document Status:** APPROVED  
**Last Review:** January 26, 2026  
**Next Review:** February 26, 2026
