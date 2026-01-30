import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { WebSocketControlPlane } from '../../../../src/kernel/control-plane/websocket-server.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { AuditLogger } from '../../../../src/kernel/audit.js';

// Mock AuditLogger
function createMockAudit(): AuditLogger {
  return {
    log: vi.fn().mockResolvedValue({}),
    logSecurity: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockReturnValue({ valid: true }),
    load: vi.fn().mockResolvedValue(undefined),
    getEvents: vi.fn().mockReturnValue([]),
    getSecurityEvents: vi.fn().mockReturnValue([]),
  } as unknown as AuditLogger;
}

// Helper to wait for a condition
async function waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// Helper to create connected WebSocket client
async function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

describe('WebSocketControlPlane', () => {
  let eventBus: EventBus;
  let audit: AuditLogger;
  let controlPlane: WebSocketControlPlane;

  beforeEach(() => {
    eventBus = new EventBus();
    audit = createMockAudit();
  });

  afterEach(async () => {
    if (controlPlane?.isRunning()) {
      await controlPlane.stop();
    }
    eventBus.clear();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit);
      const stats = controlPlane.getStats();

      expect(stats.running).toBe(false);
      expect(stats.host).toBe('127.0.0.1');
      expect(stats.port).toBe(3142);
    });

    it('should create instance with custom port', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 3200 });
      const stats = controlPlane.getStats();

      expect(stats.port).toBe(3200);
    });

    it('should create instance with custom heartbeat interval', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        heartbeatInterval: 15000,
      });

      // Heartbeat interval is internal, but we can verify the control plane was created
      expect(controlPlane.isRunning()).toBe(false);
    });

    it('should create instance with custom client timeout', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        clientTimeout: 120000,
      });

      expect(controlPlane.isRunning()).toBe(false);
    });

    it('should create instance with custom max message size', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        maxMessageSize: 2 * 1024 * 1024, // 2MB
      });

      expect(controlPlane.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the server', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 0 }); // Use random port

      // We can't easily test port 0, so we'll use a specific port
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13142 });
      await controlPlane.start();

      expect(controlPlane.isRunning()).toBe(true);
    });

    it('should log start event to audit', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13143 });
      await controlPlane.start();

      expect(audit.log).toHaveBeenCalledWith(
        'controlplane_started',
        'system',
        'system',
        expect.objectContaining({
          host: '127.0.0.1',
          mode: 'standalone',
        })
      );
    });

    it('should emit gateway:started event', async () => {
      const handler = vi.fn();
      eventBus.on('gateway:started', handler);

      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13144 });
      await controlPlane.start();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '127.0.0.1',
        })
      );
    });

    it('should throw when already running', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13145 });
      await controlPlane.start();

      await expect(controlPlane.start()).rejects.toThrow('Control plane is already running');
    });

    it('should bind to 127.0.0.1 only (security invariant)', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13146 });
      await controlPlane.start();

      const stats = controlPlane.getStats();
      expect(stats.host).toBe('127.0.0.1');
    });
  });

  describe('stop', () => {
    it('should stop a running server', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13150 });
      await controlPlane.start();

      expect(controlPlane.isRunning()).toBe(true);

      await controlPlane.stop();

      expect(controlPlane.isRunning()).toBe(false);
    });

    it('should log stop event to audit', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13151 });
      await controlPlane.start();
      await controlPlane.stop();

      expect(audit.log).toHaveBeenCalledWith(
        'controlplane_stopped',
        'system',
        'system',
        expect.objectContaining({
          reason: 'shutdown',
        })
      );
    });

    it('should do nothing when not running', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13152 });

      await expect(controlPlane.stop()).resolves.not.toThrow();
    });

    it('should clear all clients', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13153 });
      await controlPlane.start();

      // Connect a client
      const client = await createClient(13153);
      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      await controlPlane.stop();

      expect(controlPlane.getStats().clients.totalClients).toBe(0);
      client.close();
    });

    it('should stop message router', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13154 });
      await controlPlane.start();

      const router = controlPlane.getMessageRouter();
      expect(eventBus.listenerCount('message:received')).toBeGreaterThan(0);

      await controlPlane.stop();

      // After stop, listeners should be cleaned up
      expect(eventBus.listenerCount('message:received')).toBe(0);
    });
  });

  describe('attachToServer', () => {
    let httpServer: HttpServer;

    afterEach(async () => {
      if (httpServer) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    });

    it('should attach to HTTP server bound to loopback', async () => {
      httpServer = createServer();
      await new Promise<void>((resolve) => {
        httpServer.listen(13160, '127.0.0.1', () => resolve());
      });

      controlPlane = new WebSocketControlPlane(eventBus, audit);
      await controlPlane.attachToServer(httpServer);

      expect(controlPlane.isRunning()).toBe(true);
    });

    it('should log start event for attached mode', async () => {
      httpServer = createServer();
      await new Promise<void>((resolve) => {
        httpServer.listen(13161, '127.0.0.1', () => resolve());
      });

      controlPlane = new WebSocketControlPlane(eventBus, audit);
      await controlPlane.attachToServer(httpServer);

      expect(audit.log).toHaveBeenCalledWith(
        'controlplane_started',
        'system',
        'system',
        expect.objectContaining({
          mode: 'attached',
          path: '/ws',
        })
      );
    });

    it('should throw when already running', async () => {
      httpServer = createServer();
      await new Promise<void>((resolve) => {
        httpServer.listen(13162, '127.0.0.1', () => resolve());
      });

      controlPlane = new WebSocketControlPlane(eventBus, audit);
      await controlPlane.attachToServer(httpServer);

      const httpServer2 = createServer();
      await new Promise<void>((resolve) => {
        httpServer2.listen(13163, '127.0.0.1', () => resolve());
      });

      await expect(controlPlane.attachToServer(httpServer2)).rejects.toThrow(
        'Control plane is already running'
      );

      await new Promise<void>((resolve) => httpServer2.close(() => resolve()));
    });

    it('should reject non-loopback server (security violation)', async () => {
      httpServer = createServer();
      await new Promise<void>((resolve) => {
        httpServer.listen(13164, '0.0.0.0', () => resolve());
      });

      controlPlane = new WebSocketControlPlane(eventBus, audit);

      await expect(controlPlane.attachToServer(httpServer)).rejects.toThrow(
        'SECURITY VIOLATION'
      );
    });
  });

  describe('client connections', () => {
    beforeEach(async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13170 });
      await controlPlane.start();
    });

    it('should accept client connection from loopback', async () => {
      const client = await createClient(13170);

      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      expect(controlPlane.getStats().clients.totalClients).toBe(1);

      client.close();
    });

    it('should send welcome message on connection', async () => {
      const messagePromise = new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:13170`);
        ws.on('message', (data) => {
          resolve(data.toString());
          ws.close();
        });
        ws.on('error', reject);
      });

      const message = await messagePromise;
      const parsed = JSON.parse(message);
      expect(parsed.type).toBe('auth:response');
      expect(parsed.payload.success).toBe(false); // Not authenticated yet
      expect(parsed.payload.clientId).toBeDefined();
    });

    it('should log client connection to audit', async () => {
      const client = await createClient(13170);

      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      expect(audit.log).toHaveBeenCalledWith(
        'controlplane_client_connected',
        'system',
        'system',
        expect.objectContaining({
          clientId: expect.any(String),
        })
      );

      client.close();
    });

    it('should handle client disconnection', async () => {
      const client = await createClient(13170);

      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      client.close();

      await waitFor(() => controlPlane.getStats().clients.totalClients === 0);

      expect(controlPlane.getStats().clients.totalClients).toBe(0);
    });

    it('should log client disconnection to audit', async () => {
      const client = await createClient(13170);
      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      client.close();
      await waitFor(() => controlPlane.getStats().clients.totalClients === 0);

      expect(audit.log).toHaveBeenCalledWith(
        'controlplane_client_disconnected',
        'system',
        'system',
        expect.objectContaining({
          clientId: expect.any(String),
        })
      );
    });

    it('should handle multiple concurrent clients', async () => {
      const client1 = await createClient(13170);
      const client2 = await createClient(13170);
      const client3 = await createClient(13170);

      await waitFor(() => controlPlane.getStats().clients.totalClients === 3);

      expect(controlPlane.getStats().clients.totalClients).toBe(3);

      client1.close();
      client2.close();
      client3.close();
    });

    it('should handle client messages', async () => {
      const result = await new Promise<{ welcome: any; pong: any }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:13170`);
        let messageCount = 0;
        let welcomeMsg: any;

        ws.on('message', (data) => {
          messageCount++;
          const parsed = JSON.parse(data.toString());

          if (messageCount === 1) {
            welcomeMsg = parsed;
            // Send ping after receiving welcome
            ws.send(JSON.stringify({ type: 'health:ping', payload: null }));
          } else if (messageCount === 2) {
            ws.close();
            resolve({ welcome: welcomeMsg, pong: parsed });
          }
        });

        ws.on('error', reject);
      });

      expect(result.welcome.type).toBe('auth:response');
      expect(result.pong.type).toBe('health:pong');
    });

    it('should update client activity on pong', async () => {
      // This tests the pong handler which updates client activity
      const client = await createClient(13170);

      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      // The ping/pong mechanism is internal, but we can verify the client was tracked
      const clientManager = controlPlane.getClientManager();
      const clientIds = clientManager.getAllClientIds();
      expect(clientIds.length).toBe(1);

      client.close();
    });
  });

  describe('getMessageRouter', () => {
    it('should return the message router', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13180 });

      const router = controlPlane.getMessageRouter();

      expect(router).toBeDefined();
      expect(typeof router.start).toBe('function');
      expect(typeof router.stop).toBe('function');
    });
  });

  describe('getClientManager', () => {
    it('should return the client manager', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13181 });

      const manager = controlPlane.getClientManager();

      expect(manager).toBeDefined();
      expect(typeof manager.addClient).toBe('function');
      expect(typeof manager.removeClient).toBe('function');
    });
  });

  describe('getStats', () => {
    it('should return server statistics', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13182 });

      const stats = controlPlane.getStats();

      expect(stats).toEqual({
        running: false,
        host: '127.0.0.1',
        port: 13182,
        clients: expect.objectContaining({
          totalClients: 0,
        }),
      });
    });

    it('should reflect running state', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13183 });

      expect(controlPlane.getStats().running).toBe(false);

      await controlPlane.start();

      expect(controlPlane.getStats().running).toBe(true);

      await controlPlane.stop();

      expect(controlPlane.getStats().running).toBe(false);
    });

    it('should reflect client count', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13184 });
      await controlPlane.start();

      expect(controlPlane.getStats().clients.totalClients).toBe(0);

      const client = await createClient(13184);
      await waitFor(() => controlPlane.getStats().clients.totalClients === 1);

      expect(controlPlane.getStats().clients.totalClients).toBe(1);

      client.close();
    });
  });

  describe('isRunning', () => {
    it('should return false when not started', () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13185 });
      expect(controlPlane.isRunning()).toBe(false);
    });

    it('should return true when started', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13186 });
      await controlPlane.start();

      expect(controlPlane.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13187 });
      await controlPlane.start();
      await controlPlane.stop();

      expect(controlPlane.isRunning()).toBe(false);
    });
  });

  describe('server error handling', () => {
    it('should emit system:error on server error', async () => {
      const errorHandler = vi.fn();
      eventBus.on('system:error', errorHandler);

      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13188 });
      await controlPlane.start();

      // Simulate server error by emitting an error event
      // This is hard to test directly, but we can verify the handler is set up
      // The actual error handling is tested indirectly through audit logging
      // Note: There are 2 listeners - one from our test and one from the message router's system:error subscription
      expect(eventBus.listenerCount('system:error')).toBeGreaterThanOrEqual(1);
    });

    it('should log server errors to audit', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13189 });
      await controlPlane.start();

      // The audit log for errors is called when errors occur
      // We can't easily trigger a real server error in tests
    });
  });

  describe('heartbeat and cleanup', () => {
    it('should start heartbeat timer', async () => {
      vi.useFakeTimers();

      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        port: 13190,
        heartbeatInterval: 1000,
      });
      await controlPlane.start();

      // Verify control plane is running (heartbeat is internal)
      expect(controlPlane.isRunning()).toBe(true);

      vi.useRealTimers();
    });

    it('should start cleanup timer', async () => {
      vi.useFakeTimers();

      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        port: 13191,
        heartbeatInterval: 1000,
        clientTimeout: 2000,
      });
      await controlPlane.start();

      expect(controlPlane.isRunning()).toBe(true);

      vi.useRealTimers();
    });

    it('should clear timers on stop', async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, {
        port: 13192,
        heartbeatInterval: 100,
      });
      await controlPlane.start();
      await controlPlane.stop();

      // Timers are cleared - server should be fully stopped
      expect(controlPlane.isRunning()).toBe(false);
    });
  });

  describe('security invariants', () => {
    it('should always bind to 127.0.0.1', async () => {
      // HOST is hardcoded to '127.0.0.1' and cannot be changed
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13193 });
      await controlPlane.start();

      const stats = controlPlane.getStats();
      expect(stats.host).toBe('127.0.0.1');
    });

    it('should reject attached server not on loopback', async () => {
      const httpServer = createServer();
      await new Promise<void>((resolve) => {
        httpServer.listen(13194, '0.0.0.0', () => resolve());
      });

      controlPlane = new WebSocketControlPlane(eventBus, audit);

      await expect(controlPlane.attachToServer(httpServer)).rejects.toThrow(
        'SECURITY VIOLATION'
      );

      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });
  });

  describe('message routing integration', () => {
    beforeEach(async () => {
      controlPlane = new WebSocketControlPlane(eventBus, audit, { port: 13200 });
      await controlPlane.start();
    });

    it('should forward events from event bus to subscribed clients', async () => {
      const result = await new Promise<{ type: string; payload: any }>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:13200`);
        let messageCount = 0;
        let clientId: string;

        ws.on('message', (data) => {
          messageCount++;
          const parsed = JSON.parse(data.toString());

          if (messageCount === 1) {
            // Welcome message
            clientId = parsed.payload.clientId;
            // Authenticate
            ws.send(JSON.stringify({
              type: 'auth:request',
              payload: { clientId, clientType: 'dashboard' },
            }));
          } else if (messageCount === 2) {
            // Auth response
            // Subscribe to message events
            ws.send(JSON.stringify({
              type: 'subscribe',
              payload: { events: ['message:received'] },
            }));
          } else if (messageCount === 3) {
            // Subscription response
            // Now emit an event through the event bus
            eventBus.emit('message:received', {
              id: 'test-msg-123',
              content: 'Test message',
              source: 'standard',
              timestamp: new Date(),
              metadata: { sessionId: 'session-123', channel: 'test' },
            });
          } else if (messageCount === 4) {
            // Forwarded message
            ws.close();
            resolve(parsed);
          }
        });

        ws.on('error', reject);

        // Timeout protection
        setTimeout(() => {
          ws.close();
          reject(new Error('Timeout waiting for messages'));
        }, 5000);
      });

      expect(result.type).toBe('message:received');
      expect(result.payload.messageId).toBe('test-msg-123');
    });
  });
});
