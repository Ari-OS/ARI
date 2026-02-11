/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Autonomous system endpoints (stub for future route migration)
 *
 * These endpoints currently live in routes.ts. This file exists as a
 * migration target for when routes.ts is decomposed into domain modules.
 *
 * Endpoints to migrate:
 * - GET /api/e2e/runs
 * - GET /api/e2e/runs/:id
 * - GET /api/e2e/status
 * - POST /api/e2e/run
 */
export const autonomousRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  // Placeholder - endpoints to be migrated from routes.ts
  // For now, routes.ts still handles these endpoints
  void options;
};
