# Governance Layer

Constitutional enforcement through Council, Arbiter, and Overseer.

## Components

| Component | Role | Mechanism |
|-----------|------|-----------|
| Council | 13-member voting | Majority/supermajority thresholds |
| Arbiter | Constitutional rules | 5 immutable rules |
| Overseer | Quality gates | 5 validation checks |
| PolicyEngine | Permission control | Three-layer checks |

## Council Voting

```typescript
const vote = council.createVote({
  topic: 'New tool permission',
  description: 'Allow agent X to use tool Y',
  threshold: 'MAJORITY', // or 'SUPERMAJORITY'
  initiated_by: 'router',
});

// Agents vote
council.castVote(vote.vote_id, 'guardian', 'approve');

// Check result
const result = council.getResult(vote.vote_id);
```

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

Skills: `/ari-council-governance`
