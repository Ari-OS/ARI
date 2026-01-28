# Architecture

## Evolution

ARI's architecture has been shaped by three protocol generations:

| Version | Protocol | Architecture |
|---------|----------|-------------|
| v1.0.0 | **Sentinel** | First multi-agent security framework. Established the "CONTENT ≠ COMMAND" principle and proved that constitutional AI agent governance was viable. |
| v2.0.0 | **Aurora** | Expanded to a "Universal Life OS" with context namespaces across life domains. Ambition outpaced the architecture — organic growth made security properties hard to verify. |
| v3.0.0 | **Kagemusha** | Ground-up TypeScript rewrite. Kept the philosophical DNA (shadow integration, radical transparency) but rebuilt every component with ruthless simplicity. This is the current codebase. |

The Kagemusha Protocol carries forward two core insights from its predecessors:

1. **From Sentinel**: Content must never be treated as commands — the separation is absolute
2. **From Aurora**: A personal OS needs strict component boundaries to remain auditable at scale

Everything else was discarded. The current codebase shares zero code with v1 or v2.

---

## System Overview

ARI vNext Phase 1 implements a local-first message ingestion and audit pipeline.

```
                    External Input
                         |
                         v
┌────────────────────────────────────────────────────────┐
│                  WebSocket Gateway                      │
│                  (127.0.0.1:18789)                      │
│                                                        │
│  ┌──────────┐   ┌───────────┐   ┌──────────────────┐  │
│  │ Protocol │──>│ Sanitizer │──>│ Audit Log        │  │
│  │ Parser   │   │ (Shadow)  │   │ (SHA-256 Chain)  │  │
│  └──────────┘   └─────┬─────┘   └──────────────────┘  │
│                       │                                │
│                       v                                │
│                ┌──────────────┐                        │
│                │  Event Bus   │                        │
│                │  (Pub/Sub)   │                        │
│                └──────────────┘                        │
└────────────────────────────────────────────────────────┘
                         |
              ┌──────────┼──────────┐
              v          v          v
         Subscribers  CLI Tools  Future Agents
```

## Components

### Gateway (`src/gateway/gateway.ts`)

The WebSocket server that accepts client connections. Hardcoded to bind to
`127.0.0.1` only -- this cannot be overridden by configuration.

Responsibilities:
- Accept WebSocket connections
- Parse and validate protocol messages
- Route messages to the sanitization pipeline
- Manage sessions and subscriptions
- Broadcast events to subscribed clients
- Heartbeat monitoring for connection health

### Sanitizer (`src/security/sanitizer.ts`)

All inbound content passes through the sanitizer before entering the system.

Pipeline:
1. Rate limit check (per-sender token bucket)
2. Encoding normalization (ensure valid UTF-8)
3. Control character stripping (preserve newlines and tabs)
4. Size truncation (configurable byte limit)
5. Shadow pattern detection (log suspicious patterns)

The sanitizer follows the CONTENT != COMMAND principle: suspicious patterns
are detected and logged but content is never blocked. Since content cannot
execute anything in the system, blocking creates false positives without
security benefit.

### Audit Log (`src/audit/audit-log.ts`)

Tamper-evident, append-only JSONL log with SHA-256 hash chaining.

Hash formula:
```
hash = SHA256(JSON.stringify([sequence, timestamp, action, actor, details, prev_hash]))
```

Features:
- Sequential numbering (gap detection)
- Hash chain verification
- Filtering by action, time range
- Genesis hash: 64 zeros

### Event Bus (`src/gateway/event-bus.ts`)

In-memory publish/subscribe system for decoupled event handling.

Event types:
- `message.received` / `message.sanitized` / `message.processed`
- `session.connected` / `session.disconnected`
- `health.check`
- `audit.entry`
- `system.error` / `system.shutdown`

### Protocol (`src/gateway/protocol.ts`)

Message parsing, validation, and response construction for the WebSocket
protocol. All messages are JSON with `type`, `id`, and `payload` fields.

### Prompt Refiner (`src/prompting/prompt-refiner.ts`)

Deterministic text refinement for operator input. Pure function with no
side effects, no tool access, no authority. Detects intent patterns,
format constraints, and generates clarifying questions for vague prompts.

### CLI (`src/cli/index.ts`)

Command-line interface built with Commander.js. Provides commands for
gateway management, audit operations, system onboarding, and diagnostics.

### Configuration (`src/config/config.ts`)

Layered configuration: defaults -> config file -> environment. Security
settings like `bind_loopback_only` are enforced in code and cannot be
overridden by configuration files.

## Data Flow

1. Client connects via WebSocket to `ws://127.0.0.1:18789`
2. Client sends `inbound_message` with channel, sender, content, trust level
3. Gateway validates the protocol message format
4. Sanitizer processes the content (rate limit, clean, detect patterns)
5. Audit log records `message_received`, `message_sanitized`, and any `suspicious_pattern_detected` events
6. Event bus publishes `message.sanitized` event
7. Subscribed clients receive the sanitized message
8. Client receives an `ack` response with message ID and flags

## Security Boundaries

- **Network**: Loopback only, no remote access
- **Input**: All content sanitized, patterns logged
- **Execution**: No tool calls, no command execution, no eval
- **Storage**: Append-only audit log, tamper-evident
- **Process**: Least privilege, no unnecessary capabilities
