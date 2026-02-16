# 🖤 ARI Documentation

> Your Life Operating System — Built to multiply human capability within strict boundaries.

**ARI helps you think.** Not just execute tasks, but reason about them.

---

## Find What You Need

| You want to... | Start here |
|----------------|------------|
| **Understand the vision** | [Vision & Philosophy](VISION.md) |
| **Get running quickly** | [Quick Start](guides/setup.md#quick-start) |
| **Understand the architecture** | [Architecture Overview](architecture/ARCHITECTURE.md) |
| **Understand the networking** | [Networking Architecture](architecture/NETWORKING.md) |
| **Understand the cognitive layer** | [Cognitive Architecture](cognition/README.md) |
| **Set up development** | [Full Setup Guide](guides/setup.md) |
| **Deploy to Mac Mini** | [Mac Mini Runbook](operations/RUNBOOK_MAC_MINI.md) |
| **Work with Claude Code** | [Claude Code Setup](guides/CLAUDE-CODE-SETUP.md) |
| **Report a security issue** | [Security Policy](../SECURITY.md) |

---

## Documentation Structure

```
docs/
├── VISION.md         # ARI's unique value proposition
│
├── architecture/     # How ARI is built
│   ├── ARCHITECTURE.md   — 7-layer system design
│   ├── NETWORKING.md     — Three-zone network architecture  ← NEW
│   ├── agents.md         — 8 specialized agents
│   ├── security.md       — Threat model + defenses
│   ├── principles.md     — Engineering philosophy
│   └── DECISIONS.md      — Architectural decisions (ADRs)
│
├── cognition/        # Layer 0: Cognitive Architecture  ← NEW
│   ├── README.md         — Overview of LOGOS/ETHOS/PATHOS
│   ├── 01-pillars.md     — Three cognitive pillars
│   ├── 02-logos.md       — Reason (Bayesian, Kelly, EV)
│   ├── 03-ethos.md       — Character (bias, emotion)
│   ├── 04-pathos.md      — Growth (CBT, Stoic, wisdom)
│   └── ...               — (full spec in directory)
│
├── guides/           # How to use ARI
│   ├── setup.md          — Complete installation
│   ├── OPERATIONS.md     — Day-to-day operations
│   └── CLAUDE-CODE-SETUP.md — AI assistant setup
│
├── operations/       # Deployment runbooks
│   ├── RUNBOOK_MAC.md       — macOS daemon setup
│   └── RUNBOOK_MAC_MINI.md  — Mac Mini deployment
│
├── governance/       # Constitutional governance
│   └── GOVERNANCE.md     — Council, Arbiter, Overseer
│
├── identity/         # Brand & voice
│   ├── BRAND.md          — Voice, values, aesthetic
│   └── X_PROFILE.md      — Social presence
│
├── reference/        # Technical reference
│   └── stack.md          — Technology stack
│
├── audit/            # Security audits
│   └── (audit reports)
│
├── archive/          # Historical documents
│   └── history.md        — Project evolution
│
└── v12/              # Original specification
    └── (pre-implementation design docs)
```

---

## Core Documents (Root)

These live at the repository root for visibility:

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Project overview + quickstart |
| [CLAUDE.md](../CLAUDE.md) | AI assistant context (invariants, patterns, rules) |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development workflow |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting |
| [CHANGELOG.md](../CHANGELOG.md) | Version history |

---

## The 7 Layers

ARI's architecture is strictly layered. Each layer only imports from layers below it:

```
┌─────────────────────────────────────────┐
│  6. Interfaces   CLI, Dashboard         │
├─────────────────────────────────────────┤
│  5. Execution    Daemon, Ops            │
├─────────────────────────────────────────┤
│  4. Strategic    Council, Arbiter       │
├─────────────────────────────────────────┤
│  3. Core         Agents (5 types)       │
├─────────────────────────────────────────┤
│  2. System       Router, Storage        │
├─────────────────────────────────────────┤
│  1. Kernel       Gateway, Sanitizer,    │
│                  Audit, EventBus        │
├─────────────────────────────────────────┤
│  0. Cognitive    LOGOS, ETHOS, PATHOS   │  ← NEW
│                  Reason, Character,     │
│                  Growth                 │
└─────────────────────────────────────────┘
```

→ [Full architecture details](architecture/ARCHITECTURE.md)
→ [Cognitive layer details](cognition/README.md)

---

## The 8 Agents

| Agent | Layer | Responsibility |
|-------|-------|----------------|
| **Core** | 3 | Orchestrate message pipeline |
| **Guardian** | 3 | Detect threats |
| **Planner** | 3 | Decompose tasks |
| **Executor** | 3 | Run tools |
| **Memory Manager** | 3 | Store knowledge |
| **Council** | 4 | Vote on decisions |
| **Arbiter** | 4 | Enforce rules |
| **Overseer** | 4 | Check quality gates |

→ [Agent design details](architecture/agents.md)

---

## Security Model

**Core Principle: Content ≠ Command**

All inbound content is DATA, never instructions.

- 27 injection patterns detected across 10 categories
- SHA-256 hash-chained audit trail
- 6 trust levels with risk multipliers
- Loopback-only gateway (127.0.0.1)

→ [Security model details](architecture/security.md)

---

## Philosophy

ARI is built on three principles:

| Principle | Source | Implementation |
|-----------|--------|----------------|
| **Shadow Integration** | Jung | Observe anomalies, don't suppress them |
| **Ruthless Simplicity** | Musashi | Every component has one job |
| **Radical Transparency** | Dalio | All actions audited with full provenance |

→ [Engineering principles](architecture/principles.md)

---

<div align="center">

🖤

**ARI v2.2.1** — Cognitive Layer

*Claude Code helps you write code.*
*OpenClaw helps you communicate.*
*ARI helps you think.*

</div>
