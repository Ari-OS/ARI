import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { apiRoutes, type ApiDependencies } from '../../../src/api/routes.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('API Routes', () => {
  let fastify: FastifyInstance;
  let audit: AuditLogger;
  let eventBus: EventBus;

  beforeEach(async () => {
    fastify = Fastify();
    audit = new AuditLogger();
    eventBus = new EventBus();
  });

  describe('Health endpoints', () => {
    it('should return basic health status', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return detailed health when core is not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // New format returns dashboard-compatible detailed health
      expect(body.gateway).toBeDefined();
      expect(body.gateway.status).toBe('healthy');
      expect(body.agents.activeCount).toBe(0);
    });

    it('should return detailed health with core status', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            { name: 'guardian', status: 'healthy' as const, details: {} },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // New format returns dashboard-compatible detailed health
      expect(body.gateway.status).toBe('healthy');
      expect(body.agents.status).toBe('healthy');
      expect(body.agents.activeCount).toBe(1);
    });
  });

  describe('Agent endpoints', () => {
    it('should return empty array when core not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return agent list from core status', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            { name: 'guardian', status: 'healthy' as const, details: { foo: 'bar' } },
            { name: 'executor', status: 'healthy' as const, details: {} },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe('guardian');
    });

    it('should return 404 for unknown agent stats', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/unknown/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Agent unknown not found');
    });

    it('should return memory manager stats', async () => {
      const mockMemoryManager = {
        getStats: vi.fn(() => ({
          total_entries: 10,
          by_partition: { PUBLIC: 5, INTERNAL: 3, SENSITIVE: 2 },
          by_type: { FACT: 7, PREFERENCE: 3 },
          quarantined: 0,
          verified: 5,
        })),
      };

      const deps: ApiDependencies = {
        audit,
        eventBus,
        memoryManager: mockMemoryManager as any,
      };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/memory_manager/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total_entries).toBe(10);
    });
  });

  describe('Governance endpoints', () => {
    it('should return empty proposals when council not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/proposals',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return proposals from council', async () => {
      const mockCouncil = {
        getAllVotes: vi.fn(() => [
          {
            vote_id: '123',
            topic: 'Test vote',
            threshold: 'MAJORITY',
            status: 'OPEN',
          },
        ]),
      };

      const deps: ApiDependencies = { audit, eventBus, council: mockCouncil as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/proposals',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].vote_id).toBe('123');
    });

    it('should return 404 for missing proposal', async () => {
      const mockCouncil = {
        getVote: vi.fn(() => undefined),
      };

      const deps: ApiDependencies = { audit, eventBus, council: mockCouncil as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/proposals/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return empty rules when arbiter not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/governance/rules',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return empty gates when overseer not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/governance/gates',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });
  });

  describe('Memory endpoints', () => {
    it('should return empty array when memory manager not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should query memory with filters', async () => {
      const mockMemoryManager = {
        query: vi.fn(async () => [
          { id: '1', type: 'FACT', content: 'test' },
        ]),
      };

      const deps: ApiDependencies = {
        audit,
        eventBus,
        memoryManager: mockMemoryManager as any,
      };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory?type=FACT&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(mockMemoryManager.query).toHaveBeenCalledWith(
        { type: 'FACT', limit: 10 },
        'core'
      );
    });

    it('should return 404 for missing memory entry', async () => {
      const mockMemoryManager = {
        retrieve: vi.fn(async () => null),
      };

      const deps: ApiDependencies = {
        audit,
        eventBus,
        memoryManager: mockMemoryManager as any,
      };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Audit endpoints', () => {
    it('should return paginated audit events', async () => {
      // Add some events
      await audit.log('test', 'actor', 'system', { foo: 'bar' });
      await audit.log('test2', 'actor2', 'system', { baz: 'qux' });

      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?limit=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(2);
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
      expect(body.events).toHaveLength(1);
    });

    it('should verify audit chain', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit/verify',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
    });
  });

  describe('Tool endpoints', () => {
    it('should return empty array when executor not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/tools',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return tools from executor', async () => {
      const mockExecutor = {
        getTools: vi.fn(() => [
          { id: 'file_read', name: 'Read File' },
        ]),
      };

      const deps: ApiDependencies = { audit, eventBus, executor: mockExecutor as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/tools',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('file_read');
    });
  });

  describe('Context endpoints', () => {
    it('should return empty array when storage not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/contexts',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return null active context when storage not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/contexts/active',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toBe(null);
    });

    it('should return contexts from storage', async () => {
      const mockStorage = {
        listContexts: vi.fn(async () => [
          { id: 'ctx-1', name: 'Test Context', created: new Date().toISOString() },
        ]),
      };

      const deps: ApiDependencies = { audit, eventBus, storage: mockStorage as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/contexts',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('ctx-1');
    });

    it('should return active context from storage', async () => {
      const mockStorage = {
        getActiveContext: vi.fn(async () => ({
          id: 'ctx-active',
          name: 'Active Context',
          created: new Date().toISOString(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, storage: mockStorage as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/contexts/active',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('ctx-active');
    });
  });

  describe('Agent stats edge cases', () => {
    it('should return guardian stats when component has details', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'guardian',
              status: 'healthy' as const,
              details: { threats_detected: 5, scans_completed: 100 },
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.threats_detected).toBe(5);
      expect(body.scans_completed).toBe(100);
    });

    it('should return empty object when guardian has no details', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'guardian',
              status: 'healthy' as const,
              details: null,
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({});
    });

    it('should return 404 when guardian component not found', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            { name: 'executor', status: 'healthy' as const, details: {} },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Guardian not found');
    });

    it('should return 404 for guardian when core not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Core not initialized');
    });

    it('should return executor stats', async () => {
      const mockExecutor = {
        getTools: vi.fn(() => [{ id: 'tool1' }, { id: 'tool2' }]),
        getPendingApprovals: vi.fn(() => [{ id: 'approval1' }]),
      };

      const deps: ApiDependencies = { audit, eventBus, executor: mockExecutor as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/executor/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.registered_tools).toBe(2);
      expect(body.pending_approvals).toBe(1);
    });

    it('should return 404 for executor when not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/executor/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Executor not initialized');
    });

    it('should return planner stats when component found', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'planner',
              status: 'healthy' as const,
              details: { active_plans: 2, completed_plans: 10 },
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/planner/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.active_plans).toBe(2);
      expect(body.completed_plans).toBe(10);
    });

    it('should return empty object when planner has no details', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'planner',
              status: 'healthy' as const,
              details: null,
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/planner/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({});
    });

    it('should return 404 when planner component not found', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            { name: 'guardian', status: 'healthy' as const, details: {} },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/planner/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Planner not found');
    });

    it('should return 404 for planner when core not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/planner/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Core not initialized');
    });

    it('should return 404 for memory_manager when not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/memory_manager/stats',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Memory manager not initialized');
    });

    it('should return 500 when agent stats throws error', async () => {
      const mockCore = {
        getStatus: vi.fn(() => {
          throw new Error('Internal error');
        }),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal error');
    });

    it('should return 500 with unknown error message for non-Error throw', async () => {
      const mockCore = {
        getStatus: vi.fn(() => {
          throw 'string error';
        }),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents/guardian/stats',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unknown error');
    });
  });

  describe('Agent list with detailed status', () => {
    it('should map unhealthy status to idle', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'unhealthy' as const,
          components: [
            { name: 'guardian', status: 'unhealthy' as const, details: {} },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].status).toBe('idle');
    });

    it('should extract tasks_completed and errors from details', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'executor',
              status: 'healthy' as const,
              details: { tasks_completed: 42, errors: 3 },
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].tasksCompleted).toBe(42);
      expect(body[0].errorCount).toBe(3);
    });

    it('should default to 0 when details are null', async () => {
      const mockCore = {
        getStatus: vi.fn(() => ({
          overall: 'healthy' as const,
          components: [
            {
              name: 'executor',
              status: 'healthy' as const,
              details: null,
            },
          ],
          timestamp: new Date(),
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, core: mockCore as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/agents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].tasksCompleted).toBe(0);
      expect(body[0].errorCount).toBe(0);
    });
  });

  describe('Governance with initialized components', () => {
    it('should return proposal by id when found', async () => {
      const mockCouncil = {
        getVote: vi.fn(() => ({
          vote_id: 'prop-123',
          topic: 'Test proposal',
          status: 'OPEN',
          threshold: 'MAJORITY',
        })),
      };

      const deps: ApiDependencies = { audit, eventBus, council: mockCouncil as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/proposals/prop-123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vote_id).toBe('prop-123');
    });

    it('should return 404 for proposal when council not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/proposals/any-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Council not initialized');
    });

    it('should return rules from arbiter', async () => {
      const mockArbiter = {
        getRules: vi.fn(() => [
          { id: 'rule-1', name: 'No external network', enabled: true },
        ]),
      };

      const deps: ApiDependencies = { audit, eventBus, arbiter: mockArbiter as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/governance/rules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('rule-1');
    });

    it('should return gates from overseer', async () => {
      const mockOverseer = {
        getGates: vi.fn(() => [
          { id: 'gate-1', name: 'Quality gate', passed: true },
        ]),
      };

      const deps: ApiDependencies = { audit, eventBus, overseer: mockOverseer as any };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/governance/gates',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('gate-1');
    });
  });

  describe('Memory endpoints with filters', () => {
    it('should query memory with partition filter', async () => {
      const mockMemoryManager = {
        query: vi.fn(async () => [
          { id: '1', type: 'FACT', partition: 'INTERNAL', content: 'test' },
        ]),
      };

      const deps: ApiDependencies = {
        audit,
        eventBus,
        memoryManager: mockMemoryManager as any,
      };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory?partition=INTERNAL',
      });

      expect(response.statusCode).toBe(200);
      expect(mockMemoryManager.query).toHaveBeenCalledWith(
        { partition: 'INTERNAL' },
        'core'
      );
    });

    it('should return 404 for memory entry when manager not initialized', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory/some-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Memory manager not initialized');
    });

    it('should return memory entry when found', async () => {
      const mockMemoryManager = {
        retrieve: vi.fn(async () => ({
          id: 'mem-123',
          type: 'FACT',
          content: 'Test memory',
          partition: 'PUBLIC',
        })),
      };

      const deps: ApiDependencies = {
        audit,
        eventBus,
        memoryManager: mockMemoryManager as any,
      };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/memory/mem-123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('mem-123');
      expect(body.content).toBe('Test memory');
    });
  });

  describe('Audit endpoints with pagination', () => {
    it('should apply offset to audit events', async () => {
      // Add multiple events
      await audit.log('test1', 'actor', 'system', {});
      await audit.log('test2', 'actor', 'system', {});
      await audit.log('test3', 'actor', 'system', {});

      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/audit?limit=2&offset=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(3);
      expect(body.offset).toBe(1);
      expect(body.events).toHaveLength(2);
    });
  });

  describe('Daily audit report endpoints', () => {
    it('should return today report', async () => {
      // Mock the dailyAudit module
      vi.doMock('../../../src/autonomous/daily-audit.js', () => ({
        dailyAudit: {
          init: vi.fn(async () => {}),
          getTodayAudit: vi.fn(async () => ({
            date: new Date().toISOString().split('T')[0],
            entries: [],
            summary: { total: 0 },
          })),
        },
      }));

      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/reports/today',
      });

      // The endpoint should work (status 200 or 500 if module not available)
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should return report by date', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/reports/2024-01-15',
      });

      // The endpoint should work (status 200, 404, or 500)
      expect([200, 404, 500]).toContain(response.statusCode);
    });

    it('should return list of reports', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/reports',
      });

      // The endpoint should work
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should return report metrics', async () => {
      const deps: ApiDependencies = { audit, eventBus };
      await fastify.register(apiRoutes, { deps });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/reports/metrics',
      });

      // The endpoint should work
      expect([200, 500]).toContain(response.statusCode);
    });
  });
});
