# Autonomous Operations

Proactive agent capabilities: scheduling, briefings, market intelligence, content pipeline, knowledge management.

## Components

| Component | Purpose |
|-----------|---------|
| agent.ts | Main autonomous loop, polls for tasks, registers all handlers |
| scheduler.ts | Cron-like task scheduling (30+ tasks) |
| briefings.ts | Morning/evening/weekly summaries |
| market-monitor.ts | Price tracking with rolling baselines + anomaly detection |
| investment-analyzer.ts | Portfolio analysis + opportunity scoring |
| notification-manager.ts | Priority-based notification routing with cooldowns |
| notification-router.ts | EventBus → notification channel routing |
| knowledge-index.ts | TF-IDF semantic search |
| knowledge-sources.ts | External source fetching |
| changelog-generator.ts | Daily git analysis |
| agent-spawner.ts | Worktree agent management |
| task-queue.ts | Prioritized task queue |
| intelligence-scanner.ts | Multi-source intelligence gathering |

## Scheduled Tasks

### Essential (run even in budget-reduce mode)

| Time | Task | Handler |
|------|------|---------|
| 06:00 | Intelligence Scan | `intelligence_scan` |
| 06:15 | Life Monitor Scan | `life_monitor_scan` |
| 07:00 | Morning Briefing | `morning_briefing` |
| 07:15 | Daily Digest Delivery | `daily_digest_delivery` |
| 07:30 | User Daily Brief | `user_daily_brief` |
| 09:15 (M-F) | Pre-Market Briefing | `market_premarket_briefing` |
| 16:15 (M-F) | Post-Market Briefing | `market_postmarket_briefing` |
| 19:00 | Changelog Generation | `changelog_generate` |
| 21:00 | Evening Summary | `evening_summary` |
| */15 | Agent Health Check | `agent_health_check` |

### Non-Essential

| Time | Task | Handler |
|------|------|---------|
| 00:00 (*/4h) | Market Background Collect | `market_background_collect` |
| 03:00 | Daily Backup | `backup_daily` |
| 06:00 | Initiative Comprehensive Scan | `initiative_comprehensive_scan` |
| 06:10 (M-F) | Career Scan | `career_scan` |
| 07:00 | Content Draft Generation | `content_daily_drafts` |
| 07:00 | Opportunity Daily Scan | `opportunity_daily` |
| 07:30 | Content Draft Delivery | `content_draft_delivery` |
| 08:00 | Knowledge Index (Morning) | `knowledge_index` |
| 09:10, 16:10 (M-F) | Portfolio Update | `portfolio_update` |
| 10:00 (Mon) | Model Evolution Review | `model_evolution` |
| 14:00 | Knowledge Index + Midday Check | `knowledge_index` / `initiative_midday_check` |
| 17:00 (Sun) | Weekly Memory Consolidation | `memory_weekly` |
| 18:00 (Sun) | Weekly Review + Market Analysis | `weekly_review` / `market_weekly_analysis` |
| 20:00 | Knowledge Index (Evening) | `knowledge_index` |
| 21:30 | Self-Improvement Analysis | `self_improvement_daily` |
| 22:00 | AI Council Nightly Review | `ai_council_nightly` |
| */60 | Git Sync | `git_sync` |

### Disabled (pending setup)

| Task | Handler | Reason |
|------|---------|--------|
| Gmail Ingestion | `gmail_ingest` | Pending IMAP configuration |
| E2E Daily Run | `e2e_daily_run` | Pending Playwright setup |

## Market Intelligence

Thresholds (Phase 1 — Feb 2026):
- Crypto: 7% daily / 15% weekly (BTC 7%, ETH 10%, SOL 10%)
- Stock: 3% daily / 8% weekly
- ETF: 2% daily / 5% weekly
- Flash crash: crypto >15%, stock >5% between checks = critical

## Integration with Main Loop

```typescript
// In agent.ts poll():
await this.scheduler.checkAndRun();
await this.processNextTask();
```

Skills: `/ari-daemon-ops`, `/ari-continuous-improvement`
