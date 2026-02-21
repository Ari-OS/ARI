# ARI Claude Code Setup

This document explains how to configure Claude Code for optimal ARI development on any machine.

## What's Included

### In This Repository (Portable)

The `.claude/` directory contains ARI-specific configurations that travel with the repo:

```
.claude/
├── settings.json          # Project-level hooks
├── hooks/                  # Hook documentation
│   └── plugin-security-gate.md
└── skills/                 # 26 custom ARI skills
    ├── ari-agent-coordination/
    ├── ari-anthropic-monitor/
    ├── ari-backup-recovery/
    ├── ari-cli-development/
    ├── ari-continuous-improvement/
    ├── ari-council-governance/
    ├── ari-daemon-ops/
    ├── ari-error-recovery/
    ├── ari-eventbus-patterns/
    ├── ari-fastify-gateway/
    ├── ari-hash-chain-auditor/
    ├── ari-injection-detection/
    ├── ari-layer-guardian/
    ├── ari-memory-management/
    ├── ari-monitoring-alerting/
    ├── ari-natural-language/
    ├── ari-performance-optimization/
    ├── ari-pino-logging/
    ├── ari-release-management/
    ├── ari-self-improvement/
    ├── ari-testing-strategies/
    ├── ari-tool-creation/
    ├── ari-trust-levels/
    ├── ari-vitest-guardian/
    ├── ari-websocket-patterns/
    └── ari-zod-schemas/
```

### Requires Setup (Global)

Plugins and marketplaces are installed globally in `~/.claude/` and need to be set up on each machine.

## Quick Setup

### On a New Machine

1. Clone the ARI repository:

   ```bash
   git clone https://github.com/ARI-OS/ARI.git
   cd ARI
   ```

2. Run the setup script:

   ```bash
   ./scripts/setup-claude-environment.sh
   ```

3. Restart Claude Code

4. Install dependencies and build:

   ```bash
   npm install
   npm run build
   npm test
   ```

## What the Setup Script Does

1. **Installs 12 verified marketplaces** from trusted sources:
   - `claude-plugins-official` (Anthropic)
   - `trailofbits-security` (Trail of Bits)
   - `wshobson-agents` (71 specialized agents)
   - `ccplugins-awesome` (118 plugins)
   - `cc-marketplace` (119 plugins)
   - And 7 more...

2. **Enables 80 plugins** optimized for ARI development:
   - Security scanning and compliance
   - TypeScript/Node.js development
   - Multi-agent orchestration
   - Testing and code review
   - Performance optimization

3. **Preserves existing settings** by creating a backup

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Install Marketplaces

```bash
cd ~/.claude/plugins/marketplaces

# Required
git clone https://github.com/anthropics/claude-plugins-official.git
git clone https://github.com/trailofbits/skills.git trailofbits-security
git clone https://github.com/wshobson/agents.git wshobson-agents

# Recommended
git clone https://github.com/ccplugins/awesome-claude-code-plugins.git ccplugins-awesome
git clone https://github.com/ruvnet/claude-flow.git ruvnet-claude-flow
```

### 2. Enable Plugins

In Claude Code, run `/plugin` and enable the desired plugins from the Discover tab.

## Custom ARI Skills

The 26 custom skills are automatically loaded when you open Claude Code in the ARI directory. They cover:

| Category | Skills |
|----------|--------|
| **Security** | injection-detection, trust-levels, hash-chain-auditor |
| **Governance** | council-governance, layer-guardian |
| **Development** | cli-development, tool-creation, zod-schemas |
| **Testing** | vitest-guardian, testing-strategies |
| **Operations** | daemon-ops, backup-recovery, monitoring-alerting |
| **Intelligence** | self-improvement, anthropic-monitor, natural-language |

## Hooks

ARI includes project-level hooks that automatically:

- Type-check TypeScript files after edits
- Run tests when test files change
- Alert when kernel layer is modified
- Verify types before stopping

## Verifying Setup

After setup, verify everything works:

```bash
# Check ARI builds
npm run build

# Run tests (should pass with 80%+ coverage)
npm test

# Run diagnostics
npx ari doctor

# Verify audit chain
npx ari audit verify
```

## Updating

To update marketplaces and plugins:

```bash
# Update all marketplaces
for dir in ~/.claude/plugins/marketplaces/*/; do
  echo "Updating $(basename $dir)..."
  (cd "$dir" && git pull --quiet)
done
```

## Troubleshooting

### Plugins not loading

1. Restart Claude Code
2. Check `~/.claude/settings.json` exists
3. Run setup script again

### Skills not available

1. Ensure you're in the ARI directory
2. Check `.claude/skills/` exists
3. Each skill needs a `SKILL.md` file

### Permission errors

```bash
chmod +x scripts/setup-claude-environment.sh
```

## Security Notes

All plugins are from verified sources:

- **Anthropic official** repositories
- **Trail of Bits** (professional security firm)
- **Verified community** projects with MIT licenses

No unverified plugins are installed by the setup script.
