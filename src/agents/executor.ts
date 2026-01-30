import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type {
  AgentId,
  TrustLevel,
  ToolDefinition,
} from '../kernel/types.js';
import { TRUST_SCORES } from '../kernel/types.js';

interface ToolCall {
  id: string;
  tool_id: string;
  parameters: Record<string, unknown>;
  requesting_agent: AgentId;
  trust_level: TrustLevel;
  timestamp: Date;
}

interface ExecutionResult {
  success: boolean;
  tool_call_id: string;
  output?: unknown;
  error?: string;
  duration_ms: number;
  approved_by?: AgentId;
}

interface PendingApproval {
  call: ToolCall;
  tool: ToolDefinition;
  resolve: (result: ExecutionResult) => void;
  reject: (reason: string) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Executor - Tool execution with permission gating and streaming events
 * Manages tool registration, permission checking, and execution with approval workflow
 *
 * Streaming Events:
 * - tool:start - Emitted when tool execution begins
 * - tool:update - Emitted for progress updates during long-running operations
 * - tool:end - Emitted when tool execution completes (success or failure)
 */
export class Executor {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;
  private tools = new Map<string, ToolDefinition>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private activeExecutions = new Map<string, { startTime: number; sessionId?: string }>();

  private readonly MAX_CONCURRENT_EXECUTIONS = 10;
  private readonly DEFAULT_TIMEOUT_MS = 30000;

  constructor(auditLogger: AuditLogger, eventBus: EventBus) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;

    // Register built-in tools
    this.registerBuiltInTools();
  }

  /**
   * Register a new tool
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);

    void this.auditLogger.log('tool:register', 'executor', 'system', {
      tool_id: tool.id,
      permission_tier: tool.permission_tier,
      required_trust_level: tool.required_trust_level,
      allowed_agents: tool.allowed_agents,
    });
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check if tool exists
    const tool = this.tools.get(call.tool_id);
    if (!tool) {
      return {
        success: false,
        tool_call_id: call.id,
        error: `Tool ${call.tool_id} not found`,
        duration_ms: Date.now() - startTime,
      };
    }

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.MAX_CONCURRENT_EXECUTIONS) {
      return {
        success: false,
        tool_call_id: call.id,
        error: 'Maximum concurrent executions reached',
        duration_ms: Date.now() - startTime,
      };
    }

    // 3-layer permission check
    const permissionCheck = this.checkPermissions(call, tool);
    if (!permissionCheck.allowed) {
      await this.auditLogger.log('tool:permission_denied', call.requesting_agent, call.trust_level, {
        tool_id: call.tool_id,
        reason: permissionCheck.reason,
      });

      return {
        success: false,
        tool_call_id: call.id,
        error: `Permission denied: ${permissionCheck.reason}`,
        duration_ms: Date.now() - startTime,
      };
    }

    // Check if approval is required
    if (this.requiresApproval(tool)) {
      return await this.executeWithApproval(call, tool);
    }

    // Execute directly
    return await this.executeInternal(call, tool);
  }

  /**
   * Approve a pending tool call
   */
  async approve(callId: string, approver: AgentId): Promise<void> {
    const pending = this.pendingApprovals.get(callId);
    if (!pending) {
      throw new Error(`No pending approval for call ${callId}`);
    }

    // Check approver authorization
    if (!['arbiter', 'overseer', 'operator'].includes(approver)) {
      throw new Error(`Agent ${approver} cannot approve tool executions`);
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(callId);

    await this.auditLogger.log('tool:approved', approver, 'system', {
      call_id: callId,
      tool_id: pending.call.tool_id,
      requesting_agent: pending.call.requesting_agent,
    });

    // Execute the tool
    const result = await this.executeInternal(pending.call, pending.tool);
    result.approved_by = approver;
    pending.resolve(result);
  }

  /**
   * Reject a pending tool call
   */
  async reject(callId: string, reason: string): Promise<void> {
    const pending = this.pendingApprovals.get(callId);
    if (!pending) {
      throw new Error(`No pending approval for call ${callId}`);
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(callId);

    await this.auditLogger.log('tool:rejected', 'overseer', 'system', {
      call_id: callId,
      tool_id: pending.call.tool_id,
      reason,
    });

    pending.reject(reason);
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): Array<{ callId: string; toolId: string; agent: AgentId; parameters: Record<string, unknown> }> {
    return Array.from(this.pendingApprovals.entries()).map(([callId, pending]) => ({
      callId,
      toolId: pending.call.tool_id,
      agent: pending.call.requesting_agent,
      parameters: pending.call.parameters,
    }));
  }

  /**
   * Check all permission layers
   */
  private checkPermissions(
    call: ToolCall,
    tool: ToolDefinition
  ): { allowed: boolean; reason?: string } {
    // Layer 1: Agent allowlist
    if (tool.allowed_agents.length > 0 && !tool.allowed_agents.includes(call.requesting_agent)) {
      return {
        allowed: false,
        reason: `Agent ${call.requesting_agent} not in tool allowlist`,
      };
    }

    // Layer 2: Trust level
    const requiredTrustScore = TRUST_SCORES[tool.required_trust_level];
    const actualTrustScore = TRUST_SCORES[call.trust_level];
    if (actualTrustScore < requiredTrustScore) {
      return {
        allowed: false,
        reason: `Trust level ${call.trust_level} insufficient (requires ${tool.required_trust_level})`,
      };
    }

    // Layer 3: Permission tier (implicit check - handled by approval workflow)
    return { allowed: true };
  }

  /**
   * Check if tool requires approval
   */
  private requiresApproval(tool: ToolDefinition): boolean {
    return tool.permission_tier === 'WRITE_DESTRUCTIVE' || tool.permission_tier === 'ADMIN';
  }

  /**
   * Execute tool with approval workflow and streaming events
   */
  private async executeWithApproval(call: ToolCall, tool: ToolDefinition, sessionId?: string): Promise<ExecutionResult> {
    // Emit tool:start event for approval workflow
    this.eventBus.emit('tool:start', {
      callId: call.id,
      toolId: tool.id,
      toolName: tool.name,
      agent: call.requesting_agent,
      sessionId,
      parameters: call.parameters,
      timestamp: new Date(),
    });

    // Emit waiting_approval update
    this.emitToolUpdate(call.id, tool.id, 'waiting_approval', undefined, 'Awaiting approval');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(call.id);

        // Emit tool:end event for timeout
        this.eventBus.emit('tool:end', {
          callId: call.id,
          toolId: tool.id,
          success: false,
          error: 'Approval timeout',
          duration: tool.timeout_ms || this.DEFAULT_TIMEOUT_MS,
          timestamp: new Date(),
        });

        reject(new Error('Approval timeout'));
      }, tool.timeout_ms || this.DEFAULT_TIMEOUT_MS);

      this.pendingApprovals.set(call.id, {
        call,
        tool,
        resolve,
        reject,
        timeout,
      });

      this.eventBus.emit('tool:approval_required', {
        toolId: tool.id,
        callId: call.id,
        agent: call.requesting_agent,
        parameters: call.parameters,
      });
    });
  }

  /**
   * Internal tool execution with streaming events
   */
  private async executeInternal(call: ToolCall, tool: ToolDefinition, sessionId?: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.activeExecutions.set(call.id, { startTime, sessionId });

    // Emit tool:start event
    this.eventBus.emit('tool:start', {
      callId: call.id,
      toolId: tool.id,
      toolName: tool.name,
      agent: call.requesting_agent,
      sessionId,
      parameters: call.parameters,
      timestamp: new Date(),
    });

    try {
      // Emit initial update
      this.emitToolUpdate(call.id, tool.id, 'running', 0, 'Starting execution');

      // Execute tool with timeout
      const timeout = tool.timeout_ms || this.DEFAULT_TIMEOUT_MS;
      const output = await this.executeWithTimeout(call, tool, timeout);

      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        success: true,
        tool_call_id: call.id,
        output,
        duration_ms: duration,
      };

      await this.auditLogger.log('tool:execute', call.requesting_agent, call.trust_level, {
        tool_id: call.tool_id,
        call_id: call.id,
        duration_ms: result.duration_ms,
        success: true,
      });

      // Emit tool:end event (success)
      this.eventBus.emit('tool:end', {
        callId: call.id,
        toolId: tool.id,
        success: true,
        result: output,
        duration,
        timestamp: new Date(),
      });

      // Also emit legacy event for backwards compatibility
      this.eventBus.emit('tool:executed', {
        toolId: tool.id,
        callId: call.id,
        success: true,
        agent: call.requesting_agent,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: ExecutionResult = {
        success: false,
        tool_call_id: call.id,
        error: errorMessage,
        duration_ms: duration,
      };

      await this.auditLogger.log('tool:execute', call.requesting_agent, call.trust_level, {
        tool_id: call.tool_id,
        call_id: call.id,
        duration_ms: result.duration_ms,
        success: false,
        error: result.error,
      });

      // Emit tool:end event (failure)
      this.eventBus.emit('tool:end', {
        callId: call.id,
        toolId: tool.id,
        success: false,
        error: errorMessage,
        duration,
        timestamp: new Date(),
      });

      // Also emit legacy event for backwards compatibility
      this.eventBus.emit('tool:executed', {
        toolId: tool.id,
        callId: call.id,
        success: false,
        agent: call.requesting_agent,
      });

      return result;
    } finally {
      this.activeExecutions.delete(call.id);
    }
  }

  /**
   * Emit a tool update event
   */
  private emitToolUpdate(
    callId: string,
    toolId: string,
    status: 'running' | 'waiting_approval' | 'processing',
    progress?: number,
    message?: string
  ): void {
    this.eventBus.emit('tool:update', {
      callId,
      toolId,
      status,
      progress,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Get active execution info
   */
  getActiveExecutions(): Array<{ callId: string; startTime: number; sessionId?: string }> {
    return Array.from(this.activeExecutions.entries()).map(([callId, data]) => ({
      callId,
      ...data,
    }));
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    call: ToolCall,
    tool: ToolDefinition,
    timeout: number
  ): Promise<unknown> {
    return Promise.race([
      this.executeToolLogic(call, tool),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      ),
    ]);
  }

  /**
   * Execute actual tool logic (stub implementations for built-in tools)
   */
  private executeToolLogic(call: ToolCall, tool: ToolDefinition): unknown {
    // Built-in tool implementations
    switch (tool.id) {
      case 'file_read':
        return { content: `Mock file content for ${String(call.parameters.path)}` };
      case 'file_write':
        return { written: true, path: call.parameters.path };
      case 'file_delete':
        return { deleted: true, path: call.parameters.path };
      case 'system_config':
        return { config: 'mock_config_value' };
      default:
        throw new Error(`Tool ${tool.id} has no implementation`);
    }
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // File read - READ_ONLY
    this.registerTool({
      id: 'file_read',
      name: 'Read File',
      description: 'Read contents of a file',
      permission_tier: 'READ_ONLY',
      required_trust_level: 'standard',
      allowed_agents: [],
      timeout_ms: 5000,
      sandboxed: true,
      parameters: {
        path: { type: 'string', required: true, description: 'File path to read' },
      },
    });

    // File write - WRITE_SAFE
    this.registerTool({
      id: 'file_write',
      name: 'Write File',
      description: 'Write contents to a file',
      permission_tier: 'WRITE_SAFE',
      required_trust_level: 'verified',
      allowed_agents: [],
      timeout_ms: 10000,
      sandboxed: true,
      parameters: {
        path: { type: 'string', required: true, description: 'File path to write' },
        content: { type: 'string', required: true, description: 'Content to write' },
      },
    });

    // File delete - WRITE_DESTRUCTIVE
    this.registerTool({
      id: 'file_delete',
      name: 'Delete File',
      description: 'Delete a file',
      permission_tier: 'WRITE_DESTRUCTIVE',
      required_trust_level: 'operator',
      allowed_agents: [],
      timeout_ms: 5000,
      sandboxed: true,
      parameters: {
        path: { type: 'string', required: true, description: 'File path to delete' },
      },
    });

    // System config - ADMIN
    this.registerTool({
      id: 'system_config',
      name: 'System Configuration',
      description: 'Modify system configuration',
      permission_tier: 'ADMIN',
      required_trust_level: 'system',
      allowed_agents: ['core', 'overseer'],
      timeout_ms: 3000,
      sandboxed: false,
      parameters: {
        key: { type: 'string', required: true, description: 'Configuration key' },
        value: { type: 'string', required: true, description: 'Configuration value' },
      },
    });
  }
}
