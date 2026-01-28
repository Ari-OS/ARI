---
name: ari-release-management
description: Version management, releases, and deployment for ARI
triggers:
  - "release"
  - "version bump"
  - "deploy"
  - "changelog"
---

# ARI Release Management

## Purpose

Manage ARI's versioning, releases, and deployment lifecycle.

## Versioning (SemVer)

ARI follows Semantic Versioning: `MAJOR.MINOR.PATCH`

| Type | When to Bump | Example |
|------|--------------|---------|
| MAJOR | Breaking changes to API/CLI | 2.0.0 → 3.0.0 |
| MINOR | New features, backward compatible | 2.0.0 → 2.1.0 |
| PATCH | Bug fixes, security patches | 2.0.0 → 2.0.1 |

## Release Checklist

```markdown
## Pre-Release Checklist

### Code Quality
- [ ] All tests passing (npm test)
- [ ] Coverage ≥80% (npm run test:coverage)
- [ ] TypeScript compiles (npm run typecheck)
- [ ] ESLint passes (npm run lint)
- [ ] No security vulnerabilities (npm audit)

### Security
- [ ] Security paths have 100% coverage
- [ ] Audit trail integrity verified
- [ ] All 21 injection patterns tested
- [ ] Trust level system validated

### Documentation
- [ ] CHANGELOG.md updated
- [ ] README.md current
- [ ] CLAUDE.md updated
- [ ] API docs generated

### Governance
- [ ] Council approval for MAJOR/MINOR
- [ ] Arbiter constitutional check passed
- [ ] Overseer quality gates passed

### Final Steps
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] GitHub release created
- [ ] npm publish (if applicable)
```

## Release Workflow

```bash
# 1. Ensure clean state
git status  # Should be clean
npm test    # All passing

# 2. Update version
npm version patch  # or minor/major

# 3. Update CHANGELOG
# Add release notes manually

# 4. Create release commit
git add CHANGELOG.md
git commit --amend --no-edit

# 5. Push with tags
git push origin main --tags

# 6. Create GitHub release
gh release create v2.0.1 --notes "Release notes..."
```

## Changelog Format

```markdown
# Changelog

All notable changes to ARI are documented here.

## [2.1.0] - 2026-01-28

### Added
- New injection pattern detection for prompt injection
- WebSocket support for real-time dashboard

### Changed
- Improved Guardian agent threat assessment algorithm
- Optimized audit chain verification performance

### Fixed
- Memory leak in long-running sessions
- Race condition in multi-agent coordination

### Security
- Updated trust level multipliers for better calibration
- Added rate limiting to gateway

## [2.0.0] - 2026-01-15

### Breaking Changes
- Restructured six-layer architecture
- New EventBus API
```

## Automated Checks

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Test
        run: |
          npm ci
          npm test
          npm run test:coverage

      - name: Verify Security
        run: |
          npm audit
          npm run test -- tests/security/

      - name: Build
        run: npm run build

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*
          generate_release_notes: true
```

## Rollback Procedure

```bash
# 1. Identify last good version
git log --oneline --tags

# 2. Checkout previous version
git checkout v2.0.0

# 3. Rebuild
npm ci && npm run build

# 4. Restart daemon
npx ari daemon restart

# 5. Verify
npx ari doctor
npx ari audit verify
```

## Version Constraints

- Node.js: ≥20.0.0 (specified in package.json engines)
- TypeScript: ^5.3.0
- Vitest: ^1.1.0
- Zod: ^3.22.0

## Pre-Release Testing

```bash
# Full test suite
npm test

# Coverage verification
npm run test:coverage

# Security tests specifically
npm test -- tests/security/

# Integration tests
npm test -- tests/integration/

# Audit chain verification
npx ari audit verify

# System diagnostics
npx ari doctor
```
