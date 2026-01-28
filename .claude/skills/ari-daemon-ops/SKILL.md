---
name: ari-daemon-ops
description: macOS launchd daemon operations for ARI
triggers:
  - "daemon"
  - "launchd"
  - "start ari"
  - "stop ari"
  - "ari service"
---

# ARI Daemon Operations

## Purpose

Manage ARI as a macOS launchd daemon for persistent background operation (ADR-008).

## Daemon Location

- **Plist**: `~/Library/LaunchAgents/com.ari.daemon.plist`
- **Logs**: `~/.ari/logs/`
- **PID**: `~/.ari/ari.pid`

## Launchd Plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ari.daemon</string>

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
    <string>~/.ari/logs/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>~/.ari/logs/stderr.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>ARI_LOG_LEVEL</key>
        <string>info</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

## CLI Commands

```bash
# Start daemon
npx ari daemon start

# Stop daemon
npx ari daemon stop

# Restart daemon
npx ari daemon restart

# Check status
npx ari daemon status

# View logs
npx ari daemon logs
```

## Implementation

```typescript
// src/ops/daemon.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class DaemonManager {
  private plistPath = '~/Library/LaunchAgents/com.ari.daemon.plist';

  async start(): Promise<void> {
    await execAsync(`launchctl load ${this.plistPath}`);
    logger.info('ARI daemon started');
  }

  async stop(): Promise<void> {
    await execAsync(`launchctl unload ${this.plistPath}`);
    logger.info('ARI daemon stopped');
  }

  async status(): Promise<DaemonStatus> {
    try {
      const { stdout } = await execAsync('launchctl list | grep com.ari');
      return { running: true, pid: extractPid(stdout) };
    } catch {
      return { running: false };
    }
  }

  async install(): Promise<void> {
    // Generate and install plist
    const plist = generatePlist();
    await writeFile(this.plistPath, plist);
    logger.info('ARI daemon installed');
  }
}
```

## Health Monitoring

```typescript
// Daemon health check endpoint
gateway.get('/daemon/health', async () => ({
  status: 'running',
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  pid: process.pid
}));
```

## Auto-Restart

launchd's `KeepAlive` ensures ARI restarts on crash:

```xml
<key>KeepAlive</key>
<dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
</dict>
```

## Logging

Daemon logs are separate from application logs:

```
~/.ari/logs/
├── stdout.log      # Standard output
├── stderr.log      # Standard error
├── ari.log         # Application logs (Pino)
└── audit.json      # Audit trail (hash-chained)
```

## Security

- Daemon runs as current user (not root)
- Loopback-only gateway (no network exposure)
- All operations logged to audit trail
- Environment variables for sensitive config
