/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Analytics endpoints
 * Value analytics, adaptive learning, billing cycles
 *
 * TODO: Move these endpoints from routes.ts:
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
  const { deps } = options;

  // Placeholder - endpoints to be migrated from routes.ts (lines 2369-2589)
  // For now, routes.ts still handles these endpoints
};
