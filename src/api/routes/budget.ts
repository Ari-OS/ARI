/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Budget endpoints
 *
 * TODO: Move these endpoints from routes.ts:
 * - GET /api/budget/status
 * - GET /api/budget/history
 * - POST /api/budget/profile
 * - GET /api/budget/can-proceed
 * - GET /api/budget/state
 * - GET /api/budget/recommended-model
 * - PUT /api/budget/config
 * - GET /api/ai/circuit-breaker
 */
export const budgetRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // Placeholder - endpoints to be migrated from routes.ts (lines 1893-2160)
  // For now, routes.ts still handles these endpoints
};
