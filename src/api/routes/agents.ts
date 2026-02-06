/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Agent endpoints
 * - GET /api/agents - List all agents
 * - GET /api/agents/:id/stats - Get agent statistics
 */
export const agentRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/agents', async () => {
    if (!deps.core) {
      return [];
    }

    const status = deps.core.getStatus();
    return status.components.map((component) => ({
      id: component.name,
      type: component.name.toUpperCase(),
      status: component.status === 'healthy' ? 'active' : 'idle',
      lastActive: new Date().toISOString(),
      tasksCompleted: (component.details as Record<string, number>)?.tasks_completed ?? 0,
      errorCount: (component.details as Record<string, number>)?.errors ?? 0,
    }));
  });

  fastify.get<{ Params: { id: string } }>('/api/agents/:id/stats', async (request, reply) => {
    const { id } = request.params;

    try {
      switch (id) {
        case 'guardian': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const guardianComponent = status.components.find((c) => c.name === 'guardian');
          if (!guardianComponent) {
            reply.code(404);
            return { error: 'Guardian not found' };
          }
          return guardianComponent.details || {};
        }
        case 'memory_manager': {
          if (!deps.memoryManager) {
            reply.code(404);
            return { error: 'Memory manager not initialized' };
          }
          return deps.memoryManager.getStats();
        }
        case 'executor': {
          if (!deps.executor) {
            reply.code(404);
            return { error: 'Executor not initialized' };
          }
          const tools = deps.executor.getTools();
          const pending = deps.executor.getPendingApprovals();
          return {
            registered_tools: tools.length,
            pending_approvals: pending.length,
          };
        }
        case 'planner': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const plannerComponent = status.components.find((c) => c.name === 'planner');
          if (!plannerComponent) {
            reply.code(404);
            return { error: 'Planner not found' };
          }
          return plannerComponent.details || {};
        }
        default:
          reply.code(404);
          return { error: `Agent ${id} not found` };
      }
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Tools endpoint (related to executor agent)
  fastify.get('/api/tools', async () => {
    if (!deps.executor) {
      return [];
    }
    return deps.executor.getTools();
  });

  // Context endpoints (related to system state)
  fastify.get('/api/contexts', async () => {
    if (!deps.storage) {
      return [];
    }
    return await deps.storage.listContexts();
  });

  fastify.get('/api/contexts/active', async () => {
    if (!deps.storage) {
      return null;
    }
    return await deps.storage.getActiveContext();
  });
};
