/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';
import { ApproveItemSchema, RejectItemSchema } from './shared.js';

/**
 * Approval Queue endpoints — pending items, approve/reject
 */
export const approvalQueueRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/approval-queue', async () => {
    if (!deps.approvalQueue) {
      return { pending: [], history: [], stats: null };
    }

    return {
      pending: deps.approvalQueue.getPending(),
      history: deps.approvalQueue.getHistory(20),
      stats: deps.approvalQueue.getStats(),
    };
  });

  fastify.get('/api/approval-queue/pending', async () => {
    if (!deps.approvalQueue) {
      return { items: [] };
    }
    return { items: deps.approvalQueue.getPending() };
  });

  fastify.get('/api/approval-queue/stats', async () => {
    if (!deps.approvalQueue) {
      return { error: 'Approval queue not initialized' };
    }
    return deps.approvalQueue.getStats();
  });

  fastify.get<{ Params: { id: string } }>(
    '/api/approval-queue/:id',
    async (request, reply) => {
      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      const item = deps.approvalQueue.getItem(request.params.id);
      if (!item) {
        reply.code(404);
        return { error: 'Item not found' };
      }
      return item;
    }
  );

  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/approval-queue/:id/approve',
    async (request, reply) => {
      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      const parsed = ApproveItemSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      await deps.approvalQueue.approve(request.params.id, {
        note: parsed.data.note,
        approvedBy: parsed.data.approvedBy ?? 'api',
      });

      return { success: true, id: request.params.id };
    }
  );

  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/approval-queue/:id/reject',
    async (request, reply) => {
      if (!deps.approvalQueue) {
        reply.code(503);
        return { error: 'Approval queue not initialized' };
      }

      const parsed = RejectItemSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      await deps.approvalQueue.reject(request.params.id, {
        reason: parsed.data.reason,
        rejectedBy: parsed.data.rejectedBy ?? 'api',
      });

      return { success: true, id: request.params.id };
    }
  );
};
