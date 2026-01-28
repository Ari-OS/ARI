# API Reference

## WebSocket Protocol

ARI vNext uses a JSON-based WebSocket protocol. Connect to
`ws://127.0.0.1:18789` (default port).

All messages are JSON objects with a `type` field and optional `id` and
`payload` fields.

## Client Messages (Client to Server)

### ping

Test connectivity. Server responds with `pong`.

```json
{
  "type": "ping",
  "id": "optional-request-id"
}
```

### inbound_message

Submit a message for processing through the sanitization pipeline.

```json
{
  "type": "inbound_message",
  "id": "msg-001",
  "payload": {
    "channel": "cli",
    "sender": "user@example.com",
    "timestamp": "2026-01-26T12:00:00.000Z",
    "content": "Hello, this is a message.",
    "source_trust_level": "untrusted",
    "attachments": [],
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "metadata": {}
  }
}
```

**Payload fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| channel | string | Yes | One of: cli, sms, whatsapp, telegram, email, web, api, internal |
| sender | string | Yes | Sender identifier (1-512 chars) |
| timestamp | string | Yes | ISO 8601 datetime |
| content | string | Yes | Message content |
| source_trust_level | string | Yes | One of: self, allowlisted, untrusted |
| attachments | array | No | Attachment metadata objects |
| correlation_id | string | No | UUID for request tracing |
| metadata | object | No | Arbitrary key-value pairs |

### sessions_list

Request a list of all active sessions.

```json
{
  "type": "sessions_list",
  "id": "list-001"
}
```

### health

Request system health status.

```json
{
  "type": "health",
  "id": "health-001"
}
```

### subscribe

Subscribe to event types for real-time notifications.

```json
{
  "type": "subscribe",
  "id": "sub-001",
  "payload": "message.sanitized"
}
```

Available event types:
- `message.received`
- `message.sanitized`
- `message.processed`
- `session.connected`
- `session.disconnected`
- `health.check`
- `audit.entry`
- `system.error`
- `system.shutdown`
- `*` (wildcard, all events)

### unsubscribe

Unsubscribe from an event type.

```json
{
  "type": "unsubscribe",
  "id": "unsub-001",
  "payload": "message.sanitized"
}
```

## Server Messages (Server to Client)

### pong

Response to `ping`.

```json
{
  "type": "pong",
  "id": "response-uuid",
  "request_id": "original-ping-id"
}
```

### ack

Acknowledgment of a successfully processed message.

```json
{
  "type": "ack",
  "id": "response-uuid",
  "request_id": "original-request-id",
  "payload": {
    "message_id": "sanitized-message-uuid",
    "flags": {
      "size_truncated": false,
      "rate_limited": false,
      "encoding_fixed": false,
      "control_chars_stripped": false,
      "suspicious_patterns": [],
      "original_size_bytes": 25,
      "final_size_bytes": 25,
      "processing_time_ms": 0.5
    }
  }
}
```

### sessions

Response to `sessions_list` request.

```json
{
  "type": "sessions",
  "id": "response-uuid",
  "request_id": "original-request-id",
  "payload": [
    {
      "id": "session-uuid",
      "connected_at": "2026-01-26T12:00:00.000Z",
      "last_activity": "2026-01-26T12:01:00.000Z",
      "messages_received": 5,
      "subscriptions": ["message.sanitized"]
    }
  ]
}
```

### health_status

Response to `health` request.

```json
{
  "type": "health_status",
  "id": "response-uuid",
  "request_id": "original-request-id",
  "payload": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "connections": 2,
    "audit_sequence": 150,
    "last_message_at": "2026-01-26T12:01:00.000Z",
    "checks": {
      "gateway": { "status": "pass", "message": "WebSocket server running" },
      "audit": { "status": "pass", "message": "Sequence at 150" }
    }
  }
}
```

### error

Error response for invalid or failed requests.

```json
{
  "type": "error",
  "id": "response-uuid",
  "request_id": "original-request-id",
  "error": {
    "code": "PARSE_ERROR",
    "message": "Invalid JSON",
    "details": null
  }
}
```

**Error codes:**

| Code | Description |
|------|-------------|
| PARSE_ERROR | Message could not be parsed as JSON |
| INVALID_MESSAGE | Message payload failed validation |
| INVALID_PAYLOAD | Unexpected payload type |
| SANITIZATION_ERROR | Sanitization pipeline failed |

### event

Real-time event notification (for subscribed clients).

```json
{
  "type": "event",
  "id": "event-uuid",
  "payload": {
    "event_type": "message.sanitized",
    "data": { ... }
  }
}
```

## Audit Log Format

The audit log is stored as newline-delimited JSON (JSONL) at
`~/.ari/audit.jsonl`.

Each line is a complete JSON object:

```json
{
  "sequence": 0,
  "timestamp": "2026-01-26T12:00:00.000Z",
  "action": "gateway_start",
  "actor": { "type": "system", "id": "gateway" },
  "details": { "host": "127.0.0.1", "port": 18789 },
  "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "hash": "a1b2c3..."
}
```

**Action types:**

| Action | Description |
|--------|-------------|
| gateway_start | Gateway server started |
| gateway_stop | Gateway server stopped |
| session_connect | Client connected |
| session_disconnect | Client disconnected |
| message_received | Inbound message received |
| message_sanitized | Message sanitization completed |
| message_rate_limited | Message exceeded rate limit |
| suspicious_pattern_detected | Shadow pattern found in content |
| config_loaded | Configuration loaded from file |
| config_changed | Configuration modified |
| health_check | Health check performed |
| audit_verified | Audit log verification completed |
| audit_verification_failed | Audit verification found issues |
| system_error | System error occurred |
| daemon_installed | launchd daemon installed |
| daemon_uninstalled | launchd daemon removed |
