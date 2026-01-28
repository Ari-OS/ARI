# Engineering Principles

ARI vNext synthesizes three philosophical frameworks into concrete
engineering principles.

## Carl Jung: Shadow Integration

### The Principle

Jung taught that the unconscious "shadow" -- the parts of ourselves we
reject or deny -- doesn't disappear when ignored. Suppression makes
the shadow stronger and less predictable. Integration through
acknowledgment leads to wholeness and resilience.

### Applied to Code

**Shadow pattern detection** is the most direct application. When the
sanitizer detects suspicious patterns in inbound content (injection
attempts, role manipulation, prompt extraction), it does not block
or suppress them. Instead:

1. Patterns are **logged** in the audit trail with full detail
2. The content **passes through** unchanged
3. Operators can **review** and understand threats
4. The system becomes **more transparent**, not less

This works because of the CONTENT != COMMAND invariant. Since content
cannot execute anything, blocking it serves no security purpose and
creates false positives. Logging it provides intelligence.

### Other Applications

- Error states are logged and surfaced, never swallowed silently
- The audit trail records everything, including uncomfortable truths
- System behavior is observable, not hidden behind abstractions

## Miyamoto Musashi: Ruthless Simplicity

### The Principle

In "The Book of Five Rings," Musashi wrote: "Do nothing that is of
no use." His approach to swordsmanship eliminated all unnecessary
movement. Every action served a purpose. Mastery meant knowing what
to remove, not what to add.

### Applied to Code

**No feature without justification.** Phase 1 includes exactly what
is needed for a secure foundation and nothing more:

- No AI agent execution (Phase 2)
- No external API calls
- No memory/knowledge base
- No multi-node support
- No database -- files are sufficient
- No authentication (loopback-only makes it unnecessary)

**Durable primitives over clever abstractions:**

- Hash chains use standard SHA-256, not custom cryptography
- Configuration uses JSON files, not a database
- The event bus is in-memory, not a message queue
- Audit logs are JSONL, human-readable with standard tools

**No wasted motion in the code:**

- Each module has a single, clear responsibility
- Dependencies are minimal and well-justified
- The type system prevents invalid states at compile time
- Error handling uses Result types instead of exceptions

### Other Applications

- File structure mirrors the architecture (no indirection)
- Configuration has sensible defaults (works out of the box)
- The CLI surface is small and focused

## Ray Dalio: Radical Transparency

### The Principle

Dalio's "Principles" argues that organizations work best when
information flows freely, decisions are documented with their
reasoning, and truth is valued over comfort. Believability-weighted
decision making ensures the best ideas win.

### Applied to Code

**The audit log is the primary expression of radical transparency.**
Every significant operation is recorded:

- Gateway start/stop
- Session connect/disconnect
- Messages received and sanitized
- Suspicious patterns detected
- Configuration changes
- Health checks
- System errors

The hash chain makes the audit trail tamper-evident. You cannot
rewrite history without detection.

**Explicit invariants enforced in code:**

- `bind_loopback_only: z.literal(true)` -- the schema itself
  prevents false values
- Security enforcement in `loadConfig()` overrides any user
  configuration
- The `doctor` command provides a verification loop

**Observable system behavior:**

- Structured JSON logging (Pino) makes every log entry parseable
- Health checks expose internal state
- Sanitization flags document exactly what processing was applied
- Event bus enables monitoring of all system activity

### Other Applications

- Error messages are specific and actionable
- Configuration is documented with its reasoning
- The type system makes constraints visible in the code

## Synthesis

These three frameworks reinforce each other:

| Decision | Jung | Musashi | Dalio |
|----------|------|---------|-------|
| Log suspicious patterns, don't block | Integrate the shadow | No wasted motion (blocking is pointless given CONTENT != COMMAND) | Transparent about what we see |
| Append-only hash chain | Cannot suppress history | Simple, durable primitive | Tamper-evident record |
| Loopback-only binding | -- | Eliminate attack surface | Explicit about boundaries |
| Result types over exceptions | Surface errors, don't hide | No control flow overhead | Transparent error handling |
| No Phase 2 features in Phase 1 | -- | Do nothing of no use | -- |
| Structured logging | -- | Standard format, parseable | Observable behavior |

The result is a system that is secure not through obscurity or
restriction, but through transparency, simplicity, and self-awareness.
