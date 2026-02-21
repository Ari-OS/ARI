# Mac Mini ARI Deployment Guide

> SSH user: **ari** (NEVER prycehedrick)
> IP: `100.81.73.34` (Tailscale)
> Key: `~/.ssh/id_ed25519`
> Repo: `/Users/ari/ARI`

## Quick Connect Test

```bash
ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34 "echo connected"
```

---

## Phase 0: Deploy Code Changes (Run After Each Local Commit)

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  source ~/.zprofile 2>/dev/null;
  cd /Users/ari/ARI &&
  git pull &&
  NODE_ENV=development npm install --ignore-scripts &&
  cd node_modules/better-sqlite3 && npx node-gyp rebuild; cd /Users/ari/ARI &&
  NODE_ENV=development npm run build &&
  echo '✅ Deploy complete'
"
```

## Phase 0: Restart Daemon After Deploy

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  launchctl unload ~/Library/LaunchAgents/com.ari.gateway.plist 2>/dev/null;
  sleep 2;
  launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist;
  sleep 3;
  launchctl list | grep ari
"
```

Expected: A PID number (not `-`).

## First-Time Daemon Install (Only Once)

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  cd /Users/ari/ARI &&
  node dist/cli/index.js daemon install
"
```

---

## Verify Morning Briefing

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  cd /Users/ari/ARI &&
  node dist/cli/index.js autonomous trigger morning-briefing
"
```

Expected: Telegram message received at @ari_pryce_bot within 30 seconds.

---

## Check Daemon Logs

```bash
# Live logs
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "tail -f /Users/ari/.ari/logs/ari.log"

# Last 50 lines
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "tail -50 /Users/ari/.ari/logs/ari.log"

# Error log
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "tail -50 /Users/ari/.ari/logs/ari-error.log"
```

---

## Check Environment Variables on Mac Mini

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "cat ~/.ari/.env"

# Count vars (should be 25+):
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "grep -c '=' ~/.ari/.env"
```

## Add Missing Env Vars to Mac Mini

```bash
# Edit .env on Mac Mini:
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "nano ~/.ari/.env"

# Or append a specific var:
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "echo 'PERPLEXITY_API_KEY=pplx-xxx' >> ~/.ari/.env"
```

---

## Full Deploy + Verify Script (copy-paste this)

```bash
#!/bin/bash
set -e
HOST="ari@100.81.73.34"
KEY="$HOME/.ssh/id_ed25519"
SSH="ssh -o ConnectTimeout=10 -i $KEY"

echo "=== Pulling latest code ==="
$SSH $HOST "source ~/.zshrc 2>/dev/null; cd /Users/ari/ARI && git pull"

echo "=== Installing dependencies ==="
$SSH $HOST "source ~/.zshrc 2>/dev/null; cd /Users/ari/ARI && NODE_ENV=development npm install --ignore-scripts"

echo "=== Rebuilding native modules ==="
$SSH $HOST "source ~/.zshrc 2>/dev/null; cd /Users/ari/ARI/node_modules/better-sqlite3 && npx node-gyp rebuild" || echo "Skip rebuild (no changes)"

echo "=== Building TypeScript ==="
$SSH $HOST "source ~/.zshrc 2>/dev/null; cd /Users/ari/ARI && NODE_ENV=development npm run build"

echo "=== Restarting daemon ==="
$SSH $HOST "launchctl unload ~/Library/LaunchAgents/com.ari.gateway.plist 2>/dev/null; sleep 2; launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist; sleep 3; launchctl list | grep ari"

echo "=== Triggering test briefing ==="
$SSH $HOST "source ~/.zshrc 2>/dev/null; cd /Users/ari/ARI && node dist/cli/index.js autonomous trigger morning-briefing"

echo "=== Done! Check Telegram for briefing ==="
```

Save as `scripts/deploy-mac-mini.sh` and run `chmod +x scripts/deploy-mac-mini.sh`.

---

## Phase 0 Workspace Fixes (Run on Mac Mini)

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  # Fix G12 — wrong family member name
  grep -n 'Declan' ~/.ari/workspace/MEMORY.md &&
  sed -i '' 's/Son Declan/Kai (son, 3)/g' ~/.ari/workspace/MEMORY.md &&
  echo '✅ Fixed Declan → Kai'

  # Verify family info correct:
  grep -i 'kai\|portland\|partner' ~/.ari/workspace/MEMORY.md
"
```

---

## Troubleshooting

### Daemon won't start (exit code -)

```bash
# Check if port is in use:
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "lsof -i :3000"

# Check plist exists:
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "ls ~/Library/LaunchAgents/ | grep ari"

# Re-install daemon:
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  cd /Users/ari/ARI &&
  node dist/cli/index.js daemon uninstall 2>/dev/null;
  node dist/cli/index.js daemon install
"
```

### better-sqlite3 crashes

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  cd /Users/ari/ARI/node_modules/better-sqlite3 &&
  npx node-gyp rebuild
"
```

### TypeScript build fails with NODE_ENV=production

Always use `NODE_ENV=development` on Mac Mini:

```bash
# Wrong:
npm run build

# Correct:
NODE_ENV=development npm run build
```

### npm install fails with husky error

Always use `--ignore-scripts`:

```bash
# Wrong:
npm install

# Correct:
NODE_ENV=development npm install --ignore-scripts
```

---

## Environment Variables Required (All 29 phases)

```bash
# Core (required NOW for daemon to start)
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_USER_ID=
TELEGRAM_ALLOWED_USER_IDS=

# Notion (required for briefings + tasks)
NOTION_API_KEY=
NOTION_INBOX_DATABASE_ID=
NOTION_DAILY_LOG_PARENT_ID=
NOTION_TASKS_DATABASE_ID=

# Market intelligence
ALPHA_VANTAGE_API_KEY=
COINGECKO_API_KEY=
PERPLEXITY_API_KEY=

# RAG & embeddings (Phase 4)
OPENAI_API_KEY=

# Video pipeline (Phase 1)
HEYGEN_API_KEY=
ASSEMBLYAI_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=      # generate: npx ari youtube:auth

# Observability (Phase 8)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=

# Social & content (Phase 23)
X_BEARER_TOKEN=
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Voice (Phase 10)
ELEVENLABS_API_KEY=

# Financial (Phase 18)
STRIPE_SECRET_KEY=

# Video alternatives (Phase 27)
SEEDANCE_API_KEY=
FAL_AI_API_KEY=

# Food journal (Phase 21)
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
```

---

## Model Selection Guide (Which Claude Model for What)

| Task | Use | Why |
|------|-----|-----|
| Phase 0-2 bug fixes | Sonnet 4.6 (1M) | 1M context = sees all 351 files |
| Phase 3 Telegram NLU | Sonnet 4.6 (1M) | Large bot.ts + all commands visible |
| Phase 4 RAG architecture | **Opus 4.6** | Complex architectural reasoning |
| Phase 9 agent coordination | **Opus 4.6** | Nuanced multi-agent design |
| Phase 13 governance council | **Opus 4.6** | 15-voice constitutional design |
| Simple bug fixes | Haiku 4.5 | Speed + cost |
| Morning briefing generation | Sonnet 4.6 | Balance of speed + quality |
| Video script writing | Opus 4.6 | Best creative quality |
| Market analysis | Sonnet 4.6 | Speed matters for real-time |

**Rule:** Bug fixes → Sonnet 4.6 (1M). Architecture decisions → Opus 4.6. Fast/cheap tasks → Haiku 4.5.

---

## Run Tests on Mac Mini

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "
  source ~/.zshrc 2>/dev/null;
  cd /Users/ari/ARI &&
  NODE_ENV=development npm test -- --reporter=verbose 2>&1 | tail -20
"
```

---

## Check Workspace Files (ARI's Identity)

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "ls ~/.ari/workspace/"
# Should show: SOUL.md IDENTITY.md USER.md GOALS.md PREFERENCES.md
#              AGENTS.md HEARTBEAT.md MEMORY.md TOOLS.md
```

---

*Last updated: 2026-02-17*
*Mac Mini SSH user: ari (NOT prycehedrick)*
*Plan: docs/plans/2026-02-17-master-implementation-plan-v12.md*
