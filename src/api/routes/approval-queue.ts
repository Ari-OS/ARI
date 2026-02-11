/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Approval Queue endpoints (stub for future route migration)
 *
 * These endpoints currently live in routes.ts. This file exists as a
 * migration target for when routes.ts is decomposed into domain modules.
 *
 * Endpoints to migrate:
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
  // Placeholder - endpoints to be migrated from routes.ts
  // For now, routes.ts still handles these endpoints
  void options;
};
