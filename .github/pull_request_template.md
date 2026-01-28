## Description

Brief description of changes.

Fixes # (issue)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement

## Layer Impact

Select all ARI layers affected by this change:

- [ ] **Kernel** (security-critical: gateway, sanitizer, audit, eventbus)
- [ ] **System** (router, storage)
- [ ] **Agents** (core, guardian, planner, executor, memory)
- [ ] **Governance** (council, arbiter, overseer)
- [ ] **Ops** (daemon)
- [ ] **CLI/API** (commands, routes)
- [ ] **Dashboard** (React UI)
- [ ] **Tests**
- [ ] **Documentation**

## Security Considerations

- [ ] This change does NOT affect security invariants
- [ ] This change affects security and has been reviewed for:
  - [ ] Loopback-only gateway preservation
  - [ ] Content ≠ Command principle
  - [ ] Audit chain integrity
  - [ ] Least privilege enforcement
  - [ ] Trust level handling

## Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Layer dependency rules respected
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format

## Testing Instructions

1.
2.
3.

## Additional Notes

Add any additional notes, screenshots, or context here.
