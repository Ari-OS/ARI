---
name: ari-agent-coordination
description: Coordinate ARI's five specialized agents for task execution
triggers:
  - "agent coordination"
  - "multi-agent task"
  - "agent workflow"
  - "orchestrate agents"
---

# ARI Agent Coordination

## Purpose

Coordinate ARI's five specialized agents for complex task execution through the EventBus.

## The Five Agents

| Agent | Role | Layer |
|-------|------|-------|
| **Core** | Master orchestrator, message pipeline | Core (3) |
| **Guardian** | Threat detection, risk assessment | Core (3) |
| **Planner** | Task decomposition, DAG creation | Core (3) |
| **Executor** | Tool execution, permission checks | Core (3) |
| **Memory Manager** | Provenance-tracked storage | Core (3) |

## Message Pipeline

```
Inbound Message
    ↓
Core (orchestration)
    ↓
Guardian (threat assessment)
    ↓ (if safe)
Planner (task decomposition)
    ↓
Executor (tool invocation)
    ↓
Memory Manager (result storage)
    ↓
Core (response aggregation)
```

## Agent Communication (via EventBus)

### Core → Guardian
```typescript
eventBus.emit('guardian:assess', {
  messageId: 'uuid',
  content: sanitizedContent,
  trustLevel: 'STANDARD'
});
```

### Guardian → Core
```typescript
eventBus.emit('core:guardian_result', {
  messageId: 'uuid',
  safe: true,
  riskScore: 0.2,
  threats: []
});
```

### Core → Planner
```typescript
eventBus.emit('planner:decompose', {
  messageId: 'uuid',
  intent: 'read and summarize file',
  context: { ... }
});
```

### Planner → Executor
```typescript
eventBus.emit('executor:execute', {
  taskId: 'uuid',
  tasks: [
    { tool: 'read_file', params: { path: '...' } },
    { tool: 'summarize', params: { content: '...' } }
  ]
});
```

### Executor → Memory Manager
```typescript
eventBus.emit('memory:store', {
  taskId: 'uuid',
  result: { ... },
  provenance: {
    source: 'executor',
    timestamp: '...',
    trustLevel: 'VERIFIED'
  }
});
```

## Task DAG (Directed Acyclic Graph)

Planner creates dependency graphs:

```typescript
const taskDAG = {
  nodes: [
    { id: 'task1', tool: 'read_file', dependencies: [] },
    { id: 'task2', tool: 'parse_json', dependencies: ['task1'] },
    { id: 'task3', tool: 'summarize', dependencies: ['task2'] }
  ]
};

// Execute respecting dependencies
for (const task of topologicalSort(taskDAG)) {
  await executeTask(task);
}
```

## Agent Permissions

| Agent | Allowed Operations |
|-------|-------------------|
| Core | Orchestration, routing |
| Guardian | Read-only analysis |
| Planner | Task graph creation |
| Executor | Tool invocation (with checks) |
| Memory | Storage operations |

## Error Handling

```typescript
// Agent failure propagation
eventBus.on('agent:error', async (event) => {
  await eventBus.emit('audit:log', {
    action: 'agent_error',
    agent: event.agent,
    error: event.error
  });

  // Notify Core for recovery
  await eventBus.emit('core:agent_failure', event);
});
```

## Coordination Patterns

### Parallel Execution
```typescript
// Independent tasks can run in parallel
const parallelTasks = tasks.filter(t => t.dependencies.length === 0);
await Promise.all(parallelTasks.map(t => executeTask(t)));
```

### Sequential Pipeline
```typescript
// Dependent tasks run sequentially
for (const task of dependentTasks) {
  const result = await executeTask(task);
  context[task.id] = result;
}
```

### Consensus Required
```typescript
// High-risk operations need multiple agents
const guardianApproval = await requestApproval('guardian', operation);
const arbiterApproval = await requestApproval('arbiter', operation);

if (guardianApproval && arbiterApproval) {
  await executeOperation(operation);
}
```
