# Agents Layer

Multi-agent coordination for task execution.

## Agent Types

| Agent | Role | Key Methods |
|-------|------|-------------|
| Core | Master orchestrator | `processMessage()`, `coordinate()` |
| Guardian | Threat detection | `assessThreat()`, `monitor()` |
| Planner | Task decomposition | `plan()`, `createDAG()` |
| Executor | Tool execution | `execute()`, `checkPermissions()` |
| MemoryManager | Knowledge persistence | `store()`, `query()`, `verify()` |

## Message Pipeline

```
1. Core receives message
2. Guardian assesses threat (risk 0.0-1.0)
3. If risk < 0.8: Classify intent (conversation | tool_use | system_command)
4. Route to AIOrchestrator (conversation) or Executor (tool_use)
5. MemoryManager stores learnings
```

## Coordination Patterns

```typescript
// Parallel execution with dependency resolution
const tasks = await planner.createDAG(request);
const results = await executor.executeDAG(tasks);

// Memory with provenance
await memoryManager.store({
  type: 'DECISION',
  content: 'Chose X over Y because...',
  provenance: { source, trust_level, agent, chain },
  confidence: 0.85,
  partition: 'INTERNAL',
});
```

## Permission Flow

1. Tool requested by agent
2. Executor checks agent allowlist
3. PolicyEngine validates trust level
4. If destructive: Arbiter approval required
5. Execute with audit trail

## Key Files

- `core.ts` — Full message pipeline
- `memory-manager.ts` — Provenance-tracked storage
- `executor.ts` — Permission-checked tool execution

Skills: `/ari-agent-coordination`, `/ari-memory-management`
