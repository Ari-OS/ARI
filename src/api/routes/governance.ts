/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Governance endpoints
 * - GET /api/proposals - List all proposals/votes
 * - GET /api/proposals/:id - Get specific proposal
 * - GET /api/governance/rules - Get constitutional rules
 * - GET /api/governance/gates - Get quality gates
 */
export const governanceRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get('/api/proposals', async () => {
    if (!deps.council) {
      return [];
    }
    return deps.council.getAllVotes();
  });

  fastify.get<{ Params: { id: string } }>('/api/proposals/:id', async (request, reply) => {
    const { id } = request.params;

    if (!deps.council) {
      reply.code(404);
      return { error: 'Council not initialized' };
    }

    const vote = deps.council.getVote(id);
    if (!vote) {
      reply.code(404);
      return { error: `Proposal ${id} not found` };
    }

    return vote;
  });

  fastify.get('/api/governance/rules', async () => {
    if (!deps.arbiter) {
      return [];
    }
    return deps.arbiter.getRules();
  });

  fastify.get('/api/governance/gates', async () => {
    if (!deps.overseer) {
      return [];
    }
    return deps.overseer.getGates();
  });

  fastify.post<{ Params: { id: string }, Body: { reasoning?: string } }>('/api/proposals/:id/approve', async (request, reply) => {
    const { id } = request.params;
    const { reasoning = 'Approved via Dashboard' } = request.body;

    if (!deps.council) {
      reply.code(404);
      return { error: 'Council not initialized' };
    }

    const success = deps.council.operatorOverride(id, 'APPROVE', reasoning);
    if (!success) {
      reply.code(400);
      return { error: 'Failed to cast vote. Vote may be closed or invalid.' };
    }

    return { success: true, id };
  });

  fastify.post<{ Params: { id: string }, Body: { reasoning?: string } }>('/api/proposals/:id/reject', async (request, reply) => {
    const { id } = request.params;
    const { reasoning = 'Rejected via Dashboard' } = request.body;

    if (!deps.council) {
      reply.code(404);
      return { error: 'Council not initialized' };
    }

    const success = deps.council.operatorOverride(id, 'REJECT', reasoning);
    if (!success) {
      reply.code(400);
      return { error: 'Failed to cast vote. Vote may be closed or invalid.' };
    }

    return { success: true, id };
  });
};
