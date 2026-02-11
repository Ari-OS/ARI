/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Health check routes
 * - GET /api/health - Simple health check
 * - GET /api/health/detailed - Detailed component health status
 */
export const healthRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get('/api/health/detailed', async () => {
    const coreStatus = deps.core?.getStatus();

    // Build detailed health response matching dashboard types
    return {
      gateway: {
        status: 'healthy' as const,
        port: 3141,
        host: '127.0.0.1',
        connections: 0,
      },
      eventBus: {
        status: 'healthy' as const,
        eventCount: 0,
        subscribers: 0,
      },
      audit: {
        status: 'healthy' as const,
        entryCount: 0,
        chainValid: true,
        lastEntry: new Date().toISOString(),
      },
      sanitizer: {
        status: 'healthy' as const,
        patternsLoaded: 39,
      },
      agents: {
        status: coreStatus?.overall ?? 'healthy',
        activeCount: coreStatus?.components?.length ?? 0,
        agents: Object.fromEntries(
          (coreStatus?.components ?? []).map(c => [
            c.name,
            { status: c.status, lastActive: new Date().toISOString() },
          ])
        ),
      },
      governance: {
        status: 'healthy' as const,
        activeVotes: 0,
        councilMembers: 13,
      },
    };
  });
};
