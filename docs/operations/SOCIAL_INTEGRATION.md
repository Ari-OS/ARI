# ARI Social Integration (ROADMAP)

**Status**: Planning
**Target**: Future release
**Last Updated**: 2026-01-28

---

## Overview

This document describes the planned architecture for automated social media posting from ARI. This is a **ROADMAP** feature — not yet implemented.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      ARI Core                           │
├─────────────────────────────────────────────────────────┤
│                    ContentAgent                         │
│  - Generates posts from build events                    │
│  - Formats according to templates                       │
│  - Assigns priority level (P0/P1/P2)                    │
├─────────────────────────────────────────────────────────┤
│                    Review Gate                          │
│  - P0: Auto-approve (build logs, test results)          │
│  - P1: Queue for review (architecture, philosophy)      │
│  - P2: Require operator approval (replies, mentions)    │
├─────────────────────────────────────────────────────────┤
│                    Post Queue                           │
│  - Rate limited (10 posts/day max)                      │
│  - Duplicate detection via content hash                 │
│  - Scheduled posting                                    │
├─────────────────────────────────────────────────────────┤
│                    X API Client                         │
│  - Official API only (v2)                               │
│  - OAuth 2.0 authentication                             │
│  - Error handling and retry                             │
├─────────────────────────────────────────────────────────┤
│                    Audit Logger                         │
│  - All posts logged before send                         │
│  - Response status recorded                             │
│  - Hash chain integration                               │
└─────────────────────────────────────────────────────────┘
```

---

## Priority Levels

### P0: Auto-Post

Fully automated, no review required.

| Content Type | Example |
|--------------|---------|
| Build success | "Build: gateway now supports WebSocket. Tests: 42/42. Coverage: 85%." |
| Test results | "Test run: 187 tests. Passed: 187. Failed: 0. Duration: 12s." |
| Release notes | "Release: aurora-2.1.0. Changelog: [link]." |
| Weekly summaries | "Weekly: 23 commits. 45 tests added. 3 issues closed." |

### P1: Review Queue

Queued for operator review before posting.

| Content Type | Example |
|--------------|---------|
| Architecture insights | "ADR: Switched from REST to gRPC. Rationale: 40% latency reduction." |
| Philosophy posts | "Philosophy: 'The shadow reveals truth.' Implementation: guardian.ts." |
| Security advisories | "Security advisory: Input validation bypass fixed in v2.1.1." |

### P2: Approval Required

Requires explicit operator approval.

| Content Type | Example |
|--------------|---------|
| Replies to mentions | Any @-mention response |
| External links | Links to non-ARI resources |
| Corrections | "Correction: Previous post contained error..." |

---

## Safeguards

### Before Posting

1. **Audit logging**: All posts logged to hash chain before API call
2. **Duplicate detection**: Content hash checked against recent posts
3. **Rate limiting**: Max 10 posts/day enforced at queue level
4. **Quiet hours**: P2 posts deferred during 22:00-07:00

### During Posting

1. **Official API only**: X API v2, no scraping, no ToS violations
2. **Error handling**: Exponential backoff on failures
3. **Timeout**: 30 second max per API call

### After Posting

1. **Response logged**: Success/failure recorded in audit
2. **Metrics updated**: Engagement tracking (when available)
3. **Alert on failure**: P1 notification if post fails

---

## Kill Switch

Emergency stop capability:

```bash
# Stop all posting immediately
npx ari social stop

# Pause posting (queue preserved)
npx ari social pause

# Resume posting
npx ari social resume

# Clear queue
npx ari social clear
```

---

## Configuration

### Environment Variables

```bash
# X API credentials (never committed to repo)
export ARI_X_API_KEY="..."
export ARI_X_API_SECRET="..."
export ARI_X_ACCESS_TOKEN="..."
export ARI_X_ACCESS_SECRET="..."
```

### Config File

```json
{
  "social": {
    "enabled": false,
    "platform": "x",
    "rateLimit": {
      "postsPerDay": 10,
      "postsPerHour": 3
    },
    "quietHours": {
      "start": "22:00",
      "end": "07:00",
      "timezone": "America/New_York"
    },
    "review": {
      "p0": "auto",
      "p1": "queue",
      "p2": "approval"
    }
  }
}
```

---

## Content Generation

### Event-Driven

ContentAgent listens to EventBus events:

| Event | Generated Post |
|-------|----------------|
| `build:success` | Build progress template |
| `test:complete` | Test run template |
| `release:published` | Release template |
| `governance:vote_complete` | Council vote template |
| `security:threat_detected` | Guardian alert template |

### Template Engine

Posts generated from templates with variable substitution:

```typescript
const template = "Build: {component} now {capability}. Tests: {passed}/{total}. Coverage: {coverage}%.";

const post = render(template, {
  component: "gateway",
  capability: "supports WebSocket",
  passed: 42,
  total: 42,
  coverage: 85
});
```

---

## Analytics (Future)

Track post performance:

| Metric | Description |
|--------|-------------|
| Impressions | How many saw the post |
| Engagements | Likes, retweets, replies |
| Link clicks | Clicks on GitHub links |
| Follower growth | Net new followers |

Store in ARI memory with provenance tracking.

---

## Implementation Plan

### Phase 1: Manual CLI

```bash
npx ari social draft "Build: gateway..."  # Create draft
npx ari social review                      # Review queue
npx ari social post 1                      # Post specific draft
```

### Phase 2: Event Integration

- ContentAgent generates drafts from events
- Queue for review
- Manual posting

### Phase 3: Automation

- P0 auto-posting enabled
- P1 queue with operator review
- P2 approval workflow

### Phase 4: Analytics

- Engagement tracking
- Performance optimization
- Content strategy refinement

---

## Security Considerations

### Credential Storage

- API credentials in environment variables only
- Never in config files or repo
- Rotated regularly

### Content Filtering

- No operator identity disclosure
- No location disclosure
- No financial/personal data
- All content passes sanitizer

### Audit Trail

- Every post logged to hash chain
- Every API response logged
- Every failure logged with context

---

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `twitter-api-v2` | Official X API client |
| Audit system | Pre-post logging |
| EventBus | Event-driven content |
| Memory Manager | Analytics storage |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| API rate limits | Queue with rate limiting |
| ToS violation | Official API only, no automation abuse |
| Credential leak | Environment variables, rotation |
| Bad post sent | P1/P2 review gates, kill switch |
| Account suspension | Conservative posting, quality content |

---

**This is a ROADMAP document. Implementation will follow core ARI completion.**
