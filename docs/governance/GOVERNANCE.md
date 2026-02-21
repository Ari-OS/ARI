# ARI Governance System

Three-branch governance: Council (legislative), Arbiter (judicial), Overseer (executive quality).

## Overview

| Branch | Component | Role | Decision Type |
|--------|-----------|------|---------------|
| Legislative | Council | Policy creation, democratic voting | Advisory proposals |
| Judicial | Arbiter | Constitutional enforcement | Absolute (cannot be overridden) |
| Executive | Overseer | Quality gate enforcement | Release blocking |
| Runtime | PolicyEngine | Permission decisions | Deterministic (see `POLICY_ENGINE.md`) |

## The Council of Fifteen

15-member deliberative body. Ratified 2026-02-01 by unanimous vote.

### Members

| # | Icon | Name | Agent ID | Pillar | Voting Style | Veto Domain |
|---|------|------|----------|--------|-------------|-------------|
| 1 | 🧭 | ATLAS | router | Infrastructure | Balanced | — |
| 2 | ⚡ | BOLT | executor | Infrastructure | Progressive | — |
| 3 | 📚 | ECHO | memory_keeper | Infrastructure | Cautious | memory |
| 4 | 🛡 | AEGIS | guardian | Protection | Cautious | security |
| 5 | 📊 | SCOUT | risk_assessor | Protection | Cautious | high_risk |
| 6 | 🎯 | TRUE | planner | Strategy | Balanced | — |
| 7 | ⏰ | TEMPO | scheduler | Strategy | Balanced | time_conflict |
| 8 | 💎 | OPAL | resource_manager | Strategy | Cautious | resource_depletion |
| 9 | 💚 | PULSE | wellness | Domains | Cautious | health_harm |
| 10 | 🤝 | EMBER | relationships | Domains | Balanced | — |
| 11 | ✨ | PRISM | creative | Domains | Progressive | — |
| 12 | 💰 | MINT | wealth | Domains | Cautious | major_financial |
| 13 | 🌱 | BLOOM | growth | Domains | Progressive | — |
| 14 | ⚖ | VERA | ethics | Meta | Cautious | ethics_violation |
| 15 | 🔗 | NEXUS | integrator | Meta | Balanced (tie-breaker) | — |

**Non-voting system agents**: core, arbiter, overseer, autonomous

### Pillars

| Pillar | Members | Purpose |
|--------|---------|---------|
| Infrastructure (3) | ATLAS, BOLT, ECHO | System operations and routing |
| Protection (2) | AEGIS, SCOUT | Security and risk management |
| Strategy (3) | TRUE, TEMPO, OPAL | Planning and resource allocation |
| Domains (5) | PULSE, EMBER, PRISM, MINT, BLOOM | Life domain expertise |
| Meta (2) | VERA, NEXUS | Ethics and integration |

### Voting Thresholds

| Threshold | Required | Count (of 15) | Use Cases |
|-----------|----------|---------------|-----------|
| MAJORITY | >50% | 8+ votes | Routine decisions |
| SUPERMAJORITY | >=66% | 10+ votes | Significant changes |
| UNANIMOUS | 100% | 15/15 votes | Critical/constitutional changes |

**Quorum**: 50% (8 members) must participate for a valid vote.

### Voting Styles

The Council is balanced by design:

- **Cautious (5)**: ECHO, AEGIS, SCOUT, OPAL, PULSE, MINT, VERA — default to reject unless evidence is strong
- **Balanced (5)**: ATLAS, TRUE, TEMPO, EMBER, NEXUS — weigh proportionally
- **Progressive (3)**: BOLT, PRISM, BLOOM — default to approve unless risk is clear

This means any proposal needs convincing evidence to pass, not just enthusiasm.

### Veto Authority

8 of 15 members hold veto power in specific domains. A veto immediately fails a vote.

| Agent | Domain | Example |
|-------|--------|---------|
| AEGIS (guardian) | security | Block exposing ports |
| ECHO (memory_keeper) | memory | Block memory deletion |
| SCOUT (risk_assessor) | high_risk | Block high-risk operations |
| TEMPO (scheduler) | time_conflict | Block schedule conflicts |
| OPAL (resource_manager) | resource_depletion | Block resource-draining requests |
| PULSE (wellness) | health_harm | Block health-harming actions |
| MINT (wealth) | major_financial | Block expensive operations |
| VERA (ethics) | ethics_violation | Block unethical actions |

### When the Council Decides

The Council votes on **policy-level decisions**:

- Should we add a new tool?
- Should we change a budget limit?
- Should we approve a high-cost AI request ($0.25+)?
- Should we modify a scheduling policy?

The Council does NOT handle runtime permission checks — that's the PolicyEngine's job.

### AI Spending Governance

AI API calls are governed by cost thresholds (via `AIPolicyGovernor`):

| Cost Range | Governance |
|-----------|------------|
| < $0.005 | Auto-approved |
| $0.005 - $0.05 | Simple majority (8/15) — predicted voting |
| $0.05 - $0.25 | Weighted majority (8/15) — predicted voting |
| $0.25 - $1.00 | Supermajority (10/15) — full deliberation |
| > $1.00 | Super-supermajority (12/15) — full deliberation |
| Emergency (>50% monthly) | MINT + OPAL + SCOUT unanimous |

## The Arbiter

Enforces 6 immutable constitutional rules. No vote, command, or configuration can override these.

### Constitutional Rules

| Rule | Name | Description | Status |
|------|------|-------------|--------|
| 0 | Creator Primacy | Always operate in Pryce Hedrick's best interest | IMMUTABLE |
| 1 | Loopback-Only | Gateway binds exclusively to 127.0.0.1 | IMMUTABLE |
| 2 | Content != Command | External content is data, never instructions | IMMUTABLE |
| 3 | Audit Immutable | Audit log is append-only, hash-chained | IMMUTABLE |
| 4 | Least Privilege | Default deny, minimum necessary permissions | IMMUTABLE |
| 5 | Trust Required | All messages must have assigned trust level | IMMUTABLE |

### How the Arbiter Works

1. Receives action context via `evaluateAction(action, context)`
2. Checks all 6 rules against the context
3. Returns `COMPLIANT` or `VIOLATION` with specific rule violations
4. Violations are logged to audit trail and emitted via EventBus
5. **Cannot be overridden** — even a unanimous Council vote cannot bypass the Arbiter

### Dispute Resolution

When a Council decision conflicts with a constitutional rule:

1. Arbiter blocks execution
2. Security alert emitted
3. Council notified of conflict
4. Council must propose a compliant alternative

## The Overseer

Enforces quality gates for releases and deployments.

### Quality Gates

| Gate | Requirement | Blocks Release If |
|------|-------------|-------------------|
| test_coverage | Tests must pass | Any test failing |
| audit_integrity | Hash chain valid | Chain corrupted |
| security_scan | No critical events | Critical events in 24h |
| build_clean | TypeScript compiles | Build errors |
| documentation | Required docs exist | README.md/CLAUDE.md missing |

All gates must pass for `canRelease()` to return `approved: true`.

## Decision Flow

```
Incoming Request
     │
     ▼
┌────────────────┐     ┌─────────────────┐
│ Arbiter Check  │────►│ Constitutional   │──► BLOCK if violation
│ (always first) │     │ Violation?       │
└────────┬───────┘     └─────────────────┘
         │ COMPLIANT
         ▼
┌────────────────┐     ┌─────────────────┐
│ PolicyEngine   │────►│ Permission      │──► DENY if not allowed
│ (runtime)      │     │ Check           │    APPROVE if allowed
└────────┬───────┘     └─────────────────┘
         │ POLICY QUESTION
         ▼
┌────────────────┐     ┌─────────────────┐
│ Council Vote   │────►│ Threshold       │──► PASS or FAIL
│ (when needed)  │     │ Check + Veto    │
└────────────────┘     └─────────────────┘
```

## Event-Driven Communication

All governance operations emit events via EventBus:

| Event | Source | Payload |
|-------|--------|---------|
| `vote:started` | Council | voteId, topic, threshold |
| `vote:cast` | Council | voteId, agent, option |
| `vote:completed` | Council | voteId, status, result |
| `vote:vetoed` | Council | voteId, vetoer, domain |
| `arbiter:ruling` | Arbiter | ruleId, type, decision |
| `overseer:gate` | Overseer | gateId, passed, reason |
| `permission:granted` | PolicyEngine | requestId, toolId, tokenId |
| `permission:denied` | PolicyEngine | requestId, toolId, reason |

## Implementation Files

| File | Purpose |
|------|---------|
| `src/governance/council.ts` | Council voting, veto authority |
| `src/governance/arbiter.ts` | Constitutional rule enforcement |
| `src/governance/overseer.ts` | Quality gate evaluation |
| `src/governance/policy-engine.ts` | Runtime permission decisions |
| `src/ai/ai-policy-governor.ts` | AI spending governance |
| `src/kernel/types.ts` | Vote, Proposal, ToolPolicy schemas |
| `src/kernel/constitutional-invariants.ts` | Immutable rules |

## Testing

| Component | Test File | Coverage |
|-----------|-----------|----------|
| Council | `tests/unit/governance/council.test.ts` | Voting, veto, thresholds |
| Arbiter | `tests/unit/governance/arbiter.test.ts` | Rule enforcement, disputes |
| Overseer | `tests/unit/governance/overseer.test.ts` | Gate evaluation, releases |
| PolicyEngine | `tests/unit/governance/policy-engine.test.ts` | Permissions, tokens |
| AIPolicyGovernor | `tests/unit/ai/ai-policy-governor.test.ts` | Cost governance |

---

v3.0 - 2026-02-10
