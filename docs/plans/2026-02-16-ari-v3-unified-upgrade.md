# ARI v3.0 Unified Upgrade Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ARI from a collection of capable subsystems into a unified Personal OS that consolidates all notification channels, integrates Apple ecosystem, provides intelligent market briefings, generates content, and accelerates every dimension of Pryce's life.

**Architecture:** Event-driven 7-layer system with EventBus as sole coupling point. All new integrations follow existing patterns: typed events, Zod validation, osascript for macOS APIs, Telegram as primary output channel.

**Tech Stack:** TypeScript 5.3, Node.js 20+, Vitest, Fastify, Zod, osascript (macOS), Notion API, Telegram Bot API, Anthropic API, React 19 + Vite 7 (dashboard)

**Philosophy:** One brain (Notion), one mouth (Telegram), one orchestrator (ARI).

**Date:** February 16, 2026
**Status:** In Progress

---

## Table of Contents

1. [Current State Assessment](#current-state)
2. [Phase A: Security Hardening](#phase-a) — CRITICAL
3. [Phase B: Architecture Alignment](#phase-b)
4. [Phase C: Quick-Win API Integrations](#phase-c)
5. [Phase D: Intelligence Pipeline](#phase-d)
6. [Phase E: Dashboard Enhancement](#phase-e)
7. [Phase F: Telegram Mini App](#phase-f)
8. [Phase G: Business Infrastructure](#phase-g)
9. [Phase H: Knowledge Acceleration](#phase-h)
10. [Phase I: Test Coverage Push](#phase-i)
11. [Phase J: Error Handling Cleanup](#phase-j)
12. [API Research Summary](#api-research)
13. [Cost Analysis](#cost-analysis)
14. [Implementation Timeline](#timeline)

---

## Current State Assessment {#current-state}

### Completed Phases (from previous sessions)

| Phase | Description | Status | Tests Added |
|-------|-------------|--------|-------------|
| Phase 1 | Smart Market Notifications | Done | Threshold tests updated |
| Phase 2 | Apple Ecosystem Integration | Done | 57 tests (calendar, reminders, focus-mode, sync) |
| Phase 4 | Content Engine (types, drafter, queue, analyzer) | Done | Publisher + plugin remaining |
| Phase 5 | Architecture Diagram Generation | Done | Mermaid generator + CLI |
| Phase 6 | Codebase Audit + Cleanup | Done | Health monitor fixes |
| Phase 7 | Notion Deepening | Done | Retry logic, caching |

### Test Suite Health

- **5,040 tests passing** (201 test files)
- **0 failures**
- TypeScript clean, ESLint clean
- Duration: ~29s

### Codebase Audit Results (22 findings)

**Critical (3):**
1. Shell injection in `src/integrations/sms/sms-executor.ts` — uses string interpolation in shell command
2. Shell injection in `src/ops/backup-manager.ts` — uses string interpolation in synchronous shell command
3. L0 Cognitive → L1 Kernel architecture violation — 6 files in `src/cognition/` import from `src/kernel/`

**High (6):**
4. L2 → L3 layer violation in `src/system/context-loader.ts` importing from agents
5. L3 → L4/L5 violations in several agent files importing governance/ops
6. `any` type usage in `src/integrations/gmail/gmail-receiver.ts`
7. 29 files using `fs` instead of `node:fs` (missing node: prefix)
8. Unused `handlerTimeoutMs` property in scheduler
9. 160+ empty catch blocks across codebase (silent error suppression)

**Medium (8):**
10. Outdated `src/autonomous/CLAUDE.md` — lists only 5 tasks, should list 27+
11. Missing documentation for plugins and e2e testing
12. TODO comments in MCP server
13. 30+ untested source files
14. `0.0.0.0` appears in a blocklist (not a bind, but confusing)
15. SMS module using unsafe shell patterns
16. Missing Telegram sender unit tests
17. Stale `gmail_ingest` handler logging "pending IMAP configuration"

**Low (5):**
18. Inconsistent error message formatting
19. Some test files import from `src/` instead of relative paths
20. Dead code in several utility files
21. Console.log statements in 3 test files
22. Stale `e2e_daily_run` handler logging "pending Playwright setup"

---

## Phase A: Security Hardening {#phase-a}

**Priority:** CRITICAL — Shell injection vulnerabilities must be fixed immediately.

### A.1 Fix SMS Executor Shell Injection

**Files:**
- Modify: `src/integrations/sms/sms-executor.ts`
- Test: `tests/unit/integrations/sms/sms-executor.test.ts`

**Problem:** The SMS executor passes user-controlled strings directly into shell commands via string interpolation. This allows command injection.

**Fix:** Replace string-interpolated shell invocations with `execFile()` using argument arrays. The `execFile` function does NOT spawn a shell, so special characters in arguments are harmless.

**Before (vulnerable):**
```typescript
// DANGEROUS: phoneNumber could contain "; rm -rf /"
child_process.execSync(`osascript -e '...${phoneNumber}...'`);
```

**After (safe):**
```typescript
// SAFE: execFile passes args as array, no shell interpretation
child_process.execFile('osascript', ['-e', script], callback);
```

**Test:** Add injection attack test cases:
```typescript
it('should safely handle phone numbers with shell metacharacters', async () => {
  const result = await executor.send('$(whoami)', 'test');
  // Should not execute whoami, should treat as literal string
});
```

### A.2 Fix Backup Manager Shell Injection

**Files:**
- Modify: `src/ops/backup-manager.ts`
- Test: `tests/unit/ops/backup-manager.test.ts`

**Problem:** Same pattern — file paths interpolated into shell commands. A malicious filename could inject commands.

**Fix:** Same approach — replace synchronous string-interpolated shell calls with `execFile()` argument arrays.

### A.3 Security Regression Tests

**Files:**
- Create: `tests/security/shell-injection.test.ts`

**Tests to add:**
- SMS executor with shell metacharacters in phone number
- SMS executor with shell metacharacters in message body
- Backup manager with shell metacharacters in file paths
- Backup manager with shell metacharacters in backup names

---

## Phase B: Architecture Alignment {#phase-b}

**Priority:** HIGH — Layer violations weaken the architectural guarantee.

### B.1 Fix L0 Cognitive → L1 Kernel Violations

**Problem:** 6 files in `src/cognition/` import from `src/kernel/`. L0 should be self-contained with zero imports.

**Files to fix:**
1. `src/cognition/logos.ts` — imports EventBus type
2. `src/cognition/ethos.ts` — imports EventBus type
3. `src/cognition/pathos.ts` — imports EventBus type
4. `src/cognition/bias-detector.ts` — imports types
5. `src/cognition/reasoning-engine.ts` — imports types
6. `src/cognition/metacognition.ts` — imports types

**Fix Strategy:** Define L0-local interfaces that mirror what's needed, removing the import dependency. The actual wiring happens at the layer boundary (L1 passes implementations down to L0).

```typescript
// src/cognition/types.ts (L0-local, no imports)
export interface CognitiveEventEmitter {
  emit(event: string, payload: unknown): void;
}
```

### B.2 Fix L2 → L3 Violation

**File:** `src/system/context-loader.ts`

**Problem:** Imports from `src/agents/` which is L3. L2 cannot import L3.

**Fix:** Extract the shared interface into `src/kernel/types.ts` (L1) so both L2 and L3 can import it.

### B.3 Fix L3 → L4/L5 Violations

**Files:** Several agent files importing from governance (L4) and ops (L5).

**Fix:** Use EventBus for cross-layer communication instead of direct imports.

---

## Phase C: Quick-Win API Integrations {#phase-c}

**Priority:** MEDIUM — Free APIs that add immediate value with zero cost.

### C.1 Hacker News Intelligence

**Create:** `src/integrations/hackernews/client.ts`

Free, zero-auth API. Fetches top stories, filters by relevance to Pryce's interests (AI, startups, tech, market).

```typescript
export class HackerNewsClient {
  async getTopStories(limit?: number): Promise<HNStory[]>;
  async getStoryDetails(id: number): Promise<HNStory>;
  async getRelevantStories(keywords: string[]): Promise<HNStory[]>;
}
```

**Integrate into:** Morning briefing "Tech Intelligence" section.

### C.2 RSS Feed Aggregator

**Create:** `src/integrations/rss/aggregator.ts`

Uses `rss-parser` npm package. Aggregates feeds from configurable sources (TechCrunch, The Verge, Ars Technica, Hacker News RSS, etc.).

```typescript
export class RSSAggregator {
  addFeed(url: string, category: string): void;
  async fetchAll(): Promise<FeedItem[]>;
  async fetchCategory(category: string): Promise<FeedItem[]>;
}
```

**Integrate into:** Morning briefing "News" section, evening summary "Today's Headlines" section.

### C.3 Weather Integration

**Create:** `src/integrations/weather/client.ts`

WeatherAPI.com — free tier: 1M calls/month. Provides current conditions, forecast, and alerts.

```typescript
export class WeatherClient {
  async getCurrent(location: string): Promise<WeatherData>;
  async getForecast(location: string, days: number): Promise<ForecastData>;
  async getAlerts(location: string): Promise<WeatherAlert[]>;
}
```

**Integrate into:** Morning briefing "Weather" section (after greeting, before schedule).

### C.4 GitHub Activity Monitor

**Create:** `src/integrations/github/client.ts`

GitHub REST API — free with token. Monitors ARI repo activity, PRs, issues, and Pryce's contribution graph.

```typescript
export class GitHubClient {
  async getRepoActivity(owner: string, repo: string): Promise<RepoActivity>;
  async getNotifications(): Promise<GitHubNotification[]>;
  async getContributionGraph(username: string): Promise<ContributionData>;
}
```

**Integrate into:** Morning briefing "Dev Activity" section, evening summary with commit count.

### Tests

- `tests/unit/integrations/hackernews/client.test.ts`
- `tests/unit/integrations/rss/aggregator.test.ts`
- `tests/unit/integrations/weather/client.test.ts`
- `tests/unit/integrations/github/client.test.ts`

---

## Phase D: Intelligence Pipeline {#phase-d}

**Priority:** MEDIUM — Paid APIs that provide outsized value.

### D.1 Perplexity AI Integration

**Create:** `src/integrations/perplexity/client.ts`

Cost: ~$5/month at 200 queries/day. Provides real-time web research with citations.

```typescript
export class PerplexityClient {
  async search(query: string, focus?: 'web' | 'academic' | 'news'): Promise<PerplexityResult>;
  async deepResearch(topic: string): Promise<ResearchReport>;
}
```

**Use cases:**
- Market event context ("Why did NVDA drop 8%?")
- Trend analysis for content engine
- Research backing for morning briefings

### D.2 Anthropic Batch API Optimization

**Modify:** `src/ai/orchestrator.ts`

Currently all AI calls are synchronous. For non-urgent tasks (content drafting, weekly analysis, trend scoring), batch them.

**Savings:** ~$15/month reduction in API costs.

```typescript
export class BatchProcessor {
  queue(request: BatchRequest): string; // returns batchId
  async flush(): Promise<BatchResult[]>;
  async getResult(batchId: string): Promise<BatchResult | null>;
}
```

**Schedule:** Flush batch queue every 15 minutes or when queue reaches 10 items.

### D.3 Readwise Integration

**Create:** `src/integrations/readwise/client.ts`

Cost: $8/month. Syncs highlights from Kindle, articles, PDFs into ARI's knowledge base.

```typescript
export class ReadwiseClient {
  async getHighlights(since?: Date): Promise<Highlight[]>;
  async getBooks(): Promise<Book[]>;
  async createHighlight(text: string, source: string): Promise<Highlight>;
}
```

**Integrate into:** Weekly briefing "Reading Insights" section, knowledge graph for content engine.

### Tests

- `tests/unit/integrations/perplexity/client.test.ts`
- `tests/unit/ai/batch-processor.test.ts`
- `tests/unit/integrations/readwise/client.test.ts`

---

## Phase E: Dashboard Enhancement {#phase-e}

**Priority:** LOW-MEDIUM — Existing dashboard at `/dashboard/` already has the infrastructure.

### Current Dashboard State

The existing React dashboard has:
- React 19 + Vite 7 + TailwindCSS 4
- Recharts 3 for charts
- WebSocket context for real-time updates
- 12 existing pages (Dashboard, Agents, Memory, Governance, etc.)
- Authentication and dark/light theme

### E.1 New Dashboard Pages

Add 7 new pages to the existing dashboard:

| Page | Description | Data Source |
|------|-------------|-------------|
| Market Overview | Portfolio + watchlist with charts | market-monitor events |
| Daily Schedule | Calendar timeline + reminders | Apple Calendar events |
| Intel Feed | HN + RSS + research digest | intelligence pipeline |
| Notification Log | All notifications with filters | notification-manager |
| Finance Tracker | Budget + expense categories | future: Plaid/Teller |
| Productivity | Focus time, task completion rates | Apple Focus + Notion |
| Health Dashboard | System health + API latency | health-monitor events |

### E.2 Financial Charts

**Add dependency:** `lightweight-charts` (TradingView's open-source library)

For the Market Overview page, use lightweight-charts for candlestick/line charts instead of Recharts (which is better for bar/pie charts).

### E.3 Real-Time Updates

Leverage existing WebSocket infrastructure. Add new event subscriptions:

```typescript
// dashboard/src/hooks/useMarketData.ts
export function useMarketData() {
  const { subscribe } = useWebSocket();
  const [data, setData] = useState<MarketSnapshot[]>([]);

  useEffect(() => {
    return subscribe('market:snapshot', (payload) => {
      setData(prev => [...prev.slice(-100), payload]);
    });
  }, [subscribe]);

  return data;
}
```

### Tests

- Dashboard component tests with React Testing Library
- WebSocket hook tests with mock server

---

## Phase F: Telegram Mini App {#phase-f}

**Priority:** LOW — Nice-to-have for mobile access.

### F.1 Mini App Architecture

Telegram Mini Apps are web apps that run inside Telegram. Use the existing Vite + React setup from the dashboard, deployed as a separate build.

**Create:** `dashboard/src/mini-app/` — Separate entry point for Telegram Mini App

**Key pages:**
- Quick task capture (voice → text → Notion)
- Today's schedule at a glance
- Market snapshot
- Notification center
- CRM quick actions

### F.2 Telegram Bot Integration

**Modify:** `src/plugins/telegram-bot/bot.ts` — Add Mini App launch button to main menu

```typescript
bot.command('app', (ctx) => {
  ctx.reply('Open ARI Dashboard', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open Dashboard',
        web_app: { url: MINI_APP_URL }
      }]]
    }
  });
});
```

---

## Phase G: Business Infrastructure {#phase-g}

**Priority:** LOW — For Pryceless Solutions growth.

### G.1 Cal.com Integration (Free, Self-Hosted)

**Create:** `src/integrations/calcom/client.ts`

Scheduling for Pryceless Solutions client meetings. Self-hosted = free.

```typescript
export class CalComClient {
  async getBookings(startDate: Date, endDate: Date): Promise<Booking[]>;
  async createEventType(name: string, duration: number): Promise<EventType>;
  async getAvailability(date: Date): Promise<TimeSlot[]>;
}
```

### G.2 Toggl Time Tracking (Free Tier)

**Create:** `src/integrations/toggl/client.ts`

Track time spent on Pryceless Solutions projects. Free tier: unlimited tracking.

```typescript
export class TogglClient {
  async startTimer(description: string, project?: string): Promise<TimeEntry>;
  async stopTimer(): Promise<TimeEntry>;
  async getWeeklyReport(): Promise<WeeklyReport>;
}
```

**Integrate into:** Evening summary "Time Invested" section.

### G.3 Stripe Integration (For Future Invoicing)

**Create:** `src/integrations/stripe/client.ts`

Minimal wrapper for invoice creation and payment tracking.

```typescript
export class StripeClient {
  async createInvoice(customer: string, items: LineItem[]): Promise<Invoice>;
  async getBalance(): Promise<BalanceData>;
  async getRecentPayments(limit?: number): Promise<Payment[]>;
}
```

---

## Phase H: Knowledge Acceleration {#phase-h}

**Priority:** LOW — Long-term learning infrastructure.

### H.1 Anki Connect Integration

**Create:** `src/integrations/anki/client.ts`

Anki Connect is a free plugin that exposes Anki's API locally. ARI can create flashcards from reading highlights, meeting notes, and learning content.

```typescript
export class AnkiClient {
  async createCard(front: string, back: string, deck: string): Promise<number>;
  async getDueCards(deck?: string): Promise<Card[]>;
  async getStats(): Promise<AnkiStats>;
}
```

**Integration:** Content engine generates flashcards from research. Morning briefing includes "Review X cards today" reminder.

### H.2 Local LLM via Ollama

**Create:** `src/integrations/ollama/client.ts`

For tasks that don't need Claude-level intelligence: summarization, classification, embedding generation.

```typescript
export class OllamaClient {
  async generate(model: string, prompt: string): Promise<string>;
  async embed(model: string, text: string): Promise<number[]>;
  async listModels(): Promise<OllamaModel[]>;
}
```

**Use cases:** Privacy-sensitive processing, high-volume classification, local embeddings for memory search.

### H.3 Whisper Transcription

**Create:** `src/integrations/whisper/client.ts`

Local or API-based audio transcription for meeting notes, voice memos, podcast summaries.

```typescript
export class WhisperClient {
  async transcribe(audioPath: string): Promise<Transcription>;
  async transcribeStream(stream: NodeJS.ReadableStream): Promise<Transcription>;
}
```

---

## Phase I: Test Coverage Push {#phase-i}

**Priority:** MEDIUM — Technical health.

### Untested Files (30+)

Based on the codebase audit, these source files lack dedicated test coverage:

| Category | Files | Priority |
|----------|-------|----------|
| Integrations | twitter/client.ts, gmail-receiver.ts | High |
| Plugins | telegram-bot/bot.ts, register-plugins.ts | High |
| Autonomous | agent.ts (partial), scheduler.ts (partial) | Medium |
| Channels | telegram-sender.ts, slack-sender.ts | Medium |
| Skills | All skill files | Low |
| CLI | Most command files | Low |

### Strategy

1. Start with high-priority integration tests (twitter, gmail)
2. Add telegram-bot command tests (content, diagram, task)
3. Add autonomous agent handler tests
4. Add channel sender tests

### Coverage Target

- Move from ~80% to **85%+** overall
- Maintain **100%** on security paths

---

## Phase J: Error Handling Cleanup {#phase-j}

**Priority:** MEDIUM — Technical debt reduction.

### 160+ Silent Catch Blocks

Many catch blocks across the codebase either:
- Catch and do nothing (`catch {}`)
- Catch and log but swallow the error
- Catch with generic "error occurred" message

### Fix Strategy

1. **Categorize** catch blocks by severity:
   - Security-related → must re-throw or emit security event
   - Data operations → should log with context and return error state
   - Optional features → acceptable to catch and degrade gracefully

2. **Pattern to apply:**
```typescript
// BEFORE (silent)
try { await doThing(); } catch {}

// AFTER (observable)
try {
  await doThing();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  log.warn(`doThing failed: ${message}`);
  this.eventBus?.emit('system:error', {
    error: error instanceof Error ? error : new Error(message),
    context: 'doThing',
  });
}
```

3. **Batch by file:** Fix 10-15 files per session, run full test suite after each batch.

---

## API Research Summary {#api-research}

### Tier 1: Free, Zero-Auth (Immediate)

| API | Use Case | Rate Limit | Auth |
|-----|----------|------------|------|
| Hacker News (Firebase) | Tech intelligence | None | None |
| RSS Parser (npm) | News aggregation | N/A | N/A |
| CoinGecko | Crypto prices | 30/min free | None |
| DuckDuckGo Instant | Quick answers | Reasonable | None |

### Tier 2: Free with API Key

| API | Use Case | Rate Limit | Cost |
|-----|----------|------------|------|
| WeatherAPI.com | Weather briefings | 1M/month | Free |
| GitHub REST | Dev activity | 5K/hr | Free |
| NewsAPI.org | News headlines | 100/day | Free |
| Alpha Vantage | Stock data | 25/day | Free |

### Tier 3: Low-Cost (<$10/month)

| API | Use Case | Cost | Value |
|-----|----------|------|-------|
| Perplexity | AI-powered research | ~$5/mo | Very High |
| Readwise | Reading highlights sync | $8/mo | High |
| Todoist | Task management backup | $4/mo | Medium |

### Tier 4: Medium-Cost ($10-50/month)

| API | Use Case | Cost | Value |
|-----|----------|------|-------|
| Notion API (already using) | Central brain | Free | Critical |
| Anthropic API (already using) | AI backbone | ~$20/mo | Critical |
| Telegram Bot API (already using) | Primary channel | Free | Critical |

### Tier 5: Savings Opportunities

| Optimization | Savings | Effort |
|--------------|---------|--------|
| Anthropic Batch API for non-urgent | ~$15/mo | Medium |
| Ollama for simple classification | ~$5/mo | Low |
| Cache aggressive on weather/news | ~$2/mo | Low |

### Net Monthly Impact: **-$2/month** (savings exceed new costs)

---

## Cost Analysis {#cost-analysis}

### Current Monthly Costs

| Service | Cost |
|---------|------|
| Anthropic API | ~$20/mo |
| Claude Max subscription | Included |
| Notion | Free |
| Telegram | Free |
| **Total** | **~$20/mo** |

### Projected After v3.0

| Service | Cost | Change |
|---------|------|--------|
| Anthropic API (with batch) | ~$5/mo | -$15 |
| Perplexity | ~$5/mo | +$5 |
| Readwise | $8/mo | +$8 |
| WeatherAPI | Free | $0 |
| GitHub API | Free | $0 |
| Cal.com (self-hosted) | Free | $0 |
| Toggl (free tier) | Free | $0 |
| **Total** | **~$18/mo** | **-$2/mo** |

---

## Implementation Timeline {#timeline}

### Week 1 (Immediate)
- [x] Phase 1: Smart Market Notifications (DONE)
- [x] Phase 2: Apple Ecosystem Integration (DONE)
- [ ] Phase A: Security Hardening (CRITICAL)
- [ ] Phase C.1-C.2: HN + RSS integrations (quick wins)

### Week 2
- [ ] Phase B: Architecture Alignment (layer violations)
- [ ] Phase C.3-C.4: Weather + GitHub integrations
- [ ] Phase D.2: Batch API optimization

### Week 3
- [ ] Phase D.1: Perplexity integration
- [ ] Phase E.1-E.2: Dashboard new pages
- [ ] Phase I: Test coverage push (batch 1)

### Week 4
- [ ] Phase D.3: Readwise integration
- [ ] Phase E.3: Real-time dashboard updates
- [ ] Phase J: Error handling cleanup (batch 1)

### Month 2
- [ ] Phase F: Telegram Mini App
- [ ] Phase G: Business infrastructure
- [ ] Phase H: Knowledge acceleration
- [ ] Phase I: Test coverage push (remaining)
- [ ] Phase J: Error handling cleanup (remaining)

---

## Implementation Order (Priority)

```
Phase A (Security)  ─── CRITICAL: Fix shell injection NOW
Phase C (APIs)      ─── Quick wins, free, immediate value
Phase B (Arch)      ─── Fix layer violations before they spread
Phase D (Intel)     ─── Paid APIs with outsized ROI
Phase E (Dashboard) ─── Leverage existing infrastructure
Phase I (Tests)     ─── Continuous, batch by batch
Phase J (Errors)    ─── Continuous, file by file
Phase G (Business)  ─── When Pryceless Solutions needs it
Phase F (Mini App)  ─── When dashboard is solid
Phase H (Knowledge) ─── Long-term learning infrastructure
```

---

## Verification Checklist

- [ ] All 5,040+ tests passing
- [ ] TypeScript clean (`npm run typecheck`)
- [ ] ESLint clean (`npm run lint:fix`)
- [ ] No shell injection vulnerabilities
- [ ] No layer architecture violations
- [ ] 85%+ test coverage
- [ ] All new integrations have dedicated test files
- [ ] All EventBus events typed in event-bus.ts
- [ ] Morning briefing includes: weather, calendar, reminders, market, HN, tasks
- [ ] Evening summary includes: time tracked, tasks completed, market close, reading
- [ ] Dashboard renders all 7 new pages
- [ ] Batch API reduces costs by ~$15/month

---

## New Files Summary

### Source Files (25+)

| File | Phase | Purpose |
|------|-------|---------|
| `src/integrations/hackernews/client.ts` | C | HN API client |
| `src/integrations/rss/aggregator.ts` | C | RSS feed aggregation |
| `src/integrations/weather/client.ts` | C | Weather briefings |
| `src/integrations/github/client.ts` | C | GitHub activity |
| `src/integrations/perplexity/client.ts` | D | AI research |
| `src/ai/batch-processor.ts` | D | Batch API optimization |
| `src/integrations/readwise/client.ts` | D | Reading highlights |
| `src/integrations/calcom/client.ts` | G | Scheduling |
| `src/integrations/toggl/client.ts` | G | Time tracking |
| `src/integrations/stripe/client.ts` | G | Invoicing |
| `src/integrations/anki/client.ts` | H | Flashcards |
| `src/integrations/ollama/client.ts` | H | Local LLM |
| `src/integrations/whisper/client.ts` | H | Transcription |
| `tests/security/shell-injection.test.ts` | A | Security regression |
| `dashboard/src/pages/MarketOverview.tsx` | E | Market dashboard |
| `dashboard/src/pages/DailySchedule.tsx` | E | Calendar view |
| `dashboard/src/pages/IntelFeed.tsx` | E | News/research |
| `dashboard/src/pages/NotificationLog.tsx` | E | Notification history |
| `dashboard/src/pages/FinanceTracker.tsx` | E | Budget tracking |
| `dashboard/src/pages/Productivity.tsx` | E | Focus/tasks |
| `dashboard/src/pages/HealthDashboard.tsx` | E | System health |
| `dashboard/src/mini-app/App.tsx` | F | Telegram Mini App |

### Modified Files (15+)

| File | Phases | Key Changes |
|------|--------|-------------|
| `src/integrations/sms/sms-executor.ts` | A | Fix shell injection |
| `src/ops/backup-manager.ts` | A | Fix shell injection |
| `src/cognition/*.ts` (6 files) | B | Remove L1 imports |
| `src/system/context-loader.ts` | B | Fix L2→L3 import |
| `src/autonomous/briefings.ts` | C,D | Add weather, HN, RSS sections |
| `src/autonomous/scheduler.ts` | C,D,G | Add new integration tasks |
| `src/kernel/event-bus.ts` | C,D | Add new event types |
| `src/ai/orchestrator.ts` | D | Add batch processing |
| `dashboard/src/App.tsx` | E | Add new routes |
| `dashboard/src/components/Sidebar.tsx` | E | Add new nav items |

---

*This plan is a living document. Update status checkboxes as phases complete.*
*Generated: February 16, 2026 | ARI v3.0 Upgrade*
