# ARI Merge Specification

## Purpose

This document defines the integration contract between the v3 kernel (TypeScript security infrastructure) and the v12 system layer (context routing, governance, agent orchestration). It establishes boundaries, coupling points, and compatibility requirements for merging the two codebases.

---

## Layer Boundary Rules

### KERNEL Layer (`src/kernel/*`)

**Responsibilities:**
- Gateway: HTTP ingress (loopback-only Fastify server)
- Sanitizer: Injection detection and risk scoring
- Audit: SHA-256 hash-chained tamper-evident logging
- Event Bus: Typed pub/sub for system decoupling
- Config: Zod-validated configuration management

**Ownership:**
- Owns the inbound message pipeline: `receive → sanitize → audit → publish`
- All inbound content is treated as DATA (trust level determined by source)
- No business logic (contexts, governance, agent prompts) belongs in kernel

**Constraints:**
- System layer MUST NOT bypass kernel pipeline
- System layer MUST NOT call gateway routes directly (use EventBus only)
- System layer MUST NOT mutate audit chain (append-only via AuditLogger)
- System layer MUST NOT disable or weaken sanitizer

### SYSTEM Layer (`src/system/*`)

**Responsibilities:**
- Context routing: Load and apply contexts based on message content
- Governance reference: Read-only access to constitutional rules
- Agent orchestration: Future multi-agent coordination (not in initial merge)

**Ownership:**
- Subscribes to kernel events via EventBus
- Routes messages to appropriate contexts after kernel validation
- Logs routing decisions to audit chain (append-only)

**Constraints:**
- MUST subscribe to kernel events only (no direct gateway calls)
- MUST NOT bypass sanitizer or audit pipeline
- MUST NOT modify kernel configuration
- MUST validate all payloads with Zod before processing

### Integration Boundary

**EventBus is the ONLY coupling between kernel and system.**

- System subscribes to kernel events (`message:received`, `message:accepted`, `security:detected`)
- System publishes routing events (`system:routed`) that kernel can optionally audit
- System may request audit logging via `AuditLogger.log()` (append-only)

---

## Integration Contract

### Event Topics

#### Kernel → System Events

**`message:received`**
- **When:** Fired after sanitization + audit, before acceptance
- **Payload:** `Message` (from `src/kernel/types.ts`)
- **Purpose:** Notify system that a new message entered the pipeline

**`message:accepted`**
- **When:** Explicit signal that message passed full kernel pipeline
- **Payload:** `Message` (from `src/kernel/types.ts`)
- **Purpose:** System can safely route this message (all security checks passed)

**`security:detected`**
- **When:** Injection pattern detected by sanitizer
- **Payload:** `SecurityEvent` (from `src/kernel/types.ts`)
- **Purpose:** System may log/alert but MUST NOT retry or bypass

**`gateway:started` / `gateway:stopped`**
- **When:** Gateway lifecycle changes
- **Payload:** `{ timestamp: string, port: number }`
- **Purpose:** System can track kernel availability

#### System → Audit Events

**`system:routed`**
- **When:** System router classified and routed a message
- **Payload:** `{ messageId: string, contextId?: string, route: string, timestamp: string }`
- **Purpose:** Audit trail of routing decisions
- **Note:** Logged via `AuditLogger.log()`, becomes part of hash chain

### Payload Types

All event payloads MUST use types defined in:
- `src/kernel/types.ts` (kernel types: `Message`, `AuditEvent`, `SecurityEvent`, `Config`, `TrustLevel`, `SanitizeResult`)
- `src/system/types.ts` (system types: `RoutingDecision`, `ContextMetadata`, etc.)

All payloads MUST be Zod-validated at boundaries.

---

## Audit Policy

### Kernel Audit Events

- **Every message ingested:** Kernel audits `message_received` event
  - Event type: `message_received`
  - Includes: messageId, content hash, trust level, timestamp
  - Logged before publishing to EventBus

- **Every security event:** Kernel audits via `AuditLogger.logSecurity()`
  - Event type: `security_detected`
  - Includes: threat type, risk score, matched patterns
  - Logged immediately upon detection

### System Audit Events

- **Every route decision:** System audits `system_routed` via `AuditLogger.log()`
  - Event type: `system_routed`
  - Includes: messageId, contextId (if any), route destination
  - System calls `AuditLogger.log()` directly (append-only)

### Immutability Contract

- System layer MUST NOT delete or modify audit entries
- System layer MUST NOT bypass audit logging
- System layer appends only via `AuditLogger.log()`
- Audit chain integrity verification remains kernel responsibility

---

## Config Compatibility

### Existing Config (unchanged)

**`~/.ari/config.json`** (from v3 kernel)
```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 3000
  },
  "audit": {
    "logPath": "~/.ari/audit.log"
  }
}
```

**No changes required** to existing kernel config.

### New Config (system layer)

**`~/.ari/contexts/`** directory
- Purpose: Store context definitions (JSON files per context)
- Created by: `ari onboard init` or `ari context add`

**`~/.ari/contexts/active.json`**
- Purpose: Track currently active contexts
- Schema: `{ activeContexts: string[], lastUpdated: string }`

**`~/.ari/governance/`** directory
- Purpose: Read-only governance rules and constitutional reference
- Created by: `ari onboard init` (copied from docs/v12/GOVERNANCE/)

### Migration

**On first run after merge:**
- `ari onboard init` creates new directories alongside existing ones
- Existing config.json unchanged
- Existing audit.log unchanged (hash chain continues)

---

## Versioning

### Current Version

**2.0.0** (per `package.json`)

*Note: Version was renormalized from 12.0.0 to 2.0.0 during Operation Clarity Protocol for cleaner semver progression (v0.1.0 → v1.0.0 → v2.0.0).*

### This Merge

**Version completed at 2.0.0**
- Rationale: This merge restored the v12 spec's intended scope (system layer)
- v12 spec specified the architecture; v3 implemented kernel only
- Merge completed the v12 specification implementation

### Future Versions

- **2.1.0:** First system layer enhancements beyond spec
- **3.0.0:** Breaking changes to kernel/system contract

---

## "Re" Adapter

**Status:** NOT FOUND IN V12 SOURCES

No specifications or references to "Re" integration exist in v12 documentation.

**Action:** No adapter created. If "Re" integration is required, file a separate specification request with:
- "Re" system capabilities and API
- Integration requirements (events, auth, data model)
- Security/trust model for external system

Placeholder comment in `src/system/integrations/re.ts` (if needed):
```typescript
// "Re" integration: No v12 specification exists.
// See docs/MERGE_SPEC.md for integration requirements.
```

---

## Implementation Order

1. **Create system layer skeleton** (`src/system/router.ts`, `src/system/types.ts`)
2. **Wire router to EventBus** (subscribe to `message:accepted`)
3. **Implement context storage** (`~/.ari/contexts/` directory)
4. **Add routing audit** (publish `system:routed` events)
5. **Add CLI commands** (`ari context list`, `ari governance show`)
6. **Write system layer tests** (routing, context loading, audit integration)
7. **Verify kernel tests unchanged** (22/22 passing)
8. **Update documentation** (README, RESTORE_REPORT.md)

---

## Acceptance Criteria

Merge is complete when:

- [x] System router subscribes to `message:accepted` events
- [x] System router publishes `system:routed` audit events
- [x] Context storage exists at `~/.ari/contexts/`
- [x] CLI command `ari context list` works
- [x] CLI command `ari governance show` works
- [x] All tests pass (187/187 — expanded from 22 kernel-only)
- [x] System layer tests pass (router, context-isolation)
- [x] Audit chain remains valid after system integration
- [x] Documentation reflects merged architecture

---

**Document Status:** Completed
**Date:** 2026-01-27
**Version:** 2.0.0
**Implementation:** Merged via PR #3 (2026-01-27) — all acceptance criteria met. See docs/OVERHAUL_LOG.md for details.
