---
name: ari-tool-creation
description: Create new tools for ARI's Executor agent
triggers:
  - "create tool"
  - "new tool"
  - "tool development"
  - "executor tool"
---

# ARI Tool Creation

## Purpose

Create new tools for ARI's Executor agent with proper permission checks and audit integration.

## Tool Structure

```typescript
// src/tools/{tool-name}.ts
import { Tool, ToolParams, ToolResult } from '../kernel/types.js';
import { EventBus } from '../kernel/event-bus.js';

export interface MyToolParams extends ToolParams {
  // Tool-specific parameters
  input: string;
  options?: {
    flag: boolean;
  };
}

export interface MyToolResult extends ToolResult {
  // Tool-specific results
  output: string;
  metadata: {
    duration: number;
  };
}

export class MyTool implements Tool<MyToolParams, MyToolResult> {
  name = 'my_tool';
  description = 'Description of what this tool does';
  permissionTier: 'READ' | 'WRITE' | 'EXECUTE' | 'DESTRUCTIVE' = 'READ';
  requiredTrust: TrustLevel = 'STANDARD';

  constructor(private eventBus: EventBus) {}

  async execute(params: MyToolParams): Promise<MyToolResult> {
    const start = Date.now();

    // Log tool invocation
    await this.eventBus.emit('audit:log', {
      action: 'tool_invoked',
      tool: this.name,
      params: this.sanitizeParams(params)
    });

    try {
      // Tool implementation
      const output = await this.doWork(params);

      // Log success
      await this.eventBus.emit('audit:log', {
        action: 'tool_completed',
        tool: this.name,
        success: true
      });

      return {
        success: true,
        output,
        metadata: { duration: Date.now() - start }
      };

    } catch (error) {
      // Log failure
      await this.eventBus.emit('audit:log', {
        action: 'tool_failed',
        tool: this.name,
        error: error.message
      });

      throw error;
    }
  }

  private sanitizeParams(params: MyToolParams): unknown {
    // Remove sensitive data before logging
    return { input: params.input.substring(0, 100) };
  }

  private async doWork(params: MyToolParams): Promise<string> {
    // Actual tool implementation
    return `Processed: ${params.input}`;
  }
}
```

## Permission Tiers

| Tier | Trust Required | Examples |
|------|----------------|----------|
| READ | STANDARD | read_file, list_dir, search |
| WRITE | VERIFIED | write_file, edit_file, create_dir |
| EXECUTE | OPERATOR | run_command, run_script |
| DESTRUCTIVE | SYSTEM | delete_file, rm_dir, system_config |

## Tool Registration

```typescript
// src/tools/registry.ts
import { Tool } from '../kernel/types.js';

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Register built-in tools
registry.register(new ReadFileTool(eventBus));
registry.register(new WriteFileTool(eventBus));
registry.register(new SearchTool(eventBus));
registry.register(new MyTool(eventBus));
```

## Permission Checking

```typescript
// In Executor agent
async function executeTool(
  toolName: string,
  params: ToolParams,
  context: ExecutionContext
): Promise<ToolResult> {
  const tool = registry.get(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Three-layer permission check
  // Layer 1: Agent allowlist
  if (!isToolAllowedForAgent(context.agent, toolName)) {
    throw new PermissionError(`Agent ${context.agent} cannot use ${toolName}`);
  }

  // Layer 2: Trust level
  if (!meetsMinimumTrust(context.trustLevel, tool.requiredTrust)) {
    throw new PermissionError(
      `Trust ${context.trustLevel} insufficient for ${toolName}`
    );
  }

  // Layer 3: Permission tier
  if (!hasPermissionTier(context.agent, tool.permissionTier)) {
    throw new PermissionError(
      `Missing permission tier ${tool.permissionTier}`
    );
  }

  // Execute with audit
  return await tool.execute(params);
}
```

## Built-in Tools

| Tool | Tier | Description |
|------|------|-------------|
| `read_file` | READ | Read file contents |
| `list_dir` | READ | List directory contents |
| `search` | READ | Search files/content |
| `write_file` | WRITE | Write to file |
| `edit_file` | WRITE | Edit existing file |
| `create_dir` | WRITE | Create directory |
| `run_command` | EXECUTE | Run shell command |
| `delete_file` | DESTRUCTIVE | Delete file |

## Testing Tools

```typescript
describe('MyTool', () => {
  let tool: MyTool;
  let mockEventBus: EventBus;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    tool = new MyTool(mockEventBus);
  });

  it('should execute successfully', async () => {
    const result = await tool.execute({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('test');
  });

  it('should audit invocation', async () => {
    await tool.execute({ input: 'test' });
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'audit:log',
      expect.objectContaining({ action: 'tool_invoked' })
    );
  });

  it('should respect permission tier', () => {
    expect(tool.permissionTier).toBe('READ');
  });
});
```

## Security Considerations

1. **Never bypass permission checks**
2. **Always sanitize params before logging**
3. **Use least privilege tier possible**
4. **Validate all inputs**
5. **Log all operations to audit trail**
6. **Handle errors gracefully**
7. **Timeout long-running operations**
