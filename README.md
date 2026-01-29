<div align="center">

<img src="docs/assets/aripfp.jpg" alt="ARI" width="200" />

# 🖤 ARI

**Artificial Reasoning Intelligence**

*Your Life Operating System*

[![CI](https://github.com/Ari-OS/ARI/actions/workflows/ci.yml/badge.svg)](https://github.com/Ari-OS/ARI/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-2.0.0-9333ea)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-20%2B-9333ea)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-9333ea)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/tests-187-9333ea)](tests/)
[![License](https://img.shields.io/badge/license-MIT-9333ea)](LICENSE)

---

**Observe. Decide. Act. Audit.**

*A local-first, multi-agent operating system that orchestrates your life through constitutional governance and tamper-evident audit trails.*

[Getting Started](#getting-started) · [Architecture](#architecture) · [Documentation](#documentation)

</div>

---

## What is ARI?

ARI orchestrates AI agents to manage your life — health, career, finances, ventures, and personal growth. Every decision flows through constitutional governance, every operation is cryptographically audited, and all data stays on your machine.

```
127.0.0.1:3141 — The only address that matters.
```

## Philosophy

> **Shadow Integration** (Jung) — Don't suppress suspicious behavior; log it, understand it, integrate it.

> **Radical Transparency** (Dalio) — Every operation is audited, every decision is traceable. No hidden state.

> **Ruthless Simplicity** (Musashi) — Every line of code must justify its existence.

---

## Security Foundation

Security is the architectural foundation. Five invariants enforced at the kernel layer:

| Invariant | Enforcement |
|-----------|-------------|
| **Loopback-Only** | `127.0.0.1:3141` hardcoded. No external network access. |
| **Content ≠ Command** | All inbound messages are DATA, never instructions. |
| **Audit Immutable** | SHA-256 hash chain from genesis. Tampering breaks the chain. |
| **Least Privilege** | Three-layer permission checks on every operation. |
| **Trust Required** | Six trust levels with risk multipliers. Auto-block at risk ≥ 0.8. |

---

## Architecture

Six layers. Strict boundaries. Unidirectional dependencies.

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
```

### Governance

| Component | Role |
|-----------|------|
| **Council** | 13-member voting body. Majority, supermajority, unanimous thresholds. |
| **Arbiter** | 5 constitutional rules. Violations are blocked, not negotiated. |
| **Overseer** | 5 quality gates. Test coverage, audit integrity, security scans. |

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

## Getting Started

### Prerequisites

- **Node.js** 20.0.0+
- **macOS** 12.0+ (daemon support; core works on any OS)

### Install

```bash
git clone https://github.com/Ari-OS/ARI.git
cd ARI
npm install
npm run build
```

### Initialize

```bash
npx ari onboard init     # Create ~/.ari/, config, genesis audit
npx ari doctor           # Verify system health
npx ari gateway start    # Start gateway (127.0.0.1:3141)
```

### First Interaction

```bash
curl http://127.0.0.1:3141/health

curl -X POST http://127.0.0.1:3141/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Plan my week", "source": "standard"}'
```

---

## Claude Code Integration

ARI includes deep Claude Code integration for development workflows.

```bash
./scripts/setup-claude.sh
```

**Includes:**
- **30 skills** — Domain knowledge for testing, security, architecture
- **12 commands** — `/ari-status`, `/ari-learn`, `/ari-secure`, `/ari-deploy`
- **7 agents** — Architect, security-auditor, test-generator, and more
- **MCP server** — Direct access to audit, memory, and governance

---

## CLI Reference

```
ari onboard init              Initialize ARI system
ari doctor                    Run health checks
ari gateway start             Start gateway (127.0.0.1:3141)
ari gateway status            Check gateway health
ari audit list                List recent audit events
ari audit verify              Verify hash chain integrity
ari audit security            List security events
ari context init              Initialize context system
ari context list              List all contexts
ari context create <name>     Create new context
ari governance show           Show governance structure
ari governance list           List council members
ari daemon install            Install background service
ari daemon status             Check daemon status
```

---

## Dashboard

Web-based control center. **View-only** — reads from the gateway API.

```bash
cd dashboard && npm install && npm run dev
```

| Stack | Pages |
|-------|-------|
| Vite 6 + React 19 + TypeScript | Home · Governance · Memory |
| TanStack Query + Tailwind CSS v4 | Tools · Agents · Audit |

---

## API

REST API and WebSocket on `127.0.0.1:3141` (loopback only).

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /status` | System status |
| `POST /message` | Submit message |
| `GET /api/agents` | List agents |
| `GET /api/governance/rules` | Constitutional rules |
| `GET /api/audit` | Audit entries |
| `GET /api/audit/verify` | Verify hash chain |
| `WS /ws` | Real-time events |

---

## Project Structure

```
src/
├── kernel/           Gateway · Sanitizer · Audit · EventBus · Config
├── system/           Router · Storage
├── agents/           Core · Guardian · Planner · Executor · Memory
├── governance/       Council · Arbiter · Overseer
├── api/              Routes · WebSocket
├── mcp/              MCP Server for Claude Code
├── ops/              Daemon (macOS launchd)
└── cli/              CLI commands

dashboard/            React 19 + Vite + Tailwind
tests/                187 tests across 18 files
docs/                 Architecture · Governance · Security
.claude/              Claude Code skills, commands, agents
```

---

## Development

```bash
npm run build              # Compile TypeScript
npm run dev                # Watch mode
npm test                   # Run 187 tests
npm run test:coverage      # Coverage report
npm run typecheck          # TypeScript strict mode
npm run lint               # ESLint
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Six-layer system design |
| [SECURITY.md](SECURITY.md) | Security invariants and threat model |
| [GOVERNANCE.md](docs/governance/GOVERNANCE.md) | Council, Arbiter, Overseer |
| [CLAUDE.md](CLAUDE.md) | AI assistant context |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

<div align="center">

**ARI v2.0.0** · Aurora Protocol

*Your life, your rules, fully auditable.*

[GitHub](https://github.com/Ari-OS/ARI) · [Documentation](docs/) · [Issues](https://github.com/Ari-OS/ARI/issues)

---

`>_ Pryce × ARI`

</div>
