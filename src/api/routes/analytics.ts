/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Analytics endpoints (stub for future route migration)
 *
 * These endpoints currently live in routes.ts. This file exists as a
 * migration target for when routes.ts is decomposed into domain modules.
 *
 * Endpoints to migrate:
 * - GET /api/billing/cycle
 * - POST /api/billing/new-cycle
 * - GET /api/analytics/value
 * - GET /api/analytics/value/daily
 * - GET /api/analytics/value/today
 * - GET /api/analytics/value/weekly
 * - GET /api/adaptive/patterns
 * - GET /api/adaptive/recommendations
 * - GET /api/adaptive/summaries
 * - GET /api/adaptive/peak-hours
 * - GET /api/adaptive/summary
 * - GET /api/adaptive/model/:taskType
 */
export const analyticsRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  // Placeholder - endpoints to be migrated from routes.ts
  // For now, routes.ts still handles these endpoints
  void options;
};
