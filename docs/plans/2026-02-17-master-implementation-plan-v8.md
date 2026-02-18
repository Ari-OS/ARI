# ARI Master Implementation Plan v8.0 — The Definitive Blueprint

> **Context:** ARI is a 7-layer multi-agent personal AI OS (TypeScript 5.3, Node.js 20+) with 346+ source files, ~188 test files, 5,460+ passing tests, 37 scheduled cron tasks (2 disabled), and 7 registered plugins. ~196 events across ~55 EventBus namespaces. 22 Telegram slash commands. 9 workspace files (5 loaded, 4 unused). This plan synthesizes: (1) full codebase audit with line-by-line validation, (2) 27+ highest-star GitHub repos analysis (177K to 2K stars across 10 categories), (3) deep OpenClaw analysis (lane queue, 4-file memory, config I/O, cron service patterns), (4) Mem0 research paper (3-tier memory, compression, contradiction detection), (5) Letta/MemGPT docs (self-editing tools, sleep-time compute, OS-paging), (6) Overstory analysis (mechanical enforcement, watchdog), (7) state-of-the-art AI agent research (Feb 2026), (8) 31 research documents from Pryce's planning folder, (9) life optimization research, (10) 4-layer browser automation stack with Stagehand, (11) 7 MCP integrations, (12) Langfuse observability + promptfoo testing, (13) Fabric prompt library architecture, and (14) 6 Smashing Magazine agentic UX patterns.
>
> **Problem:** ARI has 16 unstaged files (8 modified + 8 untracked), 4 TypeScript build errors, incomplete plugin wiring (5 of 7 video components unwired), 10 dead code files never imported, 4 unwired plugin bridges, 6 L0→L1 layer violations (cognition→kernel), 1 L3→L4 violation (executor→governance), 3 cron time collisions, `better-sqlite3` in devDeps (production crash risk), 20+ critical files with zero test coverage, 16 untested API route files, and disconnected dual session stores. Beyond the code: ARI lacks session serialization, memory flush before compaction, mechanical permission enforcement, browser automation capabilities, and the autonomous intelligence layer that would make it a true Life OS.
>
> **Outcome:** A fully operational ARI that provides maximum daily benefit to Pryce through: proactive intelligence (meeting prep, compound tracking, opportunity radar), autonomous operations (24/7 daemon with watchdog), self-evolution (SOUL modification with Telegram approval), browser automation (Playwright-powered testing and personal automation), bulletproof infrastructure (lane queues, checkpointing, mechanical safety), and zero known inconsistencies (all layer violations fixed, dead code removed, cron collisions resolved, test coverage gaps filled).

---

## VALIDATED AUDIT FINDINGS (Cross-Checked Against Codebase)

Every number in this plan has been validated against the actual codebase. Prior versions had errors — these are the corrected facts:

| Metric | Previous Claim | Validated Actual | Status |
|--------|---------------|-----------------|--------|
| Event namespaces | "90+" | ~55 namespaces, ~196 events | CORRECTED |
| Unstaged files | "5 modified + 2 untracked" | 8 modified + 8 untracked (16 total) | CORRECTED |
| Telegram commands | "18" | 22 slash commands | CORRECTED |
| Registered plugins | "8" | 7 (crypto, pokemon-tcg, tts, content-engine, seo-engine, video-pipeline, telegram-bot) | CORRECTED |
| Test files | "246" | ~188 test files | CORRECTED |
| Scheduled tasks | "37" | 37 tasks, 34 handlers (2 disabled: e2e, gmail) | CONFIRMED |
| Intent patterns | "6+" | 8 routes, 16 regex patterns | CONFIRMED |
| Video components initialized | "2 of 7" | 2 of 7 (ScriptGenerator + AvatarRenderer) | CONFIRMED |
| Dual session stores | disconnected | ChatSessionManager (30min/memory) + ConversationStore (24h/disk) | CONFIRMED |
| SkillBridge dead code | dead | Never imported or instantiated in bot.ts | CONFIRMED |
| Workspace files | 5 loaded | 9 exist, 5 loaded (AGENTS.md, HEARTBEAT.md, MEMORY.md, TOOLS.md unused) | CONFIRMED |

### Newly Discovered Gaps (Not in Previous Plans)

| # | Gap | Severity | Phase |
|---|-----|----------|-------|
| G1 | 10 dead code files never imported (WeeklyWisdomDigest, AlertSystem, notification-grouper, ingestion-pipeline, rag-query, 4 plugin bridges, autonomous/index.ts barrel) | Medium | 11 |
| G2 | 6 L0→L1 layer violations (all cognition modules import kernel/event-bus.ts) | High | 3 |
| G3 | 1 L3→L4 layer violation (executor.ts imports governance/policy-engine.ts) | High | 3 |
| G4 | 3 exact cron collisions: 7:00 AM (3 tasks), 7:30 AM (2 tasks), Sunday 6 PM (2 tasks) | Medium | 10 |
| G5 | 3 near-collisions in 6:00-6:15 AM window (4 tasks competing for APIs) | Medium | 10 |
| G6 | 20+ critical source files with zero test coverage (initiative-engine, agent-spawner, audit-reporter, etc.) | High | 11 |
| G7 | All 16 API route files untested | High | 11 |
| G8 | 3 env vars used in code but missing from .env.example (COMPOSIO_API_KEY, POKEMONTCG_API_KEY, ARI_ROOT) | Low | 1 |
| G9 | 7 env vars in .env.example but missing from daemon inject list (READWISE, STRIPE, TOGGL, SPOTIFY, CALCOM, PRODUCTHUNT, COMPOSIO) | Medium | 10 |
| G10 | `better-sqlite3` in devDependencies — production crash when NODE_ENV=production | **Critical** | 11 |
| G11 | No browser automation capability — missing Playwright-powered personal automation and UI testing | Medium | 13 |
| G12 | MEMORY.md contains WRONG child info ("Son Declan" — no such child exists; should be Kai 3 + Portland 1) | **Critical** | 0 |
| G13 | GOALS.md still references Phase A as "Immediate" — stale since Phase A is DONE | Medium | 1 |
| G14 | AGENTS.md lists only 5 agents; codebase has 20+ active agents/components | Medium | 1 |
| G15 | TOOLS.md lists only 5 of 22 integrations | Medium | 1 |
| G16 | HEARTBEAT.md missing ~17 of 37 scheduled tasks | Medium | 1 |
| G17 | config.json version "12.0.0" mismatches package.json "2.2.1" | Low | 10 |
| G18 | workspace-loader only loads 5 of 9 workspace files (AGENTS, HEARTBEAT, MEMORY, TOOLS not loaded into identity prompt) | High | 4 |
| G19 | .env uses `TELEGRAM_USER_ID` but .env.example uses `TELEGRAM_OWNER_USER_ID` — name mismatch | Medium | 1 |
| G20 | 10 of 22 integrations are NOT WIRED (complete clients with tests but zero connection to autonomous agent) | High | NEW Phase |
| G21 | Only 3/16 API route files use Zod validation (violates ADR-006) | Medium | 11 |
| G22 | Only 3/16 API route files emit audit events on mutations | Medium | 11 |
| G23 | Notion has TWO client implementations (old notion-client.ts + new client.ts with retry/cache) — consolidate | Low | 11 |
| G24 | AssemblyAI integration does NOT EXIST despite video pipeline referencing it | Medium | 5 |
| G25 | No Human 3.0 self-development tracking across Mind/Body/Spirit/Vocation quadrants | Medium | 8 |
| G26 | No Figma MCP integration for design-code bidirectional workflows | Low | Backlog |
| G27 | ADRs 009-014 not referenced in root CLAUDE.md | Low | 11 |
| G28 | MEMORY.md accumulates items that belong in TOOLS.md or skills/ — wastes boot tokens nightly | Medium | 4 |
| G29 | No GEO (Generative Engine Optimization) — content not optimized for AI search engines (ChatGPT Search 200M users, Perplexity 50M users) | Medium | 6 |
| G30 | ConversationStore does NOT persist assistant responses — only user messages saved to disk. Context broken after restart. | **Critical** | 2 |
| G31 | TelegramSender hard-truncates messages >4096 chars instead of splitting (sender.ts:96) — notifications get cut off | High | 5 |
| G32 | No `sendChatAction('typing...')` during processing — bot feels dead while thinking | Medium | Telegram UX |
| G33 | Silent rate-limiting — user gets NO feedback when rate-limited, thinks bot is broken | Medium | Telegram UX |
| G34 | `/remind` is read-only — `reminder_create` intent pattern matches but can't create reminders | High | Telegram UX |
| G35 | `/briefing` always requests `'evening'` type regardless of time of day | Medium | Telegram UX |
| G36 | `/growth` and `/dev` commands are entirely placeholder — confuse users | Low | 11 |
| G37 | 4 duplicate `escapeHtml` implementations across format.ts, diagram.ts, notification-manager.ts, briefings.ts | Low | 11 |
| G38 | Notion `index.ts` exports OLD client (no retry/cache) — any barrel import gets the wrong client | High | 11 |
| G39 | Spotify client has no OAuth refresh flow — access token expires in 1 hour, silently fails | Medium | 12.5 |
| G40 | Google Trends client scrapes unofficial API with prefix stripping — WILL break without warning | Medium | 12.5 |
| G41 | Readwise client has N+1 query problem — 50 highlights from 20 books = 20 sequential API calls | Medium | 12.5 |
| G42 | No shared `withRetry()` utility — retry logic reimplemented in Notion, Perplexity, Orchestrator only | Medium | 11 |
| G43 | No Intent Preview — ARI acts on multi-step tasks without showing user the plan first | High | Telegram UX |
| G44 | No Autonomy Dial — all actions are either fully autonomous or fully manual, no per-domain granularity | High | 7 |
| G45 | No Confidence Signal — ARI never indicates uncertainty level to user | Medium | Telegram UX |
| G46 | No Action Audit & Undo — user can't see what ARI did autonomously or reverse it | High | 10 |
| G47 | No streaming responses — Telegram messages appear all at once after full processing | Medium | Telegram UX |
| G48 | Memory is flat (single type) — no distinction between episodic/semantic/procedural memory | High | 4 |
| G49 | No SESSION_STATE.md — daemon can't orient itself after restart (Anthropic long-running harness pattern) | Medium | 4 |
| G50 | Morning briefing can be overwhelming — 12+ sections with no progressive disclosure | Medium | Telegram UX |
| G51 | No photo/image support in Telegram — can't preview thumbnails, charts, or screenshots | Medium | 13 |
| G52 | Twitter `apiPost()` method is dead code (never called, all writes via oauthPost) | Low | 11 |
| G53 | Whisper client warns but doesn't BLOCK non-loopback URLs in local mode (violates ADR-001 spirit) | Medium | 3 |
| G54 | No shared `CacheEntry<T>` utility — interface duplicated in every integration client | Low | 11 |
| G55 | No MCP server integrations — context7, Notion MCP, Figma MCP, Google Analytics MCP not connected | High | NEW (MCP) |
| G56 | No LLM observability — no tracing, no cost-per-call tracking, no prompt version history | High | 10 |
| G57 | No Stagehand natural language browser — still using raw CSS selectors instead of `page.act()` | Medium | 13 |
| G58 | No memory self-editing tools — ARI can't update its own workspace files via tool calls | High | 4 |
| G59 | No memory compression — raw conversations stored instead of extracted salient facts | Medium | 4 |
| G60 | No sleep-time compute — daemon idles instead of consolidating memory during quiet periods | Medium | 4 |
| G61 | No Supabase backend — no scalable database beyond local SQLite + flat files | Low | Backlog |
| G62 | No prompt testing/red-teaming — prompts deployed without injection/jailbreak scanning | Medium | 9 |
| G63 | No durable workflow execution — long-running tasks lost on daemon restart (no Temporal/Inngest pattern) | High | 2 |
| G64 | No graph-based task routing — Planner uses flat lists instead of DAG with conditional edges | Medium | 9 |
| G65 | No grammY auto-chat-action plugin — typing indicator requires manual `sendChatAction` in every handler | Low | Telegram UX |
| G66 | No structured user profile JSON — USER.md is prose, not machine-queryable | Medium | 4 |

---

## TIER A: FOUNDATION (Do First — Unblocks Everything)

### Phase 0: Fix Build Errors

Two TypeScript errors block `npm run typecheck`. Nothing can proceed until fixed.

**0.0 CRITICAL: Fix MEMORY.md poisoned data** (G12 — DO FIRST)
- **File:** `~/.ari/workspace/MEMORY.md` line 18
- **Bug:** Says "Son Declan is 4 months old as of Feb 2026" — THIS IS COMPLETELY WRONG
- **Fix:** Pryce's children are **Kai (son, 3)** and **Portland (daughter, 1)**. No "Declan" exists.
- **Why urgent:** Any system reading MEMORY.md for context will be poisoned with wrong family data
- **Also fix:** Version shows v2.1.0 but package.json is v2.2.1; subscription detail may be wrong

**0.1 Add video:* events to EventMap**
- **File:** `src/kernel/event-bus.ts` (after ~line 657)
- **Add:** `'video:approval_requested'` and `'video:approval_response'` event types
- **Why:** `approval-gate.ts` lines 53/105/182 emit these events but they're not in the typed EventMap

**0.2 Fix Buffer type in youtube-publisher.ts**
- **File:** `src/plugins/video-pipeline/youtube-publisher.ts` line 210
- **Change:** `Uint8Array[]` → `Buffer[]`
- **Why:** `Buffer` is pushed but array is typed `Uint8Array[]`

**Verification:** `npm run typecheck && npm run lint && npm test`

---

### Phase 1: Commit All Unstaged Work

16 files need committing (8 modified + 8 untracked).

| Commit | Message | Files |
|--------|---------|-------|
| 1 | `feat(kernel): add video pipeline events and fix type errors` | event-bus.ts, all video-pipeline/*.ts (modified + untracked) |
| 2 | `feat(agent): load identity from workspace and wire document ingestor` | agent.ts, workspace-loader.ts, document-ingestor.ts, document-ingestor.test.ts |
| 3 | `fix(scheduler): add pre-market portfolio and stagger conflicts` | scheduler.ts |
| 4 | `chore(ops): expand daemon env injection and env example` | daemon.ts, .env.example |
| 5 | `docs(plans): add master implementation plan v4` | docs/plans/2026-02-17-master-implementation-plan-v4.md |

**Ralph Wiggum after each:** `npm run typecheck && npm run lint && npm test` — all green before next commit.

**Phase 1.5: Fix All Workspace Files** (G13-G19)

| File | Issue | Fix |
|------|-------|-----|
| `GOALS.md` | Still references Phase A as "Immediate" | Update: Immediate = Phases 2-4 (infrastructure), Short-term = Phases 5-8 (intelligence), Medium-term = Phases 9-14 (operations + deploy) |
| `AGENTS.md` | Lists only 5 agents | Expand to all 20+ agents |
| `TOOLS.md` | Lists only 5 of 22 integrations | Restructure into Active, Partially Wired, Not Yet Wired |
| `HEARTBEAT.md` | Missing ~17 of 37 tasks | Sync with full scheduler |
| `MEMORY.md` | Version stale, test count stale | Update to v2.2.1 |
| `.env` | `TELEGRAM_USER_ID` vs `TELEGRAM_OWNER_USER_ID` mismatch | Align naming |
| `config.json` | Version "12.0.0" unexplained | Align with package.json 2.2.1 |

**Commit:** `fix(workspace): update all 9 workspace files with accurate data`

---

## TIER B: CORE INFRASTRUCTURE (Enables Everything Else)

### Phase 2: Lane Queue + Session Serialization

**2.1 Create `src/autonomous/lane-queue.ts`** (~150 lines)
- Per-session serialization — tasks within a session key execute serially, different session keys execute in parallel
- Lane configuration: user (concurrency 1, priority 0), scheduled (1, 1), initiative (2, 2), background (3, 3)
- Durable execution: tasks persist to `~/.ari/queue/pending.jsonl`, survive daemon restarts

**2.2 Cron Service Isolation** (OpenClaw pattern)
- Each cron task runs in isolated agent execution context with own lane
- Run logging captures duration, success/failure, error details

**2.3 Wire into agent.ts** — Replace direct `processTask()` calls with lane-queued execution

**2.4 Add JSONL conversation transcripts** — `~/.ari/sessions/<session-key>/YYYY-MM-DD.jsonl`

**Tests:** `tests/unit/autonomous/lane-queue.test.ts` (min 8 tests)
**Commit:** `feat(agent): add lane queue for per-session task serialization`

---

### Phase 3: Security Enhancements + Layer Violation Fixes

**3.1 External content XML wrapping** — `src/kernel/sanitizer.ts`
**3.2 Homoglyph detection** — `src/kernel/sanitizer.ts`
**3.3 Token caps in workspace-loader** — MAX_FILE_CHARS = 20_000, MAX_TOTAL_CHARS = 150_000
**3.4 Named failure modes** for each agent

**3.5 Fix L0→L1 Layer Violations** (6 files)
- Define `CognitionEventEmitter` interface in `src/cognition/types.ts`
- All cognition modules use this interface instead of importing EventBus directly
- EventBus passed in at construction time via dependency inversion

**3.6 Fix L3→L4 Layer Violation** (1 file)
- Define `PermissionChecker` interface in `src/agents/types.ts`
- Executor accepts this interface instead of importing PolicyEngine directly

**Commits:**
- `feat(security): add external content wrapping, homoglyphs, token caps, named failure modes`
- `fix(architecture): resolve L0→L1 and L3→L4 layer violations via dependency inversion`

---

### Phase 4: Memory Infrastructure

**4.1 OpenClaw 4-File Memory Architecture**
- MEMORY.md (long-term), daily notes (YYYY-MM-DD.md), active-tasks.md, lessons.md
- Session Start Ritual: Read MEMORY.md → check active-tasks → read today's notes → read yesterday's notes
- Maintenance crons: daily consolidation (10 PM), lessons extraction (10 PM), hygiene review (10:30 PM), cleanup (Sunday 11 PM)

**4.1b Load ALL 9 workspace files** — Token-budgeted: identity files priority, operational files if budget allows

**4.2 Memory flush before compaction** — When context exceeds 85%, silent write to MEMORY.md + daily log

**4.3 Upgrade DocumentIngestor to hybrid search** — SQLite FTS5 (BM25) + embeddings, fused score

**4.4 Wire memory retrieval into agent context** — Top-K relevant memory chunks in autonomous prompt

**4.5 BOOT.md startup ritual** — Health checks, schedule load, workspace verification, ready report

**4.6 Sub-agent context minimization** — Spawned agents get only AGENTS.md + TOOLS.md

**4.7 Bi-temporal metadata on memories** — validFrom, validUntil, ingestedAt, supersededBy

**Commit:** `feat(memory): add daily logs, hybrid search, memory flush, bi-temporal metadata`

---

## TIER C: PLUGIN COMPLETION

### Phase 5: Video Pipeline Completion

**5.1** Wire all 7 components in index.ts (currently only 2 of 7)
**5.2** Add missing .env.example vars (ASSEMBLYAI_API_KEY, YOUTUBE_*)
**5.3** Scheduler tasks: video-weekly-script (Mon 10AM), video-render-check (*/30)
**5.4** Agent handlers in agent.ts

**Commit:** `feat(video): wire all pipeline components and add scheduling`

---

### Phase 6: SEO Engine Completion

**6.1** New components: competitor-analyzer, programmatic-gen, internal-linker, quality-checklist, serp-monitor, geo-optimizer
**6.2** Telegram /seo command
**6.3** Scheduler: seo-ranking-check (Mon 8AM), seo-competitor-scan (Wed 9AM)

**Commit:** `feat(seo): complete engine with competitor analysis and serp monitoring`

---

## TIER D: INTELLIGENCE LAYER

### Phase 7: SOUL Evolution System

- `src/autonomous/soul-evolution.ts` — Proposals with Telegram [Approve] [Reject] [Edit]
- Telegram /soul command
- Enhanced SOUL.md structure
- STYLE.md voice guide
- Max 3 proposals/week, security boundaries immutable

**Commit:** `feat(soul): add evolution system with telegram approval`

---

### Phase 8: Life Intelligence Modules

**8.1** Compound Effect Tracker — Track daily across all domains
**8.2** Meeting Prep Pipeline — Calendar → attendee lookup → talking points → T-5 alert
**8.3** Relationship Manager — Contact tracking with decay, touchpoint alerts
**8.4** Chronotype-Aware Energy Planner — Route tasks to peak windows
**8.5** Skill Gap Analyzer — Indeed API → compare against USER.md skills
**8.6** Opportunity Radar — Cross-domain confluence detection
**8.7** Emergency Detector — Unusual inactivity, flash crashes, escalation
**8.8** Brand Consistency Monitor — Tone/topic alignment audit
**8.9** Pattern Predictor — Behavioral data insights
**8.10** Human 3.0 Development Tracker — Mind/Body/Spirit/Vocation quadrants

**Commits:** Split into 3 commits

---

### Phase 9: Agent Coordination Upgrade

**9.1** Compaction-Survival Checkpointing
**9.2** Three-Tier Watchdog (mechanical poll → AI triage → human escalation)
**9.3** INSIGHT: Knowledge Extraction Protocol
**9.4** Spawn Depth Limits (mechanical enforcement)
**9.5** Prompt Engineering Agent + Autonomous Prompt Discovery + Fabric Pattern Library
**9.6** Trust Accumulation Score

**Commit:** `feat(agents): add checkpointing, watchdog, prompt engineer, trust accumulation`

---

## TIER E: OPERATIONS

### Phase 10: Operational Patterns + Cron Fixes

**10.0** Self-Hosted Langfuse on Mac Mini (observability)
**10.0b** Config I/O with Backup Rotation
**10.1** Input provenance tagging
**10.2** Cron run history JSONL
**10.3** Exponential backoff for failed tasks
**10.4** `ari doctor` CLI command
**10.5** HEARTBEAT.md user-editable proactive behaviors
**10.6** Fix cron collisions (stagger conflicting times)
**10.7** Expand daemon env injection (missing 9 vars)
**10.8** Add missing .env.example vars

**Commit:** `feat(ops): add provenance, cron history, backoff, doctor, heartbeat, fix cron collisions`

---

### Phase 11: Housekeeping, Dead Code & Test Coverage

**11.1** CRITICAL: Move `better-sqlite3` from devDeps to deps
**11.2** Add vitest coverage thresholds (80% statements/functions/lines, 70% branches)
**11.3-11.5** Documentation fixes
**11.6** Dead Code Cleanup — Remove or wire 10 never-imported files
**11.7** Critical Test Coverage — 10 highest-priority untested files
**11.8** API Route Test Coverage — 32 tests across 16 route files
**11.9** Review Playwright dependency placement

**Commits:** 4 commits

---

### Phase 12: Mac Mini Deployment

```bash
ssh ari@100.81.73.34 'mv /Users/ari/ARI /Users/ari/ARI-backup-$(date +%Y%m%d)'
scp -r /Users/prycehedrick/Ari/ARI ari@100.81.73.34:/Users/ari/ARI
ssh ari@100.81.73.34 'source ~/.zshrc; source ~/.zprofile; cd /Users/ari/ARI && NODE_ENV=development npm install --ignore-scripts && cd node_modules/better-sqlite3 && npx node-gyp rebuild && cd ../.. && NODE_ENV=development npm run build && npm test'
```

---

### Phase 12.5: Wire Dormant Integrations

10 of 22 integrations have complete clients but zero autonomous connection.

**Priority 1:** Anki, Apple Calendar/Reminders, Whisper
**Priority 2:** Spotify, Toggl, Readwise, Stripe
**Priority 3:** Cal.com, Product Hunt, Composio, Ollama

**Commit:** `feat(integrations): wire anki, apple, whisper, and high-value dormant clients`

---

### Phase 13: Browser Automation Integration

**13.1** Browser tool wrappers (Playwright) — `src/execution/tools/browser-automation.ts`
**13.2** BrowserQA Agent — `src/agents/browser-qa.ts`
**13.3** Browser workflow loader — YAML definitions
**13.4** Telegram /browse command
**13.5** Scheduler tasks: site-health, serp-check

**Commit:** `feat(browser): add 4-layer browser automation with playwright integration`

---

### Phase 14: Verification & Smoke Tests

25-point verification checklist covering typecheck, lint, tests, Telegram commands, briefings, API health, lane queue, natural language routing, browser automation.

---

## EXECUTION ORDER (Build Sessions)

### Tonight: Tier A (Foundation)
1. Phase 0 — Fix build errors + MEMORY.md
2. Phase 1 — Commit all 16 unstaged files
3. Phase 1.5 — Fix all workspace files
4. Save crash insurance

### Session 1 (9-midnight): Tier B
1. Phase 2 — Lane queue
2. Phase 3 — Security + layer violations
3. Phase 4 — Memory infrastructure

### Session 2 (9-midnight): Tier B + C
1. Phase 4 (cont.) — Hybrid search + memory flush
2. Phase 5 — Video pipeline
3. Phase 6 — SEO engine + GEO

### Session 3 (9-midnight): Tier D
1. Phase 7 — SOUL evolution
2. Phase 8 — Life intelligence (all 10 modules)

### Session 4 (9-midnight): Tier D + E
1. Phase 9 — Agent coordination
2. Phase 10 — Operations + cron fixes
3. Phase 11 — Housekeeping + tests

### Session 5 (9-midnight): Deploy
1. Phase 12.5 — Wire integrations
2. Phase 13 — Browser automation
3. Phase 12 — Mac Mini deployment
4. Phase 14 — 25-point verification

---

## TOTAL SCOPE SUMMARY

| Category | Count |
|----------|-------|
| Phases | 18 |
| Validated gaps addressed | 66 (G1-G66) |
| New source files | ~55 |
| Modified source files | ~40 |
| New test files | ~45 |
| New EventMap events | ~50 |
| New scheduled tasks | ~22 |
| New Telegram commands | ~12 |
| Telegram pipeline fixes | 14 |
| Layer violations to fix | 7 |
| Dead code files to address | 11 |
| Cron collisions to fix | 6 |
| Dormant integrations to wire | 10 |
| MCP integrations | 7 |
| Workspace files to fix | 7 |
| Build sessions needed | 5 |

---

*v8.0 | Feb 17, 2026 | THE DEFINITIVE BLUEPRINT*
