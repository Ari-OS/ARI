/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Autonomous system endpoints
 * E2E testing, autonomous operations
 *
 * TODO: Move these endpoints from routes.ts:
 * - GET /api/e2e/runs
 * - GET /api/e2e/runs/:id
 * - GET /api/e2e/status
 * - POST /api/e2e/run
 */
export const autonomousRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // Placeholder - endpoints to be migrated from routes.ts (lines 2591-2825)
  // For now, routes.ts still handles these endpoints
};
