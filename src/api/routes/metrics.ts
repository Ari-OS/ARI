/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';
import { formatUptime } from './shared.js';

/**
 * Metrics endpoints
 * - GET /api/system/metrics - System metrics (uptime, memory, etc.)
 * - GET /api/metrics - Current metrics snapshot
 * - GET /api/metrics/all - All metric definitions
 * - GET /api/metrics/:name - Time series for specific metric
 * - GET /api/metrics/history - Historical snapshots
 */
export const metricsRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/system/metrics', async () => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return {
      uptime,
      uptimeFormatted: formatUptime(uptime),
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    };
  });

  fastify.get('/api/metrics', async () => {
    if (!deps.metricsCollector) {
      return { timestamp: new Date().toISOString(), metrics: {} };
    }
    return deps.metricsCollector.getCurrent();
  });

  fastify.get('/api/metrics/all', async () => {
    if (!deps.metricsCollector) {
      return [];
    }
    return deps.metricsCollector.getDefinitions();
  });

  fastify.get<{ Params: { name: string }; Querystring: { minutes?: string } }>(
    '/api/metrics/:name',
    async (request, reply) => {
      const { name } = request.params;
      const minutes = request.query.minutes ? parseInt(request.query.minutes, 10) : 60;

      if (!deps.metricsCollector) {
        reply.code(503);
        return { error: 'Metrics collector not initialized' };
      }

      const timeSeries = deps.metricsCollector.getTimeSeries(name, minutes);
      if (!timeSeries) {
        reply.code(404);
        return { error: `Metric ${name} not found` };
      }

      return timeSeries;
    }
  );

  fastify.get<{ Querystring: { minutes?: string } }>(
    '/api/metrics/history',
    async (request) => {
      const minutes = request.query.minutes ? parseInt(request.query.minutes, 10) : 60;

      if (!deps.metricsCollector) {
        return { snapshots: [] };
      }

      return { snapshots: deps.metricsCollector.getSnapshots(minutes) };
    }
  );
};
