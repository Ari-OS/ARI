/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Subagent endpoints
 * - GET /api/subagents - List all subagents
 * - GET /api/subagents/stats - Subagent statistics
 * - GET /api/subagents/:id - Get specific subagent
 * - DELETE /api/subagents/:id - Clean up subagent
 */
export const subagentRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/subagents', async () => {
    if (!deps.agentSpawner) {
      return [];
    }
    const agents = deps.agentSpawner.getAgents();
    return agents.map((agent) => ({
      id: agent.id,
      task: agent.task,
      branch: agent.branch,
      worktreePath: agent.worktreePath,
      status: agent.status,
      createdAt: agent.createdAt.toISOString(),
      completedAt: agent.completedAt?.toISOString() ?? null,
      progress: agent.progress ?? null,
      lastMessage: agent.lastMessage ?? null,
      error: agent.error ?? null,
      tmuxSession: agent.tmuxSession ?? null,
    }));
  });

  fastify.get('/api/subagents/stats', async () => {
    if (!deps.agentSpawner) {
      return {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        spawning: 0,
      };
    }
    const agents = deps.agentSpawner.getAgents();
    return {
      total: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      completed: agents.filter((a) => a.status === 'completed').length,
      failed: agents.filter((a) => a.status === 'failed').length,
      spawning: agents.filter((a) => a.status === 'spawning').length,
    };
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/subagents/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.agentSpawner) {
        reply.code(503);
        return { error: 'Agent spawner not initialized' };
      }

      const agent = deps.agentSpawner.getAgent(id);
      if (!agent) {
        reply.code(404);
        return { error: `Subagent ${id} not found` };
      }

      return {
        id: agent.id,
        task: agent.task,
        branch: agent.branch,
        worktreePath: agent.worktreePath,
        status: agent.status,
        createdAt: agent.createdAt.toISOString(),
        completedAt: agent.completedAt?.toISOString() ?? null,
        progress: agent.progress ?? null,
        lastMessage: agent.lastMessage ?? null,
        error: agent.error ?? null,
        result: agent.result ?? null,
        tmuxSession: agent.tmuxSession ?? null,
      };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/subagents/:id',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.agentSpawner) {
        reply.code(503);
        return { error: 'Agent spawner not initialized' };
      }

      const agent = deps.agentSpawner.getAgent(id);
      if (!agent) {
        reply.code(404);
        return { error: `Subagent ${id} not found` };
      }

      if (agent.status === 'running' || agent.status === 'spawning') {
        reply.code(400);
        return { error: 'Cannot delete a running agent' };
      }

      try {
        await deps.agentSpawner.cleanup(id, { deleteBranch: true });
        await deps.audit.log('subagent:deleted', 'API', 'operator', {
          subagentId: id,
          deletedAt: new Date().toISOString(),
        });
        return { success: true, message: `Subagent ${id} cleaned up` };
      } catch (error) {
        reply.code(500);
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
};
