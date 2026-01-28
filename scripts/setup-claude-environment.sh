#!/bin/bash
# ARI Claude Code Environment Setup
# Run this script on any new machine to configure Claude Code for ARI
# Usage: ./scripts/setup-claude-environment.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ARI Claude Code Environment Setup                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

CLAUDE_DIR="$HOME/.claude"
PLUGINS_DIR="$CLAUDE_DIR/plugins/marketplaces"

# Create directories
mkdir -p "$PLUGINS_DIR"

echo "📦 Installing verified marketplaces..."

# Official Anthropic
if [ ! -d "$PLUGINS_DIR/claude-plugins-official" ]; then
  echo "   → claude-plugins-official (Anthropic)"
  git clone --quiet https://github.com/anthropics/claude-plugins-official.git "$PLUGINS_DIR/claude-plugins-official"
fi

# Trail of Bits Security
if [ ! -d "$PLUGINS_DIR/trailofbits-security" ]; then
  echo "   → trailofbits-security (Security Firm)"
  git clone --quiet https://github.com/trailofbits/skills.git "$PLUGINS_DIR/trailofbits-security"
fi

# Anthropic Demo Plugins
if [ ! -d "$PLUGINS_DIR/claude-code-plugins" ]; then
  echo "   → claude-code-plugins (Anthropic Demo)"
  git clone --quiet https://github.com/anthropics/claude-code.git "$PLUGINS_DIR/claude-code-plugins"
fi

# Community Verified - wshobson/agents (71 agents)
if [ ! -d "$PLUGINS_DIR/wshobson-agents" ]; then
  echo "   → wshobson-agents (71 specialized agents)"
  git clone --quiet https://github.com/wshobson/agents.git "$PLUGINS_DIR/wshobson-agents"
fi

# Community Verified - ccplugins-awesome
if [ ! -d "$PLUGINS_DIR/ccplugins-awesome" ]; then
  echo "   → ccplugins-awesome (118 plugins)"
  git clone --quiet https://github.com/ccplugins/awesome-claude-code-plugins.git "$PLUGINS_DIR/ccplugins-awesome"
fi

# Community Verified - cc-marketplace
if [ ! -d "$PLUGINS_DIR/cc-marketplace" ]; then
  echo "   → cc-marketplace (119 plugins)"
  git clone --quiet https://github.com/ananddtyagi/cc-marketplace.git "$PLUGINS_DIR/cc-marketplace"
fi

# Community Verified - claude-code-skills
if [ ! -d "$PLUGINS_DIR/claude-code-skills" ]; then
  echo "   → claude-code-skills"
  git clone --quiet https://github.com/alirezarezvani/claude-skills.git "$PLUGINS_DIR/claude-code-skills"
fi

# Community Verified - mhattingpete
if [ ! -d "$PLUGINS_DIR/mhattingpete-claude-skills" ]; then
  echo "   → mhattingpete-claude-skills"
  git clone --quiet https://github.com/mhattingpete/claude-skills-marketplace.git "$PLUGINS_DIR/mhattingpete-claude-skills"
fi

# Community Verified - claude-night-market
if [ ! -d "$PLUGINS_DIR/claude-night-market" ]; then
  echo "   → claude-night-market"
  git clone --quiet https://github.com/athola/claude-night-market.git "$PLUGINS_DIR/claude-night-market"
fi

# Community Verified - claude-code-templates
if [ ! -d "$PLUGINS_DIR/claude-code-templates" ]; then
  echo "   → claude-code-templates"
  git clone --quiet https://github.com/davila7/claude-code-templates.git "$PLUGINS_DIR/claude-code-templates"
fi

# Community Verified - superpowers
if [ ! -d "$PLUGINS_DIR/superpowers-dev" ]; then
  echo "   → superpowers-dev"
  git clone --quiet https://github.com/obra/superpowers.git "$PLUGINS_DIR/superpowers-dev"
fi

# Community Verified - claude-flow
if [ ! -d "$PLUGINS_DIR/ruvnet-claude-flow" ]; then
  echo "   → ruvnet-claude-flow (Enterprise orchestration)"
  git clone --quiet https://github.com/ruvnet/claude-flow.git "$PLUGINS_DIR/ruvnet-claude-flow"
fi

echo ""
echo "⚙️  Configuring plugins..."

# Backup existing settings if present
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.backup.$(date +%Y%m%d%H%M%S)"
fi

# Write the plugin configuration
cat > "$CLAUDE_DIR/settings.json" << 'SETTINGS_EOF'
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "agent-sdk-dev@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "commit-commands@claude-plugins-official": true,
    "context7@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "plugin-dev@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "security-guidance@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "explanatory-output-style@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true,
    "Notion@claude-plugins-official": true,
    "figma@claude-plugins-official": true,
    "playwright@claude-plugins-official": true,
    "vercel@claude-plugins-official": true,
    "supabase@claude-plugins-official": true,
    "ralph-loop@claude-plugins-official": true,
    "serena@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "static-analysis@trailofbits-security": true,
    "differential-review@trailofbits-security": true,
    "variant-analysis@trailofbits-security": true,
    "sharp-edges@trailofbits-security": true,
    "property-based-testing@trailofbits-security": true,
    "semgrep-rule-creator@trailofbits-security": true,
    "testing-handbook-skills@trailofbits-security": true,
    "audit-context-building@trailofbits-security": true,
    "fix-review@trailofbits-security": true,
    "hookify@claude-code-plugins": true,
    "ralph-wiggum@claude-code-plugins": true,
    "security-scanning@wshobson-agents": true,
    "security-compliance@wshobson-agents": true,
    "backend-api-security@wshobson-agents": true,
    "javascript-typescript@wshobson-agents": true,
    "unit-testing@wshobson-agents": true,
    "agent-orchestration@wshobson-agents": true,
    "debugging-toolkit@wshobson-agents": true,
    "git-pr-workflows@wshobson-agents": true,
    "backend-development@wshobson-agents": true,
    "comprehensive-review@wshobson-agents": true,
    "full-stack-orchestration@wshobson-agents": true,
    "dependency-management@wshobson-agents": true,
    "enterprise-security-reviewer@ccplugins-awesome": true,
    "compliance-automation-specialist@ccplugins-awesome": true,
    "data-privacy-engineer@ccplugins-awesome": true,
    "backend-architect@ccplugins-awesome": true,
    "code-reviewer@ccplugins-awesome": true,
    "debugger@ccplugins-awesome": true,
    "test-writer-fixer@ccplugins-awesome": true,
    "api-tester@ccplugins-awesome": true,
    "performance-benchmarker@ccplugins-awesome": true,
    "ai-engineer@ccplugins-awesome": true,
    "ultrathink@ccplugins-awesome": true,
    "ceo-quality-controller-agent@ccplugins-awesome": true,
    "math@cc-marketplace": true,
    "engineering-workflow-skills@mhattingpete-claude-skills": true,
    "productivity-skills@mhattingpete-claude-skills": true,
    "visual-documentation-skills@mhattingpete-claude-skills": true,
    "code-operations-skills@mhattingpete-claude-skills": true,
    "hookify@claude-night-market": true,
    "pensive@claude-night-market": true,
    "conserve@claude-night-market": true,
    "spec-kit@claude-night-market": true,
    "sanctum@claude-night-market": true,
    "memory-palace@claude-night-market": true,
    "testing-suite@claude-code-templates": true,
    "security-pro@claude-code-templates": true,
    "devops-automation@claude-code-templates": true,
    "c-level-skills@claude-code-skills": true,
    "engineering-skills@claude-code-skills": true,
    "pm-skills@claude-code-skills": true,
    "product-skills@claude-code-skills": true,
    "content-creator@claude-code-skills": true,
    "project-management@claude-code-skills": true,
    "ra-qm-team@claude-code-skills": true,
    "superpowers@superpowers-dev": true,
    "claude-flow@ruvnet-claude-flow": true
  }
}
SETTINGS_EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    CONFIGURATION SUMMARY                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  📦 Marketplaces installed: 12                                ║"
echo "║  🔌 Plugins enabled: 80                                       ║"
echo "║  🎯 ARI skills: 26 (in repo)                                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS:                                                  ║"
echo "║  1. Restart Claude Code to load plugins                       ║"
echo "║  2. cd to ARI directory                                       ║"
echo "║  3. Run: npm install && npm run build                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
