# Source Directory Router

This is the main source directory for ARI. Quick navigation:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| 1. Kernel | `kernel/` | Security boundary, types, event bus |
| 2. System | `system/` | Routing, storage, context loading |
| 3. Agents | `agents/` | Multi-agent coordination |
| 4. Governance | `governance/` | Council, arbiter, overseer |
| 5. Ops | `ops/` | Daemon, infrastructure |
| 6. CLI | `cli/` | User interface commands |

Additional directories:
- `autonomous/` — Proactive agent, scheduler, briefings
- `execution/` — Tool registry and executor
- `integrations/` — External services (Notion, SMS, Cowork)
- `mcp/` — Model Context Protocol server
- `prompts/` — Prompt building utilities

## Quick Rules

1. **Layer imports**: Lower layers cannot import from higher
2. **EventBus**: All cross-layer communication via events
3. **Types**: Import from `kernel/types.js`
4. **Audit**: All state changes emit audit events

## Key Files

- `kernel/types.ts` — All Zod schemas
- `kernel/event-bus.ts` — Typed pub/sub
- `kernel/sanitizer.ts` — Injection detection
- `agents/core.ts` — Message pipeline

See subdirectory CLAUDE.md files for layer-specific guidance.
