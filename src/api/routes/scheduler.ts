/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Scheduler endpoints
 * - GET /api/scheduler/status - Scheduler status
 * - GET /api/scheduler/tasks - List scheduled tasks
 * - POST /api/scheduler/tasks/:id/trigger - Manually trigger task
 * - POST /api/scheduler/tasks/:id/toggle - Enable/disable task
 * - GET /api/scheduler/tasks/:taskId/history - Task execution history
 * - GET /api/scheduler/executions/recent - Recent task executions
 * - GET /api/scheduler/executions/stats - Execution statistics
 */
export const schedulerRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/scheduler/status', async () => {
    if (!deps.scheduler) {
      return {
        running: false,
        taskCount: 0,
        enabledCount: 0,
        nextTask: null,
      };
    }
    const status = deps.scheduler.getStatus();
    return {
      ...status,
      nextTask: status.nextTask
        ? {
            ...status.nextTask,
            nextRun: status.nextTask.nextRun.toISOString(),
          }
        : null,
    };
  });

  fastify.get('/api/scheduler/tasks', async () => {
    if (!deps.scheduler) {
      return [];
    }
    const tasks = deps.scheduler.getTasks();
    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      cron: task.cron,
      handler: task.handler,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString() ?? null,
      nextRun: task.nextRun?.toISOString() ?? null,
      metadata: task.metadata,
    }));
  });

  fastify.post<{ Params: { id: string } }>(
    '/api/scheduler/tasks/:id/trigger',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.scheduler) {
        reply.code(503);
        return { error: 'Scheduler not initialized' };
      }

      const task = deps.scheduler.getTask(id);
      if (!task) {
        reply.code(404);
        return { error: `Task ${id} not found` };
      }

      try {
        const success = await deps.scheduler.triggerTask(id);
        if (success) {
          await deps.audit.log(
            'scheduler:manual_trigger',
            'API',
            'operator',
            { taskId: id, taskName: task.name }
          );
          return { success: true, message: `Task ${task.name} triggered` };
        } else {
          reply.code(500);
          return { error: 'Failed to trigger task' };
        }
      } catch (error) {
        reply.code(500);
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/scheduler/tasks/:id/toggle',
    async (request, reply) => {
      const { id } = request.params;

      if (!deps.scheduler) {
        reply.code(503);
        return { error: 'Scheduler not initialized' };
      }

      const task = deps.scheduler.getTask(id);
      if (!task) {
        reply.code(404);
        return { error: `Task ${id} not found` };
      }

      const newEnabled = !task.enabled;
      deps.scheduler.setTaskEnabled(id, newEnabled);

      await deps.audit.log(
        'scheduler:task_toggled',
        'API',
        'operator',
        { taskId: id, enabled: newEnabled }
      );

      return {
        success: true,
        taskId: id,
        enabled: newEnabled,
      };
    }
  );

  // Execution history endpoints
  fastify.get<{ Params: { taskId: string }; Querystring: { limit?: string } }>(
    '/api/scheduler/tasks/:taskId/history',
    async (request, reply) => {
      const { taskId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      if (!deps.executionHistory) {
        reply.code(503);
        return { error: 'Execution history tracker not initialized' };
      }

      return {
        taskId,
        executions: deps.executionHistory.getTaskHistory(taskId, limit),
        stats: deps.executionHistory.getTaskStats(taskId),
      };
    }
  );

  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/scheduler/executions/recent',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      if (!deps.executionHistory) {
        return { executions: [] };
      }

      return { executions: deps.executionHistory.getRecentExecutions(limit) };
    }
  );

  fastify.get('/api/scheduler/executions/stats', async () => {
    if (!deps.executionHistory) {
      return { stats: [] };
    }

    return { stats: deps.executionHistory.getAllTaskStats() };
  });
};
