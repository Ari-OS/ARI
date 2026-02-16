# 24/7 Autonomous ARI - Quick Reference Card

> **Note**: Replace `<USER>` and `<MAC_MINI_IP>` with your actual SSH username and Mac Mini IP address.

**Print this and keep it handy**

---

## Daily Commands

### Morning Routine (2 minutes)

```bash
# Check Mac Mini status
./scripts/check-budget-status.sh

# Read daily brief
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/briefs/brief-$(date +%Y-%m-%d).md"

# Or via dashboard
open http://localhost:3141/dashboard
```

### Evening Routine (5 minutes)

```bash
# Read evening summary
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/summaries/summary-$(date +%Y-%m-%d).md"

# Check approval queue
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/approval-queue.json | jq '.pending[] | {title, risk, cost}'"
```

---

## Emergency Commands

### Stop Everything

```bash
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari daemon stop"
```

### Check What's Wrong

```bash
# System diagnostics
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari doctor"

# Recent errors
ssh <USER>@<MAC_MINI_IP> "tail -50 ~/Library/Logs/ari-gateway.log | grep -i error"

# Budget status
./scripts/check-budget-status.sh
```

### Restart Fresh

```bash
# Full restart
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari daemon restart"

# Wait and verify
sleep 5
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari daemon status"
```

---

## Budget Status Quick Reference

### What the Percentages Mean

| Usage | Status | Action |
|-------|--------|--------|
| 0-79% | ✅ Healthy | Normal operations |
| 80-94% | ⚠️ Throttled | Non-essential work reduced |
| 95-99% | 🔴 Critical | Background work paused |
| 100%+ | 🔴 Emergency | Autonomous stopped |

### Daily Budget

- **Total:** 800k tokens ($2.50)
- **Your reserve:** 500k tokens
- **Autonomous:** 300k tokens

### Typical Usage

- **Good day:** 150-250k tokens ($0.45-0.75)
- **Average day:** 250-350k tokens ($0.75-1.10)
- **Heavy day:** 350-450k tokens ($1.10-1.40)

---

## Key Locations

### Configuration

```
~/.ari/autonomous.json          # Main autonomous config
~/.ari/budget-config.json       # Budget limits and model costs
~/.ari/autonomous-budget.json   # Runtime budget settings
```

### Data & State

```
~/.ari/token-usage.json         # Daily usage tracking
~/.ari/approval-queue.json      # Items needing approval
~/.ari/audit.json               # Complete audit trail
~/.ari/scheduler-state.json     # Scheduler state
```

### Deliverables

```
~/.ari/briefs/brief-YYYY-MM-DD.md           # Daily briefs
~/.ari/summaries/summary-YYYY-MM-DD.md      # Evening summaries
~/.ari/deliverables/                        # Other artifacts
```

### Logs

```
~/Library/Logs/ari-gateway.log              # Daemon output
~/.ari/audit.json                           # Audit trail
```

---

## Dashboard URLs

### Local Access

```
http://localhost:3141/dashboard            # If on Mac Mini directly
http://<MAC_MINI_IP>:3141/dashboard        # If on same network
```

### Remote Access (SSH Tunnel)

```bash
# Create tunnel
ssh -i ~/.ssh/id_ed25519 -L 3141:localhost:3141 <USER>@<MAC_MINI_IP> -N &

# Then open
open http://localhost:3141/dashboard

# Kill tunnel when done
killall ssh
```

---

## Scheduled Tasks Reference

| Time | Task | Model | Est. Cost |
|------|------|-------|-----------|
| 6:00 AM | Initiative scan | Sonnet | $0.09 |
| 6:30 AM | Auto-execution | Mixed | $0.05-0.15 |
| 6:30 AM | Morning briefing | Sonnet | $0.06 |
| 7:30 AM | Daily brief | Sonnet | $0.075 |
| 8:00 AM | Knowledge index | Haiku | $0.0035 |
| Every 15m | Health checks | Haiku | $0.0001 |
| 2:00 PM | Mid-day check | Haiku | $0.0035 |
| 7:00 PM | Changelog | Haiku | $0.0045 |
| 9:00 PM | Evening summary | Sonnet | $0.075 |
| 9:00 PM | Cognitive review | Sonnet | $0.105 |

**Daily scheduled cost:** ~$0.50-0.60

---

## Approval Queue Actions

### Via CLI

```bash
# List pending
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/approval-queue.json | jq '.pending'"

# Approve
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari approve <id>"

# Reject
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari reject <id> --reason 'Not needed'"
```

### Via Dashboard

1. Navigate to Approval Queue panel
2. Click Approve/Reject buttons
3. Add note/reason if required

---

## Troubleshooting Quick Fixes

### Morning Brief Missing

```bash
# Check if task ran
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari audit list | grep 'user_daily_brief'"

# Run manually
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari scheduler trigger user-daily-brief"
```

### Budget Exceeded

```bash
# Check what consumed it
./scripts/check-budget-status.sh

# Identify expensive task
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/token-usage.json | jq '.byTaskType | to_entries | sort_by(-.value.cost) | .[0]'"

# Adjust for tomorrow (if needed)
ssh <USER>@<MAC_MINI_IP> "vi ~/.ari/budget-config.json"
```

### Daemon Not Running

```bash
# Check status
ssh <USER>@<MAC_MINI_IP> "launchctl list | grep ari"

# Restart
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari daemon restart"

# If still fails, check logs
ssh <USER>@<MAC_MINI_IP> "tail -50 ~/Library/Logs/ari-gateway.log"
```

---

## Model Selection Reference

### When to Use Each Model

**Haiku (Fast & Cheap):**
- File scanning
- Pattern matching
- Health checks
- Simple parsing
- TODO extraction
- Changelog generation
- Knowledge queries

**Sonnet (Balanced):**
- Test generation
- Documentation
- Briefs and summaries
- Code quality analysis
- Initiative discovery
- Cognitive reviews
- Most day-to-day work

**Opus (Maximum Intelligence):**
- Architecture decisions
- Security reviews
- Complex refactoring
- Multi-file coordination
- High-risk operations
- User-facing deliverables (when quality critical)

---

## Budget Profiles Quick Comparison

| Profile | Daily Cost | Autonomous Work | User Reserve |
|---------|------------|-----------------|--------------|
| Conservative | $1.50 | Essential only | 300k tokens |
| **Balanced** ⭐ | **$2.50** | **Full suite** | **500k tokens** |
| Aggressive | $5.00 | Maximum | 1M tokens |

**Recommendation:** Start with Balanced, adjust based on actual usage.

---

## Key Metrics to Watch

### Daily

- [ ] Morning brief delivered by 7:30 AM
- [ ] Budget < 80% by 5 PM
- [ ] Autonomous tasks: 5-15 completed
- [ ] Approval queue: < 5 items

### Weekly

- [ ] Total cost: < $17.50
- [ ] Briefs delivered: 7/7
- [ ] Budget adherence: 6+/7 days
- [ ] User satisfaction: 4+/5

### Monthly

- [ ] Total cost: < $75
- [ ] Tasks completed: > 300
- [ ] Time saved: > 60 hours
- [ ] Quality improving: Measurable

---

## Contact Points

### Documentation

```
├─ Executive summary: docs/AUTONOMOUS_EXECUTIVE_SUMMARY.md
├─ Architecture: docs/architecture/24-7-autonomous-architecture.md
├─ Cost analysis: docs/analysis/cost-benefit-analysis.md
├─ Implementation: docs/plans/2026-02-03-24-7-autonomous-ari-with-cost-management.md
├─ Quick start: docs/operations/AUTONOMOUS_QUICKSTART.md
└─ This card: docs/QUICK_REFERENCE.md
```

### Scripts

```
├─ Deploy: ./scripts/deploy-autonomous.sh <profile>
├─ Sync: ./scripts/sync-mac-mini.sh
├─ Monitor: ./scripts/monitor-mac-mini.sh
└─ Budget check: ./scripts/check-budget-status.sh
```

### Support

- GitHub Issues: For bugs and feature requests
- Audit Log: For operational history
- Dashboard: For real-time status

---

## One-Liners for Common Tasks

```bash
# Quick health check
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari doctor"

# Budget snapshot
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/token-usage.json | jq '{tokens:.totalTokens, cost:.totalCost}'"

# Recent work
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 5"

# Pending approvals
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/approval-queue.json | jq '.pending | length'"

# Today's brief
ssh <USER>@<MAC_MINI_IP> "cat ~/.ari/briefs/brief-$(date +%Y-%m-%d).md"

# Live monitor
./scripts/monitor-mac-mini.sh 30

# Full deployment
./scripts/deploy-autonomous.sh balanced

# Emergency stop
ssh <USER>@<MAC_MINI_IP> "source ~/.zshrc && cd ~/ARI && npx ari daemon stop"
```

---

**Keep this reference handy for daily operations!**

Last updated: February 3, 2026
