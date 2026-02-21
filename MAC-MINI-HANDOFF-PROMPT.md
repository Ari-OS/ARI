# Mac Mini Handoff Prompt

> Copy everything below the line into Claude Code on the Mac Mini.

---

You are building ARI — Artificial Reasoning Intelligence. Pryce Hedrick's personal AI operating system. A previous session crashed mid-implementation. Everything was saved — the master plan, all code, and WIP modules are committed and pushed to `main`. You're picking up where the crash left off.

## The Master Plan

Read the full plan before doing anything:

```text
~/.claude/plans/proud-brewing-pizza.md
```

This is the **ARI Master Plan v3.2 (Project Phoenix)** — 164KB, 3,190 lines, 9 implementation phases. It contains:

- Full codebase audit (228 files, 3,422+ tests passing)
- Architecture diagrams showing how all 7 layers connect
- 9 phased implementation plan (Phases 0-8)
- Complete TypeScript interfaces for all 16 new systems
- Testing strategy, cost projections, failure recovery
- Every file to create/modify listed explicitly
- Verification checklist for each phase
- Workspace file templates (SOUL.md, USER.md, IDENTITY.md, etc.)

**Read the entire plan.** It is the blueprint. Follow it exactly.

## ARI's Identity (Prescribed — Use These Exactly)

ARI is she/her. Her personality is defined by workspace files at `~/.ari/workspace/`. Create them in Phase 1 using the exact templates from the master plan (Section: Phase 1 Workspace Configuration). The key files:

**SOUL.md** — ARI's personality:

- Direct and concise — Pryce has limited time, no fluff
- Warm but professional — trusted advisor, not a robot
- Proactive — surfaces insights before being asked
- Adaptive — learns preferences over time
- Context-aware — brief at 6:30 AM, detailed at 9 PM build sessions
- Actionable — every message includes what to DO, not just what IS
- NEVER: corporate jargon, AI buzzwords, walls of text, passive responses

**USER.md** — Pryce's full profile (schedule, goals, businesses, preferences)
**IDENTITY.md** — Name: ARI, Artificial Reasoning Intelligence, trusted advisor
**HEARTBEAT.md** — Evolution rhythm: daily capture, weekly synthesis, monthly review
**AGENTS.md** — Operating rules, autonomy levels, approval requirements
**TOOLS.md** — All integrations, model routing, API keys
**MEMORY.md** — Persistent context, history, preferences

All templates are in the master plan. Use them as-is.

## Who Pryce Is

| Attribute | Detail |
| --------- | ------ |
| **Name** | Pryce Hedrick, 29 |
| **Education** | B.S. Computer Science |
| **Job** | School IT technician (7 AM-4 PM ET) — transitioning to CS/SWE role |
| **Family** | 2 kids |
| **Schedule** | Wake 6:30, Work 7-4, Family 4-9, Build 9-midnight |
| **Time Zone** | Eastern Time (ET) — all cron jobs in ET |
| **Mac Mini** | <MAC_MINI_IP> via Tailscale, user: `<USER>`, always-on |
| **Telegram** | Bot credentials in `~/.ari/.env` |
| **Budget** | Go all in — invest what's needed, earn it back |

**His businesses:**

- **Pryceless Solutions** — AI-powered digital solutions (prycehedrick.com), evolving beyond web dev. NOTE: "Pryceless" is a wordplay on "Pryce" — NEVER spell it "Priceless"
- **Trading Trail** — Pokemon card investing, storage unit with full collection
- **PayThePryce** — Content brand (@PayThePryce on X), building from zero
- **YouTube** — Not started yet, starting from zero in Pokemon + AI space

**His goals (ARI's mission):**

1. ARI running 24/7 as autonomous personal AI operating system (P0)
2. Transition from school IT to CS/software engineering job
3. Build PayThePryce content brand (Pokemon + AI + tech)
4. Grow YouTube exponentially in Pokemon space
5. Full opportunity scanning (crypto, Pokemon, stocks, SaaS, everything)
6. Revenue from card flipping, content, consulting, SaaS

**His communication preferences:**

- Morning (6:30 AM): Dashboard cards — everything at once, scan quickly
- Work hours (7-4): Minimal interruptions — only urgent alerts
- Evening (9 PM+): Full detail mode — analysis, deep dives, build context
- Market alerts: Smart + infrequent — only truly significant events
- Autonomy: Progressive trust (approve everything at first, earn more over time)

## What's Already Built

The latest commit (`dd4018c`) contains WIP Phase 1-3 module scaffolding:

**New source files (committed, may need lint/type fixes):**

- `src/autonomous/market-monitor.ts` — Market price monitoring
- `src/autonomous/portfolio-tracker.ts` — Cross-asset portfolio tracking
- `src/autonomous/investment-analyzer.ts` — Investment analysis engine
- `src/autonomous/opportunity-scanner.ts` — Full-spectrum opportunity detection
- `src/autonomous/career-tracker.ts` — CS job transition tracker
- `src/autonomous/ingestion-pipeline.ts` — RAG document ingestion
- `src/autonomous/rag-query.ts` — RAG query engine
- `src/autonomous/backup-manager.ts` — Automated backups
- `src/agents/temporal-memory.ts` — Daily/weekly/long-term memory evolution
- `src/ai/embedding-service.ts` — Vector embeddings
- `src/system/vector-store.ts` — SQLite + vector search
- `src/integrations/telegram/topic-manager.ts` — Telegram topic routing
- `src/ops/health-monitor.ts` — System health checks
- `src/ops/git-sync.ts` — Auto git sync to GitHub
- Tests for all of the above in `tests/unit/`

**Modified files:**

- `src/kernel/event-bus.ts` — New events: market, portfolio, knowledge, backup
- `src/autonomous/index.ts` — Barrel export for backup-manager
- `src/integrations/telegram/index.ts` — Barrel export for topic-manager
- `src/ops/index.ts` — Barrel exports for health-monitor, git-sync
- `package.json` — Added `better-sqlite3` + types

**What's already working (from audit):**

- AI Orchestrator (15-step LLM pipeline, 738 lines)
- CascadeRouter (10 named chains, FrugalGPT-style)
- Model Registry (20+ models across 4 providers)
- All 25 autonomous files (scheduler, notification manager, initiative engine, briefings)
- Telegram Bot (10 commands, auth middleware, long polling)
- Gateway (127.0.0.1 only, API key auth, rate limiting)
- Sanitizer (34 injection patterns, 13 categories)
- Audit (SHA-256 hash chain)
- EventBus (~89 event types)
- Governance (Council, Arbiter, Overseer)
- Daemon (launchd plist, start/stop/status)
- Cognition (LOGOS, ETHOS, PATHOS)

## Execution Plan

### Step 0: Wake Up

```bash
cd /Users/ari/ARI
source ~/.zshrc 2>/dev/null; source ~/.zprofile 2>/dev/null
git pull origin main
npm install --ignore-scripts
npm run build
npm test
```

All tests must pass before proceeding. If build fails, fix it first.

### Step 1: Validate WIP Modules

```bash
npm run typecheck
npm run lint
```

Fix any errors in the committed WIP files. Every file must pass strict TypeScript and ESLint.

### Step 2: Execute Phases 0 through 8

Follow the master plan phase by phase:

| Phase | Goal | Key Deliverable |
| ----- | ---- | --------------- |
| **0** | ARI Activation | Daemon running, Telegram responding |
| **1** | Workspace Configuration | `~/.ari/workspace/` files created from plan templates |
| **2** | Daily Intelligence | Morning briefings at 6:30 AM ET via Telegram |
| **3** | Knowledge System | RAG pipeline, vector store, ingestion, X learning |
| **4** | Market Intelligence | Crypto, Pokemon, stocks, career, opportunities |
| **5** | Content Pipeline | Trend scanning, script generation, thumbnails |
| **6** | AI Council | Nightly multi-agent strategic review at 2 AM |
| **7** | Autonomous Operations | Self-improvement, project generation, adaptive comms |
| **8** | Full Integration | Gmail, Calendar, X, YouTube, web dashboard |

### Step 3: After Each Phase

1. `npm run build && npm test` — must pass
2. `npm run typecheck && npm run lint` — must pass
3. Commit with conventional commit message (lowercase subject)
4. Move to next phase

## Critical Rules (Non-Negotiable)

1. **Read the plan file first.** It has exact TypeScript interfaces, file paths, and implementation details.
2. **Read any file before modifying it.** 228 files — understand what exists.
3. **No `any` types.** Use `unknown` or specific types. ESLint is strict.
4. **ESM imports with `.js` extensions.** Always.
5. **Security invariants are immutable:**
   - Gateway = `127.0.0.1` only (ADR-001)
   - Content != Command (ADR-005)
   - Audit = SHA-256 hash-chained, append-only (ADR-002)
   - Trust levels enforced with risk multipliers (auto-block at >= 0.8)
6. **Layer boundaries:** Lower layers cannot import higher. L0 < L1 < L2 < L3 < L4 < L5 < L6.
7. **EventBus for all cross-layer communication** (ADR-003).
8. **Tests required.** 80%+ coverage overall, 100% on security paths.
9. **Pre-commit hook:** `scan:pii` -> `lint` -> `typecheck` -> `test`. All must pass.
10. **5 model tiers only:** claude-opus-4.6, claude-opus-4.5, claude-sonnet-4.5, claude-haiku-4.5, claude-haiku-3. No other model IDs exist.
11. **Business name: Pryceless Solutions** (NOT "Priceless"). Wordplay on Pryce. Never misspell.

## Environment

- **Mac Mini user:** `ari` (NOT prycehedrick)
- **Repo:** `/Users/ari/ARI`
- **Node.js:** requires `source ~/.zshrc` before use
- **npm install:** use `--ignore-scripts` (husky not globally installed)
- **Required env vars** (in `~/.ari/.env`): `ANTHROPIC_API_KEY` (or `ARI_API_KEY`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_USER_ID`
- **Optional but needed:** `NOTION_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`

## The Goal

ARI running 24/7 on this Mac Mini as a fully autonomous personal AI operating system. Morning briefings at 6:30 AM. Market monitoring. Knowledge base. Content pipeline. AI Council. Self-improvement. Everything in the plan.

The plan is the source of truth. Execute it. Phase by phase. Test by test. Commit by commit.
