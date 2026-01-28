---
name: ari-hash-chain-auditor
description: Verify and manage ARI's SHA-256 hash-chained audit trail
triggers:
  - "verify audit chain"
  - "check audit integrity"
  - "audit hash verification"
  - "validate audit trail"
---

# ARI Hash Chain Auditor

## Purpose

Verify and manage ARI's tamper-evident SHA-256 hash-chained audit trail (ADR-002).

## Hash Chain Structure

```
Genesis Block (0x00...00)
    ↓
Event 1: hash = SHA256(previousHash + eventData)
    ↓
Event 2: hash = SHA256(event1.hash + eventData)
    ↓
Event N: hash = SHA256(eventN-1.hash + eventData)
```

## Audit File Location

`~/.ari/audit.json`

## Verification Commands

```bash
# CLI verification
npx ari audit verify

# Programmatic verification
npm run audit:verify
```

## Integrity Checks

1. **Chain Continuity**: Each event's previousHash matches prior event's hash
2. **Hash Validity**: Recalculate hash matches stored hash
3. **Genesis Validity**: First event's previousHash is genesis (0x00...00)
4. **No Gaps**: Sequential event IDs with no missing entries
5. **Timestamp Order**: Events are chronologically ordered

## When to Use

- After system recovery or restart
- Before any security-sensitive operations
- When investigating suspicious activity
- During compliance audits
- As part of quality gates

## Verification Workflow

```typescript
async verifyAuditChain(): Promise<VerificationResult> {
  const audit = await loadAuditFile();
  let previousHash = GENESIS_HASH; // 0x00...00

  for (const event of audit.events) {
    // Verify chain link
    if (event.previousHash !== previousHash) {
      return { valid: false, error: 'Chain broken', event };
    }

    // Verify hash computation
    const computed = sha256(previousHash + JSON.stringify(event.data));
    if (computed !== event.hash) {
      return { valid: false, error: 'Hash mismatch', event };
    }

    previousHash = event.hash;
  }

  return { valid: true, eventCount: audit.events.length };
}
```

## Security Alerts

If verification fails:
1. **DO NOT** proceed with normal operations
2. **LOG** the failure with full details
3. **ALERT** via EventBus: `security:audit_tampered`
4. **REQUIRE** manual investigation
5. **BLOCK** all sensitive operations

## Integration with ARI Governance

- **Overseer** quality gate requires audit integrity
- **Arbiter** constitutional rule: audit_immutable
- All governance decisions must pass through verified audit
