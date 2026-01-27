# ARI Governance System

This document describes the governance structure of ARI's multi-agent system, including the Council, Arbiter, and Overseer.

## Overview

ARI uses a three-tier governance system:

1. **Council** - Democratic voting body (13 members)
2. **Arbiter** - Constitutional enforcement (5 rules)
3. **Overseer** - Quality gate enforcement (5 gates)

## Council

The Council is the democratic decision-making body composed of 13 agent members.

### Composition

The Council consists of 13 members representing different domains:

| Member ID | Role | Domain |
|-----------|------|--------|
| `router` | System orchestration | Routing and event management |
| `planner` | Task planning | Task decomposition and DAG |
| `executor` | Tool execution | Permission-gated operations |
| `memory_manager` | Memory operations | Provenance-tracked storage |
| `guardian` | Security | Threat detection and assessment |
| `research` | Knowledge synthesis | Research and analysis |
| `marketing` | Outreach | Marketing strategy |
| `sales` | Revenue | Sales operations |
| `content` | Communication | Content creation |
| `seo` | Discovery | Search optimization |
| `build` | Construction | Building and deployment |
| `development` | Engineering | Code development |
| `client_comms` | Relationships | Client communication |

### Voting Thresholds

The Council supports three voting thresholds:

| Threshold | Requirement | Use Cases |
|-----------|-------------|-----------|
| **MAJORITY** | >50% of votes | Routine decisions, feature prioritization |
| **SUPERMAJORITY** | ≥66% of votes | Significant changes, policy updates |
| **UNANIMOUS** | 100% of votes | Critical changes, security policies |

### Quorum

- **Minimum participation**: 50% of eligible voters must cast votes
- **Early conclusion**: Voting ends early if outcome is mathematically determined
- **No quorum**: Vote fails if quorum not met

### Voting Process

1. **Proposal**: Issue is submitted to Council
2. **Deliberation**: Members review and discuss
3. **Voting**: Each member casts YES, NO, or ABSTAIN
4. **Calculation**: Votes tallied, quorum checked
5. **Outcome**: Result determined by threshold requirement
6. **Audit**: Decision logged to audit trail

### Example Votes

```typescript
// Routine decision (MAJORITY)
const result = await council.vote({
  issue: 'Add rate limiting to API endpoint',
  threshold: 'MAJORITY',
  voters: ['router', 'guardian', 'executor', 'planner'],
  votes: {
    router: 'YES',
    guardian: 'YES',
    executor: 'NO',
    planner: 'ABSTAIN',
  },
});
// Result: PASSED (2 YES / 2 participating = >50%)

// Critical decision (UNANIMOUS)
const result = await council.vote({
  issue: 'Modify audit log structure',
  threshold: 'UNANIMOUS',
  voters: ['router', 'guardian', 'executor', 'memory_manager'],
  votes: {
    router: 'YES',
    guardian: 'YES',
    executor: 'YES',
    memory_manager: 'NO',
  },
});
// Result: FAILED (not 100%)
```

## Arbiter

The Arbiter enforces constitutional rules that cannot be overridden by Council votes.

### Constitutional Rules

The Arbiter enforces five immutable rules:

| Rule ID | Name | Description |
|---------|------|-------------|
| `loopback_only` | Loopback-Only Gateway | Gateway must bind to 127.0.0.1 exclusively |
| `content_not_command` | Content ≠ Command | Inbound content is data, never executable instructions |
| `audit_immutable` | Audit Immutability | Audit log is append-only, hash-chained, tamper-evident |
| `least_privilege` | Least Privilege | All operations require minimum necessary permissions |
| `trust_required` | Trust Required | All messages must have trust level (SYSTEM, TRUSTED, UNTRUSTED) |

### Rule Enforcement

```typescript
// Example: Arbiter blocks attempt to violate loopback_only rule
const result = arbiter.enforce({
  action: 'bind_gateway',
  params: { host: '0.0.0.0', port: 3141 },
});
// Result: BLOCKED (violates loopback_only rule)

// Example: Arbiter allows compliant action
const result = arbiter.enforce({
  action: 'bind_gateway',
  params: { host: '127.0.0.1', port: 3141 },
});
// Result: ALLOWED
```

### Dispute Resolution

When Council decisions conflict with constitutional rules:

1. **Arbiter blocks execution** - Rule violation prevented
2. **Security alert emitted** - Event logged to audit trail
3. **Council notified** - Members informed of conflict
4. **Alternative required** - Council must propose compliant solution

### Example Dispute

```
Council Vote: "Allow gateway to bind to 0.0.0.0 for remote access"
Threshold: SUPERMAJORITY
Result: PASSED (70% YES)

Arbiter Review: BLOCKED
Rule Violated: loopback_only
Outcome: Decision not executed despite passing vote
Next Step: Council must propose alternative solution
```

## Overseer

The Overseer enforces quality gates for system releases and deployments.

### Quality Gates

The Overseer evaluates five quality gates:

| Gate ID | Name | Requirement |
|---------|------|-------------|
| `test_coverage` | Test Coverage | ≥80% overall, 100% for security paths |
| `audit_integrity` | Audit Integrity | Hash chain valid, no corruption |
| `security_scan` | Security Scan | No high/critical vulnerabilities |
| `build_clean` | Build Clean | TypeScript compiles with no errors |
| `documentation` | Documentation | All public APIs documented |

### Gate Evaluation

Each gate returns:

- **PASS**: Gate requirement met
- **FAIL**: Gate requirement not met
- **SKIP**: Gate not applicable (with reason)

### Release Process

1. **Pre-flight**: Overseer evaluates all gates
2. **Results**: Each gate reports PASS/FAIL/SKIP
3. **Aggregation**: Overall status determined
4. **Decision**: Release proceeds only if all gates PASS or SKIP
5. **Audit**: Gate results logged to audit trail

### Example Evaluation

```typescript
const result = await overseer.evaluateGates({
  context: 'release_12.0.1',
  gates: ['test_coverage', 'audit_integrity', 'security_scan', 'build_clean'],
});

// Result:
{
  overall: 'PASS',
  gates: {
    test_coverage: { status: 'PASS', coverage: 85 },
    audit_integrity: { status: 'PASS', chainValid: true },
    security_scan: { status: 'PASS', vulnerabilities: 0 },
    build_clean: { status: 'PASS', errors: 0 },
  },
}
```

## Decision Lifecycle

### 1. Proposal

- Issue raised by agent, operator, or automated process
- Proposal includes context, rationale, and impact assessment

### 2. Routing

- **Council decisions**: Routine operations, feature requests, policy changes
- **Arbiter checks**: Security-critical operations, system modifications
- **Overseer gates**: Releases, deployments, system updates

### 3. Evaluation

- Council: Democratic vote with threshold
- Arbiter: Constitutional rule enforcement
- Overseer: Quality gate evaluation

### 4. Execution

- Decision executed if approved
- Blocked if constitutional rule violated or quality gate failed
- Logged to audit trail regardless of outcome

### 5. Audit

All decisions recorded with:

- Timestamp
- Decision body (Council, Arbiter, Overseer)
- Issue/proposal
- Votes/checks/gates
- Outcome (PASSED, FAILED, BLOCKED)
- Agent signatures

## Integration with System

### Event-Driven

All governance operations emit events via EventBus:

```typescript
// Council vote event
eventBus.emit('governance:vote_complete', {
  issue: 'proposal_id',
  threshold: 'MAJORITY',
  result: 'PASSED',
  votes: { yes: 5, no: 2, abstain: 1 },
});

// Arbiter enforcement event
eventBus.emit('governance:rule_enforced', {
  rule: 'loopback_only',
  action: 'bind_gateway',
  result: 'BLOCKED',
});

// Overseer gate event
eventBus.emit('governance:gate_evaluated', {
  gate: 'test_coverage',
  status: 'PASS',
  coverage: 85,
});
```

### Audit Trail

All governance decisions are logged to `~/.ari/audit.json`:

```json
{
  "timestamp": "2026-01-27T12:00:00.000Z",
  "action": "governance_vote",
  "agent": "council",
  "details": {
    "issue": "add_rate_limiting",
    "threshold": "MAJORITY",
    "result": "PASSED",
    "votes": { "yes": 5, "no": 2, "abstain": 1 }
  },
  "previousHash": "abc123...",
  "hash": "def456..."
}
```

## Configuration

Governance configuration stored in `~/.ari/config.json`:

```json
{
  "governance": {
    "council": {
      "members": [
        "router", "planner", "executor", "memory_manager", "guardian",
        "research", "marketing", "sales", "content", "seo",
        "build", "development", "client_comms"
      ],
      "quorum": 0.5
    },
    "arbiter": {
      "rules": [
        "loopback_only",
        "content_not_command",
        "audit_immutable",
        "least_privilege",
        "trust_required"
      ]
    },
    "overseer": {
      "gates": [
        "test_coverage",
        "audit_integrity",
        "security_scan",
        "build_clean",
        "documentation"
      ]
    }
  }
}
```

## Testing

Governance components have 100% test coverage:

- **Council**: 10 tests (voting thresholds, quorum, early conclusion)
- **Arbiter**: 10 tests (rule enforcement, dispute resolution)
- **Overseer**: 8 tests (gate evaluation, release blocking)

Run governance tests:

```bash
npm test -- tests/unit/governance/
```

## Future Enhancements

Potential governance improvements (not yet implemented):

- **Delegation**: Members delegate votes to trusted agents
- **Vote history**: Query past decisions and voting patterns
- **Proposal templates**: Standardized proposal formats
- **Time-bound votes**: Automatic expiration after deadline
- **Vote revision**: Members change votes before deadline

---

**Last Updated**: 2026-01-27
**Version**: 12.0.0
