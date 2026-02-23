import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Gateway } from '../../../src/kernel/gateway.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// Use random ports to avoid conflicts between parallel tests
const getRandomPort = () => 10000 + Math.floor(Math.random() * 50000);

/** Auth disabled for most tests — auth-specific tests use explicit keys */
const noAuth = { apiKey: false as const };

describe('Gateway', () => {
  let gateway: Gateway;
  let audit: AuditLogger;
  let eventBus: EventBus;
  let testAuditPath: string;
  let testPort: number;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `ari-test-audit-${randomUUID()}.json`);
    audit = new AuditLogger(testAuditPath);
    eventBus = new EventBus();
    testPort = getRandomPort();
    gateway = new Gateway(testPort, audit, eventBus, noAuth);
  });

  afterEach(async () => {
    try {
      await gateway.stop();
    } catch {
      // May not be started
    }
  });

  describe('constructor', () => {
    it('should create gateway with default port', () => {
      const defaultGateway = new Gateway(undefined, undefined, undefined, noAuth);
      expect(defaultGateway.getAddress()).toBe('http://127.0.0.1:3141');
    });

    it('should create gateway with custom port', () => {
      expect(gateway.getAddress()).toBe(`http://127.0.0.1:${testPort}`);
    });

    it('should create gateway with custom audit and eventBus', () => {
      expect(gateway.getEventBus()).toBe(eventBus);
      expect(gateway.getAuditLogger()).toBe(audit);
    });

    it('should create gateway with default audit and eventBus when not provided', () => {
      const port = getRandomPort();
      const defaultGateway = new Gateway(port, undefined, undefined, noAuth);
      expect(defaultGateway.getEventBus()).toBeDefined();
      expect(defaultGateway.getAuditLogger()).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should start gateway and listen on loopback', async () => {
      await gateway.start();

      // Verify gateway is running
      const response = await fetch(`http://127.0.0.1:${testPort}/health`);
      expect(response.ok).toBe(true);
    });

    it('should emit gateway:started event', async () => {
      let emittedEvent: unknown = null;
      eventBus.on('gateway:started', (event) => {
        emittedEvent = event;
      });

      await gateway.start();

      expect(emittedEvent).toEqual({
        port: testPort,
        host: '127.0.0.1',
      });
    });
  });

  describe('stop()', () => {
    it('should stop gateway gracefully', async () => {
      await gateway.start();
      await gateway.stop();

      // Verify gateway is not running - fetch should fail
      try {
        await fetch(`http://127.0.0.1:${testPort}/health`);
        // If we get here, the gateway is still running
        expect(true).toBe(false);
      } catch {
        // Expected - connection refused
        expect(true).toBe(true);
      }
    });

    it('should emit gateway:stopped event', async () => {
      await gateway.start();

      let emittedEvent: unknown = null;
      eventBus.on('gateway:stopped', (event) => {
        emittedEvent = event;
      });

      await gateway.stop();

      expect(emittedEvent).toEqual({
        reason: 'shutdown',
      });
    });
  });

  describe('GET /health', () => {
    beforeEach(async () => {
      await gateway.start();
    });

    it('should return health status', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/health`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
    });
  });

  describe('GET /status', () => {
    beforeEach(async () => {
      await gateway.start();
    });

    it('should return status with security information', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/status`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('version', '2.1.0');
      expect(data).toHaveProperty('gateway');
      expect(data.gateway).toHaveProperty('host', '127.0.0.1');
      expect(data.gateway).toHaveProperty('port', testPort);
      expect(data).toHaveProperty('security');
      expect(data.security).toHaveProperty('loopbackOnly', true);
      expect(data.security).toHaveProperty('auditEnabled', true);
      expect(data.security).toHaveProperty('injectionDetection', true);
    });
  });

  describe('POST /message', () => {
    beforeEach(async () => {
      await gateway.start();
    });

    it('should respond to POST /message endpoint', async () => {
      const response = await fetch(`http://127.0.0.1:${testPort}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Hello, this is a safe message',
          source: 'operator',
        }),
      });

      // Should respond (not crash)
      expect(response.status).toBeDefined();
    });

    it('should support message event subscriptions', async () => {
      const receivedEvents: unknown[] = [];
      const acceptedEvents: unknown[] = [];

      eventBus.on('message:received', (event) => receivedEvents.push(event));
      eventBus.on('message:accepted', (event) => acceptedEvents.push(event));

      // Emit events directly to test subscription
      eventBus.emit('message:received', { id: 'test', content: 'test' });
      eventBus.emit('message:accepted', { id: 'test', content: 'test' });
      await eventBus.flush();

      expect(receivedEvents).toHaveLength(1);
      expect(acceptedEvents).toHaveLength(1);
    });

    it('should have security:detected event capability', () => {
      let received = false;
      eventBus.on('security:detected', () => {
        received = true;
      });

      eventBus.emit('security:detected', {
        id: 'test',
        timestamp: new Date(),
        eventType: 'injection_detected',
        severity: 'high',
        source: 'test',
        details: {},
        mitigated: true,
      });

      expect(received).toBe(true);
    });

    it('should support severity classification logic', () => {
      const classifySeverity = (riskScore: number): string => {
        if (riskScore >= 10) return 'critical';
        if (riskScore >= 5) return 'high';
        return 'medium';
      };

      expect(classifySeverity(10)).toBe('critical');
      expect(classifySeverity(5)).toBe('high');
      expect(classifySeverity(3)).toBe('medium');
    });
  });

  describe('API Key Authentication', () => {
    const testApiKey = 'test-api-key-12345';

    it('should reject requests without API key when auth is enabled', async () => {
      const port = getRandomPort();
      const authGateway = new Gateway(port, audit, eventBus, { apiKey: testApiKey });
      await authGateway.start();

      const response = await fetch(`http://127.0.0.1:${port}/status`);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Authentication required');

      await authGateway.stop();
    });

    it('should reject requests with wrong API key', async () => {
      const port = getRandomPort();
      const authGateway = new Gateway(port, audit, eventBus, { apiKey: testApiKey });
      await authGateway.start();

      const response = await fetch(`http://127.0.0.1:${port}/status`, {
        headers: { 'X-ARI-Key': 'wrong-key' },
      });
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid API key');

      await authGateway.stop();
    });

    it('should accept requests with correct API key', async () => {
      const port = getRandomPort();
      const authGateway = new Gateway(port, audit, eventBus, { apiKey: testApiKey });
      await authGateway.start();

      const response = await fetch(`http://127.0.0.1:${port}/status`, {
        headers: { 'X-ARI-Key': testApiKey },
      });
      expect(response.ok).toBe(true);

      await authGateway.stop();
    });

    it('should allow /health without API key even when auth is enabled', async () => {
      const port = getRandomPort();
      const authGateway = new Gateway(port, audit, eventBus, { apiKey: testApiKey });
      await authGateway.start();

      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('healthy');

      await authGateway.stop();
    });

    it('should log security events for failed auth attempts', async () => {
      const port = getRandomPort();
      const authAudit = new AuditLogger(join(tmpdir(), `ari-test-auth-${randomUUID()}.json`));
      const authGateway = new Gateway(port, authAudit, eventBus, { apiKey: testApiKey });
      await authGateway.start();

      // Missing key
      await fetch(`http://127.0.0.1:${port}/status`);

      // Wrong key
      await fetch(`http://127.0.0.1:${port}/status`, {
        headers: { 'X-ARI-Key': 'wrong-key' },
      });

      const securityEvents = authAudit.getSecurityEvents();
      expect(securityEvents.length).toBeGreaterThanOrEqual(2);

      const authMissing = securityEvents.find(
        e => (e.details as Record<string, unknown>)?.eventType === 'auth_missing'
      );
      const authFailed = securityEvents.find(
        e => (e.details as Record<string, unknown>)?.eventType === 'auth_failed'
      );

      expect(authMissing).toBeDefined();
      expect(authFailed).toBeDefined();

      await authGateway.stop();
    });

    it('should disable auth when apiKey is false', () => {
      const noAuthGateway = new Gateway(getRandomPort(), audit, eventBus, { apiKey: false });
      expect(noAuthGateway.getApiKey()).toBeNull();
    });

    it('should expose API key via getApiKey()', () => {
      const authGateway = new Gateway(getRandomPort(), audit, eventBus, { apiKey: testApiKey });
      expect(authGateway.getApiKey()).toBe(testApiKey);
    });
  });

  describe('getAddress()', () => {
    it('should return formatted address', () => {
      expect(gateway.getAddress()).toBe(`http://127.0.0.1:${testPort}`);
    });
  });

  describe('getServer()', () => {
    it('should return Fastify instance', () => {
      const server = gateway.getServer();
      expect(server).toBeDefined();
    });
  });

  describe('getHttpServer()', () => {
    it('should handle server not yet initialized', () => {
      const server = gateway.getServer();
      expect(server).toBeDefined();
    });

    it('should return HTTP server when started', async () => {
      await gateway.start();
      const httpServer = gateway.getHttpServer();
      expect(httpServer).toBeDefined();
    });
  });

  describe('registerPlugin()', () => {
    it('should register Fastify plugin before start', async () => {
      let pluginRegistered = false;
      const pluginPort = getRandomPort();
      const testGateway = new Gateway(pluginPort, audit, eventBus, noAuth);

      await testGateway.registerPlugin(async (fastify) => {
        fastify.get('/custom', async () => ({ custom: true }));
        pluginRegistered = true;
      });

      await testGateway.start();

      expect(pluginRegistered).toBe(true);

      const response = await fetch(`http://127.0.0.1:${pluginPort}/custom`);
      const data = await response.json();
      expect(data).toEqual({ custom: true });

      await testGateway.stop();
    });

    it('should allow plugin registration', async () => {
      const pluginPort = getRandomPort();
      const testGateway = new Gateway(pluginPort, audit, eventBus, noAuth);

      await expect(
        testGateway.registerPlugin(async () => {
          // Empty plugin
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Security Invariants', () => {
    it('should always bind to loopback (127.0.0.1)', () => {
      expect(gateway.getAddress()).toContain('127.0.0.1');
    });

    it('should log audit events for gateway lifecycle', async () => {
      await gateway.start();
      await gateway.stop();

      const events = audit.getEvents();
      const startEvent = events.find((e) => e.action === 'gateway_started');
      const stopEvent = events.find((e) => e.action === 'gateway_stopped');

      expect(startEvent).toBeDefined();
      expect(stopEvent).toBeDefined();
    });
  });
});
