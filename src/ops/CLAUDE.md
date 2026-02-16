# Operations Layer

Process lifecycle and infrastructure management for ARI.

## Components

| Component | Purpose |
|-----------|---------|
| daemon.ts | macOS launchd daemon integration |
| health-monitor.ts | System health checks and alerting |
| git-sync.ts | Automated git synchronization |
| index.ts | Module exports |

## Daemon Management

### Start/Stop
```bash
npx ari daemon start    # Start ARI daemon
npx ari daemon stop     # Stop daemon
npx ari daemon status   # Check status
npx ari daemon restart  # Restart daemon
```

### launchd Integration

Daemon uses macOS launchd for process management:
- Plist: `~/Library/LaunchAgents/com.ari.daemon.plist`
- Logs: `~/.ari/logs/daemon.log`
- Auto-restart on failure

### Health Checks

Daemon performs periodic health checks:
- Gateway connectivity
- Audit chain integrity
- Memory usage monitoring (vm_stat for macOS)
- Agent responsiveness

## Git Sync

Automated hourly git sync:
- Commits uncommitted changes
- Pushes to configured remotes
- Handles merge conflicts gracefully

## Configuration

```typescript
// ~/.ari/config.json
{
  "daemon": {
    "enabled": true,
    "healthCheckInterval": 30000,
    "maxMemoryMB": 512
  }
}
```

Skills: `/ari-daemon-ops`
