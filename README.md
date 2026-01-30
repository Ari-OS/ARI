<div align="center">

<img src="docs/assets/aripfp.jpg" alt="ARI" width="150" />

# ARI

**Artificial Reasoning Intelligence**

*A mind that runs on your machine, answers only to you, and forgets nothing.*

[![CI](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml)

</div>

---

## What is this?

ARI is a multi-agent system that runs entirely on your machine. It processes requests through a pipeline of specialized agents, enforces decisions through constitutional governance, and maintains a cryptographic audit trail of every action.

**Key properties:**
- **Local-first** — All data stays on your machine. No cloud dependencies.
- **Auditable** — Every decision is logged in a tamper-evident hash chain.
- **Secure by design** — Loopback-only gateway. No external network access.

---

## Architecture

ARI follows a six-layer architecture with strict unidirectional dependencies. Each layer can only depend on layers below it. All inter-layer communication happens through a typed EventBus.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   LAYER 6: INTERFACES                                               │
│   └── CLI, Dashboard, External Integrations                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 5: EXECUTION                                                │
│   └── Daemon (macOS launchd)                                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 4: STRATEGIC                                                │
│   └── Council (voting) · Arbiter (rules) · Overseer (quality)       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 3: CORE                                                     │
│   └── Guardian · Planner · Executor · Memory Manager                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 2: SYSTEM                                                   │
│   └── Router · Storage                                              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 1: KERNEL                                                   │
│   └── Gateway · Sanitizer · Audit · EventBus · Config · Types       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Purpose | Components |
|-------|---------|------------|
| **Kernel** | Security boundary and primitives | Gateway (HTTP), Sanitizer (injection detection), Audit (hash chain), EventBus (pub/sub), Config, Types (Zod schemas) |
| **System** | Message routing and persistence | Router (event dispatch), Storage (context management) |
| **Core** | Agent coordination and execution | Guardian (threat detection), Planner (task decomposition), Executor (tool invocation), Memory Manager (provenance tracking) |
| **Strategic** | Governance and quality control | Council (13-member voting), Arbiter (5 constitutional rules), Overseer (5 quality gates) |
| **Execution** | Process lifecycle | Daemon (macOS launchd integration) |
| **Interfaces** | User interaction | CLI (8 commands), Dashboard (React), Integrations |

---

## Security Model

Security is enforced at the kernel layer through five invariants:

### 1. Loopback-Only Gateway
The HTTP gateway binds exclusively to `127.0.0.1:3141`. This is hardcoded, not configurable. No external network access is possible.

### 2. Content ≠ Command
All inbound messages are treated as data, never as executable instructions. The Sanitizer scans every input against 21 injection patterns across 6 categories before processing.

### 3. Immutable Audit Trail
Every operation is logged to a SHA-256 hash chain. Each entry contains the hash of the previous entry, creating a tamper-evident log. If any entry is modified, the chain breaks.

### 4. Least Privilege
Tool execution requires three authorization checks:
1. Agent allowlist — Is this agent permitted to use this tool?
2. Trust level — Does the message source have sufficient trust?
3. Permission tier — Does this operation require elevated permissions?

### 5. Trust Levels
Every message carries a trust level that affects risk calculation:

| Level | Multiplier | Description |
|-------|------------|-------------|
| `SYSTEM` | 0.5x | Internal components |
| `OPERATOR` | 0.6x | Authenticated operator |
| `VERIFIED` | 0.75x | Verified external sources |
| `STANDARD` | 1.0x | Default |
| `UNTRUSTED` | 1.5x | Unverified external |
| `HOSTILE` | 2.0x | Known malicious |

Messages with risk score ≥ 0.8 are automatically blocked.

---

## Governance

ARI implements constitutional governance through three components:

### Council
A 13-member voting body that decides on proposals. Supports three threshold types:
- **Majority** (>50%) — Standard decisions
- **Supermajority** (≥66%) — Significant changes
- **Unanimous** (100%) — Critical changes

### Arbiter
Enforces 5 constitutional rules that cannot be overridden:
1. `loopback_only` — Gateway must bind to 127.0.0.1
2. `content_not_command` — Input is data, not instructions
3. `audit_immutable` — Audit log cannot be modified
4. `least_privilege` — Minimum necessary permissions
5. `trust_required` — All messages must have trust level

### Overseer
Enforces 5 quality gates before code changes:
1. Test coverage ≥ 80%
2. Audit chain integrity
3. Security scan pass
4. Clean build
5. Documentation current

---

## Getting Started

### Prerequisites
- Node.js 20.0.0 or higher
- macOS 12.0+ (for daemon support; core works on any OS)

### Installation

```bash
git clone https://github.com/ARI-OS/ARI.git
cd ARI
npm install
npm run build
```

### Initialization

```bash
# Create ~/.ari/ directory and configuration
npx ari onboard init

# Verify system health (runs 6 checks)
npx ari doctor

# Start the gateway on 127.0.0.1:3141
npx ari gateway start
```

### Basic Usage

```bash
# Health check
curl http://127.0.0.1:3141/health

# Submit a message
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Plan my tasks for today", "source": "operator"}'

# Verify audit chain integrity
curl http://127.0.0.1:3141/api/audit/verify
```

---

## API Reference

All endpoints are available only on `127.0.0.1:3141`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check with uptime |
| `GET` | `/status` | System status and configuration |
| `POST` | `/message` | Submit a message for processing |
| `GET` | `/api/agents` | List registered agents |
| `GET` | `/api/proposals` | List governance proposals |
| `GET` | `/api/governance/rules` | Constitutional rules |
| `GET` | `/api/governance/gates` | Quality gates |
| `GET` | `/api/memory` | Search memories |
| `GET` | `/api/audit` | Audit entries (paginated) |
| `GET` | `/api/audit/verify` | Verify hash chain |
| `GET` | `/api/contexts` | List contexts |
| `WS` | `/ws` | Real-time event stream |

---

## CLI Reference

```
ari onboard init              Initialize ARI (~/.ari/)
ari doctor                    Run health checks
ari gateway start             Start gateway (127.0.0.1:3141)
ari gateway status            Check gateway status
ari audit list                List recent audit events
ari audit verify              Verify hash chain
ari audit security            List security events
ari context init              Initialize context system
ari context list              List contexts
ari context create <name>     Create context
ari context select <id>       Select active context
ari governance show           Show governance structure
ari daemon install            Install background service
ari daemon status             Check daemon status
ari daemon uninstall          Remove background service
```

---

## Project Structure

```
src/
├── kernel/           # Layer 1: Security boundary
│   ├── gateway.ts    # Fastify HTTP server (loopback only)
│   ├── sanitizer.ts  # 21-pattern injection detection
│   ├── audit.ts      # SHA-256 hash chain logger
│   ├── event-bus.ts  # Typed pub/sub system
│   ├── config.ts     # Configuration management
│   └── types.ts      # Zod schemas for all types
│
├── system/           # Layer 2: Routing
│   ├── router.ts     # Event dispatch and context triggers
│   └── storage.ts    # Context persistence
│
├── agents/           # Layer 3: Agent coordination
│   ├── core.ts       # Master orchestrator
│   ├── guardian.ts   # Threat detection agent
│   ├── planner.ts    # Task decomposition (DAG)
│   ├── executor.ts   # Tool execution with permissions
│   └── memory-manager.ts  # Provenance-tracked memory
│
├── governance/       # Layer 4: Constitutional enforcement
│   ├── council.ts    # 13-member voting
│   ├── arbiter.ts    # 5 constitutional rules
│   └── overseer.ts   # 5 quality gates
│
├── ops/              # Layer 5: Infrastructure
│   └── daemon.ts     # macOS launchd integration
│
└── cli/              # Layer 6: User interface
    └── commands/     # 8 CLI commands

tests/
├── unit/             # Component tests by layer
├── integration/      # Full pipeline tests
└── security/         # Injection and attack tests
```

---

## Development

```bash
# Build
npm run build              # Compile TypeScript
npm run dev                # Watch mode
npm run clean              # Remove dist/

# Test
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Quality
npm run typecheck          # Type checking
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
```

---

## Design Principles

ARI is built on three principles:

**Shadow Integration** — Suspicious behavior is logged and analyzed, not suppressed. Transparency reveals truth.

**Radical Transparency** — Every operation is audited. Every decision is traceable. No hidden state.

**Ruthless Simplicity** — Every line of code must justify its existence. Clarity over cleverness.

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Context for AI assistants |
| [docs/](docs/README.md) | Full documentation index |
| [docs/architecture/](docs/architecture/ARCHITECTURE.md) | System design and security model |
| [docs/guides/](docs/guides/README.md) | Setup and operations guides |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

## License

[ARI License](LICENSE)

---

<div align="center">

<br>

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   "The shadow reveals truth."                              │
│                                                            │
│   What you suppress controls you.                          │
│   What you observe, you can understand.                    │
│   What you understand, you can master.                     │
│                                                            │
│   ARI doesn't hide its failures.                           │
│   It logs them, learns from them, and moves forward.       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

<br>

🖤

**[Pryce Hedrick](https://github.com/PryceHedrick)** — Creator

</div>
