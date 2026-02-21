# ARI Plugin Security Gate

## Purpose

Prevent installation of unverified or potentially malicious plugins.

## Trusted Sources (Allowlist)

Only plugins from these sources are permitted:

```
TRUSTED_MARKETPLACES:
  - claude-plugins-official (Anthropic)
  - anthropics/claude-code (Anthropic)
  - trailofbits-security (Trail of Bits - security firm)

VERIFIED_COMMUNITY (require manual review):
  - wshobson-agents (71 agents, MIT licensed)
  - mhattingpete-claude-skills (MIT licensed)
  - claude-code-skills (MIT licensed, security policy)
```

## Blocked Patterns

Reject any plugin that:

- Has no LICENSE file
- Has no author information
- Contains obfuscated code
- Requests excessive permissions
- Lacks source code visibility
- Has known vulnerabilities

## Verification Checklist

Before enabling any plugin:

- [ ] Source is in trusted/verified list
- [ ] LICENSE file exists and is permissive (MIT, Apache, BSD)
- [ ] No hardcoded credentials or secrets
- [ ] No external network calls in runtime
- [ ] No shell command execution without sandboxing
- [ ] Code is readable (not minified/obfuscated)
- [ ] Has been reviewed by community (stars, forks)
- [ ] No recent security advisories

## Hook Implementation

```bash
# Pre-plugin-install hook
#!/bin/bash

PLUGIN_SOURCE="$1"

# Check against allowlist
TRUSTED="claude-plugins-official|anthropics|trailofbits"

if ! echo "$PLUGIN_SOURCE" | grep -qE "$TRUSTED"; then
  echo "⚠️  BLOCKED: Plugin source not in trusted list"
  echo "Source: $PLUGIN_SOURCE"
  echo "Requires manual security review before installation"
  exit 1
fi

echo "✅ Plugin source verified: $PLUGIN_SOURCE"
exit 0
```

## ARI-Specific Requirements

Plugins for ARI must also:

1. Not violate ARI's 5 core invariants
2. Not bypass the kernel security layer
3. Not modify audit logs
4. Support EventBus communication pattern
5. Be compatible with TypeScript strict mode
