<div align="center">

<img src="docs/assets/ari-avatar.png" alt="ARI" width="180" style="border-radius: 50%;" />

<br>

<pre>
 █████╗ ██████╗ ██╗
██╔══██╗██╔══██╗██║
███████║██████╔╝██║
██╔══██║██╔══██╗██║
██║  ██║██║  ██║██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
</pre>

**Artificial Reasoning Intelligence**

*Your Life Operating System*

<br>

[![CI](https://github.com/Ari-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/Ari-OS/ARI/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Ari-OS/ARI/actions/workflows/codeql.yml/badge.svg)](https://github.com/Ari-OS/ARI/actions/workflows/codeql.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-ARI%20v1.0-blue)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Table of Contents

- [What is this?](#what-is-this)
- [Philosophy](#philosophy)
- [Architecture](#architecture)
- [Security Model](#security-model)
- [Governance](#governance)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [CLI Reference](#cli-reference)
- [Project Structure](#project-structure)
- [Development](#development)
- [Your Data Stays Private](#your-data-stays-private)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## What is this?

ARI is a multi-agent system that runs entirely on your machine. It processes requests through a pipeline of specialized agents, enforces decisions through constitutional governance, and maintains a cryptographic audit trail of every action.

**Key properties:**
- **Local-first** — All data stays on your machine. No cloud dependencies.
- **Auditable** — Every decision is logged in a tamper-evident hash chain.
- **Secure by design** — Loopback-only gateway. No external network access.

> **Note**: This is a framework. The code is open source. Your data is not.
>
> Everything in `~/.ari/` stays on your machine — config, audit logs, memory, contexts. The architecture is shareable. The relationship you build with your instance is yours alone.

---

## Philosophy

ARI is built on three principles drawn from Jung, Dalio, and Musashi:

### Shadow Integration
> *"What you suppress controls you. What you observe, you can understand. What you understand, you can master."*

Suspicious behavior is logged and analyzed, not suppressed. ARI doesn't hide failures—it records them, learns from them, and evolves. The shadow reveals truth.

### Radical Transparency
> *"Every operation is audited. Every decision is traceable. No hidden state."*

Inspired by Bridgewater's principles. No black boxes. The audit trail is immutable. If you can't explain a decision, you shouldn't make it.

### Ruthless Simplicity
> *"Every line of code must justify its existence."*

From Musashi's Book of Five Rings: cut away everything unnecessary. Clarity over cleverness. If it doesn't serve the mission, it doesn't belong.

---

## Architecture

ARI follows a seven-layer architecture with strict unidirectional dependencies. Each layer can only depend on layers below it. All inter-layer communication happens through a typed EventBus.

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
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LAYER 0: COGNITIVE                                                │
│   └── LOGOS (Reason) · ETHOS (Character) · PATHOS (Growth)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Purpose | Components |
|-------|---------|------------|
| **Cognitive** | Decision-making frameworks | LOGOS (Bayesian, Kelly, Expected Value), ETHOS (Bias Detection, Emotional State), PATHOS (CBT, Stoicism, Wisdom) |
| **Kernel** | Security boundary and primitives | Gateway (HTTP), Sanitizer (injection detection), Audit (hash chain), EventBus (pub/sub), Config, Types (Zod schemas) |
| **System** | Message routing and persistence | Router (event dispatch), Storage (context management) |
| **Core** | Agent coordination and execution | Guardian (threat detection), Planner (task decomposition), Executor (tool invocation), Memory Manager (provenance tracking) |
| **Strategic** | Governance and quality control | Council (15-member voting), Arbiter (6 constitutional rules), Overseer (5 quality gates) |
| **Execution** | Process lifecycle | Daemon (macOS launchd integration) |
| **Interfaces** | User interaction | CLI (18 commands), Dashboard (React), Integrations |

---

## Security Model

Security is enforced at the kernel layer through five invariants:

### 1. Loopback-Only Gateway
The HTTP gateway binds exclusively to `127.0.0.1:3141`. This is hardcoded, not configurable. No external network access is possible.

### 2. Content ≠ Command
All inbound messages are treated as data, never as executable instructions. The Sanitizer scans every input against 39 injection patterns across 14 categories before processing.

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
A multi-member voting body that decides on proposals. Supports three threshold types:
- **Majority** (>50%) — Standard decisions
- **Supermajority** (≥66%) — Significant changes
- **Unanimous** (100%) — Critical changes

### Arbiter
Enforces 6 constitutional rules that cannot be overridden:
0. `creator_primacy` — ARI always serves her creator's interests
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
git clone https://github.com/Ari-OS/ARI.git
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

# Interactive AI conversation
npx ari chat

# Quick one-shot query
npx ari ask "What's on my schedule?"

# Task management
npx ari task add "Review Q1 budget"

# Planning
npx ari plan "Prepare for product launch"
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
# Setup & Diagnostics
ari onboard init              Initialize ARI (~/.ari/)
ari doctor                    Run health checks

# AI & Interaction
ari chat                      Interactive AI conversation
ari ask <query>               One-shot AI query

# Productivity
ari task [add|list|done]      Task management
ari note [add|search]         Note-taking
ari notes                     Alias for note command
ari remind [add|list]         Reminder management
ari plan <goal>               Planning and goal-setting

# System Management
ari gateway start             Start gateway (127.0.0.1:3141)
ari gateway status            Check gateway status
ari daemon install            Install background service
ari daemon status             Check daemon status
ari daemon uninstall          Remove background service

# Context & Memory
ari context init              Initialize context system
ari context list              List contexts
ari context create <name>     Create context
ari context select <id>       Select active context
ari knowledge [query|stats]   Knowledge operations

# Governance & Security
ari governance show           Show governance structure
ari audit list                List recent audit events
ari audit verify              Verify hash chain
ari audit security            List security events
ari audit-report              Generate audit reports

# Advanced
ari autonomous [start|stop]   Autonomous agent control
ari cognitive [analyze]       Cognitive layer tools
ari budget [show|reset]       Budget management
```

---

## Project Structure

```
src/
├── kernel/           # Layer 1: Security boundary
│   ├── gateway.ts    # Fastify HTTP server (loopback only)
│   ├── sanitizer.ts  # 39-pattern injection detection
│   ├── audit.ts      # SHA-256 hash chain logger
│   ├── event-bus.ts  # Typed pub/sub system
│   ├── config.ts     # Configuration management
│   └── types.ts      # Zod schemas for all types
│
├── system/           # Layer 2: Routing & Storage
│   ├── router.ts     # Event dispatch and context triggers
│   ├── storage.ts    # Context persistence
│   └── vector-store.ts # SQLite-backed vector embeddings
│
├── agents/           # Layer 3: Agent coordination
│   ├── core.ts       # Master orchestrator
│   ├── guardian.ts   # Threat detection agent
│   ├── planner.ts    # Task decomposition (DAG)
│   ├── executor.ts   # Tool execution with permissions
│   ├── memory-manager.ts  # Provenance-tracked memory
│   └── temporal-memory.ts # Time-based memory synthesis
│
├── governance/       # Layer 4: Constitutional enforcement
│   ├── council.ts    # 15-member voting
│   ├── arbiter.ts    # 6 constitutional rules
│   └── overseer.ts   # 5 quality gates
│
├── ops/              # Layer 5: Infrastructure
│   ├── daemon.ts     # macOS launchd integration
│   ├── health-monitor.ts # System health checks
│   └── git-sync.ts   # Repository synchronization
│
└── cli/              # Layer 6: User interface
    └── commands/     # 12 CLI commands

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
npm test                   # Run 4654 tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Quality
npm run typecheck          # Type checking
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
```

---

## Your Data Stays Private

ARI stores all personal data locally in `~/.ari/`. This directory is **gitignored** and never leaves your machine.

| What's Private | What's Public |
|----------------|---------------|
| `~/.ari/config.json` — Your settings | Source code |
| `~/.ari/audit.json` — Your audit trail | Architecture docs |
| `~/.ari/contexts/` — Your contexts | Security model |
| `~/.ari/autonomous.json` — Your agent config | Test suite |
| `~/.ari/token-usage.json` — Your usage data | CLI tools |

**The code is a framework. Your instance is yours.**

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

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for:
- Development setup and workflow
- Layer dependency rules and architecture constraints
- Testing requirements (80%+ overall, 100% security paths)
- Commit conventions and PR process

See our [Code of Conduct](CODE_OF_CONDUCT.md) for community standards.

---

## License

[ARI License v1.0](LICENSE) — Use, study, share, modify. Keep attribution.

---

<div align="center">

<br>

<table>
<tr>
<td align="center">

***"The shadow reveals truth."***

What you suppress controls you.<br>
What you observe, you can understand.<br>
What you understand, you can master.

ARI doesn't hide its failures.<br>
It logs them, learns from them, and moves forward.

</td>
</tr>
</table>

<br>

**[Pryce Hedrick](https://github.com/PryceHedrick)** — Creator

</div>
