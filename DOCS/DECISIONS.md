# ARI KEY DECISIONS
## Design Decisions, Rationale & Trade-offs | V11.0

**Status:** Production Ready  
**Last Updated:** January 26, 2026

---

## PURPOSE

This document records significant design decisions made during ARI development. Each decision includes context, options considered, rationale, and implications.

---

## DECISION LOG

### DEC-001: Trust Model — External Content as Data Only

**Date:** January 2026  
**Status:** Accepted  
**Category:** Security

**Context:**
AI systems are vulnerable to prompt injection attacks where malicious content in untrusted sources (emails, web pages, files) attempts to hijack the model's behavior.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Filter specific patterns | Lower overhead | Arms race, incomplete |
| B | **External = Data only** | Simple, robust | May miss nuance |
| C | Contextual trust scoring | Flexible | Complex, error-prone |

**Decision:** Option B — All external content treated as DATA, never as instructions.

**Rationale:**
- Simple rule is easier to enforce consistently
- No ambiguity about what's allowed
- Defense in depth (other layers add flexibility)
- Matches industry best practices (Constitutional AI, etc.)

**Implications:**
- Cannot follow instructions in emails/web even if legitimate
- User must explicitly relay external instructions
- May seem inflexible but prevents entire class of attacks

**Review Date:** July 2026

---

### DEC-002: Permission Tiers — Four Levels

**Date:** January 2026  
**Status:** Accepted  
**Category:** Security

**Context:**
Need to balance autonomy (let ARI act without constant approval) with safety (prevent unauthorized actions).

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Binary (approve all / approve none) | Simple | Too rigid |
| B | Three tiers | Moderate flexibility | May not be granular enough |
| C | **Four tiers** | Good granularity | Slightly more complex |
| D | Per-tool custom | Maximum flexibility | Hard to maintain |

**Decision:** Option C — Four tiers (READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN)

**Rationale:**
- READ_ONLY: No state change, always safe
- WRITE_SAFE: Reversible writes, low risk
- WRITE_DESTRUCTIVE: Irreversible or external, needs oversight
- ADMIN: System-level, needs governance

**Implications:**
- Each tool must be classified
- Classification may need adjustment over time
- Clear escalation path

**Review Date:** April 2026

---

### DEC-003: Memory System — Provenance Required

**Date:** January 2026  
**Status:** Accepted  
**Category:** Data Integrity

**Context:**
Memory poisoning is a significant risk where false information could corrupt future decisions. Need to track where information comes from.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | No provenance | Simple | No defense against poisoning |
| B | Source only | Basic tracking | Incomplete chain |
| C | **Full provenance chain** | Complete audit trail | More storage, complexity |

**Decision:** Option C — Full provenance with source, trust level, agent, and chain.

**Rationale:**
- Can trace any memory to its origin
- Trust level enables appropriate confidence
- Chain enables derived memory tracking
- Critical for forensics and rollback

**Implications:**
- Every memory write requires provenance
- Storage overhead (~20% more per entry)
- Enables powerful rollback capabilities

**Review Date:** July 2026

---

### DEC-004: Governance — 13-Agent Council

**Date:** January 2026  
**Status:** Accepted  
**Category:** Governance

**Context:**
Want democratic input in major decisions but need to avoid deadlock and ensure accountability.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Single authority (Arbiter only) | Fast decisions | Power concentration |
| B | Small council (5 agents) | Faster consensus | Less diverse input |
| C | **Full council (13 agents)** | All perspectives | Slower, more overhead |
| D | Per-domain councils | Specialized | Fragmented |

**Decision:** Option C — All 13 execution/strategic agents vote, with Arbiter as final authority.

**Rationale:**
- Every domain has voice
- Odd number enables ties to be rare
- Arbiter provides final authority when needed
- Operator can override all

**Implications:**
- Voting overhead for governance changes
- Ensures buy-in across domains
- Arbiter override power must be used sparingly

**Review Date:** July 2026

---

### DEC-005: Storage — SQLite for MVP

**Date:** January 2026  
**Status:** Accepted  
**Category:** Architecture

**Context:**
Need persistent storage for memories, audit logs, and state. Must choose between various database options.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **SQLite** | Simple, local, no server | Limited concurrency |
| B | PostgreSQL | Robust, scalable | Overkill for single user |
| C | MongoDB | Flexible schema | Additional complexity |
| D | File-based JSON | Very simple | No query capability |

**Decision:** Option A — SQLite for MVP deployment.

**Rationale:**
- Single user, single machine = no concurrency issues
- Zero configuration
- Portable (single file)
- Good enough for expected scale
- Easy migration path to PostgreSQL if needed

**Implications:**
- Limited concurrent writes
- Backup is simple (copy file)
- May need to migrate if scaling

**Review Date:** July 2026 (reassess if scaling)

---

### DEC-006: Approval UX — Inline with Diff

**Date:** January 2026  
**Status:** Accepted  
**Category:** UX

**Context:**
When destructive actions need approval, how should we ask the user?

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Simple yes/no | Fast | No visibility |
| B | **Inline diff + options** | Full context | More verbose |
| C | Separate approval queue | Batching possible | Context switching |
| D | GUI popup | Visual | Breaks CLI flow |

**Decision:** Option B — Inline approval with diff preview and multiple options (approve/deny/modify).

**Rationale:**
- User sees exactly what will happen
- Can make informed decision
- Options allow nuanced responses
- Stays in conversation flow

**Implications:**
- Approval messages may be verbose
- User must read before approving
- Good for safety, slightly more friction

**Review Date:** April 2026

---

### DEC-007: Agent Architecture — Prompt-Based

**Date:** January 2026  
**Status:** Accepted  
**Category:** Architecture

**Context:**
How should agents be implemented?

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Hard-coded logic | Fast, deterministic | Inflexible |
| B | **Prompt-based** | Flexible, easy to update | LLM dependency |
| C | Hybrid | Best of both | More complex |
| D | Plugin architecture | Extensible | Overhead |

**Decision:** Option B — Agents defined by prompts, behavior via LLM.

**Rationale:**
- Easy to modify agent behavior
- Natural language specification
- Leverages LLM capabilities
- Quick iteration

**Implications:**
- Depends on LLM quality
- Prompts must be well-crafted
- May have consistency variations
- Cost per interaction

**Review Date:** July 2026

---

### DEC-008: Logging — Append-Only with Hash Chain

**Date:** January 2026  
**Status:** Accepted  
**Category:** Auditability

**Context:**
Audit logs must be tamper-evident for forensics and compliance.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Simple append | Easy | No tamper evidence |
| B | **Hash chain** | Tamper-evident | Slightly complex |
| C | Blockchain | Maximum integrity | Overkill |
| D | Signed entries | Non-repudiation | Key management |

**Decision:** Option B — Append-only logs with hash chain linking entries.

**Rationale:**
- Detects tampering (breaks chain)
- Simple to implement
- No external dependencies
- Good balance of integrity vs. complexity

**Implications:**
- Must verify chain periodically
- Cannot modify past entries
- Corruption detection built-in

**Review Date:** Annual

---

### DEC-009: Secret Handling — Environment Variables

**Date:** January 2026  
**Status:** Accepted  
**Category:** Security

**Context:**
How to store and access API keys and other secrets?

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Config files | Easy access | Risk of exposure |
| B | **Environment variables** | Standard practice | Must set up |
| C | Keychain/Vault | Most secure | Additional complexity |
| D | Encrypted config | Good security | Key management |

**Decision:** Option B — Environment variables for secrets, with optional Keychain integration later.

**Rationale:**
- Industry standard
- Easy to set up
- Not in codebase
- Works with deployment tools

**Implications:**
- Must document env var setup
- Cannot easily rotate without restart
- Keychain integration planned for future

**Review Date:** July 2026

---

### DEC-010: License — MIT

**Date:** January 2026  
**Status:** Accepted  
**Category:** Legal

**Context:**
Need to choose a license for the ARI Foundation codebase.

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Proprietary | Full control | Limited sharing |
| B | **MIT** | Permissive, simple | No copyleft |
| C | Apache 2.0 | Patent protection | More complex |
| D | GPL | Copyleft | Restricts commercial use |

**Decision:** Option B — MIT License

**Rationale:**
- Simple and permissive
- Allows any use
- Widely understood
- Low friction for future options

**Implications:**
- Others can use code freely
- No patent protection (acceptable for this project)
- Standard choice for similar projects

**Review Date:** If commercializing

---

## PENDING DECISIONS

### DEC-011: Multi-User Support

**Status:** Deferred  
**Target Date:** Q3 2026

**Question:** How to support multiple operators?

**Considerations:**
- User isolation
- Authentication
- Shared vs. separate memories
- Permission inheritance

---

### DEC-012: Self-Improvement Boundaries

**Status:** Under Discussion  
**Target Date:** Q2 2026

**Question:** What can ARI modify about itself?

**Considerations:**
- Playbook updates (currently allowed)
- Prompt refinements (requires Arbiter)
- New tools (requires Council + Operator)
- Governance changes (requires full process)

---

## DECISION TEMPLATE

```markdown
### DEC-XXX: [Title]

**Date:** [Date]
**Status:** [Proposed/Accepted/Deprecated]
**Category:** [Security/Architecture/UX/etc.]

**Context:**
[Why this decision is needed]

**Options Considered:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | [Description] | [Pros] | [Cons] |
| B | [Description] | [Pros] | [Cons] |

**Decision:** [Which option and why]

**Rationale:**
[Detailed reasoning]

**Implications:**
[What this means going forward]

**Review Date:** [When to revisit]
```

---

**Document Status:** APPROVED  
**Last Review:** January 26, 2026  
**Next Review:** Ongoing (as decisions are made)
