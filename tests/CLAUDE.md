# Test Conventions

Testing with Vitest for ARI's 80%+ coverage requirement.

## Structure

```
tests/
├── unit/           # Component tests (~3,500 tests total)
│   ├── kernel/     # sanitizer, audit, event-bus
│   ├── system/     # router, context-loader
│   ├── agents/     # core, guardian, executor, planner, memory
│   ├── governance/ # council, arbiter, overseer, policy-engine
│   ├── cli/        # CLI command tests (cognitive, etc.)
│   └── api/        # API route tests
├── integration/    # Full pipeline tests (cognitive-pipeline, learning-loop)
└── security/       # Injection defense tests (cognitive-injection, model-routing)
```

## Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component } from '../../src/layer/component.js';

describe('Component', () => {
  let component: Component;
  let mockDependency: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDependency = vi.fn();
    component = new Component(mockDependency);
  });

  describe('methodName', () => {
    it('should handle expected case', () => {
      const result = component.method('input');
      expect(result).toBe('expected');
    });

    it('should throw on invalid input', () => {
      expect(() => component.method('')).toThrow();
    });
  });
});
```

## Coverage Requirements

| Path | Requirement |
|------|-------------|
| `kernel/sanitizer.ts` | 100% |
| `kernel/audit.ts` | 100% |
| `agents/guardian.ts` | 100% |
| `governance/arbiter.ts` | 100% |
| All other files | 80%+ |

## Running Tests

```bash
npm test                 # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

## Security Tests

Security paths require explicit testing of all attack vectors.
Test each of the 27 injection patterns in sanitizer.ts.

Example pattern:
```typescript
describe('Sanitizer injection defense', () => {
  it('should detect template injection', () => {
    expect(sanitizer.detect('${SECRET}')).toBe(true);
  });

  it('should detect script tags', () => {
    expect(sanitizer.detect('<script>bad</script>')).toBe(true);
  });
});
```

Skills: `/ari-vitest-guardian`, `/ari-testing-strategies`
