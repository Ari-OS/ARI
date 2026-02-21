# ARI Content Engine + Business Co-Pilot Design

> **Version**: 1.0 | **Date**: February 16, 2026
> **Status**: Approved for implementation
> **Cost**: $0 in new API costs (all free tiers)

---

## Problem

ARI gathers intelligence from 10+ sources daily but has **zero content creation capabilities**. The intelligence dies in briefings. It should be turned into content, client outreach, and business value for Pryceless Solutions.

## Solution: Full Lifecycle Content Engine

```
Intelligence Scanner ──> Trend Analyzer ──> Content Drafter
     (existing)             (NEW)              (NEW)

Content Drafter ──> Draft Queue ──> Telegram Review ──> Publisher
    (NEW)            (NEW)         (existing)           (NEW)

Project Assistant ──> Templates ──> Telegram Commands
     (NEW)            (NEW)        (existing bot)

Outreach Composer ──> Lead DB ──> Follow-up Queue
     (NEW)           (Notion)      (NEW)
```

**Core principle:** ARI drafts, Pryce decides. No auto-posting.

---

## Architecture

### New Plugin: `src/plugins/content-engine/`

Lives at L5 (Execution layer), follows existing plugin patterns.

**Files:**

- `index.ts` — Plugin registration + Telegram command handlers
- `types.ts` — ContentDraft, ContentTemplate, Lead, Project types
- `trend-analyzer.ts` — Identifies threadable topics from intelligence items
- `content-drafter.ts` — Uses Claude to generate platform-specific drafts
- `draft-queue.ts` — Persists drafts, tracks lifecycle (draft → reviewed → published)
- `publisher.ts` — Posts to X/LinkedIn/saves to Notion on approval
- `project-assistant.ts` — Web dev project template orchestrator
- `outreach-composer.ts` — Personalized follow-up drafting

### Data Storage

```
~/.ari/
├── content/
│   ├── drafts/           # Pending drafts (JSON, date-stamped)
│   ├── published/        # Published content archive
│   └── templates/        # Brand voice + platform templates
│       ├── x-thread.md
│       ├── linkedin-post.md
│       ├── blog-outline.md
│       ├── client-email.md
│       └── case-study.md
├── projects/
│   └── <name>/           # Per-project specs, design systems, copy
│       ├── brief.json
│       ├── sitemap.md
│       ├── copy.md
│       └── qa-checklist.md
└── leads/
    ├── active.json       # Active leads with context
    └── archive.json      # Completed/lost leads
```

---

## Component Details

### 1. Trend Analyzer

**Input:** `IntelligenceItem[]` from intelligence scanner (scored, deduped)
**Output:** Ranked list of "threadable" topics with reasoning

**Logic:**

- Filters items with score >= 60 and domains matching ['ai', 'programming', 'business', 'tools']
- Groups by domain, picks top item per group
- Scores "threadability" based on: novelty × engagement × relevance to PayThePryce audience
- Outputs 2-3 topic briefs with: headline, key points, angle, target platform

**Model:** Haiku 4.5 (cheap, fast, sufficient for topic analysis)

### 2. Content Drafter

**Input:** Topic brief from Trend Analyzer
**Output:** Platform-specific draft content

**Draft types:**

| Type | Format | Max Length | Model |
|------|--------|-----------|-------|
| X thread | Hook + 5-7 body tweets + CTA | 280 chars × 8 | Sonnet 4 |
| LinkedIn post | Professional insight | 1,300 chars | Sonnet 4 |
| Blog outline | Title + H2s + key points | 500 words | Haiku 4.5 |
| Quick take | 1-2 sentence insight | 280 chars | Haiku 4.5 |

**Voice profile (stored in template):**

- Persona: @PayThePryce
- Tone: pragmatic builder, technical but accessible
- Audience: solo devs, indie hackers, small business owners interested in AI
- Style: direct, no fluff, actionable takeaways
- Avoids: corporate jargon, hype without substance

**Cost per draft:** ~$0.01-0.03 (Haiku for outlines, Sonnet for threads)
**Budget:** 100 drafts/month = under $3

### 3. Draft Queue

**Lifecycle:** `pending` → `sent_for_review` → `approved` | `edited` | `rejected` → `published` → `archived`

**Persistence:** JSON files at `~/.ari/content/drafts/YYYY-MM-DD-<id>.json`

**Telegram integration:**

- `/drafts` — List pending drafts (shows titles + platforms)
- `/draft <topic>` — Request a specific draft on demand
- `/approve <id>` — Approve for publishing
- `/edit <id> <changes>` — Request ARI to revise
- `/reject <id>` — Discard with optional reason (ARI learns)
- `/publish <id>` — Publish immediately (bypasses schedule)

### 4. Publisher

**Platforms:**

| Platform | API | Status | Write Access |
|----------|-----|--------|-------------|
| X/Twitter | v2 REST API | Client exists, add write methods | Free: 1,500 tweets/month |
| LinkedIn | REST API | New integration needed | Free: 100 API calls/day |
| Notion | Already integrated | Use existing client | Free |
| Buffer | REST API | New integration | Free: 3 channels, 10 posts/channel |

**X Publishing (extend existing client):**

- Add `postTweet(text: string): Promise<string>` (returns tweet ID)
- Add `postThread(tweets: string[]): Promise<string[]>` (chains via reply_to)
- Add `deleteTweet(id: string): Promise<void>`
- Respect rate limits: 200 per 15 minutes

**LinkedIn Publishing (new integration):**

- `src/integrations/linkedin/client.ts`
- OAuth 2.0 with `w_member_social` scope
- `POST /rest/posts` for text posts
- `POST /rest/images` for image uploads

### 5. Project Assistant

Stores the web-dev prompt workflow as ARI templates, callable via Telegram.

**Commands:**

- `/project new <name> <type>` — Start project (portfolio/saas/ecommerce/landing)
- `/project spec` — Generate architecture spec
- `/project design` — Generate design system (colors, fonts, spacing)
- `/project copy` — Generate conversion copy
- `/project components` — Plan component logic
- `/project qa` — Run QA checklist
- `/project status` — Show project progress

**9-Step Template Sequence:**

1. Discovery brief (client questionnaire → structured brief)
2. Sitemap + information architecture
3. Wireframes (text-based layout descriptions)
4. Conversion copy (headlines, body, CTAs, meta descriptions)
5. Design system (color palette hex, Google Fonts, spacing scale)
6. Component specs (state machines, data flow, error handling)
7. Animation guidelines (easing, duration, scroll behaviors)
8. Responsive behavior matrix (mobile/tablet/desktop)
9. QA checklist (Core Web Vitals, WCAG 2.2 AA, SEO, security)

**Storage:** Each project at `~/.ari/projects/<name>/` with all artifacts

### 6. Outreach Composer

**Lead tracking:**

- `/lead add <name> <business> <context>` — Add a lead
- `/lead list` — Show active leads
- `/lead followup <name>` — Generate follow-up draft
- `/lead close <name> <outcome>` — Archive lead

**Follow-up templates:**

| Template | When | Tone |
|----------|------|------|
| Cold intro | First contact | Professional, value-focused |
| Post-meeting | After discovery call | Warm, referencing specifics |
| Ghost follow-up | 1+ week no response | Pattern interrupt, memorable |
| Proposal follow-up | After sending proposal | Confident, deadline-aware |
| Check-in | Monthly maintenance | Casual, relationship-building |

**Personalization:** Uses lead context + past interaction history stored in `~/.ari/leads/`

---

## Scheduler Integration

New scheduled tasks in `src/autonomous/scheduler.ts`:

| Time | Task ID | Handler | Purpose |
|------|---------|---------|---------|
| 07:00 AM | `content_daily_drafts` | `content_daily_drafts` | Generate 2-3 post drafts from intelligence |
| 07:30 AM | `content_draft_delivery` | `content_draft_delivery` | Send top draft to Telegram for review |
| 10:00 AM | `content_publish_approved` | `content_publish_approved` | Publish any approved drafts |
| 14:00 PM | `outreach_followup_check` | `outreach_followup_check` | Check for leads needing follow-up |

---

## API Configuration (Immediate)

### Free APIs to register now

| API | Cost | Action |
|-----|------|--------|
| Alpha Vantage | Free (25 req/day) | Sign up at alphavantage.co/support/#api-key |
| X Developer App | Free (1,500 writes/mo, 10K reads/mo) | Create app at developer.x.com |
| LinkedIn Developer App | Free (100 calls/day) | Create at linkedin.com/developers |
| Buffer | Free (3 channels, 10 posts/channel) | Sign up at buffer.com |

### APIs needing Pryce's accounts

| API | Action | Purpose |
|-----|--------|---------|
| Notion | Create integration at notion.so/my-integrations | Daily logs, drafts, leads |
| Gmail | Generate app password at myaccount.google.com | SMS emergency backup |
| X/Twitter | Get bearer token from developer.x.com app | Intel scanning + publishing |

### Already configured

- Anthropic (primary LLM)
- Telegram (primary interface)
- ARI Gateway (auth)
- ElevenLabs TTS (voice)

---

## Model Selection Strategy

| Task | Model | Cost/1M tokens | Rationale |
|------|-------|----------------|-----------|
| Topic analysis | Haiku 4.5 | $1/$5 | Fast, cheap, sufficient |
| Thread drafting | Sonnet 4 | $3/$15 | Good quality, reasonable cost |
| Blog outlines | Haiku 4.5 | $1/$5 | Structural work, cheap |
| Project specs | Sonnet 4.5 | $3/$15 | Complex reasoning needed |
| Outreach personalization | Sonnet 4 | $3/$15 | Tone-sensitive |
| Final review | Opus 4.6 | $5/$25 | Only for high-stakes content |

**Monthly estimate:** ~100 drafts × $0.02 avg = $2/month for content pipeline.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [ ] Create `src/plugins/content-engine/` directory structure
- [ ] Implement types.ts with ContentDraft, Template, Lead schemas
- [ ] Implement trend-analyzer.ts (score intelligence items for threadability)
- [ ] Implement content-drafter.ts (generate drafts from topic briefs)
- [ ] Implement draft-queue.ts (persistence + lifecycle tracking)
- [ ] Add Telegram commands: /drafts, /draft, /approve, /reject
- [ ] Add X write methods to existing twitter/client.ts
- [ ] Register content_daily_drafts scheduler task
- [ ] Tests for all new components

### Phase 2: Publishing + Projects (Week 2)

- [ ] Implement publisher.ts (X thread posting, Notion archive)
- [ ] Implement project-assistant.ts with 9 template stages
- [ ] Add Telegram commands: /project new, /project spec, etc.
- [ ] Create content templates at ~/.ari/content/templates/
- [ ] Add LinkedIn integration (src/integrations/linkedin/client.ts)
- [ ] Register content_publish_approved scheduler task
- [ ] Tests

### Phase 3: Outreach + Polish (Week 3)

- [ ] Implement outreach-composer.ts
- [ ] Add Telegram commands: /lead, /followup
- [ ] Add Buffer API integration for scheduling
- [ ] Wire content metrics into morning/evening briefings
- [ ] Register outreach_followup_check scheduler task
- [ ] Integration tests for full pipeline
- [ ] Deploy to Mac Mini

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Drafts generated per week | 10-15 | Draft queue count |
| Drafts approved (quality) | 60%+ | Approved vs rejected ratio |
| Time from intel to draft | < 2 hours | Scheduler timestamps |
| Pryce editing time per draft | < 10 minutes | Manual tracking |
| Posts published per week | 5-7 | Publisher logs |
| Content engine API cost | < $5/month | Budget tracker |

---

## Security Considerations

- All content passes through Guardian agent for injection detection
- Published content logged to audit trail (ADR-002)
- API keys stored in ~/.ari/.env, loaded via daemon plist
- X/LinkedIn OAuth tokens stored encrypted in ~/.ari/tokens/
- Lead data (PII) stored locally only, never transmitted except to Notion
- Content drafts sanitized before publishing (no injection vectors)
- All external API calls go through loopback gateway (ADR-001)

---

## Dependencies

- Existing: Intelligence Scanner, EventBus, Telegram Bot, Notion Client, X Client
- New npm: None required (all API calls via fetch)
- New APIs: X write access (free), LinkedIn API (free), Buffer API (free)
