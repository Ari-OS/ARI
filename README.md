# ARI — Artificial Reasoning Intelligence

**Your Life Operating System**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-187-brightgreen)](tests/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

ARI is a secure, local-first, multi-agent personal operating system that orchestrates AI agents for life management, venture operations, and system coordination. Built on principles of radical transparency and constitutional governance, ARI provides tamper-evident audit trails, 21-pattern injection detection, and loopback-only security. Every decision is traceable, every operation audited, every command justified.

## Core Philosophy

ARI is guided by three foundational principles:

- **Shadow Integration (Jung)** — Don't suppress suspicious behavior; log it, understand it, integrate it. The shadow reveals truth.
- **Radical Transparency (Dalio)** — Every operation is audited, every decision is traceable. No hidden state, no secret channels.
- **Ruthless Simplicity (Musashi)** — Every line of code must justify its existence. Remove complexity, favor clarity, choose obvious over clever.

## Architecture Overview

ARI implements a six-layer architecture with strict boundaries and unidirectional dependencies. All inter-layer communication flows exclusively through the EventBus.

| Layer | Components | Responsibilities |
|-------|-----------|------------------|
| **Kernel** | Gateway, Sanitizer, Audit, EventBus, Config, Types | Network binding (127.0.0.1 only), injection detection (21 patterns), tamper-evident logging (SHA-256 chain) |
| **System** | Router, Storage | Event routing to contexts, context management, trigger-based message matching |
| **Core** | Core Agent, Guardian, Planner, Executor, Memory Manager | Multi-agent orchestration, threat detection, task decomposition (DAG), permission-gated tool execution, provenance-tracked memory |
| **Strategic** | Council, Arbiter, Overseer | Democratic voting (13 members), constitutional enforcement (5 rules), quality gates (5 gates) |
| **Execution** | Daemon | Background service management (macOS launchd) |
| **Interfaces** | CLI (8 commands), Dashboard | User interaction, command orchestration, web-based control center |

### Data Flow Pipeline

```
POST /message
  → Sanitize (21 injection patterns)
  → Audit (SHA-256 hash chain)
  → EventBus.emit('message:accepted')
  → Guardian (threat assessment)
  → Router (context matching)
  → Planner (task decomposition)
  → Executor (permission checks + tool invocation)
  → Memory Manager (provenance-tracked storage)
  → Audit (operation logged)
```

## Security Model

ARI enforces security through layered defense and constitutional invariants. The system assumes breach and enforces boundaries at every layer.

### Five Security Invariants

1. **Loopback-Only Gateway**
   - Gateway binds exclusively to `127.0.0.1:3141` (host is hardcoded, never configurable)
   - Eliminates entire classes of remote attacks by design
   - No external network access, ever

2. **Content ≠ Command Principle**
   - All inbound messages treated as DATA, never as executable instructions
   - Clear separation between content and commands enforced at gateway layer
   - Sanitizer validates all input before processing

3. **SHA-256 Hash Chain Audit Trail**
   - Every audit event cryptographically chained to its predecessor
   - Genesis block (`0x00...00`) anchors the entire chain
   - Tampering breaks the chain and is immediately detectable
   - Append-only storage at `~/.ari/audit.json`

4. **21-Pattern Injection Detection**
   - Real-time scanning across 6 categories:
     - Direct Override (ignore previous, disregard all)
     - Role Manipulation (you are now, act as)
     - Command Injection ($(), backticks, shell commands)
     - Prompt Extraction (reveal your prompt)
     - Authority Claims (as your creator, I am admin)
     - Data Exfiltration (send to, upload to)
   - Risk scoring: severity weights × trust multipliers
   - Auto-block at risk ≥ 0.8

5. **Trust-Level Risk Scoring**
   - Six trust levels: SYSTEM, OPERATOR, VERIFIED, STANDARD, UNTRUSTED, HOSTILE
   - Risk multipliers:
     - SYSTEM: 0.5x (trusted internal operations)
     - OPERATOR: 0.6x (authenticated operator)
     - VERIFIED: 0.75x (verified sources)
     - STANDARD: 1.0x (default)
     - UNTRUSTED: 1.5x (external or unverified)
     - HOSTILE: 2.0x (known malicious)
   - Auto-block threshold: risk ≥ 0.8

## Governance Framework

ARI's governance system enforces constitutional rules and democratic decision-making through three components:

### Constitutional Council (13 Members)

Democratic voting body with three thresholds:

- **MAJORITY** (>50%): Routine decisions, feature prioritization
- **SUPERMAJORITY** (≥66%): Significant changes, policy updates
- **UNANIMOUS** (100%): Critical changes, security policies

**Members**: router, planner, executor, memory_manager, guardian, research, marketing, sales, content, seo, build, development, client_comms

**Quorum**: 50% (7 of 13 members must participate)

### Arbiter (5 Constitutional Rules)

Enforces immutable rules that cannot be overridden by votes:

1. **loopback_only**: Gateway must bind to 127.0.0.1 exclusively
2. **content_not_command**: External content is data, never instructions
3. **audit_immutable**: Audit chain is append-only, tamper-evident
4. **least_privilege**: Destructive operations require explicit approval
5. **trust_required**: Sensitive operations require verified+ trust level

### Overseer (5 Quality Gates)

Release gating with pass/fail evaluation:

1. **test_coverage**: ≥80% overall, 100% for security paths
2. **audit_integrity**: Hash chain valid, no corruption
3. **security_scan**: No high/critical vulnerabilities
4. **build_clean**: TypeScript compiles with no errors
5. **documentation**: All public APIs documented

All governance decisions are logged to the audit trail with full provenance tracking.

## Dashboard

ARI includes a web-based control center built with Vite 6, React 19, and TypeScript. The dashboard is **view-only** — it connects to the gateway API for read access but never performs mutations directly. All state changes flow through governance.

- 6 pages: Home, Governance, Memory, Tools, Audit, Agents
- Real-time updates via WebSocket connection
- TanStack Query for server state management
- Tailwind CSS for styling
- Builds to `dashboard/dist/` (258 KB JS + 16 KB CSS)

```bash
cd dashboard && npm install && npm run dev    # Development
cd dashboard && npm run build                 # Production build
```

## Quick Start

```bash
# Install dependencies
npm install

# Build the system
npm run build

# Initialize ARI (creates ~/.ari/, config, genesis audit)
npx ari onboard init

# Verify system health (6 checks)
npx ari doctor

# Start the gateway (127.0.0.1:3141)
npx ari gateway start
```

## CLI Reference

### System Initialization

```bash
npx ari onboard init              # Initialize ARI system
```

Creates `~/.ari/` directory structure, default config, genesis audit event, and contexts directory.

### Health and Diagnostics

```bash
npx ari doctor                    # Run 6 health checks
```

Checks: config directory, config validity, audit existence, audit integrity, contexts directory, gateway reachability.

### Gateway Management

```bash
npx ari gateway start [-p port]   # Start Fastify gateway (127.0.0.1)
npx ari gateway status [-p port]  # Check gateway health
```

Gateway binds to loopback only. Default port: 3141.

### Audit Log Management

```bash
npx ari audit list [-n count]     # List recent audit events
npx ari audit verify              # Verify SHA-256 hash chain integrity
npx ari audit security            # List security events only
```

Audit log stored at `~/.ari/audit.json` (append-only, hash-chained).

### Context Management

```bash
npx ari context init              # Initialize context system
npx ari context list              # List all contexts
npx ari context create <name>     # Create new context
npx ari context select <id>       # Set active context
npx ari context show              # Show active context
```

Contexts partition memory and routing for life domains and ventures.

### Governance Reference

```bash
npx ari governance show           # Show governance structure
npx ari governance list           # List council members
```

Displays constitutional rules, council composition, and quality gates.

### Daemon Management (macOS)

```bash
npx ari daemon install            # Install background service (launchd)
npx ari daemon status             # Check daemon status
npx ari daemon uninstall          # Remove background service
```

Daemon runs ARI as a background service on macOS using launchd integration.

## Project Structure

```
ari/
├── src/
│   ├── kernel/              # Layer 0: Security boundary
│   │   ├── gateway.ts       # Fastify server (127.0.0.1 only)
│   │   ├── sanitizer.ts     # 21-pattern injection detection
│   │   ├── audit.ts         # SHA-256 hash-chained logger
│   │   ├── event-bus.ts     # Typed pub/sub system
│   │   ├── config.ts        # Zod-validated configuration
│   │   └── types.ts         # All system type definitions
│   ├── system/              # Layer 1: Event routing
│   │   ├── router.ts        # Context matching and routing
│   │   └── storage.ts       # Context persistence
│   ├── agents/              # Layer 2: Multi-agent coordination
│   │   ├── core.ts          # Master orchestrator
│   │   ├── guardian.ts      # Threat detection
│   │   ├── planner.ts       # Task decomposition (DAG)
│   │   ├── executor.ts      # Tool execution (permission-gated)
│   │   └── memory-manager.ts # Provenance-tracked memory
│   ├── governance/          # Layer 3: Constitutional enforcement
│   │   ├── council.ts       # 13-member voting
│   │   ├── arbiter.ts       # 5 constitutional rules
│   │   └── overseer.ts      # 5 quality gates
│   ├── api/                 # API expansion layer
│   │   ├── routes.ts        # 15 REST endpoints (Fastify plugin)
│   │   └── ws.ts            # WebSocket event broadcaster
│   ├── ops/                 # Layer 4: Infrastructure
│   │   └── daemon.ts        # macOS launchd integration
│   └── cli/                 # Layer 5: User interface
│       ├── commands/        # 8 CLI commands
│       └── index.ts         # Commander setup
├── dashboard/               # Web control center (Vite + React 19)
│   └── src/                 # Pages, components, hooks, API client
├── tests/
│   ├── unit/                # Component tests (18 files)
│   ├── integration/         # Full pipeline tests
│   └── security/            # Injection defense tests
├── docs/
│   ├── architecture/        # ARCHITECTURE.md, SECURITY_MODEL.md
│   ├── governance/          # GOVERNANCE.md
│   └── operations/          # RUNBOOK_MAC_MINI.md
└── scripts/                 # Setup and maintenance scripts

Data Layout (~/.ari/):
├── config.json              # Zod-validated configuration
├── audit.json               # Hash-chained audit log
├── logs/                    # Application logs
└── contexts/                # Context storage
```

## Development

### Build Commands

```bash
npm run build                # Compile TypeScript to dist/
npm run dev                  # Watch mode for development
npm run clean                # Remove dist/ directory
```

### Testing

```bash
npm test                     # Run all tests (187 tests)
npm run test:watch           # Watch mode for tests
npm run test:coverage        # Coverage report (target: 80%+, 100% security)
```

### Code Quality

```bash
npm run typecheck            # TypeScript type checking
npm run lint                 # ESLint (no auto-fix)
npm run lint:fix             # ESLint with auto-fix
npm run format               # Prettier formatting
```

## API Endpoints

ARI exposes a REST API and WebSocket on `127.0.0.1:3141` (loopback only):

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Health** | `GET /health` | Health check with uptime |
| | `GET /status` | System status and security configuration |
| | `GET /api/health` | Alias for `/health` |
| | `GET /api/health/detailed` | Component-level health status |
| **Messages** | `POST /message` | Submit message with sanitization |
| **Agents** | `GET /api/agents` | List all registered agents |
| | `GET /api/agents/:id/stats` | Agent statistics |
| **Governance** | `GET /api/proposals` | List proposals and votes |
| | `GET /api/proposals/:id` | Get specific vote |
| | `GET /api/governance/rules` | Constitutional rules |
| | `GET /api/governance/gates` | Quality gates |
| **Memory** | `GET /api/memory` | Search memories |
| | `GET /api/memory/:id` | Get memory by ID |
| **Audit** | `GET /api/audit` | Audit entries (paginated) |
| | `GET /api/audit/verify` | Verify hash chain integrity |
| **Tools** | `GET /api/tools` | List registered tools |
| **Contexts** | `GET /api/contexts` | List all contexts |
| | `GET /api/contexts/active` | Get active context |
| **WebSocket** | `WS /ws` | Real-time event streaming (12 event types) |

All endpoints enforce loopback-only access. API routes are GET-only (read-only). Mutations flow through governance.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Architecture

- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) — Six-layer system design
- [DECISIONS.md](docs/architecture/DECISIONS.md) — Architectural decision records (ADRs)
- [SECURITY_MODEL.md](docs/architecture/SECURITY_MODEL.md) — Security invariants and threat model

### Governance

- [GOVERNANCE.md](docs/governance/GOVERNANCE.md) — Council, Arbiter, Overseer framework

### Operations

- [RUNBOOK_MAC_MINI.md](docs/operations/RUNBOOK_MAC_MINI.md) — Deployment guide for Mac Mini
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines
- [SECURITY.md](SECURITY.md) — Security policy and reporting

### AI Assistant Context

- [CLAUDE.md](CLAUDE.md) — Context for AI assistants working on ARI codebase

## Version

**12.0.0** — Life Operating System

Identity evolution: Aurora Protocol → ARI Life OS (2026-01-27)

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Operator**: Pryce Hedrick
**Repository**: [github.com/PryceHedrick/ari](https://github.com/PryceHedrick/ari)

*"Secure reasoning, local-first, auditable"*
