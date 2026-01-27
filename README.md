# ARI — Artificial Reasoning Intelligence

**Your Life Operating System**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-187-brightgreen)](tests/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

A secure, multi-agent personal operating system. Local-first, tamper-evident, and built on principles of shadow integration, radical transparency, and ruthless simplicity.

## Quick Start

```bash
# Install dependencies
npm install

# Build the system
npm run build

# Initialize ARI
npx ari onboard init

# Verify system health
npx ari doctor

# Start the gateway
npx ari gateway start
```

## Architecture Overview

ARI is built on a six-layer architecture with strict dependency rules and a single coupling point (EventBus):

| Layer | Components | Responsibility |
|-------|-----------|----------------|
| **Interfaces** | CLI (8 commands) | User interaction, command execution |
| **Execution** | Daemon | Background service management (macOS launchd) |
| **Strategic** | Governance (Council, Arbiter, Overseer) | Voting, constitutional enforcement, quality gates |
| **Core** | Agents (Core, Guardian, Planner, Executor, Memory Manager) | Multi-agent coordination, threat detection, task planning, tool execution |
| **System** | Router, Storage | Event routing, context management |
| **Kernel** | Gateway, Sanitizer, Audit, EventBus, Config, Types | Security boundary, injection detection, tamper-evident logging |

**Data Flow**: POST /message → Sanitize → Audit → EventBus → Guardian → Router → Planner → Executor → Audit

**Integration Point**: All layers communicate exclusively through the EventBus (typed pub/sub system)

## Core Principles

### Shadow Integration (Jung)
Don't suppress suspicious behavior. Log it, understand it, integrate it. The shadow reveals truth.

### Radical Transparency (Dalio)
All operations are audited. Every decision is traceable. No hidden state, no secret channels.

### Ruthless Simplicity (Musashi)
Every line of code must justify its existence. Remove complexity, favor clarity, choose obvious over clever.

## Security Highlights

### Loopback-Only Gateway
Gateway binds exclusively to `127.0.0.1:3141`. No external network access, ever. This is hardcoded and non-configurable.

### Content ≠ Command Principle
All inbound messages are treated as DATA, never as executable instructions. Clear separation between content and commands.

### SHA-256 Hash Chain
Every audit event is cryptographically chained to its predecessor. Tampering breaks the chain. Genesis block verification on startup.

### 21-Pattern Injection Detection
Real-time scanning across 6 categories: Direct Override, Role Manipulation, Command Injection, Prompt Extraction, Authority Claims, Data Exfiltration.

### Trust-Level Risk Scoring
Risk scores weighted by source trust level (SYSTEM: 0.5x, UNTRUSTED: 1.5x). Auto-block at risk ≥ 0.8.

### Least Privilege
Tools require explicit permission checks across three layers: agent allowlist, trust level, permission tier.

## CLI Commands Reference

```bash
# System initialization
npx ari onboard init              # Initialize ARI system (~/.ari/, config, genesis audit)

# Health and diagnostics
npx ari doctor                    # Run 6 health checks

# Gateway management
npx ari gateway start [-p port]   # Start the Fastify gateway on 127.0.0.1
npx ari gateway status [-p port]  # Check gateway health

# Audit log management
npx ari audit list [-n count]     # List recent audit events
npx ari audit verify              # Verify SHA-256 hash chain integrity
npx ari audit security            # List security events only

# Context management
npx ari context init              # Initialize context system
npx ari context list              # List all contexts
npx ari context create <name>     # Create new context
npx ari context select <id>       # Set active context
npx ari context show              # Show active context

# Governance reference
npx ari governance show           # Show governance structure
npx ari governance list           # List council members

# Daemon management (macOS)
npx ari daemon install            # Install background service
npx ari daemon status             # Check daemon status
npx ari daemon uninstall          # Remove background service
```

## Project Structure

```
ari/
├── src/
│   ├── kernel/          # Security boundary, pipeline, audit
│   ├── system/          # Routing, storage
│   ├── agents/          # Core, Guardian, Planner, Executor, Memory Manager
│   ├── governance/      # Council, Arbiter, Overseer
│   ├── ops/             # Daemon (macOS launchd)
│   └── cli/             # 8 CLI commands
├── tests/
│   ├── unit/            # 14 test files
│   ├── integration/     # Full pipeline tests
│   └── security/        # Injection defense tests
├── docs/
│   ├── governance/      # Council rules, voting thresholds
│   └── operations/      # Runbooks, deployment guides
└── scripts/             # Setup and maintenance scripts

Data Layout (~/.ari/):
├── config.json          # Zod-validated configuration
├── audit.json           # Hash-chained audit log
├── logs/                # Application logs
└── contexts/            # Context storage
```

## Testing

```bash
# Run all tests (120 tests)
npm test

# Watch mode
npm run test:watch

# Coverage report (80%+ target, 100% for security paths)
npm run test:coverage
```

## Links

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Security Model](SECURITY.md)
- [Governance Rules](docs/governance/GOVERNANCE.md)
- [Operations Runbook](docs/operations/RUNBOOK_MAC_MINI.md)
- [Contributing Guide](CONTRIBUTING.md)
- [AI Assistant Context](CLAUDE.md)

## Version

**12.0.0** — Life Operating System (2026-01-27)

Identity evolution: Aurora Protocol → ARI Life OS

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Operator**: Pryce Hedrick
**Repository**: github.com/PryceHedrick/ari

*"Secure reasoning, local-first, auditable"*
