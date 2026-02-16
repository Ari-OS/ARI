# Front Door Gap Analysis

**Date**: 2026-01-28
**Status**: Analysis Complete
**Branch**: `overhaul/frontdoor-canon-20260128`

---

## Executive Summary

This document analyzes the gap between ARI's **repo truth** (what the code actually does) and the **public-facing documentation** (what the README and docs claim). The goal is to ensure perfect alignment between claims and reality.

---

## Canonical Truth Established

### What ARI IS

**ARI is a Life Operating System** — a local-first, multi-agent personal OS that orchestrates AI agents to manage life domains (health, career, finances, ventures, personal growth) with security as its foundation.

**Evidence from code:**
- `README.md`: "Your Life Operating System", "ARI orchestrates AI agents to manage your life"
- `package.json`: "Secure Multi-Agent Personal OS"
- `CLAUDE.md`: "Description: Your Life Operating System"

### What ARI IS NOT

- A security tool (security is foundation, not purpose)
- A chatbot or conversational AI
- A cloud-dependent service
- A productivity app

---

## Current README Analysis

### Strengths

1. **Correct identity**: Already positions as "Life Operating System"
2. **Philosophy section**: Jung, Dalio, Musashi philosophy is present
3. **Architecture diagram**: 6-layer architecture is documented
4. **CLI reference**: All 8 commands documented
5. **API reference**: All endpoints listed

### Gaps Identified

| Gap | Severity | Description |
|-----|----------|-------------|
| PRESENT vs ROADMAP | High | No distinction between what works now vs aspirational |
| Security positioning | Medium | Security is a feature section, not positioned as foundational |
| Architecture accuracy | Low | Diagram is accurate but could show data flow better |
| Quickstart verification | Medium | Commands not verified against current state |

---

## Core Invariants (Verified in Code)

These are the non-negotiable security properties enforced by the codebase:

### 1. Loopback-Only Gateway
**Location**: `src/kernel/gateway.ts:20`
```typescript
await this.app.listen({ port: this.port, host: '127.0.0.1' });
```
**Status**: ✅ Enforced — hardcoded, not configurable

### 2. Content ≠ Command
**Location**: `src/kernel/sanitizer.ts`
**Status**: ✅ Enforced — 39 injection patterns, binary accept/reject

### 3. Audit Immutable
**Location**: `src/kernel/audit.ts`
**Status**: ✅ Enforced — SHA-256 hash chain from genesis

### 4. Least Privilege
**Location**: `src/agents/executor.ts`
**Status**: ✅ Enforced — 3-layer permission checks

### 5. Trust Required
**Location**: `src/kernel/types.ts`
**Status**: ✅ Enforced — 6 trust levels with risk multipliers

---

## Capability Matrix

### PRESENT (Implemented and Working)

| Layer | Component | Status | Notes |
|-------|-----------|--------|-------|
| Kernel | Gateway | ✅ Complete | Fastify, loopback-only |
| Kernel | Sanitizer | ✅ Complete | 42 patterns, 14 categories |
| Kernel | Audit | ✅ Complete | SHA-256 hash chain |
| Kernel | EventBus | ✅ Complete | Typed pub/sub |
| Kernel | Config | ✅ Complete | Zod-validated |
| System | Router | ✅ Complete | Context-based routing |
| System | Storage | ✅ Complete | Context management |
| Agents | Core | ✅ Complete | Orchestration logic |
| Agents | Guardian | ✅ Complete | Threat assessment |
| Agents | Planner | ✅ Complete | DAG task decomposition |
| Agents | Executor | ✅ Complete | Tool execution |
| Agents | Memory | ✅ Complete | Provenance tracking |
| Governance | Council | ✅ Complete | 15-member voting |
| Governance | Arbiter | ✅ Complete | 6 constitutional rules |
| Governance | Overseer | ✅ Complete | 5 quality gates |
| CLI | Commands | ✅ Complete | 8 commands |
| Dashboard | UI | ✅ Complete | React 19 + Vite |

### ROADMAP (Aspirational)

| Feature | Status | Notes |
|---------|--------|-------|
| Real file operations | 🔮 Future | Tool implementations are mocks |
| Disk persistence | 🔮 Future | Memory is in-memory only |
| ML threat detection | 🔮 Future | Pattern matching only |
| Weighted voting | 🔮 Future | Equal votes only |
| Vote delegation | 🔮 Future | No proxy voting |
| Auto-remediation | 🔮 Future | Manual only |

---

## Required Changes

### High Priority

1. **Add PRESENT/ROADMAP distinction to README**
   - Create clear sections for what works now vs future
   - Be honest about mock implementations

2. **Reposition security as foundation**
   - Move from "Security" section to "Foundation" or integrate into architecture
   - Emphasize security is architectural, not feature

### Medium Priority

3. **Verify quickstart commands**
   - Test each command in fresh environment
   - Update any broken commands

4. **Add identity documentation**
   - BRAND.md — Voice, values, aesthetic
   - X_PROFILE.md — Social presence
   - IMAGE_PROMPTS.md — Visual identity

### Low Priority

5. **Update architecture diagram**
   - Show data flow more clearly
   - Add invariant indicators

---

## Success Criteria

- [ ] README accurately reflects repo truth
- [ ] PRESENT vs ROADMAP clearly distinguished
- [ ] Security positioned as foundation
- [ ] All docs point to single source of truth
- [ ] Identity system is coherent and repo-derived
- [ ] All tests pass, lint clean, typecheck clean
- [ ] No runtime behavior changes

---

## Next Steps

1. Create identity documentation (BRAND.md, X_PROFILE.md, IMAGE_PROMPTS.md)
2. Create RUNBOOK_MAC.md operations guide
3. Rewrite README for canon alignment
4. Verify all quickstart commands work
5. Run full verification suite

---

**Analysis completed by ARI Architect**
