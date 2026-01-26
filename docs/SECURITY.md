# Security Model

## Core Principle: CONTENT != COMMAND

The foundational security principle of ARI vNext is that all inbound content
is treated as DATA, never as instructions. Content cannot:

- Execute commands or tools
- Modify system configuration
- Write to memory or persistent storage
- Invoke functions or APIs
- Alter the behavior of the system

This separation means that even if content contains injection attempts, they
have no mechanism to execute.

## Shadow Integration

Inspired by Carl Jung's concept of shadow integration, ARI detects suspicious
patterns in content but does not block them. This approach:

1. **Acknowledges the shadow**: Suspicious patterns are logged transparently
2. **Avoids false positives**: Legitimate content that happens to match
   patterns is not rejected
3. **Enables analysis**: Operators can review patterns for threat intelligence
4. **Maintains integrity**: The audit trail captures all detection events

### Detected Patterns

The sanitizer detects patterns in these categories:

- **Instruction override**: "ignore previous instructions", "new instructions:"
- **Role manipulation**: "you are now", "pretend to be", "act as"
- **Prompt extraction**: "reveal your prompt", "show instructions"
- **Command injection**: `execute:`, `$(...)`, backtick commands
- **Format injection**: `[system]`, `<system>`, markdown code fences
- **Encoding evasion**: base64 content, unicode escapes
- **Tool/memory manipulation**: "call tool", "write to memory"
- **Security bypass**: "bypass security", "bypass filter"

All detections are:
- Logged to the audit trail with pattern names
- Included in the sanitization flags returned to the caller
- NOT used to block or modify content

## Hash-Chained Audit Log

Every significant operation is recorded in a tamper-evident audit log.

### Hash Chain

Each entry contains:
- `sequence`: Monotonically increasing integer
- `timestamp`: ISO 8601 datetime
- `action`: Enum of known action types
- `actor`: Who performed the action (system, operator, sender, service)
- `details`: Action-specific data
- `prev_hash`: Hash of the previous entry (genesis = 64 zeros)
- `hash`: SHA-256 of `[sequence, timestamp, action, actor, details, prev_hash]`

### Tamper Detection

The `audit verify` command checks:
1. Sequential numbering (no gaps)
2. Hash chain continuity (each `prev_hash` matches prior `hash`)
3. Hash integrity (recomputed hash matches stored hash)

Any modification to an entry invalidates all subsequent hashes.

## Loopback-Only Binding

The gateway binds exclusively to `127.0.0.1`. This is:

- **Hardcoded** in the Gateway constructor
- **Enforced** in configuration loading (overrides any config file setting)
- **Verified** by the `doctor` command
- **Non-negotiable** in Phase 1

No network access is possible. The gateway is only reachable from the
local machine.

## Rate Limiting

Token bucket rate limiting is applied per sender:

- Configurable rate (default: 10 messages per minute per sender)
- Token refill over time
- Rate-limited messages are flagged but not rejected
- Rate limit events are recorded in the audit log

## Trust Levels

Inbound messages declare their trust level:

- `self`: Operator's own input (highest trust)
- `allowlisted`: Pre-approved sources
- `untrusted`: All other sources (default)

In Phase 1, trust levels are recorded in the audit log but do not affect
processing behavior. Future phases may implement differential handling.

## Input Sanitization Pipeline

All inbound content passes through this pipeline:

1. **Rate limit check**: Token bucket per sender
2. **Encoding fix**: Normalize to valid UTF-8, remove replacement characters
3. **Control character strip**: Remove control chars except newline and tab
4. **Size truncation**: Enforce byte limit (default 64KB) with safe UTF-8 boundary
5. **Pattern detection**: Log suspicious patterns (shadow integration)

Each step sets flags in the sanitization result, providing full transparency
about what processing was applied.

## Configuration Security

- Config file permissions: `0o600` (owner read/write only)
- Data directory permissions: `0o700` (owner only)
- `security.bind_loopback_only` is enforced as `true` regardless of config
- PID files use restrictive permissions
- Log files are created with appropriate permissions
