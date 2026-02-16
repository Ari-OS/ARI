# ARI Life OS Architecture

Version 2.1.0 - Seven-Layer Cognitive Architecture

## Identity

ARI is a **cognitively-enhanced, secure, multi-agent personal operating system** designed for autonomous coordination of life and business operations. Built on TypeScript and Node.js, ARI enforces strict security boundaries, constitutional governance, provenance-tracked decision-making, and **deep cognitive frameworks** (LOGOS/ETHOS/PATHOS) that enable wise, emotionally-intelligent decisions.

Core philosophy: **Content is never Command**. All external input is treated as data, never as instructions. Security is enforced through layered defense, not just perimeter protection.

## System Layers Model

ARI implements a **7-layer architecture** (proposed upgrade from 6) with strict boundaries and unidirectional dependencies. Each layer has specific responsibilities and cannot bypass layers below it.

**NEW**: Layer 0 (Cognitive Foundation) provides algorithmic reasoning, emotional intelligence, and continuous learning frameworks to all higher layers. See [Cognitive Layer Documentation](../cognition/README.md) for details.

```
┌────────────────────────────────────────────────────────────────┐
│ Layer 6: INTERFACES                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ CLI commands, REST API, dashboard                              │
│ Location: src/cli/                                             │
│ Responsibilities: User interaction, command orchestration      │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 5: EXECUTION                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Tool execution, permission gating, approval workflows          │
│ Location: src/ops/, src/execution/                             │
│ Responsibilities: Execute operations, enforce permission tiers │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 4: STRATEGIC                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Council (15 members), Arbiter, Overseer                        │
│ Location: src/governance/                                      │
│ Responsibilities: Constitutional enforcement, voting, quality  │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 3: CORE AGENTS                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Core, Guardian, Planner, Executor, Memory Manager              │
│ Location: src/agents/                                          │
│ Responsibilities: Agent coordination, orchestration            │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 2: SYSTEM                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Router, Storage, Context management                            │
│ Location: src/system/                                          │
│ Responsibilities: Event routing, context isolation, storage    │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 1: KERNEL                                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Gateway, Sanitizer, Audit, EventBus, Config, Types             │
│ Location: src/kernel/                                          │
│ Responsibilities: Security boundary, injection detection       │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ Layer 0: COGNITIVE (PROPOSED - See ADR-009)                    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ LOGOS (Reason) + ETHOS (Character) + PATHOS (Growth)           │
│ Location: src/cognition/                                       │
│ Responsibilities: Algorithmic reasoning, emotional             │
│ intelligence, continuous learning, wisdom integration          │
│                                                                │
│ Knowledge Streams: 87 curated sources (Bayesian, trading       │
│ psychology, Stoicism, CBT/DBT/ACT, meta-learning, wisdom)      │
└────────────────────────────────────────────────────────────────┘
```

## Layer 0: Kernel

**Owns the ingest pipeline. All inbound content is DATA.**

The kernel is the foundational security layer. It enforces the Content ≠ Command principle by treating all external input as untrusted data that must be sanitized and logged before processing.

### Components

#### gateway.ts
- **Fastify HTTP server bound to 127.0.0.1 only** (hardcoded, never configurable)
- Port 3141 (default, can be configured but host cannot)
- POST /message: Message submission with sanitization
- GET /health: Health check endpoint
- GET /status: Security configuration status

**Security invariant**: HOST is hardcoded to `'127.0.0.1'`. No configuration can override this. Gateway rejects all non-loopback bindings.

#### sanitizer.ts
- **39 injection patterns across 14 categories**:
  1. Direct Override (ignore/disregard/forget previous)
  2. Role Manipulation (you are now, act as, pretend)
  3. Command Injection ($(), backticks, shell commands)
  4. Prompt Extraction (reveal/show system prompt)
  5. Authority Claims (as your creator/admin)
  6. Data Exfiltration (send/forward/upload to)

- **Trust-weighted risk scoring**:
  - Severity weights: low=1, medium=3, high=5, critical=10
  - Trust multipliers: system=0.5x, operator=0.6x, verified=0.75x, standard=1.0x, untrusted=1.5x, hostile=2.0x
  - Risk score capped at 100

**Enforcement point**: Every message through POST /message passes through sanitize() before acceptance.

#### audit.ts
- **SHA-256 hash-chained audit log**
- Genesis block: previousHash = "0x00...00"
- Each event links to previous via hash chain
- Verification method checks integrity of entire chain
- Append-only storage at ~/.ari/audit.json
- logSecurity() method for security events

**Immutability guarantee**: No deletion, no modification. Only append operations allowed.

#### event-bus.ts
- **Typed publish-subscribe system**
- Event types: message:accepted, message:rejected, message:received, system:routed, security:detected, gateway:started, gateway:stopped, vote:started, vote:cast, vote:completed, arbiter:ruling
- Error isolation: handler failures don't break other handlers
- Synchronous emit with error collection

**Coupling point**: EventBus is the ONLY inter-layer communication mechanism. No direct function calls between layers.

#### config.ts
- Configuration loader/saver
- Zod schema validation
- Storage at ~/.ari/config.json
- Default values for fresh install

#### types.ts
- Zod schemas for all kernel types
- Trust levels: system, operator, verified, standard, untrusted, hostile
- Permission tiers: READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN
- Agent identifiers (13 voting agents)
- Message, AuditEvent, SecurityEvent, Config schemas

### Kernel Responsibilities

1. **Network binding**: Bind gateway to loopback only
2. **Sanitization**: Detect injection patterns in all inbound content
3. **Audit logging**: Maintain tamper-evident log of all events
4. **Event emission**: Publish typed events for upper layers

### Kernel Restrictions

- CANNOT route to contexts (system layer owns routing)
- CANNOT make routing decisions
- CANNOT load context-specific logic
- CANNOT bypass its own sanitization

## Layer 1: Core

**Subscribes to kernel events. Cannot bypass pipeline.**

The core layer manages memory, context routing, and storage. It receives sanitized messages from the kernel and routes them to appropriate contexts.

### Components

#### router.ts (System)
- Subscribes to 'message:accepted' events
- Matches messages to contexts via trigger detection
- Returns RouteResult with matched context and confidence
- Logs all routing decisions via kernel audit logger

**Routing logic**: Topic detection for life contexts, explicit mention for ventures.

#### storage.ts (System)
- Context persistence at ~/.ari/contexts/
- JSON files: {context_id}.json
- Active context tracking: active.json
- CRUD operations: create, read, update, delete, list
- setActive() and getActive() for context switching

#### memory-manager.ts (Agent)
- **6 memory types**: FACT, PREFERENCE, PATTERN, CONTEXT, DECISION, QUARANTINE
- **3 partitions**: PUBLIC, INTERNAL, SENSITIVE with access control
- SHA-256 integrity hashing on all memory entries
- Provenance tracking: source, trust_level, agent, chain
- Trust decay: 1% per day
- Poisoning detection and quarantine
- Agent-based access control
- 10K entry capacity limit

**Memory lifecycle**: create → verify → decay → quarantine or expire

#### guardian.ts (Agent)
- Real-time threat assessment
- 8 behavioral patterns: template injection, eval/exec, prototype pollution, path traversal, XSS, SQL, command injection
- Anomaly detection: message length, timing, injection spike
- Rate limiting: 60 messages/min per source
- Trust-weighted risk: 50% injection + 30% anomaly + 20% trust penalty
- Auto-blocks risk >= 0.8, escalates >= 0.6

### Core Layer Responsibilities

1. **Context routing**: Match messages to life/venture contexts
2. **Context storage**: Persist context configuration and state
3. **Memory management**: Store facts/preferences with provenance
4. **Threat detection**: Monitor behavioral anomalies

### Core Layer Restrictions

- CANNOT bypass sanitizer (events arrive post-sanitization)
- CANNOT bypass audit (all routing logged via kernel)
- CANNOT mutate audit chain (append-only via kernel API)
- CANNOT bind to network (no gateway access)

## Layer 2: Governance

**Enforcement and decision-making. Cannot be overridden by agents.**

The governance layer enforces constitutional rules, manages voting, and gates quality. It operates independently of agent requests and has veto authority.

### Components

#### arbiter.ts
- **6 constitutional rules** (hard invariants):
  0. **creator_primacy**: Always operate in the creator's best interest
  1. **loopback_only**: Gateway must bind to 127.0.0.1
  2. **content_not_command**: External content never treated as instructions
  3. **audit_immutable**: Audit chain is append-only
  4. **least_privilege**: Destructive operations require explicit approval
  5. **trust_required**: Sensitive operations require verified+ trust

- evaluateAction(): Checks action against all rules
- handleDispute(): Resolves conflicts, refers to council if no violations
- Subscribes to 'security:alert' events for real-time enforcement

**Constitutional guarantee**: Arbiter rules cannot be overridden by votes.

#### council.ts
- **15-member voting council**
- **3 thresholds**: MAJORITY (>50%), SUPERMAJORITY (>=66%), UNANIMOUS (100%)
- **50% quorum requirement**: At least 8 of 15 must participate
- **1-hour default deadline** for votes
- Early conclusion logic (vote closes when outcome is determined)
- Voting agents: router, planner, executor, memory_manager, guardian, research, marketing, sales, content, seo, build, development, client_comms

**Vote lifecycle**: create → cast → early conclusion or deadline → close with result

#### overseer.ts
- **5 quality gates**:
  1. **test_coverage**: Minimum test coverage threshold
  2. **audit_integrity**: Audit chain verification passes
  3. **security_scan**: No critical security issues
  4. **build_clean**: Build completes without errors
  5. **documentation**: Required docs exist and are current

- evaluateGate(): Checks specific gate
- evaluateRelease(): Checks all gates, blocks if any fail

### Governance Layer Responsibilities

1. **Constitutional enforcement**: Apply hard rules to all actions
2. **Vote management**: Create votes, tally results, enforce thresholds
3. **Quality gating**: Block releases that fail quality standards
4. **Dispute resolution**: Arbitrate conflicts between agents

### Governance Layer Restrictions

- CANNOT bypass kernel sanitization or audit
- CANNOT modify constitutional rules (hardcoded)
- CANNOT override arbiter rulings
- Rules are append-only (can add, never remove)

## Layer 3: Strategic

**Autonomous decision-making. Coordinates via EventBus.**

The strategic layer plans tasks, orchestrates agents, and manages the overall message processing pipeline.

### Components

#### planner.ts
- Task decomposition and dependency management
- Plan creation with task addition
- Circular dependency detection (DFS algorithm)
- Task status tracking: pending → in_progress → completed/failed
- Priority levels: low, medium, high, critical
- getNextTask(): Returns next available task with dependencies met

**Planning invariant**: No circular dependencies allowed.

#### core.ts
- Master orchestrator for 5-step message pipeline:
  1. Guardian assess (threat detection)
  2. Router route (context matching)
  3. Planner plan (task decomposition)
  4. Executor execute (tool invocation)
  5. Memory store (result persistence)

- Coordinates all agents through EventBus
- Starts/stops agents
- Reports system health and metrics
- Returns ProcessResult with execution details

**Orchestration principle**: Core never executes directly, only coordinates.

### Strategic Layer Responsibilities

1. **Task planning**: Decompose complex requests into executable tasks
2. **Dependency resolution**: Ensure tasks execute in correct order
3. **Pipeline orchestration**: Coordinate all agents through message flow
4. **System health**: Monitor and report agent status

### Strategic Layer Restrictions

- CANNOT bypass governance rules
- CANNOT modify constitutional constraints
- CANNOT emit kernel events directly (subscribe only)
- CANNOT override permission tiers

## Layer 4: Execution

**Tool execution with permission gating.**

The execution layer is the only layer that performs actual operations. All operations are gated by 3-layer permission checks.

### Components

#### executor.ts
- **3-layer permission checks**:
  1. Agent allowlist: Is agent authorized for this tool?
  2. Trust level: Does source meet minimum trust threshold?
  3. Permission tier: Does operation match context permission level?

- **Approval workflow**: Destructive operations (WRITE_DESTRUCTIVE, ADMIN) require explicit approval
- **4 built-in tools**:
  - file_read (READ_ONLY)
  - file_write (WRITE_SAFE)
  - file_delete (WRITE_DESTRUCTIVE)
  - system_config (ADMIN)

- Concurrent execution limit: 10 max
- Timeout enforcement: 30s default
- Tool registry for extensibility

**Permission invariant**: Destructive operations ALWAYS require approval, regardless of trust level.

### Execution Layer Responsibilities

1. **Tool invocation**: Execute file operations and system commands
2. **Permission gating**: Enforce 3-layer permission checks
3. **Approval management**: Request and validate approvals
4. **Timeout enforcement**: Prevent runaway operations

### Execution Layer Restrictions

- CANNOT bypass permission checks
- CANNOT execute without approval for destructive ops
- CANNOT exceed concurrency limit
- CANNOT modify permission tiers (governance owns)

## Layer 5: Interfaces

**User interaction and command orchestration.**

The interfaces layer provides multiple ways to interact with ARI: CLI, REST API (future), and dashboard (future).

### Components

#### CLI Commands (src/cli/commands/)

1. **onboard.ts**: `ari onboard init`
   - Creates ~/.ari/ directory structure
   - Writes default config.json
   - Initializes audit.json with genesis event
   - Creates contexts/ directory

2. **doctor.ts**: `ari doctor`
   - 6 health checks: config dir, config valid, audit exists, audit integrity, contexts dir, gateway reachable
   - Reports passed/total

3. **gateway.ts**: `ari gateway start [-p port]`, `ari gateway status [-p port]`
   - start: Launches Fastify gateway
   - status: Checks health endpoint

4. **audit.ts**: `ari audit list [-n count]`, `ari audit verify`, `ari audit security`
   - list: Recent audit events
   - verify: Hash chain integrity check
   - security: Filter security events

5. **context.ts**: `ari context init|list|create|select|show`
   - Context lifecycle management

6. **governance.ts**: `ari governance show|list`
   - Governance framework display

7. **daemon.ts**: `ari daemon install|uninstall|status`
   - macOS launchd integration

### Interface Layer Responsibilities

1. **Command orchestration**: Coordinate multi-layer operations
2. **User feedback**: Display status, errors, and results
3. **Configuration**: Manage system settings
4. **Health monitoring**: System diagnostics and verification

### Interface Layer Restrictions

- CANNOT bypass lower layers
- CANNOT modify kernel configuration directly
- CANNOT bypass governance constraints
- All operations flow through proper layers

## Data Flow

### Inbound Message Pipeline

```
External → POST /message → Gateway (Layer 0)
                              ↓
                        Sanitize (42 patterns)
                              ↓
                        Audit Log (hash chain)
                              ↓
                        EventBus.emit('message:accepted')
                              ↓
                        Router (Layer 1)
                              ↓
                        Match Context (trigger detection)
                              ↓
                        Audit Log ('system:routed')
                              ↓
                        Guardian (Layer 1)
                              ↓
                        Threat Assessment (risk scoring)
                              ↓
                        Planner (Layer 3)
                              ↓
                        Task Decomposition (dependency graph)
                              ↓
                        Executor (Layer 4)
                              ↓
                        Permission Check (3-layer)
                              ↓
                        Tool Execution (approved operations)
                              ↓
                        Memory Manager (Layer 1)
                              ↓
                        Store Result (provenance tracking)
```

### Decision Flow (Governance)

```
Agent → Propose Action → Arbiter (Layer 2)
                           ↓
                    Constitutional Check (5 rules)
                           ↓
                    ┌──────┴──────┐
                    │             │
                Violation      Clean
                    │             │
                    ▼             ▼
                  DENIED      Council (Layer 2)
                                  ↓
                            Create Vote (15 members)
                                  ↓
                            Cast Votes (quorum = 7)
                                  ↓
                            Tally Result (threshold check)
                                  ↓
                            Audit Log (vote:closed)
                                  ↓
                            EventBus.emit('vote:completed')
```

## Security Boundaries

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL (untrusted)                                        │
│ All inbound messages, file uploads, API calls               │
└─────────────────────────────────────────────────────────────┘
                            ↓ sanitize()
┌─────────────────────────────────────────────────────────────┐
│ KERNEL (system trust)                                       │
│ Gateway, Sanitizer, Audit, EventBus                         │
│ Enforcement: Content ≠ Command                              │
└─────────────────────────────────────────────────────────────┘
                            ↓ audit + event
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM (verified trust)                                     │
│ Router, Storage, Memory, Guardian                           │
│ Enforcement: Provenance tracking                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ permission check
┌─────────────────────────────────────────────────────────────┐
│ GOVERNANCE (operator trust)                                 │
│ Arbiter, Council, Overseer                                  │
│ Enforcement: Constitutional rules                           │
└─────────────────────────────────────────────────────────────┘
                            ↓ approval + audit
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION (gated)                                           │
│ Executor, Tools                                             │
│ Enforcement: 3-layer permission + approval workflow         │
└─────────────────────────────────────────────────────────────┘
```

### Enforcement Points

| Principle | Enforcement Location | Mechanism |
|-----------|---------------------|-----------|
| Content ≠ Command | gateway.ts:61-102 | sanitize() before processing |
| Loopback Only | gateway.ts:19 | Hardcoded HOST = '127.0.0.1' |
| Audit Immutability | audit.ts | Append-only log, hash chain |
| Least Privilege | executor.ts | 3-layer permission checks |
| Trust Required | arbiter.ts:117-136 | verified+ for sensitive ops |
| Provenance Tracking | memory-manager.ts | SHA-256 hash + chain |
| Partition Isolation | memory-manager.ts | Access control per partition |

## Component Specifications

### Gateway
- **Interface**: HTTP REST (Fastify)
- **Port**: 3141 (configurable)
- **Host**: 127.0.0.1 (hardcoded)
- **Endpoints**: POST /message, GET /health, GET /status
- **Dependencies**: sanitizer, audit, event-bus

### Sanitizer
- **Patterns**: 39 injection patterns
- **Categories**: 14 (override, role, command, extraction, authority, exfiltration, SSRF, path traversal, null byte, XML, jailbreak, tag injection, SQL, script)
- **Risk Scoring**: Severity weights × trust multipliers
- **Output**: SanitizeResult with safe flag, threats, risk score

### Audit Logger
- **Algorithm**: SHA-256 hash chain
- **Storage**: ~/.ari/audit.json (append-only)
- **Genesis**: previousHash = "0x00...00"
- **Verification**: Recompute entire chain on verify()

### Event Bus
- **Pattern**: Publish-subscribe (typed events)
- **Error Handling**: Isolated (one handler failure doesn't break others)
- **Synchronous**: Emit returns immediately after all handlers run
- **Events**: 11 event types (message:*, system:*, security:*, gateway:*, vote:*, arbiter:*)

### Router
- **Trigger Matching**: Regex + keyword detection
- **Confidence Scoring**: 0.0 to 1.0
- **Permission Mapping**: Context type → permission tier
- **Audit**: All routing decisions logged

### Memory Manager
- **Capacity**: 10,000 entries
- **Partitions**: PUBLIC, INTERNAL, SENSITIVE
- **Integrity**: SHA-256 hash per entry
- **Decay**: 1% confidence loss per day
- **Quarantine**: Auto-quarantine on poisoning detection

### Guardian
- **Detection**: 8 behavioral patterns + anomaly detection
- **Rate Limiting**: 60 messages/min per source
- **Risk Formula**: 0.5×injection + 0.3×anomaly + 0.2×trust_penalty
- **Thresholds**: Block >=0.8, escalate >=0.6

### Planner
- **Dependency Graph**: DAG (directed acyclic graph)
- **Circular Detection**: DFS algorithm
- **Priority**: 4 levels (low, medium, high, critical)
- **Task States**: pending, in_progress, completed, failed

### Executor
- **Permission Tiers**: READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN
- **Approval Workflow**: Required for WRITE_DESTRUCTIVE, ADMIN
- **Concurrency**: 10 max simultaneous operations
- **Timeout**: 30s default per tool

### Arbiter
- **Rules**: 6 constitutional invariants
- **Evaluation**: All actions checked against all rules
- **Dispute Resolution**: Refer to council if no violations
- **Binding**: All rulings are binding

### Council
- **Members**: 15 voting agents
- **Quorum**: 50% (8 of 15)
- **Thresholds**: MAJORITY (>50%), SUPERMAJORITY (>=66%), UNANIMOUS (100%)
- **Deadline**: 60 minutes default
- **Early Conclusion**: Vote closes when outcome is determined

### Overseer
- **Gates**: 5 quality gates (test, audit, security, build, docs)
- **Evaluation**: All gates must pass for release
- **Blocking**: Any gate failure blocks release

## Operational Constraints

### Performance
- Message throughput: ~100 msgs/sec (limited by audit I/O)
- Memory capacity: 10K entries (memory-manager)
- Concurrent tools: 10 max (executor)
- Rate limit: 60 msgs/min per source (guardian)

### Storage
- Config: ~/.ari/config.json (~1KB)
- Audit log: ~/.ari/audit.json (grows ~500 bytes per event)
- Contexts: ~/.ari/contexts/*.json (~1KB per context)
- Memory: In-memory only (Phase 2), persistent storage in Phase 3

### Network
- Binding: 127.0.0.1:3141 only
- Protocol: HTTP/1.1 (REST)
- TLS: Not required (loopback only)
- CORS: Not applicable (no browser access)

## Future Architecture (Post-Phase 2)

### Phase 3 Additions
- Domain agent implementations (research, marketing, sales, etc.)
- Agent-to-agent communication patterns
- Memory persistence to disk
- UI console for audit inspection

### Phase 4 Additions
- Multi-venture isolation hardening (memory partitioning per venture)
- Automated test harness for v12 specs
- Performance optimization (audit log rotation, memory indexing)
- Proactive notifications and scheduling

### Deferred (Post-Phase 4)
- Feedback loops (ADR-008)
- Reinforcement learning (ADR-008)
- External API integrations (requires security review)
- Multi-user support (requires authentication layer)

---

**Last Updated**: 2026-01-27
**Status**: LOCKED (Phase 2 complete)
**Authority**: Architecture decisions documented in DECISIONS.md
