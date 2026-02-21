# ARI Notification Strategy

> Comprehensive multi-channel notification system optimizing for signal-to-noise ratio, respecting attention, and ensuring critical items never get missed.

## Philosophy

**Core Principle:** Every notification should earn its interruption.

- **SMS** = "Drop everything" — reserved for true urgency
- **Notion** = "When you have a moment" — the async inbox
- **Silence** = Valid response for low-priority items

---

## Channels

### Channel 1: SMS (Text Message)

**Characteristics:**

- Immediate delivery
- Interrupts whatever you're doing
- Limited to ~160 characters
- No formatting, no links
- Can't be unseen

**Best for:**

- Time-sensitive emergencies
- Binary decisions needed NOW
- System failures
- Security alerts

**Never use for:**

- Status updates
- Summaries
- Progress reports
- Anything that can wait 1 hour

### Channel 2: Notion

**Characteristics:**

- Persistent, searchable
- Rich formatting, links, embeds
- Non-interruptive (unless Notion notifications on)
- Can be organized, tagged, filtered
- History preserved

**Best for:**

- Daily briefings
- Project updates
- Documentation
- Task lists
- Meeting notes
- Anything requiring context

---

## Priority Matrix

| Priority | Name | SMS | Notion | Response Time Expected | Examples |
|----------|------|-----|--------|------------------------|----------|
| **P0** | Critical | ✅ Immediate | ✅ Log | < 5 minutes | System down, security breach, data loss risk |
| **P1** | Urgent | ✅ Immediate | ✅ Log | < 1 hour | Build failed, payment failed, deadline today |
| **P2** | Important | ❌ No | ✅ Immediate | < 4 hours | Task completed, PR ready, meeting reminder |
| **P3** | Normal | ❌ No | ✅ Batched | < 24 hours | Progress update, weekly summary |
| **P4** | Low | ❌ No | ✅ Batched | When convenient | FYI, logs, metrics |

---

## Time-Based Rules

### Quiet Hours (10 PM - 7 AM)

| Priority | Behavior |
|----------|----------|
| P0 | **Send SMS anyway** — true emergencies don't wait |
| P1 | **Queue for 7 AM** — urgent but not life-threatening |
| P2-P4 | **Queue for morning briefing** |

### Work Hours (8 AM - 6 PM)

| Priority | Behavior |
|----------|----------|
| P0 | Immediate SMS + Notion |
| P1 | Immediate SMS + Notion |
| P2 | Notion only, included in evening summary |
| P3-P4 | Notion only, batched |

### Evening Hours (6 PM - 10 PM)

| Priority | Behavior |
|----------|----------|
| P0 | Immediate SMS + Notion |
| P1 | **Delay 15 min** — allows batching, respects personal time |
| P2-P4 | Notion only |

---

## Notification Types & Routing

### System Health

| Event | Priority | Channel | Message Format |
|-------|----------|---------|----------------|
| Gateway down | P0 | SMS + Notion | "🚨 ARI Gateway DOWN. Attempting restart..." |
| Gateway recovered | P1 | SMS + Notion | "✅ Gateway recovered after X min downtime" |
| Disk > 90% | P0 | SMS + Notion | "🚨 Disk critical: 92%. Action needed." |
| Disk > 80% | P2 | Notion | Log warning |
| High memory | P2 | Notion | Log warning |
| Service crash | P1 | SMS + Notion | "⚠️ [Service] crashed. Auto-restart attempted." |

### Security

| Event | Priority | Channel | Message Format |
|-------|----------|---------|----------------|
| Injection attempt | P0 | SMS + Notion | "🚨 SECURITY: Injection attempt blocked from [source]" |
| Auth failure (3+) | P1 | SMS + Notion | "⚠️ Multiple auth failures detected" |
| Unusual access pattern | P2 | Notion | Log for review |
| Audit chain tampered | P0 | SMS + Notion | "🚨 CRITICAL: Audit chain integrity compromised" |

### Development

| Event | Priority | Channel | Message Format |
|-------|----------|---------|----------------|
| Tests failed | P1 | SMS + Notion | "⚠️ Tests: X failures. See Notion for details." |
| Build failed | P1 | SMS + Notion | "⚠️ Build failed. Check required." |
| Tests passed | P4 | Notion | Log only |
| PR merged | P3 | Notion | Include in daily summary |
| Dependency vulnerability | P2 | Notion | Weekly security digest |

### Tasks & Projects

| Event | Priority | Channel | Message Format |
|-------|----------|---------|----------------|
| High-priority task complete | P2 | Notion | "✅ Completed: [task name]" |
| Deadline in 24h | P1 | SMS | "⚠️ Deadline tomorrow: [task]" |
| Deadline in 1h | P0 | SMS | "🚨 Deadline in 1 hour: [task]" |
| Blocked task | P2 | Notion | Include in daily summary |
| Project milestone | P2 | Notion | Detailed update |

### Governance

| Event | Priority | Channel | Message Format |
|-------|----------|---------|----------------|
| Vote needed | P1 | SMS + Notion | "⚠️ Council vote required: [topic]" |
| Vote completed | P3 | Notion | Log result |
| Arbiter override | P0 | SMS + Notion | "🚨 Arbiter invoked: [reason]" |
| Quality gate failed | P1 | SMS + Notion | "⚠️ Overseer blocked: [gate]" |

---

## Scheduled Communications

### Morning Briefing (6:30 AM)

**Channel:** Notion (with SMS ping: "📋 Morning briefing ready in Notion")

**Content:**

1. Overnight events summary
2. Today's calendar/deadlines
3. Priority tasks for today
4. Any blocked items needing attention
5. System health status

### Evening Summary (9:00 PM)

**Channel:** Notion only (no SMS unless P0/P1 items)

**Content:**

1. What got done today
2. What's pending
3. Tomorrow's priorities
4. Weekly goal progress
5. Any decisions needed

### Weekly Review (Sunday 6:00 PM)

**Channel:** Notion

**Content:**

1. Week accomplishments
2. Metrics (tests, builds, uptime)
3. Goal progress
4. Next week priorities
5. Retrospective notes

---

## Anti-Spam Rules

### Deduplication

- Same error within 5 minutes → Single notification with count
- Same warning within 1 hour → Batch into one
- Repeated P1 for same issue → Escalate to P0 after 3rd occurrence

### Rate Limiting

- Max 5 SMS per hour (except P0)
- Max 20 SMS per day (except P0)
- P0 bypasses all limits

### Consolidation

- Multiple P2-P4 events → Batch into single Notion update every 30 min
- Evening: Consolidate all day's P3-P4 into summary

---

## User Preferences

```json
{
  "quietHours": {
    "start": "22:00",
    "end": "07:00",
    "timezone": "America/Indiana/Indianapolis"
  },
  "smsThreshold": "P1",
  "notionEnabled": true,
  "weeklyReview": true,
  "morningBriefing": true,
  "eveningSummary": true,
  "batchingWindow": 30
}
```

---

## Notion Structure

### ARI Inbox (Database)

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | Event/notification name |
| Priority | Select | P0-P4 |
| Category | Select | System, Security, Dev, Task, Governance |
| Status | Select | New, Acknowledged, Resolved |
| Timestamp | Date | When it occurred |
| Details | Text | Full context |
| Action Required | Checkbox | Needs human response |

### ARI Daily Log (Page per day)

- Morning briefing section
- Events throughout day
- Evening summary section

### ARI Projects (Database)

- Linked to task updates
- Progress tracking
- Milestone notifications

---

## Implementation Checklist

- [x] SMS via Gmail/Verizon gateway
- [x] Priority-based routing
- [x] Quiet hours logic
- [ ] Notion integration for async notifications
- [ ] Morning briefing automation
- [ ] Evening summary automation
- [ ] Rate limiting implementation
- [ ] Deduplication logic
- [ ] Weekly review automation
- [ ] Two-way SMS (reply handling)

---

## Decision Tree

```
EVENT OCCURS
    │
    ▼
┌─────────────┐
│ What is the │
│  priority?  │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
  P0      P1-P4
   │       │
   ▼       ▼
 ALWAYS  ┌─────────────┐
  SMS    │ Quiet hours?│
   +     └──────┬──────┘
 Notion         │
         ┌──────┴──────┐
         │             │
        Yes           No
         │             │
         ▼             ▼
    ┌─────────┐   ┌─────────┐
    │ Queue   │   │   P1?   │
    │ for 7AM │   └────┬────┘
    └─────────┘        │
                 ┌─────┴─────┐
                 │           │
                Yes         No
                 │           │
                 ▼           ▼
              SMS +      Notion
              Notion      Only
```

---

*Last Updated: January 30, 2026*
*Version: 1.0.0*
