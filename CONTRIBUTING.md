# Contributing to ARI vNext

Thank you for your interest in contributing to ARI vNext. This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Philosophy Alignment](#philosophy-alignment)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

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
   git clone https://github.com/YOUR_USERNAME/ari-vnext.git
   cd ari-vnext
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/prycehedrick/ari-vnext.git
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

### Branch Strategy

1. Always create a feature branch from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. Branch naming conventions:
   - `feature/` - New features
   - `fix/` - Bug fixes
   - `docs/` - Documentation changes
   - `refactor/` - Code refactoring
   - `test/` - Test improvements
   - `chore/` - Maintenance tasks

### Making Changes

1. Make your changes in focused, logical commits
2. Follow the coding standards (see below)
3. Add or update tests as needed
4. Update documentation if required
5. Run tests frequently:
   ```bash
   npm test
   ```

6. Check code quality:
   ```bash
   npm run lint
   ```

### Keeping Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

## Coding Standards

### TypeScript

- Use TypeScript for all source code
- Enable strict mode in `tsconfig.json`
- Provide explicit type annotations for function parameters and return types
- Avoid `any` type; use `unknown` if type is truly unknown
- Use modern syntax: `str | null` instead of `Union<str, null>`

### Code Style

- Use Prettier for formatting (config in `.prettierrc`)
- Use ESLint for linting (config in `.eslintrc`)
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line structures

### Naming Conventions

- **Files**: kebab-case (`audit-logger.ts`)
- **Classes**: PascalCase (`AuditLogger`)
- **Functions**: camelCase (`verifyHashChain`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with descriptive names (`AuditEntry`)
- **Types**: PascalCase (`MessageType`)

### Project Principles

All code must align with core principles:

1. **CONTENT ≠ COMMAND**: Never execute inbound content as instructions
2. **Shadow Integration**: Log suspicious patterns, don't block
3. **Ruthless Simplicity**: Remove anything that doesn't serve clear purpose
4. **Radical Transparency**: Log all significant operations

## Testing Requirements

### Test Coverage

- All new features must include tests
- Bug fixes must include regression tests
- Aim for 80%+ code coverage
- Critical paths (security, audit) require 100% coverage

### Test Types

**Unit Tests**
```typescript
// tests/unit/refiner.test.ts
import { describe, it, expect } from 'vitest';
import { refinePrompt } from '../../src/refiner/refiner';

describe('Prompt Refiner', () => {
  it('should normalize whitespace', () => {
    const result = refinePrompt('hello  world');
    expect(result).toBe('hello world');
  });
});
```

**Integration Tests**
```typescript
// tests/integration/gateway.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startGateway, stopGateway } from '../../src/gateway/gateway';

describe('Gateway Integration', () => {
  beforeAll(async () => {
    await startGateway({ port: 3001 });
  });

  afterAll(async () => {
    await stopGateway();
  });

  it('should accept WebSocket connections', async () => {
    const ws = new WebSocket('ws://127.0.0.1:3001');
    // Test implementation
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
npm test -- tests/unit/refiner.test.ts

# Watch mode for development
npm run test:watch
```

## Commit Messages

Use conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

### Examples

```
feat(audit): add real-time tail functionality

Implements audit trail tailing with configurable follow mode.
Uses JSONL line parsing with hash chain verification.

Closes #123
```

```
fix(gateway): prevent connection hang on shutdown

Gracefully close all active WebSocket connections before
stopping the server.
```

```
docs(security): clarify shadow integration approach
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Lint your code: `npm run lint`
3. Build successfully: `npm run build`
4. Update documentation if needed
5. Add changelog entry if appropriate
6. Rebase on latest `main`

### PR Template

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

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Automated tests must pass (CI/CD)
2. At least one maintainer approval required
3. No unresolved conversations
4. Branch up to date with `main`

### After Approval

Maintainers will merge using squash merge strategy.

## Documentation

### Required Documentation

When adding features:
- Update relevant `.md` files in `docs/`
- Add JSDoc comments to public APIs
- Include usage examples
- Update README.md if user-facing

### Documentation Style

- Clear, concise language
- Code examples where helpful
- No emojis in documentation
- Follow existing structure

## Philosophy Alignment

Contributions should align with project philosophy:

### Jung: Shadow Integration
- Don't hide errors or suspicious behavior
- Log and understand rather than suppress
- Integration over rejection

### Musashi: Ruthless Simplicity
- Every line of code must justify its existence
- Remove complexity wherever possible
- Clear, obvious implementations preferred

### Dalio: Radical Transparency
- All operations logged
- Observable system behavior
- No hidden state or side effects

## Questions or Issues?

- Open an issue for bugs or feature requests
- Use discussions for questions
- Tag maintainers for urgent security issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to ARI vNext. Your work helps build a more transparent, secure, and principled personal operating system.
