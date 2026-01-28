# ARI Documentation

**Welcome to ARI — Your Life Operating System**

Start here to find what you're looking for.

---

## Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| Get started quickly | [README.md](../README.md) |
| Understand the architecture | [ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| Learn about security | [SECURITY.md](SECURITY.md) |
| Contribute code | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Deploy on macOS | [RUNBOOK_MAC.md](operations/RUNBOOK_MAC.md) |
| Set up from scratch | [SETUP.md](SETUP.md) |
| Understand the tech stack | [STACK.md](STACK.md) |
| Learn the philosophy | [PRINCIPLES.md](PRINCIPLES.md) |
| Work with AI assistants | [CLAUDE.md](../CLAUDE.md) |
| Report security issues | [SECURITY.md](../SECURITY.md) |

---

## Documentation Map

### Root (Public API)

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Front door — overview, features, quickstart |
| [CLAUDE.md](../CLAUDE.md) | AI assistant context — invariants, patterns, rules |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development workflow — setup, commits, PRs |
| [SECURITY.md](../SECURITY.md) | Security policy — vulnerability reporting |
| [CHANGELOG.md](../CHANGELOG.md) | Version history — protocol naming |
| [LICENSE](../LICENSE) | MIT License |

### Architecture

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | 6-layer system design |
| [AGENT_DESIGN.md](AGENT_DESIGN.md) | Agent architecture and patterns |
| [DECISIONS.md](architecture/DECISIONS.md) | Architectural decision records |
| [SECURITY_MODEL.md](architecture/SECURITY_MODEL.md) | Security invariants detail |
| [HISTORY.md](HISTORY.md) | Project evolution and design rationale |

### Governance

| Document | Purpose |
|----------|---------|
| [GOVERNANCE.md](governance/GOVERNANCE.md) | Council, Arbiter, Overseer |

### Operations

| Document | Purpose |
|----------|---------|
| [RUNBOOK_MAC.md](operations/RUNBOOK_MAC.md) | macOS always-on deployment |
| [SOCIAL_INTEGRATION.md](operations/SOCIAL_INTEGRATION.md) | Social media automation (roadmap) |

### Identity

| Document | Purpose |
|----------|---------|
| [BRAND.md](identity/BRAND.md) | Voice, values, aesthetic |
| [X_PROFILE.md](identity/X_PROFILE.md) | Social presence (@BoilerBurner96) |
| [IMAGE_PROMPTS.md](identity/IMAGE_PROMPTS.md) | Visual identity generation |

### Setup & Reference

| Document | Purpose |
|----------|---------|
| [SETUP.md](SETUP.md) | Complete installation guide |
| [STACK.md](STACK.md) | Technology stack reference |
| [FRONTDOOR_GAP.md](FRONTDOOR_GAP.md) | Gap analysis and improvements |

---

## Layer Documentation

ARI has 6 architectural layers:

```
6. Interfaces   → CLI (8 commands), Dashboard (React 19)
5. Execution    → Daemon (macOS launchd)
4. Strategic    → Council, Arbiter, Overseer
3. Core         → Core, Guardian, Planner, Executor, Memory
2. System       → Router, Storage
1. Kernel       → Gateway, Sanitizer, Audit, EventBus, Config, Types
```

Each layer only imports from layers below it. See [ARCHITECTURE.md](architecture/ARCHITECTURE.md) for full details.

---

## Security Documentation

| Topic | Document |
|-------|----------|
| Threat model | [SECURITY.md](SECURITY.md) |
| Vulnerability reporting | [SECURITY.md](../SECURITY.md) |
| 5 core invariants | [CLAUDE.md](../CLAUDE.md#core-invariants) |
| 21 injection patterns | `src/kernel/sanitizer.ts` |
| Trust levels | [CLAUDE.md](../CLAUDE.md#trust-required) |

---

## Getting Help

- **GitHub Issues**: [github.com/PryceHedrick/ARI/issues](https://github.com/PryceHedrick/ARI/issues)
- **Security Issues**: See [SECURITY.md](../SECURITY.md) for responsible disclosure

---

**ARI v2.0.0** — Life Operating System
