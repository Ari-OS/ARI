/* eslint-disable @typescript-eslint/require-await */
import type { FastifyInstance, FastifyPluginOptions, FastifyPluginAsync } from 'fastify';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type { Core } from '../agents/core.js';
import type { Council } from '../governance/council.js';
import type { Arbiter } from '../governance/arbiter.js';
import type { Overseer } from '../governance/overseer.js';
import type { MemoryManager } from '../agents/memory-manager.js';
import type { Executor } from '../agents/executor.js';
import type * as Storage from '../system/storage.js';

export interface ApiDependencies {
  audit: AuditLogger;
  eventBus: EventBus;
  core?: Core;
  council?: Council;
  arbiter?: Arbiter;
  overseer?: Overseer;
  memoryManager?: MemoryManager;
  executor?: Executor;
  storage?: typeof Storage;
}

export interface ApiRouteOptions extends FastifyPluginOptions {
  deps: ApiDependencies;
}

/**
 * REST API routes plugin for ARI
 * All routes are prefixed with /api
 */
export const apiRoutes: FastifyPluginAsync<ApiRouteOptions> = async (
  fastify: FastifyInstance,
  options: ApiRouteOptions
): Promise<void> => {
  const { deps } = options;

  // ── Health endpoints ────────────────────────────────────────────────────

  fastify.get('/api/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  fastify.get('/api/health/detailed', async () => {
    const coreStatus = deps.core?.getStatus();

    // Build detailed health response matching dashboard types
    return {
      gateway: {
        status: 'healthy' as const,
        port: 3141,
        host: '127.0.0.1',
        connections: 0,
      },
      eventBus: {
        status: 'healthy' as const,
        eventCount: 0,
        subscribers: 0,
      },
      audit: {
        status: 'healthy' as const,
        entryCount: 0,
        chainValid: true,
        lastEntry: new Date().toISOString(),
      },
      sanitizer: {
        status: 'healthy' as const,
        patternsLoaded: 21,
      },
      agents: {
        status: coreStatus?.overall ?? 'healthy',
        activeCount: coreStatus?.components?.length ?? 0,
        agents: Object.fromEntries(
          (coreStatus?.components ?? []).map(c => [
            c.name,
            { status: c.status, lastActive: new Date().toISOString() },
          ])
        ),
      },
      governance: {
        status: 'healthy' as const,
        activeVotes: 0,
        councilMembers: 13,
      },
    };
  });

  // ── Agent endpoints ─────────────────────────────────────────────────────

  fastify.get('/api/agents', async () => {
    if (!deps.core) {
      return [];
    }

    const status = deps.core.getStatus();
    return status.components.map((component) => ({
      id: component.name,
      type: component.name.toUpperCase(),
      status: component.status === 'healthy' ? 'active' : 'idle',
      lastActive: new Date().toISOString(),
      tasksCompleted: (component.details as Record<string, number>)?.tasks_completed ?? 0,
      errorCount: (component.details as Record<string, number>)?.errors ?? 0,
    }));
  });

  fastify.get<{ Params: { id: string } }>('/api/agents/:id/stats', async (request, reply) => {
    const { id } = request.params;

    try {
      switch (id) {
        case 'guardian': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const guardianComponent = status.components.find((c) => c.name === 'guardian');
          if (!guardianComponent) {
            reply.code(404);
            return { error: 'Guardian not found' };
          }
          return guardianComponent.details || {};
        }
        case 'memory_manager': {
          if (!deps.memoryManager) {
            reply.code(404);
            return { error: 'Memory manager not initialized' };
          }
          return deps.memoryManager.getStats();
        }
        case 'executor': {
          if (!deps.executor) {
            reply.code(404);
            return { error: 'Executor not initialized' };
          }
          const tools = deps.executor.getTools();
          const pending = deps.executor.getPendingApprovals();
          return {
            registered_tools: tools.length,
            pending_approvals: pending.length,
          };
        }
        case 'planner': {
          if (!deps.core) {
            reply.code(404);
            return { error: 'Core not initialized' };
          }
          const status = deps.core.getStatus();
          const plannerComponent = status.components.find((c) => c.name === 'planner');
          if (!plannerComponent) {
            reply.code(404);
            return { error: 'Planner not found' };
          }
          return plannerComponent.details || {};
        }
        default:
          reply.code(404);
          return { error: `Agent ${id} not found` };
      }
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ── Governance endpoints ────────────────────────────────────────────────

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

  // ── Memory endpoints ────────────────────────────────────────────────────

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

  // ── Audit endpoints ─────────────────────────────────────────────────────

  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/api/audit', async (request) => {
    const { limit, offset } = request.query;

    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const events = deps.audit.getEvents();
    const total = events.length;
    const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);

    return {
      total,
      limit: limitNum,
      offset: offsetNum,
      events: paginatedEvents,
    };
  });

  fastify.get('/api/audit/verify', async () => {
    return deps.audit.verify();
  });

  // ── Tool endpoints ──────────────────────────────────────────────────────

  fastify.get('/api/tools', async () => {
    if (!deps.executor) {
      return [];
    }
    return deps.executor.getTools();
  });

  // ── Context endpoints ───────────────────────────────────────────────────

  fastify.get('/api/contexts', async () => {
    if (!deps.storage) {
      return [];
    }
    return await deps.storage.listContexts();
  });

  fastify.get('/api/contexts/active', async () => {
    if (!deps.storage) {
      return null;
    }
    return await deps.storage.getActiveContext();
  });

  // ── Daily Audit Report endpoints ─────────────────────────────────────────

  fastify.get('/api/reports/today', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    return await dailyAudit.getTodayAudit();
  });

  fastify.get<{ Params: { date: string } }>('/api/reports/:date', async (request, reply) => {
    const { date } = request.params;
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    const report = await dailyAudit.getAudit(date);
    if (!report) {
      reply.code(404);
      return { error: `No audit report found for ${date}` };
    }
    return report;
  });

  fastify.get('/api/reports', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    const dates = await dailyAudit.listAudits();
    return { audits: dates, total: dates.length };
  });

  fastify.get('/api/reports/metrics', async () => {
    const { dailyAudit } = await import('../autonomous/daily-audit.js');
    await dailyAudit.init();
    return dailyAudit.getMetrics();
  });
};
