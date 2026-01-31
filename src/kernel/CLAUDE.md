# Kernel Layer

The kernel is ARI's security boundary. All external input enters here.

## Core Invariants (NEVER VIOLATE)

| Invariant | Enforcement |
|-----------|-------------|
| Loopback-only | Gateway binds to `127.0.0.1` exclusively |
| Content ≠ Command | Sanitizer scans 21 patterns before processing |
| Audit immutable | SHA-256 hash chain, append-only |
| Trust required | All messages have trust level |

## Key Components

- **gateway.ts** — Fastify server, loopback-only binding
- **sanitizer.ts** — 21 injection patterns across 6 categories
- **audit.ts** — Hash-chained logging with genesis block
- **event-bus.ts** — Typed pub/sub for all layers
- **config.ts** — Zod-validated configuration
- **types.ts** — All type definitions (shared across layers)

## Security Patterns

```typescript
// CORRECT: Always sanitize before processing
const sanitized = this.sanitizer.sanitize(message);
if (!sanitized.safe) throw new SecurityError(sanitized.reason);

// CORRECT: Audit all operations
await this.audit.log('action', agent, trustLevel, details);

// WRONG: Trusting external input
const result = process(message.content); // NO!
```

## Trust Levels

| Level | Risk Multiplier | Use Case |
|-------|-----------------|----------|
| SYSTEM | 0.5x | Internal ARI operations |
| OPERATOR | 0.6x | Pryce, Claude Code |
| VERIFIED | 0.75x | Authenticated external |
| STANDARD | 1.0x | Normal requests |
| UNTRUSTED | 1.5x | Unknown sources |
| HOSTILE | 2.0x | Detected threats |

Skills: `/ari-hash-chain-auditor`, `/ari-injection-detection`, `/ari-trust-levels`
