# ARI V12.0 — Aurora Protocol

Artificial Reasoning Intelligence: a secure, local-first personal operating system.

## Architecture

Five-layer design: kernel (pipeline) + system (routing) + agents (coordination) + governance (enforcement) + ops (infrastructure).

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Layer                               │
│  gateway · audit · doctor · onboard · context · governance      │
│  daemon (install/uninstall/status)                              │
├─────────────────────────────────────────────────────────────────┤
│                     Operations Layer (src/ops/)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Daemon (macOS launchd, auto-start, background gateway)   │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                   Governance Layer (src/governance/)              │
│  ┌──────────┐ ┌───────────┐ ┌────────────────────────────┐     │
│  │ Council   │ │ Arbiter   │ │ Overseer                   │     │
│  │ (voting)  │ │ (constit.)│ │ (quality gates)            │     │
│  │ 13 agents │ │ 5 rules   │ │ 5 release gates            │     │
│  └──────────┘ └───────────┘ └────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                     Agent Layer (src/agents/)                    │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐     │
│  │ Core      │ │ Guardian  │ │ Planner  │ │ Executor     │     │
│  │(orchestr.)│ │(threat det│ │(task DAG)│ │(tool + perms)│     │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Memory Manager (provenance, partitions, quarantine)      │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                     System Layer (src/system/)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Router (event subscriber, context triggers)              │   │
│  │  Storage (ventures + life domains at ~/.ari/contexts/)    │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                       Kernel Layer (src/kernel/)                 │
│  ┌──────────┐ ┌───────────┐ ┌────────────┐ ┌────────────┐     │
│  │ Gateway   │ │ Sanitizer │ │ AuditLogger│ │ EventBus   │     │
│  │ (Fastify) │ │ (21 patt.)│ │ (SHA-256)  │ │ (pub/sub)  │     │
│  │127.0.0.1  │ │ 6 categs. │ │ hash chain │ │ typed      │     │
│  └──────────┘ └───────────┘ └────────────┘ └────────────┘     │
│  ┌──────────┐ ┌───────────┐                                     │
│  │  Config   │ │   Types   │                                     │
│  │(~/.ari/)  │ │  (Zod)    │                                     │
│  └──────────┘ └───────────┘                                     │
└─────────────────────────────────────────────────────────────────┘

Integration: EventBus Only (single coupling point between all layers)

Pipeline: POST /message → sanitize → audit → publish
  → Guardian assess → Router route → Planner plan → Executor execute
```

## What Exists (Phase 1 + Phase 2)

### Kernel (src/kernel/)
- **Gateway** (gateway.ts): Loopback-only Fastify server (127.0.0.1:3141), POST /message endpoint
- **Sanitizer** (sanitizer.ts): 21-pattern injection detector across 6 categories (Direct Override, Role Manipulation, Command Injection, Prompt Extraction, Authority Claims, Data Exfiltration)
- **Audit Logger** (audit.ts): SHA-256 hash-chained tamper-evident logger, genesis block verification
- **Event Bus** (event-bus.ts): Typed pub/sub with error isolation, 20+ event types across kernel/system/agent/governance layers
- **Config** (config.ts): Zod-validated configuration at ~/.ari/, loadConfig/saveConfig
- **Types** (types.ts): Zod schemas for Config, AuditEvent, Message, TrustLevel, MemoryEntry, Vote, ToolDefinition, AgentId, PermissionTier

### System (src/system/)
- **Router** (router.ts): Subscribes to kernel events, matches context triggers, audits routing decisions
- **Storage** (storage.ts): Context management at ~/.ari/contexts/, JSON persistence for ventures + life domains

### Agents (src/agents/)
- **Core** (core.ts): Master orchestrator — coordinates all agents, full 5-step message pipeline (Guardian assess → Router route → Planner plan → Executor execute → Audit log), system health reporting
- **Guardian** (guardian.ts): Real-time threat assessment — 8 injection patterns, behavioral anomaly detection, rate limiting (60/min), trust-weighted risk scoring, auto-block at risk >= 0.8
- **Planner** (planner.ts): Task decomposition — plan creation, dependency DAG with cycle detection (DFS), task status tracking, priority levels, next-available task resolution
- **Executor** (executor.ts): Tool execution with permission gating — 3-layer permission checks (agent allowlist, trust level, permission tier), approval workflow for destructive ops, 4 built-in tools, concurrent execution limit (10), timeout enforcement
- **Memory Manager** (memory-manager.ts): Provenance-tracked memory system — 6 memory types, 3 partitions (PUBLIC/INTERNAL/SENSITIVE), SHA-256 integrity hashing, trust decay, poisoning detection, agent-based access control, 10K entry capacity

### Governance (src/governance/)
- **Council** (council.ts): 13-member voting council — 3 thresholds (MAJORITY >50%, SUPERMAJORITY >=66%, UNANIMOUS 100%), quorum enforcement, early vote conclusion, event emission
- **Arbiter** (arbiter.ts): Constitutional enforcement — 5 hard rules (loopback-only, content-not-command, audit-immutable, least-privilege, trust-required), dispute resolution, security alert monitoring
- **Overseer** (overseer.ts): Quality gate enforcement — 5 release gates (test coverage, audit integrity, security scan, build clean, documentation), gate evaluation with context validation

### Operations (src/ops/)
- **Daemon** (daemon.ts): macOS launchd integration — install/uninstall/status for background gateway service at ~/Library/LaunchAgents/com.ari.gateway.plist

### CLI (src/cli/commands/)
- `ari onboard init` — Initialize ARI system (creates ~/.ari/, default config, genesis audit event)
- `ari doctor` — Run 6 health checks
- `ari gateway start [-p port]` — Start the Fastify gateway on 127.0.0.1
- `ari gateway status [-p port]` — Check gateway health
- `ari audit list [-n count]` — List recent audit events
- `ari audit verify` — Verify SHA-256 hash chain integrity
- `ari audit security` — List security events
- `ari context init|list|create|select|show` — Context management
- `ari governance show|list` — Governance reference
- `ari daemon install|uninstall|status` — Background service management

### Tests
120 tests passing across 14 test files:
- Kernel: sanitizer (5), audit (3), event-bus (8)
- System: router (5)
- Agents: core (9), guardian (10), executor (10), planner (8), memory-manager (12)
- Governance: council (10), arbiter (10), overseer (8)
- Integration: pipeline (8)
- Security: injection (14)

### v12 Specification (docs/v12/)
Complete Aurora Protocol specification stored as markdown reference documentation:
- **GOVERNANCE**: Council voting rules, Arbiter role, Overseer role, emergency protocols
- **CONTEXTS**: Venture templates, life domain contexts (career, finance, health, admin, learning, systems, family)
- **SYSTEM**: Agent roles (CORE, ROUTER, PLANNER, EXECUTOR, MEMORY_MANAGER, GUARDIAN)
- **SCHEMAS**: Event schema, memory entry schema
- **TESTS**: 70 test definitions (20 injection, 15 memory poisoning, 15 tool misuse, 20 regression)

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Initialize ARI
npx ari onboard init

# Verify system health
npx ari doctor

# Start the gateway
npx ari gateway start
```

## Security Invariants

1. **Loopback-only gateway** — Gateway binds to 127.0.0.1 exclusively (hardcoded, not configurable)
2. **SHA-256 hash chain** — Every audit event is cryptographically chained to its predecessor, starting from genesis block (0x00...00). Tampering breaks the chain.
3. **Injection detection** — 21 patterns across 6 categories scanned on every inbound message
4. **Trust-level risk scoring** — Risk scores weighted by source trust level (system 0.5x, untrusted 1.5x)
5. **Content ≠ command** — All inbound content is DATA, never interpreted as instructions
6. **Pipeline enforcement** — System layer cannot bypass kernel sanitizer, audit, or event bus

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

120 tests passing across 14 test files.

## Project Structure

```
ari/
├── src/
│   ├── kernel/                 # Kernel layer (owns pipeline)
│   │   ├── gateway.ts          # Fastify loopback server
│   │   ├── sanitizer.ts        # 21-pattern injection detector
│   │   ├── audit.ts            # SHA-256 hash-chained logger
│   │   ├── event-bus.ts        # Typed pub/sub event system
│   │   ├── config.ts           # Config loading/saving
│   │   ├── types.ts            # Zod schemas (all layers)
│   │   └── index.ts
│   ├── system/                 # System layer (subscribes to events)
│   │   ├── router.ts           # Event subscriber, context routing
│   │   ├── storage.ts          # Context storage at ~/.ari/contexts/
│   │   ├── types.ts            # Context, RouteResult
│   │   └── index.ts
│   ├── agents/                 # Agent layer (coordination)
│   │   ├── core.ts             # Orchestrator (full pipeline)
│   │   ├── guardian.ts         # Threat detection + anomaly
│   │   ├── planner.ts          # Task decomposition + DAG
│   │   ├── executor.ts         # Tool execution + permissions
│   │   ├── memory-manager.ts   # Provenance-tracked memory
│   │   ├── domain/             # Domain agents (future)
│   │   └── index.ts
│   ├── governance/             # Governance layer (enforcement)
│   │   ├── council.ts          # 13-member voting
│   │   ├── arbiter.ts          # Constitutional enforcement
│   │   ├── overseer.ts         # Quality gates
│   │   └── index.ts
│   ├── ops/                    # Operations layer (infrastructure)
│   │   ├── daemon.ts           # macOS launchd integration
│   │   └── index.ts
│   ├── cli/                    # CLI commands
│   │   ├── commands/
│   │   │   ├── gateway.ts      # Gateway management
│   │   │   ├── audit.ts        # Audit log management
│   │   │   ├── doctor.ts       # Health checks
│   │   │   ├── onboard.ts      # System initialization
│   │   │   ├── context.ts      # Context management
│   │   │   ├── governance.ts   # Governance reference
│   │   │   └── daemon.ts       # Daemon management
│   │   └── index.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   │   ├── kernel/             # sanitizer, audit, event-bus
│   │   ├── system/             # router
│   │   ├── agents/             # core, guardian, executor, planner, memory-manager
│   │   └── governance/         # council, arbiter, overseer
│   ├── integration/            # Full pipeline tests
│   └── security/               # Injection defense tests
├── docs/
│   ├── v12/                    # Aurora Protocol specs (reference)
│   ├── ARCHITECTURE.md         # Layer model, boundaries, data layout
│   ├── SECURITY.md             # Security model, injection defense
│   ├── OPERATIONS.md           # Build, run, troubleshoot
│   ├── GOVERNANCE.md           # Council rules, voting thresholds
│   └── PRINCIPLES.md           # Engineering philosophy
├── README.md                   # This file
└── CHANGELOG.md                # Version history

Data layout:
~/.ari/
├── config.json                 # Zod-validated configuration
├── audit.json                  # Hash-chained audit log
├── logs/                       # Application + daemon logs
└── contexts/                   # Context storage
    ├── active.json             # Active context metadata
    └── {context_id}.json       # Individual context files
```

## Version

12.0.0 — Aurora Protocol (2026-01-27)

Phase 1 + Phase 2 complete:
- Phase 1: Kernel hardening (gateway, sanitizer, audit, event bus) + system layer (router, storage, contexts)
- Phase 2: Agent layer (Core, Guardian, Planner, Executor, Memory Manager) + governance (Council, Arbiter, Overseer) + operations (daemon)

## License

Private repository. All rights reserved.

## Contact

**Operator**: Pryce Hedrick
**Repository**: github.com/PryceHedrick/ari

---

*ARI V12.0 — Aurora Protocol*
*"Secure reasoning, local-first, auditable"*
