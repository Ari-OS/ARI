# 24/7 Autonomous ARI - Quick Start Guide

## Pre-Deployment Checklist

Before deploying autonomous mode to your Mac Mini, ensure:

- [ ] Mac Mini is online and accessible via SSH (ari@100.81.73.34)
- [ ] Anthropic API key is configured in `~/.ari/autonomous.json` on Mac Mini
- [ ] Telegram bot configured (TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_USER_ID)
- [ ] Latest code is committed and pushed to GitHub
- [ ] All tests passing locally: `npm test`
- [ ] Budget profile selected: conservative, balanced, or aggressive

---

## One-Command Deployment

```bash
# Deploy with balanced budget (recommended)
./scripts/deploy-autonomous.sh balanced

# Or choose a profile:
./scripts/deploy-autonomous.sh conservative  # $1.50/day
./scripts/deploy-autonomous.sh balanced     # $2.50/day (recommended)
./scripts/deploy-autonomous.sh aggressive   # $5.00/day
```

The script will:
1. ✓ Verify connection to Mac Mini
2. ✓ Stash any local changes
3. ✓ Pull latest code from GitHub
4. ✓ Install dependencies
5. ✓ Build project
6. ✓ Deploy budget configuration
7. ✓ Update autonomous config
8. ✓ Restart daemon
9. ✓ Run diagnostics
10. ✓ Verify everything is working

**Deployment time:** ~3-5 minutes

---

## First 24 Hours - What to Expect

### Tonight (After Deployment)

**9:00 PM - Deployment complete**
- Daemon restarted with new budget tracking
- Autonomous mode enabled
- Waiting for first scheduled task

**10:00 PM - First observations**
- Check dashboard: Budget panel should show $0.00 used
- Audit log: Should show deployment events
- Everything quiet (as expected)

### Tomorrow Morning

**6:00 AM - Initiative Scan (First Autonomous Work)**
```
What happens:
├─ Initiative engine scans codebase
├─ Discovers 5-10 potential tasks
├─ Scores and prioritizes them
└─ Logs to audit trail

You'll see in audit log:
├─ initiative:scan_complete
├─ Tasks discovered: X
├─ Auto-executing: Y
└─ Cost: ~$0.09
```

**6:30 AM - Auto-Execution Begins**
```
What happens:
├─ Identifies low-risk, high-value tasks
├─ Executes 2-3 tasks in isolated worktrees
│  ├─ Example: Fix simple TODO in utils.ts
│  ├─ Example: Add tests for uncovered module
│  └─ Example: Update stale documentation
└─ Logs results

You'll see:
├─ initiative:executing (multiple)
├─ initiative:completed (if successful)
├─ Git branches created in worktrees
└─ Cost: ~$0.05-0.15
```

**7:00 AM - Morning Briefing Generation**
```
What happens:
├─ Analyzes overnight autonomous work
├─ Checks git status and recent commits
├─ Identifies today's priorities
└─ Generates structured brief

Cost: ~$0.06
```

**7:30 AM - Your Daily Brief is Ready**
```
Location: ~/.ari/briefs/brief-YYYY-MM-DD.md

Contains:
├─ Focus areas for today
├─ Overnight autonomous work summary
├─ High-priority action items
├─ Budget status
└─ Insights and recommendations

Reading time: 2-3 minutes
```

**Expected First Morning Cost:** ~$0.20-0.30

---

## Monitoring Tools

### 1. Real-Time Dashboard

```bash
# Local access (if on same network)
open http://100.81.73.34:3141/dashboard

# SSH tunnel (from anywhere)
ssh -i ~/.ssh/id_ed25519 -L 3141:localhost:3141 ari@100.81.73.34 -N

# Then open: http://localhost:3141/dashboard
```

**Panels you'll see:**
- Token Budget (real-time usage)
- Autonomous Work (active initiatives)
- Approval Queue (items needing review)
- System Health (daemon, gateway status)

### 2. Live Monitoring Script

```bash
# Watch in real-time (refreshes every 30s)
./scripts/monitor-mac-mini.sh

# Custom refresh interval (10s)
./scripts/monitor-mac-mini.sh 10
```

Shows:
- System uptime
- Daemon status
- Gateway health
- Budget usage (with color coding)
- Recent autonomous work
- Error count

### 3. Quick Budget Check

```bash
# Quick snapshot of budget
./scripts/check-budget-status.sh
```

Shows:
- Current usage
- Cost breakdown by model
- Top task types
- Projection for end of day

### 4. Audit Log

```bash
# View recent audit events
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 20"

# Live tail
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "tail -f ~/Library/Logs/ari-gateway.log"
```

---

## Daily Routine

### Morning (7:30-8:00 AM)

**1. Read Daily Brief**
```bash
# On Mac Mini (via SSH)
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "cat ~/.ari/briefs/brief-$(date +%Y-%m-%d).md"

# Or check dashboard
# Or get Telegram notification
```

**2. Review Overnight Work**
- Check what ARI completed autonomously
- Review any worktrees created
- Merge if satisfied, discard if not

**3. Check Budget Status**
```bash
./scripts/check-budget-status.sh
```

**Time required:** 5 minutes

### During Day (Work Hours)

**ARI runs autonomously:**
- Health checks every 15 minutes
- Opportunistic work (tests, TODOs, docs)
- Budget monitoring
- Only alerts on critical issues

**You work normally:**
- ARI stays out of your way
- Progress happening in background
- Check dashboard if curious

**Time required:** 0 minutes (autonomous)

### Evening (9:00-9:30 PM)

**1. Read Evening Summary**
```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34 "cat ~/.ari/summaries/summary-$(date +%Y-%m-%d).md"
```

**2. Review Approval Queue**
- Check items needing decision
- Quick approve/reject
- Dashboard or CLI

**3. Check Budget**
- See total usage for day
- Review cost breakdown
- Plan for tomorrow if needed

**Time required:** 5-10 minutes

---

## Common Commands

### Budget Management

```bash
# Check current budget status
./scripts/check-budget-status.sh

# View detailed usage breakdown
ssh ari@100.81.73.34 "cat ~/.ari/token-usage.json | jq"

# View historical usage (last 7 days)
ssh ari@100.81.73.34 "cat ~/.ari/token-usage-history.json | jq '.[-7:] | .[] | {date, cost: .totalCost}'"
```

### Initiative Management

```bash
# List discovered initiatives
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari initiatives list"

# View specific initiative
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari initiatives show <id>"

# Manually trigger initiative
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari initiatives execute <id>"
```

### Approval Queue

```bash
# List pending approvals
ssh ari@100.81.73.34 "cat ~/.ari/approval-queue.json | jq '.pending'"

# Approve item
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari approve <id> --note 'Approved via CLI'"

# Reject item
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari reject <id> --reason 'Not needed'"
```

### System Control

```bash
# Stop autonomous mode
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari daemon stop"

# Start autonomous mode
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari daemon start"

# Restart (apply new config)
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari daemon restart"

# Full system check
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari doctor"
```

---

## Troubleshooting

### Issue: Budget Exceeded Early in Day

**Symptoms:**
- Budget 95%+ used before 5 PM
- Autonomous work paused
- Alert received

**Diagnosis:**
```bash
# Check what consumed budget
./scripts/check-budget-status.sh

# Look for expensive tasks
ssh ari@100.81.73.34 "cat ~/.ari/token-usage.json | jq '.byTaskType | to_entries | sort_by(-.value.cost) | .[:10]'"
```

**Solutions:**
1. **Temporary:** Increase daily budget in config
2. **Permanent:** Identify expensive task and optimize:
   - Switch to cheaper model if possible
   - Reduce frequency
   - Batch multiple tasks
   - Improve prompt efficiency

### Issue: Morning Brief Not Generated

**Symptoms:**
- 8:00 AM, no brief file exists
- No notification received

**Diagnosis:**
```bash
# Check if scheduled task ran
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 50 | grep 'user_daily_brief'"

# Check scheduler status
ssh ari@100.81.73.34 "cat ~/.ari/scheduler-state.json | jq '.tasks[\"user-daily-brief\"]'"

# Check daemon logs
ssh ari@100.81.73.34 "tail -50 ~/Library/Logs/ari-gateway.log | grep -i 'brief\|error'"
```

**Solutions:**
1. **Task disabled:** Enable in scheduler
2. **Budget exhausted:** Check budget status
3. **Daemon stopped:** Restart daemon
4. **Error in handler:** Check logs, fix bug

### Issue: Too Many Approval Queue Items

**Symptoms:**
- 10+ items in approval queue
- Overwhelming to review

**Diagnosis:**
```bash
# Check queue
ssh ari@100.81.73.34 "cat ~/.ari/approval-queue.json | jq '.pending | length'"

# See what's queued
ssh ari@100.81.73.34 "cat ~/.ari/approval-queue.json | jq '.pending[] | {title, risk, cost: .estimatedCost}'"
```

**Solutions:**
1. **Bulk reject low-priority:**
   ```bash
   ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari approve bulk-reject --priority LOW"
   ```

2. **Increase autonomous threshold:**
   - Edit config: Lower risk threshold for auto-execution
   - More items execute automatically
   - Fewer require approval

3. **Auto-expire old items:**
   - Items older than 7 days auto-reject
   - Reduces queue buildup

### Issue: Mac Mini Out of Sync

**Symptoms:**
- Mac Mini code is behind GitHub
- Missing latest features
- Different behavior than local

**Diagnosis:**
```bash
# Check sync status
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && git fetch origin && git status"

# Compare commits
LOCAL=$(git rev-parse HEAD)
REMOTE=$(ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && git rev-parse HEAD")
echo "Local: $LOCAL"
echo "Remote: $REMOTE"
```

**Solution:**
```bash
# Re-run deployment (pulls latest)
./scripts/deploy-autonomous.sh balanced
```

### Issue: High Error Rate

**Symptoms:**
- Multiple errors in logs
- Tasks failing frequently
- Low success rate

**Diagnosis:**
```bash
# Count recent errors
ssh ari@100.81.73.34 "tail -500 ~/Library/Logs/ari-gateway.log | grep -i error | wc -l"

# View error messages
ssh ari@100.81.73.34 "tail -500 ~/Library/Logs/ari-gateway.log | grep -i error"

# Check audit log for failures
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 50 | grep 'failed'"
```

**Solutions:**
1. **Identify pattern:** What's failing?
2. **Fix root cause:** Update code, config, or routing rules
3. **Deploy fix:** Re-run deployment script
4. **Monitor:** Verify error rate drops

---

## Monitoring Cheat Sheet

### Quick Health Check (30 seconds)

```bash
# All-in-one status
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari doctor && echo '---' && cat ~/.ari/token-usage.json | jq '{tokens: .totalTokens, cost: .totalCost}'"
```

### Morning Check (2 minutes)

```bash
# 1. Read brief
ssh ari@100.81.73.34 "cat ~/.ari/briefs/brief-$(date +%Y-%m-%d).md"

# 2. Check budget
./scripts/check-budget-status.sh

# 3. Review overnight work
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari audit list -n 10 | grep initiative"
```

### Evening Review (5 minutes)

```bash
# 1. Read summary
ssh ari@100.81.73.34 "cat ~/.ari/summaries/summary-$(date +%Y-%m-%d).md"

# 2. Check approval queue
ssh ari@100.81.73.34 "cat ~/.ari/approval-queue.json | jq '.pending | length'"

# 3. Review day's costs
./scripts/check-budget-status.sh

# 4. Process approvals (if any)
# Via dashboard or CLI
```

---

## Configuration Changes

### Change Budget Profile

```bash
# Switch to conservative
./scripts/deploy-autonomous.sh conservative

# Switch to aggressive
./scripts/deploy-autonomous.sh aggressive
```

### Adjust Daily Budget Limit

```bash
# SSH to Mac Mini
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34

# Edit budget config
vi ~/.ari/budget-config.json

# Update maxCost and maxTokens
# Save and exit

# Restart daemon to apply
cd ~/ARI && npx ari daemon restart
```

### Enable/Disable Scheduled Tasks

```bash
# SSH to Mac Mini
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34

# Edit config
vi ~/.ari/autonomous.json

# Under scheduling.tasks, set enabled: false for tasks to disable

# Restart daemon
cd ~/ARI && npx ari daemon restart
```

---

## Emergency Procedures

### Runaway Costs Detected

```bash
# 1. IMMEDIATE: Stop autonomous mode
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari daemon stop"

# 2. Check what happened
./scripts/check-budget-status.sh
ssh ari@100.81.73.34 "cat ~/.ari/token-usage.json | jq '.byTaskType | to_entries | sort_by(-.value.cost) | .[:10]'"

# 3. Identify expensive task
# (look for task type with unexpectedly high cost)

# 4. Fix the issue:
# - Update model routing for that task type
# - Reduce frequency
# - Add better throttling
# - Disable task temporarily

# 5. Clear today's usage (if needed)
ssh ari@100.81.73.34 "echo '{\"date\":\"$(date +%Y-%m-%d)\",\"totalTokens\":0,\"totalCost\":0,\"byModel\":{},\"byTaskType\":{},\"resetAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}' > ~/.ari/token-usage.json"

# 6. Restart with lower budget
./scripts/deploy-autonomous.sh conservative

# 7. Monitor closely for 24 hours
./scripts/monitor-mac-mini.sh 10
```

### System Completely Broken

```bash
# 1. Stop everything
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari daemon stop"

# 2. Backup current state
ssh ari@100.81.73.34 "tar -czf ~/ari-backup-$(date +%Y%m%d).tar.gz ~/.ari"

# 3. Reset to clean state
ssh ari@100.81.73.34 "rm -rf ~/.ari/token-usage.json ~/.ari/agent-state.json ~/.ari/approval-queue.json"

# 4. Re-deploy from scratch
./scripts/deploy-autonomous.sh balanced

# 5. Verify
ssh ari@100.81.73.34 "source ~/.zshrc && cd ~/ARI && npx ari doctor"
```

### Mac Mini Unreachable

```bash
# 1. Check if Mini is online
ping -c 3 100.81.73.34

# 2. If offline, options:
#    a) Wait for it to come back online (power outage?)
#    b) Contact parents to check physical machine
#    c) Run ARI locally on MacBook Pro temporarily

# 3. When back online, verify sync
./scripts/deploy-autonomous.sh balanced
```

---

## Performance Benchmarks

### Expected Metrics After 1 Week

**Cost Performance:**
- [ ] Average daily cost: $0.50-1.50
- [ ] Peak daily cost: < $2.50
- [ ] 7-day total: < $17.50
- [ ] Model distribution: ~70% Haiku, ~25% Sonnet, ~5% Opus

**Task Performance:**
- [ ] Autonomous tasks completed: 70-140 (10-20 per day)
- [ ] Morning briefs delivered: 7/7 (100%)
- [ ] Evening summaries: 7/7 (100%)
- [ ] Initiative success rate: > 80%

**Quality Performance:**
- [ ] Tests added: 10-20
- [ ] TODOs resolved: 15-25
- [ ] Documentation updates: 2-5
- [ ] Code quality: measurably improved

**System Performance:**
- [ ] Daemon uptime: > 99%
- [ ] Gateway health: 100%
- [ ] Budget adherence: 95%+ days under limit
- [ ] Error rate: < 1%

### What Good Looks Like After 1 Month

```
Budget:
├─ Monthly cost: $50-70 (vs $75 budget)
├─ Efficiency improved: 20-30% from Week 1
├─ Model routing: Optimized based on learnings
└─ Zero budget overruns

Productivity:
├─ 300-400 autonomous tasks completed
├─ 40-60 tests added
├─ 60-90 TODOs resolved
├─ Documentation current
└─ Time saved: ~75 hours

Quality:
├─ Test coverage: +5-10%
├─ Code quality: measurably better
├─ Technical debt: decreasing
└─ Context: rich and persistent

User Experience:
├─ Morning brief: Perfect track record
├─ Approval queue: < 5 items always
├─ Noise level: Low (critical only)
└─ Satisfaction: High
```

---

## Week 1 Daily Checklist

Print this and track actual results:

```
┌─────────────────────────────────────────────────────────┐
│ Day 1 (Deployment Day)                                  │
├─────────────────────────────────────────────────────────┤
│ [ ] Deployment successful                               │
│ [ ] All diagnostics passing                             │
│ [ ] Budget tracking initialized                         │
│ [ ] First scheduled task runs (evening)                 │
│                                                         │
│ Cost: $_____ Notes: _____________________              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Day 2 (First Full Day)                                  │
├─────────────────────────────────────────────────────────┤
│ [ ] Morning brief delivered by 7:30 AM                  │
│ [ ] Initiative scan discovered work                     │
│ [ ] Autonomous tasks executed                           │
│ [ ] Evening summary generated                           │
│ [ ] Budget under $2.50                                  │
│                                                         │
│ Cost: $_____ Tasks: _____ Quality: ____/5              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Days 3-7 (Observation Period)                           │
├─────────────────────────────────────────────────────────┤
│ [ ] All morning briefs on time                          │
│ [ ] Autonomous work completing                          │
│ [ ] Budget staying under limit                          │
│ [ ] No critical errors                                  │
│ [ ] User satisfaction high                              │
│                                                         │
│ Avg Cost: $_____ Total Tasks: _____ Issues: _____      │
└─────────────────────────────────────────────────────────┘
```

---

## Success Indicators

### Green Flags (Everything Working Well)

✅ Morning brief ready by 7:30 AM every day  
✅ Budget consistently under $2/day  
✅ 70%+ API calls using Haiku  
✅ Autonomous tasks completing successfully  
✅ Approval queue < 5 items  
✅ No critical errors in logs  
✅ Tests being added automatically  
✅ User finding value in deliverables

### Yellow Flags (Needs Attention)

⚠️ Budget approaching 90% regularly  
⚠️ Approval queue backing up (>10 items)  
⚠️ Morning brief occasionally late  
⚠️ Some autonomous tasks failing  
⚠️ Higher Sonnet/Opus usage than expected

**Action:** Review and tune configuration

### Red Flags (Immediate Action Required)

🔴 Budget exceeded multiple days  
🔴 Daemon crashes frequently  
🔴 High error rate (>5% tasks failing)  
🔴 Morning brief missing multiple days  
🔴 Runaway costs detected

**Action:** Stop autonomous mode, investigate, fix root cause

---

## Optimization Tips

### Reduce Costs by 20-30%

**1. Batch Similar Tasks**
```
Instead of: 3 separate test generations (3 API calls)
Do: One batch with 3 test suites (1 API call with shared context)
Savings: ~60% on multi-task operations
```

**2. Cache Common Contexts**
```
Reuse: Project structure, coding patterns, common imports
How: Store in knowledge index, include in prompts
Savings: ~15% on token usage
```

**3. Tune Model Selection**
```
After 1 week: Review Haiku task failures
If <5%: Good, keep using Haiku
If >10%: Some tasks need Sonnet, adjust routing
```

**4. Reduce Schedule Frequency**
```
Knowledge indexing: 3x/day → 2x/day
Health checks: Every 15min → Every 30min
Savings: ~10% on scheduled tasks
```

**5. Optimize Prompts**
```
Use: Clear, concise instructions
Avoid: Redundant context, verbose explanations
Savings: ~10-15% per task
```

---

## Next Steps

1. **Review deployment plan** in `docs/plans/2026-02-03-24-7-autonomous-ari-with-cost-management.md`
2. **Choose budget profile**: Conservative, Balanced, or Aggressive
3. **Run deployment**: `./scripts/deploy-autonomous.sh balanced`
4. **Monitor first 24 hours**: Use monitoring tools
5. **Review and adjust**: After Week 1, tune configuration

---

## Support

**Documentation:**
- Architecture: `docs/architecture/24-7-autonomous-architecture.md`
- Cost analysis: `docs/analysis/cost-benefit-analysis.md`
- Implementation plan: `docs/plans/2026-02-03-24-7-autonomous-ari-with-cost-management.md`

**Scripts:**
- Deploy: `./scripts/deploy-autonomous.sh <profile>`
- Monitor: `./scripts/monitor-mac-mini.sh`
- Budget check: `./scripts/check-budget-status.sh`
- Sync only: `./scripts/sync-mac-mini.sh`

**Questions?**
- Check audit log for detailed operation history
- Review dashboard for real-time status
- Examine config files for current settings

---

Ready to deploy? Run:

```bash
./scripts/deploy-autonomous.sh balanced
```

Then wake up tomorrow to your first autonomous daily brief.
