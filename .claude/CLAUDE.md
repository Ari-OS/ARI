# Claude Code Configuration

Skills, commands, and agents for ARI development.

## Structure

```
.claude/
├── skills/           # Development skills
├── commands/         # Slash commands
├── agents/           # Spawnable agents
└── settings.json     # Hook configuration
```

## Skills

Skills are markdown files that provide domain expertise:

| Skill | Trigger | Purpose |
|-------|---------|---------|
| ari-skill-generator | `/ari-new-skill` | Create new skills |
| ari-agent-coordination | When coordinating | Multi-agent patterns |
| ari-hash-chain-auditor | Audit operations | Verify audit integrity |
| ari-injection-detection | Security review | Check for injection |

## Creating Skills

```markdown
# .claude/skills/my-skill/SKILL.md
---
name: my-skill
description: What this skill does
triggers: ["/myskill", "when doing X"]
---

## When to Use
...

## Implementation
...
```

## Commands

Commands are quick actions invoked via `/command`:

```markdown
# .claude/commands/my-command.md
---
name: my-command
description: Brief description
---

Do the following steps:
1. ...
2. ...
```

## Agents

Spawnable subagents for specialized tasks. Define in `.claude/agents/`:

```markdown
# .claude/agents/my-agent.md
---
name: my-agent
description: Specialized task handler
tools: [Read, Write, Bash]
---

You are a specialized agent for...
```

## Settings

Hooks in `settings.json` trigger on tool use:

```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "Stop": [...]
  }
}
```

Skills: `/ari-skill-generator`, `/plugin-dev:skill-development`
