# 📐 DECISIONS

## Architectural Decisions & Tradeoffs

**Version:** 12.0.0  
**Last Updated:** 2026-01-26

---

## Decision Log Format

Each decision follows this format:

- **ID**: Unique identifier
- **Date**: When decided
- **Status**: ACCEPTED | SUPERSEDED | DEPRECATED
- **Context**: Why this decision was needed
- **Decision**: What was decided
- **Consequences**: Positive and negative outcomes
- **Alternatives Considered**: What else was evaluated

---

# ACCEPTED DECISIONS

## DEC-001: Universal Kernel Architecture

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

V11.1 CORE.md contained hardcoded business content (venture details, pricing, sales rules). This violated the "Universal Life OS" requirement and limited reusability.

### Decision

Remove ALL business-specific content from kernel. Create modular context packs loaded dynamically based on operator intent.

### Consequences

**Positive:**

- Kernel is reusable for any venture
- Clean separation of concerns
- Easier to add/remove ventures
- Reduced cognitive load on system

**Negative:**

- Slightly more complex routing logic
- Context loading adds small latency
- More files to maintain

### Alternatives Considered

1. **Multi-tenant kernel** - Rejected: Too complex, security risks
2. **Business as configuration** - Rejected: Still pollutes kernel
3. **Separate kernel per venture** - Rejected: Duplication nightmare

---

## DEC-002: Deny-by-Default Tool Policy

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

V11.1 had implicit tool permissions. Any tool could potentially be called without explicit policy check.

### Decision

Implement strict deny-by-default tool registry. Only explicitly allowlisted tools can be executed.

### Consequences

**Positive:**

- Dramatically reduced attack surface
- Clear audit trail
- Explicit permission requirements
- Prevents unknown tool abuse

**Negative:**

- More configuration overhead
- New tools require explicit addition
- Potential for blocking legitimate tools initially

### Alternatives Considered

1. **Allow-by-default with blocklist** - Rejected: Too risky, misses new threats
2. **Permission per agent** - Rejected: Too granular, maintenance burden
3. **Runtime approval only** - Rejected: Too slow for routine operations

---

## DEC-003: Four-Tier Permission Model

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Need graduated permission levels that balance security with usability.

### Decision

Implement four tiers: READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN

### Consequences

**Positive:**

- Clear escalation path
- Appropriate friction for risk level
- Easy to understand and enforce
- Matches common security models

**Negative:**

- Some edge cases don't fit cleanly
- Tier assignment requires judgment
- May need sub-tiers eventually

### Alternatives Considered

1. **Binary (read/write)** - Rejected: Too coarse, all writes equal
2. **Role-based (RBAC)** - Rejected: Overkill for single-operator system
3. **Capability tokens** - Rejected: Too complex for current needs

---

## DEC-004: Memory Quarantine by Default for External Sources

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Memory poisoning is a significant long-term threat. External content could inject false facts or malicious instructions disguised as memories.

### Decision

All memory writes from EXTERNAL sources go to quarantine by default. Requires operator approval to activate.

### Consequences

**Positive:**

- Prevents automatic poisoning
- Creates review checkpoint
- Maintains memory integrity
- Audit trail for all writes

**Negative:**

- Additional approval overhead
- Delays in memory updates
- May frustrate if too aggressive

### Alternatives Considered

1. **Trust all sources equally** - Rejected: Primary attack vector
2. **Confidence-based auto-approve** - Rejected: Gameable
3. **Agent-level trust** - Rejected: Agents can be manipulated

---

## DEC-005: Hash Chain Audit Logging

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Need tamper-evident logging for security and compliance.

### Decision

Implement hash chaining where each event includes hash of previous event, creating tamper-evident chain.

### Consequences

**Positive:**

- Tampering is detectable
- Full audit trail
- Cryptographic integrity
- Industry standard approach

**Negative:**

- Slightly more complex logging
- Chain must be maintained carefully
- Recovery from corruption harder

### Alternatives Considered

1. **Simple append-only log** - Rejected: No tamper detection
2. **Blockchain** - Rejected: Overkill, adds dependencies
3. **Signed individual entries** - Rejected: Doesn't detect deletions

---

## DEC-006: Context Loading by Router (Not Pre-loaded)

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Need to load appropriate context without polluting every interaction with irrelevant information.

### Decision

Router determines context needs based on operator intent and loads minimal relevant contexts dynamically.

### Consequences

**Positive:**

- Reduced noise in responses
- Clear context boundaries
- Memory efficient
- Venture isolation maintained

**Negative:**

- Routing logic must be accurate
- Potential for missing context
- Small latency for context loading

### Alternatives Considered

1. **Load all contexts always** - Rejected: Noisy, slow, leaky
2. **Operator manual selection** - Rejected: Friction, error-prone
3. **Predictive preloading** - Rejected: Complexity, speculation

---

## DEC-007: Separate Governance Documents (Not Inline)

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Governance rules need to be clear, auditable, and separately maintainable from core functionality.

### Decision

Create dedicated `/GOVERNANCE/` directory with ARBITER.md, OVERSEER.md, and GOVERNANCE.md files.

### Consequences

**Positive:**

- Clear separation of concerns
- Easier to audit governance
- Independent versioning possible
- Reference documentation

**Negative:**

- More files to maintain
- Must keep synchronized
- Potential for inconsistency

### Alternatives Considered

1. **Inline in CORE.md** - Rejected: Too long, hard to find
2. **Single governance file** - Rejected: Roles deserve separation
3. **Database-driven** - Rejected: Overkill, less transparent

---

## DEC-008: Markdown-Based Configuration (Not JSON/YAML Only)

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

System prompts and documentation need to be human-readable, versionable, and editable.

### Decision

Use Markdown for prompts and documentation, JSON for schemas and machine-readable config.

### Consequences

**Positive:**

- Human readable
- Git-friendly diffs
- Easy to edit
- Self-documenting

**Negative:**

- Less strict than pure JSON
- Parsing if needed is more complex
- Formatting matters

### Alternatives Considered

1. **All JSON** - Rejected: Hard to read/write prompts
2. **All YAML** - Rejected: Whitespace issues, less common
3. **Database** - Rejected: Loses version control benefits

---

## DEC-009: No UI Console in V12.0 Core

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

Master spec mentions optional UI console. Need to decide scope for V12.0.

### Decision

V12.0 focuses on core security hardening. UI console deferred to V12.1 or later.

### Consequences

**Positive:**

- Faster V12.0 delivery
- Reduced scope creep
- Core functionality prioritized
- Can design UI with V12 learnings

**Negative:**

- Less visibility initially
- Manual log inspection required
- Operator experience less polished

### Alternatives Considered

1. **Include full UI** - Rejected: Scope creep, delays core
2. **Minimal CLI dashboard** - Considered: May add later
3. **Third-party integration** - Rejected: Dependency risk

---

## DEC-010: Single Operator Model (Not Multi-Tenant)

**Date:** 2026-01-26  
**Status:** ACCEPTED

### Context

ARI is designed for personal use by a single operator.

### Decision

Maintain single-operator model. No multi-user, no multi-tenant, no shared access.

### Consequences

**Positive:**

- Simpler security model
- No user management overhead
- Clear ownership
- Faster development

**Negative:**

- Can't share with others easily
- Would need major rework for teams
- Limited collaboration

### Alternatives Considered

1. **Multi-user from start** - Rejected: Premature complexity
2. **Guest read-only** - Rejected: Still adds auth complexity
3. **Delegated agents** - Future consideration

---

# ASSUMPTIONS

## ASM-001: Claude as Runtime

ARI is designed to run as a Claude Project with knowledge base. Prompts are optimized for Claude's behavior.

## ASM-002: Mac Mini Deployment

Primary deployment target is operator's Mac Mini. Scripts and setup instructions are macOS-focused.

## ASM-003: GitHub as Source Control

Repository lives at github.com/ARI-OS/ARI. All version control via Git.

## ASM-004: Operator is Technical

Operator has technical background (CS degree, IT experience). Documentation assumes technical literacy.

## ASM-005: English Primary Language

All prompts, documentation, and interfaces are in English. No i18n in V12.0.

---

# TRADEOFFS

## TRD-001: Security vs. Speed

**Choice:** Security  
**Impact:** Some operations slower due to approval requirements

## TRD-002: Completeness vs. Ship Date

**Choice:** Ship with core features  
**Impact:** UI console and some polish deferred

## TRD-003: Flexibility vs. Simplicity

**Choice:** Simplicity where possible  
**Impact:** Some edge cases not perfectly handled

## TRD-004: Documentation vs. Implementation

**Choice:** Both, documentation-first for clarity  
**Impact:** More upfront work, but clearer maintenance

---

# FUTURE CONSIDERATIONS

1. **UI Console** - Visual dashboard for monitoring and approvals
2. **Multi-venture isolation** - Stronger boundaries between ventures
3. **Automated testing harness** - Beyond manual test suite
4. **Backup encryption** - At-rest encryption for sensitive data
5. **Rate limiting refinement** - More granular limits based on usage patterns

---

*Decision log maintained per ADR (Architecture Decision Record) format*
