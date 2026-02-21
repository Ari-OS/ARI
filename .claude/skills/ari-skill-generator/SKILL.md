---
name: ari-skill-generator
description: Automatically generate new skills based on identified gaps or needs
---

# ARI Skill Generator

## Purpose

Automatically create new Claude Code skills when gaps are identified or new capabilities are needed.

## When to Use

- After identifying a missing skill
- When a pattern emerges that should be codified
- When new ARI features are added
- When external tools/APIs need integration

## Skill Generation Process

### Phase 1: Analysis

1. Identify the gap or need
2. Research existing patterns
3. Check for similar skills to extend
4. Define scope and boundaries

### Phase 2: Design

1. Define trigger conditions
2. Specify input requirements
3. Design output format
4. Consider edge cases

### Phase 3: Implementation

1. Create SKILL.md file
2. Write comprehensive documentation
3. Include code examples
4. Add ARI-specific context

### Phase 4: Validation

1. Test with real scenarios
2. Verify integration with existing skills
3. Check for conflicts
4. Update skill registry

## Skill Template

```markdown
---
name: ari-[skill-name]
description: [One-line description]
---

# [Skill Name]

## Purpose
[What this skill accomplishes]

## When to Use
[Trigger conditions]

## Process
[Step-by-step guidance]

## ARI Integration
[How it connects to ARI systems]

## Examples
[Usage examples]

## Output Format
[Expected output structure]
```

## Skill Categories

| Category | Purpose | Example Skills |
|----------|---------|----------------|
| Security | Threat detection, hardening | ari-injection-detection |
| Architecture | Design patterns, structure | ari-layer-guardian |
| Testing | Test creation, validation | ari-vitest-guardian |
| Operations | Deployment, monitoring | ari-daemon-ops |
| Integration | External systems | ari-fastify-gateway |
| Self-improvement | Learning, optimization | ari-continuous-improvement |

## Generated Skill Quality Checklist

- [ ] Clear, specific purpose
- [ ] Well-defined trigger conditions
- [ ] Step-by-step process
- [ ] ARI-specific context included
- [ ] Code examples provided
- [ ] Output format specified
- [ ] No overlap with existing skills
- [ ] Follows naming conventions
