# ARI Priority Message System — Design Document

**Date**: 2026-02-16 | **Status**: Design
**Author**: ARI | **Research**: Multi-agent analysis

---

## Problem Statement

ARI currently has **two parallel notification systems** (NotificationManager + AlertSystem) with:

- Static category-to-priority mapping (budget is always "high" regardless of context)
- Fire-and-forget delivery (no tracking of read/ack/resolve states)
- No delivery retry (if Telegram API fails, notification is lost)
- No dynamic priority scoring based on user engagement or context
- No inline keyboard interaction in Telegram
- Fragmented morning notifications (now unified in Phase B, but priority logic is ad-hoc)

## Design Goals

1. **Single unified pipeline** replacing the dual NotificationManager/AlertSystem
2. **Multi-factor priority scoring** that adapts to context and user behavior
3. **Notification lifecycle tracking** (created → sent → read → acknowledged → resolved)
4. **Telegram-native UX** with inline keyboards, expandable quotes, message editing
5. **Target: 2-5 proactive messages/day** (morning + evening + 0-3 reactive)

---

## Architecture: 7-Stage Pipeline

```
[EventBus / Direct Call]
        |
  ┌─────v──────┐
  │  INGEST     │  Normalize event → NotificationRecord
  └─────┬──────┘
        |
  ┌─────v──────┐
  │  ENRICH     │  Add context (time, user state, recent history)
  └─────┬──────┘
        |
  ┌─────v──────┐
  │  SCORE      │  Multi-factor priority scoring → P0-P4
  └─────┬──────┘
        |
  ┌─────v──────┐
  │  DEDUP      │  Match dedupKey, group related, suppress dupes
  └─────┬──────┘
        |
  ┌─────v──────┐
  │  ROUTE      │  Select channels based on priority + time + preferences
  └─────┬──────┘
      / | \
  ┌──v┐┌v─┐┌v──┐
  │TG ││SM││NOT│  Channel adapters with retry + DLQ
  └──┬┘└┬─┘└┬──┘
      \ | /
  ┌─────v──────┐
  │  TRACK      │  Record delivery, update state, check escalation
  └────────────┘
```

**Key insight**: This is NOT a rewrite. It's an evolution of the existing NotificationManager. Each stage maps to existing code that gets enhanced.

---

## Priority Scoring Formula

### Multi-Factor Score

```
Score = (Urgency × 0.30) + (Impact × 0.25) + (TimeSensitivity × 0.20)
      + (UserRelevance × 0.15) + (ContextModifier × 0.10)
```

All factors normalized to [0, 1]. ContextModifier can be [-0.5, 0.5].

### Score → Priority Level

| Score Range | Level | Behavior |
|-------------|-------|----------|
| >= 0.80 | **P0** | Immediate, all channels, bypasses quiet hours |
| >= 0.60 | **P1** | Push notification with sound during active hours |
| >= 0.40 | **P2** | Silent push during active hours |
| >= 0.20 | **P3** | Batch into next digest |
| < 0.20 | **P4** | Log only, never push |

### Category Defaults

| Category | Urgency | Impact | TimeSens. | Decay | Default P |
|----------|---------|--------|-----------|-------|-----------|
| security | 1.0 | 1.0 | 1.0 | perishable | P0 |
| error | 0.7 | 0.7 | 0.7 | short | P1 |
| budget | 0.6 | 0.7 | 0.5 | day | P1 |
| opportunity | 0.8 | 0.6 | 0.9 | perishable | P1 |
| question | 0.7 | 0.5 | 0.6 | short | P1 |
| career | 0.4 | 0.5 | 0.5 | short | P2 |
| market | 0.6 | 0.5 | 0.8 | perishable | P2 |
| finance | 0.5 | 0.7 | 0.4 | day | P2 |
| reminder | 0.5 | 0.4 | 0.7 | short | P2 |
| task | 0.3 | 0.3 | 0.3 | day | P3 |
| daily | 0.3 | 0.3 | 0.3 | day | P2 |
| milestone | 0.2 | 0.3 | 0.1 | persistent | P3 |
| insight | 0.2 | 0.4 | 0.1 | persistent | P3 |
| system | 0.3 | 0.3 | 0.2 | day | P3 |
| billing | 0.4 | 0.5 | 0.4 | day | P2 |
| value | 0.1 | 0.2 | 0.1 | persistent | P4 |
| adaptive | 0.1 | 0.3 | 0.1 | persistent | P4 |

### Context Modifiers

| Condition | Modifier | Rationale |
|-----------|----------|-----------|
| Escalation (prior no-response) | +0.1 per level (max +0.3) | Repeated alerts need attention |
| Recent similar notification | -0.2 | Reduce fatigue from same issue |
| Deep work hours (9PM-midnight) | -0.15 for non-urgent | Protect build time |
| Weekend + non-critical | -0.1 | Respect family time |
| User high engagement with category | +0.1 | They care about this |
| User low engagement with category | -0.1 | They don't care about this |

### Priority Decay

Notifications that sit unresolved decay in priority over time:

| Decay Profile | Half-Life | Used For |
|---------------|-----------|----------|
| perishable | 30 min | Market moves, security, flash sales |
| short | 4 hours | Errors, questions, career matches |
| day | 24 hours | Budget warnings, tasks, billing |
| persistent | 7 days | Insights, milestones, value |

Formula: `currentScore = originalScore × e^(-0.693 × age / halfLife)`

---

## Channel Routing Matrix

| Priority | Active Hours (7AM-10PM) | Quiet Hours (10PM-7AM) |
|----------|------------------------|------------------------|
| **P0** | Telegram (sound) + SMS + Notion | Telegram (sound) + SMS + Notion |
| **P1** | Telegram (push) + Notion | Queue → 7AM batch |
| **P2** | Telegram (silent) + Notion | Queue → morning digest |
| **P3** | Notion only (batched) | Queue → morning digest |
| **P4** | Log file only | Log file only |

---

## Notification Lifecycle States

```
CREATED → QUEUED → SENDING → SENT → READ → ACKNOWLEDGED → RESOLVED
                     |                         |
                     +→ FAILED → DEAD_LETTER   +→ ESCALATED
                     |                                |
                     +→ DEDUPLICATED                  v
                     |                          (bump priority, re-deliver)
                     +→ SUPPRESSED (cooldown)
                     |
                     +→ EXPIRED (TTL)
```

---

## Telegram UX Enhancements

### Inline Keyboards (Biggest UX Gap)

Every notification above P3 gets action buttons:

| Category | Buttons |
|----------|---------|
| error/security | `[Details] [Acknowledge]` |
| budget | `[Full Breakdown] [OK]` |
| opportunity/career | `[More Info] [Save] [Skip]` |
| question | Dynamic option buttons |
| morning briefing | `[Full Digest] [Today's Tasks]` |

### Expandable Block Quotes

Use `<blockquote expandable>` (Bot API 7.3+) for detailed sections:

- Morning briefing: headlines visible, detailed market data expandable
- Error alerts: summary visible, stack trace expandable
- Career matches: top 2 visible, remaining expandable

### Message Editing (Not New Messages)

Edit in place for:

- Budget progress bars (update as spend changes)
- Long-running task status (processing → done)
- Market price updates within same time window

### Topic Organization (5 Topics)

| Topic | Color | Categories Mapped |
|-------|-------|-------------------|
| Daily Briefings | Purple | daily, milestone, insight, task, reminder, value, adaptive |
| Market Alerts | Gold | finance, market, billing |
| System | Pink | error, security, system, budget, question |
| Opportunities | Green | opportunity, career |
| ARI Chat | Blue | Interactive conversation (General topic) |

---

## Pryce's Daily Schedule Integration

| Time | ARI Action | Priority | Sound |
|------|-----------|----------|-------|
| 6:30 AM | Unified morning briefing | P2 | Sound ON |
| 8:00 AM | Career scan (only 90%+ matches) | P1 (conditional) | Sound ON |
| 12:00 PM | Midday check (only if urgent) | P2 | SILENT |
| 7:00 PM | Evening prep context | P2 | SILENT |
| 9:00 PM | Build session context | P3 | SILENT |
| As-needed | P0/P1 reactive alerts | P0-P1 | Per matrix |

**Target: 2-5 messages/day** (2 guaranteed + 0-3 conditional)

---

## Cooldown Refinements

| Category | Current | Recommended | Rationale |
|----------|---------|-------------|-----------|
| error | 5 min | 5 min | Keep — errors need fast response |
| security | 0 | 0 | Keep — always immediate |
| opportunity | 0 | 15 min | Add cooldown — reduce opportunity spam |
| milestone | 30 min | 120 min | Increase — nice-to-know, not urgent |
| insight | 60 min | 360 min | Increase — max 2-3/day |
| question | 0 | 0 | Keep — ARI needs input |
| finance | 30 min | 60 min | Increase — reduce noise |
| task | 15 min | 30 min | Increase — batch more |
| system | 60 min | 120 min | Increase — background info |
| budget | 60 min | 120 min | Increase — reduce fatigue |

---

## Implementation Phases

### Phase 1: Priority Scoring Engine (Day 1-2)

- Add `priority-scorer.ts` with multi-factor scoring
- Replace static `CATEGORY_PRIORITIES` mapping in NotificationManager
- Add category defaults table
- Wire into existing `notify()` flow
- Tests for all scoring scenarios

### Phase 2: Notification Lifecycle (Day 2-3)

- Add state machine to NotificationRecord
- Track delivery attempts per channel
- Add retry queue with exponential backoff (3 attempts)
- Persist notification history to `~/.ari/notifications/`
- Tests for state transitions

### Phase 3: Telegram Inline Keyboards (Day 3-4)

- Add `InlineKeyboard` support to TelegramSender
- Add callback query handler in bot.ts
- Implement ack/dismiss/details/snooze actions
- Add expandable block quotes to briefings
- Tests for keyboard generation and callback handling

### Phase 4: Smart Batching & Grouping (Day 4-5)

- Add `groupKey` support to NotificationRecord
- Implement notification grouping (3 budget alerts → 1 summary)
- Add auto-resolution (4h timeout for non-critical)
- Update cooldowns to recommended values
- Tests for grouping and auto-resolution

### Phase 5: Engagement Tracking & Feedback (Day 5-6)

- Track read/ack rates per category
- Feed engagement data into UserRelevance scoring
- Add "Send fewer like this" callback button
- Priority decay implementation
- Tests for engagement tracking

### Phase 6: Unify AlertSystem (Day 6-7)

- Merge council voting from alert-system.ts into scoring stage
- Remove AlertSystem as separate entity
- Single pipeline handles everything
- Full integration tests

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/autonomous/priority-scorer.ts` | Multi-factor scoring engine |
| `src/autonomous/notification-lifecycle.ts` | State machine + persistence |
| `src/autonomous/notification-grouper.ts` | Dedup + grouping logic |
| `tests/unit/autonomous/priority-scorer.test.ts` | Scoring tests |
| `tests/unit/autonomous/notification-lifecycle.test.ts` | Lifecycle tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/autonomous/notification-manager.ts` | Wire scoring, lifecycle, retry |
| `src/autonomous/notification-router.ts` | Add missing event subscriptions |
| `src/autonomous/message-formatter.ts` | Priority-aware formatting |
| `src/integrations/telegram/sender.ts` | InlineKeyboard support |
| `src/plugins/telegram-bot/bot.ts` | Callback query handler |
| `src/autonomous/briefings.ts` | Expandable block quotes |
| `src/kernel/types.ts` | Unified priority types |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Daily proactive messages | 2-5 (not exceeding 7) |
| P0 delivery time | < 5 seconds |
| Notification delivery success rate | > 99% (with retry) |
| User engagement rate (ack/read) | > 60% |
| False positive rate (ignored notifications) | < 20% |
| Morning briefing delivery | 100% at 6:30 AM |

---

## What This Replaces

| Current | After |
|---------|-------|
| Static priority mapping | Multi-factor dynamic scoring |
| Fire-and-forget delivery | Lifecycle tracking with retry |
| No user feedback | Engagement-based relevance |
| 2 parallel systems (NotificationManager + AlertSystem) | 1 unified pipeline |
| Text-only Telegram | Inline keyboards + expandable quotes |
| Fixed cooldowns | Context-aware cooldowns |
| No grouping | Smart grouping by dedupKey |

---

*Synthesized from 5 parallel research teams analyzing: notification priority best practices, ARI codebase audit, smart routing algorithms, Telegram bot UX, and production notification architectures.*
