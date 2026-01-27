---
name: Feature Request
about: Suggest a new feature or enhancement for ARI
title: "[FEATURE] "
labels: enhancement
---

## Problem Statement

A clear and concise description of the problem or need this feature would address.

## Proposed Solution

A clear and concise description of what you want to happen.

## Life OS Alignment

Which ARI principle does this align with?

- [ ] Shadow Integration (Jung) - Logging and understanding rather than suppression
- [ ] Radical Transparency (Dalio) - Auditability and observability
- [ ] Ruthless Simplicity (Musashi) - Removing complexity or clarifying behavior
- [ ] Other (explain below)

**Explanation**:

## Architecture Layer Affected

Which layer(s) would this feature affect?

- [ ] Kernel (gateway, sanitizer, audit, event bus)
- [ ] System (router, storage)
- [ ] Core (agents: Core, Guardian, Planner, Executor, Memory Manager)
- [ ] Strategic (governance: Council, Arbiter, Overseer)
- [ ] Execution (ops: daemon)
- [ ] Interfaces (CLI)

## Security Considerations

Does this feature have security implications?

- [ ] Yes (describe below)
- [ ] No

**Security Impact**:
- Does it handle user input? How will it be sanitized?
- Does it modify audit logs? How will integrity be maintained?
- Does it require new permissions? What trust level is required?
- Does it communicate externally? How will loopback-only be preserved?

## Alternatives Considered

A clear and concise description of any alternative solutions or features you've considered.

## Benefits

Describe how this feature would benefit users or the project:

- **User benefit**: How does this improve the operator experience?
- **System benefit**: How does this improve ARI's capabilities?
- **Alignment**: How does this strengthen ARI's principles?

## Additional Context

Add any other context, mockups, code examples, or references about the feature request here.
