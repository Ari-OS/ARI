---
name: ari-evolve
description: Trigger ARI self-improvement cycle
---

# /ari-evolve

Trigger a comprehensive self-improvement cycle for ARI.

## What This Command Does

### 1. Gap Analysis

Run comprehensive gap analysis:

- Skill coverage gaps
- Test coverage gaps
- Documentation gaps
- Operational gaps

### 2. Knowledge Synthesis

Process recent learnings:

- Extract patterns from recent sessions
- Codify decisions made
- Document gotchas discovered
- Store insights permanently

### 3. Skill Generation

Create missing skills:

- Generate skills for identified gaps
- Update existing skills with new patterns
- Improve skill documentation

### 4. Capability Assessment

Evaluate current capabilities:

- Run test suite
- Check security coverage
- Validate architecture compliance
- Measure performance baselines

### 5. Improvement Plan

Create improvement roadmap:

- Prioritize gaps
- Estimate effort
- Track progress

## Evolution Cycle

```
┌─────────────────────────────────────────────────────────┐
│                    /ari-evolve                           │
├─────────────────────────────────────────────────────────┤
│  1. ANALYZE                                              │
│     └── Gap Analyzer → Identify weaknesses              │
│                                                          │
│  2. SYNTHESIZE                                           │
│     └── Knowledge Synthesizer → Extract learnings       │
│                                                          │
│  3. GENERATE                                             │
│     └── Skill Generator → Create missing skills         │
│                                                          │
│  4. VALIDATE                                             │
│     └── Test + Security checks → Verify improvements    │
│                                                          │
│  5. REPORT                                               │
│     └── Evolution report → Document changes             │
└─────────────────────────────────────────────────────────┘
```

## Output Format

```markdown
## ARI Evolution Report

### Gap Analysis
- Gaps found: X
- Critical: X
- Addressed: X

### Knowledge Synthesized
- Patterns extracted: X
- Decisions documented: X
- Gotchas captured: X

### Skills Generated/Updated
- New skills: [list]
- Updated skills: [list]

### Validation Results
- Tests: X passing
- Coverage: X%
- Security: X checks passed

### Next Evolution Cycle
Recommended focus areas:
1. [Area 1]
2. [Area 2]
```

## Usage

Type `/ari-evolve` to trigger the self-improvement cycle.

Options:

- `/ari-evolve analyze` - Gap analysis only
- `/ari-evolve synthesize` - Knowledge synthesis only
- `/ari-evolve generate` - Skill generation only
- `/ari-evolve full` - Complete cycle (default)
