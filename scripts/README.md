# ARI Scripts

Operational scripts for managing, deploying, and monitoring ARI.

## Setup

Make shell scripts executable:

```bash
node scripts/make-executable.js
```

## Directory Structure

```
scripts/
├── macos/                         # macOS LaunchAgent service management
│   ├── install.sh                 # Install ARI Gateway LaunchAgent
│   ├── uninstall.sh               # Remove ARI Gateway LaunchAgent
│   ├── restart.sh                 # Restart gateway service
│   ├── status.sh                  # Check gateway service status
│   ├── logs.sh                    # View gateway logs
│   ├── com.ari.gateway.plist      # Gateway LaunchAgent plist template
│   ├── com.ari.e2e.plist          # E2E test schedule LaunchAgent plist
│   └── logrotate.conf             # Log rotation config
├── setup.sh                       # Development environment setup
├── setup-claude.sh                # Claude Code project setup (install + build)
├── setup-claude-environment.sh    # Claude Code environment + plugins setup
├── setup-autonomous.sh            # Configure autonomous operation (API keys, notifications)
├── setup-sms.sh                   # SMS bridge setup (Twilio)
├── deploy-mac-mini.sh             # Deploy ARI to Mac Mini (pull, build, restart)
├── deploy-autonomous.sh           # Deploy 24/7 autonomous ARI to Mac Mini
├── sync-mac-mini.sh               # Sync latest code to Mac Mini (lightweight)
├── mac-mini-setup.sh              # Full Mac Mini setup from scratch
├── mac-mini-ari-setup.sh          # Mac Mini setup with ARI's GitHub identity
├── validate-deployment.sh         # Validate all components after deployment
├── install-e2e-schedule.sh        # Install daily E2E test launchd schedule
├── health-check.sh                # Verify ARI is operational
├── ari-monitor.sh                 # 24/7 secure monitoring (launchd service)
├── monitor-mac-mini.sh            # Live Mac Mini monitoring (budget, tasks, health)
├── check-budget-status.sh         # Check token budget status on Mac Mini
├── morning-briefing.sh            # 7 AM daily briefing (SMS + Notion)
├── evening-summary.sh             # 9 PM daily summary (Notion)
├── weekly-review.sh               # Sunday 6 PM weekly review (Notion)
├── backup.sh                      # Timestamped backup of ARI data
├── scan-pii.sh                    # Scan codebase for personal information
├── make-executable.js             # Helper to chmod scripts
├── migrate-tools.ts               # Migrate tool definitions to capability/policy split
├── sms-daemon.ts                  # Two-way SMS communication daemon
├── test-notifications.ts          # Test all notification priority paths
├── example-report.ts              # Generate example decision report
├── v12-scan.ts                    # Scan v12 docs directory for key files
├── notification.env.example       # Template for notification credentials
└── README.md                      # This file
```

## Development Setup

| Script | Purpose |
|--------|---------|
| `setup.sh` | Install dependencies, build, run tests |
| `setup-claude.sh` | Configure Claude Code for this project |
| `setup-claude-environment.sh` | Full Claude Code environment + plugins on a new machine |
| `setup-autonomous.sh` | Configure API keys, Telegram, Notion, SMS for autonomous operation |
| `setup-sms.sh` | Set up two-way SMS via Twilio |

## Mac Mini Deployment

| Script | Purpose |
|--------|---------|
| `mac-mini-setup.sh` | Complete Mac Mini setup from scratch (Node, Git, tmux, ARI, dashboard, Claude Code, Tailscale) |
| `mac-mini-ari-setup.sh` | Configure Mac Mini with ARI's own GitHub identity |
| `deploy-mac-mini.sh` | Deploy latest code: pull, build, restart daemon, verify health |
| `deploy-autonomous.sh` | Full 24/7 autonomous deployment with budget profile selection |
| `sync-mac-mini.sh` | Lightweight code sync without full deployment |
| `validate-deployment.sh` | Post-deployment validation of all components |

## macOS Service Management

Located in `scripts/macos/`:

| Script | Purpose |
|--------|---------|
| `install.sh` | Build project, install LaunchAgent, start service |
| `uninstall.sh` | Stop and remove LaunchAgent |
| `restart.sh` | Stop, start, and health-check the service |
| `status.sh` | Show installation status, PID, health, recent logs |
| `logs.sh` | View logs (`-f` to follow, `-n N` for line count) |
| `com.ari.gateway.plist` | Gateway LaunchAgent template (auto-start, auto-restart) |
| `com.ari.e2e.plist` | E2E daily test schedule LaunchAgent template |
| `logrotate.conf` | Daily rotation, 7-day retention, compression |

## Monitoring and Health

| Script | Purpose |
|--------|---------|
| `health-check.sh` | Verify gateway, agents, and endpoints are operational |
| `ari-monitor.sh` | 24/7 secure status monitor (installable as launchd service) |
| `monitor-mac-mini.sh` | Live dashboard: budget, tasks, health (refreshes every 30s) |
| `check-budget-status.sh` | Quick token budget check on Mac Mini |

## Scheduled Reports

| Script | Schedule | Purpose |
|--------|----------|---------|
| `morning-briefing.sh` | 7 AM daily | Process overnight queue, generate briefing, SMS + Notion |
| `evening-summary.sh` | 9 PM daily | Summarize day's activities, update Notion |
| `weekly-review.sh` | Sunday 6 PM | Weekly metrics, trends, Notion review page |
| `install-e2e-schedule.sh` | One-time | Install daily 9 AM E2E test schedule via launchd |

## Utilities

| Script | Purpose |
|--------|---------|
| `backup.sh` | Backup ARI data to `~/.ari/backups/ari-backup-YYYYMMDD-HHMMSS.tar.gz` |
| `scan-pii.sh` | Scan for PII before commits |
| `make-executable.js` | Make all shell scripts executable |
| `migrate-tools.ts` | Migrate tool definitions to capability/policy JSON format |
| `sms-daemon.ts` | Standalone two-way SMS service (run with `npx tsx`) |
| `test-notifications.ts` | Test notification priority paths P0-P4 |
| `example-report.ts` | Generate example decision report |
| `v12-scan.ts` | Scan v12 docs directory for important files |
| `notification.env.example` | Template for `~/.ari/notification.env` credentials |

## Log Files

Gateway logs are stored at:

- `~/.ari/logs/gateway-stdout.log` - Standard output
- `~/.ari/logs/gateway-stderr.log` - Standard error

## CLI Commands

The daemon can also be managed through the ARI CLI:

```bash
npx ari daemon install [-p port]
npx ari daemon uninstall
npx ari daemon status
npx ari daemon logs [-f] [-n lines]
```
