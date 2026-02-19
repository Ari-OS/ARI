<div align="center">

<img src="assets/branding/ari-logo.jpg" alt="ARI — Triple-Helix Iris" width="200">

### Artificial Reasoning Intelligence

**Your Life Operating System**

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

- [What is ARI?](#what-is-ari)
- [Features](#features)
- [What Makes ARI Different](#what-makes-ari-different)
- [Architecture](#architecture)
- [Security Pipeline](#security-pipeline)
- [Message Flow](#message-flow)
- [Philosophy](#philosophy)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [CLI Reference](#cli-reference)
- [Governance](#governance)
- [Your Data Stays Private](#your-data-stays-private)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## What is ARI?

ARI is a **multi-agent AI operating system** that runs entirely on your machine. ARI processes requests through a pipeline of specialized agents, enforces decisions through constitutional governance, and maintains a cryptographic audit trail of every action.

**Core Properties:**
- **Local-First** — All data stays on your machine. No cloud dependencies.
- **Auditable** — Every decision is logged in a tamper-evident SHA-256 hash chain.
- **Secure by Design** — Loopback-only gateway. 42-pattern injection detection. Zero trust architecture.
- **Autonomous** — Morning/evening briefings, market monitoring, intelligent task management.

> **Note**: This is a framework. The code is open source. Your data is not.
>
> Everything in `~/.ari/` stays on your machine — config, audit logs, memory, contexts. The architecture is shareable. The relationship you build with your instance is yours alone.

---

## Features

<table>
<tr>
<td width="50%">

**Autonomous Intelligence**
- Morning briefings at 6:30 AM via Telegram
- Evening summaries at 9:00 PM + weekly reports
- Market monitoring: crypto, stocks, Pokemon TCG
- Video content pipeline: script → avatar → publish
- SEO citation monitoring (Perplexity, ChatGPT)

**Security & Governance**
- 42 injection patterns across 14 categories
- SHA-256 hash-chained audit trail
- 15-member constitutional council
- 6 trust levels with risk multipliers
- Loopback-only gateway (127.0.0.1)

</td>
<td width="50%">

**Multi-Agent Orchestration**
- Guardian (threat detection, 42-pattern scan)
- Planner (DAG-based task decomposition)
- Executor (tool invocation with DI governance)
- Memory Manager (provenance-tracked storage)
- Core Agent (pipeline orchestration)

**Developer Experience**
- 24 CLI commands
- 6,700+ tests across 301 test files
- 420+ TypeScript source files
- 100,000+ lines of code
- Cognitive layer (LOGOS/ETHOS/PATHOS)

</td>
</tr>
</table>

---

## What Makes ARI Different

**Most AI assistants are stateless, cloud-dependent, and opaque.** ARI is the opposite:

| Traditional AI | ARI |
|----------------|-----|
| Cloud-based, data leaves your machine | 100% local, data never leaves `~/.ari/` |
| Black box decision-making | Every decision logged in immutable audit chain |
| Single-agent, context-less | 5-agent pipeline with persistent memory |
| No governance or oversight | 15-member constitutional council + 6 rules |
| Generic responses | Autonomous briefings tailored to your schedule |
| Trust the vendor | Trust the code (open source + audit trail) |

**ARI is an operating system for your digital life**, not just another chatbot.

---

## Architecture

ARI follows a **seven-layer architecture** with strict unidirectional dependencies. Each layer can only depend on layers below it. All inter-layer communication happens through a typed EventBus.

```mermaid
graph TB
    L6[Layer 6: INTERFACES<br/>CLI · Dashboard · Integrations]
    L5[Layer 5: EXECUTION<br/>Daemon · Health Monitor · Git Sync]
    L4[Layer 4: STRATEGIC<br/>Council · Arbiter · Overseer]
    L3[Layer 3: AGENTS<br/>Core · Guardian · Planner · Executor · Memory]
    L2[Layer 2: SYSTEM<br/>Router · Storage · Vector Store]
    L1[Layer 1: KERNEL<br/>Gateway · Sanitizer · Audit · EventBus]
    L0[Layer 0: COGNITIVE<br/>LOGOS · ETHOS · PATHOS]

    L6 --> L5
    L5 --> L4
    L4 --> L3
    L3 --> L2
    L2 --> L1
    L1 --> L0

    style L0 fill:#2d3748,stroke:#4a5568,color:#fff
    style L1 fill:#c53030,stroke:#9b2c2c,color:#fff
    style L2 fill:#d69e2e,stroke:#b7791f,color:#fff
    style L3 fill:#38a169,stroke:#2f855a,color:#fff
    style L4 fill:#3182ce,stroke:#2c5282,color:#fff
    style L5 fill:#805ad5,stroke:#6b46c1,color:#fff
    style L6 fill:#d53f8c,stroke:#b83280,color:#fff
```

### Layer Responsibilities

| Layer | Purpose | Components |
|-------|---------|------------|
| **Cognitive** | Decision-making frameworks | LOGOS (Bayesian, Kelly, Expected Value), ETHOS (Bias Detection, Emotional State), PATHOS (CBT, Stoicism, Wisdom) |
| **Kernel** | Security boundary and primitives | Gateway (HTTP), Sanitizer (injection detection), Audit (hash chain), EventBus (pub/sub), Config, Types (Zod schemas) |
| **System** | Message routing and persistence | Router (event dispatch), Storage (context management), Vector Store (SQLite embeddings) |
| **Agents** | Agent coordination and execution | Guardian (threat detection), Planner (task decomposition), Executor (tool invocation), Memory Manager (provenance tracking), Core (orchestration) |
| **Strategic** | Governance and quality control | Council (15-member voting), Arbiter (6 constitutional rules), Overseer (5 quality gates) |
| **Execution** | Process lifecycle | Daemon (macOS launchd integration), Health Monitor, Git Sync |
| **Interfaces** | User interaction | CLI (24 commands), Dashboard (React), External Integrations |

**Dependency Rule:** Lower layers CANNOT import higher layers. Cross-layer communication via EventBus only.

---

## Security Pipeline

Every message flows through a **multi-stage security pipeline** before execution:

```mermaid
flowchart TD
    Start([Inbound Message]) --> Sanitize[Sanitizer<br/>42 Injection Patterns]
    Sanitize -->|Clean| TrustCheck{Trust Level<br/>Assessment}
    Sanitize -->|Malicious| Block1[BLOCK]

    TrustCheck -->|SYSTEM 0.5x| Risk[Risk Score<br/>Calculation]
    TrustCheck -->|OPERATOR 0.6x| Risk
    TrustCheck -->|VERIFIED 0.75x| Risk
    TrustCheck -->|STANDARD 1.0x| Risk
    TrustCheck -->|UNTRUSTED 1.5x| Risk
    TrustCheck -->|HOSTILE 2.0x| Block2[BLOCK]

    Risk -->|Score < 0.8| Guardian[Guardian Agent<br/>Threat Analysis]
    Risk -->|Score ≥ 0.8| Block3[BLOCK]

    Guardian -->|Safe| PermCheck{Permission<br/>Check}
    Guardian -->|Threat| Block4[BLOCK]

    PermCheck -->|Allowlist ✓| Execute[Execute]
    PermCheck -->|Allowlist ✗| Block5[BLOCK]

    Execute --> Audit[Audit Log<br/>SHA-256 Chain]
    Audit --> Done([Complete])

    Block1 --> AuditBlock[Audit Block Event]
    Block2 --> AuditBlock
    Block3 --> AuditBlock
    Block4 --> AuditBlock
    Block5 --> AuditBlock

    style Start fill:#4299e1,stroke:#2b6cb0,color:#fff
    style Done fill:#48bb78,stroke:#2f855a,color:#fff
    style Block1 fill:#f56565,stroke:#c53030,color:#fff
    style Block2 fill:#f56565,stroke:#c53030,color:#fff
    style Block3 fill:#f56565,stroke:#c53030,color:#fff
    style Block4 fill:#f56565,stroke:#c53030,color:#fff
    style Block5 fill:#f56565,stroke:#c53030,color:#fff
    style Sanitize fill:#ed8936,stroke:#c05621,color:#fff
    style Guardian fill:#38a169,stroke:#2f855a,color:#fff
    style Audit fill:#805ad5,stroke:#6b46c1,color:#fff
```

### Security Invariants

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | **GATEWAY** | `127.0.0.1` ONLY — hardcoded, never configurable |
| 2 | **CONTENT ≠ COMMAND** | All input is DATA, never executable instructions |
| 3 | **AUDIT** | SHA-256 hash-chained, append-only, immutable |
| 4 | **PERMISSIONS** | Agent allowlist → Trust level → Permission tier |
| 5 | **TRUST** | 6 levels with risk multipliers (auto-block at ≥ 0.8) |

---

## Message Flow

How a message flows through ARI's pipeline:

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gateway<br/>(127.0.0.1:3141)
    participant S as Sanitizer
    participant R as Router
    participant Guard as Guardian
    participant Plan as Planner
    participant Exec as Executor
    participant A as Audit
    participant EB as EventBus

    U->>G: POST /message
    G->>S: Sanitize input
    S->>S: Check 42 patterns
    alt Malicious
        S-->>G: BLOCK
        G-->>U: 400 Bad Request
    else Clean
        S->>A: Log sanitize event
        S->>R: Route message
        R->>Guard: Assess threat
        Guard->>Guard: Calculate risk score
        alt High Risk (≥ 0.8)
            Guard-->>R: BLOCK
            R-->>G: BLOCK
            G-->>U: 403 Forbidden
        else Safe
            Guard->>A: Log assessment
            Guard->>Plan: Decompose task
            Plan->>Plan: Build task DAG
            Plan->>A: Log plan
            Plan->>Exec: Execute tasks
            Exec->>Exec: Check permissions
            Exec->>A: Log execution
            Exec->>EB: Emit events
            EB->>R: Broadcast result
            R->>G: Response
            G->>U: 200 OK
        end
    end
```

**Key Points:**
- Every stage logs to the immutable audit chain
- Failures block immediately and log the reason
- EventBus decouples components (no direct dependencies)
- Trust levels affect risk calculation at every stage

---

## Philosophy

ARI is built on three principles drawn from Jung, Dalio, and Musashi:

### Shadow Integration
> *"What you suppress controls you. What you observe, you can understand. What you understand, you can master."*

Suspicious behavior is logged and analyzed, not suppressed. ARI doesn't hide failures — it records them, learns from them, and evolves. The shadow reveals truth.

### Radical Transparency
> *"Every operation is audited. Every decision is traceable. No hidden state."*

Inspired by Bridgewater's principles. No black boxes. The audit trail is immutable. If you can't explain a decision, you shouldn't make it.

### Ruthless Simplicity
> *"Every line of code must justify its existence."*

From Musashi's Book of Five Rings: cut away everything unnecessary. Clarity over cleverness. If it doesn't serve the mission, it doesn't belong.

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

# Autonomous agent (morning/evening briefings)
npx ari autonomous start
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
ari crypto [prices|portfolio] Crypto market data
ari pokemon [search|value]    Pokemon TCG tools
ari speak <text>              Text-to-speech
ari plugin [list|install]     Plugin management
ari provider [list|set]       AI provider management
ari diagram [arch|flow]       Architecture diagrams
```

---

## Governance

ARI implements constitutional governance through three components:

### Council
A 15-member voting body that decides on proposals. Supports three threshold types:
- **Majority** (>50%) — Standard decisions
- **Supermajority** (≥66%) — Significant changes
- **Unanimous** (100%) — Critical changes

### Arbiter
Enforces 6 constitutional rules that cannot be overridden:
0. `creator_primacy` — ARI always serves the creator's interests
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
| [SECURITY.md](SECURITY.md) | Security policy and vulnerability reporting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines and standards |
| [docs/](docs/README.md) | Full documentation index |
| [docs/architecture/](docs/architecture/ARCHITECTURE.md) | System design and security model |
| [docs/guides/](docs/guides/README.md) | Setup and operations guides |
| [docs/plans/](docs/plans/) | Implementation plans and phase tracking |

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

*"The shadow reveals truth. What you suppress controls you. What you observe, you can understand. What you understand, you can master."*

<br>

Built by **[Pryce Hedrick](https://github.com/PryceHedrick)** · **[Pryceless Solutions](https://prycehedrick.com)**

</div>
