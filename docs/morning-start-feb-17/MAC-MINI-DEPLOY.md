# Mac Mini Deployment Guide

> **CRITICAL**: Username is `ari` (NOT prycehedrick, NOT pryce)
> IP: 100.81.73.34 (via Tailscale)

## SSH Connection

```bash
ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34
```

## On Mac Mini — Full Deployment

```bash
# Source shell for Node.js
source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null

# Navigate to repo
cd /Users/ari/ARI

# Pull latest
git pull origin main

# Install dependencies (--ignore-scripts because husky not globally installed)
npm install --ignore-scripts

# Build
npm run build

# Run tests
npm test

# Set API key (if not already done)
# Edit ~/.ari/.env and add ANTHROPIC_API_KEY

# Install daemon (macOS launchd)
npx ari daemon install

# Start daemon
npx ari daemon start

# Verify
npx ari daemon status
npx ari doctor
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ssh: Connection refused` | Check Tailscale: `tailscale status` |
| `node: command not found` | Run `source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null` |
| `Cannot find module` | Run `npm run build` |
| Husky errors | Use `npm install --ignore-scripts` |
| Daemon won't start | Check logs: `tail -f ~/.ari/logs/daemon.log` |
| Tests fail | Check if `.env` has required variables |

## Monitoring

```bash
# Daemon status
npx ari daemon status

# System health
npx ari doctor

# View logs
tail -f ~/.ari/logs/daemon.log

# Telegram test
npx ari chat "test message"
```

## Rollback

```bash
cd /Users/ari/ARI
git stash
git checkout main
git pull origin main
npm install --ignore-scripts
npm run build && npm test
npx ari daemon restart
```
