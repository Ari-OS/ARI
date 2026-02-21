# Quick Start — Phase A Implementation

> First 30 minutes. Get ARI's morning briefing verified on Telegram.

## Pre-Flight Check

- [ ] Verify Mac Mini is reachable: `ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34`
- [ ] Source shell: `source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null`
- [ ] Verify repo: `cd /Users/ari/ARI && git status`

## Step 1: Verify Current State

Morning briefing is ALREADY wired:

- `src/autonomous/agent.ts:230` — BriefingGenerator instantiated
- `src/autonomous/scheduler.ts:139` — Scheduled at 6:30 AM (`30 6 * * *`)
- Handler registered at `agent.ts:751`

What needs verification:

1. Does NotificationManager route to Telegram (not old SMS)?
2. Is the ANTHROPIC_API_KEY set in `~/.ari/.env`?
3. Does the daemon start and stay running?

## Step 2: Set API Key

```bash
# On Mac Mini
echo 'ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE' >> ~/.ari/.env
```

## Step 3: Build and Test

```bash
cd /Users/ari/ARI
git pull origin main
npm install --ignore-scripts
npm run build
npm test
```

## Step 4: Deploy Daemon

```bash
npx ari daemon install
npx ari daemon start
npx ari daemon status
```

## Step 5: Verify

- [ ] `npx ari doctor` shows all green
- [ ] Morning briefing arrives on Telegram at 6:30 AM
- [ ] Evening summary arrives at 9:00 PM
- [ ] Health checks running every 15 minutes

## If Briefing Time Needs Changing

Morning briefing is already set to 6:30 AM in `src/autonomous/scheduler.ts` line 139:

```typescript
cron: '30 6 * * *', // 6:30 AM daily
```
