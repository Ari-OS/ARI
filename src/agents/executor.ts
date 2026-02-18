import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId, TrustLevel, ToolDefinition } from '../kernel/types.js';
// L3 Agents layer — cannot import L4 Governance statically (ADR-004).
// PolicyEngine instantiation via dynamic import; interface uses kernel types (L1 — allowed).
import type { ToolPolicy, PermissionCheckResult } from '../kernel/types.js';

export interface PolicyEngineLike {
  getPolicy(toolId: string): ToolPolicy | undefined;
  checkPermissions(agentId: string, trustLevel: string, policy: ToolPolicy): PermissionCheckResult;
  registerPolicy(policy: ToolPolicy): void;
}
import { ToolRegistry } from '../execution/tool-registry.js';
import type { ToolHandler } from '../execution/types.js';
import fs from 'node:fs/promises';
import { loadConfig } from '../kernel/config.js';
import {
  webNavigateHandler,
  webSearchHandler,
  webScreenshotHandler,
  webExtractHandler,
} from '../execution/tools/web-navigate.js';

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
 *
 * Manages tool registration, permission checking, and execution with approval workflow.
 * Permission decisions are delegated to the PolicyEngine (governance layer) per
 * Constitutional separation of powers.
 *
 * Architecture:
 * - PolicyEngine: Determines WHAT is allowed (permission authority)
 * - ToolRegistry: Defines WHAT exists (capability catalog)
 * - Executor: Performs WHAT is permitted (execution engine)
 *
 * Streaming Events:
 * - tool:start - Emitted when tool execution begins
 * - tool:update - Emitted for progress updates during long-running operations
 * - tool:end - Emitted when tool execution completes (success or failure)
 *
 * @see docs/constitution/ARI-CONSTITUTION-v1.0.md - Section 2.4
 */
export class Executor {
  private readonly auditLogger: AuditLogger;
  private readonly eventBus: EventBus;

  /** Legacy tool definitions (kept for backwards compatibility) */
  private tools = new Map<string, ToolDefinition>();

  /** Pending approval workflow */
  private pendingApprovals = new Map<string, PendingApproval>();

  /** Active executions for concurrency tracking */
  private activeExecutions = new Map<string, { startTime: number; sessionId?: string }>();

  /** PolicyEngine for separated permission decisions (Constitutional) */
  private policyEngine: PolicyEngineLike | null = null;

  /** Policies queued before policyEngine initializes */
  private _pendingPolicies: Array<ToolPolicy> = [];

  /** ToolRegistry for separated capability catalog */
  private readonly toolRegistry: ToolRegistry;

  private readonly MAX_CONCURRENT_EXECUTIONS = 10;
  private readonly DEFAULT_TIMEOUT_MS = 30000;

  constructor(auditLogger: AuditLogger, eventBus: EventBus, policyEngineOverride?: PolicyEngineLike) {
    this.auditLogger = auditLogger;
    this.eventBus = eventBus;
    this.toolRegistry = new ToolRegistry(auditLogger, eventBus);

    if (policyEngineOverride) {
      // Synchronous path — used in tests for deterministic behavior
      this.policyEngine = policyEngineOverride;
      this.registerBuiltInTools();
    } else {
      // Production path — deferred L4 import (ADR-004: L3 cannot statically import L4)
      this.registerBuiltInTools(); // tools registered; policies queued until policyEngine loads
      void import('../governance/policy-engine.js').then(({ PolicyEngine }) => {
        this.policyEngine = new PolicyEngine(auditLogger, eventBus);
        this._drainPolicyQueue();
      });
    }
  }

  /**
   * Get the PolicyEngine instance (for testing/integration).
   */
  getPolicyEngine(): PolicyEngineLike | null {
    return this.policyEngine;
  }

  /**
   * Get the ToolRegistry instance (for testing/integration).
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
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

    // Permission check via PolicyEngine (Constitutional separation of powers)
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
    if (permissionCheck.requires_approval) {
      return await this.executeWithApproval(call, tool);
    }

    // Execute directly
    return await this.executeInternal(call, tool);
  }

  /**
   * Check permissions using the PolicyEngine.
   * Implements Constitutional Section 2.4.1 (Permission Authority).
   */
  private checkPermissions(
    call: ToolCall,
    tool: ToolDefinition
  ): { allowed: boolean; reason?: string; requires_approval?: boolean } {
    if (!this.policyEngine) {
      // policyEngine not yet initialized — deny by default until ready
      return { allowed: false, requires_approval: false, reason: 'PolicyEngine not yet initialized', risk_score: 0.5, violations: [] } as PermissionCheckResult;
    }
    const policy = this.policyEngine.getPolicy(tool.id);
    if (!policy) {
      return { allowed: false, reason: `No policy found for tool ${tool.id}` };
    }

    const result = this.policyEngine.checkPermissions(call.requesting_agent, call.trust_level, policy);
    return {
      allowed: result.allowed,
      reason: result.reason,
      requires_approval: result.requires_approval,
    };
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
  getPendingApprovals(): Array<{
    callId: string;
    toolId: string;
    agent: AgentId;
    parameters: Record<string, unknown>;
  }> {
    return Array.from(this.pendingApprovals.entries()).map(([callId, pending]) => ({
      callId,
      toolId: pending.call.tool_id,
      agent: pending.call.requesting_agent,
      parameters: pending.call.parameters,
    }));
  }

  /**
   * Execute tool with approval workflow and streaming events
   */
  private async executeWithApproval(
    call: ToolCall,
    tool: ToolDefinition,
    sessionId?: string
  ): Promise<ExecutionResult> {
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
  private async executeInternal(
    call: ToolCall,
    tool: ToolDefinition,
    sessionId?: string
  ): Promise<ExecutionResult> {
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
   * Execute actual tool logic (built-in tool implementations)
   */
  private async executeToolLogic(call: ToolCall, tool: ToolDefinition): Promise<unknown> {
    // Built-in tool implementations
    switch (tool.id) {
      case 'file_read': {
        const path = typeof call.parameters.path === 'string' ? call.parameters.path : '';
        if (!path) {
          throw new Error('file_read requires path parameter');
        }
        try {
          const content = await fs.readFile(path, 'utf-8');
          return { content, path };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to read file: ${message}`);
        }
      }
      case 'file_write': {
        const writePath = typeof call.parameters.path === 'string' ? call.parameters.path : '';
        const writeContent = typeof call.parameters.content === 'string' ? call.parameters.content : '';
        if (!writePath) throw new Error('file_write requires path parameter');
        if (!writeContent) throw new Error('file_write requires content parameter');
        try {
          await fs.writeFile(writePath, writeContent, 'utf-8');
          return { written: true, path: writePath, bytes: Buffer.byteLength(writeContent) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to write file: ${message}`);
        }
      }
      case 'file_delete': {
        const deletePath = typeof call.parameters.path === 'string' ? call.parameters.path : '';
        if (!deletePath) throw new Error('file_delete requires path parameter');
        try {
          await fs.unlink(deletePath);
          return { deleted: true, path: deletePath };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to delete file: ${message}`);
        }
      }
      case 'system_config': {
        const key = typeof call.parameters.key === 'string' ? call.parameters.key : '';
        try {
          const config = await loadConfig();
          if (key) {
            const value = config[key as keyof typeof config];
            return { config: { [key]: value } };
          }
          return { config };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to load config: ${message}`);
        }
      }
      case 'web_navigate':
        return webNavigateHandler(call.parameters, {
          callId: call.id,
          tokenId: '',
          agentId: call.requesting_agent,
          trustLevel: call.trust_level,
          startTime: call.timestamp,
          timeout: tool.timeout_ms || 60000,
        });
      case 'web_search':
        return webSearchHandler(call.parameters, {
          callId: call.id,
          tokenId: '',
          agentId: call.requesting_agent,
          trustLevel: call.trust_level,
          startTime: call.timestamp,
          timeout: tool.timeout_ms || 30000,
        });
      case 'web_screenshot':
        return webScreenshotHandler(call.parameters, {
          callId: call.id,
          tokenId: '',
          agentId: call.requesting_agent,
          trustLevel: call.trust_level,
          startTime: call.timestamp,
          timeout: tool.timeout_ms || 45000,
        });
      case 'web_extract':
        return webExtractHandler(call.parameters, {
          callId: call.id,
          tokenId: '',
          agentId: call.requesting_agent,
          trustLevel: call.trust_level,
          startTime: call.timestamp,
          timeout: tool.timeout_ms || 30000,
        });
      default:
        throw new Error(`Tool ${tool.id} has no implementation`);
    }
  }

  /**
   * Register a policy — queues it if PolicyEngine not yet initialized.
   */
  private _registerPolicy(policy: ToolPolicy): void {
    if (this.policyEngine) {
      this.policyEngine.registerPolicy(policy);
    } else {
      this._pendingPolicies.push(policy);
    }
  }

  /**
   * Flush queued policies into PolicyEngine once it initializes.
   */
  private _drainPolicyQueue(): void {
    if (!this.policyEngine) return;
    for (const policy of this._pendingPolicies) {
      this.policyEngine.registerPolicy(policy);
    }
    this._pendingPolicies = [];
  }

  /**
   * Register built-in tools in both legacy and new systems
   */
  private registerBuiltInTools(): void {
    // Define built-in tools with their handlers
    const builtInTools: Array<{
      definition: ToolDefinition;
      handler: ToolHandler;
    }> = [
      {
        definition: {
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
        },
        handler: async (params) => {
          const path = typeof params.path === 'string' ? params.path : '';
          if (!path) throw new Error('file_read requires path parameter');
          try {
            const content = await fs.readFile(path, 'utf-8');
            return { content, path };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read file: ${message}`);
          }
        },
      },
      {
        definition: {
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
        },
        handler: async (params) => {
          const path = typeof params.path === 'string' ? params.path : '';
          const content = typeof params.content === 'string' ? params.content : '';
          if (!path) throw new Error('file_write requires path parameter');
          if (!content) throw new Error('file_write requires content parameter');
          try {
            await fs.writeFile(path, content, 'utf-8');
            return { written: true, path, bytes: Buffer.byteLength(content) };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to write file: ${message}`);
          }
        },
      },
      {
        definition: {
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
        },
        handler: async (params) => {
          const path = typeof params.path === 'string' ? params.path : '';
          if (!path) throw new Error('file_delete requires path parameter');
          try {
            await fs.unlink(path);
            return { deleted: true, path };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete file: ${message}`);
          }
        },
      },
      {
        definition: {
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
        },
        handler: async (params) => {
          const key = typeof params.key === 'string' ? params.key : '';
          try {
            const config = await loadConfig();
            if (key) {
              const value = config[key as keyof typeof config];
              return { config: { [key]: value } };
            }
            return { config };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load config: ${message}`);
          }
        },
      },
      // ── Web Navigation Tools ────────────────────────────────────────────
      {
        definition: {
          id: 'web_navigate',
          name: 'Web Navigate',
          description: 'Navigate to a URL and interact with web pages. Supports actions: navigate, extract, screenshot, click, type, fill, select, scroll, wait, evaluate.',
          permission_tier: 'WRITE_SAFE',
          required_trust_level: 'verified',
          allowed_agents: [],
          timeout_ms: 60000,
          sandboxed: true,
          parameters: {
            url: { type: 'string', required: true, description: 'URL to visit' },
            action: { type: 'string', required: false, description: 'Action: navigate|extract|screenshot|click|type|fill|select|scroll|wait|evaluate' },
            selector: { type: 'string', required: false, description: 'CSS selector for interactive actions' },
            text: { type: 'string', required: false, description: 'Text for type/fill actions' },
            waitFor: { type: 'string', required: false, description: 'CSS selector to wait for before proceeding' },
            timeout: { type: 'number', required: false, description: 'Navigation timeout in ms (max 60000)' },
            fullPage: { type: 'boolean', required: false, description: 'Full page screenshot (default: false)' },
            script: { type: 'string', required: false, description: 'JavaScript for evaluate action (read-only)' },
          },
        },
        handler: webNavigateHandler,
      },
      {
        definition: {
          id: 'web_search',
          name: 'Web Search',
          description: 'Search the web via DuckDuckGo and return structured results. Privacy-first, no API key required.',
          permission_tier: 'READ_ONLY',
          required_trust_level: 'standard',
          allowed_agents: [],
          timeout_ms: 30000,
          sandboxed: true,
          parameters: {
            query: { type: 'string', required: true, description: 'Search query' },
            maxResults: { type: 'number', required: false, description: 'Max results to return (default 10, max 20)' },
          },
        },
        handler: webSearchHandler,
      },
      {
        definition: {
          id: 'web_screenshot',
          name: 'Web Screenshot',
          description: 'Capture a PNG screenshot of any URL with configurable viewport.',
          permission_tier: 'READ_ONLY',
          required_trust_level: 'standard',
          allowed_agents: [],
          timeout_ms: 45000,
          sandboxed: true,
          parameters: {
            url: { type: 'string', required: true, description: 'URL to capture' },
            fullPage: { type: 'boolean', required: false, description: 'Capture full page (default: false)' },
            width: { type: 'number', required: false, description: 'Viewport width (default 1280, max 1920)' },
            height: { type: 'number', required: false, description: 'Viewport height (default 720, max 1080)' },
          },
        },
        handler: webScreenshotHandler,
      },
      {
        definition: {
          id: 'web_extract',
          name: 'Web Extract',
          description: 'Extract structured content from a URL: clean text, links, headings, metadata. Fast — blocks images/fonts for speed.',
          permission_tier: 'READ_ONLY',
          required_trust_level: 'standard',
          allowed_agents: [],
          timeout_ms: 30000,
          sandboxed: true,
          parameters: {
            url: { type: 'string', required: true, description: 'URL to extract content from' },
            maxTextLength: { type: 'number', required: false, description: 'Max text length (default 50000)' },
            waitFor: { type: 'string', required: false, description: 'CSS selector to wait for before extraction' },
          },
        },
        handler: webExtractHandler,
      },
    ];

    // Register in both systems for backwards compatibility
    for (const { definition, handler } of builtInTools) {
      // Legacy system: register tool definition
      this.registerTool(definition);

      // New system: register capability and policy
      this.toolRegistry.register(
        {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          timeout_ms: definition.timeout_ms,
          sandboxed: definition.sandboxed,
          parameters: definition.parameters,
        },
        handler
      );

      this._registerPolicy({
        tool_id: definition.id,
        permission_tier: definition.permission_tier,
        required_trust_level: definition.required_trust_level,
        allowed_agents: definition.allowed_agents,
      });
    }
  }

}
