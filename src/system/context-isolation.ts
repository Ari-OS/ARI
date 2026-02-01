import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';

/**
 * Context namespaces for isolating data between different operational domains.
 * Per ADR-003: Life, Ventures, and System contexts are strictly separated.
 */
export type ContextNamespace = 'life' | 'ventures' | 'system';

/**
 * Result of an access check.
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * System agents that have special privileges in the system namespace.
 */
const SYSTEM_AGENTS: readonly AgentId[] = [
  'core',
  'arbiter',
  'overseer',
  'memory_keeper', // ECHO - the Archivist
] as const;

/**
 * Context isolation enforcer.
 *
 * Enforces strict isolation between contexts per ADR-003:
 * - Life and Ventures contexts are completely isolated from each other
 * - System context is readable by all but writable only by system agents
 * - Each agent can only access data in its assigned namespace
 *
 * This prevents data leakage between operational domains and ensures
 * proper separation of concerns.
 */
export class ContextIsolation {
  private agentNamespaces = new Map<AgentId, ContextNamespace>();

  constructor(
    private auditLogger: AuditLogger,
    private eventBus: EventBus
  ) {}

  /**
   * Assigns an agent to a specific context namespace.
   *
   * @param agent The agent to assign
   * @param namespace The namespace to assign the agent to
   */
  setAgentNamespace(agent: AgentId, namespace: ContextNamespace): void {
    const previousNamespace = this.agentNamespaces.get(agent);

    this.agentNamespaces.set(agent, namespace);

    // Audit the namespace assignment
    void this.auditLogger.log(
      'context:namespace_assigned',
      'system',
      'system',
      {
        agent,
        namespace,
        previous_namespace: previousNamespace,
      }
    );
  }

  /**
   * Checks if an agent can access a target namespace.
   *
   * Access rules:
   * - Agents can always access their own namespace
   * - Life and Ventures are isolated from each other
   * - System namespace is readable by all
   * - System namespace is writable only by system agents
   *
   * @param agent The agent attempting access
   * @param targetNamespace The namespace being accessed
   * @param write Whether this is a write operation (default: false)
   * @returns Access check result with allowed flag and reason
   */
  checkAccess(
    agent: AgentId,
    targetNamespace: ContextNamespace,
    write = false
  ): AccessCheckResult {
    const agentNamespace = this.agentNamespaces.get(agent);

    // If agent has no assigned namespace, deny access
    if (!agentNamespace) {
      return {
        allowed: false,
        reason: `Agent ${agent} has no assigned namespace`,
      };
    }

    // Same namespace: always allowed
    if (agentNamespace === targetNamespace) {
      return {
        allowed: true,
        reason: 'Agent is accessing its own namespace',
      };
    }

    // System namespace access
    if (targetNamespace === 'system') {
      if (!write) {
        // System namespace is readable by all
        return {
          allowed: true,
          reason: 'System namespace is readable by all agents',
        };
      } else {
        // System namespace is writable only by system agents
        const isSystemAgent = SYSTEM_AGENTS.includes(agent);
        return {
          allowed: isSystemAgent,
          reason: isSystemAgent
            ? 'System agent can write to system namespace'
            : 'Only system agents can write to system namespace',
        };
      }
    }

    // System agents can access any namespace (check before cross-namespace denial)
    if (SYSTEM_AGENTS.includes(agent)) {
      return {
        allowed: true,
        reason: 'System agent has cross-namespace access',
      };
    }

    // Cross-namespace access between life and ventures: denied for non-system agents
    if (
      (agentNamespace === 'life' && targetNamespace === 'ventures') ||
      (agentNamespace === 'ventures' && targetNamespace === 'life')
    ) {
      return {
        allowed: false,
        reason: `Cannot access ${targetNamespace} namespace from ${agentNamespace} namespace`,
      };
    }

    // Default deny
    return {
      allowed: false,
      reason: `Access denied from ${agentNamespace} to ${targetNamespace}`,
    };
  }

  /**
   * Gets the namespace assigned to an agent.
   *
   * @param agent The agent to query
   * @returns The agent's namespace, or undefined if not assigned
   */
  getAgentNamespace(agent: AgentId): ContextNamespace | undefined {
    return this.agentNamespaces.get(agent);
  }

  /**
   * Validates memory access for an agent.
   * Convenience method for integration with MemoryManager.
   *
   * @param agent The agent attempting to access memory
   * @param memoryNamespace The namespace of the memory being accessed
   * @param write Whether this is a write operation (default: false)
   * @returns true if access is allowed, false otherwise
   */
  validateMemoryAccess(
    agent: AgentId,
    memoryNamespace: ContextNamespace,
    write = false
  ): boolean {
    const result = this.checkAccess(agent, memoryNamespace, write);

    // Audit access attempts
    if (!result.allowed) {
      void this.auditLogger.log(
        'context:access_denied',
        agent,
        'verified',
        {
          memory_namespace: memoryNamespace,
          agent_namespace: this.agentNamespaces.get(agent),
          write,
          reason: result.reason,
        }
      );
    }

    return result.allowed;
  }
}
