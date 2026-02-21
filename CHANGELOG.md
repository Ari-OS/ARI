# Changelog

All notable changes to ARI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.3.0] — 2026-02-18 — Full Autonomous Implementation

> *29 phases complete. 6,700+ tests. ARI operates autonomously.*

### Added

#### Autonomous Intelligence (Phases 6-29)

- **Market Intelligence** — Real-time BTC/ETH/SOL/Pokemon TCG price alerts with portfolio tracking and Perplexity "why?" enrichment
- **Video Pipeline** — HeyGen avatar generation → AssemblyAI transcription → FFmpeg assembly → YouTube publishing with captions and thumbnails
- **Langfuse Observability** — Cost tracking, prompt versioning, latency monitoring, budget alerts
- **Agent Coordination** — Lane queue with autonomy dial (0.0-1.0), parallel task dispatch, permission escalation
- **Voice Interface** — ElevenLabs TTS synthesis, Whisper STT transcription, voice message handling in Telegram
- **Soul Evolution** — Weekly SOUL.md proposal generation, constitutional drift tracking, character arc progression
- **Self-Improvement Loop** — Automated performance analysis, capability gap detection, skill synthesis
- **Content Engine** — Multi-platform content generation (Twitter/LinkedIn/YouTube), SEO optimization, engagement scoring
- **Knowledge Graph** — Entity relationship mapping, cross-domain synthesis, concept clustering
- **Research Agents** — Web research with source validation, Perplexity integration, citation tracking
- **Life Monitor** — Food journal (USDA nutrition API), health patterns, habit tracking
- **CRM System** — Contact management, relationship scoring, follow-up automation
- **Email Integration** — Gmail IMAP/SMTP with label management, priority classification
- **Temporal Context** — Session continuity, temporal memory consolidation, event reconstruction
- **Initiative Engine** — Proactive task generation from rules, context-aware scheduling
- **Notification Pipeline** — 7-stage P0-P4 priority scoring, multi-channel routing
- **Weekly Wisdom Digest** — Emotional trend analysis from decision journal, pattern synthesis
- **BriefingGenerator** — Rich morning/evening/weekly briefings via Telegram with market data, calendar, tasks

#### Test Coverage (9 new test files — 301 total)

- `tests/unit/autonomous/food-journal.test.ts` — Nutrition tracking and USDA API integration
- `tests/unit/autonomous/youtube-tracker.test.ts` — YouTube analytics and channel monitoring
- `tests/unit/autonomous/shorts-pipeline.test.ts` — Short-form video content pipeline
- `tests/unit/plugins/seo-engine.test.ts` — SEO analysis and keyword optimization
- `tests/unit/integrations/browser/playwright-runner.test.ts` — Browser automation with full page mock
- `tests/unit/autonomous/transcript-processor.test.ts` — AssemblyAI transcript processing
- `tests/unit/autonomous/model-evolution-monitor.test.ts` — AI model capability tracking
- `tests/unit/channels/notification-pipeline.test.ts` — Multi-stage notification routing
- `tests/unit/cognition/learning/decision-journal.test.ts` — Bayesian decision tracking

#### Architecture Compliance

- **Executor DI pattern** (`src/agents/executor.ts`) — Dependency injection with optional `policyEngineOverride` constructor param; policy queue (`_pendingPolicies[]`) for async production init; satisfies L3→L4 layer boundary (ADR-004)
- **Decision Journal typed interfaces** (`src/cognition/learning/decision-journal.ts`) — 16 strongly-typed payload interfaces replacing `any`; L0 layer compliance (no kernel imports)
- **Shell injection sanitizer** (`src/e2e/runner.ts`) — VALID_PLAYWRIGHT_CATEGORIES allowlist replaces dynamic string injection
- **Gmail typed interfaces** (`src/integrations/gmail/receiver.ts`) — `ImapMessagePart` interface replaces `any` for IMAP message parts
- **Scheduler cron stagger** (`src/autonomous/scheduler.ts`) — 4-way 7AM collision staggered to unique times
- **Gateway system:ready event** (`src/kernel/gateway.ts`) — Emits `system:ready` on successful start
- **Telegram user:active event** (`src/plugins/telegram-bot/bot.ts`) — Emits `user:active` on each message

#### Infrastructure

- **Pre-commit hook PATH fix** (`.husky/pre-commit`) — `PATH="/opt/homebrew/opt/node@22/bin:$PATH"` for Mac Mini Node.js resolution
- **Daemon launchd** — `com.ari.daemon.plist` for 24/7 autonomous operation on Mac Mini
- **Mac Mini deployment** — 21-commit autonomous implementation on dedicated always-on machine (Tailscale IP: 100.81.73.34)

### Changed

- Test count increased from **5,460 → 6,716** (1,256 new tests across 83 new test files)
- Test files increased from **218 → 301**
- TypeScript source files increased from **333 → 420+**
- Injection patterns increased from **41 → 42** (across 14 categories)
- README accuracy: Stats, feature descriptions, architecture diagrams all updated
- Autonomous agent now runs 45 scheduled tasks (was 35)
- PolicyEngine now injectable via constructor for deterministic test execution

### Fixed

- **executor.ts race condition** — `registerBuiltInTools()` called `registerPolicy()` before async import resolved → fixed with policy queue
- **health-monitor flaky test** — Timing race after `stop()` could allow one in-flight tick → assertion relaxed to `≤1`
- **weekly-wisdom-digest trend** — `getDecisionsInRange` returns descending order; `calcEmotionalTrend` now sorts ascending before trend split
- **playwright-runner mock** — All page methods (`goto`, `title`, `evaluate`, `screenshot`, `waitForSelector`, `close`) now properly mocked
- **MEMORY.md typo** — Removed incorrect child name "Declan"; correct: Kai (son, 3) + Portland (daughter, 1)

---

## [2.2.1] — 2026-02-16 — Master Plan Execution

> *14 core modules implemented. ARI grows stronger.*

### Added

#### Foundation Services (Phase 2)

- **VectorStore** (`src/system/vector-store.ts`) — SQLite-backed 1536-dim OpenAI embeddings with cosine similarity
- **EmbeddingService** (`src/ai/embedding-service.ts`) — OpenAI text-embedding-3-small with batch processing
- **TopicManager** (`src/integrations/telegram/topic-manager.ts`) — Telegram forum topic management with thread routing
- **HealthMonitor** (`src/ops/health-monitor.ts`) — System health checks with configurable thresholds
- **BackupManager** (`src/autonomous/backup-manager.ts`) — Automated backup with rotation and encryption

#### Knowledge System (Phase 3)

- **IngestionPipeline** (`src/autonomous/ingestion-pipeline.ts`) — Document processing with chunking and deduplication
- **RAGQueryEngine** (`src/autonomous/rag-query.ts`) — Retrieval-augmented generation with prompt injection protection

#### Market Intelligence (Phase 4)

- **MarketMonitor** (`src/autonomous/market-monitor.ts`) — Multi-asset price tracking with alert thresholds
- **PortfolioTracker** (`src/autonomous/portfolio-tracker.ts`) — Portfolio management with P&L calculation
- **InvestmentAnalyzer** (`src/autonomous/investment-analyzer.ts`) — Investment analysis with risk assessment
- **OpportunityScanner** (`src/autonomous/opportunity-scanner.ts`) — Opportunity detection with weighted scoring
- **CareerTracker** (`src/autonomous/career-tracker.ts`) — Job market monitoring with preference matching

#### Operations (Phase 5)

- **GitSync** (`src/ops/git-sync.ts`) — Automated repository sync with conflict detection
- **TemporalMemory** (`src/agents/temporal-memory.ts`) — Time-based memory with daily/weekly synthesis

#### Documentation

- **Mac Mini Setup Guide** (`docs/guides/MAC_MINI_SETUP.md`) — Complete deployment guide for 24/7 operation

### Changed

- Test count increased from 3988 to 4654 (666 new tests for 14 modules)
- Injection patterns increased to 39 across 14 categories
- README updated with accurate test counts and architecture

### Fixed

- Resolved merge conflicts in concurrent implementations
- Fixed type declaration conflict in better-sqlite3

---

## [2.2.0] — 2026-02-11 — Telegram Integration

> *Primary notification channel established.*

### Added

- Telegram-primary notification system replacing Pushover
- TelegramSender (`src/integrations/telegram/sender.ts`) — lightweight Bot API sender
- Multi-signal request classifier (`src/ai/request-classifier.ts`)
- Time-block scheduling system (`src/autonomous/time-blocks.ts`)
- Cascade router with research-backed model-aware routing
- 12 new injection patterns (jailbreak, XSS, SQL, tag attacks)
- Mac Mini deploy script (`scripts/deploy-mac-mini.sh`)
- ARI Intelligence Guide (`docs/ARI-INTELLIGENCE-GUIDE.md`)

### Changed

- Notification routing: P0→SMS+Telegram+Notion, P1→Telegram+Notion, P2→Telegram(silent)+Notion
- Test count increased from 3194 to 3988
- xAI models updated to correct API model IDs, added grok-4-fast and grok-3-mini

### Removed

- Pushover integration (`src/autonomous/pushover-client.ts`, `src/channels/adapters/pushover.ts`, `src/integrations/pushover/`)
- Legacy daemon script (`scripts/ari-daemon.ts`)
- Legacy notify script (`scripts/notify.sh`)

---

## [2.1.1] — 2026-02-07 — Cognitive Awakening

> *Layer 0 emerges. ARI learns to think about thinking.*

### Added

#### Cognitive Layer 0 (LOGOS/ETHOS/PATHOS)

- **LOGOS (Reason)** — Bayesian reasoning, Expected Value, Kelly Criterion, Decision Trees, Systems Thinking, Antifragility
- **ETHOS (Character)** — Cognitive bias detection, Emotional state (VAD model), Fear/Greed cycle, Discipline checks
- **PATHOS (Growth)** — CBT reframing, Stoic philosophy, Wisdom traditions, Meta-learning, Practice planning
- **Knowledge System** — 87 curated sources, 5-stage validation pipeline, 15 Council cognitive profiles
- **Learning Loop** — Performance review (daily), Gap analysis (weekly), Self-assessment (monthly)
- **Visualization** — Insight formatter for Claude Code, Dashboard Cognition page

#### CLI Commands

- `ari cognitive status` — Cognitive health overview
- `ari cognitive analyze` — Bias and distortion detection
- `ari cognitive decide` — Full decision pipeline
- `ari cognitive wisdom` — Query wisdom traditions
- `ari cognitive kelly` — Position sizing calculator
- `ari cognitive bayesian` — Belief probability updates
- `ari cognitive profile` — Council member profiles

#### EventBus Events

- 18 cognitive events (belief_updated, bias_detected, thought_reframed, etc.)
- 7 knowledge events (source_fetched, validated, gap_identified, etc.)
- 7 learning events (performance_review, gap_analysis, self_assessment, etc.)

#### Dashboard

- Cognition page with three-pillar health visualization
- Real-time cognitive activity feed
- Learning loop progress tracker
- Council cognitive profile grid
- Framework usage charts

#### Documentation

- 9 new CLAUDE.md files for all source modules
- Updated architecture to seven-layer (includes Layer 0)
- 72 total documentation files

### Changed

- Test count increased from 2597 to 3194 (597 new cognitive tests)
- Architecture updated from six-layer to seven-layer
- CLI commands increased from 8 to 11
- README updated with cognitive layer architecture

---

## [2.1.0] — 2026-01-31 — Constitutional Separation

> *Council ≠ Tools. Governance separated from execution.*

### Added

#### Constitutional Framework

- **ARI Constitution v1.0** — Comprehensive governance document
  - Preamble, 14 Articles, 2 Appendices
  - Separation of Powers (Legislative, Judicial, Executive)
  - Creator Primacy Clause (Pryce Hedrick)
  - 6 Immutable Constitutional Rules
- **Constitutional Invariants Module** (`src/kernel/constitutional-invariants.ts`)
  - Immutable rules baked into kernel layer
  - Cannot be changed at runtime
  - Enforced by Arbiter

#### Governance Separation

- **PolicyEngine** (`src/governance/policy-engine.ts`)
  - Central permission authority (Governance Layer 4)
  - 3-layer permission checks
  - ToolCallToken generation and verification
  - Approval workflow management
- **ToolRegistry** (`src/execution/tool-registry.ts`)
  - Pure capability catalog (System Layer 2)
  - No permission logic
  - JSON configuration support
- **ToolExecutor** (`src/execution/tool-executor.ts`)
  - Token-validated execution engine
  - Cannot approve its own requests
  - Sandbox and timeout enforcement

#### Council Renamed

- **The Council** — 15-member governance body
  - Latin: "council, plan, deliberation"
  - Backwards-compatible export (`Council` still works)

### Changed

- **Executor** refactored to delegate permissions to PolicyEngine
  - Removed legacy inline permission checking
  - Removed dual-write mode (0% divergence achieved)
  - Simplified to orchestration role only
- **Arbiter** now enforces Creator Primacy as foundational rule
- Test count increased from 2214 to 2597

### Security

- Creator Primacy: ARI cannot act against her creator's interests
- Constitutional violations logged as critical security events
- New event type: `constitutional_violation`

### Documentation

- `docs/constitution/ARI-CONSTITUTION-v1.0.md` — Full constitution
- Updated README with 6 constitutional rules
- Updated architecture docs with separation of powers

---

## [2.0.0] — 2026-01-28 — Aurora Protocol

> *The dawn of a new era. Your life, your rules, fully auditable.*

### Added

#### Multi-Agent System

- **Core Agent** — Central coordination and decision making with 5-step message pipeline
- **Guardian Agent** — Real-time threat detection with 8 injection patterns and behavioral anomaly detection
- **Planner Agent** — Task decomposition with dependency DAG and circular dependency detection
- **Executor Agent** — Tool execution with 3-layer permission gating and approval workflows
- **Memory Manager** — Provenance-tracked memory with 6 types and 3 partitions

#### Constitutional Governance

- **Council** — 15-member voting body with 3 quorum thresholds (majority, supermajority, unanimous)
- **Arbiter** — Constitutional enforcement with 5 hard rules
- **Overseer** — Quality gate enforcement with 5 release gates
- **Stop-the-Line** — Immediate halt capability for security violations

#### Web Dashboard

- Real-time monitoring interface (Vite 6 + React 19)
- Agent status and health visualization
- Audit log viewer with hash chain verification
- Governance decision tracking
- Memory partition browser

#### REST API

- 15 endpoints for system interaction
- WebSocket real-time events
- Health monitoring endpoints
- Audit query endpoints

#### CLI Commands

- `ari onboard init` — Initialize ARI system
- `ari doctor` — Run health checks
- `ari gateway start|status` — Gateway management
- `ari audit list|verify|security` — Audit operations
- `ari context init|list|create|select|show` — Context management
- `ari governance show|list` — Governance inspection
- `ari daemon install|uninstall|status` — macOS daemon

#### macOS Operations

- launchd daemon integration for always-on operation
- Auto-start on login
- Log rotation and management
- Health monitoring with auto-recovery

#### Testing

- 187 tests across 18 test files
- Unit tests for all agents, governance, and kernel components
- Integration tests for full message pipeline
- Security tests for injection defense

### Security

- 27-pattern injection detection across 10 categories
- 6-level trust scoring with risk multipliers (0.5x to 2.0x)
- SHA-256 hash-chained tamper-evident audit logging
- Auto-block at risk threshold ≥ 0.8
- 3-layer permission checks for all tool execution

### Documentation

- Full architecture documentation with layer diagrams
- Security model with threat analysis
- Operations runbook for Mac mini deployment
- Governance framework specification
- CLAUDE.md context file for AI assistants

---

## [1.0.0] — 2026-01-26 — Kagemusha Protocol

> *The shadow warrior that guards the gate.*

### Added

#### Gateway

- Loopback-only Fastify server (127.0.0.1 hardcoded)
- Port configurable, host immutable
- No remote access by design

#### Sanitizer

- 27 injection patterns across 10 categories:
  - Direct Override (5 patterns)
  - Role Manipulation (4 patterns)
  - Command Injection (4 patterns)
  - Prompt Extraction (3 patterns)
  - Authority Claims (3 patterns)
  - Data Exfiltration (2 patterns)

#### Audit

- SHA-256 hash-chained tamper-evident logging
- Genesis block anchors chain (`previousHash = "0x00...00"`)
- Verification command: `npx ari audit verify`

#### EventBus

- Typed pub/sub event system
- Error isolation per subscriber
- Inter-layer communication backbone

#### Configuration

- Zod-validated configuration
- Config stored at `~/.ari/`
- Type-safe schema validation

### Security

- **Content ≠ Command** — All inbound messages are data, never instructions
- **Loopback-Only** — Gateway binding hardcoded, cannot be overridden
- **Hash Chain Integrity** — Append-only audit log with cryptographic verification
- **Trust Levels** — SYSTEM, OPERATOR, VERIFIED, STANDARD, UNTRUSTED, HOSTILE

---

## [0.1.0] — 2026-01-26 — Genesis Protocol

> *The first light. The shadow warrior awakens.*

### Added

- Initial repository structure
- Project scaffolding and configuration
- Security-hardened multi-agent architecture concept
- Constitutional framework defining agent boundaries

---

## Protocol Naming Convention

| Version | Protocol | Meaning | Philosophy |
|---------|----------|---------|------------|
| v0.1.0 | **Genesis** | The beginning, first light | Shadow Integration — acknowledging origins |
| v1.0.0 | **Kagemusha** | Shadow warrior, the guardian | Shadow Integration — the protective foundation |
| v2.0.0 | **Aurora** | Dawn, new beginning | Radical Transparency — the Life OS emerges |
| v2.2.0 | **Cognitive Awakening** | Layer 0 emerges | Ruthless Simplicity — thinking about thinking |

---

## Links

[Unreleased]: https://github.com/Ari-OS/ARI/compare/v2.2.1...HEAD
[2.2.1]: https://github.com/Ari-OS/ARI/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/Ari-OS/ARI/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/Ari-OS/ARI/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Ari-OS/ARI/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Ari-OS/ARI/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ari-OS/ARI/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Ari-OS/ARI/releases/tag/v0.1.0
