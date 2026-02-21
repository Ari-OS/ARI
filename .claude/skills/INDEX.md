---
name: ARI Skill Graph Index
description: MOC (map of content) for all 46 ARI development skills. Traverse this index first to find the right skill, then follow the wikilink to load it.
---

# ARI Skill Graph

46 skills organized by domain. Scan this index to find what you need, then invoke the skill.

## Security & Safety

*Use when doing security reviews, detecting injection, managing trust, auditing*

- [[ari-injection-detection]] — ARI's 27-pattern injection detection across 6 categories. Use when reviewing input security.
- [[ari-hash-chain-auditor]] — Verify and manage ARI's SHA-256 hash-chained audit trail.
- [[ari-trust-levels]] — Manage ARI's six-level trust system with risk multipliers (SYSTEM 0.5x → HOSTILE 2.0x).
- [[ari-security-hygiene]] — Security-first practices for commits, data handling, and prompt injection defense.

## Architecture & Layer System

*Use when modifying layer dependencies, reviewing cross-layer imports, designing new components*

- [[ari-layer-guardian]] — Enforce ARI's six-layer architecture. Prevents L0-L6 dependency violations. **Use before cross-layer work.**
- [[ari-cognitive-layer]] — Complete guide to Layer 0 (LOGOS/ETHOS/PATHOS). Self-contained, no imports.
- [[ari-philosophy]] — Philosophical foundations guiding ARI's design and behavior.
- [[ari-fastify-gateway]] — Fastify gateway patterns for ARI's loopback-only security boundary.
- [[ari-eventbus-patterns]] — EventBus communication patterns for ARI's six-layer architecture.
- [[ari-websocket-patterns]] — WebSocket communication patterns for ARI's real-time features.

## Agent System

*Use when coordinating agents, creating new agents, managing governance*

- [[ari-agent-coordination]] — Coordinate ARI's five specialized agents (Core, Guardian, Planner, Executor, Memory).
- [[ari-council-governance]] — Manage ARI's 15-member constitutional governance council.
- [[ari-tool-creation]] — Create new tools for ARI's Executor agent.
- [[ari-natural-language]] — Natural language understanding and intent parsing.

## AI & Model Orchestration

*Use when selecting models, managing costs, working with AI providers*

- [[ari-model-selection]] — Intelligent model selection for autonomous ops — balance capability vs cost.
- [[ari-anthropic-monitor]] — Monitor official Anthropic releases for ARI improvements. **Verified sources only.**

## Testing

*Use before writing tests, fixing failures, measuring coverage*

- [[ari-vitest-guardian]] — Vitest-specific testing skill for ARI's 80%+ coverage requirement and security paths (100%).
- [[ari-testing-strategies]] — Comprehensive testing strategies for ARI's multi-layer architecture.

## Development Patterns

*Use when implementing features, writing TypeScript, building APIs*

- [[ari-zod-schemas]] — Zod schema management for ARI's type-safe runtime validation (ADR-006).
- [[ari-cli-development]] — Commander.js CLI development patterns for ARI's 24 CLI commands.
- [[ari-pino-logging]] — Pino structured logging patterns for ARI.
- [[ari-error-recovery]] — Error handling, recovery, and resilience patterns.
- [[ari-performance-optimization]] — Performance optimization patterns for real-time processing.
- [[ari-parallel-workflows]] — Spawn parallel agents for independent tasks using git worktrees.

## Memory & Knowledge

*Use when working with MEMORY.md, workspace files, session context*

- [[ari-memory-management]] — ARI's provenance-tracked memory system for knowledge persistence.
- [[ari-session-memory]] — Persist and retrieve context across Claude Code sessions.
- [[ari-knowledge-synthesizer]] — Synthesize learnings from sessions into permanent knowledge.
- [[ari-time-research]] — Research ARI's memory and knowledge over time windows.

## Self-Improvement & Learning

*Use when running improvement cycles, tracking skill gaps, learning from interactions*

- [[ari-continuous-improvement]] — ARI's continuous self-improvement and learning system.
- [[ari-self-improvement]] — Auto-review and enhance ARI's capabilities based on new releases.
- [[ari-learning-loop]] — ARI's 5-stage continuous learning system.
- [[ari-learning-mode]] — Activate comprehension-building interaction mode.
- [[ari-gap-analyzer]] — Identify gaps in ARI's capabilities, skills, and coverage.
- [[ari-practice]] — Deliberate practice with Anthropic's high-scoring interaction patterns.
- [[ari-review]] — Spaced repetition reviews (SM-2) with retrieval-first prompts.

## Operations & Deployment

*Use when deploying to Mac Mini, managing daemon, releasing versions*

- [[ari-daemon-ops]] — macOS launchd daemon operations for ARI. **Mac Mini deployment.**
- [[ari-release-management]] — Version management, releases, and deployment.
- [[ari-backup-recovery]] — Backup and disaster recovery procedures.
- [[ari-monitoring-alerting]] — Real-time monitoring and alerting system.

## Collaboration & Skills

*Use when creating new skills, integrating plugins, coworking*

- [[ari-skill-generator]] — Automatically generate new skills based on identified gaps.
- [[ari-cowork-plugin]] — Create, import, and manage Claude Cowork plugins.
- [[ari-teach-mode]] — Collaborative learning mode for building understanding.

## Platform Design

*Use when building UI, designing for specific platforms*

- [[platform-design]] — Router skill for platform-specific design guidelines.
- [[platform-web-design]] — Modern web design with WCAG accessibility.
- [[platform-ios-design]] — iOS Human Interface Guidelines as actionable rules.
- [[platform-android-design]] — Material Design 3 guidelines for native-quality Android.

---

## Traversal Hints

**Security work** → [[ari-injection-detection]] → [[ari-trust-levels]] → [[ari-hash-chain-auditor]]

**New feature** → [[ari-layer-guardian]] → [[ari-vitest-guardian]] → [[ari-zod-schemas]]

**Mac Mini deployment** → [[ari-daemon-ops]] → [[ari-release-management]] → [[ari-backup-recovery]]

**Agent task** → [[ari-agent-coordination]] → [[ari-tool-creation]] → [[ari-eventbus-patterns]]

**Memory work** → [[ari-memory-management]] → [[ari-session-memory]] → [[ari-knowledge-synthesizer]]

**Self-improvement** → [[ari-gap-analyzer]] → [[ari-continuous-improvement]] → [[ari-skill-generator]]
