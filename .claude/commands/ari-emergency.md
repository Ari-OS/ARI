---
name: ari-emergency
description: Emergency response procedures for critical issues
---

# /ari-emergency

Trigger emergency response procedures for critical ARI issues.

## Emergency Types

### Type 1: Security Breach

```
/ari-emergency security
```

Actions:

1. Stop all external communications
2. Verify audit chain integrity
3. Scan for injection patterns
4. Lock down sensitive operations
5. Generate incident report

### Type 2: Data Corruption

```
/ari-emergency data
```

Actions:

1. Stop write operations
2. Verify hash chains
3. Identify corruption scope
4. Initiate recovery from backup
5. Validate restored data

### Type 3: System Failure

```
/ari-emergency system
```

Actions:

1. Capture system state
2. Stop non-essential services
3. Run diagnostics
4. Attempt recovery
5. Escalate if needed

### Type 4: Performance Crisis

```
/ari-emergency performance
```

Actions:

1. Identify resource hogs
2. Enable emergency throttling
3. Clear non-essential caches
4. Restart affected services
5. Monitor recovery

## Emergency Response Protocol

```
┌─────────────────────────────────────────┐
│           EMERGENCY DETECTED            │
├─────────────────────────────────────────┤
│  1. CONTAIN                             │
│     └── Isolate affected systems        │
│                                          │
│  2. ASSESS                              │
│     └── Determine scope and severity    │
│                                          │
│  3. RESPOND                             │
│     └── Execute appropriate runbook     │
│                                          │
│  4. RECOVER                             │
│     └── Restore normal operations       │
│                                          │
│  5. REVIEW                              │
│     └── Document and learn              │
└─────────────────────────────────────────┘
```

## Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| CRITICAL | Data loss, security breach | Immediate |
| HIGH | Service outage | < 15 min |
| MEDIUM | Degraded performance | < 1 hour |
| LOW | Minor issues | < 24 hours |

## Rollback Procedures

### Code Rollback

```bash
# Stop services
npx ari daemon stop

# Rollback to last known good
git checkout <last-good-commit>
npm ci && npm run build

# Restart
npx ari daemon start
npx ari gateway start

# Verify
curl http://127.0.0.1:3141/health
```

### Data Rollback

```bash
# Stop services
npx ari daemon stop

# Restore from backup
cp ~/.ari/backups/latest/* ~/.ari/

# Verify integrity
npx ari audit verify

# Restart
npx ari daemon start
```

## Post-Incident

After every emergency:

1. Create incident report
2. Update runbooks
3. Add to gotchas/memory
4. Review for prevention
5. Update monitoring
