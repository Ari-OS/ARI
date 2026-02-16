# Morning Start Feb 17 — Phoenix Blueprint Checklists

> Actionable checklists for implementing the Phoenix Blueprint phases.

## Start Here

**First 30 minutes**: Read `QUICK-START.md` and deploy to Mac Mini.

## File Structure

| File | Purpose | When to Use |
|------|---------|-------------|
| `QUICK-START.md` | 30-minute deployment guide | Today, first thing |
| `PHASE-A-CHECKLIST.md` | Morning briefing verification | Week 1 |
| `PHASE-B-CHECKLIST.md` | Intelligence integration | Week 2-3 |
| `WIRING-REFERENCE.md` | Technical integration guide | When wiring new features |
| `API-KEYS-SETUP.md` | Environment setup | Before deployment |
| `BUSINESS-LAUNCH-CHECKLIST.md` | Pryceless Solutions launch | Week 1 business setup |
| `CONTENT-LAUNCH-CHECKLIST.md` | PayThePryce content launch | Week 1 content setup |
| `MAC-MINI-DEPLOY.md` | Mac Mini deployment steps | Deployment day |

## Critical Corrections Applied

Based on codebase audit (6,574 tests passing):

- BriefingGenerator IS already instantiated (agent.ts:230)
- Morning briefing IS already scheduled at 7:00 AM (scheduler.ts:137)
- NotificationManager IS already wired (agent.ts:228-230)
- 37 autonomous components with 25 active handlers
- Mac Mini SSH: username is `ari` (NOT prycehedrick)
- IP: 100.81.73.34 (via Tailscale)

## The Real Gap

The morning briefing pipeline is FULLY wired. What needs verification:

1. ANTHROPIC_API_KEY is set in `~/.ari/.env`
2. NotificationManager routes to Telegram (not old SMS)
3. Telegram bot token and user ID are configured
4. Daemon starts and stays running
5. End-to-end delivery works

## Next Steps

1. Read `QUICK-START.md`
2. SSH to Mac Mini: `ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34`
3. Set ANTHROPIC_API_KEY
4. Deploy daemon
5. Verify morning briefing arrives tomorrow

## Spelling Enforcement

- Business: **Pryceless Solutions** (NOT "Priceless")
- Website: **prycehedrick.com** (NOT "pricehedrick.com")
- Brand: **PayThePryce** (one word)
- ARI pronouns: **she/her**
