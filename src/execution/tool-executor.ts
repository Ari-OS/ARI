import { randomUUID } from 'crypto';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { ToolCallToken, ExecutionResult } from '../kernel/types.js';
import type { PolicyEngine } from '../governance/policy-engine.js';
import type { ToolRegistry } from './tool-registry.js';
import type { ExecutionContext, ExecutionOptions } from './types.js';

/**
 * Maximum concurrent tool executions allowed.
 */
const MAX_CONCURRENT_EXECUTIONS = 10;

/**
 * Default timeout in milliseconds.
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * ToolExecutor - Pure execution engine.
 *
 * Implements the Constitutional separation of powers by handling
 * ONLY tool execution. Cannot make permission decisions.
 *
 * Responsibilities:
 * - Execute tools with valid ToolCallTokens
 * - Verify tokens before execution
 * - Manage execution timeouts
 * - Handle execution errors
 * - Report results
 * - Emit streaming events
 *
 * Constitutional Alignment:
 * - Article II Section 2.4.3: ToolExecutor is the Execution Engine
 * - Cannot execute without valid ToolCallToken from PolicyEngine
 * - Cannot bypass permission checks
 * - Cannot modify tool definitions
 * - Cannot approve its own requests
 */
export class ToolExecutor {
  private readonly activeExecutions = new Map<string, {
    startTime: number;
    sessionId?: string;
    abortController: AbortController;
  }>();

  constructor(
    private readonly registry: ToolRegistry,
    private readonly policyEngine: PolicyEngine,
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute a tool with a valid ToolCallToken.
   *
   * @param token - The authorization token from PolicyEngine
   * @param options - Optional execution options
   * @returns Execution result
   */
  async execute(token: ToolCallToken, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const callId = options.callId ?? randomUUID();
    const startTime = Date.now();

    // Check concurrent execution limit
    if (this.activeExecutions.size >= MAX_CONCURRENT_EXECUTIONS) {
      return this.createErrorResult(
        callId,
        token.token_id,
        'Maximum concurrent executions reached',
        startTime
      );
    }

    // Verify the token
    if (!this.policyEngine.verifyToken(token, token.parameters)) {
      await this.auditLogger.log('execution:token_invalid', token.agent_id, token.trust_level, {
        call_id: callId,
        token_id: token.token_id,
        tool_id: token.tool_id,
      });

      return this.createErrorResult(
        callId,
        token.token_id,
        'Invalid or expired token',
        startTime
      );
    }

    // Mark token as used (single-use enforcement)
    this.policyEngine.markTokenUsed(token.token_id);

    // Get the tool from registry
    const registeredTool = this.registry.get(token.tool_id);
    if (!registeredTool) {
      return this.createErrorResult(
        callId,
        token.token_id,
        `Tool ${token.tool_id} not found in registry`,
        startTime
      );
    }

    // Validate parameters
    const validation = this.registry.validateParameters(token.tool_id, token.parameters);
    if (!validation.valid) {
      return this.createErrorResult(
        callId,
        token.token_id,
        `Parameter validation failed: ${validation.errors.join(', ')}`,
        startTime
      );
    }

    // Set up execution context
    const timeout = options.timeout ?? this.registry.getTimeout(token.tool_id) ?? DEFAULT_TIMEOUT_MS;
    const abortController = new AbortController();

    const context: ExecutionContext = {
      callId,
      tokenId: token.token_id,
      agentId: token.agent_id,
      trustLevel: token.trust_level,
      startTime: new Date(),
      timeout,
      sessionId: options.sessionId,
    };

    // Track active execution
    this.activeExecutions.set(callId, {
      startTime,
      sessionId: options.sessionId,
      abortController,
    });

    // Emit start event
    this.eventBus.emit('tool:start', {
      callId,
      toolId: token.tool_id,
      toolName: registeredTool.capability.name,
      agent: token.agent_id,
      sessionId: options.sessionId,
      parameters: token.parameters,
      timestamp: new Date(),
    });

    try {
      // Execute with timeout
      const output = await this.executeWithTimeout(
        registeredTool.handler,
        token.parameters,
        context,
        timeout,
        abortController.signal
      );

      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        success: true,
        tool_call_id: callId,
        token_id: token.token_id,
        output,
        duration_ms: duration,
        executed_at: new Date().toISOString(),
      };

      await this.auditLogger.log('execution:success', token.agent_id, token.trust_level, {
        call_id: callId,
        token_id: token.token_id,
        tool_id: token.tool_id,
        duration_ms: duration,
      });

      // Emit end event
      this.eventBus.emit('tool:end', {
        callId,
        toolId: token.tool_id,
        success: true,
        result: output,
        duration,
        timestamp: new Date(),
      });

      // Legacy event for backwards compatibility
      this.eventBus.emit('tool:executed', {
        toolId: token.tool_id,
        callId,
        success: true,
        agent: token.agent_id,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: ExecutionResult = {
        success: false,
        tool_call_id: callId,
        token_id: token.token_id,
        error: errorMessage,
        duration_ms: duration,
        executed_at: new Date().toISOString(),
      };

      await this.auditLogger.log('execution:failure', token.agent_id, token.trust_level, {
        call_id: callId,
        token_id: token.token_id,
        tool_id: token.tool_id,
        duration_ms: duration,
        error: errorMessage,
      });

      // Emit end event
      this.eventBus.emit('tool:end', {
        callId,
        toolId: token.tool_id,
        success: false,
        error: errorMessage,
        duration,
        timestamp: new Date(),
      });

      // Legacy event for backwards compatibility
      this.eventBus.emit('tool:executed', {
        toolId: token.tool_id,
        callId,
        success: false,
        agent: token.agent_id,
      });

      return result;

    } finally {
      this.activeExecutions.delete(callId);
    }
  }

  /**
   * Execute handler with timeout enforcement.
   */
  private async executeWithTimeout(
    handler: (params: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>,
    parameters: Record<string, unknown>,
    context: ExecutionContext,
    timeout: number,
    signal: AbortSignal
  ): Promise<unknown> {
    return Promise.race([
      // Actual execution
      handler(parameters, context),
      // Timeout
      new Promise((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
          timeout
        );
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Execution aborted'));
        });
      }),
    ]);
  }

  /**
   * Create an error result.
   */
  private createErrorResult(
    callId: string,
    tokenId: string | null,
    error: string,
    startTime: number
  ): ExecutionResult {
    return {
      success: false,
      tool_call_id: callId,
      token_id: tokenId,
      error,
      duration_ms: Date.now() - startTime,
      executed_at: new Date().toISOString(),
    };
  }

  /**
   * Abort an active execution.
   *
   * @param callId - The call ID to abort
   * @returns True if execution was found and aborted
   */
  abort(callId: string): boolean {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      return false;
    }

    execution.abortController.abort();

    void this.auditLogger.log('execution:aborted', 'executor', 'system', {
      call_id: callId,
    });

    return true;
  }

  /**
   * Get information about active executions.
   */
  getActiveExecutions(): Array<{ callId: string; startTime: number; sessionId?: string }> {
    return Array.from(this.activeExecutions.entries()).map(([callId, data]) => ({
      callId,
      startTime: data.startTime,
      sessionId: data.sessionId,
    }));
  }

  /**
   * Get count of active executions.
   */
  get activeCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if at capacity for concurrent executions.
   */
  get atCapacity(): boolean {
    return this.activeExecutions.size >= MAX_CONCURRENT_EXECUTIONS;
  }
}
