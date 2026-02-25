# ARI Agent Coordination Rules

## Named Agents

Six agents, each with a SOUL file at `~/.ari/workspace/agents/{name}/SOUL.md`:

| Agent | Emoji | Model | Plane | Role |
|-------|-------|-------|-------|------|
| ARI   | 🧠 | claude-opus-4-6   | APEX  | CFO / Orchestrator |
| NOVA  | 🎬 | claude-sonnet-4-6 | APEX  | P1 Content Creator |
| CHASE | 🎯 | claude-sonnet-4-6 | APEX  | P2 Lead Connector |
| PULSE | 🔮 | claude-haiku-4-5  | APEX  | Market Analyst |
| DEX   | 🗂️ | claude-haiku-4-5  | APEX  | Research Scout |
| RUNE  | 🔧 | claude-sonnet-4-6 | CODEX | Engineering Builder |

## Context Plane Enforcement (IMMUTABLE)

**APEX plane** (ARI, NOVA, CHASE, PULSE, DEX):
- Receives: SOUL.md + USER.md + HEARTBEAT.md + GOALS.md + MEMORY.md + AGENTS.md
- Full business context allowed

**CODEX plane** (RUNE only):
- Receives: AGENTS.md + task spec ONLY
- PROHIBITED: SOUL files, USER.md, HEARTBEAT.md, GOALS.md, MEMORY.md, personal data
- Violation throws immediately — no exception

## Coordination Patterns

- **Market → Content**: PULSE 🔮 writes signals to shared state; NOVA 🎬 reads during script gen
- **Research → Leads**: DEX 🗂️ surfaces vertical intel → CHASE 🎯 adjusts scoring
- **Engineering support**: NOVA/CHASE request → RUNE 🔧 (CODEX plane, no business context)
- **Peer handoff**: Agent emits `help_request` signal; target adopts within 15-20s

## Dynamic Spawning

Spawn sub-agents when: context >70% saturated, complexity >0.7, or task is parallelizable.
Ephemeral children get: YAGNI tool set + selective context (not full dump) + 20-30K token budget.

## Anti-Patterns

- NEVER give RUNE business context, SOUL files, or workspace files
- NEVER violate APEX/CODEX split — throw on violation
- Sequential tasks stay in single agent (multi-agent HURTS sequential reasoning)
- Tool limit per agent: 5-8 focused tools (>20 degrades accuracy to 64%)
