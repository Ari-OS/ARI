# 📋 CHANGELOG

## ARI Version History

---

# [12.0.0] - 2026-01-26 (Aurora Protocol)

## 🎯 Release Summary

Major upgrade implementing universal Life OS architecture with complete security hardening. This release removes all business-specific content from the kernel, implements comprehensive prompt injection defenses, and establishes formal governance protocols.

## ⚠️ BREAKING CHANGES

- Business content removed from CORE.md (moved to /CONTEXTS/ventures/)
- Context loading is now dynamic, not static
- Memory schema updated with new required fields
- Tool registry now deny-by-default

---

## Patch 1: Business Content Extraction (Universality)

**Status:** ✅ COMPLETE

### Changes

- Removed all personal venture references from CORE.md (lines 309-330)
- Created `/CONTEXTS/ventures/_TEMPLATE.md` for business content
- Created `/CONTEXTS/life/` domain contexts:
  - career.md
  - finance.md
  - health.md
  - admin.md
  - learning.md
  - systems.md
  - family.md
- Updated ROUTER.md with dynamic context loading rules
- Kernel is now 100% business-agnostic

### Acceptance Criteria

- [x] Kernel/system prompts contain ZERO business references
- [x] Context packs exist and are the only place business content lives
- [x] Router never loads venture packs implicitly

---

## Patch 2: Prompt Injection Defense

**Status:** ✅ COMPLETE

### Changes

- Created GUARDIAN.md with Trust Sanitizer layer
- Implemented 6 categories of injection pattern detection
- Added risk scoring system
- Updated Router with first-line injection detection
- Added 4-stage input sanitization pipeline
- Created 20 prompt injection red-team tests

### Acceptance Criteria

- [x] Injection attempts do not trigger tool actions
- [x] Injection attempts do not trigger memory writes
- [x] Injection attempts do not bypass policy
- [x] All 20 injection tests pass

---

## Patch 3: Tool Registry Deny-by-Default

**Status:** ✅ COMPLETE

### Changes

- Created `/CONFIG/tool_registry.json` with deny-by-default policy
- Defined 4 permission tiers: READ_ONLY, WRITE_SAFE, WRITE_DESTRUCTIVE, ADMIN
- Implemented blocked tool-chain detection
- Added verify-before-commit protocol to EXECUTOR.md
- Created 15 tool misuse/privilege escalation tests

### Acceptance Criteria

- [x] Tool execution without allowlist = denied + logged + escalated
- [x] Blocked chains detected and prevented
- [x] All 15 tool tests pass

---

## Patch 4: Hierarchical System Prompts

**Status:** ✅ COMPLETE

### Changes

- Restructured prompt hierarchy:
  - `/SYSTEM/CORE.md` - Kernel identity + invariants
  - `/GOVERNANCE/` - Arbiter, Overseer, Governance rules
  - `/SYSTEM/ROUTER.md` - Classification + context loading
  - `/SYSTEM/PLANNER.md` - Plan generation only
  - `/SYSTEM/EXECUTOR.md` - Tool calling + gating
  - `/SYSTEM/MEMORY_MANAGER.md` - Typed writes + quarantine
  - `/SYSTEM/GUARDIAN.md` - Security enforcement
- Enforced role boundaries (Router can't execute, Planner can't execute)
- Added plan → diff → approve → execute flow

### Acceptance Criteria

- [x] No role confusion / role drift
- [x] Router cannot execute tools
- [x] Planner cannot execute tools
- [x] Executor cannot self-modify policy

---

## Patch 5: Governance Voting Rules

**Status:** ✅ COMPLETE

### Changes

- Created `/GOVERNANCE/GOVERNANCE.md` with complete voting rules
- Defined quorum: Standard (5/9), Significant (7/9), Critical (9/9 unanimous)
- Documented Arbiter scope (blocks policy breaches, cannot override operator)
- Added Overseer release gates and blocking authority
- Created deadlock resolution protocol (4 tiers)
- Added emergency stop and appeal protocols

### Acceptance Criteria

- [x] No ambiguous authority boundaries
- [x] Deadlock is resolvable
- [x] Emergency stop documented

---

## Patch 6: Memory Provenance & Poisoning Defense

**Status:** ✅ COMPLETE

### Changes

- Created `/SCHEMAS/memory_entry.json` with full provenance fields
- Implemented memory partitions:
  - KERNEL (immutable)
  - OPS (procedures)
  - PERSONAL (preferences)
  - VENTURE_{name} (scoped)
  - LIFE_{domain} (domain-specific)
- Added quarantine system for untrusted writes
- Implemented decay/expiry policy
- Added anomaly detection in MEMORY_MANAGER.md
- Created 15 memory poisoning tests

### Acceptance Criteria

- [x] Poisoning attempts never become trusted memory
- [x] Memory can be rolled back via audit log
- [x] All 15 memory tests pass

---

## Patch 7: Tamper-Evident Audit Logging

**Status:** ✅ COMPLETE

### Changes

- Created `/SCHEMAS/event.json` with canonical event schema
- Implemented hash chaining for tamper evidence
- Added previous_hash and sequence_number fields
- Documented backup/restore procedures
- Created verification protocol

### Acceptance Criteria

- [x] Tampering is detectable via hash chain
- [x] All event types covered in schema
- [x] Restore procedure documented

---

## Patch 8: Self-Improvement Governance

**Status:** ✅ COMPLETE

### Changes

- Added self-improvement pipeline to GOVERNANCE.md
- Enforced: proposal → council review → arbiter signoff → merge → regression tests
- Prohibited autonomous policy rewrites
- Required full regression suite before merge
- Added improvement checklist

### Acceptance Criteria

- [x] Self-improvement requires governance
- [x] Regression suite required pre-merge
- [x] No autonomous policy changes

---

## 📊 Security Improvements Summary

| Metric | V11.1 | V12.0 | Improvement |
|--------|-------|-------|-------------|
| Business in kernel | YES | NO | 100% removed |
| Injection defense layers | 1 | 4 | +300% |
| Tool policy | Allow-default | Deny-default | Inverted |
| Memory partitions | 2 | 5+ | +150% |
| Audit hash chaining | NO | YES | New |
| Test coverage | 54 | 70 | +30% |

---

## 🔍 Known Remaining Risks

1. **Model-level jailbreaks** - Mitigated but not eliminated (inherent to LLMs)
2. **Novel attack patterns** - Detection based on known patterns
3. **Social engineering** - Human operator still vulnerable

---

## 📁 Files Changed/Added

### New Files

- `/CONTEXTS/ventures/_TEMPLATE.md`
- `/CONTEXTS/life/*.md` (7 files)
- `/CONTEXTS/README.md`
- `/SYSTEM/CORE.md` (updated)
- `/SYSTEM/ROUTER.md`
- `/SYSTEM/PLANNER.md`
- `/SYSTEM/EXECUTOR.md`
- `/SYSTEM/MEMORY_MANAGER.md`
- `/SYSTEM/GUARDIAN.md`
- `/GOVERNANCE/ARBITER.md`
- `/GOVERNANCE/OVERSEER.md`
- `/GOVERNANCE/GOVERNANCE.md`
- `/SCHEMAS/memory_entry.json`
- `/SCHEMAS/event.json`
- `/CONFIG/tool_registry.json`
- `/TESTS/TEST_SUITE.md`

### Modified Files

- CORE.md (business content removed)

---

## 🔖 Version Tags

- **v12.0.0** - Aurora Protocol release
- **v12.0.0-rc1** - Release candidate

---

# [11.1.0] - 2026-01-25 (Rose Protocol - Secure)

Security hardening release implementing Perplexity audit recommendations.

## Changes

- Added immutable system instructions section
- Implemented injection pattern detection
- Added trust boundary enforcement
- Created permission tier system
- Added verify-before-commit protocol

---

# [11.0.0] - 2026-01-20 (Rose Protocol)

Initial V11 release with multi-agent architecture.

---

*Changelog maintained per Keep a Changelog format*
