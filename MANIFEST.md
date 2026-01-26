# 🌹 ARI FOUNDATION — MANIFEST
## Authoritative Component Registry
## Version 11.0.0 | Rose Protocol

---

## System Identity

| Property | Value |
|----------|-------|
| **Name** | Ari (Artificial Reasoning Intelligence) |
| **Type** | Secure Multi-Agent Personal Operating System |
| **Version** | 11.0.0 |
| **Codename** | Rose Protocol |
| **Target** | Mac mini (local-first, cloud-optional) |
| **Operator** | Single primary user with allowlisted channels |
| **Build Date** | 2026-01-26 |
| **Status** | Foundation Complete |

---

## The Five Pillars (Immutable Kernel)

These principles cannot be modified by any agent:

1. **Operator Primacy** — Human operator's explicit instructions always override
2. **Radical Honesty** — Never deceive; acknowledge uncertainty; show reasoning
3. **Bounded Autonomy** — Act within explicit permission boundaries; escalate when uncertain
4. **Continuous Improvement** — Learn from outcomes; suggest improvements
5. **Graceful Limitation** — Know limits; fail safely; degrade gracefully

---

## Layer Architecture

### Layer 0: Kernel
Core principles, identity, immutable rules

### Layer 1: Governance
| Component | Symbol | Purpose |
|-----------|--------|---------|
| Arbiter | 👑 | Final authority, conflict resolution, precedent |
| Overseer | 👁️ | Quality control, blocking, escalation |
| Council | 🏛️ | Advisory votes on governance changes |

### Layer 2: Agents
| Component | Symbol | Purpose |
|-----------|--------|---------|
| Router | 🔀 | Request classification, routing |
| Planner | 📋 | Task decomposition, planning |
| Executor | ⚡ | Task execution, tool invocation |
| Trust Sanitizer | 🛡️ | Input validation, sanitization |
| Memory Manager | 🧠 | Memory operations, provenance |

### Layer 3: Operations
| Component | Purpose |
|-----------|---------|
| Tools | Permission-gated tool execution |
| Logger | Immutable audit trail |
| Config | Validated configuration management |

### Layer 4: Interfaces
| Component | Purpose |
|-----------|---------|
| CLI | Command-line interface |
| API | Programmatic access |
| MCP | Model Context Protocol channels |

---

## Council Members

| Role | Symbol | Focus Area |
|------|--------|------------|
| Architect | 🏛️ | System design, scalability, interfaces |
| Security | 🔒 | Threat defense, least privilege, secrets |
| Reliability | ⚙️ | Operations, uptime, recovery, migrations |
| Product | 🎯 | Usability, ergonomics, value delivery |
| Research | 📚 | Best practices, citations, gap analysis |

---

## File Registry

### Core Documentation (15 files)

| File | Purpose | Owner |
|------|---------|-------|
| `README.md` | Entry point, quick start | System |
| `MANIFEST.md` | This file | System |
| `LICENSE` | MIT License | System |
| `COUNCIL_VOTE_SIGNOFF.md` | Vote protocol | Arbiter |
| `COUNCIL_WORKSPACE.md` | Council scratch space | Council |
| `DOCS/ARCHITECTURE.md` | System design, diagrams | Architect |
| `DOCS/BOOTSTRAP.md` | Setup guide | Reliability |
| `DOCS/DECISIONS.md` | Decision log | Arbiter |
| `DOCS/GOVERNANCE.md` | Council rules, voting | Arbiter |
| `DOCS/LOGGING.md` | Audit log format | Reliability |
| `DOCS/MEMORY.md` | Memory system design | Architect |
| `DOCS/ROADMAP.md` | Delivery phases | Product |
| `DOCS/RUNBOOK.md` | Operations guide | Reliability |
| `DOCS/SECURITY.md` | Security policies | Security |
| `DOCS/STYLE_GUIDE.md` | Conventions | Product |
| `DOCS/TEST_PLAN.md` | Test strategy | Security |
| `DOCS/THREAT_MODEL.md` | Security analysis | Security |
| `DOCS/TOOLS.md` | Tool catalog | Architect |

### Prompts — System (8 files)

| File | Purpose |
|------|---------|
| `PROMPTS/SYSTEM/CORE.md` | Core system prompt |
| `PROMPTS/SYSTEM/ROUTER.md` | Request routing |
| `PROMPTS/SYSTEM/PLANNER.md` | Task planning |
| `PROMPTS/SYSTEM/EXECUTOR.md` | Task execution |
| `PROMPTS/SYSTEM/GUARDIAN.md` | Input sanitization |
| `PROMPTS/SYSTEM/MEMORY_MANAGER.md` | Memory operations |
| `PROMPTS/SYSTEM/ARBITER.md` | Governance authority |
| `PROMPTS/SYSTEM/OVERSEER.md` | Quality control |

### Prompts — Council (5 files)

| File | Purpose |
|------|---------|
| `PROMPTS/COUNCIL/ARCHITECT.md` | Design review |
| `PROMPTS/COUNCIL/SECURITY.md` | Security review |
| `PROMPTS/COUNCIL/RELIABILITY_OPS.md` | Operations review |
| `PROMPTS/COUNCIL/PRODUCT_UX.md` | UX review |
| `PROMPTS/COUNCIL/RESEARCH.md` | Research review |

### Prompts — Domain Agents (5 files)

| File | Purpose |
|------|---------|
| `PROMPTS/AGENTS/DOMAIN/RESEARCH.md` | Prospect research |
| `PROMPTS/AGENTS/DOMAIN/MARKETING.md` | Outreach & campaigns |
| `PROMPTS/AGENTS/DOMAIN/SALES.md` | Objection handling, closing |
| `PROMPTS/AGENTS/DOMAIN/CONTENT.md` | Social media, brand |
| `PROMPTS/AGENTS/DOMAIN/SEO.md` | Search optimization |

### Prompts — Execution Agents (6 files)

| File | Purpose |
|------|---------|
| `PROMPTS/AGENTS/EXECUTION/BUILD.md` | Specifications, scoping |
| `PROMPTS/AGENTS/EXECUTION/DEVELOPMENT.md` | Code, debug, deploy |
| `PROMPTS/AGENTS/EXECUTION/CLIENT_COMMS.md` | Client communication |
| `PROMPTS/AGENTS/EXECUTION/STRATEGY.md` | Prioritization |
| `PROMPTS/AGENTS/EXECUTION/PIPELINE.md` | Tracking, operations |
| `PROMPTS/AGENTS/EXECUTION/LEARNING.md` | Pattern capture |

### Configuration (5 files)

| File | Purpose | Sensitivity |
|------|---------|-------------|
| `CONFIG/defaults.json` | Safe baseline | Low |
| `CONFIG/permissions.json` | Permission tiers | Medium |
| `CONFIG/allowlists.json` | Trusted sources | High |
| `CONFIG/retention.json` | Log/memory retention | Low |
| `CONFIG/safe_defaults.json` | Fallback config | Low |

### Schemas (4 files)

| File | Purpose |
|------|---------|
| `SCHEMAS/config.json` | Configuration validation |
| `SCHEMAS/event.json` | Event/audit log schema |
| `SCHEMAS/memory_entry.json` | Memory entry schema |
| `SCHEMAS/tool_call.json` | Tool invocation schema |

### Workflows (4 files)

| File | Purpose |
|------|---------|
| `WORKFLOWS/approval_flow.md` | Plan→diff→approve→execute |
| `WORKFLOWS/change_management.md` | Governance changes |
| `WORKFLOWS/incident_response.md` | Security incidents |
| `WORKFLOWS/escalation_protocol.md` | Escalation procedures |

### Playbooks (4 files)

| File | Purpose |
|------|---------|
| `PLAYBOOKS/prompt_injection.md` | Injection defense |
| `PLAYBOOKS/memory_poisoning.md` | Memory attack defense |
| `PLAYBOOKS/capacity_overload.md` | Resource exhaustion |
| `PLAYBOOKS/client_escalation.md` | Client issue handling |

### Scripts (7 files)

| File | Purpose |
|------|---------|
| `SCRIPTS/bootstrap.sh` | System initialization |
| `SCRIPTS/health_check.sh` | System health verification |
| `SCRIPTS/backup.sh` | Data backup operations |
| `SCRIPTS/restore.sh` | Data restoration |
| `SCRIPTS/deploy.sh` | Deployment automation |
| `SCRIPTS/rollback.sh` | Rollback procedures |
| `SCRIPTS/test.sh` | Test execution |

### Templates (4 files)

| File | Purpose |
|------|---------|
| `TEMPLATES/proposal.md` | Client proposal template |
| `TEMPLATES/email.md` | Email communication template |
| `TEMPLATES/status_update.md` | Status report template |
| `TEMPLATES/incident_report.md` | Incident documentation |

---

## Permission Tiers

| Tier | Code | Scope | Approval Required |
|------|------|-------|-------------------|
| **Read Only** | `READ_ONLY` | View, query, analyze | None |
| **Write Safe** | `WRITE_SAFE` | Create, draft, append | Auto-logged |
| **Write Destructive** | `WRITE_DESTRUCTIVE` | Delete, modify, send | Explicit user |
| **Admin** | `ADMIN` | Config, policy, system | Council + Arbiter |

---

## Memory Types

| Type | Purpose | Retention | Mutability |
|------|---------|-----------|------------|
| `fact` | Verified information | Permanent | Correctable |
| `preference` | User preferences | Until changed | User-editable |
| `pattern` | Learned behaviors | 90 days review | Auto-decays |
| `decision` | Past decisions | Permanent | Append-only |
| `context` | Session context | Session only | Volatile |
| `reflection` | Self-observations | 30 days | Correctable |
| `goal` | Objectives (flexible) | Until achieved | User-editable |
| `relationship` | People/entities | Permanent | Correctable |

---

## Event Types (Audit)

| Category | Events |
|----------|--------|
| **Auth** | session_start, session_end, auth_failure |
| **Request** | request_received, request_routed, request_complete |
| **Tool** | tool_invoked, tool_success, tool_failure |
| **Memory** | memory_read, memory_write, memory_delete |
| **Governance** | vote_called, vote_cast, decision_made |
| **Security** | injection_detected, sanitization_applied, escalation |
| **Error** | error_caught, error_recovered, error_fatal |

---

## Dependencies

### Required
| Dependency | Purpose | Version |
|------------|---------|---------|
| Python | Runtime | ≥3.11 |
| Claude API | LLM backend | Latest |
| SQLite | Local storage | ≥3.40 |

### Optional
| Dependency | Purpose | Version |
|------------|---------|---------|
| Redis | Session cache | ≥7.0 |
| PostgreSQL | Scalable storage | ≥15 |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 11.0.0 | 2026-01-26 | Foundation complete: all prompts, configs, schemas, scripts, templates |
| 10.0.0 | 2026-01-25 | Initial architecture design |

---

## Repository Statistics

| Category | Count |
|----------|-------|
| Markdown Files | 53 |
| JSON Files | 10 |
| Shell Scripts | 7 |
| **Total Files** | **70** |
| **Total Size** | **760KB** |

---

**Document Owner:** System  
**Last Review:** 2026-01-26  
**Council Status:** Pending Round 1 Review
