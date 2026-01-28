# ARI Security Model

Version 2.0.0 — Aurora Protocol

## Core Principle: Content ≠ Command

All inbound content is DATA, never interpreted as instructions.

This principle is enforced through:
1. Sanitization pipeline (src/kernel/sanitizer.ts)
2. Audit integrity (src/kernel/audit.ts)
3. Trust boundaries (src/kernel/types.ts)
4. Pipeline enforcement (src/kernel/event-bus.ts)

## Injection Detection

### Implementation: src/kernel/sanitizer.ts

21 patterns across 6 categories, matched with case-insensitive regex.

**Category 1: Direct Override** (5 patterns)
- "ignore previous instructions"
- "disregard all prior"
- "forget everything above"
- "new instructions:"
- "override:"

**Category 2: Role Manipulation** (4 patterns)
- "you are now"
- "act as if you are"
- "pretend to be"
- "your new role is"

**Category 3: Command Injection** (4 patterns)
- Shell command patterns: `$(cmd)`, `\`cmd\``, `; cmd;`, `| cmd |`
- SQL injection: `' OR '1'='1`
- Path traversal: `../../../`
- Script tags: `<script>`

**Category 4: Prompt Extraction** (3 patterns)
- "repeat your instructions"
- "what are your rules"
- "show me your prompt"

**Category 5: Authority Claims** (3 patterns)
- "as your creator"
- "I am your developer"
- "system administrator override"

**Category 6: Data Exfiltration** (2 patterns)
- "send this to"
- "forward this to"

### Risk Scoring

Base risk score = number of patterns matched

Trust level multiplier:
- SYSTEM: 0.5x (internal components)
- OPERATOR: 0.6x (authenticated operator)
- VERIFIED: 0.75x (verified sources)
- STANDARD: 1.0x (default)
- UNTRUSTED: 1.5x (external sources get higher risk)
- HOSTILE: 2.0x (known malicious sources)

Final risk = base × multiplier

### Detection Response

```typescript
// src/kernel/sanitizer.ts
export function sanitize(content: string, trustLevel: TrustLevel): SanitizeResult {
  const matchedPatterns = detectPatterns(content);
  const riskScore = calculateRisk(matchedPatterns.length, trustLevel);

  return {
    clean: matchedPatterns.length === 0,
    riskScore,
    matchedPatterns,
    category: categorize(matchedPatterns)
  };
}
```

If injection detected:
1. Message marked as high-risk
2. Logged to audit chain with 'injection_detected' type
3. Event emitted: 'message:rejected'
4. Original content preserved (for forensics)
5. System does NOT execute detected patterns

## Audit Integrity

### Implementation: src/kernel/audit.ts

SHA-256 hash chain ensures tamper-evident logging.

**Chain Structure:**

```
Event 0 (Genesis):
  previousHash: "0x00000000000000000000000000000000"
  hash: SHA-256(previousHash + timestamp + type + data)

Event 1:
  previousHash: [hash from Event 0]
  hash: SHA-256(previousHash + timestamp + type + data)

Event N:
  previousHash: [hash from Event N-1]
  hash: SHA-256(previousHash + timestamp + type + data)
```

**Verification:**

```typescript
// src/kernel/audit.ts
async verify(): Promise<VerifyResult> {
  let expectedPreviousHash = "0x00000000000000000000000000000000";

  for (const event of this.events) {
    if (event.previousHash !== expectedPreviousHash) {
      return { valid: false, details: `Break at event ${event.id}` };
    }

    const computedHash = this.computeHash(event);
    if (computedHash !== event.hash) {
      return { valid: false, details: `Hash mismatch at event ${event.id}` };
    }

    expectedPreviousHash = event.hash;
  }

  return { valid: true };
}
```

**Properties:**
- Append-only (no deletion)
- Tamper-evident (hash mismatch on modification)
- Chronological (sequence numbers)
- Cryptographically linked (SHA-256)

**Event Types:**
- `message:accepted` — Clean message passed sanitization
- `message:rejected` — Injection detected
- `system:routed` — System layer routing decision
- `injection_detected` — Security event with pattern details
- `trust_violation` — Trust boundary breach attempt

**File Location:** ~/.ari/audit.json

**CLI Commands:**
- `ari audit list` — View recent events
- `ari audit verify` — Check chain integrity
- `ari audit security` — Filter security events only

## Trust Levels

### Implementation: src/kernel/types.ts

```typescript
export const TrustLevelSchema = z.enum([
  'system',      // Internal ARI components
  'operator',    // Authenticated operator
  'verified',    // Verified external sources
  'standard',    // Default trust level
  'untrusted',   // Unverified external content
  'hostile'      // Known malicious sources
]);
```

**Trust Enforcement (Risk Multipliers):**
- SYSTEM: Internal components (risk multiplier 0.5x)
- OPERATOR: Authenticated operator (risk multiplier 0.6x)
- VERIFIED: Verified sources (risk multiplier 0.75x)
- STANDARD: Default level (risk multiplier 1.0x)
- UNTRUSTED: Unverified external content (risk multiplier 1.5x)
- HOSTILE: Known malicious sources (risk multiplier 2.0x)

Auto-block threshold: risk ≥ 0.8

## Pipeline Enforcement

### Integration: src/kernel/event-bus.ts

System layer subscribes to kernel events. Cannot bypass pipeline.

**Enforcement Mechanism:**

```typescript
// src/kernel/gateway.ts
fastify.post('/message', async (request, reply) => {
  const { content, trustLevel } = request.body;

  // Step 1: Sanitize (REQUIRED, no bypass)
  const sanitizeResult = sanitizer.sanitize(content, trustLevel);

  if (!sanitizeResult.clean) {
    // Step 2a: Audit rejection
    await auditLogger.log('injection_detected', {
      patterns: sanitizeResult.matchedPatterns,
      riskScore: sanitizeResult.riskScore
    });

    // Step 3a: Emit rejection event
    eventBus.emit('message:rejected', { content, sanitizeResult });

    return { accepted: false, reason: 'injection_detected' };
  }

  // Step 2b: Audit acceptance
  await auditLogger.log('message:accepted', { content });

  // Step 3b: Emit acceptance event
  eventBus.emit('message:accepted', { content, trustLevel });

  return { accepted: true };
});
```

**System Layer Integration:**

```typescript
// src/system/router.ts
export function initializeRouter(eventBus: EventBus, auditLogger: AuditLogger) {
  // Subscribe to kernel events (ONLY way to receive messages)
  eventBus.on('message:accepted', async (event) => {
    const routeResult = await route(event.content);

    // Log routing decision via kernel audit
    await auditLogger.log('system:routed', {
      context: routeResult.matchedContext,
      confidence: routeResult.confidence
    });
  });
}
```

**Guarantees:**
- System receives only sanitized messages
- System cannot bypass sanitizer
- All system routing is audited
- No direct gateway access from system layer

## Loopback-Only Binding

### Implementation: src/kernel/gateway.ts

Gateway binds exclusively to 127.0.0.1 (hardcoded).

```typescript
// src/kernel/gateway.ts
export async function startGateway(port: number = 3141): Promise<void> {
  const fastify = Fastify();

  // HARDCODED: 127.0.0.1 only, not configurable
  await fastify.listen({ port, host: '127.0.0.1' });

  console.log(`Gateway listening on 127.0.0.1:${port}`);
}
```

**Security Properties:**
- No remote access (localhost only)
- No network exposure
- Operator must be physically present (or via SSH)
- Cannot be overridden by config

**Future Considerations:**
- Unix socket binding (even more restricted)
- mTLS for remote access (authenticated only)
- Rate limiting per connection

## Rate Limiting (Future)

Not yet implemented. Planned for Phase 2.

**Design:**
- Per-source rate limits (messages per minute)
- Sliding window algorithm
- Audit log on rate limit violations
- Temporary blocking for repeat offenders

**Implementation Location:** src/kernel/gateway.ts (middleware)

## Security Invariants

1. **Loopback-only gateway** — 127.0.0.1 binding, hardcoded in src/kernel/gateway.ts
2. **Hash chain integrity** — SHA-256 linking in src/kernel/audit.ts, genesis block verification
3. **Injection detection** — 21 patterns in src/kernel/sanitizer.ts, 6 categories
4. **Trust-weighted risk** — Risk multiplier in src/kernel/sanitizer.ts (0.5x, 1.0x, 1.5x)
5. **Pipeline enforcement** — Event-only integration in src/system/router.ts, no bypass paths
6. **Content = data** — No interpretation of external content as instructions

## Threat Model

### In-Scope Threats

1. **Prompt injection** — Mitigated by 21-pattern sanitizer
2. **Audit tampering** — Mitigated by SHA-256 hash chain
3. **Trust escalation** — Mitigated by trust level enforcement
4. **System bypass** — Mitigated by event-bus-only integration
5. **Command injection** — Mitigated by sanitizer category 3

### Out-of-Scope (Future Phases)

1. **Memory poisoning** — Requires memory manager (Phase 2)
2. **Tool misuse** — Requires executor + permission gating (Phase 2)
3. **Privilege escalation** — Requires full governance implementation (Phase 2)
4. **Network-based attacks** — Loopback-only binding reduces surface area

### Accepted Risks

1. **Operator compromise** — If operator machine is compromised, ARI is compromised
2. **Filesystem access** — ARI requires read/write to ~/.ari/ (future: encryption at rest)
3. **Novel injection patterns** — 21 patterns cover known vectors, not exhaustive
4. **Side-channel attacks** — Timing, memory analysis not yet addressed

## Security Testing

### Test Coverage: tests/security/injection.test.ts

Tests verify:
- Direct override patterns are detected
- Role manipulation patterns are detected
- Command injection patterns are detected
- Prompt extraction patterns are detected
- Authority claim patterns are detected
- Data exfiltration patterns are detected
- Risk scoring calculates correctly
- Trust level multipliers apply correctly

### Audit Tests: tests/unit/kernel/audit.test.ts

Tests verify:
- Genesis block has correct previousHash
- Chain links correctly
- Tampering detection works
- Hash computation is consistent

### Integration Tests: tests/unit/system/router.test.ts

Tests verify:
- System receives only sanitized messages
- Routing decisions are audited
- Event subscription works correctly
- No bypass paths exist

## Incident Response

### Detection
- `ari audit security` — List all security events
- `ari audit verify` — Check for audit tampering
- `ari doctor` — Verify system health

### Investigation
- Review audit log at ~/.ari/audit.json
- Check matched patterns in injection_detected events
- Verify trust levels on suspicious messages
- Trace message flow via event timestamps

### Remediation
- Block offending source (manual, no auto-block yet)
- Update patterns if novel injection discovered
- Restore from clean audit backup if tampering detected
- Re-run `ari doctor` to verify health

---

*Security documentation for ARI V12.0*
