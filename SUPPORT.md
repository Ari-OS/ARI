# Support

ARI is a personal AI operating system built and maintained by Pryce Hedrick.

## Getting Help

### Documentation

| Resource | Description |
|----------|-------------|
| [README.md](README.md) | Overview, architecture, quick start |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup and contribution guide |
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and fixes |
| [docs/guides/](docs/guides/) | In-depth guides (Mac Mini setup, deployment) |
| [docs/plans/](docs/plans/) | Implementation plans and architecture decisions |

### Common Issues

**Tests failing after clone?**
```bash
npm install --ignore-scripts
cd node_modules/better-sqlite3
npx node-gyp rebuild
cd ../..
npm test
```

**Gateway won't start?**
```bash
# Verify loopback-only binding (127.0.0.1:3141)
npm run build && npx ari gateway start
curl http://127.0.0.1:3141/health
```

**Missing API keys?**
Copy `.env.example` → `.env` and fill in required keys. At minimum:
- `ANTHROPIC_API_KEY` — required for all AI operations
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_OWNER_USER_ID` — required for Telegram interface

**Mac Mini daemon not running?**
```bash
launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist
launchctl load ~/Library/LaunchAgents/com.ari.daemon.plist
launchctl list | grep ari
```

**better-sqlite3 build error?**
```bash
# Requires native build tools
cd node_modules/better-sqlite3
npx node-gyp rebuild
```

**TypeScript errors after pull?**
```bash
npm run typecheck 2>&1 | head -30
# Check for new required env vars in src/kernel/config.ts
```

### Mac Mini Deployment

ARI is designed to run 24/7 on a Mac Mini. See the full deployment guide:
- [`docs/guides/MAC_MINI_SETUP.md`](docs/guides/MAC_MINI_SETUP.md) — Complete setup walkthrough
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — Comprehensive issue reference

Key steps:
1. `NODE_ENV=development npm install --ignore-scripts`
2. `NODE_ENV=development npm run build`
3. Rebuild better-sqlite3 native module
4. Install launchd agents for gateway + daemon
5. Configure `~/.ari/.env` with all API keys

## Architecture Help

ARI uses a 7-layer architecture. Understanding the layers prevents most issues:

```
L0 Cognitive   — LOGOS/ETHOS/PATHOS reasoning (no imports)
L1 Kernel      — Security boundary (gateway, sanitizer, audit)
L2 System      — Storage, routing, workspace
L3 Agents      — Multi-agent coordination
L4 Strategic   — Governance, policy engine
L5 Execution   — Daemon, ops, scheduling
L6 Interfaces  — CLI, API, dashboard
```

**Critical**: Lower layers cannot import from higher layers. Cross-layer communication is via EventBus only.

## Security Issues

For security vulnerabilities, **do not open a public issue**. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Feature Requests

ARI is a personal system optimized for Pryce's workflow. While the codebase is open for learning and inspiration, feature requests that don't align with the project's design philosophy may not be accepted.

---

*ARI — Artificial Reasoning Intelligence · Built by Pryce Hedrick*
