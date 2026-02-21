# Budget System Specification

How ARI manages AI spending with per-provider costs, daily limits, and degradation.

## Budget Profiles

ARI supports three budget profiles, selectable at deployment:

| Profile | Daily Limit | Monthly Limit | Use Case |
|---------|-------------|---------------|----------|
| conservative | $1.00 | $30.00 | Minimal autonomous operation |
| balanced | $2.50 | $75.00 | Standard autonomous operation |
| aggressive | $5.00 | $150.00 | Active development periods |

The Mac Mini daemon defaults to `balanced`.

## Per-Provider Costs

Estimated per-request costs used for budget governance:

| Provider | Model | Input (per 1K tokens) | Output (per 1K tokens) | Typical Request |
|----------|-------|----------------------|----------------------|-----------------|
| Anthropic | Claude Sonnet 4.5 | $0.003 | $0.015 | ~$0.02 |
| Anthropic | Claude Haiku 4.5 | $0.0008 | $0.004 | ~$0.005 |
| OpenAI | GPT-4o | $0.0025 | $0.01 | ~$0.015 |
| OpenAI | GPT-4o-mini | $0.00015 | $0.0006 | ~$0.001 |
| xAI | Grok-3 | $0.003 | $0.015 | ~$0.02 |
| xAI | Grok-3-mini | $0.0003 | $0.0005 | ~$0.001 |
| OpenRouter | Various | Varies | Varies | Varies |

## Degradation Ladder

When spending approaches limits, ARI automatically degrades service:

```
100% ─┬── NORMAL
      │   All models available, full capability
      │
 80% ─┼── WARNING
      │   Log warning, prefer cheaper models
      │   Haiku/mini preferred over Sonnet/full
      │
 90% ─┼── REDUCE
      │   Only essential operations
      │   Skip non-critical scheduled tasks
      │   Batch notifications instead of individual
      │
 95% ─┼── PAUSE
      │   Pause autonomous operations
      │   Only respond to direct operator commands
      │   P1 alert sent to operator
      │
100% ─┴── STOPPED
          No AI operations until next period
          P0 alert sent to operator
```

## Throttle Behavior by Level

| Level | AI Operations | Scheduled Tasks | Notifications | Model Selection |
|-------|--------------|-----------------|---------------|-----------------|
| normal | All allowed | All run | Individual | Best fit |
| warning | All allowed | All run | Individual | Prefer cheaper |
| reduce | Essential only | Critical only | Batched | Cheapest available |
| pause | None | None | Emergency only | N/A |

## Essential Operations (Explicit List)

When the budget reaches `reduce` level, only these operations are allowed:

| Operation | Why It's Essential |
|-----------|-------------------|
| Respond to direct operator commands | The operator must always be able to control ARI |
| Health check responses | Monitoring must continue to detect failures |
| Security event processing | Threats don't pause for budgets |
| Audit logging | Constitutional requirement — never paused |
| P0/P1 alert delivery | Operator must know about critical issues |

**Everything else is non-essential** during brownout:

- Morning/evening briefings
- Autonomous task execution
- Proactive research
- Non-critical scheduled tasks
- Routine notifications (batched instead)

This list is intentionally short. "Essential" must not expand over time — if something isn't on this list, it waits until the budget resets.

## Cost Tracking

The `CostTracker` (`src/observability/cost-tracker.ts`) tracks:

- Per-request cost (input tokens + output tokens)
- Daily running total
- Monthly running total
- Cost by provider
- Cost by category (briefing, task, research, etc.)

## Spend Allocation

Typical daily spend breakdown for `balanced` profile ($2.50/day):

| Category | Allocation | Purpose |
|----------|-----------|---------|
| Morning briefing | ~$0.10 | Daily briefing generation |
| Evening summary | ~$0.10 | Daily summary |
| Autonomous tasks | ~$1.50 | Self-directed work |
| User requests | ~$0.50 | Responding to commands |
| Monitoring | ~$0.10 | Health checks, alerts |
| Reserve | ~$0.20 | Buffer for unexpected needs |

## Governance Integration

AI spending is governed by the AIPolicyGovernor:

| Cost | Governance Required | Mechanism |
|------|-------------------|-----------|
| < $0.005 | None | Auto-approved |
| $0.005 - $0.05 | Simple majority | Predicted voting (fast) |
| $0.05 - $0.25 | Weighted majority | Predicted voting (fast) |
| $0.25 - $1.00 | Supermajority | Full council deliberation |
| > $1.00 | Super-supermajority | Full council deliberation |

MINT (wealth) can veto any request > $0.50 in supermajority+ scenarios.
OPAL (resource_manager) can veto if estimated tokens > 100,000.

## Monitoring

Budget status is available via:

- Dashboard API: `GET /api/budget/status`
- CLI: `npx ari budget status`
- Script: `scripts/check-budget-status.sh`
- Mac Mini: `scripts/monitor-mac-mini.sh`

## Implementation

| File | Purpose |
|------|---------|
| `src/observability/cost-tracker.ts` | Cost tracking and throttle levels |
| `src/ai/ai-policy-governor.ts` | Spending governance via council |
| `src/autonomous/types.ts` | Budget profile schemas |
| `tests/unit/observability/cost-tracker.test.ts` | Cost tracker tests |

---

v1.0 - 2026-02-10
