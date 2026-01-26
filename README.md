# 🌹 ARI FOUNDATION
## Secure Multi-Agent Personal Operating System
## Rose Protocol • Blackbox Ledger

```
     ___      .______       __  
    /   \     |   _  \     |  | 
   /  ^  \    |  |_)  |    |  | 
  /  /_\  \   |      /     |  | 
 /  _____  \  |  |\  \----.|  | 
/__/     \__\ | _| `._____||__| 
                                
    Artificial Reasoning Intelligence
    Foundation v11.0.0 | Rose Protocol
```

---

## What Ari Is

Ari is a **secure, multi-agent personal operating system** designed to:

- 🎯 **Augment human capability** across all life domains
- 🔒 **Operate safely** with explicit trust boundaries
- 📚 **Learn continuously** while respecting human authority
- 🏛️ **Govern democratically** with no single point of failure
- ⚡ **Execute reliably** with full auditability

**Core Identity:** Ari serves one operator (you) with radical honesty, bounded autonomy, and continuous improvement.

---

## What Ari Is NOT

- ❌ **Not autonomous** — Requires explicit approval for significant actions
- ❌ **Not omniscient** — Acknowledges uncertainty, doesn't fabricate
- ❌ **Not uncontrollable** — Operator can override any decision
- ❌ **Not memory-perfect** — All memories have provenance and can be corrected
- ❌ **Not a replacement** — Augments human judgment, doesn't replace it

---

## Core Principles (Immutable)

### The Five Pillars

1. **Operator Primacy** — Your explicit instructions always override system decisions
2. **Radical Honesty** — Never deceive; acknowledge uncertainty; show reasoning
3. **Bounded Autonomy** — Act within explicit permission boundaries; escalate when uncertain
4. **Continuous Improvement** — Learn from outcomes; suggest improvements; never stagnate
5. **Graceful Limitation** — Know limits; fail safely; degrade gracefully

---

## Security Model

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  🔴 UNTRUSTED ZONE                                          │
│  • Web content    • Email/messages    • External APIs       │
│  • File contents  • User-provided URLs                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  🛡️ TRUST BOUNDARY │
                    │  Sanitization      │
                    │  Validation        │
                    │  Provenance Tags   │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  🟢 TRUSTED CORE                                             │
│  • Operator direct input    • System configuration          │
│  • Kernel principles        • Allowlisted sources           │
└─────────────────────────────────────────────────────────────┘
```

### Permission Tiers

| Tier | Code | Scope | Approval |
|------|------|-------|----------|
| **Read Only** | `READ_ONLY` | View, query, analyze | None |
| **Write Safe** | `WRITE_SAFE` | Create, draft, append | Auto-logged |
| **Write Destructive** | `WRITE_DESTRUCTIVE` | Delete, modify, send | Explicit user |
| **Admin** | `ADMIN` | Config, policy, system | Council + Arbiter |

### Key Security Features

- **Input Sanitization** — All external content stripped of executable instructions
- **Provenance Tracking** — Every piece of data tagged with source and trust level
- **Audit Logging** — Every action logged with hash chain integrity
- **Least Privilege** — Default to minimum permissions required
- **Explicit Escalation** — Uncertain situations always escalate to operator

---

## Quick Start

### Prerequisites

- macOS 12+ or Linux
- Bash 4.0+
- curl, git
- 8GB RAM minimum (recommended)

### Safe Installation

```bash
# 1. Clone repository
git clone https://github.com/YOUR_ORG/ari-v11-foundation.git
cd ari-v11-foundation

# 2. Run bootstrap (initializes directories and config)
./SCRIPTS/bootstrap.sh

# 3. Run health check
./SCRIPTS/health_check.sh

# 4. Run test suite
./SCRIPTS/test.sh
```

### First Run Checklist

- [x] Bootstrap completed successfully
- [x] Health check passes (warnings OK)
- [x] Test suite passes (52/52 tests)
- [x] Permissions set to defaults (least privilege)
- [ ] Operator confirmation received

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     LAYER 0: KERNEL                         │
│         Core principles, identity, immutable rules          │
├─────────────────────────────────────────────────────────────┤
│                     LAYER 1: GOVERNANCE                     │
│         Arbiter 👑 • Overseer 👁️ • Council 🏛️              │
├─────────────────────────────────────────────────────────────┤
│                     LAYER 2: AGENTS                         │
│         Router 🔀 • Planner 📋 • Executor ⚡                │
├─────────────────────────────────────────────────────────────┤
│                     LAYER 3: OPERATIONS                     │
│         Memory 🧠 • Tools 🔧 • Logger 📝 • Config ⚙️        │
├─────────────────────────────────────────────────────────────┤
│                     LAYER 4: INTERFACES                     │
│         CLI • API • MCP Channels                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation Map

| Document | Purpose |
|----------|---------|
| [MANIFEST.md](MANIFEST.md) | Component registry, system identity |
| [DOCS/ARCHITECTURE.md](DOCS/ARCHITECTURE.md) | System design, data flows, diagrams |
| [DOCS/THREAT_MODEL.md](DOCS/THREAT_MODEL.md) | Security analysis, attack surfaces |
| [DOCS/SECURITY.md](DOCS/SECURITY.md) | Security policies, safe defaults |
| [DOCS/GOVERNANCE.md](DOCS/GOVERNANCE.md) | Council rules, voting, authority |
| [DOCS/MEMORY.md](DOCS/MEMORY.md) | Memory system, provenance, hygiene |
| [DOCS/TOOLS.md](DOCS/TOOLS.md) | Tool catalog, permissions |
| [DOCS/LOGGING.md](DOCS/LOGGING.md) | Audit log format, event schema |
| [DOCS/RUNBOOK.md](DOCS/RUNBOOK.md) | Operations guide, debugging |
| [DOCS/TEST_PLAN.md](DOCS/TEST_PLAN.md) | Test strategy, red team prompts |
| [DOCS/BOOTSTRAP.md](DOCS/BOOTSTRAP.md) | Complete setup guide |
| [COUNCIL_WORKSPACE.md](COUNCIL_WORKSPACE.md) | Council review records |
| [COUNCIL_VOTE_SIGNOFF.md](COUNCIL_VOTE_SIGNOFF.md) | Official vote records |

---

## Governance

### Decision Authority

```
Operator (Human) ─────────────────────────────┐
        │                                      │
        ▼                                      │ Override
Arbiter 👑 (Final System Authority) ◄─────────┘
        │
        ▼
Overseer 👁️ (Quality Control)
        │
        ▼
Council 🏛️ (Advisory Votes)
        │
        ▼
Execution Agents ⚡
```

### Council Members

| Role | Focus |
|------|-------|
| 🏛️ Architect | System design, scalability |
| 🔒 Security | Threat defense, least privilege |
| ⚙️ Reliability | Operations, uptime, recovery |
| 🎯 Product | Usability, ergonomics |
| 📚 Research | Best practices, citations |

---

## Version History

| Version | Date | Codename | Status |
|---------|------|----------|--------|
| 11.0.0 | 2026-01-26 | Rose Protocol | Current |

**Release Notes:**
- 5-layer architecture (Kernel → Governance → Agents → Operations → Interfaces)
- 13-agent council with democratic governance
- Trust boundary model with 4 tiers
- Memory system with provenance tracking and trust decay
- Tool permission framework (5 tiers)
- Comprehensive security playbooks
- Full test suite (52 tests)
- Complete documentation (14 DOCS files)

---

## License

MIT License — See [LICENSE](LICENSE)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Built with 🖤 for humans who want AI that respects boundaries.**
