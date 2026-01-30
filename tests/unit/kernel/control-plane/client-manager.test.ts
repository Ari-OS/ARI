import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  ClientManager,
  CLIENT_TYPE_CAPABILITIES,
  type ClientCapability,
  type ConnectedClient,
} from '../../../../src/kernel/control-plane/client-manager.js';

// Mock WebSocket
function createMockSocket(readyState: number = 1): WebSocket {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

describe('ClientManager', () => {
  let clientManager: ClientManager;

  beforeEach(() => {
    clientManager = new ClientManager();
  });

  describe('addClient', () => {
    it('should add a new client with default type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      expect(client).toBeDefined();
      expect(client.id).toBeDefined();
      expect(client.socket).toBe(socket);
      expect(client.clientType).toBe('monitor');
      expect(client.authenticated).toBe(false);
    });

    it('should add a new client with specified type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'dashboard');

      expect(client.clientType).toBe('dashboard');
    });

    it('should assign capabilities based on client type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'admin');

      expect(client.capabilities.has('admin')).toBe(true);
      expect(client.capabilities.has('read:messages')).toBe(true);
      expect(client.capabilities.has('write:messages')).toBe(true);
    });

    it('should use monitor capabilities for unknown client type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'unknown-type');

      const monitorCaps = CLIENT_TYPE_CAPABILITIES.monitor;
      for (const cap of monitorCaps) {
        expect(client.capabilities.has(cap)).toBe(true);
      }
    });

    it('should initialize client with empty subscriptions', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      expect(client.subscriptions.size).toBe(0);
    });

    it('should set connection timestamps', () => {
      const socket = createMockSocket();
      const beforeTime = new Date();
      const client = clientManager.addClient(socket);
      const afterTime = new Date();

      expect(client.connectedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(client.connectedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(client.lastActivity.getTime()).toBe(client.connectedAt.getTime());
    });

    it('should initialize empty metadata', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      expect(client.metadata).toEqual({});
    });

    it('should generate unique client IDs', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      const client1 = clientManager.addClient(socket1);
      const client2 = clientManager.addClient(socket2);

      expect(client1.id).not.toBe(client2.id);
    });

    it('should increment size when adding clients', () => {
      expect(clientManager.size).toBe(0);

      clientManager.addClient(createMockSocket());
      expect(clientManager.size).toBe(1);

      clientManager.addClient(createMockSocket());
      expect(clientManager.size).toBe(2);
    });
  });

  describe('removeClient', () => {
    it('should remove an existing client', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      expect(clientManager.size).toBe(1);

      const removed = clientManager.removeClient(client.id);

      expect(removed).toBe(true);
      expect(clientManager.size).toBe(0);
    });

    it('should return false for non-existent client', () => {
      const removed = clientManager.removeClient('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should allow re-adding a client after removal', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      const originalId = client.id;

      clientManager.removeClient(client.id);

      const newClient = clientManager.addClient(socket);
      expect(newClient.id).not.toBe(originalId);
      expect(clientManager.size).toBe(1);
    });
  });

  describe('removeClientBySocket', () => {
    it('should remove client by socket reference', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      const removed = clientManager.removeClientBySocket(socket);

      expect(removed).not.toBeNull();
      expect(removed!.id).toBe(client.id);
      expect(clientManager.size).toBe(0);
    });

    it('should return null for unknown socket', () => {
      const socket = createMockSocket();

      const removed = clientManager.removeClientBySocket(socket);

      expect(removed).toBeNull();
    });
  });

  describe('getClient', () => {
    it('should return client by ID', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      const retrieved = clientManager.getClient(client.id);

      expect(retrieved).toBe(client);
    });

    it('should return null for non-existent ID', () => {
      const retrieved = clientManager.getClient('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getClientBySocket', () => {
    it('should return client by socket reference', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      const retrieved = clientManager.getClientBySocket(socket);

      expect(retrieved).toBe(client);
    });

    it('should return null for unknown socket', () => {
      const socket = createMockSocket();
      const retrieved = clientManager.getClientBySocket(socket);

      expect(retrieved).toBeNull();
    });
  });

  describe('authenticateClient', () => {
    it('should authenticate client and update type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'monitor');

      const result = clientManager.authenticateClient(client.id, 'admin');

      expect(result).toBe(true);
      expect(client.authenticated).toBe(true);
      expect(client.clientType).toBe('admin');
    });

    it('should update capabilities based on new type', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'monitor');

      clientManager.authenticateClient(client.id, 'admin');

      expect(client.capabilities.has('admin')).toBe(true);
    });

    it('should add additional capabilities if provided', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'monitor');

      clientManager.authenticateClient(client.id, 'dashboard', ['write:messages']);

      expect(client.capabilities.has('write:messages')).toBe(true);
    });

    it('should return false for non-existent client', () => {
      const result = clientManager.authenticateClient('non-existent', 'admin');
      expect(result).toBe(false);
    });

    it('should update lastActivity timestamp', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      const originalActivity = client.lastActivity;

      // Wait a tick to ensure time difference
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      clientManager.authenticateClient(client.id, 'admin');

      expect(client.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      vi.useRealTimers();
    });
  });

  describe('subscribe', () => {
    it('should add subscriptions for authenticated client', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');

      const subscribed = clientManager.subscribe(client.id, ['message:*', 'channel:*']);

      expect(subscribed).toContain('message:*');
      expect(subscribed).toContain('channel:*');
      expect(client.subscriptions.has('message:*')).toBe(true);
      expect(client.subscriptions.has('channel:*')).toBe(true);
    });

    it('should return empty array for non-existent client', () => {
      const subscribed = clientManager.subscribe('non-existent', ['message:*']);
      expect(subscribed).toEqual([]);
    });

    it('should not subscribe to protected events without authentication', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      // Client is not authenticated

      const subscribed = clientManager.subscribe(client.id, ['tool:*', 'tool:start']);

      expect(subscribed).not.toContain('tool:*');
      expect(subscribed).not.toContain('tool:start');
    });

    it('should not subscribe to admin-only events without admin capability', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard'); // Not admin

      const subscribed = clientManager.subscribe(client.id, ['security:*', 'audit:*']);

      expect(subscribed).not.toContain('security:*');
      expect(subscribed).not.toContain('audit:*');
    });

    it('should allow admin to subscribe to admin-only events', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'admin');

      const subscribed = clientManager.subscribe(client.id, ['security:*', 'audit:*']);

      expect(subscribed).toContain('security:*');
      expect(subscribed).toContain('audit:*');
    });

    it('should allow authenticated client to subscribe to protected events', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');

      const subscribed = clientManager.subscribe(client.id, ['tool:start', 'tool:end']);

      expect(subscribed).toContain('tool:start');
      expect(subscribed).toContain('tool:end');
    });

    it('should update lastActivity timestamp', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      const originalActivity = client.lastActivity;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      clientManager.subscribe(client.id, ['message:*']);

      expect(client.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      vi.useRealTimers();
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscriptions', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      clientManager.subscribe(client.id, ['message:*', 'channel:*']);

      const unsubscribed = clientManager.unsubscribe(client.id, ['message:*']);

      expect(unsubscribed).toContain('message:*');
      expect(client.subscriptions.has('message:*')).toBe(false);
      expect(client.subscriptions.has('channel:*')).toBe(true);
    });

    it('should return empty array for non-existent client', () => {
      const unsubscribed = clientManager.unsubscribe('non-existent', ['message:*']);
      expect(unsubscribed).toEqual([]);
    });

    it('should only return actually unsubscribed events', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      clientManager.subscribe(client.id, ['message:*']);

      const unsubscribed = clientManager.unsubscribe(client.id, ['message:*', 'not-subscribed']);

      expect(unsubscribed).toContain('message:*');
      expect(unsubscribed).not.toContain('not-subscribed');
    });

    it('should update lastActivity timestamp', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      clientManager.subscribe(client.id, ['message:*']);
      const originalActivity = client.lastActivity;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      clientManager.unsubscribe(client.id, ['message:*']);

      expect(client.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      vi.useRealTimers();
    });
  });

  describe('getSubscribers', () => {
    it('should return clients subscribed to exact event', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      const client1 = clientManager.addClient(socket1);
      const client2 = clientManager.addClient(socket2);

      clientManager.authenticateClient(client1.id, 'dashboard');
      clientManager.authenticateClient(client2.id, 'dashboard');

      clientManager.subscribe(client1.id, ['message:received']);
      clientManager.subscribe(client2.id, ['tool:start']);

      const subscribers = clientManager.getSubscribers('message:received');

      expect(subscribers.length).toBe(1);
      expect(subscribers[0].id).toBe(client1.id);
    });

    it('should return clients with matching wildcard subscription', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      clientManager.subscribe(client.id, ['message:*']);

      const subscribers = clientManager.getSubscribers('message:received');

      expect(subscribers.length).toBe(1);
      expect(subscribers[0].id).toBe(client.id);
    });

    it('should not return same client twice', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      clientManager.authenticateClient(client.id, 'dashboard');
      // Subscribe to both exact and wildcard
      clientManager.subscribe(client.id, ['message:*', 'message:received']);

      const subscribers = clientManager.getSubscribers('message:received');

      expect(subscribers.length).toBe(1);
    });

    it('should return empty array when no subscribers', () => {
      const subscribers = clientManager.getSubscribers('message:received');
      expect(subscribers).toEqual([]);
    });

    it('should return multiple subscribers', () => {
      const sockets = [createMockSocket(), createMockSocket(), createMockSocket()];
      const clients = sockets.map((s) => clientManager.addClient(s));

      for (const client of clients) {
        clientManager.authenticateClient(client.id, 'dashboard');
        clientManager.subscribe(client.id, ['message:*']);
      }

      const subscribers = clientManager.getSubscribers('message:received');

      expect(subscribers.length).toBe(3);
    });
  });

  describe('sendToClient', () => {
    it('should send message to open socket', () => {
      const socket = createMockSocket(1); // OPEN state
      const client = clientManager.addClient(socket);

      const message = { type: 'test', payload: { data: 'test' } };
      const result = clientManager.sendToClient(client.id, message as any);

      expect(result).toBe(true);
      expect(socket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should return false for non-existent client', () => {
      const message = { type: 'test', payload: {} };
      const result = clientManager.sendToClient('non-existent', message as any);

      expect(result).toBe(false);
    });

    it('should return false for non-open socket', () => {
      const socket = createMockSocket(3); // CLOSED state
      const client = clientManager.addClient(socket);

      const message = { type: 'test', payload: {} };
      const result = clientManager.sendToClient(client.id, message as any);

      expect(result).toBe(false);
    });

    it('should return false when send throws', () => {
      const socket = createMockSocket(1);
      (socket.send as any).mockImplementation(() => {
        throw new Error('Send failed');
      });
      const client = clientManager.addClient(socket);

      const message = { type: 'test', payload: {} };
      const result = clientManager.sendToClient(client.id, message as any);

      expect(result).toBe(false);
    });

    it('should update lastActivity on successful send', () => {
      const socket = createMockSocket(1);
      const client = clientManager.addClient(socket);
      const originalActivity = client.lastActivity;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      const message = { type: 'test', payload: {} };
      clientManager.sendToClient(client.id, message as any);

      expect(client.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      vi.useRealTimers();
    });
  });

  describe('broadcast', () => {
    it('should send to all subscribers of an event', () => {
      const socket1 = createMockSocket(1);
      const socket2 = createMockSocket(1);

      const client1 = clientManager.addClient(socket1);
      const client2 = clientManager.addClient(socket2);

      clientManager.authenticateClient(client1.id, 'dashboard');
      clientManager.authenticateClient(client2.id, 'dashboard');

      clientManager.subscribe(client1.id, ['message:*']);
      clientManager.subscribe(client2.id, ['message:*']);

      const message = { type: 'message:received', payload: {} };
      const sent = clientManager.broadcast('message:received', message as any);

      expect(sent).toBe(2);
      expect(socket1.send).toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalled();
    });

    it('should return 0 when no subscribers', () => {
      const message = { type: 'message:received', payload: {} };
      const sent = clientManager.broadcast('message:received', message as any);

      expect(sent).toBe(0);
    });

    it('should count only successful sends', () => {
      const socket1 = createMockSocket(1);
      const socket2 = createMockSocket(3); // CLOSED

      const client1 = clientManager.addClient(socket1);
      const client2 = clientManager.addClient(socket2);

      clientManager.authenticateClient(client1.id, 'dashboard');
      clientManager.authenticateClient(client2.id, 'dashboard');

      clientManager.subscribe(client1.id, ['message:*']);
      clientManager.subscribe(client2.id, ['message:*']);

      const message = { type: 'message:received', payload: {} };
      const sent = clientManager.broadcast('message:received', message as any);

      expect(sent).toBe(1);
    });
  });

  describe('broadcastAll', () => {
    it('should send to all clients regardless of subscription', () => {
      const socket1 = createMockSocket(1);
      const socket2 = createMockSocket(1);

      clientManager.addClient(socket1);
      clientManager.addClient(socket2);
      // No subscriptions set

      const message = { type: 'test', payload: {} };
      const sent = clientManager.broadcastAll(message as any);

      expect(sent).toBe(2);
      expect(socket1.send).toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalled();
    });

    it('should return count of successful sends', () => {
      const socket1 = createMockSocket(1);
      const socket2 = createMockSocket(3); // CLOSED

      clientManager.addClient(socket1);
      clientManager.addClient(socket2);

      const message = { type: 'test', payload: {} };
      const sent = clientManager.broadcastAll(message as any);

      expect(sent).toBe(1);
    });
  });

  describe('touch', () => {
    it('should update lastActivity timestamp', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);
      const originalActivity = client.lastActivity;

      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      clientManager.touch(client.id);

      expect(client.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      vi.useRealTimers();
    });

    it('should handle non-existent client gracefully', () => {
      expect(() => clientManager.touch('non-existent')).not.toThrow();
    });
  });

  describe('getInactiveClients', () => {
    it('should return clients inactive longer than timeout', () => {
      vi.useFakeTimers();

      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      vi.advanceTimersByTime(60001); // Just over 1 minute

      const inactive = clientManager.getInactiveClients(60000);

      expect(inactive.length).toBe(1);
      expect(inactive[0].id).toBe(client.id);

      vi.useRealTimers();
    });

    it('should not return recently active clients', () => {
      vi.useFakeTimers();

      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      vi.advanceTimersByTime(30000); // 30 seconds
      clientManager.touch(client.id);
      vi.advanceTimersByTime(30000); // Another 30 seconds (total 1 min, but last activity 30s ago)

      const inactive = clientManager.getInactiveClients(60000);

      expect(inactive.length).toBe(0);

      vi.useRealTimers();
    });

    it('should return empty array when all clients are active', () => {
      const socket = createMockSocket();
      clientManager.addClient(socket);

      const inactive = clientManager.getInactiveClients(60000);

      expect(inactive).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct stats with no clients', () => {
      const stats = clientManager.getStats();

      expect(stats.totalClients).toBe(0);
      expect(stats.authenticatedClients).toBe(0);
      expect(stats.clientsByType).toEqual({});
      expect(stats.averageConnectionAge).toBe(0);
    });

    it('should count total clients', () => {
      clientManager.addClient(createMockSocket());
      clientManager.addClient(createMockSocket());
      clientManager.addClient(createMockSocket());

      const stats = clientManager.getStats();

      expect(stats.totalClients).toBe(3);
    });

    it('should count authenticated clients', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      const client1 = clientManager.addClient(socket1);
      clientManager.addClient(socket2);

      clientManager.authenticateClient(client1.id, 'admin');

      const stats = clientManager.getStats();

      expect(stats.authenticatedClients).toBe(1);
    });

    it('should group clients by type', () => {
      clientManager.addClient(createMockSocket(), 'dashboard');
      clientManager.addClient(createMockSocket(), 'dashboard');
      clientManager.addClient(createMockSocket(), 'monitor');

      const stats = clientManager.getStats();

      expect(stats.clientsByType.dashboard).toBe(2);
      expect(stats.clientsByType.monitor).toBe(1);
    });

    it('should calculate average connection age', () => {
      vi.useFakeTimers();

      clientManager.addClient(createMockSocket());
      vi.advanceTimersByTime(1000);
      clientManager.addClient(createMockSocket());
      vi.advanceTimersByTime(1000);

      const stats = clientManager.getStats();

      // First client: 2000ms old, second client: 1000ms old
      // Average: 1500ms
      expect(stats.averageConnectionAge).toBe(1500);

      vi.useRealTimers();
    });
  });

  describe('getAllClientIds', () => {
    it('should return all client IDs', () => {
      const socket1 = createMockSocket();
      const socket2 = createMockSocket();

      const client1 = clientManager.addClient(socket1);
      const client2 = clientManager.addClient(socket2);

      const ids = clientManager.getAllClientIds();

      expect(ids).toContain(client1.id);
      expect(ids).toContain(client2.id);
      expect(ids.length).toBe(2);
    });

    it('should return empty array when no clients', () => {
      const ids = clientManager.getAllClientIds();
      expect(ids).toEqual([]);
    });
  });

  describe('hasCapability', () => {
    it('should return true when client has capability', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'admin');

      expect(clientManager.hasCapability(client.id, 'admin')).toBe(true);
      expect(clientManager.hasCapability(client.id, 'read:messages')).toBe(true);
    });

    it('should return false when client lacks capability', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket, 'monitor');

      expect(clientManager.hasCapability(client.id, 'admin')).toBe(false);
      expect(clientManager.hasCapability(client.id, 'write:messages')).toBe(false);
    });

    it('should return false for non-existent client', () => {
      expect(clientManager.hasCapability('non-existent', 'admin')).toBe(false);
    });
  });

  describe('setMetadata / getMetadata', () => {
    it('should set and get metadata', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      clientManager.setMetadata(client.id, 'userId', 'user-123');

      expect(clientManager.getMetadata(client.id, 'userId')).toBe('user-123');
    });

    it('should return undefined for non-existent key', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      expect(clientManager.getMetadata(client.id, 'non-existent')).toBeUndefined();
    });

    it('should return undefined for non-existent client', () => {
      expect(clientManager.getMetadata('non-existent', 'key')).toBeUndefined();
    });

    it('should return false when setting metadata for non-existent client', () => {
      const result = clientManager.setMetadata('non-existent', 'key', 'value');
      expect(result).toBe(false);
    });

    it('should return true when setting metadata successfully', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      const result = clientManager.setMetadata(client.id, 'key', 'value');
      expect(result).toBe(true);
    });

    it('should allow updating existing metadata', () => {
      const socket = createMockSocket();
      const client = clientManager.addClient(socket);

      clientManager.setMetadata(client.id, 'key', 'value1');
      clientManager.setMetadata(client.id, 'key', 'value2');

      expect(clientManager.getMetadata(client.id, 'key')).toBe('value2');
    });
  });

  describe('clear', () => {
    it('should remove all clients', () => {
      clientManager.addClient(createMockSocket());
      clientManager.addClient(createMockSocket());
      clientManager.addClient(createMockSocket());

      expect(clientManager.size).toBe(3);

      clientManager.clear();

      expect(clientManager.size).toBe(0);
    });

    it('should send shutdown message to clients', () => {
      const socket = createMockSocket(1);
      clientManager.addClient(socket);

      clientManager.clear();

      expect(socket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse((socket.send as any).mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.payload.code).toBe('SERVER_SHUTDOWN');
    });

    it('should close client sockets', () => {
      const socket = createMockSocket(1);
      clientManager.addClient(socket);

      clientManager.clear();

      expect(socket.close).toHaveBeenCalledWith(1001, 'Server shutdown');
    });

    it('should handle errors during shutdown gracefully', () => {
      const socket = createMockSocket(1);
      (socket.send as any).mockImplementation(() => {
        throw new Error('Send failed');
      });
      clientManager.addClient(socket);

      expect(() => clientManager.clear()).not.toThrow();
    });
  });

  describe('CLIENT_TYPE_CAPABILITIES', () => {
    it('should have dashboard capabilities', () => {
      const caps = CLIENT_TYPE_CAPABILITIES.dashboard;
      expect(caps).toContain('read:messages');
      expect(caps).toContain('read:sessions');
      expect(caps).toContain('read:tools');
      expect(caps).toContain('read:channels');
      expect(caps).toContain('read:health');
    });

    it('should have channel capabilities', () => {
      const caps = CLIENT_TYPE_CAPABILITIES.channel;
      expect(caps).toContain('read:messages');
      expect(caps).toContain('write:messages');
      expect(caps).toContain('read:sessions');
      expect(caps).toContain('write:sessions');
    });

    it('should have monitor capabilities', () => {
      const caps = CLIENT_TYPE_CAPABILITIES.monitor;
      expect(caps).toContain('read:messages');
      expect(caps).toContain('read:sessions');
      expect(caps).toContain('read:tools');
      expect(caps).toContain('read:channels');
      expect(caps).toContain('read:health');
    });

    it('should have admin capabilities (all)', () => {
      const caps = CLIENT_TYPE_CAPABILITIES.admin;
      expect(caps).toContain('admin');
      expect(caps).toContain('read:messages');
      expect(caps).toContain('write:messages');
      expect(caps).toContain('read:sessions');
      expect(caps).toContain('write:sessions');
      expect(caps).toContain('read:tools');
      expect(caps).toContain('read:channels');
      expect(caps).toContain('write:channels');
      expect(caps).toContain('read:health');
    });
  });
});
