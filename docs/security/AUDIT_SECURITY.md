# Audit Log Security

How ARI's audit trail works, why it's trustworthy, and how to verify it.

## How It Works

Every significant action in ARI gets logged to an **audit chain** — a sequence of events where each event includes a cryptographic hash of the previous event.

```
Event 1          Event 2          Event 3
┌──────────┐     ┌──────────┐     ┌──────────┐
│ id       │     │ id       │     │ id       │
│ action   │     │ action   │     │ action   │
│ actor    │     │ actor    │     │ actor    │
│ prevHash─┼──┐  │ prevHash─┼──┐  │ prevHash │
│ hash ────┼──┼──┤ hash ────┼──┼──┤ hash     │
└──────────┘  │  └──────────┘  │  └──────────┘
              │                │
     Genesis  └── Points to    └── Points to
     (64 zeros)    Event 1          Event 2
```

If anyone modifies Event 1, its hash changes, which means Event 2's `prevHash` no longer matches. The chain breaks. This is **tamper-evident**.

## Hash Chain Mechanics

### What Gets Hashed

Each event's SHA-256 hash is computed from these fields in deterministic order:

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "action": "what happened",
  "actor": "who did it",
  "trustLevel": "trust level of source",
  "details": { "context": "..." },
  "previousHash": "hash of previous event"
}
```

### Genesis

The first event chains from a genesis hash: 64 zeros (`000...000`). This is hardcoded and cannot be changed.

### Verification

`verify()` walks the entire chain and checks:

1. Each event's `previousHash` matches the actual previous event's `hash`
2. Each event's `hash` matches what you get when you recompute it

If either check fails, the chain is broken at that event.

## Checkpoint Anchoring

### The Problem Checkpoints Solve

The hash chain is internally consistent — but if someone replaces the **entire file** with a new chain, the new chain would also be internally consistent. Verification would pass.

### How Checkpoints Work

Periodically (every 100 events by default), ARI creates a **checkpoint** — a signed snapshot:

```json
{
  "id": "uuid",
  "timestamp": "when checkpoint was taken",
  "eventCount": 200,
  "headHash": "hash of event #200",
  "genesisEventHash": "hash of event #1",
  "signature": "HMAC-SHA256 of the above"
}
```

The HMAC signature uses a key stored in macOS Keychain (backed by the Secure Enclave on Apple Silicon). An attacker who replaces the audit file can't forge matching checkpoints because:

1. They don't have the signing key
2. The key is in Keychain, not on the filesystem
3. Keychain access requires the user's login session

### Signing Key Persistence

The signing key is stored in macOS Keychain under `ari-audit-signing-key`. This means:

- **Key survives restarts** — same key is loaded each time ARI starts
- **Key survives file replacement** — Keychain is separate from filesystem
- **Key requires login** — only the logged-in user can access it

On startup, ARI:

1. Tries to load the key from Keychain
2. If found: uses it (all old checkpoints remain verifiable)
3. If not found: generates a new key and stores it in Keychain
4. If Keychain unavailable (non-macOS): falls back to ephemeral key with a warning

You can check key status via `isKeyPersisted()` on the AuditLogger instance.

### Checkpoint Verification

`verifyCheckpoints()` checks each checkpoint against the current chain:

1. Does the chain have at least as many events as the checkpoint recorded?
2. Does the event at position N have the hash the checkpoint recorded?
3. Does the first event still have the same hash?
4. Does the HMAC signature verify (using the Keychain-persisted key)?

Any mismatch means the chain was replaced after the checkpoint was taken.

### Checkpoint Storage

Checkpoints are stored separately from the main audit log:

- Audit log: `~/.ari/audit.json`
- Checkpoints: `~/.ari/audit-checkpoints.json`
- Signing key: macOS Keychain (`ari-audit-signing-key`)

## Retention

| Data | Location | Retention |
|------|----------|-----------|
| Audit events | `~/.ari/audit.json` | Indefinite (append-only) |
| Checkpoints | `~/.ari/audit-checkpoints.json` | Indefinite |
| Gateway logs | `~/.ari/logs/gateway-*.log` | 7 days (logrotate) |

## What Gets Audited

| Action | Trust Level | Details Recorded |
|--------|-------------|-----------------|
| `gateway_started` | system | host, port |
| `gateway_stopped` | system | host, port |
| `message_received` | source's level | messageId, contentLength |
| `security_event` | system | eventType, severity, threats |
| `vote:created` | verified | voteId, topic, threshold |
| `vote:cast` | verified | voteId, agent, option |
| `vote:closed` | system | voteId, status, result |
| `arbiter:evaluation` | system | ruleId, action, violations |
| `permission:granted` | source's level | requestId, toolId, tokenId |
| `permission:denied` | source's level | requestId, toolId, reason |
| `policy:register` | system | toolId, tier, trust |

## Verification Commands

```bash
# Verify audit chain integrity
npx ari audit verify

# Check chain status
npx ari audit status
```

## Security Properties

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| Tamper-evident | Modification detected | SHA-256 hash chain |
| Replacement-evident | Full replacement detected | HMAC-signed checkpoints |
| Append-only | No deletion or modification | Constitutional Rule #3 |
| Complete | All significant actions logged | Gateway + PolicyEngine hooks |
| Timestamped | Events have accurate timestamps | System clock |
| Attributed | Events have actor identity | Trust level assignment |

## What Counts as Compromise?

Different levels of attacker access break different guarantees:

| Attacker Access Level | What Still Holds | What Breaks |
|----------------------|-----------------|-------------|
| **Can read log files** | Chain integrity, checkpoint signatures | Event details are visible (timestamps, actions, actors). No secrets are stored in audit events. |
| **Can modify files** | Checkpoint signatures detect it. Keychain key is not on filesystem. | Hash chain can be modified (detected on verify). Audit file can be replaced (detected by checkpoints). |
| **Has local user access** | Keychain requires login password for programmatic access. TLS protects outbound. | If the attacker IS the logged-in user, they can access Keychain and forge checkpoints. |
| **Has root access** | Nothing. | Root can access Keychain, modify files, and forge everything. This is a "game over" scenario for any local-only system. |

**Bottom line**: The audit system protects against file-level tampering. It does not protect against a compromised operating system. If you suspect OS-level compromise, the audit trail should be treated as untrustworthy.

## Limitations

- **Not tamper-proof**: A sufficiently motivated attacker with filesystem access can modify the file. The hash chain detects this, but doesn't prevent it.
- **Clock trust**: Timestamps come from the system clock. If the clock is wrong, timestamps are wrong.
- **Single-machine**: Audit data is stored on one machine. Hardware failure loses the audit trail unless backed up.
- **Root access**: macOS Keychain protects the signing key from filesystem-only attackers, but root access can read Keychain entries.

## Recommendations

1. **Back up regularly**: `scripts/backup.sh` creates timestamped backups of `~/.ari/`
2. **Verify weekly**: Run `npx ari audit verify` to check chain integrity
3. **Monitor alerts**: P0 alerts fire when chain or checkpoint verification fails
4. **Keep checkpoints**: Don't delete `audit-checkpoints.json`

---

v1.0 - 2026-02-10
