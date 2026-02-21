---
name: ari-think
description: Deep reasoning mode for complex ARI problems
---

# /ari-think

Engage deep reasoning mode to solve complex problems in ARI.

## When to Use

- Architectural decisions with trade-offs
- Security vulnerabilities analysis
- Performance optimization strategies
- Multi-agent coordination issues
- Constitutional compliance questions

## Thinking Framework

### 1. Problem Definition

- What exactly is the problem?
- What are the constraints?
- What does success look like?

### 2. Context Gathering

- Relevant code and architecture
- Past decisions and their rationale
- ARI's invariants and ADRs

### 3. Option Generation

- Generate multiple solutions
- Consider unconventional approaches
- Think from different perspectives

### 4. Trade-off Analysis

| Option | Pros | Cons | Risk |
|--------|------|------|------|
| A | ... | ... | ... |
| B | ... | ... | ... |

### 5. Recommendation

- Recommended approach
- Implementation steps
- Validation criteria

## Example Usage

```
/ari-think How should we implement cross-agent memory sharing while maintaining trust boundaries?
```

## Output Format

```markdown
## Deep Analysis: [Problem]

### Understanding
[Detailed problem breakdown]

### Context
[Relevant architecture and constraints]

### Options Considered

#### Option 1: [Name]
- Approach: ...
- Pros: ...
- Cons: ...
- Risk: Low/Medium/High

#### Option 2: [Name]
...

### Trade-off Matrix
| Criteria | Option 1 | Option 2 | Option 3 |
|----------|----------|----------|----------|
| Security | ✅ | ⚠️ | ✅ |
| Performance | ⚠️ | ✅ | ✅ |
| Complexity | ✅ | ✅ | ⚠️ |

### Recommendation
[Recommended option with reasoning]

### Implementation Plan
1. Step one
2. Step two
3. ...

### Validation
- How to verify success
- Tests to write
- Metrics to track
```
