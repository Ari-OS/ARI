# Phoenix Blueprint — Implementation Checklist

> **Version**: 2.1 (Corrected) | **Date**: February 16, 2026
> **Source**: docs/plans/PHOENIX-BLUEPRINT.md
> **Corrections**: Applied from codebase audit — see CORRECTIONS LOG in Blueprint

---

## Status Key

- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked / needs attention

---

## Phase A: Verify Morning Briefing (Days 1-2)

### Already Complete (From Codebase Audit)

- [x] BriefingGenerator class exists (`src/autonomous/briefings.ts`)
- [x] BriefingGenerator instantiated in autonomous agent (`agent.ts:230`)
- [x] Morning briefing handler registered (`agent.ts:751`)
- [x] Evening summary handler registered (`agent.ts:760`)
- [x] Weekly review handler registered (`agent.ts:768`)
- [x] NotificationManager created in agent startup (`agent.ts:228-230`)
- [x] NotificationRouter bridges events to Telegram (`notification-router.ts`)
- [x] Telegram sender operational (`integrations/telegram/sender.ts`)
- [x] 37 autonomous components, 25 active handlers

### Phase A Code Changes (Feb 16, 2026)

- [x] BriefingGenerator stores EventBus reference for event emissions
- [x] `morningBriefing()` emits `briefing:morning_delivered` event
- [x] `eveningSummary()` emits `briefing:evening_delivered` event
- [x] `weeklyReview()` emits `briefing:weekly_delivered` event
- [x] Evening summary now sends via Telegram (was Notion-only)
- [x] `briefing:weekly_delivered` event added to EventMap
- [x] Morning briefing changed from 7:00 AM to 6:30 AM (`scheduler.ts:139`)
- [x] `initNotion()` called from agent.ts when Notion config available
- [x] 9 new tests added (39 total in briefings.test.ts, 4,885 suite-wide)

### Remaining (Deployment Only)

- [ ] Verify ANTHROPIC_API_KEY set in `~/.ari/.env` on Mac Mini
- [ ] Verify TELEGRAM_BOT_TOKEN set in `~/.ari/.env`
- [ ] Verify TELEGRAM_OWNER_USER_ID set in `~/.ari/.env`
- [ ] Deploy daemon on Mac Mini (`npm run build && npx ari daemon install && npx ari daemon start`)
- [ ] Verify morning briefing arrives at 6:30 AM via Telegram
- [ ] Verify evening summary arrives at 9:00 PM via Telegram

---

## Phase B: Daily Intelligence (Week 2-3)

- [ ] Wire Intelligence Scanner output into morning briefing content
- [ ] Add X/Twitter open-call keywords to Intelligence Scanner config
- [ ] Leverage X Premium Plus for enhanced scanning
- [ ] Wire Life Monitor alerts into morning briefing
- [ ] Wire Career Tracker for daily 8:00 AM job scan
- [ ] Build evening summary with build session context for 9 PM
- [ ] Test all scheduled deliveries over 48 hours

---

## Phase C: Knowledge & Memory (Week 3-5)

- [ ] Wire Embedding Service to Vector Store
- [ ] Wire Ingestion Pipeline to Vector Store
- [ ] Wire RAG Query into response pipeline
- [ ] Wire Temporal Memory for nightly capture
- [ ] Test: `/ingest <URL>` via Telegram
- [ ] Test: knowledge query via Telegram
- [ ] Verify weekly memory synthesis (Sunday 5 PM)

---

## Phase D: Market Intelligence (Month 2-3)

- [ ] Wire Market Monitor to EventBus and Telegram alerts
- [ ] Wire Portfolio Tracker to morning briefing
- [ ] Wire Opportunity Scanner for weekly digest
- [ ] Wire Career Tracker for daily job scan with matching positions
- [ ] Configure Pokemon card price monitoring (TCGPlayer)
- [ ] Configure crypto monitoring (BTC, ETH)
- [ ] Test price spike alerts (>10% moves)

---

## Phase E: Content Pipeline (Month 3-4)

- [ ] Build Trend Scanner for topic suggestions
- [ ] Build Draft Generator for review queue
- [ ] Build Content Humanizer (detect/remove AI patterns)
- [ ] Build approval flow via Telegram
- [ ] Integrate with X Premium Plus posting
- [ ] Test content generation and approval cycle

---

## Phase F: AI Council (Month 4-5)

- [ ] Complete governance council voting logic (8 TODOs in council.ts)
- [ ] Build 6-agent nightly strategic review
- [ ] Configure 10:00 PM council run
- [ ] Route council summary to Telegram at 10:15 PM
- [ ] Test full council cycle

---

## Financial Checklist

### Month 1

- [ ] Swap ChatGPT Plus ($20) for Anthropic API credits ($20)
- [ ] Open separate business checking for Pryceless Solutions
- [ ] Begin Pokemon card inventory (2 weekends)
- [ ] Start emergency fund deposits ($500/mo from surplus)
- [ ] Set up Wave or QuickBooks for expense tracking
- [ ] Set aside tax reserve account (25-30% of business income)

### Month 2-3

- [ ] List Pokemon Tier B and C cards for sale
- [ ] Land first Pryceless Solutions client
- [ ] Emergency fund: $1,000 (Tier 1)
- [ ] Address fixer-upper Tier 1 safety items ($350-$1,100)

### Month 4-6

- [ ] Emergency fund: $2,500+ (Tier 2)
- [ ] Pryceless Solutions MRR: $1,000-$2,500
- [ ] Storage unit canceled (inventory moved home)
- [ ] Submit Pokemon grading batch to PSA
- [ ] Consider LLC formation if revenue > $3K/mo

---

## Career Transition Checklist

### Prep (Week 1-2)

- [ ] Polish ARI GitHub README with architecture diagrams
- [ ] Record 2-minute ARI demo video
- [ ] Update LinkedIn headline: "AI Systems Engineer | Building ARI"
- [ ] Update prycehedrick.com with portfolio page
- [ ] Write 1-2 blog posts about ARI on dev.to or Hashnode

### Apply (Week 3+)

- [ ] 5-10 applications/week on LinkedIn, Wellfound, Otta
- [ ] Target roles: AI Engineer, Backend Engineer, Platform Engineer
- [ ] Salary target: $75K-$120K (remote preferred)

### Interview Prep (Ongoing)

- [ ] LeetCode: 30 min/day, Easy+Medium (NeetCode 150)
- [ ] System design: Use ARI architecture for every question
- [ ] Prepare 5-7 STAR stories using ARI as backbone

---

## Content Launch Checklist

### Setup

- [ ] TikTok: @PayThePryce
- [ ] YouTube: PayThePryce channel
- [ ] X/Twitter: Leverage X Premium Plus
- [ ] Consistent bio across all platforms

### First Month Content

- [ ] 3 TikToks (ARI demo, Pokemon teaser, AI tip)
- [ ] 1 X thread: "I built a 90,000-line AI OS"
- [ ] 1 YouTube video (screen record build session)
- [ ] Daily X posting habit established

### X Premium Plus Strategy

- [ ] Enable revenue sharing
- [ ] Use longer post format (25K chars)
- [ ] Leverage Grok for trend research
- [ ] Use X Analytics for engagement tracking
- [ ] Post build-in-public updates daily

---

## Pryceless Solutions Launch Checklist

### Week 1

- [ ] Open business bank account
- [ ] Set up invoicing (Wave, free)
- [ ] Create service packages page on prycehedrick.com
- [ ] Write AI Business Audit template
- [ ] Draft consulting contract
- [ ] Text 20 people in network
- [ ] Identify 5 local businesses for free audits

### Month 1-3 (First Clients)

- [ ] Deliver 3-5 free AI audits
- [ ] Convert 1-2 to paid implementation ($500-$2,000)
- [ ] Create Upwork profile
- [ ] Start building case studies from results
- [ ] Target: $500-$2,000/month revenue

---

## ARI Workspace Files

### Location: `~/.ari/workspace/`

- [ ] SOUL.md — ARI personality definition
- [ ] USER.md — Pryce's operator profile
- [ ] IDENTITY.md — ARI identity definition
- [ ] HEARTBEAT.md — Daily/weekly/monthly rhythm
- [ ] AGENTS.md — Autonomy levels and approval rules
- [ ] TOOLS.md — Integration config and model routing
- [ ] MEMORY.md — Persistent context and preferences

---

## Mac Mini Deployment

- [ ] SSH verified: `ssh ari@100.81.73.34`
- [ ] API keys configured in `~/.ari/.env`
- [ ] Code pulled and built: `npm run build`
- [ ] All tests pass: `npm test` (4,885+)
- [ ] Daemon installed: `npx ari daemon install`
- [ ] Daemon running: `npx ari daemon start`
- [ ] Health check passing: `npx ari doctor`
- [ ] UPS purchased and connected ($50-$100)

---

## Verification Milestones

| Test | When | Pass Criteria |
|------|------|---------------|
| Morning briefing arrives | Day 1-2 | Telegram message at 6:30 AM with useful content |
| First Pokemon card sale | Month 1-2 | Money received from TCGPlayer/eBay |
| First Pryceless Solutions payment | Month 1-2 | Client pays for AI audit or implementation |
| First TikTok posted | Week 2 | Published and getting views |
| First X thread about ARI | Week 1 | Posted and getting engagement |
| $1,000 emergency fund | Month 2-3 | In savings account |
| ARI market monitor working | Month 2-3 | Receives Pokemon/crypto price alerts |
| First job interview | Month 2-3 | Technical interview scheduled |
| CS/SWE job offer | Month 4-6 | Written offer with salary and benefits |
| $5,000 emergency fund | Month 6-8 | Financial stability achieved |
| Pryceless Solutions MRR > $2,500 | Month 6 | Sustainable recurring revenue |

---

**The 3 Things That Matter Most:**

1. **Verify ARI's morning briefing works end-to-end** (this week)
2. **Land a CS/SWE job** ($60K+ doubles your surplus)
3. **Get your first paying client** (30 days)

Everything else flows from these three.

---
v2.1 | February 16, 2026
