# Testing Rules

## Framework

Vitest — fast, TypeScript-native, ESM support

## Coverage

- Overall: 80%+ required
- Security paths: 100% required (`kernel/sanitizer`, `agents/guardian`, `governance/arbiter`)
- New features: Must include tests
- Bug fixes: Must include regression tests

## File Location

```
tests/unit/[layer]/[component].test.ts
tests/integration/[feature].test.ts
tests/security/[attack-vector].test.ts
```

## Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Component', () => {
  beforeEach(() => { /* setup */ });

  it('should handle expected case', () => {
    expect(result).toBe('expected');
  });

  it('should throw on invalid input', () => {
    expect(() => fn('')).toThrow();
  });
});
```

## Commands

```bash
npm test                     # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm test -- tests/security/ # Security only
```
