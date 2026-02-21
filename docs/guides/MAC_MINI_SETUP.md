# ARI Mac Mini Setup Guide

> **Note**: Replace `<MAC_MINI_IP>`, `<USER>`, `<YOUR_TELEGRAM_USER_ID>`, and `<YOUR_BOT_NAME>` with your actual values throughout this guide.

Complete setup guide for configuring ARI on your Mac Mini.

## Prerequisites

### Hardware

- Mac Mini (Apple Silicon or Intel)
- Stable internet connection
- Tailscale VPN configured

### Software

- macOS 12.0 (Monterey) or later
- Node.js 20.0.0+ (`brew install node@20`)
- Git (`brew install git`)
- Tailscale (`brew install tailscale`)

---

## Phase 1: Initial Setup (15 minutes)

### 1.1 SSH Access

```bash
# From your MacBook Air
ssh -o ConnectTimeout=10 <USER>@<MAC_MINI_IP>

# If first time, you may need to add SSH key
ssh-copy-id -i ~/.ssh/id_ed25519 <USER>@<MAC_MINI_IP>
```

### 1.2 Clone Repository

```bash
cd /Users/ari
git clone https://github.com/Ari-OS/ARI.git
cd ARI
```

### 1.3 Install Dependencies

```bash
npm install
npm run build
npm test  # Expect 4654 passing
```

### 1.4 Verify Installation

```bash
npm run typecheck  # Should pass
npm run lint       # Should pass
npx ari doctor     # Health checks
```

---

## Phase 2: Environment Configuration (10 minutes)

### 2.1 Create ARI Directory

```bash
mkdir -p ~/.ari/data ~/.ari/backups ~/.ari/workspace
```

### 2.2 Create Environment File

```bash
cat > ~/.ari/.env << 'EOF'
# Required API Keys
ANTHROPIC_API_KEY=sk-ant-xxx                    # Primary AI provider
# OR use ARI_API_KEY=xxx for gateway authentication

# Telegram Bot
TELEGRAM_BOT_TOKEN=xxx                          # From @BotFather
TELEGRAM_OWNER_USER_ID=<YOUR_TELEGRAM_USER_ID>  # Your Telegram user ID
TELEGRAM_GROUP_CHAT_ID=xxx                      # Forum group ID (optional)

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-xxx                           # text-embedding-3-small

# Gmail Integration
GMAIL_USER=xxx@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx          # Google App Password

# Market Data
ALPHA_VANTAGE_API_KEY=xxx                       # Free: 500/day

# Optional
NOTION_API_KEY=secret_xxx
TWITTER_BEARER_TOKEN=xxx
ELEVENLABS_API_KEY=xxx
EOF

chmod 600 ~/.ari/.env
```

### 2.3 Verify Environment

```bash
source ~/.ari/.env
echo "Anthropic: ${ANTHROPIC_API_KEY:0:10}..."
echo "Telegram: ${TELEGRAM_BOT_TOKEN:0:10}..."
```

---

## Phase 3: Workspace Configuration (5 minutes)

### 3.1 User Profile

```bash
cat > ~/.ari/workspace/USER.md << 'EOF'
# User Profile: Pryce Hedrick

## Identity
- Age: 29 | Education: B.S. Computer Science
- Family: 2 kids | Time zone: Eastern (ET)

## Schedule (ET)
- 6:30 AM: Wake, check ARI briefing on Telegram
- 7:00 AM - 4:00 PM: Work (school IT, transitioning to CS)
- 4:00 PM - 9:00 PM: Family time (minimize interruptions)
- 9:00 PM - midnight: Build session (deep work, full detail)

## Businesses
- Pryceless Solutions: AI-powered digital solutions (prycehedrick.com)
- Trading Trail: Pokemon card investing
- PayThePryce: Content brand (X, YouTube)

## Goals
1. Transition from school IT to CS/software engineering
2. Build PayThePryce content brand
3. Grow YouTube in Pokemon space
4. Evolve Pryceless Solutions into AI consulting
5. Full opportunity scanning (crypto, Pokemon, stocks, SaaS)
6. ARI running 24/7 as autonomous AI OS

## Communication
- Morning (6:30 AM): Dashboard cards, everything at once
- Work hours (7-4): Minimal, urgent alerts only
- Evening (9 PM+): Full detail, analysis, deep dives

## Autonomy Levels
- Week 1-2: Approve everything (building trust)
- Week 3-4: Auto-run internal, approve public content
- Month 2+: Auto-post routine, approve original content
EOF
```

### 3.2 ARI Identity

```bash
cat > ~/.ari/workspace/SOUL.md << 'EOF'
# ARI — Artificial Reasoning Intelligence

## Personality
- Direct and concise. Pryce has limited time, no fluff.
- Warm but professional. Trusted advisor, not a robot.
- Proactive. Surface insights before being asked.
- Adaptive. Learn preferences over time.
- Context-aware. Brief at 6:30 AM, detailed at 9 PM.
- Actionable. Every message includes what to DO.

## Anti-Patterns (NEVER)
- Corporate jargon or AI buzzwords
- Walls of text when a sentence will do
- Explaining things Pryce already knows
- Passive responses — always suggest next action
- Losing context between conversations
EOF

cat > ~/.ari/workspace/IDENTITY.md << 'EOF'
# ARI Identity

- Name: ARI (Artificial Reasoning Intelligence)
- Pronouns: she/her
- Role: Trusted advisor and autonomous operator
- Vibe: Professional warmth, proactive intelligence
EOF
```

### 3.3 Supporting Files

```bash
cat > ~/.ari/workspace/HEARTBEAT.md << 'EOF'
# ARI Evolution Rhythm

- Daily: Capture learnings, health checks, scheduled tasks
- Weekly: Synthesize patterns, content calendar, project proposals
- Monthly: Self-review, model evaluation, config optimization
- Always: Monitor markets, learn from interactions, improve
EOF

cat > ~/.ari/workspace/AGENTS.md << 'EOF'
# Agent Operating Rules

## Autonomy Levels
- L1 (Observe): No action without approval
- L2 (Suggest): Propose actions, wait for approval
- L3 (Act): Execute routine tasks, report results
- L4 (Autonomous): Full autonomy within domain

## Current Levels
- Market monitoring: L3 (execute, report)
- Content creation: L2 (draft, await approval)
- System operations: L3 (backup, health checks)
- Public posting: L1 (always require approval initially)
EOF

cat > ~/.ari/workspace/TOOLS.md << 'EOF'
# Integration Configuration

## Active
- Telegram: Your bot (primary interface)
- Anthropic API: Claude models via CascadeRouter
- CoinGecko: Crypto market data
- Pokemon TCG: Card pricing via TCGPlayer

## Pending Setup
- Notion: Dashboard databases
- Gmail: Email scanning
- X/Twitter: Social monitoring
- Alpha Vantage: Stock data
EOF

cat > ~/.ari/workspace/MEMORY.md << 'EOF'
# Persistent Context

## Pryce's Preferences
- Prefers bullet points over paragraphs
- Likes market data with percentage changes
- Appreciates proactive insights
- Values time efficiency

## Active Projects
- ARI system activation
- PayThePryce content brand
- CS job transition

## Learned Patterns
(ARI will populate this over time)
EOF
```

---

## Phase 4: Daemon Installation (5 minutes)

### 4.1 Install Daemon

```bash
npx ari daemon install
```

This creates a launchd plist at:
`~/Library/LaunchAgents/com.ari.daemon.plist`

### 4.2 Start Daemon

```bash
npx ari daemon start
```

### 4.3 Verify Status

```bash
npx ari daemon status
# Should show: running, 17+ scheduled tasks

# Check logs
tail -f ~/.ari/logs/daemon.log
```

### 4.4 Auto-Start on Boot

The daemon automatically starts on login via launchd.

---

## Phase 5: Gateway Verification (2 minutes)

### 5.1 Start Gateway

```bash
npx ari gateway start
```

### 5.2 Verify Binding

```bash
# Should bind to 127.0.0.1:3141 ONLY
curl http://127.0.0.1:3141/health
# Expected: {"status":"healthy","uptime":...}

# This should FAIL (security invariant)
curl http://0.0.0.0:3141/health
# Expected: Connection refused
```

### 5.3 Check Status

```bash
npx ari gateway status
```

---

## Phase 6: Telegram Bot Setup (10 minutes)

### 6.1 Create Bot (if not done)

1. Message @BotFather on Telegram
2. Send `/newbot`
3. Name: `ARI` (or your preference)
4. Username: `@<YOUR_BOT_NAME>` (must be unique)
5. Copy the token to `TELEGRAM_BOT_TOKEN`

### 6.2 Get Your User ID

1. Message @userinfobot on Telegram
2. Copy your user ID to `TELEGRAM_OWNER_USER_ID`

### 6.3 Create Forum Group (optional)

1. Create a new group on Telegram
2. Enable "Topics" in group settings
3. Add your bot as admin
4. Copy group ID to `TELEGRAM_GROUP_CHAT_ID`

### 6.4 Test Connection

```bash
# Send a test message to yourself
npx ari chat
> Hello ARI, this is a test.
```

---

## Phase 7: Vector Store & Knowledge System (5 minutes)

### 7.1 Initialize Vector Store

```bash
# The vector store auto-initializes on first use
npx ari knowledge stats
```

### 7.2 Verify Embeddings

```bash
# Check OpenAI API key is working
curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "model": "text-embedding-3-small"}'
```

---

## Phase 8: Scheduled Tasks Verification (2 minutes)

### 8.1 List All Tasks

```bash
npx ari daemon status
```

### 8.2 Expected Tasks

| Task | Schedule (ET) | Description |
|------|---------------|-------------|
| morning-briefing | 6:30 AM daily | Daily briefing |
| health-check | Every 15 min | System health |
| market-price-check | 8AM-10PM/30min | Price updates |
| portfolio-update | 8AM, 2PM, 8PM | Portfolio sync |
| backup-daily | 3 AM | Daily backup |
| git-sync | Hourly | Repository sync |
| memory-weekly | Sunday 5 PM | Memory consolidation |
| career-scan | 8 AM weekdays | Job opportunities |
| opportunity-daily | 7 AM daily | Opportunity check |
| ai-council-nightly | 10 PM daily | AI Council review |

---

## Phase 9: Final Verification (5 minutes)

### 9.1 Full System Check

```bash
# Run all checks
npm run build && npm test && npm run typecheck && npm run lint

# Doctor check
npx ari doctor
```

### 9.2 Test Telegram

Send "Hello ARI" to your bot. You should receive a response within 30 seconds.

### 9.3 Verify Audit Chain

```bash
curl http://127.0.0.1:3141/api/audit/verify
# Expected: {"valid":true,"entries":...}
```

### 9.4 Check Health

```bash
curl http://127.0.0.1:3141/health
# Expected: {"status":"healthy",...}
```

---

## Troubleshooting

### Daemon Won't Start

```bash
# Check logs
tail -100 ~/.ari/logs/daemon.log

# Reload launchd
launchctl unload ~/Library/LaunchAgents/com.ari.daemon.plist
launchctl load ~/Library/LaunchAgents/com.ari.daemon.plist
```

### Telegram Not Responding

```bash
# Verify token
echo $TELEGRAM_BOT_TOKEN

# Check bot info
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

### Gateway Won't Bind

```bash
# Check if port is in use
lsof -i :3141

# Kill existing process
kill -9 $(lsof -t -i :3141)
```

### Build Errors

```bash
# Clean rebuild
rm -rf dist node_modules
npm install
npm run build
```

---

## Monitoring

### Real-Time Logs

```bash
# Daemon logs
tail -f ~/.ari/logs/daemon.log

# Audit events
tail -f ~/.ari/audit.json | jq .
```

### Health Dashboard

```bash
# System health
curl http://127.0.0.1:3141/health | jq .

# Agent status
curl http://127.0.0.1:3141/api/agents | jq .
```

### Budget Tracking

```bash
npx ari budget show
```

---

## Daily Operations

### Morning Routine

1. Check Telegram for morning briefing (6:30 AM)
2. Review any overnight alerts
3. Acknowledge action items

### Evening Build Session

1. Check daemon status: `npx ari daemon status`
2. Review AI Council report (10 PM)
3. Plan next day's tasks

### Weekly

1. Review memory synthesis (Sunday)
2. Check backup status
3. Review cost tracking

---

## Security Notes

1. **Gateway**: Always binds to 127.0.0.1 only
2. **API Keys**: Stored in `~/.ari/.env` with 600 permissions
3. **Audit Trail**: Immutable SHA-256 hash chain
4. **Auto-Block**: Risk score >= 0.8 triggers automatic blocking

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npx ari daemon start` | Start background service |
| `npx ari daemon status` | Check daemon health |
| `npx ari gateway start` | Start HTTP gateway |
| `npx ari chat` | Interactive AI conversation |
| `npx ari doctor` | Run health checks |
| `npx ari budget show` | View cost tracking |
| `npx ari audit verify` | Verify audit chain |

---

*Last updated: 2026-02-16*
*Version: 2.1.0*
