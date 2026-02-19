# ARI Glossary

Terms specific to ARI's architecture, philosophy, and implementation.

---

## Core Concepts

**ARI** — Artificial Reasoning Intelligence. Pryce Hedrick's personal AI operating system. Pronouns: she/her.

**Aurora Protocol** — The v2.0 architectural overhaul that introduced the multi-agent system, 7-layer architecture, constitutional governance, and cognitive layer. Named for the northern lights — emergent, self-organizing, distributed.

**Kagemusha Protocol** — The v1.0 foundational implementation. "Shadow warrior" — silent, protective, operating in the background.

**Genesis Protocol** — The v0.1.0 initial proof of concept that established the kernel boundary.

---

## Architecture

**Seven-Layer Architecture** — ARI's strict dependency hierarchy:
| Layer | Name | Purpose |
|-------|------|---------|
| L0 | Cognitive | LOGOS/ETHOS/PATHOS reasoning (no external imports) |
| L1 | Kernel | Security boundary — Gateway, Sanitizer, Audit, EventBus |
| L2 | System | Routing, storage, context loading |
| L3 | Agents | Multi-agent coordination — Core, Guardian, Planner, Executor, Memory |
| L4 | Strategic | Constitutional governance — Council, Arbiter, Overseer |
| L5 | Execution | Daemon, Ops, health monitoring |
| L6 | Interfaces | CLI, Dashboard, REST API |

**EventBus** — The sole communication channel between architecture layers. Lower layers cannot import from higher layers; they communicate exclusively through EventBus events (`namespace:action` format).

**ADR (Architecture Decision Record)** — Locked design decisions that cannot be changed without council consensus. See `docs/architecture/DECISIONS.md`.

**Gateway** — The Fastify HTTP server that is ARI's external interface. Binds exclusively to `127.0.0.1` (loopback) — never reachable from outside the local machine.

---

## Cognitive Layer (L0)

**LOGOS** — ARI's logical reasoning module. Handles structured analysis, argument evaluation, and formal decision-making. Pure TypeScript functions, no external dependencies.

**ETHOS** — ARI's ethical reasoning module. Evaluates actions against Pryce's values and ARI's constitutional principles. Generates ethical assessments and flags conflicts.

**PATHOS** — ARI's emotional intelligence module. Models Pryce's emotional state, detects communication tone, and ensures empathetic responses. Does not simulate emotion in ARI — models it in the user.

**Cognitive Triad** — The LOGOS/ETHOS/PATHOS framework working together. All significant decisions pass through all three modules.

---

## Security

**Sanitizer** — The 42-pattern injection detection system in `src/kernel/sanitizer.ts`. Blocks prompt injection, command injection, template injection, and 6 other attack categories before content reaches any AI model.

**Hash Chain Audit** — Every action ARI takes is logged with a SHA-256 hash that references the previous log entry (like a blockchain). No entry can be altered without breaking the chain. Immutable by design.

**Trust Levels** — Six tiers that modify risk scoring:
| Level | Multiplier | Who |
|-------|------------|-----|
| SYSTEM | 0.5x | Internal ARI processes |
| OPERATOR | 0.6x | Admin-configured agents |
| VERIFIED | 0.75x | Authenticated human users |
| STANDARD | 1.0x | Default |
| UNTRUSTED | 1.5x | Unknown sources |
| HOSTILE | 2.0x | Confirmed threat actors |

**Auto-block Threshold** — Risk score ≥ 0.8 causes automatic block. Threshold is immutable (ADR-001 equivalent).

**Content ≠ Command** — ADR-005. All external input is treated as DATA, never as executable instructions. User messages are content to be processed, not commands to be executed.

---

## Governance

**Council** — ARI's 15-member constitutional governance body. Each member represents a domain (security, ethics, creativity, etc.) and votes on significant proposals. Majority required; veto requires 2/3 supermajority.

**Arbiter** — The final decision authority when the Council reaches impasse. Makes binding rulings based on constitutional principles.

**Overseer** — The constitutional monitor that ensures the Council and Arbiter operate within their charter. Can flag unconstitutional decisions.

**Policy Engine** — The system that enforces governance decisions as runtime policies. Policies define allowed actions, trust requirements, and escalation rules.

**Constitutional Principle** — A fundamental rule that governs ARI's behavior and cannot be overridden by any single agent or policy.

---

## Autonomous Operation

**Scheduler** — ARI's internal task runner. Manages 35+ cron-style tasks including morning briefings, market scans, career scans, intelligence gathering, and self-improvement cycles.

**Initiative Engine** — ARI's proactive suggestion system. Scans for opportunities and patterns that Pryce hasn't explicitly requested but might value.

**Autonomous Agent** — The top-level orchestrator that polls scheduled tasks, handles Telegram messages, routes intents, and coordinates all proactive behavior.

**Briefing** — ARI's daily summary messages delivered via Telegram:
- **Morning briefing**: 6:30 AM — weather, calendar, tasks, market, news
- **Evening summary**: 9:00 PM — day recap, tomorrow preview
- **Weekly review**: Sundays 6:00 PM — week in review, next week prep

**Daily Digest** — A curated collection of intelligence items (news, market moves, career opportunities) generated continuously and included in the morning briefing.

---

## Memory & Knowledge

**VectorStore** — SQLite-based semantic search storage using 1536-dimensional OpenAI embeddings. Enables ARI to search past context by meaning rather than exact keywords.

**Temporal Memory** — Time-tagged knowledge entries that allow ARI to reason about when she learned something and whether it might be outdated.

**Workspace Files** — Nine markdown files in `~/.ari/workspace/` that define ARI's operating context (SOUL, IDENTITY, USER, MEMORY, GOALS, PREFERENCES, AGENTS, TOOLS, HEARTBEAT).

**RAG (Retrieval Augmented Generation)** — ARI's pattern of supplementing AI model calls with retrieved context from VectorStore, making responses grounded in Pryce's specific situation.

---

## Agents

**CoreAgent** — The primary message processing agent. Routes incoming requests through sanitizer → intent classification → response generation.

**GuardianAgent** — The security-focused agent that verifies every action against trust levels, permission tiers, and constitutional constraints before execution.

**PlannerAgent** — Decomposes complex goals into executable steps. Creates and manages multi-step task plans.

**ExecutorAgent** — Runs approved tool calls with least-privilege enforcement. Has an allowlist of permitted tools per trust level.

**MemoryManager** — Manages knowledge ingestion, VectorStore operations, workspace file updates, and temporal memory entries.

---

## Integrations

**Telegram Bot** — ARI's primary human interface. Real-time bidirectional communication via `@ari_pryce_bot`. All messages are sanitized before reaching core agents.

**Notion** — Primary knowledge base and task management. ARI reads tasks from Notion databases and writes logs, briefings, and summaries back.

**Langfuse** — Observability platform for tracking AI model calls — cost per call, prompt versions, latency, and quality scores.

**ElevenLabs** — Text-to-speech synthesis for voice outputs.

---

## Development

**Conventional Commits** — ARI's commit message format: `type(scope): lowercase subject`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

**Pre-commit Hook** — Runs `scan:pii` → `lint` → `typecheck` → `test` on every commit. All must pass. Enforced by Husky + lint-staged.

**ESM** — ECMAScript Modules. ARI uses `type: "module"` in package.json with `.js` extensions on all imports (required for Node.js ESM compatibility).

**Zod** — TypeScript-first schema validation library (ADR-006). All external input validated with Zod schemas before processing.

**Vitest** — ARI's test runner (ADR-007). Faster than Jest for TypeScript/ESM projects.

---

## People & Places

**Pryce Hedrick** — ARI's creator and sole operator. Works in school IT (7am-4pm), builds ARI evenings (9pm-midnight). Located in Indiana.

**Pryceless Solutions** — Pryce's AI consulting business (note spelling: Pryce + priceless). Website: prycehedrick.com.

**PayThePryce** — Pryce's content brand for AI/tech content. One word, camelCase.

**Mac Mini** — ARI's home server. SSH: `ari@100.81.73.34` (Tailscale). Runs the ARI gateway daemon 24/7.

---

*v1.0 · 2026-02-19*
