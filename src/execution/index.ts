/**
 * Execution Layer (Layer 5)
 *
 * Pure capability execution with token-based authorization.
 * Implements Constitutional separation from governance.
 *
 * Components:
 * - ToolRegistry: Capability catalog (what tools exist)
 * - ToolExecutor: Execution engine (runs authorized tools)
 *
 * This layer:
 * - Cannot make permission decisions (PolicyEngine does that)
 * - Cannot bypass token verification
 * - Enforces timeouts and sandboxing
 * - Reports execution results
 */

export { ToolRegistry } from './tool-registry.js';
export { ToolExecutor } from './tool-executor.js';
export type {
  ToolHandler,
  ExecutionContext,
  RegisteredTool,
  TokenVerification,
  ExecutionOptions,
  ToolStartEvent,
  ToolUpdateEvent,
  ToolEndEvent,
} from './types.js';
