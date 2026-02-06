# Governance Layer

Constitutional enforcement through Council, Arbiter, Overseer, and PolicyEngine.

## Components

| Component | Role | Mechanism |
|-----------|------|-----------|
| Council | 15-member voting | Majority/supermajority/unanimous thresholds |
| Arbiter | Constitutional rules | 6 immutable rules |
| Overseer | Quality gates | 5 validation checks |
| PolicyEngine | Permission control | Three-layer checks |
| StopTheLine | Emergency halt | System-wide pause |

**Simplified in Phase 2**: SOUL deliberation, council-deliberation, and council-members persona system were removed. The council uses `VOTING_AGENTS` from `kernel/types.ts` for agent identities.

## Council Voting

```typescript
const vote = council.createVote({
  topic: 'New tool permission',
  description: 'Allow agent X to use tool Y',
  threshold: 'MAJORITY', // 'MAJORITY' | 'SUPERMAJORITY' | 'UNANIMOUS'
  initiated_by: 'router',
});

// Agents vote (4 args: voteId, agent, option, reasoning)
council.castVote(vote.vote_id, 'guardian', 'APPROVE', 'Low risk operation');

// Check result
const result = council.getResult(vote.vote_id);
```

**Vote options**: `'APPROVE' | 'REJECT' | 'ABSTAIN'`

## Arbiter Rules

| Rule | Check |
|------|-------|
| No external binding | Gateway loopback only |
| Audit integrity | Hash chain valid |
| Trust required | All messages have trust |
| Sanitization | Content scanned |
| Permission check | Three-layer approval |

## Overseer Gates

```typescript
const passed = overseer.checkGates({
  operation: 'deploy',
  context: { agent: 'executor', tool: 'bash' },
});
// Returns: { passed: boolean, gates: Record<string, boolean> }
```

Gates: security, quality, performance, compliance, testing

## Stop-the-Line

Any agent can halt the system for critical issues:

```typescript
stopTheLine.halt('arbiter', 'Constitutional violation detected');
// System pauses until authorized resume
```

## Constructor Pattern

All governance components require `(auditLogger, eventBus)`:

```typescript
const council = new Council(auditLogger, eventBus);
const arbiter = new Arbiter(auditLogger, eventBus);
```

Skills: `/ari-council-governance`
