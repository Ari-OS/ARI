---
name: ari-eventbus-patterns
description: EventBus communication patterns for ARI's six-layer architecture
triggers:
  - "eventbus pattern"
  - "emit event"
  - "subscribe event"
  - "cross-layer communication"
---

# ARI EventBus Patterns

## Purpose

Guide proper EventBus usage for inter-layer communication in ARI's six-layer architecture (ADR-003).

## Core Principle

**All inter-layer communication via typed EventBus - no direct cross-layer function calls.**

## Event Naming Convention

```
{domain}:{action}

Examples:
- message:accepted
- security:threat_detected
- governance:vote_required
- audit:log
- task:completed
```

## Standard Event Patterns

### Audit Logging
```typescript
this.eventBus.emit('audit:log', {
  action: 'operation_name',
  agent: 'AGENT_ID',
  details: { key: 'value' },
  timestamp: new Date().toISOString(),
});
```

### Security Alerts
```typescript
this.eventBus.emit('security:threat_detected', {
  risk: riskScore,
  source: 'sanitizer',
  pattern: 'sql_injection',
  content: sanitizedContent,
});
```

### Governance Requests
```typescript
this.eventBus.emit('governance:vote_required', {
  proposal: {
    type: 'tool_execution',
    tool: 'file_delete',
    requiredThreshold: 'supermajority'
  }
});
```

### Task Orchestration
```typescript
// Planner → Executor
this.eventBus.emit('task:execute', {
  taskId: 'uuid',
  tool: 'read_file',
  params: { path: '/path/to/file' }
});

// Executor → Planner
this.eventBus.emit('task:completed', {
  taskId: 'uuid',
  result: { success: true, data: '...' }
});
```

## Layer-Specific Events

### Kernel Events (Layer 1)
- `gateway:request_received`
- `sanitizer:input_cleaned`
- `audit:log`
- `config:updated`

### System Events (Layer 2)
- `router:message_routed`
- `storage:context_saved`

### Agent Events (Layer 3)
- `core:processing_started`
- `guardian:threat_assessed`
- `planner:task_decomposed`
- `executor:tool_invoked`
- `memory:fact_stored`

### Governance Events (Layer 4)
- `council:vote_cast`
- `arbiter:rule_checked`
- `overseer:gate_evaluated`

### Ops Events (Layer 5)
- `daemon:started`
- `daemon:stopped`

### Interface Events (Layer 6)
- `cli:command_received`
- `cli:output_sent`

## Subscription Patterns

### Single Event
```typescript
this.eventBus.on('security:threat_detected', (event) => {
  this.handleThreat(event);
});
```

### Multiple Events
```typescript
const events = ['task:completed', 'task:failed', 'task:timeout'];
events.forEach(e => this.eventBus.on(e, this.handleTaskResult));
```

### One-Time Listener
```typescript
this.eventBus.once('governance:decision', (result) => {
  // Called only once, then removed
});
```

## Anti-Patterns (Avoid)

```typescript
// ❌ WRONG: Direct cross-layer import
import { Council } from '../governance/council.js';
const result = council.vote(proposal);

// ✅ CORRECT: EventBus communication
this.eventBus.emit('governance:vote_required', proposal);
this.eventBus.on('governance:decision', (result) => { ... });
```

## Error Handling

```typescript
try {
  await operation();
  this.eventBus.emit('operation:completed', { success: true });
} catch (error) {
  this.eventBus.emit('audit:log', {
    action: 'operation_failed',
    error: error instanceof Error ? error.message : String(error),
  });
  this.eventBus.emit('operation:failed', { error });
  throw error;
}
```
