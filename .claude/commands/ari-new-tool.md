---
name: ari-new-tool
description: Create a new tool for ARI's Executor agent
---

# /ari-new-tool

Create a new tool following ARI's permission and audit patterns.

## Usage

```
/ari-new-tool <tool-name> --tier <READ|WRITE|EXECUTE|DESTRUCTIVE>
```

## What This Creates

### 1. Tool Implementation

`src/tools/<tool-name>.ts`

```typescript
import { Tool, ToolParams, ToolResult } from '../kernel/types.js';
import { EventBus } from '../kernel/event-bus.js';

export interface NewToolParams extends ToolParams {
  // Define parameters
}

export interface NewToolResult extends ToolResult {
  // Define results
}

export class NewTool implements Tool<NewToolParams, NewToolResult> {
  readonly name = '<tool-name>';
  readonly description = 'Description of tool';
  readonly permissionTier: PermissionTier = '<TIER>';
  readonly requiredTrust: TrustLevel = '<TRUST>';

  constructor(private eventBus: EventBus) {}

  async execute(params: NewToolParams): Promise<NewToolResult> {
    const start = Date.now();

    // Audit invocation
    await this.eventBus.emit('audit:log', {
      action: 'tool_invoked',
      tool: this.name,
      params: this.sanitizeParams(params)
    });

    try {
      const result = await this.doWork(params);

      // Audit success
      await this.eventBus.emit('audit:log', {
        action: 'tool_completed',
        tool: this.name,
        duration: Date.now() - start
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      // Audit failure
      await this.eventBus.emit('audit:log', {
        action: 'tool_failed',
        tool: this.name,
        error: error.message
      });
      throw error;
    }
  }

  private sanitizeParams(params: NewToolParams): unknown {
    // Remove sensitive data before logging
    return { ...params };
  }

  private async doWork(params: NewToolParams): Promise<Partial<NewToolResult>> {
    // Implementation
  }
}
```

### 2. Tool Tests

`tests/unit/tools/<tool-name>.test.ts`

### 3. Registration

Added to tool registry in `src/tools/registry.ts`

## Permission Tiers

| Tier | Trust Required | Examples |
|------|----------------|----------|
| READ | STANDARD | read_file, search |
| WRITE | VERIFIED | write_file, edit |
| EXECUTE | OPERATOR | run_command |
| DESTRUCTIVE | SYSTEM | delete, system_config |

## Tool Checklist

- [ ] Implements Tool interface
- [ ] Correct permission tier
- [ ] Audits all operations
- [ ] Sanitizes params for logging
- [ ] Has comprehensive tests
- [ ] Registered in registry
