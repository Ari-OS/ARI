---
name: ari-gap-analyzer
description: Identify gaps in ARI's capabilities, skills, and coverage
---

# ARI Gap Analyzer

## Purpose

Systematically identify gaps in ARI's capabilities, skill coverage, test coverage, and operational readiness.

## Analysis Dimensions

### 1. Skill Coverage

Analyze existing skills against ARI's architecture:

| Layer | Required Skills | Status |
|-------|-----------------|--------|
| Kernel | Security, audit, config | Check |
| System | Routing, storage | Check |
| Agents | Coordination, tools | Check |
| Governance | Council, quality gates | Check |
| Ops | Deployment, monitoring | Check |
| CLI | Command patterns | Check |

### 2. Test Coverage

Check test coverage across critical paths:

```
- Security tests: 100% required
- Kernel tests: 100% required
- Agent tests: 90%+ target
- Integration tests: 80%+ target
- Overall: 80%+ minimum
```

### 3. Documentation Coverage

Verify documentation completeness:

```
- [ ] All public APIs documented
- [ ] Architecture decisions recorded
- [ ] Security model documented
- [ ] Deployment guide complete
- [ ] Troubleshooting guide exists
```

### 4. Operational Readiness

Assess production readiness:

```
- [ ] Monitoring configured
- [ ] Alerting set up
- [ ] Backup procedures defined
- [ ] Recovery tested
- [ ] Performance baselines established
```

## Gap Analysis Process

### Step 1: Inventory

List all current:

- Skills (26+)
- Commands (7+)
- Agents (6+)
- Tests
- Documentation

### Step 2: Map to Requirements

Cross-reference against:

- ARI's architecture layers
- Security requirements
- Operational needs
- User workflows

### Step 3: Identify Gaps

Look for:

- Missing skill coverage
- Untested paths
- Undocumented features
- Operational gaps

### Step 4: Prioritize

Rank gaps by:

- Security impact (highest)
- User impact
- Operational risk
- Development effort

### Step 5: Remediate

For each gap:

1. Create task
2. Assign priority
3. Track completion

## Output Format

```markdown
## Gap Analysis Report

### Summary
- Total gaps identified: X
- Critical: X
- High: X
- Medium: X
- Low: X

### Critical Gaps
| Gap | Area | Impact | Remediation |
|-----|------|--------|-------------|
| ... | ... | ... | ... |

### Coverage Matrix
| Component | Skills | Tests | Docs | Status |
|-----------|--------|-------|------|--------|
| Kernel | Yes | 100% | Yes | OK |
| ... | ... | ... | ... | ... |

### Recommended Actions
1. [Highest priority action]
2. [Second priority action]
...
```
