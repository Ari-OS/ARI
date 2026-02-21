---
name: ari-new-agent
description: Scaffold a new agent for ARI's multi-agent system
---

# /ari-new-agent

Scaffold a new agent following ARI's architecture patterns.

## Usage

```
/ari-new-agent <agent-name>
```

## What This Creates

### 1. Agent Implementation

`src/agents/<agent-name>.ts`

```typescript
import { EventBus } from '../kernel/event-bus.js';
import type { Agent, AgentConfig } from '../kernel/types.js';

export class NewAgent implements Agent {
  readonly name = '<agent-name>';

  constructor(
    private eventBus: EventBus,
    private config: AgentConfig
  ) {
    this.registerListeners();
  }

  private registerListeners(): void {
    this.eventBus.on('<agent>:task', this.handleTask.bind(this));
  }

  async handleTask(event: TaskEvent): Promise<void> {
    // Log to audit
    await this.eventBus.emit('audit:log', {
      action: '<agent>_task_started',
      agent: this.name,
      taskId: event.taskId
    });

    try {
      // Agent implementation
      const result = await this.process(event);

      await this.eventBus.emit('<agent>:completed', {
        taskId: event.taskId,
        result
      });
    } catch (error) {
      await this.eventBus.emit('audit:log', {
        action: '<agent>_task_failed',
        error: error.message
      });
      throw error;
    }
  }

  private async process(event: TaskEvent): Promise<unknown> {
    // Implementation here
  }
}
```

### 2. Agent Tests

`tests/unit/agents/<agent-name>.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NewAgent } from '../../../src/agents/<agent-name>.js';

describe('NewAgent', () => {
  let agent: NewAgent;
  let mockEventBus: EventBus;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    agent = new NewAgent(mockEventBus, defaultConfig);
  });

  it('should register event listeners', () => {
    expect(mockEventBus.on).toHaveBeenCalledWith(
      '<agent>:task',
      expect.any(Function)
    );
  });

  it('should emit to audit on task start', async () => {
    await agent.handleTask({ taskId: 'test' });
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'audit:log',
      expect.objectContaining({ action: '<agent>_task_started' })
    );
  });
});
```

### 3. Type Definitions

Added to `src/kernel/types.ts`

### 4. Registration

Added to agent registry

## Agent Checklist

- [ ] Implements Agent interface
- [ ] Uses EventBus for communication
- [ ] Logs all actions to audit trail
- [ ] Has 100% test coverage
- [ ] Respects layer boundaries
- [ ] Documented in README
