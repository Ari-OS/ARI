/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Budget endpoints (stub for future route migration)
 *
 * These endpoints currently live in routes.ts. This file exists as a
 * migration target for when routes.ts is decomposed into domain modules.
 *
 * Endpoints to migrate:
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
  // Placeholder - endpoints to be migrated from routes.ts
  // For now, routes.ts still handles these endpoints
  void options;
};
