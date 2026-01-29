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
  });
});
