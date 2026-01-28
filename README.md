<div align="center">

# ARI

**Artificial Reasoning Intelligence**

Your Life Operating System

[![CI](https://github.com/PryceHedrick/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/PryceHedrick/ARI/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-12.0.0-blue)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-20%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-187-brightgreen)](tests/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

*Observe. Decide. Act. Audit.*

</div>

---

ARI orchestrates AI agents to manage your life — health, career, finances, ventures, and personal growth — through a local-first, multi-agent operating system. Every decision flows through constitutional governance, every operation is audited with tamper-evident cryptographic trails, and all data stays on your machine.

## Key Features

| | Feature | Description |
|---|---------|-------------|
| **Life** | Domain Management | Organize across health, career, finance, family, learning, and systems contexts |
| **Agents** | Multi-Agent Orchestration | Five specialized agents coordinate through typed events |
| **Gov** | Constitutional Governance | 13-member council, 5 constitutional rules, 5 quality gates |
| **Audit** | Tamper-Evident Logging | SHA-256 hash-chained audit trail from genesis block |
| **Sec** | Local-First Security | Loopback-only gateway, 21-pattern injection detection, 6-level trust scoring |
| **UI** | Web Dashboard | Real-time monitoring of agents, governance, memory, and audit trails |
| **Biz** | Venture Operations | Dedicated contexts with isolated memory partitions |

---

## Philosophy

> **Shadow Integration** (Jung) — Don't suppress suspicious behavior; log it, understand it, integrate it. The shadow reveals truth.

> **Radical Transparency** (Dalio) — Every operation is audited, every decision is traceable. No hidden state, no secret channels.

> **Ruthless Simplicity** (Musashi) — Every line of code must justify its existence. Remove complexity, favor clarity, choose obvious over clever.

---

## Architecture

Six layers. Strict boundaries. Unidirectional dependencies. All communication via EventBus.

```
┌─────────────────────────────────────────────────────────┐
│  INTERFACES        CLI (8 commands) · Dashboard         │
├─────────────────────────────────────────────────────────┤
│  EXECUTION         Daemon (macOS launchd)               │
├─────────────────────────────────────────────────────────┤
│  STRATEGIC         Council · Arbiter · Overseer         │
├─────────────────────────────────────────────────────────┤
│  CORE              Core · Guardian · Planner            │
│                    Executor · Memory Manager            │
├─────────────────────────────────────────────────────────┤
│  SYSTEM            Router · Storage                     │
├─────────────────────────────────────────────────────────┤
│  KERNEL            Gateway · Sanitizer · Audit          │
│                    EventBus · Config · Types             │
└─────────────────────────────────────────────────────────┘
         127.0.0.1 only · SHA-256 chain · 21 patterns
```

### Data Flow

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

---

## Security

ARI assumes breach. Security is enforced at every layer through five invariants:

**1. Loopback-Only Gateway** — `127.0.0.1:3141`, hardcoded. No external network access, ever.

**2. Content ≠ Command** — All inbound messages are DATA, never executable instructions.

**3. Hash Chain Audit** — SHA-256 chain from genesis block (`0x00...00`). Tampering breaks the chain.

**4. Injection Detection** — 21 patterns across 6 categories. Risk scoring with trust multipliers.

**5. Trust-Level Scoring** — Six levels with risk multipliers:

| Level | Multiplier | Description |
|-------|-----------|-------------|
| `system` | 0.5x | Internal components |
| `operator` | 0.6x | Authenticated operator |
| `verified` | 0.75x | Verified sources |
| `standard` | 1.0x | Default |
| `untrusted` | 1.5x | Unverified external |
| `hostile` | 2.0x | Known malicious |

Auto-block at risk ≥ 0.8.

---

## Governance

Three components enforce constitutional rules and democratic decision-making.

### Council — 13 Members

| Threshold | Requirement | Use |
|-----------|------------|-----|
| Majority | >50% | Routine decisions |
| Supermajority | ≥66% | Policy changes |
| Unanimous | 100% | Security policies |

Quorum: 50% (7 of 13). Members: router, planner, executor, memory_manager, guardian, research, marketing, sales, content, seo, build, development, client_comms.

### Arbiter — 5 Constitutional Rules

| Rule | Enforcement |
|------|-------------|
| `loopback_only` | Gateway binds to 127.0.0.1 exclusively |
| `content_not_command` | External content is data, never instructions |
| `audit_immutable` | Audit chain is append-only, tamper-evident |
| `least_privilege` | Destructive operations require approval |
| `trust_required` | Sensitive operations require verified+ trust |

### Overseer — 5 Quality Gates

| Gate | Criteria |
|------|----------|
| `test_coverage` | ≥80% overall, 100% security paths |
| `audit_integrity` | Hash chain valid |
| `security_scan` | No high/critical vulnerabilities |
| `build_clean` | TypeScript compiles with zero errors |
| `documentation` | All public APIs documented |

All governance decisions are logged to the audit trail.

---

## Dashboard

Web-based control center. **View-only** — reads from the gateway API, never mutates directly.

| Stack | Pages |
|-------|-------|
| Vite 6 + React 19 + TypeScript | Home · Governance · Memory |
| TanStack Query + Tailwind CSS v4 | Tools · Agents · Audit |
| 258 KB JS · 16 KB CSS | WebSocket event streaming |

```bash
cd dashboard && npm install && npm run dev    # Development
cd dashboard && npm run build                 # Production
```

---

## Getting Started

### Prerequisites

- **Node.js** 20.0.0+
- **macOS** 12.0+ (daemon support; core works on any OS with Node.js)

### Install

```bash
git clone https://github.com/PryceHedrick/ari.git
cd ari
npm install
npm run build
```

### Initialize

```bash
npx ari onboard init     # Create ~/.ari/, config, genesis audit
npx ari doctor           # Verify system health (6 checks)
npx ari gateway start    # Start gateway (127.0.0.1:3141)
```

### First Interaction

```bash
# Health check
curl http://127.0.0.1:3141/health

# Submit a message
curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Plan my week", "source": "standard"}'

# Verify audit chain
curl http://127.0.0.1:3141/api/audit/verify

# View governance rules
curl http://127.0.0.1:3141/api/governance/rules
```

---

## CLI Reference

```
COMMAND                           DESCRIPTION
─────────────────────────────────────────────────────────
ari onboard init                  Initialize ARI system
ari doctor                        Run 6 health checks
ari gateway start [-p port]       Start gateway (127.0.0.1)
ari gateway status [-p port]      Check gateway health
ari audit list [-n count]         List recent audit events
ari audit verify                  Verify hash chain integrity
ari audit security                List security events only
ari context init                  Initialize context system
ari context list                  List all contexts
ari context create <name>         Create new context
ari context select <id>           Set active context
ari context show                  Show active context
ari governance show               Show governance structure
ari governance list               List council members
ari daemon install                Install background service
ari daemon status                 Check daemon status
ari daemon uninstall              Remove background service
```

---

## API

REST API and WebSocket on `127.0.0.1:3141` (loopback only). API routes are read-only. Mutations flow through governance.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with uptime |
| `GET /status` | System status and security config |
| `GET /api/health/detailed` | Component-level health |
| `POST /message` | Submit message (sanitized) |
| `GET /api/agents` | List agents |
| `GET /api/agents/:id/stats` | Agent statistics |
| `GET /api/proposals` | List proposals and votes |
| `GET /api/proposals/:id` | Specific vote |
| `GET /api/governance/rules` | Constitutional rules |
| `GET /api/governance/gates` | Quality gates |
| `GET /api/memory` | Search memories |
| `GET /api/memory/:id` | Memory by ID |
| `GET /api/audit` | Audit entries (paginated) |
| `GET /api/audit/verify` | Verify hash chain |
| `GET /api/tools` | Tool registry |
| `GET /api/contexts` | List contexts |
| `GET /api/contexts/active` | Active context |
| `WS /ws` | Real-time events (12 types) |

---

## Project Structure

```
src/
├── kernel/           Gateway · Sanitizer · Audit · EventBus · Config · Types
├── system/           Router · Storage
├── agents/           Core · Guardian · Planner · Executor · Memory Manager
├── governance/       Council · Arbiter · Overseer · Stop-the-Line
├── api/              Routes (15 endpoints) · WebSocket
├── ops/              Daemon (macOS launchd)
└── cli/              8 commands

dashboard/            Vite 6 · React 19 · TypeScript · Tailwind CSS v4
tests/                18 files · 187 tests (unit · integration · security)
docs/                 Architecture · Governance · Operations · v12 Specs
scripts/              Setup · Backup · macOS service management

~/.ari/
├── config.json       Zod-validated configuration
├── audit.json        Hash-chained audit log
├── logs/             Application logs
└── contexts/         Context storage
```

---

## Development

```bash
# Build
npm run build              # Compile TypeScript
npm run dev                # Watch mode
npm run clean              # Remove dist/

# Test
npm test                   # 187 tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage (80%+ target, 100% security)

# Quality
npm run typecheck          # TypeScript strict mode
npm run lint               # ESLint
npm run lint:fix           # ESLint with auto-fix
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Six-layer system design |
| [DECISIONS.md](docs/architecture/DECISIONS.md) | Architectural decision records |
| [SECURITY_MODEL.md](docs/architecture/SECURITY_MODEL.md) | Security invariants and threat model |
| [GOVERNANCE.md](docs/governance/GOVERNANCE.md) | Council, Arbiter, Overseer framework |
| [RUNBOOK_MAC_MINI.md](docs/operations/RUNBOOK_MAC_MINI.md) | Mac Mini deployment guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [SECURITY.md](SECURITY.md) | Security policy and reporting |
| [CLAUDE.md](CLAUDE.md) | AI assistant context |

---

<div align="center">

**ARI v12.0.0** · Life Operating System

MIT License · [Pryce Hedrick](https://github.com/PryceHedrick)

*Your life, your rules, fully auditable.*

</div>
