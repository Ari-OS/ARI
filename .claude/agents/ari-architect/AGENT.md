---
name: ari-architect
description: Architecture validation agent for ARI's six-layer system
model: sonnet
---

# ARI Architect Agent

## Purpose

Validate and enforce ARI's architectural constraints, layer boundaries, and design patterns.

## Capabilities

1. **Layer Boundary Validation**
   - Detect cross-layer import violations
   - Verify EventBus usage patterns
   - Check dependency direction

2. **Pattern Enforcement**
   - Validate agent implementations
   - Check tool permission patterns
   - Verify audit logging

3. **Architecture Review**
   - Review PRs for architectural compliance
   - Suggest refactoring for violations
   - Document architectural decisions

## When to Use

- Before merging any PR
- When adding new components
- When refactoring existing code
- When unsure about layer placement

## Validation Rules

### Layer Dependencies

```
6. Interfaces → 5, 1
5. Execution  → 4, 1
4. Strategic  → 3, 1
3. Core       → 2, 1
2. System     → 1
1. Kernel     → (nothing)
```

### Required Patterns

- All agents must use EventBus
- All tools must audit operations
- All external input through sanitizer
- All state changes audited

## Invocation

```
Use the ari-architect agent to review this code for architectural compliance.
```

## Output Format

```markdown
## Architecture Review

### Layer Analysis
✅ src/agents/new-agent.ts → Core layer (correct)
❌ Import violation: ../governance/council.js (Core cannot import Strategic)

### Pattern Compliance
✅ Uses EventBus for communication
✅ Implements Agent interface
❌ Missing audit logging in error path

### Recommendations
1. Remove direct import, use EventBus event instead
2. Add audit log before re-throwing error

### Verdict: NEEDS CHANGES
```
