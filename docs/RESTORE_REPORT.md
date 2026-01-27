# ARI Restoration Report

## Executive Summary

This document records the merge between v12 (Aurora Life OS specification) and v3 (Kagemusha kernel implementation). v12 defined product scope and architecture as markdown specifications. v3 implemented a TypeScript kernel with security primitives. This restoration brings v12's constitutional multi-agent OS vision into alignment with v3's executable kernel.

---

## Section 1: v12 Promises (grounded)

The following capabilities were specified in v12 documentation:

- **Constitutional multi-agent OS with 13 agents across 4 layers** [docs/v12/SYSTEM/CORE.md]
  - Layers: Core (CORE, ROUTER, PLANNER), Execution (EXECUTOR, MEMORY_MANAGER), Security (GUARDIAN, OVERSEER, ARBITER), Integration (KNOWLEDGE_NAVIGATOR, CONTEXT_WEAVER, VENTURE_STEWARD, DOCUMENT_SAGE, LIFE_COORDINATOR)

- **Five Pillars: Operator Primacy, Radical Honesty, Bounded Autonomy, Continuous Improvement, Graceful Limitation** [docs/v12/SYSTEM/CORE.md]
  - Constitutional framework enforced by ARBITER

- **4-tier trust model: Operator(0), System(1), Agent(2), External(3)** [docs/v12/SYSTEM/CORE.md]
  - Used for risk scoring and permission determination

- **Dynamic context loading: ventures (explicit mention) + 7 life domains (topic detection)** [docs/v12/CONTEXTS/README.md]
  - Domains: Professional, Financial, Health, Relationships, Growth, Creative, Practical

- **Governance: 9-member council voting, Arbiter authority, Overseer quality gates** [docs/v12/GOVERNANCE/GOVERNANCE.md]
  - Constitutional amendments require council consensus
  - ARBITER has veto authority on constitutional violations

- **4-tier permission model: READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN** [docs/v12/SYSTEM/EXECUTOR.md]
  - Tool execution gated by permission level
  - WRITE_DESTRUCTIVE requires explicit operator confirmation

- **Memory management with quarantine, provenance, partitioning, decay** [docs/v12/SYSTEM/MEMORY_MANAGER.md]
  - Untrusted content quarantined before integration
  - Provenance tracking for all memory entries
  - Time-decay for low-trust content

- **6-layer security: Router scan, Guardian sanitize, Memory quarantine, Executor verify, Overseer gate, Arbiter constitutional** [docs/v12/SYSTEM/GUARDIAN.md]
  - Defense-in-depth security model
  - Each layer blocks specific threat classes

- **Hash-chained tamper-evident audit logging** [docs/v12/SCHEMAS/event.json]
  - SHA-256 hash chain linking all audit events
  - Immutable audit trail for forensic analysis

- **Deny-by-default tool registry with rate limiting and blocked chains** [docs/v12/CONFIG/tool_registry.json]
  - 11 tools defined with explicit permissions
  - Dangerous command chains blocked (rm -rf, sudo, etc.)

- **70 security tests defined (20 injection, 15 memory, 15 tool, 20 regression)** [docs/v12/TESTS/TEST_SUITE.md]
  - Comprehensive security test matrix
  - Injection, boundary, privilege, bypass tests

- **Universal kernel: zero business content in SYSTEM/** [docs/v12/GOVERNANCE/ARBITER_SIGNOFF_V12.md]
  - SYSTEM/ layer contains no ventures, contexts, or personal data
  - Pure infrastructure suitable for any Life OS deployment

- **"Re" integration: NOT FOUND IN V12 sources**
  - No specifications or references to "Re" adapter exist in v12 documentation

**NOTE:** v12 is specification-only (markdown + JSON schemas). No executable code exists in v12 deliverables.

---

## Section 2: v3 Kernel Provides (grounded)

The following infrastructure was implemented in v3:

- **TypeScript kernel with strict mode, ES2022 target, NodeNext modules** [tsconfig.json]
  - Strict null checks, no implicit any, exact optional properties

- **Zod-validated types: TrustLevel, Message, AuditEvent, SecurityEvent, Config, SanitizeResult** [src/kernel/types.ts]
  - Runtime validation for all kernel boundaries
  - Trust levels: 0 (Operator), 1 (System), 2 (Agent), 3 (External)

- **Injection sanitizer: 21 regex patterns across 6 categories, trust-weighted risk scoring** [src/kernel/sanitizer.ts]
  - Categories: Command injection, SQL injection, XSS, Path traversal, Code execution, SSRF
  - Risk threshold: 0.7 for trusted sources (≤1), 0.3 for untrusted (≥2)

- **SHA-256 hash-chained audit logger: genesis block, chain verification, security event logging** [src/kernel/audit.ts]
  - Immutable hash chain with `previousHash` linking
  - Genesis block initialization
  - Chain integrity verification

- **Typed event bus: 8 event types, pub/sub with error isolation** [src/kernel/event-bus.ts]
  - Events: `gateway:started`, `gateway:stopped`, `message:received`, `message:accepted`, `message:rejected`, `security:detected`, `config:updated`, `audit:entry`
  - Subscribers isolated from each other's errors

- **Fastify gateway: loopback-only (127.0.0.1 hardcoded), /health, /status, /message endpoints** [src/kernel/gateway.ts]
  - Security: Host binding locked to localhost
  - POST /message: inbound pipeline (sanitize → audit → publish)
  - GET /health: liveness check
  - GET /status: audit chain summary

- **Config management: ~/.ari/ directory, JSON config with Zod validation** [src/kernel/config.ts]
  - Default port 3000, loopback host, ~/.ari/audit.log path
  - Config reloading with validation

- **CLI: Commander-based with gateway, audit, doctor, onboard commands** [src/cli/]
  - `ari gateway start/stop/status`: Gateway lifecycle
  - `ari audit verify/tail`: Audit chain operations
  - `ari doctor check`: Health diagnostics
  - `ari onboard init`: First-run setup

- **22 passing vitest tests across 3 test files** [tests/]
  - `tests/sanitizer.test.ts`: 11 tests (injection detection, trust scoring)
  - `tests/audit.test.ts`: 7 tests (hash chain, integrity)
  - `tests/event-bus.test.ts`: 4 tests (pub/sub, isolation)

- **Pipeline enforced: inbound_message → sanitize → record_audit → publish_event** [src/kernel/gateway.ts]
  - POST /message handler enforces this sequence
  - No bypass paths exist

---

## Section 3: Regressions / Missing vs v12

The following v12-specified capabilities are not present in v3:

- [ ] **No governance layer** (v12 defines council voting, Arbiter, Overseer)
  - v12 specifies: 9-member council, constitutional voting, Arbiter veto authority
  - v3 status: Governance entirely absent

- [ ] **No context system** (v12 defines dynamic context loading with ventures + life domains)
  - v12 specifies: 7 life domains, venture-specific contexts, topic detection routing
  - v3 status: No context loading or routing logic

- [ ] **No SYSTEM/ prompts in repo** (v12 defines CORE, ROUTER, PLANNER, EXECUTOR, MEMORY_MANAGER, GUARDIAN)
  - v12 specifies: 13 agent prompts with roles, responsibilities, constraints
  - v3 status: No agent prompts present in src/

- [ ] **No schemas for memory entries or events beyond kernel types** (v12 defines JSON schemas)
  - v12 specifies: Schemas for memories, contexts, governance events
  - v3 status: Only kernel types (Message, AuditEvent) exist

- [ ] **No tool registry configuration** (v12 defines deny-by-default with 11 tools)
  - v12 specifies: tool_registry.json with permissions, rate limits, blocked chains
  - v3 status: No tool registry implementation

- [ ] **No Life OS documentation** (README describes only kernel, not product vision)
  - v12 specifies: Life OS vision, Five Pillars, constitutional framework
  - v3 status: README documents kernel only

- [ ] **v12 test suite not wired** (70 tests defined in markdown, only 22 kernel tests executable)
  - v12 specifies: TEST_SUITE.md with 70 security tests
  - v3 status: Only kernel unit tests (22 tests) are executable

- [ ] **No context CLI commands** (v12 implies context management)
  - v12 specifies: Context loading and routing as core capability
  - v3 status: No `ari context` commands exist

- [ ] **No governance CLI commands** (v12 defines governance as read-only reference)
  - v12 specifies: Governance visibility for operator
  - v3 status: No `ari governance` commands exist

---

## Acceptance Checklist

Restoration is complete when:

- [ ] v12 sources restored in docs/v12/
- [ ] Forensic report generated
- [ ] System layer skeleton exists (src/system/)
- [ ] Context storage operational (~/.ari/contexts/)
- [ ] System router subscribes to kernel events with audit proof
- [ ] CLI: `ari context list` works
- [ ] CLI: `ari governance show` works
- [ ] All existing kernel tests pass (22/22)
- [ ] New system layer tests pass
- [ ] Documentation reflects merged truth (RESTORE_REPORT.md, MERGE_SPEC.md)
- [ ] Git commits are logical and PR-ready

---

**Document Status:** Draft
**Date:** 2026-01-27
**Version:** 12.0.0-restore
