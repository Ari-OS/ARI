---
name: ari-secure
description: Run comprehensive security audit on ARI
---

# /ari-secure

Run a comprehensive security audit on ARI's codebase.

## What This Command Does

### 1. Static Analysis

- Run ESLint security rules
- Check for hardcoded secrets
- Scan for vulnerable patterns

### 2. Dependency Audit

```bash
npm audit
```

### 3. Injection Pattern Validation

- Verify all 27 injection patterns are tested
- Check sanitizer coverage is 100%

### 4. Trust Level Verification

- Validate trust multipliers
- Check permission boundaries

### 5. Audit Trail Integrity

- Verify hash chain from genesis
- Check for tampering

### 6. Constitutional Compliance

- Validate all 5 Arbiter rules
- Check layer boundaries

## Security Checklist Output

```markdown
## ARI Security Audit Report

### Static Analysis
- [ ] No hardcoded secrets
- [ ] No unsafe code patterns
- [ ] No dangerous function usage

### Dependencies
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities

### Injection Defense
- [ ] All 42 patterns tested
- [ ] Sanitizer 100% coverage
- [ ] Risk scoring calibrated

### Trust System
- [ ] 6 levels configured
- [ ] Multipliers correct
- [ ] Auto-block at 0.8

### Audit Trail
- [ ] Chain valid from genesis
- [ ] No gaps detected
- [ ] Hash verification passed

### Constitutional
- [ ] Loopback-only enforced
- [ ] Content ≠ Command
- [ ] Least privilege
```

## Usage

Type `/ari-secure` to run full security audit.
