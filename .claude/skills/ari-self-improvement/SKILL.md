---
name: ari-self-improvement
description: Auto-review and enhance ARI's capabilities based on new Anthropic releases, plugins, and best practices
triggers:
  - "improve ari"
  - "update ari skills"
  - "check for new plugins"
  - "ari self review"
  - "enhance ari capabilities"
---

# ARI Self-Improvement System

## Purpose

Continuously monitor, review, and enhance ARI's capabilities by:
1. Tracking new Anthropic releases (API, Claude Code, papers)
2. Auto-reviewing installed plugins for updates
3. Identifying gaps in ARI's skill coverage
4. Suggesting and implementing improvements aligned with ARI's architecture

## When to Use

Activate this skill when:
- User asks to improve or update ARI
- Periodic self-review is needed
- New Anthropic features are released
- ARI encounters capability gaps during operations

## Architecture Alignment

ARI's core invariants that self-improvement MUST respect:
1. **Loopback-Only Gateway** - No external network in runtime
2. **Content ≠ Command** - New skills cannot execute untrusted code
3. **Audit Immutable** - All improvements must be logged
4. **Least Privilege** - New capabilities require approval
5. **Trust Required** - External plugins need verification

## Self-Improvement Workflow

### Phase 1: Intelligence Gathering

```
1. Check Anthropic sources for updates:
   - https://www.anthropic.com/news
   - https://docs.anthropic.com/en/release-notes
   - https://github.com/anthropics/claude-code/releases
   - https://github.com/anthropics/anthropic-sdk-python/releases

2. Scan plugin marketplaces for new/updated plugins:
   - claude-plugins-official
   - trailofbits-security
   - wshobson-agents
   - claude-flow

3. Review ARI's current capabilities vs. requirements
```

### Phase 2: Gap Analysis

Analyze against ARI's technology stack:
- TypeScript 5.3 strict mode
- Vitest testing framework
- Zod schema validation
- Fastify gateway
- EventBus architecture
- SHA-256 hash chain audit
- Six-layer architecture
- Constitutional governance

Identify:
- Missing plugin coverage
- Outdated dependencies
- New security patterns
- Performance improvements
- Testing enhancements

### Phase 3: Improvement Proposal

For each improvement:
1. **Assess alignment** with ARI's ADRs (locked decisions)
2. **Verify security** - no violations of core invariants
3. **Check compatibility** with existing layers
4. **Estimate impact** on stability

Output format:
```markdown
## Proposed Improvement: [Name]

**Category**: [Plugin/Skill/Architecture/Security]
**Priority**: [Critical/High/Medium/Low]
**Affected Layers**: [Kernel/System/Core/Strategic/Execution/Interfaces]

### Description
[What this improvement does]

### Alignment Check
- [ ] Respects loopback-only gateway
- [ ] Maintains content ≠ command principle
- [ ] Preserves audit immutability
- [ ] Follows least privilege
- [ ] Verified trust level

### Implementation Steps
1. [Step 1]
2. [Step 2]

### Rollback Plan
[How to revert if needed]
```

### Phase 4: Implementation (with approval)

Only implement after user approval:
1. Create backup of current state
2. Log improvement to audit trail
3. Implement changes incrementally
4. Run full test suite
5. Verify all invariants still hold

## Tools Used

- **WebSearch**: Find new Anthropic releases
- **WebFetch**: Retrieve plugin updates
- **Bash**: Update plugin configurations
- **Read/Write**: Modify skill files
- **Task**: Delegate complex analysis to agents

## Monitoring Schedule

Recommend running self-improvement review:
- **Weekly**: Plugin update check
- **Bi-weekly**: Anthropic release review
- **Monthly**: Full capability gap analysis
- **On-demand**: When user requests or gaps encountered

## Integration with ARI Governance

All improvements flow through ARI's governance:
1. **Council** - Votes on significant changes
2. **Arbiter** - Validates constitutional compliance
3. **Overseer** - Ensures quality gates pass

## Example Interaction

```
User: "improve ari"

Skill:
1. Checking Anthropic releases since last review...
   - Found: Claude 3.5 Opus performance update
   - Found: New Claude Code hook system

2. Scanning plugin marketplaces...
   - trailofbits-security: 2 new skills available
   - wshobson-agents: Updated security-scanning

3. Gap analysis for ARI v2.0.0...
   - Missing: Vitest-specific testing skill
   - Missing: Zod schema validation skill
   - Outdated: typescript-lsp (new version available)

4. Proposing improvements:
   [Detailed proposals with alignment checks]

Shall I implement these improvements?
```

## Success Criteria

- All improvements pass ARI's quality gates
- No security invariant violations
- Test coverage maintained at 80%+
- Audit trail captures all changes
- User approval obtained before implementation

## Safety Guards

**NEVER**:
- Auto-implement without approval
- Bypass ARI's security layers
- Install unverified plugins
- Modify locked ADRs
- Skip audit logging

**ALWAYS**:
- Verify plugin sources
- Check compatibility first
- Propose before implementing
- Maintain rollback capability
- Log all actions
