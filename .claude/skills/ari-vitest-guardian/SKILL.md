---
name: ari-vitest-guardian
description: Vitest-specific testing skill for ARI's 80%+ coverage requirement and security path testing
triggers:
  - "run tests"
  - "test ari"
  - "check coverage"
  - "test security paths"
---

# ARI Vitest Guardian

## Purpose

Ensure ARI maintains its testing requirements:

- 80%+ overall code coverage
- 100% coverage on security paths (kernel/sanitizer, agents/guardian, governance/arbiter)
- All new features include tests
- Bug fixes include regression tests

## ARI Test Structure

```
tests/
├── unit/                # Component tests
│   ├── kernel/          # sanitizer, audit, event-bus (100% required)
│   ├── system/          # router
│   ├── agents/          # core, guardian, executor, planner, memory-manager
│   └── governance/      # council, arbiter, overseer (100% required)
├── integration/         # Full pipeline tests
└── security/            # Injection defense tests (100% required)
```

## Commands

```bash
npm test              # Run all 187+ tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Workflow

### When Running Tests

1. Execute `npm test` via Bash
2. Parse Vitest output for failures
3. If security tests fail → CRITICAL priority
4. If coverage drops below 80% → Block commit
5. Report results with file:line references

### When Writing New Tests

Follow ARI's test structure:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Component } from '../../src/layer/component.js';

describe('Component', () => {
  let component: Component;

  beforeEach(() => {
    component = new Component();
  });

  describe('featureName', () => {
    it('should handle expected case', () => {
      const result = component.method('input');
      expect(result).toBe('expected');
    });
  });
});
```

## Security Path Testing

These paths require 100% coverage:

| Path | File | Critical Functions |
|------|------|-------------------|
| Sanitizer | src/kernel/sanitizer.ts | sanitize(), detectInjection() |
| Guardian | src/agents/guardian.ts | assessThreat(), calculateRisk() |
| Arbiter | src/governance/arbiter.ts | validateConstitutional() |
| Audit | src/kernel/audit.ts | log(), verifyChain() |

## Integration with CI

ARI uses GitHub Actions for CI. Tests must pass before merge.
