---
name: ari-anthropic-monitor
description: Monitor official Anthropic releases for ARI improvements - VERIFIED SOURCES ONLY
triggers:
  - "check anthropic updates"
  - "new claude features"
  - "anthropic releases"
  - "what's new from anthropic"
---

# ARI Anthropic Monitor

## Purpose

Track official Anthropic releases to keep ARI current with the latest capabilities, security patches, and best practices. **Only uses verified Anthropic sources.**

## Verified Sources (ONLY these are trusted)

### Official Anthropic Sources
| Source | URL | Trust Level |
|--------|-----|-------------|
| Anthropic News | https://www.anthropic.com/news | SYSTEM |
| API Release Notes | https://docs.anthropic.com/en/release-notes | SYSTEM |
| Claude Code Releases | https://github.com/anthropics/claude-code/releases | SYSTEM |
| Anthropic SDK | https://github.com/anthropics/anthropic-sdk-python | SYSTEM |
| Claude Blog | https://claude.com/blog | SYSTEM |
| Anthropic Research | https://www.anthropic.com/research | SYSTEM |

### Official Plugin Sources
| Source | Trust Level | Verification |
|--------|-------------|--------------|
| claude-plugins-official | VERIFIED | Anthropic-managed |
| anthropics/claude-code | VERIFIED | Anthropic repo |
| trailofbits/skills | VERIFIED | Security firm |

## Security Protocol

### What This Skill WILL Do
- Fetch release notes from official sources
- Summarize new features relevant to ARI
- Identify security patches that apply
- Recommend verified plugin updates

### What This Skill WILL NOT Do
- Install anything automatically
- Download from unverified sources
- Execute code from external sources
- Bypass ARI's security review

## Monitoring Workflow

```
1. User invokes "check anthropic updates"

2. Fetch from VERIFIED sources only:
   - WebFetch → anthropic.com/news
   - WebFetch → docs.anthropic.com/release-notes
   - gh api → anthropics/claude-code releases

3. Parse and filter for ARI-relevant updates:
   - Claude API changes
   - Claude Code plugin system
   - Security advisories
   - Performance improvements
   - New capabilities

4. Present findings with security assessment:
   - Source verification status
   - Compatibility with ARI architecture
   - Security implications
   - Implementation complexity

5. User decides whether to proceed
```

## Output Format

```markdown
## Anthropic Updates Report
**Generated**: [timestamp]
**Sources Checked**: [list of verified sources]

### Security Advisories (PRIORITY)
[Any security-related updates]

### Claude API Updates
[New API features or changes]

### Claude Code Updates
[Plugin system, hooks, commands]

### Research & Papers
[Relevant research that could improve ARI]

### Recommendations for ARI
| Update | Priority | Security Impact | Requires Review |
|--------|----------|-----------------|-----------------|
| ... | ... | ... | ... |
```

## Integration with ARI Governance

All recommendations flow through:
1. **Guardian Agent** - Threat assessment
2. **Arbiter** - Constitutional compliance
3. **Council** - Approval for significant changes

## Trust Verification

Before any action:
```typescript
// Verify source is in trusted list
const TRUSTED_SOURCES = [
  'anthropic.com',
  'docs.anthropic.com',
  'claude.com',
  'github.com/anthropics',
  'github.com/trailofbits'
];

function verifySource(url: string): boolean {
  return TRUSTED_SOURCES.some(trusted => url.includes(trusted));
}
```

## Example Interaction

```
User: "check anthropic updates"

Skill:
Checking verified Anthropic sources...

✅ anthropic.com/news - Connected
✅ docs.anthropic.com/release-notes - Connected
✅ github.com/anthropics/claude-code - Connected

## Anthropic Updates Report
Generated: 2026-01-28

### Security Advisories
None found.

### Claude API Updates
- Claude 3.5 Opus: Improved reasoning (Jan 15)
- Tool use enhancements (Jan 10)

### Claude Code Updates
- Plugin system v2.1: New hook types
- Marketplace security improvements

### Recommendations for ARI
| Update | Priority | Security | Action |
|--------|----------|----------|--------|
| Hook system v2.1 | Medium | Safe | Review |
| Tool use update | Low | Safe | Monitor |

No automatic installations. Review recommendations?
```
