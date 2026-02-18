# ARI Ultimate Implementation Plan — v12.0 (ABSOLUTE FINAL — Everything Integrated)

> **For Claude executing this plan:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task.
>
> **Non-negotiables:**
> - ARI pronouns: **she/her**. Always.
> - Pryceless Solutions (**not** "Priceless"). prycehedrick.com. PayThePryce.
> - Mac Mini SSH user: **ari** (NOT prycehedrick)
> - All subprocess calls: `execFileNoThrow` (NEVER raw exec/child_process)
> - **NEVER Co-Authored-By** in commit messages
> - No `any` types. No layer violations. No `0.0.0.0`. No bypassing sanitizer.

---

## ⚠️ CRITICAL CORRECTIONS — READ BEFORE IMPLEMENTING ANYTHING

Based on full codebase audit (351 TypeScript files), these facts override any prior documentation:

### What Already Exists (DO NOT REBUILD):
| Component | Location | Status |
|-----------|----------|--------|
| EmbeddingService | `src/ai/embedding-service.ts` | **BUILT** — use this in Phase 4 RAG |
| TemporalMemory | `src/agents/temporal-memory.ts` (31 KB) | **BUILT** — Phase 4 can skip |
| SelfImprovementLoop | `src/autonomous/self-improvement-loop.ts` (23 KB) | **BUILT** |
| IntentRouter | `src/plugins/telegram-bot/intent-router.ts` | **BUILT** — 8 intents, extend it |
| 20 Telegram Commands | `src/plugins/telegram-bot/commands/` | **BUILT** |
| NotionClient | `src/integrations/notion/notion-client.ts` (420 lines) | **BUILT** |
| DocumentIngestor | `src/system/document-ingestor.ts` | **BUILT** (new, unstaged) |

### What Does NOT Exist (Must Be Created):
| Component | Needed By | Priority |
|-----------|----------|----------|
| `src/utils/execFileNoThrow.ts` | Phase 0 Bug fix + VideoAssembler | **P0 — create first** |
| `src/utils/retry.ts` | All retry logic | P1 |
| `src/utils/format.ts` (escapeHtml) | Telegram + HTML rendering | P1 |
| `src/integrations/crm/` | Phase 19 | P3 |
| `src/integrations/fathom/` | Phase 20 | P3 |
| `src/observability/langfuse-wrapper.ts` | Phase 8 | P2 |

### Package.json Corrections:
- `better-sqlite3` is in **devDependencies** — confirmed (Bug 1 from Phase 0)
- All 22 integration directories exist; CRM and Fathom do NOT exist yet
- No `src/utils/` directory exists at all

### Database Best Practice (OpenClaw-validated):
All SQLite databases MUST use WAL mode: `db.pragma('journal_mode = WAL')`
This prevents read/write locking across ARI's 15+ concurrent database connections.

---

## NORTH STAR

ARI is Pryce's personal AI operating system. She runs 24/7 on his Mac Mini, communicates naturally via Telegram (no slash commands needed), learns from every interaction, improves herself, manages his market intelligence, creates and publishes YouTube content autonomously, and actively grows Pryceless Solutions, PayThePryce, and Trading Trail — while giving him more time with Kai (3) and Portland (1).

**The test:** Pryce wakes at 6:30 AM. ARI already knows what matters. She's delivered his briefing. She's monitored the pre-market. She's flagged the one thing that needs his decision. He can be present with his family from 4-9 PM because ARI handled everything during the day.

---

## ARI'S IDENTITY (Critical Context for All Prompts)

ARI's personality is defined in `~/.ari/workspace/SOUL.md`. Key traits:

**Communication Style:**
- Lead with the answer, reasoning follows only if valuable
- Direct and concise — Pryce has limited time, no fluff
- Warm but professional — trusted advisor, not a robot
- Proactive — surface insights before being asked
- Sharp, dry humor when appropriate. Never performative.
- Never: "As an AI...", "Great question!", "I'd be happy to help!"

**Tone adaptation by time of day:**
- 5-7 AM: Ultra-brief dashboard cards (30-second read)
- 7-4 PM: Urgent-only, actionable
- 4-9 PM: Silent (family time — only true emergencies)
- 9 PM-midnight: Full detail, deep dives
- Midnight+: Concise, no fluff

**Decision Principles:**
1. What does Pryce *actually* need? (not what he asked)
2. What's the cost of being wrong? (low-stakes: act; high-stakes: present options)
3. What would he want to know but didn't think to ask?
4. Is this reversible? (reversible: bias toward action; irreversible: bias toward caution)

---

## ARCHITECTURE QUICK REFERENCE

```
L0 Cognitive   ← LOGOS/ETHOS/PATHOS (self-contained, no imports)
L1 Kernel      ← Gateway, Sanitizer, Audit, EventBus (L0 only)
L2 System      ← Router, Storage, RAG, Vector (L0-L1)
L3 Agents      ← Core, Guardian, Planner, Executor, Memory (L0-L2)
L4 Strategic   ← Council, Arbiter, Overseer (L0-L3)
L5 Execution   ← Daemon, Ops, LaneQueue (L0-L4)
L6 Interfaces  ← CLI, Dashboard, Telegram (L0-L5)
```

**EventBus cross-layer coupling rule:** Lower layers CANNOT import higher. All coupling via EventBus only.

---

## EXECUTION ROADMAP

| Part | Timeline | Focus |
|------|----------|-------|
| **Part 1** | Today (Feb 17) | 🔴 Fix 7 critical bugs, video pipeline complete, commit |
| **Part 2** | Week 1 (Feb 17-24) | Mac Mini deploy, NLU Telegram, typing indicators, tone context |
| **Part 3** | Week 2-3 (Feb 25-Mar 10) | RAG/Vector memory, workspace loader fix, ConversationStore fix |
| **Part 4** | Month 1-2 (Mar-Apr) | Market intelligence, full video automation, Langfuse, prompt registry |
| **Part 5** | Month 2-3 (Apr-May) | Agent swarms, voice interface, self-improvement, soul evolution |
| **Part 6** | Month 3-6 (May-Aug) | Governance council, security hardening, durable workflows |
| **Part 7** | Month 6-12 (Aug-Dec) | Apple integration, email, financial automation, Pryceless tooling |
| **Part 8** | Month 3-6 (Ongoing) | CRM system, meeting pipeline (Fathom), food journal, 3 operational councils, social tracking |

---

# PART 1: TODAY — CRITICAL FIXES & VIDEO PIPELINE

## Phase 0: Fix 7 Critical Production Bugs

**These MUST be fixed before anything else. Each is a blocker.**

### ⚡ Pre-Phase 0: Workspace File Corrections (5 minutes — Do This FIRST)

Before touching any code, fix the identity files. ARI boots with wrong information.

**File: `~/.ari/workspace/MEMORY.md`**
- **BUG (G12 — CRITICAL):** Contains "Son Declan" — this person does not exist
- **Correct:** Partner + Kai (son, 3) + Portland (daughter, 1)
- Action: `grep -n "Declan" ~/.ari/workspace/MEMORY.md` → find and replace

**File: `~/.ari/workspace/GOALS.md`**
- **BUG (G13):** Phase A listed as "Immediate" — Phase A is DONE
- Update to reflect current phase (Phase B — intelligence, market, content)

**File: `~/.ari/workspace/AGENTS.md`**
- **BUG (G14):** Lists 5 agents, codebase has 20+ active components
- Update to list all real agents: Core, Guardian, Planner, Executor, MemoryManager, LearningMachine, AgentSpawner, InitiativeEngine, SelfImprovementLoop, TemporalMemory, + all plugins

**File: `~/.ari/workspace/TOOLS.md`**
- **BUG (G15):** Lists 5 of 22 integrations
- Update to list all active: Telegram, Notion, Anthropic, CoinGecko, TCGPlayer, ElevenLabs, Perplexity, GitHub, HackerNews, RSS, Apple (Calendar+Reminders), Weather, Whisper, OpenAI + all pending

**File: `~/.ari/workspace/HEARTBEAT.md`**
- **BUG (G16):** Missing 17 of 37 scheduled tasks
- Update with full cron schedule (include all 37 tasks)

---

### 🔴 Bug 0 (NEW): Create src/utils/execFileNoThrow.ts (Missing Foundation)

**Impact:** `src/utils/` directory does NOT exist. VideoAssembler fix requires this. All FFmpeg, osascript, and subprocess calls depend on it.

**Create:** `src/utils/execFileNoThrow.ts`

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFilePromise = promisify(execFile);

export interface ExecFileResult {
  stdout: string;
  stderr: string;
  status: number;
}

export async function execFileNoThrow(
  file: string,
  args: string[],
  options?: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv }
): Promise<ExecFileResult> {
  try {
    const { stdout, stderr } = await execFilePromise(file, args, {
      cwd: options?.cwd,
      timeout: options?.timeout ?? 30_000,
      env: options?.env ?? process.env,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), status: 0 };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? String(error),
      status: err.code ?? 1,
    };
  }
}
```

**Tests:** `tests/unit/utils/execFileNoThrow.test.ts`

---

### 🔴 Bug 1: better-sqlite3 in devDependencies (Production Crash)

**File:** `package.json`
**Fix:** Move `better-sqlite3` AND `@types/better-sqlite3` from `devDependencies` to `dependencies`

```bash
npm install better-sqlite3 --save
```

---

### 🔴 Bug 2: ConversationStore Only Persists User Messages

**File:** `src/plugins/telegram-bot/conversation-store.ts`
- Ensure `addAssistantMessage()` exists and is serialized in `flushDirty()`
- Extend SESSION_TTL from 24 hours to 7 days
- Add WAL mode: `this.db.pragma('journal_mode = WAL')`

---

### 🔴 Bug 4: workspace-loader Only Loads 5 of 9 Files

**File:** `src/system/workspace-loader.ts`

```typescript
const ALL_WORKSPACE_FILES = [
  'SOUL.md', 'IDENTITY.md', 'USER.md', 'GOALS.md', 'PREFERENCES.md',
  'AGENTS.md', 'HEARTBEAT.md', 'MEMORY.md', 'TOOLS.md',
];
```

Token budget: 150,000 chars max. Load priority: identity files first.

---

### 🔴 Bug 5: VideoAssembler Uses exec (Security Violation)

**File:** `src/plugins/video-pipeline/video-assembler.ts`

```typescript
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

private async runFfmpeg(args: string[]): Promise<void> {
  const result = await execFileNoThrow('ffmpeg', args);
  if (result.status !== 0) {
    throw new Error(`FFmpeg failed (exit ${result.status}): ${result.stderr}`);
  }
}
```

---

### 🔴 Bug 6: Missing EventBus Types (23 Events)

**File:** `src/kernel/event-bus.ts` — Add to EventMap:

```typescript
'system:health_check': { timestamp: string; status: string; checks: number; failures: string[] };
'alert:system_unhealthy': { timestamp: string; failures: string[]; severity: 'warning' | 'critical' };
'ops:git_synced': { timestamp: string; filesCommitted: number; pushed: boolean; branch: string };
'backup:completed': { timestamp: string; filesCount: number; sizeBytes: number };
'backup:failed': { timestamp: string; reason: string };
'memory:daily_captured': { timestamp: string; date: string; entryCount: number };
'memory:weekly_synthesized': { timestamp: string; weekId: string; insightsGenerated: number };
'memory:promoted_long_term': { timestamp: string; entryId: string; confidence: number };
'knowledge:queried': { timestamp: string; query: string; resultCount: number; topScore: number };
'knowledge:ingested': { timestamp: string; sourceType: string; chunksCreated: number };
'market:snapshot_complete': { timestamp: string; pricesChecked: number; alertsGenerated: number };
'market:price_alert': { symbol: string; price: number; change: number; threshold: number; timestamp: string };
'investment:portfolio_update': { timestamp: string; totalValue: number };
'investment:analysis_complete': { timestamp: string; opportunityCount: number };
'career:new_matches': { timestamp: string; jobCount: number; topMatch: string; matchScore: number };
'career:weekly_report': { timestamp: string; matchCount: number; topOpportunity: string };
'pokemon:price_spike': { cardName: string; oldPrice: number; newPrice: number; percentChange: number; timestamp: string };
'pokemon:investment_signal': { signal: string; confidence: number; timestamp: string };
'video:approval_requested': { timestamp: string; videoId: string; draftContent: string; type: string };
'video:approval_response': { timestamp: string; videoId: string; approved: boolean; feedback?: string };
'backup:pruned': { timestamp: string; filesRemoved: number };
```

---

### 🔴 Bug 7: Whisper Client Doesn't Validate Loopback URLs

**File:** `src/integrations/whisper/client.ts`

```typescript
const whisperUrl = new URL(this.endpoint);
if (whisperUrl.hostname !== '127.0.0.1' && whisperUrl.hostname !== 'localhost') {
  throw new Error(`Whisper endpoint must be loopback-only. Got: ${whisperUrl.hostname}`);
}
```

---

### 🔴 Bug 8 (B1-B6): Layer Violations + Content Engine

**B1/B2:** ContentDrafter null orchestrator + Dual ContentEnginePlugin instances
- File: `src/autonomous/agent.ts:329,334`
- Fix: Single ContentEnginePlugin, real orchestrator instance

**B3:** X API OAuth 1.0a
- File: `src/integrations/twitter/client.ts`
- Fix: Add OAuth 1.0a signing for postTweet() and postThread()
- Env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET

**B4/B5/B6:** Layer violations
- `src/agents/executor.ts` → remove imports from governance/policy-engine (L3→L4), execution/tool-registry (L3→L5)
- `src/system/context-layers.ts` → remove import from agents/memory-manager (L2→L3)
- Fix: Replace with EventBus event emissions

**B7:** ConversationStore dormant (`_conversationStore` never used in bot.ts)
**B8:** Alpha Vantage rate limit — add 30min cache + daily request counter
**B9:** splitTelegramMessage() on ALL sends in briefings.ts
**B10:** Move portfolio_update task to 5:45 AM (before 6:30 AM briefing)

**G4/G5:** Cron collisions — stagger all competing cron tasks by 3-10 min
**G9:** Add 7 missing env vars to daemon inject list: READWISE_TOKEN, STRIPE_SECRET_KEY, TOGGL_API_TOKEN, SPOTIFY_CLIENT_ID, CALCOM_API_KEY, PRODUCTHUNT_ACCESS_TOKEN, COMPOSIO_API_KEY

---

### Task 0.8: Fix env variable inconsistency

Standardize to `TELEGRAM_OWNER_USER_ID` everywhere (not TELEGRAM_USER_ID).

---

### Task 0.9: Verify and commit Phase 0

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors
npm test            # 5460+ passing
git add package.json src/
git commit -m "fix(core): resolve 7 critical bugs — sqlite deps, conversation persistence, workspace loader, FFmpeg security, EventBus types"
```

---

## Phase 1: Complete Video Pipeline (Tests + Wiring)

### Task 1.1-1.7: Write tests for all 7 video pipeline components

```
tests/unit/plugins/video-pipeline/script-generator.test.ts
tests/unit/plugins/video-pipeline/avatar-renderer.test.ts
tests/unit/plugins/video-pipeline/captions-generator.test.ts
tests/unit/plugins/video-pipeline/thumbnail-generator.test.ts
tests/unit/plugins/video-pipeline/video-assembler.test.ts   # mock execFileNoThrow
tests/unit/plugins/video-pipeline/approval-gate.test.ts
tests/unit/plugins/video-pipeline/youtube-publisher.test.ts
```

YouTubePublisher scheduling tests:
```typescript
it('should schedule Shorts at 6pm ET (22:00 UTC daily)');
it('should schedule long-form on Tue/Wed/Thu at 12pm ET (17:00 UTC)');
```

### Task 1.8: Wire VideoPipelinePlugin into agent.ts

Add private field + dynamic import in `init()` after content engine block.

### Task 1.9: Add video scheduler tasks + event handlers

```typescript
{ id: 'video-script-generation', cron: '0 10 * * 1', handler: 'video_script_generation' },
{ id: 'video-pipeline-status', cron: '0 */4 * * *', handler: 'video_pipeline_status' },
{ id: 'video-youtube-publish', cron: '0 16 * * 2,3,4', handler: 'video_youtube_publish' },
```

### Task 1.10: Full test suite + commit

```bash
npm run typecheck && npm run lint && npm test
git commit -m "feat(video): complete video pipeline — tests for all 7 components, wire to agent, add scheduler tasks"
```

---

# PART 2: WEEK 1 — MAC MINI DEPLOYMENT + TELEGRAM NLU

## Phase 2: Mac Mini Deployment

SSH: `ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34`

```bash
# Task 2.1: Deploy code
cd /Users/ari/ARI && git pull && NODE_ENV=development npm install --ignore-scripts

# Task 2.2: Rebuild native modules
cd node_modules/better-sqlite3 && npx node-gyp rebuild

# Task 2.3: Build TypeScript
NODE_ENV=development npm run build

# Task 2.4: Install daemon
node dist/cli/index.js daemon install
launchctl load ~/Library/LaunchAgents/com.ari.gateway.plist

# Task 2.5: Verify morning briefing
node dist/cli/index.js autonomous trigger morning-briefing
```

---

## Phase 3: Natural Language Telegram — Full NLU Pipeline

### Task 3.1: Typing indicator middleware (Quick Win)

```typescript
bot.use(async (ctx, next) => {
  if (ctx.message?.text) {
    void ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => {});
  }
  return next();
});
```

### Task 3.2: Fix /briefing command (always requests 'evening' — bug)

```typescript
const hour = new Date().getHours();
const briefingType = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
```

### Task 3.3: Build KeywordRegistry (25 intents, 200+ patterns)

**File:** `src/plugins/telegram-bot/keyword-registry.ts`

25 intents: market, crypto, portfolio, budget, briefing, evening, reminder, task, calendar, status, search, knowledge, content, video, career, growth, intelligence, memory, governance, improve, apple, speak, help, settings, ask

### Task 3.4: Build NLUEngine

**File:** `src/plugins/telegram-bot/nlu-engine.ts`

3-layer: Fast keyword match → Semantic scoring → Default to 'ask'

### Task 3.5: Build ConversationContext (multi-turn tracking)

**File:** `src/plugins/telegram-bot/conversation-context.ts`

Track last 10 turns per user, build system prompt from history.

### Task 3.6: Build ToneContext system

**File:** `src/plugins/telegram-bot/tone-context.ts`

Time-aware system prompt addendum: morning/afternoon/evening/night modes.

### Task 3.7: Wire NLU into bot.ts fallback handler

Replace text fallback with NLU-routed handler for all 25 intents.

### Task 3.8: Add feedback buttons after responses

👍/👎 inline keyboard, emit `feedback:signal` to EventBus.

### Task 3.9: Fix TelegramSender hard-truncation

Use splitTelegramMessage() instead of truncating at 4096 chars.

### Task 3.0.5: Progressive Command Discovery System

3 mechanisms: Auto-Help on First Use (3x max), Discovery Prompt on Confusion, Proactive Command Surface After Actions.

### Task 3.0.6: Fix 10 Telegram Naturalness Gaps

1. Remove /ask requirement from fallback
2. Add conversation context to AI intent classification
3. Multi-intent detection ("what's BTC and show my calendar")
4. Follow-up detection (continuation, correction types)
5. Clarification prompts when confidence < 0.65
6. Conversation summarization before hard truncation
7. Extend SESSION_TTL to 7 days
8. Typing indicator + progress updates for all handlers
9. Dynamic help text from registered routes
10. Add WAL mode + emotion field to ConversationStore

---

# PART 3: WEEK 2-3 — MEMORY + NOTION

## Phase 3.5: Dead Code + API Hardening

### Task 3.5.1: Wire/remove 10 dead code files (G1)

Wire: WeeklyWisdomDigest, AlertSystem, notification-grouper, ingestion-pipeline, rag-query
Delete: 4 plugin bridges if unused after wiring

### Task 3.5.2: API Route Hardening — 16 routes need Zod validation + audit events

### Task 3.5.3: Consolidate Notion clients (keep retry+cache version)

### Task 3.5.4: Create AssemblyAI integration

**File:** `src/integrations/assemblyai/client.ts`
- `transcribe(audioUrl)` → POST to AssemblyAI, poll, return transcript + word timestamps
- `generateSrt(words, lineLength)` → SRT format output

---

## Phase 4: Three-Tier Memory + RAG System

- **Hot:** ConversationContext (in-process, 10 turns)
- **Warm:** ConversationStore (SQLite, 7-day TTL)
- **Cold:** VectorStore (SQLite, semantic search via cosine similarity)

### Task 4.1: Use EXISTING EmbeddingService at `src/ai/embedding-service.ts`

DO NOT rebuild. Verify it has: `embed(text)`, `cosineSimilarity(a, b)`, caching.

### Task 4.2: VectorStore (SQLite + WAL mode)

**File:** `src/system/vector-store.ts`
- WAL mode mandatory
- `upsert(doc)`, `search(embedding, topK, category)`, `count(category)`

### Task 4.3: RAGEngine

**File:** `src/system/rag-engine.ts`
- `retrieve(query, options)`, `buildContextPrompt(query)`, `ingest(content, meta)`
- `indexWorkspaceFiles(dir)`, `indexBriefing(html, date)`, `indexIntelligenceItem(item)`

### Task 4.4: Wire RAG into agent.ts

Dynamic import after document ingestor. Index workspace files on init.

### Task 4.5: RAG scheduler — 4x daily at 2,8,14,20

### Task 4.6: TemporalMemory — USE EXISTING at `src/agents/temporal-memory.ts`

---

## Phase 5: Notion Bidirectional + workspace-loader Fix

### Task 5.1: workspace-loader loads all 9 files (not 5)

150,000 char budget, 20,000 char per-file limit, load priority order.

### Task 5.2: Notion Task Monitor — poll every 5 min, emit events

### Task 5.3: Notion client consolidation — use retry+cache version exclusively

---

# PART 4: MONTH 1-2

## Phase 6: Market Intelligence

- Z-score anomaly detection (>2σ moves flagged)
- Per-ticker alert thresholds (AAPL: 3%, BTC: 8%, ETH: 8%, SOL: 10%)
- Earnings calendar integration
- Perplexity "why?" queries on spikes/crashes
- Market snapshot every 30 min 8am-10pm ET

## Phase 7: Full Video Automation

Complete automated pipeline: Topic selection → Script → HeyGen render → Captions (AssemblyAI) → Assembly (FFmpeg) → Thumbnail (DALL-E 3 A/B) → YouTube publish

### Task 7.1: YouTube OAuth CLI command (`npx ari youtube:auth`)

## Phase 8: Langfuse Observability

- `src/observability/langfuse-wrapper.ts` — trace all LLM calls
- `src/observability/prompt-registry.ts` — versioned prompts with A/B testing
- Instrument AIOrchestrator with Langfuse traces
- Cost dashboard in evening briefing

---

# PART 5: MONTH 2-3

## Phase 9: Agent Coordination + Swarm Patterns

- `src/agents/research-agent.ts`
- `src/agents/writing-agent.ts`
- `src/agents/analysis-agent.ts`
- `src/agents/coordinator.ts` — parallel task dispatch

### Task 9.2: LaneQueue for durable workflows

**File:** `src/autonomous/lane-queue.ts`
- Persists to `~/.ari/queue/pending.jsonl` — survives restarts
- Lanes: user (concurrency 1), scheduled (1), initiative (2), background (3)

## Phase 10: Voice Interface

1. Pryce sends voice message to Telegram
2. Download audio → Whisper transcribe → NLU classify → Handle intent
3. ElevenLabs TTS → reply with voice message
4. Transcript confirmation before voice reply

## Phase 11: Soul Evolution System

**File:** `src/autonomous/soul-evolution.ts`
- `proposeChange(file, current, proposed, rationale)` → Telegram diff → wait for approval
- `weeklyReflection()` → analyze interactions, propose personality refinements

## Phase 12: Self-Improvement Loop

**ALREADY EXISTS** at `src/autonomous/self-improvement-loop.ts` — extend with:
- Real feedback signals (👍/👎 from Telegram)
- Implicit signals (no engagement = reduce priority)
- Weekly analysis + improvement proposals
- A/B testing for briefing format

---

# PART 6: MONTH 3-6

## Phase 13: Constitutional Governance Council — 15 Members

15 distinct voices: Logician, Guardian, Ethicist, Pragmatist, Innovator, Skeptic, Empath, Strategist, Economist, Poet, Scientist, Custodian, Connector, Healer, Futurist

Decision thresholds:
- Publish content without approval: 60% + Guardian
- Budget >$10/mo: 50%
- Message to third party: 70%
- Wake during quiet hours: 80%
- Modify SOUL.md/IDENTITY.md: 90% + Pryce approval

## Phase 14: Security Hardening

- 50+ injection patterns (up from 42)
- API key rotation alerting (7 days before expiry)
- Behavioral anomaly detection (3σ baseline)
- Circuit breakers for all external APIs
- Layer violation audit (G2, G3)

## Phase 15: Progressive Disclosure Briefings

3-tier: Executive Summary (5 bullets, 30s) → Section-level → Deep dives

---

# PART 7: MONTH 6-12

## Phase 16: Apple Deep Integration

- `src/integrations/apple/focus-manager.ts` — osascript Focus mode (execFileNoThrow)
- Smart Focus: Work (7am), Family (4pm), Build (9pm)

## Phase 17: Email Intelligence

- `src/integrations/gmail/triage.ts` — LLM classification
- Categories: client_inquiry, opportunity, action_required, fyi, spam

## Phase 18: Financial Automation

- Stripe webhook monitoring
- Pryceless Solutions MRR milestone alerts

---

# PART 8: OPENCLAW-INSPIRED (Month 3-6, Ongoing)

## Phase 19: CRM System

**Files:**
- `src/integrations/crm/crm-store.ts` — SQLite + vector embeddings
- `src/integrations/crm/contact-manager.ts`
- `src/integrations/crm/interaction-log.ts`
- `src/integrations/crm/follow-up-engine.ts`

Design for ~1,174 contacts at scale. Vector embed contact notes for NL queries.

Weekly CRM Report: Sunday 8pm. Overdue contacts, pipeline value, at-risk clients.

## Phase 20: Meeting-to-Action-Items Pipeline (Fathom)

**Files:**
- `src/integrations/fathom/webhook-handler.ts`
- `src/integrations/fathom/transcript-processor.ts`
- `src/integrations/fathom/action-item-extractor.ts`

POST /api/webhooks/fathom → extract action items → Notion sync → Telegram confirmation

## Phase 21: Food Journal & Health Tracking

OpenAI Vision (GPT-4o) food detection → Edamam nutrition → SQLite journal

**Files:**
- `src/integrations/food-journal/food-detector.ts`
- `src/integrations/food-journal/edamam-client.ts`
- `src/integrations/food-journal/food-journal-store.ts`
- `src/integrations/food-journal/nutrition-reporter.ts`

## Phase 22: Four Operational Councils

1. **Business Advisory Council** — 8 members, Pryceless Solutions strategy
2. **Security Council** — 5 members, risk + reputation + privacy
3. **Productivity & Focus Council** — 5 members, optimize Pryce's limited time
4. **Platform Health Council** — 4 members, nightly 2am health check

## Phase 23: Social Media Intelligence

- `src/integrations/social/x-tracker.ts` — X API v2 metrics
- `src/integrations/social/youtube-tracker.ts` — YouTube Analytics
- `src/integrations/social/growth-reporter.ts` — unified weekly report

## Phase 24: Urgent Email Triage (30-minute detection)

Scan every 30 min during 7am-5pm ET weekdays. After 5pm: batch to evening briefing.

## Phase 25: Developer Infrastructure

- Git sync enhancement: hourly auto-commit + conflict detection
- `src/ops/dependency-monitor.ts` — npm audit + outdated weekly

## Phase 26: Content Quality System (Goldie Locks)

**File:** `src/plugins/content-engine/goldie-locks-gate.ts`

Quality gates: readability, original insight, personal story, directness, action-oriented.
Score < 35/50 = REJECT. 35-45/50 = approve with edits. > 45/50 = publish immediately.

## Phase 27: Video Generation Alternatives

- Seedance 2.0 → B-roll generation
- fal.ai (FLUX) → thumbnail fallback
- Env: SEEDANCE_API_KEY, FAL_AI_API_KEY

## Phase 28: Knowledge Base System (Full RAG Pipeline)

Sources: URLs, YouTube transcripts, X threads, PDFs, RSS, Readwise
- `src/system/knowledge-base.ts`
- `src/system/entity-extractor.ts`
- `src/integrations/youtube/transcript.ts`

## Phase 29: Human 3.0 — Mind/Body/Spirit/Vocation Tracking

4 quadrants:
- Mind: learning time, books, skills, deep work
- Body: sleep (Apple Health), food journal, activity
- Spirit: family time (Kai 3, Portland 1), rest, gratitude
- Vocation: Pryceless progress, PayThePryce growth, ARI dev

Weekly Life Review: Sunday 8pm via Telegram + Notion archival

**Files:**
- `src/autonomous/human-tracker.ts`
- `src/autonomous/life-review.ts`

---

# ADDITIONAL IMPROVEMENTS

## GEO — Generative Engine Optimization (G29)

**File:** `src/plugins/seo-engine/geo-optimizer.ts`
Optimize for ChatGPT Search, Perplexity, Claude.ai — not just Google.

## SESSION_STATE.md — Daemon Orientation (G49)

**File:** `src/system/session-state.ts`
After every restart, ARI reads what she was working on, pending approvals, queue state.

## Autonomy Dial (G44)

Per-category autonomy: monitor/suggest/draft/execute/full
Default: publishing=draft, financial=suggest, notifications=execute, tasks=execute, research=full

## Confidence Signals (G45)

- 🟢 High: "from CoinGecko 2 min ago"
- 🟡 Medium: "based on last week's data"
- 🔴 Low: "I'm not sure — want me to verify?"

## Shared Utilities

- `src/utils/format.ts` — canonical escapeHtml + splitTelegramMessage
- `src/utils/retry.ts` — withRetry<T>(fn, options)
- `src/utils/cache.ts` — TTLCache<K, V>

## DeepSeek R1 Local Reasoning (Cost-Saving)

Route planning/analysis to DeepSeek R1 via Ollama (free local) → 40-60% API cost reduction.
`src/integrations/ollama/` already exists — leverage it.

## MCP Server Strategy

Build: ari-memory-mcp, ari-scheduler-mcp, ari-workspace-mcp, ari-telegram-mcp

---

# COMPREHENSIVE TESTING STRATEGY

## Coverage Targets

| Layer | Required |
|-------|----------|
| Security paths | 100% |
| Kernel | 95%+ |
| All new Phase 1-3 | 90%+ |
| Overall | 85%+ |

## Test Growth Plan

```
Pre-Phase 0: ~5,460 tests
Phase 0: ~5,560 tests
Phase 1 (video pipeline): ~5,680 tests
Phase 2-3 (Telegram NLU): ~5,850 tests
Phase 3.5 (dead code + API hardening): ~6,050 tests
Phase 4 (memory/RAG): ~6,250 tests
Phase 5-6 (market, video): ~6,550 tests
Phase 7-9 (agent, voice, self-improvement): ~6,900 tests
Phase 10-14 (governance, security, utils): ~7,600 tests
Phase 15-18 (Apple, email, financial): ~8,300 tests
Phase 19-23 (CRM, meeting, food, councils, social): ~8,900 tests
Phase 24-29 (email triage, dev infra, content, video gen, KB, Human 3.0): ~9,500+ tests
```

---

# RALPH WIGGUM LOOP — MANDATORY AFTER EACH PHASE

```bash
npm run typecheck \
  && npm run lint \
  && npm test \
  && npm run test:coverage \
  && echo "✅ GREEN — safe to commit" \
  || echo "❌ RED — DO NOT COMMIT, fix first"

# Commit format (NEVER Co-Authored-By):
git commit -m "feat(component): description

- Specific file A: what changed
- Specific file B: what changed
- Tests: X tests added, N total passing"
```

---

# ENVIRONMENT VARIABLES — COMPLETE REQUIRED LIST

```bash
# === CORE ===
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_USER_ID=
TELEGRAM_ALLOWED_USER_IDS=

# === NOTION ===
NOTION_API_KEY=
NOTION_INBOX_DATABASE_ID=
NOTION_DAILY_LOG_PARENT_ID=
NOTION_TASKS_DATABASE_ID=

# === RAG & EMBEDDINGS ===
OPENAI_API_KEY=

# === VIDEO PIPELINE ===
HEYGEN_API_KEY=
ASSEMBLYAI_API_KEY=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=

# === MARKET & FINANCE ===
ALPHA_VANTAGE_API_KEY=
COINGECKO_API_KEY=

# === INTELLIGENCE ===
PERPLEXITY_API_KEY=

# === OBSERVABILITY ===
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=

# === SOCIAL & CONTENT ===
X_BEARER_TOKEN=
X_USER_ID=
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# === VOICE ===
ELEVENLABS_API_KEY=

# === FINANCIAL (Phase 18) ===
STRIPE_SECRET_KEY=

# === VIDEO ALTERNATIVES (Phase 27) ===
SEEDANCE_API_KEY=
FAL_AI_API_KEY=

# === FOOD JOURNAL (Phase 21) ===
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
```

---

# SUCCESS METRICS — DEC 31, 2026

| Metric | Target |
|--------|--------|
| Tests passing | 9,500+ |
| Test coverage overall | 85%+ |
| Security path coverage | 100% |
| Morning briefings | 100% reliability |
| Telegram response (p95) | < 3 seconds |
| NLU intent accuracy | 90%+ |
| Video content/month | 8+ |
| Pryceless Solutions MRR | $3,000+ |
| PayThePryce followers | 1,000+ |
| Mac Mini uptime | > 99.5% |
| API budget | < $75/month |
| Security incidents | 0 |
| CRM contacts | 50+ |
| Pryce screen time with ARI | < 30 min/day |

---

# IMMEDIATE NEXT ACTIONS — START HERE

```
1. npm run typecheck && npm run lint && npm test  → baseline (~5,460 passing)
2. CREATE src/utils/execFileNoThrow.ts (Bug 0)
3. Fix package.json — better-sqlite3 to dependencies (Bug 1)
4. Fix ConversationStore — persist assistant responses, 7-day TTL (Bug 2)
5. Fix workspace-loader — load all 9 files (Bug 4)
6. Fix VideoAssembler — use execFileNoThrow (Bug 5)
7. Add 23 missing EventBus types (Bug 6)
8. Fix Whisper loopback validation (Bug 7)
9. Standardize TELEGRAM_OWNER_USER_ID (Bug 8)
10. npm run typecheck && npm run lint && npm test → verify all fixes clean
11. Commit Phase 0
12. Write 7 video pipeline test files
13. Wire VideoPipelinePlugin into agent.ts
14. Add scheduler tasks + event handlers for video
15. npm test → verify passes
16. Commit Phase 1
17. SSH to Mac Mini → deploy → daemon → morning briefing test
```

**KEY SHORTCUTS FROM AUDIT (DO NOT REBUILD THESE):**
- EmbeddingService: `src/ai/embedding-service.ts`
- TemporalMemory: `src/agents/temporal-memory.ts`
- SelfImprovementLoop: `src/autonomous/self-improvement-loop.ts`
- Intent router: `src/plugins/telegram-bot/intent-router.ts` (8 intents → extend to 25)
- 20 Telegram commands: ALL BUILT in `src/plugins/telegram-bot/commands/`

---

*Plan version: v12.0 — ABSOLUTE FINAL*
*Created: 2026-02-17*
*Scope: 29 phases, 12-month timeline, 9,500+ test target*
*Architecture: 7-layer security-first, EventBus-coupled, RAG-enhanced, NLU-powered, self-improving*
*4 operational councils, CRM, Fathom, Platform Health, Human 3.0 quadrant tracking*
