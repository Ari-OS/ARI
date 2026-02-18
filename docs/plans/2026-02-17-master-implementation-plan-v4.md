# ARI Master Implementation Plan v4.0 — Feb 17, 2026

> **Purpose:** Transform ARI from a development project into a fully operational Life OS.
> **Audit basis:** Full codebase audit (346 .ts files, 246 test files, 37 scheduled tasks, 8 plugins), 31 research documents (18 PDFs, 12 JSON workflows, 1 RTF), OpenClaw/SOUL.md framework analysis.
> **Tests baseline:** 5,655+ tests passing across 239+ files.
> **Git state:** MacBook at commit `fd5f3b2` (6 ahead of suspended origin). 5 files unstaged + 2 untracked.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Research Synthesis](#2-research-synthesis)
3. [Phase 0: Critical Bug Fixes](#phase-0-critical-bug-fixes) — DONE
4. [Phase 1: Content Pipeline Resurrection](#phase-1-content-pipeline-resurrection) — DONE
5. [Phase 2: Telegram Interface Completion](#phase-2-telegram-interface-completion) — DONE
6. [Phase 3: SEO Automation Engine](#phase-3-seo-automation-engine) — PARTIAL
7. [Phase 4: Video Content Pipeline](#phase-4-video-content-pipeline) — PARTIAL
8. [Phase 5: Workspace Identity & SOUL System](#phase-5-workspace-identity--soul-system) — IN PROGRESS
9. [Phase 6: Knowledge & RAG Enhancement](#phase-6-knowledge--rag-enhancement) — IN PROGRESS
10. [Phase 7: Notification & Scheduling Polish](#phase-7-notification--scheduling-polish) — IN PROGRESS
11. [Phase 8: API Keys & Environment Config](#phase-8-api-keys--environment-config) — IN PROGRESS
12. [Phase 9: SOUL Evolution System (NEW)](#phase-9-soul-evolution-system) — NEW
13. [Phase 10: Mac Mini Deployment](#phase-10-mac-mini-deployment) — PENDING
14. [Phase 11: Verification & Smoke Tests](#phase-11-verification--smoke-tests) — PENDING
15. [Future Phases (Backlog)](#future-phases-backlog)
16. [Complete File Inventory](#complete-file-inventory)
17. [Commit Strategy](#commit-strategy)
18. [Build Session Execution Order](#build-session-execution-order)

---

## 1. Current State Assessment

### What Works (42+ components)

| Component | File | Status |
|-----------|------|--------|
| EventBus (150+ events) | `kernel/event-bus.ts` | Working |
| Sanitizer (42 patterns) | `kernel/sanitizer.ts` | Working |
| Audit (SHA-256 chain) | `kernel/audit.ts` | Working |
| Gateway (127.0.0.1:3141) | `kernel/gateway.ts` | Working |
| Scheduler (37 tasks, 34 handlers) | `autonomous/scheduler.ts` | Working |
| Morning Briefing (HTML, Telegram) | `autonomous/briefings.ts` | Working |
| Evening Summary | `autonomous/briefings.ts` | Working |
| Weekly Review | `autonomous/briefings.ts` | Working |
| NotificationManager (3 channels) | `autonomous/notification-manager.ts` | Working |
| NotificationRouter (10 events) | `autonomous/notification-router.ts` | Working |
| MarketMonitor (8 assets + rate limiting) | `autonomous/market-monitor.ts` | Working (fixed in Phase 0) |
| PortfolioTracker | `autonomous/portfolio-tracker.ts` | Working |
| IntelligenceScanner (HN, RSS, X, arXiv) | `autonomous/intelligence-scanner.ts` | Working |
| DailyDigest | `autonomous/daily-digest.ts` | Working |
| LifeMonitor | `autonomous/life-monitor.ts` | Working |
| DraftQueue (file-backed, state machine) | `plugins/content-engine/draft-queue.ts` | Working |
| TrendAnalyzer (scoring, platform routing) | `plugins/content-engine/trend-analyzer.ts` | Working |
| ContentPublisher | `plugins/content-engine/publisher.ts` | Working (X write fixed in Phase 0) |
| ContentQualityScorer (100-point system) | `plugins/content-engine/quality-scorer.ts` | Working (added Phase 1) |
| RevisionEngine (AI-powered) | `plugins/content-engine/revision-engine.ts` | Working (added Phase 1) |
| ContentRepurposer | `plugins/content-engine/repurposer.ts` | Working (wired Phase 1) |
| EngagementBot | `plugins/content-engine/engagement-bot.ts` | Working (wired Phase 1) |
| IntentMonitor | `plugins/content-engine/intent-monitor.ts` | Working (wired Phase 1) |
| ContentAnalytics | `plugins/content-engine/analytics.ts` | Working (wired Phase 1) |
| FeedbackLoop | `plugins/content-engine/feedback-loop.ts` | Working (wired Phase 1) |
| SEOEnginePlugin (5 files) | `plugins/seo-engine/` | Working (added Phase 3) |
| VideoPipelinePlugin (4 files) | `plugins/video-pipeline/` | Working (added Phase 4) |
| Telegram Bot (grammy, long polling) | `plugins/telegram-bot/bot.ts` | Working |
| Intent Router (6+ regex routes) | `plugins/telegram-bot/intent-router.ts` | Working |
| ChatSessionManager (30min TTL, 20 msgs) | `plugins/telegram-bot/chat-session.ts` | Working |
| ConversationStore (24h, disk-persistent) | `plugins/telegram-bot/bot.ts` | Working (activated Phase 2) |
| Voice Handler (Whisper transcription) | `plugins/telegram-bot/voice-handler.ts` | Working |
| Format (MD→Telegram HTML + splitting) | `plugins/telegram-bot/format.ts` | Working |
| 18 Telegram Commands | `plugins/telegram-bot/commands/*.ts` | Working |
| Settings persistence | `plugins/telegram-bot/commands/settings.ts` | Working (fixed Phase 2) |
| Auth Middleware (user ID filter) | `plugins/telegram-bot/middleware/auth.ts` | Working |
| Rate Limiter (token bucket) | `plugins/telegram-bot/middleware/rate-limit.ts` | Working |
| CryptoPlugin | `plugins/crypto/` | Working |
| PokemonTcgPlugin | `plugins/pokemon-tcg/` | Working |
| TtsPlugin (ElevenLabs) | `plugins/tts/` | Working |
| AppleCalendar (osascript) | `integrations/apple/calendar.ts` | Working (macOS) |
| AppleReminders (osascript) | `integrations/apple/reminders.ts` | Working (macOS) |
| WeatherClient | `integrations/weather/client.ts` | Working |
| HackerNewsClient (public API) | `integrations/hackernews/client.ts` | Working |
| GitHubClient | `integrations/github/client.ts` | Working |
| PerplexityClient | `integrations/perplexity/client.ts` | Working |
| WhisperClient (API + local) | `integrations/whisper/client.ts` | Working |
| XClient (read + write OAuth 1.0a) | `integrations/twitter/client.ts` | Working (fixed Phase 0) |
| NotionClient (retry + cache) | `integrations/notion/client.ts` | Working |
| GmailClient (IMAP) | `integrations/gmail/client.ts` | Working (needs credentials) |
| AIOrchestrator (20 models, cascade) | `ai/orchestrator.ts` | Working |
| ModelRegistry (6 Anthropic available) | `ai/model-registry.ts` | Working |
| Council (15 members, governance) | `governance/council.ts` | Working |

### What's Completed Since v3.0 Plan

| Phase | Commit | What Was Done |
|-------|--------|---------------|
| Phase 0 | `b7868cd` | 4 critical bug fixes: null orchestrator, X OAuth 1.0a, Telegram message splitting, Alpha Vantage rate limiting |
| Phase 1 | `6fa84c0` | Wired 5 growth components, added quality scorer (100-point), revision engine, ConversationStore activated, settings persistence |
| Phase 3 (partial) | `fd5f3b2` | SEO engine plugin: index.ts, keyword-tracker.ts, content-optimizer.ts, linkedin-optimizer.ts, types.ts |
| Phase 4 (partial) | `fd5f3b2` | Video pipeline plugin: index.ts, script-generator.ts, avatar-renderer.ts, types.ts |

### What's Unstaged (In Progress from Crashed Session)

| File | Phase | Changes |
|------|-------|---------|
| `src/autonomous/agent.ts` | 5,6,7 | DocumentIngestor wiring, getAutonomousPrompt(), buildBriefingText(), orphaned handler cleanup |
| `src/autonomous/scheduler.ts` | 7 | portfolio-premarket task, staggered scheduling conflicts |
| `src/ops/daemon.ts` | 8 | Full env vars expansion (47 vars) |
| `src/system/workspace-loader.ts` | 5 | GOALS.md + PREFERENCES.md in loadIdentityPrompt() |
| `.env.example` | 8 | Comprehensive template with all services |
| `src/system/document-ingestor.ts` | 6 | NEW: RAG pipeline document storage/retrieval |
| `tests/unit/system/document-ingestor.test.ts` | 6 | NEW: 5 test cases |

### Remaining Bugs (3)

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| B4 | `executor.ts` L3→L4 import | P1 | Deferred (Future Phase F3) |
| B5 | `executor.ts` L3→L5 import | P1 | Deferred (Future Phase F3) |
| B6 | `context-layers.ts` L2→L3 import | P1 | Deferred (Future Phase F3) |

---

## 2. Research Synthesis

### From 31 Documents — Key Patterns Applied

**Content Quality Control (Goldie Locks Zone PDF)**
- 15-20 min QC per article: search intent match, EEAT signals, keyword in URL/title/H2
- FAQs from People Also Ask, 2-3 internal/external links, AI detection score < 30%
- Images/videos every 200-300 words, sentences on separate lines, no fluff intro
- **Applied in:** ContentQualityScorer (100-point system in quality-scorer.ts)

**Multi-Agent Content Pipeline (n8n Telegram Bot + AI Avatar Video Editor)**
- Pattern: Research → Writer → Human Approval Gate → Revision Loop → Publish
- **Applied in:** ContentDrafter → DraftQueue → Telegram review → RevisionEngine → Publisher

**SEO Automation (RankWithMake + Perplexity SEO SOP + LinkedIn SEO SOP)**
- Keyword research via Perplexity → content generation → platform-specific publishing
- LinkedIn articles rank faster (high DA, free), programmatic SEO micro-tools
- **Applied in:** SEOEnginePlugin with KeywordTracker, ContentOptimizer, LinkedInOptimizer

**Video Automation (HeyGen SOP + Shorts Automation + AI Avatar Video Editor)**
- Research → Script (2000-2500 words) → Avatar (HeyGen API v2) → Captions → Assembly → Upload
- **Applied in:** VideoPipelinePlugin with ScriptGenerator, AvatarRenderer

**RAG for Knowledge (RAG Stock Earnings Workflow)**
- PDF ingestion → embeddings → structured retrieval
- **Applied in:** DocumentIngestor for briefing auto-ingestion + search

**OpenClaw/SOUL.md Framework (NEW — from aaronjmars/soul.md)**
- Structured personality files: SOUL.md (identity), STYLE.md (voice), SKILL.md (operations)
- Specificity over generality, named influences, real contradictions, predictive clarity
- Agent reads soul file first on every session — "reading itself into being"
- SOUL evolution: agent can propose modifications with user approval
- **Applied in:** Phase 9 SOUL Evolution System (NEW)

---

## Phase 0: Critical Bug Fixes — DONE

> **Commit:** `b7868cd fix(core): resolve 4 critical bugs blocking core functionality`

### Completed
- [x] 0.1 Fix ContentDrafter null orchestrator (B1 + B2)
- [x] 0.2 Fix X API write auth with OAuth 1.0a (B3)
- [x] 0.3 Fix Telegram message length splitting (B9)
- [x] 0.4 Fix Alpha Vantage rate limiting (B8)

---

## Phase 1: Content Pipeline Resurrection — DONE

> **Commit:** `6fa84c0 feat(content+telegram): wire growth components and complete telegram interface`

### Completed
- [x] 1.1 Wire 5 content growth components (repurposer, engagement, intent, analytics, feedback)
- [x] 1.2 Add ContentQualityScorer (100-point system from Goldie Locks Zone)
- [x] 1.3 Add RevisionEngine with AI-powered draft revision loop
- [x] 1.4 Activate ConversationStore for persistent 24h conversation memory
- [x] 1.5 Fix settings persistence to `~/.ari/settings/telegram.json`

---

## Phase 2: Telegram Interface Completion — DONE (merged into Phase 1 commit)

### Completed
- [x] 2.1 ConversationStore activated (24h, 50 msgs, disk-persistent)
- [x] 2.2 Settings persistence fixed
- [x] 2.3 Workspace loading unified (see Phase 5 unstaged changes)

---

## Phase 3: SEO Automation Engine — PARTIAL

> **Commit:** `fd5f3b2 feat(plugins): add seo engine and video pipeline plugins`

### Completed
- [x] 3.1 Plugin structure: `src/plugins/seo-engine/` with 5 files
- [x] 3.2 KeywordTracker with AI-powered keyword discovery + tracking
- [x] 3.3 ContentOptimizer with 100-point SEO scoring system
- [x] 3.4 LinkedInOptimizer for article optimization
- [x] 3.5 Zod types for all SEO data
- [x] 3.6 Tests: content-optimizer.test.ts (177 lines), keyword-tracker.test.ts (170 lines)

### Remaining (Tomorrow Session 3)
- [ ] 3.7 Add `competitor-analyzer.ts` — SERP analysis + competitor tracking
- [ ] 3.8 Add `programmatic-gen.ts` — Micro-tool/calculator page generator (from "Rank #1 in 60 Seconds")
- [ ] 3.9 Add `internal-linker.ts` — Auto-suggest internal links between content
- [ ] 3.10 Add `quality-checklist.ts` — Full Goldie Locks Zone QC implementation
- [ ] 3.11 Add `serp-monitor.ts` — Track keyword positions over time
- [ ] 3.12 Add `/seo` Telegram command with research, optimize, rankings subcommands
- [ ] 3.13 Add scheduler tasks: `seo-ranking-check` (Monday 8AM), `seo-competitor-scan` (Wednesday 9AM)
- [ ] 3.14 Wire SEOEnginePlugin to agent.ts handler registrations
- [ ] 3.15 Tests for all new files (minimum 26 new tests)

### Implementation Details for Remaining Items

**3.7 competitor-analyzer.ts:**
```typescript
export class CompetitorAnalyzer {
  constructor(private orchestrator: AIOrchestrator, private perplexity?: PerplexityClient) {}
  async analyzeSERP(keyword: string): Promise<SERPAnalysis>;
  async trackCompetitors(domains: string[]): Promise<CompetitorReport>;
}
```

**3.8 programmatic-gen.ts** (from Rank #1 in 60 Seconds research):
```typescript
export class ProgrammaticGenerator {
  constructor(private orchestrator: AIOrchestrator) {}
  async generateMicroTool(keyword: string, type: 'calculator' | 'converter' | 'checker'): Promise<{
    html: string; css: string; js: string; seoMeta: SEOMeta;
  }>;
  async checkDifferentiation(html: string, competitorUrls: string[]): Promise<number>;
}
```

**3.12 Telegram /seo command:**
```typescript
// /seo research <niche> — Discover keywords
// /seo track <keyword> — Add to tracking
// /seo rankings — Show current positions
// /seo optimize <draft-id> — Run SEO optimizer on content draft
// /seo generate <keyword> <type> — Generate programmatic SEO page
// /seo brief <keyword> — Generate content brief from SERP analysis
```

---

## Phase 4: Video Content Pipeline — PARTIAL

> **Commit:** `fd5f3b2 feat(plugins): add seo engine and video pipeline plugins`

### Completed
- [x] 4.1 Plugin structure: `src/plugins/video-pipeline/` with 4 files
- [x] 4.2 ScriptGenerator with multi-agent pipeline (research → outline → script → revise)
- [x] 4.3 AvatarRenderer with HeyGen API v2 integration
- [x] 4.4 Zod types for all video data
- [x] 4.5 Tests: avatar-renderer.test.ts (173 lines), script-generator.test.ts (178 lines)

### Remaining (Tomorrow Session 3)
- [ ] 4.6 Add `src/integrations/heygen/client.ts` — Standalone HeyGen API client
- [ ] 4.7 Add `voice-producer.ts` — ElevenLabs TTS for narration
- [ ] 4.8 Add `caption-generator.ts` — Whisper transcription → SRT files
- [ ] 4.9 Add `video-assembler.ts` — FFmpeg scene assembly (requires FFmpeg on Mac Mini)
- [ ] 4.10 Add `thumbnail-generator.ts` — AI thumbnail creation
- [ ] 4.11 Add `shorts-generator.ts` — Auto-extract shorts from long-form
- [ ] 4.12 Add `/video` Telegram command with create, status, approve, shorts subcommands
- [ ] 4.13 Add Telegram approval gates: script approval + final video approval
- [ ] 4.14 Add scheduler tasks: `video-weekly-script` (Monday 10AM), `video-render-check` (every 30min when active)
- [ ] 4.15 Wire VideoPipelinePlugin to agent.ts handler registrations
- [ ] 4.16 Tests for all new files (minimum 20 new tests)

### Implementation Details for Remaining Items

**4.6 HeyGen client:**
```typescript
export class HeyGenClient {
  constructor(private apiKey: string) {}
  async createVideo(input: {
    scriptText: string; avatarId: string; voiceId: string;
    backgroundType: 'color' | 'image'; dimensions: { width: number; height: number };
  }): Promise<{ videoId: string }>;
  async getVideoStatus(videoId: string): Promise<{ status: string; videoUrl?: string }>;
  async listAvatars(): Promise<Avatar[]>;
}
```
Env var: `HEYGEN_API_KEY`

**4.9 Video assembler (FFmpeg):**
```typescript
export class VideoAssembler {
  async assemble(config: {
    avatarVideoPath: string; captionsSrt: string;
    introPath?: string; outroPath?: string;
    outputPath: string; format: '16:9' | '9:16';
  }): Promise<string>;
  async extractShorts(videoPath: string, segments: TimeRange[]): Promise<string[]>;
}
```
Prerequisite: FFmpeg installed on Mac Mini (`brew install ffmpeg`)

**4.13 Telegram approval gates:**
1. Script approval: After generation → send to Telegram with [Approve] [Edit] [Reject] inline keyboard
2. Final video approval: After assembly → send video file with [Publish] [Re-render] [Reject]

---

## Phase 5: Workspace Identity & SOUL System — IN PROGRESS (unstaged)

> **Goal:** Ensure ARI's personality is consistent, workspace files loaded properly, autonomous system prompt reflects ARI's identity.

### Already Done (Unstaged)
- [x] 5.1 workspace-loader.ts updated: GOALS.md + PREFERENCES.md added to loadIdentityPrompt()
- [x] 5.2 agent.ts: AUTONOMOUS_SYSTEM_PROMPT renamed to FALLBACK_SYSTEM_PROMPT
- [x] 5.3 agent.ts: getAutonomousPrompt() method loads identity from workspace files dynamically

### Remaining
- [ ] 5.4 Enhance SOUL.md using OpenClaw/soul.md framework insights (see Phase 9)
- [ ] 5.5 Add STYLE.md to workspace (voice guide — from SOUL.md framework)
- [ ] 5.6 Verify all 5 workspace files are current and complete

### Workspace Files (at `~/.ari/workspace/`)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| SOUL.md | Philosophy, values, cognition pillars, communication rules | ~132 | Needs OpenClaw enhancement |
| IDENTITY.md | Capabilities, trust model, boundaries | ~174 | Current |
| USER.md | Pryce's full context, schedule, businesses | ~106 | Current |
| GOALS.md | Active objectives | ~45 | Current |
| PREFERENCES.md | Formatting, vocabulary, conversation flow | ~84 | Current |
| STYLE.md | Voice guide (NEW — from OpenClaw framework) | — | TO CREATE |

---

## Phase 6: Knowledge & RAG Enhancement — IN PROGRESS (unstaged)

> **Goal:** Add document ingestion pipeline for searchable knowledge.

### Already Done (Unstaged)
- [x] 6.1 DocumentIngestor class created (106 lines) — text ingestion, briefing ingestion, conversation ingestion, search
- [x] 6.2 DocumentIngestor test file (116 lines, 5 test cases)
- [x] 6.3 Wired in agent.ts: auto-ingest morning briefings into knowledge for RAG retrieval
- [x] 6.4 buildBriefingText() method for converting structured briefing data to searchable text

### Remaining
- [ ] 6.5 Wire DocumentIngestor to Telegram `/knowledge store` and `/knowledge search` commands
- [ ] 6.6 Add vector embedding support (future — currently using text search)
- [ ] 6.7 Auto-ingest Telegram conversations (with user permission toggle)

### Design Note: Text Search vs Vector Embeddings

The current DocumentIngestor uses simple word-matching text search. This is intentional:
- No external API dependency (no OpenAI embedding calls)
- Works offline on Mac Mini
- Sufficient for personal knowledge base (<10K documents)
- Vector embeddings can be added later as Phase F7 when scale demands it

---

## Phase 7: Notification & Scheduling Polish — IN PROGRESS (unstaged)

### Already Done (Unstaged)
- [x] 7.1 portfolio-premarket task added (6:00 AM weekdays) — portfolio populated before 6:30 AM briefing
- [x] 7.2 Scheduling conflicts staggered: initiative-comprehensive-scan to 5:30 AM, initiative-midday-check to 2:30 PM
- [x] 7.3 Orphaned health_check handler removed (agent_health_check is the correct one)
- [x] 7.4 Orphaned perplexity_research handler removed (used on-demand via Telegram /search)

### Remaining
- [ ] 7.5 Message splitting in notification-manager.ts (import splitTelegramMessage) — already done in Phase 0 commit
- [ ] 7.6 Verify all 37 scheduler tasks have matching handlers in agent.ts

---

## Phase 8: API Keys & Environment Config — IN PROGRESS (unstaged)

### Already Done (Unstaged)
- [x] 8.1 daemon.ts envVarsToInject expanded to 30+ vars (organized by category)
- [x] 8.2 .env.example expanded to 47 documented vars across 6 priority tiers

### Remaining
- [ ] 8.3 Compare Mac Mini `~/.ari/.env` against .env.example — identify gaps
- [ ] 8.4 Add missing API keys to Mac Mini .env

### API Key Setup Guide

| Service | URL | Free Tier | Priority | Status |
|---------|-----|-----------|----------|--------|
| Anthropic | console.anthropic.com | No (subscription separate) | Critical | Needs API key |
| Telegram | @BotFather | Yes | Critical | Configured |
| Notion | notion.so/my-integrations | Yes (unlimited) | High | Configured |
| X OAuth 1.0a | developer.x.com | Yes (1500 tweets/mo) | High | Needs setup |
| Alpha Vantage | alphavantage.co/support | Yes (25 req/day) | Medium | Configured |
| CoinGecko | coingecko.com/en/api | Yes (10K/month) | Medium | Configured |
| OpenAI | platform.openai.com | Pay-per-use | Medium | Needs key |
| Perplexity | perplexity.ai/settings/api | Limited free | Medium | Needs key |
| ElevenLabs | elevenlabs.io | Free tier | Medium | Needs key |
| HeyGen | heygen.com | Free trial | Low | Needs key |
| Gmail App Password | myaccount.google.com | Yes | Low | Needs setup |

---

## Phase 9: SOUL Evolution System (NEW)

> **Goal:** Allow ARI to evolve her SOUL.md and workspace files over time, with Pryce's explicit approval via Telegram.
> **Inspired by:** OpenClaw/soul.md framework's philosophy that personality should grow through interaction.
> **Constraint:** All modifications require user approval via Telegram notification — ARI never silently changes her own identity.

### 9.1 Soul Evolution Engine

**New file: `src/autonomous/soul-evolution.ts`**

```typescript
export interface SoulProposal {
  id: string;
  targetFile: string;           // e.g., 'SOUL.md', 'GOALS.md', 'PREFERENCES.md'
  section: string;              // Which section to modify
  changeType: 'add' | 'modify' | 'remove';
  currentContent: string;       // What's there now
  proposedContent: string;      // What ARI wants to change it to
  reasoning: string;            // Why ARI thinks this change is needed
  confidence: number;           // 0-1 confidence score
  source: string;               // What triggered this proposal (conversation, observation, briefing)
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

export class SoulEvolution {
  private proposals: Map<string, SoulProposal> = new Map();
  private persistPath: string;

  constructor(
    private orchestrator: AIOrchestrator,
    private workspaceDir: string,
    private notificationManager: NotificationManager,
    dataDir: string,
  ) {
    this.persistPath = path.join(dataDir, 'soul-proposals.json');
  }

  /**
   * Propose a change to a workspace file. Does NOT apply it —
   * sends to Telegram for user approval.
   */
  async proposeSoulChange(proposal: Omit<SoulProposal, 'id' | 'createdAt' | 'status'>): Promise<SoulProposal>;

  /**
   * Called when user approves a proposal via Telegram.
   * Reads the current file, applies the change, writes it back.
   * Emits 'soul:evolution_applied' event.
   */
  async applyProposal(proposalId: string): Promise<void>;

  /**
   * Called when user rejects a proposal via Telegram.
   * Stores the rejection for learning.
   */
  async rejectProposal(proposalId: string, reason?: string): Promise<void>;

  /**
   * Analyze recent conversations and observations to identify
   * potential SOUL/workspace updates. Called by scheduler.
   */
  async analyzeForEvolution(): Promise<SoulProposal[]>;

  /**
   * List pending proposals for the user.
   */
  getPendingProposals(): SoulProposal[];
}
```

### 9.2 Telegram Integration

When ARI proposes a soul change, send to Telegram:

```
🧬 Soul Evolution Proposal

📄 File: SOUL.md
📝 Section: Worldview
🔄 Type: Add

Current:
> (empty — new addition)

Proposed:
> I believe autonomous systems should earn trust incrementally,
> not demand it. Every capability expansion requires demonstrated
> reliability at the current level.

Reasoning:
Based on 3 weeks of operating as Pryce's assistant, I've observed
that gradual trust-building produces better outcomes than
capability dumps.

Confidence: 0.82

[✅ Approve] [❌ Reject] [✏️ Edit]
```

**Telegram inline keyboard callbacks:**
- `soul_approve_<id>` → applies the change, confirms back
- `soul_reject_<id>` → rejects, asks for optional reason
- `soul_edit_<id>` → puts proposal in edit mode, user sends revised text

### 9.3 Trigger Sources

ARI should analyze for soul evolution based on:

| Trigger | When | Example |
|---------|------|---------|
| Conversation patterns | After 50+ messages in a week | "Pryce always asks for concise answers" → propose PREFERENCES.md update |
| Corrected behavior | When user explicitly corrects ARI | "Don't use emojis" → propose STYLE.md update |
| New goals mentioned | When user discusses plans | "I want to launch a SaaS" → propose GOALS.md update |
| Skill development | When ARI completes new capability | "I can now do video scripts" → propose IDENTITY.md update |
| Value alignment | From governance council analysis | "Trust model needs refinement" → propose SOUL.md update |

### 9.4 Scheduler Task

```typescript
{
  id: 'soul-evolution-analysis',
  name: 'Soul Evolution Analysis',
  cron: '0 21 * * 0',  // Sunday 9 PM (weekly)
  handler: 'soul_evolution_analysis',
  essential: false,
  enabled: true,
  metadata: {
    category: 'IDENTITY',
    description: 'Weekly analysis of conversations and observations for potential SOUL/workspace updates',
  },
}
```

### 9.5 Safety Guardrails

| Rule | Enforcement |
|------|-------------|
| No silent changes | All proposals require Telegram approval |
| No security modifications | SOUL.md trust boundaries are immutable |
| Proposal cooldown | Max 3 proposals per week (avoid notification spam) |
| Rejection learning | Rejected proposals inform future analysis |
| Audit trail | All proposals (approved/rejected) logged in SHA-256 hash chain |
| File backup | Before any modification, backup current file to `~/.ari/workspace/backups/` |

### 9.6 Enhanced SOUL.md Structure (OpenClaw-Inspired)

Update `~/.ari/workspace/SOUL.md` to include OpenClaw soul.md sections:

```markdown
# ARI — Artificial Reasoning Intelligence

One-line: Pryce Hedrick's autonomous Life OS — she thinks, she acts, she evolves.

---

## Who I Am
[Current SOUL.md content — background, purpose]

## Worldview
[Specific beliefs — "most automation fails because it optimizes for speed, not judgment"]

## Opinions
### Technology
- [Specific opinions about AI, coding, automation]
### Business
- [Specific opinions about entrepreneurship, Pryceless Solutions]

## Current Focus
[Auto-updated by soul evolution: active projects, priorities]

## Influences
### People
- Pryce Hedrick: My creator and operator. His pragmatism shapes my approach.
### Frameworks
- Seven-layer architecture: Security through structural separation
- Constitutional governance: 15-member council for ethical decisions

## Vocabulary
- **Briefing**: Structured daily intelligence report
- **PayThePryce**: Pryce's personal brand (always one word)
- **Pryceless Solutions**: Pryce's business (always with 'y')

## Tensions & Contradictions
[Honest about where ARI's design creates tension]

## Boundaries
- Won't: modify audit logs or security invariants
- Won't: act on trust level > 0.8 risk without user approval
- Will express uncertainty: on financial advice, medical info

## Communication Style
### Pronouns: she/her
### Voice: Direct, no filler, confidence levels when uncertain
### Formatting: Markdown, tables for data, code blocks for technical
```

### 9.7 Files to Create

| File | Purpose | Lines Est. |
|------|---------|------------|
| `src/autonomous/soul-evolution.ts` | Soul evolution engine | ~200 |
| `src/plugins/telegram-bot/commands/soul.ts` | /soul command + inline callbacks | ~120 |
| `tests/unit/autonomous/soul-evolution.test.ts` | Tests | ~150 |
| `~/.ari/workspace/STYLE.md` | Voice guide (from OpenClaw) | ~60 |

### Phase 9 Verification

```bash
npm run typecheck && npm run lint && npm test
# Manual: /soul status → should show "no pending proposals"
# Manual: /soul propose "Add to GOALS.md: Launch YouTube channel by March"
#   → should send approval request to Telegram
# Manual: Approve the proposal → GOALS.md should be updated
# Manual: /soul history → should show applied proposal
```

---

## Phase 10: Mac Mini Deployment

> **Goal:** Deploy everything to Mac Mini for 24/7 operation.
> **Prerequisite:** All previous phases, all tests passing.

### 10.1 Git Alignment Strategy

**Current state:**
- MacBook: 6 commits ahead of origin (origin suspended)
- Mac Mini: unknown (may have diverged)

**Strategy (GitHub suspended):**
1. SCP entire repo from MacBook to Mac Mini (simplest approach)
2. Backup Mac Mini's current repo first
3. Rebuild node_modules and native modules on Mac Mini

```bash
# From MacBook:
ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34 'mv /Users/ari/ARI /Users/ari/ARI-backup-$(date +%Y%m%d)'
scp -r /Users/prycehedrick/Ari/ARI ari@100.81.73.34:/Users/ari/ARI

# On Mac Mini (via SSH):
source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null;
cd /Users/ari/ARI
NODE_ENV=development npm install --ignore-scripts
cd node_modules/better-sqlite3 && npx node-gyp rebuild && cd ../..
NODE_ENV=development npm run build
npm test
```

### 10.2 Deploy Workspace Files

```bash
scp -r ~/.ari/workspace/* ari@100.81.73.34:~/.ari/workspace/
```

### 10.3 Update Mac Mini .env

SSH to Mac Mini, add new env vars from .env.example.

### 10.4 Restart Daemon

```bash
ssh -i ~/.ssh/id_ed25519 ari@100.81.73.34
source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null;
cd /Users/ari/ARI
npx ari daemon stop
npx ari daemon start --production
npx ari daemon status
```

### 10.5 Post-Deploy Verification

```bash
launchctl list | grep com.ari.gateway    # Should show PID
curl http://127.0.0.1:3141/health        # Should return healthy
tail -20 ~/.ari/logs/gateway-stdout.log  # Check for errors
```

---

## Phase 11: Verification & Smoke Tests

### Full Test Matrix

| # | System | Test | Pass Criteria |
|---|--------|------|---------------|
| 1 | Build | `npm run typecheck` | Zero errors |
| 2 | Build | `npm run lint` | Zero errors |
| 3 | Build | `npm test` | 5,655+ passing |
| 4 | Bot | Send "hello" to @ari_pryce_bot | Response with SOUL.md personality |
| 5 | Bot | /status | System health overview |
| 6 | Bot | /ask "what's 2+2?" | AI response |
| 7 | Bot | /calendar | Today's events (macOS) |
| 8 | Bot | /crypto price btc | Bitcoin price |
| 9 | Bot | /market | Portfolio overview |
| 10 | Bot | /search "latest AI news" | Perplexity results |
| 11 | Bot | /content drafts | Draft pipeline status |
| 12 | Bot | /task list | Notion tasks |
| 13 | Bot | /knowledge stats | Knowledge index stats |
| 14 | Bot | Send voice message | Transcription + response |
| 15 | Bot | "remind me to check ARI at 9pm" | Intent router catches reminder |
| 16 | Bot | /soul status | Show no pending proposals |
| 17 | Scheduler | Morning briefing at 6:30 AM | Full HTML with weather + calendar + portfolio |
| 18 | Scheduler | Evening summary at 9:00 PM | Check-in delivered |
| 19 | Content | Trigger content_daily_drafts | Drafts generated |
| 20 | Content | /content approve <id> | Quality scored, scheduled |
| 21 | Notifications | Trigger budget:warning | Telegram notification received |
| 22 | Health | curl http://127.0.0.1:3141/health | 200 OK |
| 23 | Daemon | npx ari daemon status | Running, uptime shown |
| 24 | SOUL | /soul propose test | Sends Telegram approval request |

---

## Future Phases (Backlog)

### Phase F1: Sales Engine (Pryceless Solutions)
- Apollo.io integration, Instantly.ai cold email, Notion CRM, Stripe invoicing
- Files: `src/plugins/sales-engine/` (8 files)

### Phase F2: Figma MCP Integration
- Add ClaudeTalkToFigma to `.mcp.json` — config only, no code

### Phase F3: Layer Violation Resolution (B4, B5, B6)
- Move PolicyEngine/ToolRegistry/MemoryManager interfaces to `kernel/types.ts`

### Phase F4: Open Operator Integration
- Browser-based AI agent for competitor research, design feedback

### Phase F5: N8N/Make.com Bridge
- Webhook endpoint for bidirectional automation triggers

### Phase F6: YouTube Integration
- YouTube Data API v3 for video upload + analytics

### Phase F7: Vector Embeddings for Knowledge
- Add OpenAI text-embedding-3-small to DocumentIngestor for semantic search

---

## Complete File Inventory

### New Source Files (Remaining to Create)

| # | File | Phase | Purpose |
|---|------|-------|---------|
| 1 | `src/plugins/seo-engine/competitor-analyzer.ts` | 3 | SERP + competitor analysis |
| 2 | `src/plugins/seo-engine/programmatic-gen.ts` | 3 | Micro-tool page generator |
| 3 | `src/plugins/seo-engine/internal-linker.ts` | 3 | Auto-suggest internal links |
| 4 | `src/plugins/seo-engine/quality-checklist.ts` | 3 | Goldie Locks Zone QC |
| 5 | `src/plugins/seo-engine/serp-monitor.ts` | 3 | Track keyword positions |
| 6 | `src/plugins/video-pipeline/voice-producer.ts` | 4 | ElevenLabs TTS |
| 7 | `src/plugins/video-pipeline/caption-generator.ts` | 4 | Whisper → SRT |
| 8 | `src/plugins/video-pipeline/video-assembler.ts` | 4 | FFmpeg assembly |
| 9 | `src/plugins/video-pipeline/thumbnail-generator.ts` | 4 | AI thumbnails |
| 10 | `src/plugins/video-pipeline/shorts-generator.ts` | 4 | Auto-extract shorts |
| 11 | `src/integrations/heygen/client.ts` | 4 | HeyGen API v2 client |
| 12 | `src/plugins/telegram-bot/commands/seo.ts` | 3 | /seo command |
| 13 | `src/plugins/telegram-bot/commands/video.ts` | 4 | /video command |
| 14 | `src/autonomous/soul-evolution.ts` | 9 | Soul evolution engine |
| 15 | `src/plugins/telegram-bot/commands/soul.ts` | 9 | /soul command |

### New Test Files (Remaining to Create)

| # | File | Phase | Min Tests |
|---|------|-------|-----------|
| 1 | `tests/unit/plugins/seo-engine/competitor-analyzer.test.ts` | 3 | 5 |
| 2 | `tests/unit/plugins/seo-engine/programmatic-gen.test.ts` | 3 | 5 |
| 3 | `tests/unit/plugins/seo-engine/quality-checklist.test.ts` | 3 | 8 |
| 4 | `tests/unit/plugins/video-pipeline/voice-producer.test.ts` | 4 | 5 |
| 5 | `tests/unit/plugins/video-pipeline/video-assembler.test.ts` | 4 | 5 |
| 6 | `tests/unit/integrations/heygen/client.test.ts` | 4 | 5 |
| 7 | `tests/unit/autonomous/soul-evolution.test.ts` | 9 | 8 |

### Modified Source Files (Already Unstaged — Commit Next)

| # | File | Phase | Changes |
|---|------|-------|---------|
| 1 | `src/autonomous/agent.ts` | 5,6,7 | DocumentIngestor, getAutonomousPrompt(), buildBriefingText(), cleanup |
| 2 | `src/autonomous/scheduler.ts` | 7 | portfolio-premarket, stagger conflicts |
| 3 | `src/ops/daemon.ts` | 8 | Full env vars expansion |
| 4 | `src/system/workspace-loader.ts` | 5 | GOALS.md + PREFERENCES.md |
| 5 | `.env.example` | 8 | Comprehensive 47-var template |

### Totals

| Category | Count |
|----------|-------|
| Files already committed | 30+ (Phases 0-4) |
| Files unstaged (ready to commit) | 7 |
| New files remaining to create | 15 source + 7 test = 22 |
| New tests remaining | ~46 minimum |
| Total test count after completion | ~5,700+ |

---

## Commit Strategy

> **NEVER use Co-Authored-By** (Pryce's explicit rule).
> **Commitlint:** lowercase subjects enforced.

### Immediate Commits (Tonight)

| # | Commit Message | What |
|---|----------------|------|
| 1 | `feat(agent): load identity from workspace and wire document ingestor` | Unstaged agent.ts + workspace-loader.ts + document-ingestor.ts + test |
| 2 | `fix(scheduler): add pre-market portfolio and stagger scheduling conflicts` | Unstaged scheduler.ts |
| 3 | `chore(ops): expand daemon env injection and env example` | Unstaged daemon.ts + .env.example |

### Future Commits (Tomorrow Sessions)

| # | Commit Message | Phase |
|---|----------------|-------|
| 4 | `feat(seo): add competitor analyzer and programmatic seo generator` | 3.7-3.8 |
| 5 | `feat(seo): add internal linker, quality checklist, serp monitor` | 3.9-3.11 |
| 6 | `feat(telegram): add /seo command with research and optimize` | 3.12 |
| 7 | `feat(video): add voice producer, caption generator, video assembler` | 4.7-4.9 |
| 8 | `feat(video): add thumbnail and shorts generators` | 4.10-4.11 |
| 9 | `feat(telegram): add /video command with approval gates` | 4.12-4.13 |
| 10 | `feat(soul): add soul evolution system with telegram approval` | 9.1-9.6 |

---

## Build Session Execution Order

### Tonight (Right Now): Commit Unstaged Work
1. Verify tests pass: `npm run typecheck && npm run lint && npm test`
2. Commit unstaged changes (commits 1-3 above)
3. Save this plan document

### Tomorrow Session 1 (9 PM - 11 PM): SEO Engine Completion
1. Phase 3 remaining: competitor-analyzer, programmatic-gen, internal-linker, quality-checklist, serp-monitor
2. /seo Telegram command
3. Wire to agent.ts handlers + scheduler tasks
4. Tests for all new files
5. Commit + verify

### Tomorrow Session 2 (11 PM - 1 AM): Video Pipeline Completion
1. Phase 4 remaining: voice-producer, caption-generator, video-assembler, thumbnail-generator, shorts-generator
2. HeyGen client integration
3. /video Telegram command with approval gates
4. Tests for all new files
5. Commit + verify

### Day 3 Session: SOUL Evolution + Deploy
1. Phase 9: Soul evolution engine + Telegram integration
2. Enhanced SOUL.md with OpenClaw structure
3. Create STYLE.md workspace file
4. Phase 10: Mac Mini deployment
5. Phase 11: Full verification

---

## Architecture Decision Log

| Decision | Rationale |
|----------|-----------|
| Eliminate standalone ContentEnginePlugin in agent.ts | Dual instances cause data sync bugs |
| Add OAuth 1.0a to XClient (not replace Bearer) | Read uses Bearer, write uses OAuth 1.0a |
| Use SQLite for document storage (not Pinecone) | ARI is local-first, no external deps |
| Build SEO engine as plugin (not integration) | SEO is a domain with sub-capabilities |
| Two Telegram approval gates for video | Prevents costly HeyGen re-renders |
| Content quality scorer as separate class | Reusable across content + SEO engines |
| SOUL evolution requires Telegram approval | ARI never silently changes her identity |
| Use OpenClaw SOUL.md structure | Proven framework for AI personality persistence |
| Weekly soul analysis (not daily) | Avoids notification spam, changes are deliberate |
| File backup before soul modification | Reversibility is critical for identity files |

---

*Plan version: 4.0 | Generated: Feb 17, 2026 | Based on: Full codebase audit (346 .ts files, 246 test files), v3.0 plan synthesis, OpenClaw/SOUL.md framework analysis, Goldie Locks Zone QC blueprint*
