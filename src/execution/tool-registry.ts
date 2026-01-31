import { readFileSync } from 'fs';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { ToolCapability } from '../kernel/types.js';
import type { RegisteredTool, ToolHandler } from './types.js';

/**
 * Structure of tool-capabilities.json config file.
 */
interface ToolCapabilitiesConfig {
  version: string;
  description: string;
  tools: ToolCapability[];
}

/**
 * ToolRegistry - Pure capability catalog.
 *
 * Implements the Constitutional separation of powers by handling
 * ONLY tool registration and lookup. Contains NO permission logic.
 *
 * Responsibilities:
 * - Register and catalog tools
 * - Store tool definitions (parameters, timeouts, descriptions)
 * - Provide tool metadata for permission checks
 * - Store handler functions for execution
 *
 * Constitutional Alignment:
 * - Article II Section 2.4.2: ToolRegistry is the Capability Catalog
 * - Cannot make permission decisions
 * - Cannot execute tools
 * - Read-only at runtime (modifications require Council approval in future)
 */
export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Register a tool capability with its handler.
   *
   * @param capability - The tool capability definition
   * @param handler - The function that executes the tool
   */
  register(capability: ToolCapability, handler: ToolHandler): void {
    if (this.tools.has(capability.id)) {
      throw new Error(`Tool ${capability.id} is already registered`);
    }

    this.tools.set(capability.id, { capability, handler });

    void this.auditLogger.log('tool:register', 'tool_registry', 'system', {
      tool_id: capability.id,
      tool_name: capability.name,
      timeout_ms: capability.timeout_ms,
      sandboxed: capability.sandboxed,
      parameter_count: Object.keys(capability.parameters).length,
    });

    this.eventBus.emit('tool:registered', {
      toolId: capability.id,
      toolName: capability.name,
    });
  }

  /**
   * Get a registered tool by ID.
   *
   * @param toolId - The tool ID to look up
   * @returns The registered tool or undefined
   */
  get(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get just the capability for a tool (no handler).
   *
   * @param toolId - The tool ID to look up
   * @returns The tool capability or undefined
   */
  getCapability(toolId: string): ToolCapability | undefined {
    return this.tools.get(toolId)?.capability;
  }

  /**
   * Check if a tool is registered.
   *
   * @param toolId - The tool ID to check
   * @returns True if tool exists
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Get all registered tool IDs.
   */
  getToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all registered capabilities (no handlers).
   */
  getAllCapabilities(): ToolCapability[] {
    return Array.from(this.tools.values()).map((t) => t.capability);
  }

  /**
   * Get count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Unregister a tool.
   * Note: In production, this should require Council approval.
   *
   * @param toolId - The tool ID to remove
   * @returns True if tool was removed
   */
  unregister(toolId: string): boolean {
    const existed = this.tools.delete(toolId);

    if (existed) {
      void this.auditLogger.log('tool:unregister', 'tool_registry', 'system', {
        tool_id: toolId,
      });

      this.eventBus.emit('tool:unregistered', { toolId });
    }

    return existed;
  }

  /**
   * Validate tool parameters against the capability definition.
   *
   * @param toolId - The tool ID
   * @param parameters - The parameters to validate
   * @returns Validation result with any errors
   */
  validateParameters(
    toolId: string,
    parameters: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolId} not found`] };
    }

    const errors: string[] = [];
    const { capability } = tool;

    // Check required parameters
    for (const [name, spec] of Object.entries(capability.parameters)) {
      if (spec.required && !(name in parameters)) {
        errors.push(`Missing required parameter: ${name}`);
      }

      // Basic type checking
      if (name in parameters) {
        const value = parameters[name];
        const expectedType = spec.type.toLowerCase();

        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Parameter ${name} must be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Parameter ${name} must be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter ${name} must be a boolean`);
        } else if (expectedType === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Parameter ${name} must be an object`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter ${name} must be an array`);
        }
      }
    }

    // Check for unknown parameters (warning, not error)
    for (const name of Object.keys(parameters)) {
      if (!(name in capability.parameters)) {
        // Log but don't fail - allows forward compatibility
        void this.auditLogger.log('tool:unknown_parameter', 'tool_registry', 'standard', {
          tool_id: toolId,
          parameter: name,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the default timeout for a tool.
   *
   * @param toolId - The tool ID
   * @returns The timeout in ms, or default 30000
   */
  getTimeout(toolId: string): number {
    return this.tools.get(toolId)?.capability.timeout_ms ?? 30000;
  }

  /**
   * Check if a tool runs in sandbox mode.
   *
   * @param toolId - The tool ID
   * @returns True if sandboxed, false otherwise
   */
  isSandboxed(toolId: string): boolean {
    return this.tools.get(toolId)?.capability.sandboxed ?? true;
  }

  /**
   * Load tool capabilities from a JSON config file.
   * Handlers must be registered separately using registerHandler().
   *
   * @param configPath - Path to tool-capabilities.json
   * @returns Number of capabilities loaded
   */
  loadCapabilitiesFromConfig(configPath: string): number {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as ToolCapabilitiesConfig;

    let loaded = 0;
    for (const capability of config.tools) {
      // Store capability without handler (placeholder)
      if (!this.tools.has(capability.id)) {
        this.tools.set(capability.id, {
          capability,
          handler: this.createPlaceholderHandler(capability.id),
        });

        void this.auditLogger.log('tool:capability_loaded', 'tool_registry', 'system', {
          tool_id: capability.id,
          tool_name: capability.name,
          source: configPath,
        });

        loaded++;
      }
    }

    void this.auditLogger.log('tool:config_loaded', 'tool_registry', 'system', {
      config_path: configPath,
      config_version: config.version,
      tools_loaded: loaded,
    });

    return loaded;
  }

  /**
   * Register a handler for an existing capability.
   * Use this after loadCapabilitiesFromConfig() to attach handlers.
   *
   * @param toolId - The tool ID
   * @param handler - The function that executes the tool
   */
  registerHandler(toolId: string, handler: ToolHandler): void {
    const existing = this.tools.get(toolId);
    if (!existing) {
      throw new Error(`Cannot register handler: capability ${toolId} not found`);
    }

    this.tools.set(toolId, { capability: existing.capability, handler });

    void this.auditLogger.log('tool:handler_registered', 'tool_registry', 'system', {
      tool_id: toolId,
    });

    this.eventBus.emit('tool:registered', {
      toolId,
      toolName: existing.capability.name,
    });
  }

  /**
   * Check if a tool has a real handler (not placeholder).
   *
   * @param toolId - The tool ID
   * @returns True if tool has a real handler
   */
  hasHandler(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;
    // Check if it's not a placeholder handler
    return !tool.handler.toString().includes('No handler registered');
  }

  /**
   * Create a placeholder handler that throws when called.
   * Used for capabilities loaded from config before handlers are attached.
   */
  private createPlaceholderHandler(toolId: string): ToolHandler {
    return async () => {
      throw new Error(`No handler registered for tool: ${toolId}`);
    };
  }
}
