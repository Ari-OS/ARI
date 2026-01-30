<div align="center">

# 🖤 ARI

**Artificial Reasoning Intelligence**

Your Life Operating System

[![CI](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/ARI-OS/ARI/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ARI-OS/ARI/graph/badge.svg)](https://codecov.io/gh/ARI-OS/ARI)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-20%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-187-brightgreen)](tests/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

*Observe. Decide. Act. Audit.* 🔐

</div>

---

ARI orchestrates AI agents to manage your life — health, career, finances, ventures, and personal growth — through a local-first, multi-agent operating system. Every decision flows through constitutional governance, every operation is audited with tamper-evident cryptographic trails, and all data stays on your machine.

## Philosophy

> **Shadow Integration** (Jung) — Don't suppress suspicious behavior; log it, understand it, integrate it. The shadow reveals truth.

> **Radical Transparency** (Dalio) — Every operation is audited, every decision is traceable. No hidden state, no secret channels.

> **Ruthless Simplicity** (Musashi) — Every line of code must justify its existence. Remove complexity, favor clarity, choose obvious over clever.

---

## Security Foundation

Security is not a feature — it's the architectural foundation. Five invariants are enforced at the kernel layer:

| Invariant | Enforcement |
|-----------|-------------|
| **Loopback-Only Gateway** | `127.0.0.1:3141` hardcoded. No external network access, ever. |
| **Content ≠ Command** | All inbound messages are DATA, never executable instructions. |
| **Audit Immutable** | SHA-256 hash chain from genesis block. Tampering breaks the chain. |
| **Least Privilege** | Three-layer permission checks on every tool invocation. |
| **Trust Required** | Six trust levels with risk multipliers. Auto-block at risk ≥ 0.8. |

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
│                    EventBus · Config · Types            │
└─────────────────────────────────────────────────────────┘
         127.0.0.1 only · SHA-256 chain · 21 patterns
```

---

## Present Capabilities

What works today:

| Layer | Components | Status |
|-------|------------|--------|
| **Kernel** | Gateway, Sanitizer, Audit, EventBus, Config | ✅ Complete |
| **System** | Router, Storage | ✅ Complete |
| **Agents** | Core, Guardian, Planner, Executor, Memory | ✅ Complete |
| **Governance** | Council (13-member), Arbiter (5 rules), Overseer (5 gates) | ✅ Complete |
| **CLI** | 8 commands | ✅ Complete |
| **Dashboard** | React 19 + Vite, view-only | ✅ Complete |

### Governance

Three components enforce constitutional rules and democratic decision-making.

**Council** — 13 voting members. Thresholds: majority (>50%), supermajority (≥66%), unanimous (100%).

**Arbiter** — 5 constitutional rules: loopback_only, content_not_command, audit_immutable, least_privilege, trust_required.

**Overseer** — 5 quality gates: test_coverage (≥80%), audit_integrity, security_scan, build_clean, documentation.

### Trust Levels

| Level | Multiplier | Description |
|-------|-----------|-------------|
| `system` | 0.5x | Internal components |
| `operator` | 0.6x | Authenticated operator |
| `verified` | 0.75x | Verified sources |
| `standard` | 1.0x | Default |
| `untrusted` | 1.5x | Unverified external |
| `hostile` | 2.0x | Known malicious |

---

## Roadmap

Future capabilities not yet implemented:

| Feature | Status | Notes |
|---------|--------|-------|
| Real file operations | 🔮 Planned | Tool implementations are currently mocks |
| Disk persistence | 🔮 Planned | Memory is in-memory only |
| ML threat detection | 🔮 Planned | Pattern matching only for now |
| Weighted voting | 🔮 Planned | Equal votes only |
| Vote delegation | 🔮 Planned | No proxy voting |
| Auto-remediation | 🔮 Planned | Manual response only |
| Social integration | 🔮 Planned | See docs/operations/SOCIAL_INTEGRATION.md |

---

## Getting Started

### Prerequisites

- **Node.js** 20.0.0+
- **macOS** 12.0+ (daemon support; core works on any OS with Node.js)

### Install

```bash
git clone https://github.com/ARI-OS/ARI.git
cd ARI
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

## Dashboard

Web-based control center. **View-only** — reads from the gateway API, never mutates directly.

| Stack | Pages |
|-------|-------|
| Vite 6 + React 19 + TypeScript | Home · Governance · Memory |
| TanStack Query + Tailwind CSS v4 | Tools · Agents · Audit |

```bash
cd dashboard && npm install && npm run dev    # Development
cd dashboard && npm run build                 # Production
```

---

## API

REST API and WebSocket on `127.0.0.1:3141` (loopback only).

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with uptime |
| `GET /status` | System status and security config |
| `POST /message` | Submit message (sanitized) |
| `GET /api/agents` | List agents |
| `GET /api/proposals` | List proposals and votes |
| `GET /api/governance/rules` | Constitutional rules |
| `GET /api/governance/gates` | Quality gates |
| `GET /api/memory` | Search memories |
| `GET /api/audit` | Audit entries (paginated) |
| `GET /api/audit/verify` | Verify hash chain |
| `GET /api/contexts` | List contexts |
| `WS /ws` | Real-time events |

---

## Project Structure

```
src/
├── kernel/           Gateway · Sanitizer · Audit · EventBus · Config · Types
├── system/           Router · Storage
├── agents/           Core · Guardian · Planner · Executor · Memory Manager
├── governance/       Council · Arbiter · Overseer
├── api/              Routes · WebSocket
├── ops/              Daemon (macOS launchd)
└── cli/              8 commands

dashboard/            Vite 6 · React 19 · TypeScript · Tailwind CSS v4
tests/                18 files · 187 tests
docs/                 Architecture · Governance · Operations · Identity
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
npm run test:coverage      # Coverage report

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
| [SECURITY.md](docs/SECURITY.md) | Security invariants and threat model |
| [GOVERNANCE.md](docs/governance/GOVERNANCE.md) | Council, Arbiter, Overseer framework |
| [RUNBOOK_MAC.md](docs/operations/RUNBOOK_MAC.md) | Mac always-on deployment guide |
| [BRAND.md](docs/identity/BRAND.md) | Identity and voice guidelines |
| [CLAUDE.md](CLAUDE.md) | AI assistant context |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

<div align="center">

---

```
    █████╗ ██████╗ ██╗
   ██╔══██╗██╔══██╗██║
   ███████║██████╔╝██║
   ██╔══██║██╔══██╗██║
   ██║  ██║██║  ██║██║
   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
```

🖤 **ARI v2.0.0** · Aurora Protocol 🖤

*Life Operating System*

```
The shadow reveals truth. Every decision audited. No hidden state.
```

---

**Created by [Pryce Hedrick](https://github.com/PryceHedrick)**

Built with 🧠 by [Claude](https://anthropic.com) × Human collaboration

---

MIT License · [ARI-OS](https://github.com/ARI-OS)

*Your life, your rules, fully auditable.*

`127.0.0.1:3141` — The only address that matters.

</div>
