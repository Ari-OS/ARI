/**
 * Execution Layer Types
 *
 * Types specific to the execution layer that are not shared
 * with the kernel or other layers.
 */

import type { AgentId, TrustLevel, ToolCallToken, ToolCapability } from '../kernel/types.js';

/**
 * Handler function signature for tool execution.
 */
export type ToolHandler = (
  parameters: Record<string, unknown>,
  context: ExecutionContext
) => Promise<unknown>;

/**
 * Context provided to tool handlers during execution.
 */
export interface ExecutionContext {
  callId: string;
  tokenId: string;
  agentId: AgentId;
  trustLevel: TrustLevel;
  startTime: Date;
  timeout: number;
  sessionId?: string;
}

/**
 * Internal representation of a registered tool with handler.
 */
export interface RegisteredTool {
  capability: ToolCapability;
  handler: ToolHandler;
}

/**
 * Result of token verification before execution.
 */
export interface TokenVerification {
  valid: boolean;
  reason: string;
  token?: ToolCallToken;
}

/**
 * Options for tool execution.
 */
export interface ExecutionOptions {
  callId?: string;
  sessionId?: string;
  timeout?: number;
}

/**
 * Event emitted when tool execution starts.
 */
export interface ToolStartEvent {
  callId: string;
  toolId: string;
  toolName: string;
  agent: AgentId;
  sessionId?: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Event emitted for execution progress updates.
 */
export interface ToolUpdateEvent {
  callId: string;
  toolId: string;
  status: 'running' | 'processing';
  progress?: number;
  message?: string;
  timestamp: Date;
}

/**
 * Event emitted when tool execution completes.
 */
export interface ToolEndEvent {
  callId: string;
  toolId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
  timestamp: Date;
}
