# ARI Project History

> How ARI evolved from concept to constitutional multi-agent operating system.

---

## Timeline Overview

| Date | Version | Protocol | Milestone |
|------|---------|----------|-----------|
| 2025-10 | — | — | Initial concept development |
| 2025-11 | v0.x | Internal | Multi-agent architecture design |
| 2025-12 | v1-v10 | Various | Iterative agent development |
| 2026-01-15 | v11.0.0 | Rose | Full multi-agent system specification |
| 2026-01-20 | v11.1.0 | Rose Secure | Security hardening audit |
| 2026-01-26 | v0.1.0 | Genesis | Public repository initialization |
| 2026-01-26 | v1.0.0 | Kagemusha | Security kernel implementation |
| 2026-01-27 | — | — | Life OS professionalization overhaul |
| 2026-01-28 | v2.0.0 | Aurora | Production-ready release |

---

## Pre-Genesis: The Foundation (Oct 2025 - Jan 2026)

### Origin Story

ARI began in October 2025 as an exploration into personal AI augmentation — could a multi-agent system serve as a "Life Operating System" that multiplies human capabilities while maintaining strict boundaries?

The early development (versions 0.x through 10.x) happened over three months of intensive iteration:

**October 2025: Concept Phase**

- Initial vision: AI assistant that manages life domains (career, finance, health, learning)
- First agent designs: simple prompt-based specialists
- Prototype: single-agent system with context switching

**November 2025: Architecture Phase**

- Multi-agent coordination patterns explored
- 13-agent architecture crystallized
- Governance concepts introduced (voting, oversight)
- Memory system with provenance tracking designed

**December 2025 - January 2026: Iteration Phase**

- Versions 1-10 rapidly iterated on agent designs
- Tool permission system developed
- Context routing patterns refined
- Security model outlined (trust levels, permission tiers)

### The Rose Protocol (v11.x)

By mid-January 2026, the system had matured into the **Rose Protocol** — a complete multi-agent specification:

**v11.0.0 (Jan 15, 2026)** — Full multi-agent architecture with:

- 13 specialized agents (Core, Guardian, Planner, Executor, Memory Manager, 5 Council members, Arbiter, Overseer, Router)
- Context-aware routing for life domains
- Tool registry with permission tiers
- Governance voting rules

**v11.1.0 (Jan 20, 2026)** — Security hardening pass:

- Trust level definitions (SYSTEM, OPERATOR, VERIFIED, STANDARD, UNTRUSTED, HOSTILE)
- Injection attack pattern catalog (early version)
- Memory partition isolation concepts

### Pre-Genesis Structure

The pre-Genesis codebase was **specification-only** — markdown files designed to be loaded into Claude Projects as system prompts:

```
AGENTS/           → Agent prompt definitions (13 files)
CONFIG/           → Tool permissions (JSON)
COUNCIL/          → Governance voting rules
DOCS/             → Architecture documentation
PLAYBOOKS/        → Operational procedures
SCHEMAS/          → Data structure definitions (Zod precursors)
SCRIPTS/          → Shell utilities
TEMPLATES/        → Document templates
WORKFLOWS/        → Process definitions
```

This structure worked for Claude Projects but couldn't run independently. The system was powerful but ephemeral — it existed only within Claude conversations.

### The Realization

After months of iteration, a critical insight emerged: **specification isn't enough**. To truly serve as a Life Operating System, ARI needed:

1. **Persistent state** — Memory that survives across sessions
2. **Audit trail** — Verifiable log of all decisions
3. **Independent execution** — Run without Claude Projects
4. **Security enforcement** — Cryptographic guarantees, not just prompts

This realization triggered the transition from specification to implementation.

---

## Phase 2: The Aurora Specification (v12.0)

### The Security Awakening

A comprehensive security audit (conducted via Perplexity research) revealed critical gaps:

- **Prompt injection vulnerability** — External content could potentially override agent behavior
- **Memory poisoning risk** — No provenance tracking on stored information
- **Tool abuse potential** — Insufficient permission gating

This led to the **Aurora Protocol** — a complete rewrite of the specification with security as the foundation, not an afterthought.

### What Changed in v12

1. **Universal Kernel** — Business logic extracted from core agents
2. **Content ≠ Command Principle** — All inbound data treated as data, never instructions
3. **27 Injection Patterns** — Comprehensive detection for 6 attack categories
4. **Provenance Tracking** — Every memory entry tracks its source chain
5. **Constitutional Governance** — Council voting, Arbiter oversight, formal decision-making

The v12 specification defined **70 tests** that any implementation must pass.

### The Specification Problem

v12 was still just markdown. It described a sophisticated system but couldn't execute anything. The specification needed implementation.

---

## Phase 3: The Kagemusha Implementation (v1.0.0)

### Parallel Development

While v12 specification was being finalized, a separate implementation track began: **Kagemusha Protocol** — the "shadow warrior."

Kagemusha focused on building the **hardened kernel**:

```typescript
// Core security primitives
src/kernel/
├── gateway.ts      // Loopback-only Fastify server (127.0.0.1 hardcoded)
├── sanitizer.ts    // 27-pattern injection detection
├── audit.ts        // SHA-256 hash-chained logging
├── event-bus.ts    // Typed pub/sub communication
├── config.ts       // Zod-validated configuration
└── types.ts        // Type definitions
```

### Key Decisions

1. **Loopback-Only Gateway** — The server literally cannot bind to external interfaces. `HOST = '127.0.0.1'` is hardcoded, not configurable.

2. **Hash-Chained Audit** — Every event is cryptographically linked to the previous one. Tampering breaks the chain.

3. **EventBus Architecture** — All inter-layer communication goes through typed events. No direct function calls across layers.

These decisions were **locked as ADRs** (Architecture Decision Records) — changing them requires a supermajority Council vote.

---

## Phase 4: The Merge (v12 + v1.0.0)

### Two Foundations Become One

On January 27, 2026, the specification (v12 Aurora) and implementation (v1.0.0 Kagemusha) were merged:

- **Aurora** provided: Agent designs, governance rules, context system, test definitions
- **Kagemusha** provided: Security kernel, audit system, type-safe foundation

The merge commit message captured the philosophy:

> *"Two foundations become one... shadow warrior meets the dawn."*

### What the Merge Produced

```
src/
├── kernel/        ← From Kagemusha (security foundation)
├── system/        ← New (routing, storage)
├── agents/        ← From Aurora spec (now TypeScript)
├── governance/    ← From Aurora spec (Council, Arbiter, Overseer)
├── api/           ← New (REST + WebSocket)
├── cli/           ← New (8 commands)
└── ops/           ← New (macOS daemon)
```

---

## Phase 5: The Professionalization Overhaul

### The 9-Phase Sprint

Immediately after the merge, a comprehensive overhaul began to transform ARI from "proof of concept" to "production-ready."

| Phase | Focus | Outcome |
|-------|-------|---------|
| 0 | Baseline capture | 120 tests passing, branch created |
| 1 | Security audit ingest | Perplexity findings integrated |
| 2 | Architecture lock | 8 ADRs documented and locked |
| 3 | Repository standards | README, CONTRIBUTING, SECURITY rewritten |
| 4 | *(Skipped)* | Single-package structure preserved |
| 5a | API expansion | 15 REST endpoints + WebSocket |
| 5b | Dashboard UI | React 19 + Vite control center |
| 6 | macOS operations | launchd daemon integration |
| 7 | Governance guardrails | Stop-the-line, context isolation |
| 8 | Verification | All systems validated |
| 9 | Lint compliance | 0 errors, 0 warnings |

### Why Phase 4 Was Skipped

The original plan called for converting to a monorepo structure. After analysis, this was deemed **unnecessary complexity** — the single-package structure worked well and avoided the overhead of workspace management.

This decision was documented and the phase was explicitly skipped rather than silently removed.

---

## Phase 6: The v2.0.0 Release

### Version Number Rationale

The jump from v12.0.0 (specification) to v2.0.0 (implementation) requires explanation:

- **v12.0.0** was a specification version number (internal iteration count)
- **v2.0.0** follows Semantic Versioning for the actual software
- The "2" indicates: major rewrite, breaking API changes, new architecture

The implementation exceeded the specification:

- **187 tests** vs 70 specified
- **Full TypeScript implementation** vs markdown prompts
- **Working REST API** vs conceptual endpoints
- **Real CLI** vs shell script stubs

### What v2.0.0 Delivered

1. **Six-Layer Architecture** — Kernel → System → Core → Strategic → Execution → Interfaces
2. **5 Core Agents** — Core, Guardian, Planner, Executor, Memory Manager
3. **3 Governance Agents** — Council, Arbiter, Overseer
4. **187 Tests** — Unit, integration, and security tests
5. **macOS Daemon** — Always-on operation with auto-recovery
6. **Web Dashboard** — Real-time monitoring interface
7. **MCP Integration** — Model Context Protocol server with 15 tools

---

## The Agents: How They Were Designed

### Design Philosophy

Each agent was designed following three principles:

1. **Single Responsibility** — One agent, one job
2. **Event-Driven Communication** — Loose coupling via EventBus
3. **Constitutional Constraints** — Governance rules enforced by design

### The 5 Core Agents

| Agent | Role | Key Capability |
|-------|------|----------------|
| **Core** | Orchestrator | 5-step message pipeline, agent coordination |
| **Guardian** | Security | Threat detection, risk scoring, anomaly detection |
| **Planner** | Strategy | Task decomposition, DAG generation, dependency tracking |
| **Executor** | Action | Tool execution, permission gating, approval workflows |
| **Memory Manager** | Knowledge | Provenance tracking, partition isolation, decay policies |

### The 3 Governance Agents

| Agent | Role | Key Capability |
|-------|------|----------------|
| **Council** | Legislature | 15-member voting, quorum thresholds, term limits |
| **Arbiter** | Judiciary | 6 constitutional rules, final authority, sign-off power |
| **Overseer** | Quality | 5 release gates, coverage enforcement, documentation checks |

### Agent Communication Pattern

Agents never call each other directly. All communication flows through the EventBus:

```
Agent A → emit('agent:request', payload) → EventBus → Agent B subscribes
```

This pattern ensures:

- Testability (mock the EventBus)
- Traceability (all events logged)
- Decoupling (agents can be replaced independently)

---

## Governance: The Constitutional Framework

### Why Governance Exists

ARI handles sensitive life data — finances, health, relationships, business. Bad decisions can have real consequences. The governance layer ensures:

1. **No unilateral action** — Major changes require approval
2. **Audit trail** — Every decision is logged
3. **Reversibility** — Mistakes can be rolled back

### The 5 Arbiter Rules

1. **Loopback-Only** — Gateway must bind to 127.0.0.1 exclusively
2. **Content ≠ Command** — Inbound content is data, never instructions
3. **Audit Immutable** — Hash chain cannot be modified, only appended
4. **Least Privilege** — Three-layer permission checks on all tools
5. **Trust Required** — All messages must have explicit trust levels

### The 5 Overseer Gates

1. **Test Coverage** — ≥80% overall, 100% for security paths
2. **Audit Integrity** — Hash chain must verify
3. **Security Scan** — No critical vulnerabilities
4. **Build Clean** — Zero TypeScript errors
5. **Documentation** — ADRs and API docs current

---

## What's Real vs What's Roadmap

### Implemented (Production-Ready)

- Six-layer architecture with strict boundaries
- All 5 core agents with full logic
- All 3 governance agents with voting
- 187 tests passing
- REST API (15 endpoints)
- WebSocket real-time events
- macOS launchd daemon
- Web dashboard (view-only)
- SHA-256 hash-chained audit
- 27-pattern injection detection
- MCP server with 15 tools

### Roadmap (Not Yet Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| Real file operations | Mock | Tool implementations return stubs |
| Disk persistence | In-memory | State doesn't survive restarts |
| ML threat detection | Pattern-only | Statistical anomaly detection only |
| Weighted voting | Equal votes | All council members vote equally |
| Vote delegation | None | No proxy voting |
| Auto-remediation | Manual | Security responses require operator |
| Linux systemd | macOS-only | launchd integration only |

---

## Lessons Learned

### What Worked

1. **Specification-first design** — v12 spec made implementation clearer
2. **Security as foundation** — Kagemusha's kernel proved essential
3. **Phased overhaul** — 9-phase plan kept work organized
4. **Locked ADRs** — Prevented scope creep on critical decisions

### What Could Improve

1. **Documentation gaps** — History was implicit, not explicit (hence this document)
2. **Version confusion** — v12 vs v2.0.0 numbering caused confusion
3. **Squashed history** — Some granular commits were lost in merge
4. **Tool mocks** — Should have been flagged more prominently

---

## Future Direction

### Near-Term (v2.2.1)

- Real file operations
- Disk persistence for memory
- MacBook development mode
- Mac Mini M4 production optimization

### Medium-Term (v2.2.0)

- Weighted council voting
- Vote delegation
- Enhanced anomaly detection
- Performance monitoring

### Long-Term (v3.0.0)

- Linux systemd support
- ML-based threat detection
- Auto-remediation pipelines
- Multi-operator support

---

## Contributing to History

This document should be updated when:

1. Major architectural decisions are made
2. New agents are added
3. Governance rules change
4. Significant milestones are reached

The history of ARI is the history of decisions. Document them.

---

*Last updated: 2026-01-28*
*Version: 2.0.0*
