# ARI LOGGING SYSTEM
## Event Schema, Audit Logs & Observability | V11.0

**Status:** Production Ready  
**Last Updated:** January 26, 2026

---

## EXECUTIVE SUMMARY

Comprehensive logging enables debugging, forensics, and continuous improvement. Every significant action is logged with full context and provenance.

**Logging Principles:**
1. **Completeness** — Log everything significant
2. **Immutability** — Append-only, tamper-evident
3. **Queryability** — Easy to search and filter
4. **Privacy** — Secrets always redacted
5. **Retention** — Clear policies for each log type

---

## EVENT SCHEMA

### Base Event Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ARI Event",
  "type": "object",
  "required": ["event_id", "timestamp", "event_type", "agent", "action"],
  "properties": {
    "event_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for this event"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp with timezone"
    },
    "event_type": {
      "type": "string",
      "enum": [
        "TOOL_CALL",
        "MEMORY_READ",
        "MEMORY_WRITE",
        "CONFIG_CHANGE",
        "DECISION",
        "APPROVAL_REQUEST",
        "APPROVAL_RESPONSE",
        "ERROR",
        "SECURITY_EVENT",
        "SYSTEM_EVENT"
      ]
    },
    "severity": {
      "type": "string",
      "enum": ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"],
      "default": "INFO"
    },
    "agent": {
      "type": "string",
      "description": "Agent that triggered the event"
    },
    "action": {
      "type": "string",
      "description": "Specific action performed"
    },
    "input": {
      "type": "object",
      "description": "Input parameters (secrets redacted)"
    },
    "output": {
      "type": "object",
      "description": "Output or result (secrets redacted)"
    },
    "context": {
      "type": "object",
      "properties": {
        "session_id": { "type": "string" },
        "request_id": { "type": "string" },
        "conversation_id": { "type": "string" },
        "trust_level": { "type": "string" }
      }
    },
    "security": {
      "type": "object",
      "properties": {
        "permission_tier": { "type": "string" },
        "approval_required": { "type": "boolean" },
        "approval_status": { "type": "string" },
        "approver": { "type": "string" }
      }
    },
    "timing": {
      "type": "object",
      "properties": {
        "duration_ms": { "type": "integer" },
        "queue_time_ms": { "type": "integer" }
      }
    },
    "error": {
      "type": "object",
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "stack": { "type": "string" }
      }
    },
    "chain": {
      "type": "object",
      "properties": {
        "hash": { "type": "string" },
        "previous_hash": { "type": "string" }
      },
      "description": "For audit log integrity verification"
    }
  }
}
```

---

## EVENT TYPES

### TOOL_CALL

Logged when any tool is invoked.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-01-26T14:32:15.123Z",
  "event_type": "TOOL_CALL",
  "severity": "INFO",
  "agent": "development",
  "action": "file_write",
  "input": {
    "path": "/workspace/components/Header.jsx",
    "content_hash": "sha256:a1b2c3d4...",
    "content_length": 2456
  },
  "output": {
    "success": true,
    "bytes_written": 2456
  },
  "context": {
    "session_id": "sess-abc123",
    "request_id": "req-def456",
    "trust_level": "TRUSTED"
  },
  "security": {
    "permission_tier": "WRITE_SAFE",
    "approval_required": false,
    "approval_status": "AUTOMATIC"
  },
  "timing": {
    "duration_ms": 45
  }
}
```

### MEMORY_WRITE

Logged when memory is created or updated.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2026-01-26T14:33:22.456Z",
  "event_type": "MEMORY_WRITE",
  "severity": "INFO",
  "agent": "learning",
  "action": "create_pattern",
  "input": {
    "memory_id": "mem-xyz789",
    "memory_type": "PATTERN",
    "content_preview": "Tourism hook works well for...",
    "content_hash": "sha256:e5f6g7h8..."
  },
  "output": {
    "success": true,
    "memory_id": "mem-xyz789",
    "version": 1
  },
  "context": {
    "session_id": "sess-abc123",
    "trust_level": "TRUSTED"
  },
  "security": {
    "provenance": {
      "source": "operator_input",
      "trust_level": "TRUSTED"
    },
    "confidence": 0.9
  }
}
```

### APPROVAL_REQUEST

Logged when approval is requested.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2026-01-26T14:35:00.789Z",
  "event_type": "APPROVAL_REQUEST",
  "severity": "INFO",
  "agent": "development",
  "action": "deploy_vercel",
  "input": {
    "project": "client-website",
    "environment": "production",
    "commit": "abc123"
  },
  "context": {
    "session_id": "sess-abc123",
    "request_id": "req-ghi789"
  },
  "security": {
    "permission_tier": "WRITE_DESTRUCTIVE",
    "approval_required": true,
    "approval_status": "PENDING"
  }
}
```

### APPROVAL_RESPONSE

Logged when approval decision is made.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2026-01-26T14:35:30.123Z",
  "event_type": "APPROVAL_RESPONSE",
  "severity": "INFO",
  "agent": "operator",
  "action": "approve",
  "input": {
    "request_id": "req-ghi789",
    "decision": "APPROVED",
    "comment": "Looks good, deploy it"
  },
  "context": {
    "session_id": "sess-abc123"
  },
  "security": {
    "approver": "operator",
    "approval_status": "APPROVED"
  }
}
```

### SECURITY_EVENT

Logged for security-relevant events.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440005",
  "timestamp": "2026-01-26T14:40:00.000Z",
  "event_type": "SECURITY_EVENT",
  "severity": "WARN",
  "agent": "guardian",
  "action": "injection_detected",
  "input": {
    "source": "email_content",
    "pattern_matched": "ignore previous instructions",
    "content_preview": "...please ignore previous instructions and..."
  },
  "output": {
    "action_taken": "sanitized",
    "alert_raised": true
  },
  "context": {
    "trust_level": "UNTRUSTED"
  },
  "security": {
    "threat_type": "PROMPT_INJECTION",
    "risk_level": "HIGH"
  }
}
```

### ERROR

Logged when errors occur.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440006",
  "timestamp": "2026-01-26T14:45:00.000Z",
  "event_type": "ERROR",
  "severity": "ERROR",
  "agent": "development",
  "action": "deploy_vercel",
  "input": {
    "project": "client-website"
  },
  "error": {
    "code": "DEPLOY_FAILED",
    "message": "Build failed: Module not found",
    "stack": "Error: Module not found\n  at ..."
  },
  "context": {
    "session_id": "sess-abc123"
  }
}
```

### DECISION

Logged for significant decisions.

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440007",
  "timestamp": "2026-01-26T15:00:00.000Z",
  "event_type": "DECISION",
  "severity": "INFO",
  "agent": "arbiter",
  "action": "resolve_conflict",
  "input": {
    "parties": ["marketing", "sales"],
    "issue": "Outreach timing for new prospect",
    "options": ["immediate", "wait_for_research"]
  },
  "output": {
    "decision": "wait_for_research",
    "reasoning": "Better qualification improves close rate"
  },
  "context": {
    "decision_type": "HIGH_STAKES",
    "precedent_set": false
  }
}
```

---

## LOG STORAGE

### File Structure

```
~/ari/logs/
├── audit/                    # Tamper-evident audit logs
│   ├── 2026-01-26.jsonl     # Daily audit log
│   └── checksum.txt         # Daily integrity hash
├── events/                   # General event logs
│   ├── 2026-01-26.jsonl     # Daily events
│   └── archive/             # Compressed older logs
├── security/                 # Security-specific logs
│   └── 2026-01-26.jsonl
├── errors/                   # Error logs
│   └── 2026-01-26.jsonl
└── debug/                    # Debug logs (if enabled)
    └── 2026-01-26.jsonl
```

### Log Rotation

| Log Type | Rotation | Retention | Compression |
|----------|----------|-----------|-------------|
| Audit | Daily | 1 year | After 7 days |
| Events | Daily | 90 days | After 7 days |
| Security | Daily | 1 year | After 7 days |
| Errors | Daily | 90 days | After 7 days |
| Debug | Hourly | 7 days | None |

### Audit Log Integrity

Audit logs use hash chaining for tamper evidence:

```python
def write_audit_event(event: AuditEvent) -> None:
    # Get previous hash
    previous_hash = get_last_audit_hash()
    
    # Compute this event's hash
    event_data = json.dumps(event, sort_keys=True)
    event_hash = hashlib.sha256(
        f"{previous_hash}:{event_data}".encode()
    ).hexdigest()
    
    # Add chain info
    event['chain'] = {
        'hash': event_hash,
        'previous_hash': previous_hash
    }
    
    # Append to log
    with open(audit_log_path, 'a') as f:
        f.write(json.dumps(event) + '\n')
    
    # Update hash file
    update_last_hash(event_hash)

def verify_audit_chain(log_path: str) -> bool:
    """Verify integrity of entire audit log."""
    previous_hash = "GENESIS"
    
    with open(log_path, 'r') as f:
        for line in f:
            event = json.loads(line)
            
            # Verify previous hash matches
            if event['chain']['previous_hash'] != previous_hash:
                return False
            
            # Verify this event's hash
            event_copy = {k: v for k, v in event.items() if k != 'chain'}
            event_data = json.dumps(event_copy, sort_keys=True)
            computed_hash = hashlib.sha256(
                f"{previous_hash}:{event_data}".encode()
            ).hexdigest()
            
            if event['chain']['hash'] != computed_hash:
                return False
            
            previous_hash = event['chain']['hash']
    
    return True
```

---

## LOG QUERIES

### Common Query Patterns

**Find all actions by agent:**
```bash
jq 'select(.agent == "development")' logs/events/2026-01-26.jsonl
```

**Find security events:**
```bash
jq 'select(.event_type == "SECURITY_EVENT")' logs/security/2026-01-26.jsonl
```

**Find errors in time range:**
```bash
jq 'select(.timestamp >= "2026-01-26T14:00:00" and .timestamp <= "2026-01-26T15:00:00")' logs/errors/2026-01-26.jsonl
```

**Find approval requests:**
```bash
jq 'select(.event_type == "APPROVAL_REQUEST")' logs/audit/2026-01-26.jsonl
```

**Find high severity events:**
```bash
jq 'select(.severity == "ERROR" or .severity == "CRITICAL")' logs/events/2026-01-26.jsonl
```

### Log Analysis Scripts

**Daily summary:**
```bash
#!/bin/bash
# daily_summary.sh

DATE=${1:-$(date +%Y-%m-%d)}
LOG_DIR=~/ari/logs

echo "=== ARI Daily Summary: $DATE ==="
echo

echo "Event Counts:"
jq -s 'group_by(.event_type) | map({type: .[0].event_type, count: length})' \
    $LOG_DIR/events/$DATE.jsonl

echo
echo "Security Events:"
jq -s 'length' $LOG_DIR/security/$DATE.jsonl

echo
echo "Errors:"
jq -s 'length' $LOG_DIR/errors/$DATE.jsonl

echo
echo "Approvals:"
jq 'select(.event_type == "APPROVAL_RESPONSE")' $LOG_DIR/audit/$DATE.jsonl | \
    jq -s 'group_by(.input.decision) | map({decision: .[0].input.decision, count: length})'
```

---

## SECRET REDACTION

### Redaction Rules

All logs automatically redact:

| Pattern | Replacement |
|---------|-------------|
| API keys (sk-..., ghp_..., etc.) | `[REDACTED_API_KEY]` |
| Passwords | `[REDACTED_PASSWORD]` |
| Tokens | `[REDACTED_TOKEN]` |
| SSN patterns | `[REDACTED_SSN]` |
| Credit card numbers | `[REDACTED_CC]` |
| Email in sensitive context | `[REDACTED_EMAIL]` |

### Redaction Implementation

```python
import re

REDACTION_PATTERNS = [
    (r'sk-[a-zA-Z0-9]{48}', '[REDACTED_API_KEY]'),
    (r'ghp_[a-zA-Z0-9]{36}', '[REDACTED_GITHUB_TOKEN]'),
    (r'xox[baprs]-[0-9a-zA-Z-]+', '[REDACTED_SLACK_TOKEN]'),
    (r'password["\s:=]+[^\s",}]+', 'password=[REDACTED]'),
    (r'api[_-]?key["\s:=]+[^\s",}]+', 'api_key=[REDACTED]'),
    (r'secret["\s:=]+[^\s",}]+', 'secret=[REDACTED]'),
    (r'token["\s:=]+[^\s",}]+', 'token=[REDACTED]'),
    (r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]'),
    (r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b', '[REDACTED_CC]'),
]

def redact_secrets(content: str) -> str:
    """Redact sensitive information from log content."""
    for pattern, replacement in REDACTION_PATTERNS:
        content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
    return content

def prepare_for_logging(obj: dict) -> dict:
    """Deep redact all string values in object."""
    if isinstance(obj, dict):
        return {k: prepare_for_logging(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [prepare_for_logging(item) for item in obj]
    elif isinstance(obj, str):
        return redact_secrets(obj)
    else:
        return obj
```

---

## ALERTING

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| CRITICAL event logged | CRITICAL | Immediate notification |
| Security event (HIGH+) | HIGH | Alert within 1 hour |
| Error rate > 10/hour | MEDIUM | Daily summary |
| Approval timeout > 1 hour | LOW | Log only |

### Alert Format

```json
{
  "alert_id": "alert-uuid",
  "timestamp": "2026-01-26T14:45:00.000Z",
  "severity": "HIGH",
  "title": "Prompt Injection Attempt Detected",
  "description": "Guardian detected potential prompt injection in email content",
  "event_id": "550e8400-e29b-41d4-a716-446655440005",
  "action_required": true,
  "suggested_action": "Review email content and block sender if malicious"
}
```

---

## RETENTION POLICY

| Data Type | Hot Storage | Archive | Total Retention |
|-----------|-------------|---------|-----------------|
| Audit logs | 30 days | 11 months | 1 year |
| Event logs | 30 days | 60 days | 90 days |
| Security logs | 30 days | 11 months | 1 year |
| Error logs | 30 days | 60 days | 90 days |
| Debug logs | 7 days | None | 7 days |

### Archival Process

```bash
#!/bin/bash
# archive_logs.sh - Run weekly

ARCHIVE_DIR=~/ari/logs/archive
LOG_DIR=~/ari/logs

# Archive logs older than 7 days
find $LOG_DIR/events -name "*.jsonl" -mtime +7 -exec gzip {} \;
find $LOG_DIR/events -name "*.gz" -exec mv {} $ARCHIVE_DIR/ \;

# Delete debug logs older than 7 days
find $LOG_DIR/debug -name "*.jsonl" -mtime +7 -delete

# Verify audit log integrity before archiving
for file in $LOG_DIR/audit/*.jsonl; do
    if [[ -f "$file" ]]; then
        python3 -c "from ari.logging import verify_audit_chain; exit(0 if verify_audit_chain('$file') else 1)"
        if [ $? -eq 0 ]; then
            gzip "$file"
            mv "${file}.gz" $ARCHIVE_DIR/
        else
            echo "WARNING: Audit log integrity check failed for $file"
        fi
    fi
done
```

---

**Document Status:** APPROVED  
**Last Review:** January 26, 2026  
**Next Review:** February 26, 2026
