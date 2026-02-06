/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Approval Queue endpoints
 *
 * TODO: Move these endpoints from routes.ts:
 * - GET /api/approval-queue
 * - GET /api/approval-queue/pending
 * - GET /api/approval-queue/stats
 * - GET /api/approval-queue/:id
 * - POST /api/approval-queue/:id/approve
 * - POST /api/approval-queue/:id/reject
 * - POST /api/approval-queue/add
 */
export const approvalQueueRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  // Placeholder - endpoints to be migrated from routes.ts (lines 2161-2367)
  // For now, routes.ts still handles these endpoints
};
