---
name: ari-deploy
description: Deploy ARI with full validation pipeline
---

# /ari-deploy

Deploy ARI with comprehensive pre-flight checks.

## Deployment Pipeline

### Phase 1: Validation

```bash
npm run typecheck    # TypeScript compilation
npm run lint         # Code quality
npm test            # Full test suite
npm audit           # Security vulnerabilities
```

### Phase 2: Build

```bash
npm run build        # Compile to dist/
npm run dashboard:build  # Build dashboard
```

### Phase 3: Verification

```bash
npx ari doctor       # System diagnostics
npx ari audit verify # Audit chain integrity
```

### Phase 4: Deployment

```bash
# Install daemon
npx ari daemon install

# Start services
npx ari daemon start
npx ari gateway start
```

### Phase 5: Health Check

```bash
curl http://127.0.0.1:3141/health
npx ari daemon status
```

## Pre-Flight Checklist

- [ ] All tests passing
- [ ] Coverage ≥80%
- [ ] No security vulnerabilities
- [ ] TypeScript compiles clean
- [ ] ESLint passes
- [ ] Audit chain valid
- [ ] Configuration valid

## Rollback

If deployment fails:

```bash
npx ari daemon stop
git checkout <previous-version>
npm ci && npm run build
npx ari daemon start
```

## Usage

Type `/ari-deploy` to start deployment pipeline.
