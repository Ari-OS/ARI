# Mac Mini Deployment Guide

## Pre-Flight Checklist

- [ ] All code committed and pushed to GitHub (commit `ab559aa` or later)
- [ ] All tests passing locally (`npm test` → 5,600+)
- [ ] TypeScript clean (`npm run typecheck`)
- [ ] ESLint clean (`npm run lint`)
- [ ] All API keys in `~/.ari/.env` (see env-template.sh)
- [ ] Workspace files deployed to `~/.ari/workspace/`
- [ ] Daemon env injection list updated in `src/ops/daemon.ts`

## Step 1: SSH into Mac Mini

```bash
ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34
```

## Step 2: Source Node.js Environment

```bash
source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null;
node --version  # Should be 20+
```

## Step 3: Pull Latest Code

```bash
cd /Users/ari/ARI
git pull origin main
```

## Step 4: Install Dependencies

CRITICAL: Mac Mini has NODE_ENV=production in shell. Must override for devDeps.

```bash
NODE_ENV=development npm install --ignore-scripts
```

## Step 5: Rebuild Native Modules

```bash
cd node_modules/better-sqlite3 && npx node-gyp rebuild && cd ../..
```

## Step 6: Build TypeScript

```bash
NODE_ENV=development npm run build
```

## Step 7: Run Tests

```bash
npm test
# Must show all 5,600+ tests passing
```

## Step 8: Deploy Workspace Files

From your MacBook (separate terminal):

```bash
scp -i ~/.ssh/id_ed25519 ~/.ari/workspace/*.md ari@100.81.73.34:~/.ari/workspace/
```

## Step 9: Configure API Keys

```bash
nano ~/.ari/.env
# Add all keys from env-template.sh
# Verify no trailing spaces or missing values
```

## Step 10: Stop Existing Daemon

```bash
npx ari daemon stop
launchctl list | grep com.ari  # Should show no results
```

## Step 11: Start Daemon

```bash
npx ari daemon start --production
```

## Step 12: Verify Deployment

```bash
# Check daemon is running
npx ari daemon status
launchctl list | grep com.ari.gateway  # Should show PID

# Check health endpoint
curl -s http://127.0.0.1:3141/health | jq .

# Check logs for errors
tail -50 ~/.ari/logs/gateway-stdout.log
tail -50 ~/.ari/logs/gateway-stderr.log
```

## Step 13: Verify Telegram

1. Open Telegram → @ari_pryce_bot
2. Send `/status` → Should respond with system health
3. Send `/help` → Should list all commands
4. Send "hello" → Should respond in ARI's voice

## Post-Deployment Monitoring

```bash
# Watch live logs
tail -f ~/.ari/logs/gateway-stdout.log

# Check scheduler
curl -s http://127.0.0.1:3141/api/scheduler | jq .

# Check next scheduled tasks
curl -s http://127.0.0.1:3141/api/scheduler/next | jq .
```

## Rollback

If something goes wrong:

```bash
cd /Users/ari/ARI
git log --oneline -5  # Find last known good commit
git checkout <commit>
NODE_ENV=development npm run build
npx ari daemon stop && npx ari daemon start --production
```

## Common Issues

| Issue | Fix |
|-------|-----|
| `MODULE_NOT_FOUND` | `NODE_ENV=development npm install --ignore-scripts` |
| `better-sqlite3 error` | `cd node_modules/better-sqlite3 && npx node-gyp rebuild` |
| Daemon won't start | Check `~/.ari/logs/gateway-stderr.log` |
| Telegram not responding | Verify `TELEGRAM_BOT_TOKEN` in `.env` |
| API key missing | Check `~/.ari/.env` has all keys |
| Port 3141 in use | `lsof -ti:3141 | xargs kill` then restart |
