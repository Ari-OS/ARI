# ARI Intelligence & Autonomous Operations Guide

> **Purpose:** Comprehensive reference for understanding ARI's AI routing, autonomous scheduling, budget management, and multi-provider intelligence system. This document explains what existed before, what changed, how it was designed, and the full scope of ARI's capabilities.

---

## Table of Contents

1. [What ARI Is](#1-what-ari-is)
2. [The 7-Layer Architecture](#2-the-7-layer-architecture)
3. [The AI Intelligence Layer — Before & After](#3-the-ai-intelligence-layer--before--after)
4. [Multi-Provider Model Registry (20 Models)](#4-multi-provider-model-registry-20-models)
5. [The FrugalGPT Cascade Router](#5-the-frugalgpt-cascade-router)
6. [All 10 Cascade Chains Explained](#6-all-10-cascade-chains-explained)
7. [Task Category Routing Map](#7-task-category-routing-map)
8. [Quality Scoring: How ARI Decides to Escalate](#8-quality-scoring-how-ari-decides-to-escalate)
9. [The Autonomous Scheduling System](#9-the-autonomous-scheduling-system)
10. [Budget Management: Two Systems Working Together](#10-budget-management-two-systems-working-together)
11. [Provider Credits & Monthly Cost Projection](#11-provider-credits--monthly-cost-projection)
12. [Planned: Time-Block Scheduling](#12-planned-time-block-scheduling)
13. [Known Gaps & What's Next](#13-known-gaps--whats-next)
14. [Full Capability Reference](#14-full-capability-reference)

---

## 1. What ARI Is

ARI (Artificial Reasoning Intelligence) is a personal AI operating system designed to run autonomously on a Mac Mini. It operates 24/7, handling scheduled tasks, responding to messages, managing knowledge, and progressively learning — all while staying within a strict monthly budget.

ARI is not a chatbot. It's an **autonomous agent system** with:

- 5 specialized agents (Core, Guardian, Planner, Executor, Memory Manager)
- Constitutional governance (Council, Arbiter, Overseer)
- Multi-provider AI routing across 4 LLM providers
- Proactive initiative discovery (finds work to do on its own)
- Budget-aware operation (throttles itself before overspending)

---

## 2. The 7-Layer Architecture

ARI uses a strict layered architecture where **lower layers cannot import higher layers**. All cross-layer communication goes through the EventBus.

```
L6 Interfaces   ← CLI, Dashboard, Telegram Bot
L5 Execution     ← Daemon, Ops, Model Router
L4 Strategic     ← Council, Arbiter, Overseer (governance)
L3 Agents        ← Core, Guardian, Planner, Executor, Memory Manager
L2 System        ← Channel Router, Storage, Integrations
L1 Kernel        ← Gateway, Sanitizer, Audit, EventBus
L0 Cognitive     ← LOGOS/ETHOS/PATHOS, Learning Loop (self-contained)
```

**Key files for each layer:**

| Layer | Directory | Key Files |
|-------|-----------|-----------|
| L6 | `src/cli/`, `src/dashboard/` | CLI interface, Next.js dashboard |
| L5 | `src/execution/`, `src/autonomous/` | Agent loop, scheduler, budget tracking |
| L4 | `src/governance/` | Council voting, Arbiter decisions, Overseer monitoring |
| L3 | `src/agents/` | Multi-agent pipeline |
| L2 | `src/system/` | Message routing, storage |
| L1 | `src/kernel/` | Security boundary (all input sanitized here) |
| L0 | `src/cognitive/` | Self-assessment, gap analysis, performance review |

**The EventBus** is the single coupling point. Example flow:

```
User message → Gateway (L1) → Sanitizer (L1) → Audit (L1)
  → Core agent (L3) → Guardian assessment (L3)
  → AIOrchestrator → CascadeRouter → LLM provider
  → Response back through Core agent → Channel reply
```

---

## 3. The AI Intelligence Layer — Before & After

### Before: Single-Provider, Claude-Only

**What existed:**

- Only Anthropic as LLM provider
- `BudgetTracker.getRecommendedModel()` returned hardcoded Claude model names:
  - Conservative mode: `claude-3-haiku` → `claude-3.5-haiku` → `claude-haiku-4.5`
  - Balanced mode: `claude-3.5-haiku` → `claude-sonnet-4` → `claude-sonnet-4.5`
  - Aggressive mode: `claude-sonnet-4` → `claude-sonnet-4.5` → `claude-opus-4.6`
- `ValueScorer.selectModelForScore()` only considered Claude models
- `ModelSelector` (legacy) had stale model names: `claude-opus-4`, `gpt-4o`
- No cascade routing — single model selected per request

**Problems with this approach:**

1. Stuck on one provider — if Anthropic is down, everything stops
2. Overpaying for simple tasks — using $3/M Sonnet when $0.20/M Grok would do
3. No leveraging Google's free tier (1,500 requests/day on Gemini Flash)
4. No task-aware model selection — same model for heartbeats and code generation

### After: Multi-Provider, 20 Models, 10 Cascade Chains

**What was designed and implemented:**

| Component | File | Purpose |
|-----------|------|---------|
| **Model Registry** | `src/ai/model-registry.ts` | Single source of truth for all 20 models across 4 providers |
| **Provider Registry** | `src/ai/provider-registry.ts` | Auto-discovers API keys from env vars, manages provider connections |
| **Cascade Router** | `src/ai/cascade-router.ts` | FrugalGPT-inspired routing: cheapest model first, escalate on low quality |
| **OpenAI Provider** | `src/ai/providers/openai-provider.ts` | OpenAI API integration (GPT-5.2, GPT-4.1, o3, o4-mini, Codex) |
| **Google Provider** | `src/ai/providers/google-provider.ts` | Google AI integration (Gemini 2.5 Pro, Flash, Flash-lite) |
| **xAI Provider** | `src/ai/providers/xai-provider.ts` | xAI/Grok integration (Grok 4, 4.1 Fast, 4 Fast, 3 Mini) |
| **Anthropic Provider** | `src/ai/providers/anthropic-provider.ts` | Existing, upgraded (Opus 4.6, Opus 4.5, Sonnet 4.5, Sonnet 4, Haiku 4.5, Haiku 3) |

**How auto-discovery works:**

```
Gateway startup → ModelRegistry (20 models, non-Anthropic off by default)
  → ProviderRegistry.registerFromEnv()
    → checks process.env for ANTHROPIC_API_KEY, OPENAI_API_KEY,
      GOOGLE_AI_API_KEY, XAI_API_KEY
    → for each key found: register provider + enable its models in ModelRegistry
  → AIOrchestrator gets fully-loaded provider & model registries
```

Your `.env` file has all 4 keys configured. When ARI starts, all 20 models become available automatically.

---

## 4. Multi-Provider Model Registry (20 Models)

All models are defined in `src/ai/model-registry.ts` with accurate February 2026 pricing.

### Anthropic (6 models) — Available by default

| Model | Quality | Speed | Input $/M | Output $/M | Context | Capabilities |
|-------|---------|-------|-----------|------------|---------|-------------|
| `claude-opus-4.6` | 10 | 5 | $5.00 | $25.00 | 1M | text, code, reasoning, vision, tools |
| `claude-opus-4.5` | 9 | 4 | $5.00 | $25.00 | 200K | text, code, reasoning, vision, tools |
| `claude-sonnet-4.5` | 8 | 7 | $3.00 | $15.00 | 200K | text, code, reasoning, vision, tools |
| `claude-sonnet-4` | 7 | 7 | $3.00 | $15.00 | 200K | text, code, reasoning, vision, tools |
| `claude-haiku-4.5` | 6 | 10 | $1.00 | $5.00 | 200K | text, code, reasoning, tools |
| `claude-haiku-3` | 5 | 10 | $0.25 | $1.25 | 200K | text, code, tools |

### OpenAI (7 models) — Enabled via `OPENAI_API_KEY`

| Model | Quality | Speed | Input $/M | Output $/M | Context | Capabilities |
|-------|---------|-------|-----------|------------|---------|-------------|
| `gpt-5.2` | 9 | 7 | $1.75 | $14.00 | 128K | text, code, reasoning, vision, tools |
| `gpt-4.1` | 8 | 7 | $2.00 | $8.00 | 1M | text, code, reasoning, vision, tools |
| `gpt-4.1-mini` | 6 | 9 | $0.40 | $1.60 | 1M | text, code, reasoning, tools |
| `gpt-4.1-nano` | 4 | 10 | $0.10 | $0.40 | 1M | text, code |
| `o3` | 9 | 3 | $2.00 | $8.00 | 200K | text, code, reasoning |
| `o4-mini` | 7 | 6 | $1.10 | $4.40 | 200K | text, code, reasoning |
| `codex-mini` | 7 | 8 | $1.50 | $6.00 | 192K | code, reasoning |

### Google (3 models) — Enabled via `GOOGLE_AI_API_KEY`, **FREE TIER available**

| Model | Quality | Speed | Input $/M | Output $/M | Context | Free Tier |
|-------|---------|-------|-----------|------------|---------|-----------|
| `gemini-2.5-pro` | 9 | 7 | $1.25 | $10.00 | 1M | Limited |
| `gemini-2.5-flash` | 7 | 10 | $0.30 | $2.50 | 1M | **1,500 RPD** |
| `gemini-2.5-flash-lite` | 5 | 10 | $0.10 | $0.40 | 1M | **1,500 RPD** |

### xAI (4 models) — Enabled via `XAI_API_KEY`

| Model | Quality | Speed | Input $/M | Output $/M | Context | Notes |
|-------|---------|-------|-----------|------------|---------|-------|
| `grok-4` | 8 | 6 | $3.00 | $15.00 | 256K | Full reasoning |
| `grok-4.1-fast` | 6 | 10 | $0.20 | $0.50 | **2M** | Reasoning mode, agentic-trained |
| `grok-4-fast` | 5 | 10 | $0.20 | $0.50 | **2M** | Non-reasoning, 164 t/s |
| `grok-3-mini` | 5 | 9 | $0.30 | $0.50 | 131K | Reasoning |

**Key pricing insight:** The cheapest models across all providers:

1. `gemini-2.5-flash-lite` — $0.10/M input (FREE on Google tier)
2. `gpt-4.1-nano` — $0.10/M input
3. `grok-4.1-fast` — $0.20/M input (with reasoning mode!)
4. `grok-4-fast` — $0.20/M input (no reasoning, fastest)

---

## 5. The FrugalGPT Cascade Router

**Based on:** Stanford's FrugalGPT paper (Chen, Zaharia, Zou, 2023) and LMSys RouteLLM (ICLR 2025).

### Core Concept

Instead of always using the best (most expensive) model, ARI routes requests through a **cascade** — starting with the cheapest model and escalating only if the response quality is too low.

```
Request arrives
  ↓
Select cascade chain based on task type
  ↓
Step 1: Try cheapest model (e.g., grok-4-fast at $0.20/M)
  ↓ Score quality using heuristics
  ↓ Quality >= threshold? → Return response (DONE)
  ↓ Quality < threshold? → Escalate to next model
  ↓
Step 2: Try mid-tier model (e.g., claude-haiku-4.5 at $1.00/M)
  ↓ Score quality
  ↓ Quality >= threshold? → Return response (DONE)
  ↓ Quality < threshold? → Escalate
  ↓
Step N: Last model in chain → Always accept (threshold = 0.0)
```

**Why this saves money:** For simple queries like "What time zone am I in?", grok-4-fast ($0.20/M) answers perfectly. ARI scores it as high quality and stops immediately — never touching the $3/M or $5/M models. Only genuinely difficult requests escalate to expensive models.

**Cost impact:** Estimated 60-85% cost reduction compared to using Sonnet for everything.

### File Location

`src/ai/cascade-router.ts` — 471 lines, fully implemented and tested.

---

## 6. All 10 Cascade Chains Explained

Each chain is designed for a specific type of task, with models selected based on their proven strengths.

### Chain 1: `frugal` — General Queries

**For:** Chat, FAQ, simple questions, anything not matching a specific category.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4-fast` | xAI | 0.70 | ~$0.00035 |
| 2 | `gemini-2.5-flash-lite` | Google | 0.65 | ~$0.00025 |
| 3 | `claude-haiku-4.5` | Anthropic | 0.50 | ~$0.0035 |
| 4 | `claude-sonnet-4.5` | Anthropic | 0.00 | ~$0.0105 |

**Design rationale:** Grok-4-fast has zero thinking overhead (164 tokens/sec) — perfect for "what is X?" queries. Flash-lite is even cheaper but rate-limited on free tier, so it's second to avoid exhausting the daily quota on trivial queries.

---

### Chain 2: `balanced` — Claude-Only Quality

**For:** Tasks needing Claude-quality guarantees (specified via complexity override).

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `claude-haiku-4.5` | Anthropic | 0.70 | ~$0.0035 |
| 2 | `claude-sonnet-4.5` | Anthropic | 0.50 | ~$0.0105 |
| 3 | `claude-opus-4.6` | Anthropic | 0.00 | ~$0.0175 |

**Design rationale:** Sometimes you specifically want Anthropic's safety training and writing style. Haiku 4.5 matches Sonnet 4 intelligence at 1/3 the cost.

---

### Chain 3: `quality` — Minimum Sonnet Floor

**For:** Critical complexity tasks — things that must not fail.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `claude-sonnet-4.5` | Anthropic | 0.50 | ~$0.0105 |
| 2 | `claude-opus-4.6` | Anthropic | 0.00 | ~$0.0175 |

**Design rationale:** No cheap models at all. Sonnet 4.5 handles 95% of hard tasks; Opus only for the remaining 5% where Sonnet was uncertain.

---

### Chain 4: `code` — Code Generation & Review

**For:** Code generation, code review, debugging, refactoring.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4.1-fast` | xAI | 0.75 | ~$0.00035 |
| 2 | `claude-haiku-4.5` | Anthropic | 0.60 | ~$0.0035 |
| 3 | `claude-sonnet-4.5` | Anthropic | 0.00 | ~$0.0105 |

**Design rationale:** Grok 4.1 Fast has reasoning mode at $0.20/M — handles straightforward coding tasks. Higher threshold (0.75) because code must be correct. Sonnet 4.5 is SOTA at 77.2% on SWE-bench.

---

### Chain 5: `reasoning` — Deep Analysis & Planning

**For:** Planning, math, analysis, research.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4.1-fast` | xAI | 0.75 | ~$0.00035 |
| 2 | `o4-mini` | OpenAI | 0.60 | ~$0.0033 |
| 3 | `claude-opus-4.6` | Anthropic | 0.00 | ~$0.0175 |

**Design rationale:** Natural escalation path — fast reasoning (Grok), dedicated STEM reasoning (o4-mini), maximum intelligence (Opus). Three different providers, each optimized for reasoning tasks.

---

### Chain 6: `agentic` — Tool-Use Workflows

**For:** Tool invocation, automation, web search.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4.1-fast` | xAI | 0.70 | ~$0.00035 |
| 2 | `claude-haiku-4.5` | Anthropic | 0.50 | ~$0.0035 |
| 3 | `claude-sonnet-4.5` | Anthropic | 0.00 | ~$0.0105 |

**Design rationale:** Grok 4.1 Fast was **specifically designed** for agentic tool-use workflows — trained with long-horizon RL, ranks #1 on LMArena Search. Threshold is 0.70 (not 0.75) because tool-use responses are often terse JSON, which the heuristic scorer might rate lower.

---

### Chain 7: `bulk` — High-Volume Processing

**For:** Classification, tagging, extraction, command parsing, heartbeats.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `gemini-2.5-flash-lite` | Google | 0.60 | ~$0.00025 |
| 2 | `grok-4-fast` | xAI | 0.50 | ~$0.00035 |
| 3 | `gemini-2.5-flash` | Google | 0.00 | ~$0.0016 |

**Design rationale:** This is where the **Google free tier** saves the most money. Flash-lite at $0.10/M is the cheapest model across all providers, and at 1,500 free requests/day, you get ~$0.44/day in free processing. Bulk tasks (classify this, tag that) don't need expensive models.

---

### Chain 8: `creative` — Writing & Content

**For:** Creative writing, content summarization.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4-fast` | xAI | 0.75 | ~$0.00035 |
| 2 | `gemini-2.5-flash` | Google | 0.65 | ~$0.0016 |
| 3 | `claude-haiku-4.5` | Anthropic | 0.50 | ~$0.0035 |
| 4 | `claude-sonnet-4.5` | Anthropic | 0.00 | ~$0.0105 |

**Design rationale:** Creative writing benefits from **provider diversity** — different models have different "voices." Four steps across 3 providers gives the system multiple chances to get the tone right. Threshold is high (0.75) because creative quality is harder to assess heuristically.

---

### Chain 9: `long-context` — Document Analysis

**For:** Analyzing large documents, long conversations.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `grok-4.1-fast` | xAI | 0.70 | varies |
| 2 | `gemini-2.5-flash` | Google | 0.55 | varies |
| 3 | `gemini-2.5-pro` | Google | 0.00 | varies |

**Design rationale:** Context window is the constraint. Grok 4.1 Fast has the **largest context at 2M tokens** for $0.20/M — unbeatable price-to-context ratio. Gemini Flash (1M) and Pro (1M) provide quality escalation within the same provider.

---

### Chain 10: `security` — Threat Analysis (Never Compromise)

**For:** Security-sensitive tasks, threat assessment.

| Step | Model | Provider | Threshold | Cost/req |
|------|-------|----------|-----------|----------|
| 1 | `claude-sonnet-4.5` | Anthropic | 0.50 | ~$0.0105 |
| 2 | `claude-opus-4.6` | Anthropic | 0.00 | ~$0.0175 |

**Design rationale:** Security analysis **must never route to cheap models**. A $0.001 saving that misses a vulnerability is worthless. Both models are Anthropic — the provider with the strongest Constitutional AI safety training. Minimum floor is Sonnet 4.5 (quality 8).

---

## 7. Task Category Routing Map

When a request comes in, ARI maps the task category to a cascade chain:

```
Category                → Chain         → Starting Model
─────────────────────────────────────────────────────────
code_generation         → code          → grok-4.1-fast
code_review             → code          → grok-4.1-fast
debugging               → code          → grok-4.1-fast
refactoring             → code          → grok-4.1-fast
planning                → reasoning     → grok-4.1-fast
math                    → reasoning     → grok-4.1-fast
analysis                → reasoning     → grok-4.1-fast
research                → reasoning     → grok-4.1-fast
tool_use                → agentic       → grok-4.1-fast
automation              → agentic       → grok-4.1-fast
web_search              → agentic       → grok-4.1-fast
creative                → creative      → grok-4-fast
writing                 → creative      → grok-4-fast
summarize               → creative      → grok-4-fast
classification          → bulk          → gemini-2.5-flash-lite
tagging                 → bulk          → gemini-2.5-flash-lite
extraction              → bulk          → gemini-2.5-flash-lite
parse_command           → bulk          → gemini-2.5-flash-lite
heartbeat               → bulk          → gemini-2.5-flash-lite
document_analysis       → long-context  → grok-4.1-fast
long_context            → long-context  → grok-4.1-fast
chat                    → frugal        → grok-4-fast
query                   → frugal        → grok-4-fast
security                → security      → claude-sonnet-4.5
threat_assessment       → security      → claude-sonnet-4.5
```

**Override rules:**

- `securitySensitive: true` → always `security` chain (regardless of category)
- `complexity: 'critical'` → always `quality` chain (minimum Sonnet)
- `complexity: 'complex'` with no matching category → `balanced` chain

---

## 8. Quality Scoring: How ARI Decides to Escalate

At each cascade step, ARI scores the response using heuristics (no trained model needed):

| Signal | Effect on Score | Example |
|--------|----------------|---------|
| **Length adequacy** | +0.15 if response is ≥30% of query length | Short response to long question = suspicious |
| **Very short response** | -0.30 if <20 chars for >100 char query | "I don't know" to a detailed question |
| **Uncertainty markers** | -0.10 each (max ~0.60 penalty) | "I'm not sure", "I don't know", "unclear" |
| **Valid JSON** | +0.15 | Response starts with `{` or `[` and parses |
| **Invalid JSON** | -0.15 | Attempted JSON that doesn't parse |
| **Code blocks** | +0.10 | Contains ``` code blocks ``` |
| **Refusal** | -0.30 | "As an AI", "I can't help with" |
| **Confidence markers** | +0.05 each | "Here is", "The answer is", "Step 1", numbered lists |

**Base score:** 0.50 (neutral)
**Range:** 0.0 to 1.0

**How it works in practice:**

- "Here is a detailed answer with step 1, step 2, step 3" → score ~0.85 (high confidence, structured)
- "I am not sure. Unclear." → score ~0.20 (uncertainty + short)
- Valid JSON response → score ~0.65 (structural completeness)

---

## 9. The Autonomous Scheduling System

ARI runs 17 scheduled tasks, divided into **essential** (always run) and **non-essential** (skipped when budget is constrained).

### Essential Tasks (Run Even in Budget-Reduce Mode)

| Task | Schedule | Purpose |
|------|----------|---------|
| `morning-briefing` | 6:30 AM daily | Generate morning context for the day |
| `user-daily-brief` | 7:30 AM daily | Daily focus, action items, and insights |
| `changelog-generate` | 7:00 PM daily | Summarize what changed today |
| `evening-summary` | 9:00 PM daily | End-of-day wrap-up |
| `agent-health-check` | Every 15 min | Monitor system health |

### Non-Essential Tasks (Skipped When Budget Constrained)

| Task | Schedule | Purpose |
|------|----------|---------|
| `knowledge-index-morning` | 8:00 AM | Index new knowledge sources |
| `knowledge-index-afternoon` | 2:00 PM | Afternoon knowledge refresh |
| `knowledge-index-evening` | 8:00 PM | Evening knowledge update |
| `weekly-review` | Sunday 6:00 PM | Weekly retrospective |
| `e2e-daily-run` | 9:00 AM | Run automated end-to-end tests |
| `self-improvement-daily` | 9:00 PM | Analyze learning and performance |

### Cognitive Learning Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| `cognitive-performance-review` | 9:00 PM daily | Review decisions made in past 24h |
| `cognitive-gap-analysis` | Sunday 8:00 PM | Identify knowledge gaps from the week |
| `cognitive-self-assessment` | 1st of month 9:00 AM | Monthly comprehensive self-evaluation |
| `spaced-repetition-review` | 8:00 AM daily | Daily concept card review |

### Initiative Engine (Proactive Work Discovery)

| Task | Schedule | Purpose |
|------|----------|---------|
| `initiative-comprehensive-scan` | 6:00 AM | Find new work to do autonomously |
| `initiative-midday-check` | 2:00 PM | Mid-day progress + urgent work check |

**How budget affects scheduling:**

- Budget `normal` → All 17 tasks run
- Budget `warning` → All tasks run (with logging)
- Budget `reduce` → Only 5 essential tasks run
- Budget `pause` → Only health checks run

**State persistence:** Task execution state is saved to `~/.ari/scheduler-state.json` to survive restarts.

---

## 10. Budget Management: Two Systems Working Together

ARI has two budget tracking systems that serve different purposes.

### CostTracker (Daily Token Limits)

**File:** `src/observability/cost-tracker.ts` (1,045 lines)
**Persists to:** `~/.ari/token-usage.json`

**Purpose:** Real-time daily token tracking with throttle levels.

| Throttle Level | Trigger | Effect |
|----------------|---------|--------|
| `normal` | <80% budget | All operations allowed |
| `warning` | 80-90% | Logs warnings, considers reducing autonomous work |
| `reduce` | 90-95% | Background tasks blocked, essential only |
| `pause` | >95% | All non-URGENT tasks blocked |

**Budget defaults:**

- Daily: $10 / 800K tokens
- Weekly: $50
- Monthly: $200

**Key feature:** `canProceed(estimatedTokens, priority)` gates every AI operation. URGENT (user interactions) always allowed. BACKGROUND tasks blocked first as budget tightens.

### BudgetTracker (Monthly Billing Cycle)

**File:** `src/autonomous/budget-tracker.ts` (831 lines)
**Persists to:** `~/.ari/budget-state.json`

**Purpose:** Monthly billing cycle management with model recommendations.

| Mode | Budget Remaining | Behavior |
|------|-----------------|----------|
| `conservative` | <30% | Use cheapest models only |
| `balanced` | 30-70% | Standard model selection |
| `aggressive` | >70% | Can use expensive models |
| `paused` | <5% | All autonomous work stops |

**Current gap:** `getRecommendedModel()` only returns Claude models. This needs updating to leverage the full 20-model registry (see Known Gaps section).

### How They Work Together

```
Request arrives
  ↓
CostTracker.canProceed() — Can we afford this request today?
  ↓ (if yes)
BudgetTracker.getRecommendedModel() — What quality level can we afford this month?
  ↓
CascadeRouter.selectChain() — Which cascade chain matches the task type?
  ↓
CascadeRouter.execute() — Run through cascade, cheapest to most expensive
  ↓
CostTracker.track() — Record actual cost, update throttle levels
```

---

## 11. Provider Credits & Monthly Cost Projection

### Current Provider Budget

| Provider | Credit/Budget | Estimated Requests | Estimated Duration |
|----------|--------------|-------------------|-------------------|
| **Anthropic** | Subscription | Unlimited (basic) | Ongoing |
| **OpenAI** | $10.00 credits | ~3,000 (at o4-mini rates) | ~30 days at 100 req/day |
| **Google** | Free tier | 1,500/day unlimited | Unlimited |
| **xAI** | $25.00 credits | ~71,000 (at grok-fast rates) | ~710 days at 100 req/day |

### Monthly Cost Projection (100 requests/day average)

| Scenario | Distribution | Est. Monthly Cost |
|----------|-------------|-------------------|
| **Frugal (most tasks simple)** | 70% bulk/frugal, 20% code, 10% quality | ~$8-12/month |
| **Balanced (mixed workload)** | 40% frugal, 30% code/reasoning, 20% creative, 10% quality | ~$15-20/month |
| **Heavy (lots of code/reasoning)** | 20% frugal, 50% code/reasoning, 20% quality, 10% security | ~$25-35/month |

**The Google free tier alone saves $4-8/month** by handling all bulk processing (classification, tagging, heartbeats) without any cost.

### Cost Per Request by Chain (assuming 1K input / 500 output tokens)

| Chain | 80% Step 1 | 15% Step 2 | 5% Step 3+ | Weighted Average |
|-------|-----------|-----------|------------|-----------------|
| `frugal` | $0.00035 | $0.00025 | $0.0035 | **~$0.0005** |
| `bulk` | $0.00025 | $0.00035 | $0.0016 | **~$0.0003** |
| `code` | $0.00035 | $0.0035 | $0.0105 | **~$0.0010** |
| `reasoning` | $0.00035 | $0.0033 | $0.0175 | **~$0.0012** |
| `agentic` | $0.00035 | $0.0035 | $0.0105 | **~$0.0010** |
| `creative` | $0.00035 | $0.0016 | $0.0035 | **~$0.0006** |
| `security` | $0.0105 | $0.0175 | — | **~$0.0119** |

---

## 12. Planned: Time-Block Scheduling

**Status:** Designed, implementation in progress.

### Concept

Divide the 24-hour day into 5 operational blocks, each with different model routing, budget allocation, and task scheduling behaviors.

### The 5 Time Blocks

| Block | Hours | Purpose | Preferred Models | Budget Weight |
|-------|-------|---------|-----------------|---------------|
| **Overnight** | 11 PM – 5 AM | Deep batch work (research, learning, curation) | Flash-lite (FREE), grok-fast | 15% |
| **Morning** | 6 AM – 8 AM | Delivery (briefings, summaries, initiative scan) | haiku-4.5, flash | 10% |
| **Active** | 8 AM – 5 PM | Full support (user is working, high priority) | Full cascade, quality available | 40% |
| **Family** | 5 PM – 9 PM | Low-power (only essential tasks) | frugal/bulk chains only | 15% |
| **Wind-down** | 9 PM – 11 PM | Evening reports, cognitive review | haiku-4.5, flash | 20% |

### How Time Blocks Change Behavior

1. **Chain selection adjustment:** During `overnight` and `family` blocks, prefer cheaper chains. During `active`, all chains available.
2. **Budget allocation:** Each block gets a percentage of the daily budget. Overnight uses Google free tier for ~70% of its work.
3. **Task scheduling:** Overnight batch tasks (research aggregation, content curation, knowledge learning) run during the 11 PM – 5 AM window using the cheapest available models.
4. **Cascade threshold adjustment:** During budget-constrained blocks, lower the quality thresholds slightly to avoid unnecessary escalation.

### Overnight Batch Tasks (Planned)

| Task | Cron | Model Strategy |
|------|------|---------------|
| Research aggregation | 11:30 PM | gemini-2.5-flash-lite (FREE) |
| Content curation | 12:00 AM | gemini-2.5-flash-lite (FREE) |
| Knowledge learning | 1:00 AM | gemini-2.5-flash (FREE) |
| Financial monitoring | 2:00 AM | grok-4-fast ($0.20/M) |
| Weekly wisdom digest | 3:00 AM Sunday | gemini-2.5-flash (FREE) |
| System cleanup | 4:00 AM | No LLM needed |

---

## 13. Known Gaps & What's Next

### Gap 1: CascadeRouter is Wired but Not Used in Orchestrator

**Issue:** The AIOrchestrator's `execute()` method uses `providers.completeWithFallback()` (single model) instead of `cascadeRouter.execute()` (multi-model cascade). The CascadeRouter is constructed and available but never invoked from the main execution path.

**Impact:** All 10 cascade chains with their carefully designed multi-provider routing are currently unused. Requests go through ValueScorer (Claude-only) → single model completion.

**Fix needed:** Orchestrator step 9 should call `cascadeRouter.execute()` instead of `providers.completeWithFallback()`.

### Gap 2: ValueScorer is Claude-Only

**Issue:** `ValueScorer.selectModelForScore()` only considers Claude models. `selectBestCandidate()` and `selectWithFallback()` have hardcoded Claude-only fallback hierarchies.

**Impact:** Even when the CascadeRouter is wired in, the ValueScorer's model recommendation ignores 14 of the 20 available models.

**Fix needed:** ValueScorer should be used for complexity classification and budget-pressure adjustment only, not model selection. CascadeRouter should be the single routing authority.

### Gap 3: BudgetTracker Returns Claude-Only Models

**Issue:** `BudgetTracker.getRecommendedModel()` returns hardcoded Claude model names (`claude-3-haiku`, `claude-sonnet-4`, etc.) regardless of which providers are available.

**Fix needed:** Use ModelRegistry to select from all available models based on quality tier and budget mode.

### Gap 4: Legacy Routers Have Stale Models

**Issue:** `model-router.ts` references `claude-opus-4`, `gpt-4o`, `cerebras-llama-70b`. `model-selector.ts` references `claude-opus-4`, `gpt-4o`, `gpt-4o-mini`.

**Fix needed:** Deprecate these in favor of CascadeRouter, or update to use ModelRegistry.

### Gap 5: Time-Block System Not Yet Implemented

**Status:** In progress — the `time-blocks.ts` module is being created now.

---

## 14. Full Capability Reference

### What ARI Can Do Right Now

| Capability | Status | Key Files |
|-----------|--------|-----------|
| Multi-provider LLM routing (4 providers, 20 models) | Implemented | `model-registry.ts`, `provider-registry.ts` |
| FrugalGPT cascade routing (10 chains) | Implemented (not wired to orchestrator yet) | `cascade-router.ts` |
| Scheduled autonomous tasks (17 tasks) | Implemented | `scheduler.ts` |
| Budget-aware throttling (4 levels) | Implemented | `cost-tracker.ts` |
| Monthly billing cycle tracking | Implemented | `budget-tracker.ts` |
| Telegram bot integration | Implemented | `src/integrations/telegram/` |
| Morning briefings & daily reports | Implemented | `briefings.ts` |
| Initiative engine (proactive work discovery) | Implemented | `initiative-engine.ts` |
| Cognitive learning loop (L0) | Implemented | `src/cognitive/` |
| Security: injection detection, content sanitization | Implemented | `src/kernel/sanitizer.ts` |
| Security: hash-chained audit log | Implemented | `src/kernel/audit.ts` |
| Security: loopback-only gateway (127.0.0.1) | Implemented | `src/kernel/gateway.ts` |
| Multi-agent pipeline (5 agents) | Implemented | `src/agents/` |
| Constitutional governance | Implemented | `src/governance/` |
| Dashboard API (Fastify) | Implemented | `src/dashboard/` |
| Provider health monitoring | Implemented | `provider-registry.ts` |
| Auto-discovery of API keys from env | Implemented | `provider-registry.ts` |

### What ARI Cannot Do Yet (But Is Designed For)

| Capability | Status | Notes |
|-----------|--------|-------|
| Wire CascadeRouter into orchestrator execution | Gap | Cascade chains exist but aren't invoked |
| Time-block-aware scheduling | In Progress | 5-block day structure |
| Overnight batch processing | Planned | 11PM-5AM deep work using free tier |
| Multi-provider budget recommendations | Gap | BudgetTracker still Claude-only |
| Cross-provider performance tracking | Partial | PerformanceTracker exists but not wired to cascade |

---

*Generated: 2026-02-10*
*ARI v2.2.1 — Multi-Provider Intelligence Architecture*
