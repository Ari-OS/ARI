/* eslint-disable @typescript-eslint/require-await */
import type { FastifyPluginAsync } from 'fastify';
import type { ApiRouteOptions } from './shared.js';

/**
 * Memory endpoints
 * - GET /api/memory - Query memory entries
 * - GET /api/memory/:id - Get specific memory entry
 */
export const memoryRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify,
  options
): Promise<void> => {
  const { deps } = options;

  fastify.get<{
    Querystring: {
      type?: string;
      partition?: string;
      limit?: string;
    };
  }>('/api/memory', async (request) => {
    if (!deps.memoryManager) {
      return [];
    }

    const { type, partition, limit } = request.query;

    const queryParams: {
      type?: 'FACT' | 'PREFERENCE' | 'PATTERN' | 'CONTEXT' | 'DECISION' | 'QUARANTINE';
      partition?: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE';
      limit?: number;
    } = {};

    if (type) {
      queryParams.type = type as 'FACT' | 'PREFERENCE' | 'PATTERN' | 'CONTEXT' | 'DECISION' | 'QUARANTINE';
    }
    if (partition) {
      queryParams.partition = partition as 'PUBLIC' | 'INTERNAL' | 'SENSITIVE';
    }
    if (limit) {
      queryParams.limit = parseInt(limit, 10);
    }

    return await deps.memoryManager.query(queryParams, 'core');
  });

  fastify.get<{ Params: { id: string } }>('/api/memory/:id', async (request, reply) => {
    const { id } = request.params;

    if (!deps.memoryManager) {
      reply.code(404);
      return { error: 'Memory manager not initialized' };
    }

    const entry = await deps.memoryManager.retrieve(id, 'core');
    if (!entry) {
      reply.code(404);
      return { error: `Memory entry ${id} not found or access denied` };
    }

    return entry;
  });
};
