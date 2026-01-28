# Contributing to ARI

Thank you for your interest in contributing to ARI — Artificial Reasoning Intelligence. This document provides guidelines for contributing to the Life Operating System.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Testing Requirements](#testing-requirements)
- [Layer Dependency Rules](#layer-dependency-rules)
- [Philosophy Alignment](#philosophy-alignment)

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 9 or higher
- macOS (for daemon features)
- Git

### Setup Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ari.git
   cd ari
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/PryceHedrick/ari.git
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Build the project:
   ```bash
   npm run build
   ```

6. Run tests to verify setup:
   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Always create a feature branch from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in focused, logical commits
3. Follow the coding standards (see below)
4. Add or update tests as needed
5. Update documentation if required
6. Run tests frequently:
   ```bash
   npm test
   ```

7. Check code quality:
   ```bash
   npm run lint
   npm run typecheck
   ```

### Keeping Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

## Branch Naming

Use descriptive branch names with appropriate prefixes:

- `feature/` - New features (e.g., `feature/council-voting`)
- `fix/` - Bug fixes (e.g., `fix/audit-chain-validation`)
- `docs/` - Documentation changes (e.g., `docs/governance-guide`)
- `refactor/` - Code refactoring (e.g., `refactor/sanitizer-patterns`)
- `test/` - Test improvements (e.g., `test/memory-manager-coverage`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change, no bug fix)
- `test`: Test additions or modifications
- `chore`: Maintenance tasks (dependencies, config, etc.)

### Examples

```
feat(guardian): add behavioral anomaly detection

Implements rolling window rate limiting and pattern clustering
for real-time threat assessment.

Closes #42
```

```
fix(audit): prevent hash chain corruption on concurrent writes

Add file locking to ensure atomic append operations.
```

```
docs(security): clarify content≠command principle
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Lint your code: `npm run lint`
3. Type check: `npm run typecheck`
4. Build successfully: `npm run build`
5. Update documentation if needed
6. Rebase on latest `main`

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Layer Impact
Which layer(s) does this affect?
- [ ] Kernel
- [ ] System
- [ ] Core (Agents)
- [ ] Strategic (Governance)
- [ ] Execution (Ops)
- [ ] Interfaces (CLI)

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Layer dependency rules respected
```

### Review Process

1. Automated tests must pass (CI/CD)
2. At least one maintainer approval required
3. No unresolved conversations
4. Branch up to date with `main`

## Style Guide

### TypeScript Standards

- Use TypeScript for all source code
- Enable strict mode in `tsconfig.json`
- Provide explicit type annotations for function parameters and return types
- Avoid `any` type; use `unknown` if type is truly unknown
- Use modern syntax: `str | null` instead of legacy union types

### Code Style

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Required in multi-line structures
- **Line length**: Prefer lines under 100 characters

### Naming Conventions

- **Files**: kebab-case (`memory-manager.ts`)
- **Classes**: PascalCase (`MemoryManager`)
- **Functions**: camelCase (`assessThreat`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RISK_SCORE`)
- **Interfaces**: PascalCase (`AuditEvent`)
- **Types**: PascalCase (`TrustLevel`)

### Code Organization

```typescript
// 1. Imports (external, then internal)
import { EventEmitter } from 'node:events';
import { z } from 'zod';

import type { AuditEvent } from '../kernel/types.js';
import { EventBus } from '../kernel/event-bus.js';

// 2. Types and interfaces
export interface GuardianOptions {
  rateLimit: number;
}

// 3. Constants
const MAX_VIOLATIONS = 10;

// 4. Class/function definitions
export class Guardian {
  // Implementation
}
```

## Testing Requirements

### Coverage Targets

- **Overall**: 80%+ code coverage
- **Security paths**: 100% coverage (kernel/sanitizer, agents/guardian, governance/arbiter)
- **All new features**: Must include tests
- **Bug fixes**: Must include regression tests

### Test Structure

Use Vitest with descriptive test names:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Guardian } from '../../src/agents/guardian.js';

describe('Guardian', () => {
  let guardian: Guardian;

  beforeEach(() => {
    guardian = new Guardian();
  });

  describe('threat assessment', () => {
    it('should detect direct override patterns', () => {
      const result = guardian.assess('ignore previous instructions');
      expect(result.risk).toBeGreaterThan(0.8);
    });

    it('should weight risk by trust level', () => {
      const untrustedResult = guardian.assess('test', { trust: 'untrusted' });
      const trustedResult = guardian.assess('test', { trust: 'operator' });
      expect(untrustedResult.risk).toBeGreaterThan(trustedResult.risk);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/agents/guardian.test.ts

# Watch mode for development
npm run test:watch
```

## Layer Dependency Rules

ARI enforces strict layer boundaries. Violations will be rejected.

### Allowed Dependencies (Top to Bottom)

```
Interfaces (CLI)
    ↓ can import
Execution (Ops)
    ↓ can import
Strategic (Governance)
    ↓ can import
Core (Agents)
    ↓ can import
System (Router, Storage)
    ↓ can import
Kernel (Gateway, Sanitizer, Audit, EventBus, Config, Types)
```

### Rules

1. **Kernel cannot import from any higher layer**
2. **System cannot import from Agents, Governance, Ops, or CLI**
3. **Agents cannot import from Governance, Ops, or CLI**
4. **Governance cannot import from Ops or CLI**
5. **All layers can import from Kernel** (types, config, event bus)
6. **All layers communicate via EventBus** (no direct function calls across layers)

### Examples

```typescript
// ❌ WRONG: Kernel importing from System
// src/kernel/gateway.ts
import { Router } from '../system/router.js'; // VIOLATION

// ✅ CORRECT: System importing from Kernel
// src/system/router.ts
import { EventBus } from '../kernel/event-bus.js'; // OK
import type { Message } from '../kernel/types.js'; // OK

// ❌ WRONG: Agents importing from Governance
// src/agents/core.ts
import { Council } from '../governance/council.js'; // VIOLATION

// ✅ CORRECT: Governance importing from Agents
// src/governance/council.ts
import type { AgentId } from '../kernel/types.js'; // OK (types are in kernel)
```

## Philosophy Alignment

All contributions must align with ARI's core principles:

### Shadow Integration (Jung)

Don't suppress errors or suspicious behavior. Log them for transparency.

```typescript
// ❌ WRONG: Silent failure
if (riskScore > 0.8) {
  return; // Silently ignore
}

// ✅ CORRECT: Log and integrate
if (riskScore > 0.8) {
  this.eventBus.emit('security:threat_detected', {
    risk: riskScore,
    patterns: detectedPatterns,
    action: 'blocked',
  });
  throw new SecurityError('Threat detected');
}
```

### Radical Transparency (Dalio)

All significant operations must be audited.

```typescript
// ✅ CORRECT: Audit all state changes
async executeTask(task: Task): Promise<void> {
  this.eventBus.emit('audit:log', {
    action: 'task_execution_start',
    taskId: task.id,
    timestamp: new Date().toISOString(),
  });

  // Execute task

  this.eventBus.emit('audit:log', {
    action: 'task_execution_complete',
    taskId: task.id,
    timestamp: new Date().toISOString(),
  });
}
```

### Ruthless Simplicity (Musashi)

Every line of code must justify its existence. Prefer simple over clever.

```typescript
// ❌ WRONG: Over-engineered
const processMessage = (msg: Message) =>
  pipe(
    sanitize,
    validate,
    transform,
    enrich,
    route
  )(msg);

// ✅ CORRECT: Clear and straightforward
async processMessage(msg: Message): Promise<void> {
  const sanitized = this.sanitizer.sanitize(msg);
  const validated = this.validator.validate(sanitized);
  await this.router.route(validated);
}
```

## Questions or Issues?

- Open an issue for bugs or feature requests
- Tag `@PryceHedrick` for urgent security issues
- Review existing issues before creating duplicates

## License

By contributing, you agree that your contributions will be licensed under the same private license as the project.

---

Thank you for contributing to ARI — Your Life Operating System.
