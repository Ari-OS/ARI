import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AuditLogger } from '../../../src/kernel/audit.js';
import { ChannelRegistry } from '../../../src/channels/registry.js';
import type {
  Channel,
  ChannelConfig,
  ChannelCapabilities,
  ChannelStatus,
  RateLimit,
  OutboundMessage,
  InboundMessage,
  SendResult,
} from '../../../src/channels/types.js';

/**
 * Create a mock channel for testing
 */
function createMockChannel(overrides: Partial<{
  id: string;
  name: string;
  type: 'push' | 'poll' | 'websocket' | 'bidirectional';
  connected: boolean;
  status: ChannelStatus;
  enabled: boolean;
}>): Channel {
  const id = overrides.id || `channel-${randomUUID()}`;
  const name = overrides.name || 'Test Channel';
  const type = overrides.type || 'push';
  let connected = overrides.connected ?? false;
  let status: ChannelStatus = overrides.status || 'disconnected';
  const enabled = overrides.enabled ?? true;

  const config: ChannelConfig = {
    id,
    name,
    type,
    enabled,
    defaultTrustLevel: 'standard',
    settings: {},
  };

  const capabilities: ChannelCapabilities = {
    typingIndicator: false,
    reactions: false,
    attachments: true,
    replies: true,
    editing: false,
    deletion: false,
    readReceipts: false,
    supportedAttachments: ['image', 'file'],
  };

  const rateLimit: RateLimit = {
    maxMessages: 100,
    windowMs: 60000,
    currentCount: 0,
    limited: false,
  };

  return {
    id,
    name,
    type,
    connect: vi.fn(async () => {
      connected = true;
      status = 'connected';
    }),
    disconnect: vi.fn(async () => {
      connected = false;
      status = 'disconnected';
    }),
    isConnected: vi.fn(() => connected),
    getStatus: vi.fn(() => status),
    send: vi.fn(async (_message: OutboundMessage): Promise<SendResult> => ({
      success: true,
      messageId: randomUUID(),
      timestamp: new Date(),
    })),
    receive: vi.fn(function* (): Generator<InboundMessage> {
      // Empty generator for testing
    }) as unknown as () => AsyncIterable<InboundMessage>,
    supportsCapability: vi.fn((cap: keyof ChannelCapabilities) => capabilities[cap] === true),
    getCapabilities: vi.fn(() => capabilities),
    getRateLimit: vi.fn(() => rateLimit),
    setRateLimit: vi.fn(),
    getConfig: vi.fn(() => config),
    updateConfig: vi.fn((updates: Partial<ChannelConfig>) => {
      Object.assign(config, updates);
    }),
  };
}

describe('ChannelRegistry', () => {
  let eventBus: EventBus;
  let audit: AuditLogger;
  let registry: ChannelRegistry;
  let testAuditPath: string;

  beforeEach(() => {
    testAuditPath = join(tmpdir(), `ari-test-registry-${randomUUID()}.json`);
    eventBus = new EventBus();
    audit = new AuditLogger(testAuditPath);
    registry = new ChannelRegistry(eventBus, audit);
  });

  describe('register', () => {
    it('should register a channel successfully', async () => {
      const channel = createMockChannel({ id: 'test-channel', name: 'Test' });

      await registry.register(channel);

      expect(registry.has('test-channel')).toBe(true);
      expect(registry.get('test-channel')).toBe(channel);
      expect(registry.size).toBe(1);
    });

    it('should audit channel registration', async () => {
      const channel = createMockChannel({ id: 'audit-test', name: 'Audit Test' });

      await registry.register(channel);

      const events = audit.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('channel_registered');
      expect(events[0].details?.channelId).toBe('audit-test');
      expect(events[0].details?.channelName).toBe('Audit Test');
    });

    it('should throw error when registering duplicate channel', async () => {
      const channel = createMockChannel({ id: 'duplicate' });

      await registry.register(channel);

      await expect(registry.register(channel)).rejects.toThrow(
        'Channel duplicate is already registered'
      );
    });

    it('should register multiple channels', async () => {
      const channel1 = createMockChannel({ id: 'channel-1' });
      const channel2 = createMockChannel({ id: 'channel-2' });
      const channel3 = createMockChannel({ id: 'channel-3' });

      await registry.register(channel1);
      await registry.register(channel2);
      await registry.register(channel3);

      expect(registry.size).toBe(3);
      expect(registry.has('channel-1')).toBe(true);
      expect(registry.has('channel-2')).toBe(true);
      expect(registry.has('channel-3')).toBe(true);
    });
  });

  describe('registerFactory', () => {
    it('should register a channel factory', () => {
      const factory = vi.fn((config: ChannelConfig) =>
        createMockChannel({ id: config.id, name: config.name })
      );

      registry.registerFactory('test-type', factory);

      // Factory should be usable for createAndRegister
      expect(factory).not.toHaveBeenCalled();
    });
  });

  describe('createAndRegister', () => {
    it('should create and register channel using factory', async () => {
      const factory = vi.fn((config: ChannelConfig) =>
        createMockChannel({ id: config.id, name: config.name, type: config.type })
      );

      registry.registerFactory('push', factory);

      const config: ChannelConfig = {
        id: 'created-channel',
        name: 'Created Channel',
        type: 'push',
        enabled: true,
        defaultTrustLevel: 'standard',
        settings: {},
      };

      const channel = await registry.createAndRegister(config);

      expect(factory).toHaveBeenCalledWith(config);
      expect(channel.id).toBe('created-channel');
      expect(registry.has('created-channel')).toBe(true);
    });

    it('should audit channel creation', async () => {
      const factory = vi.fn((config: ChannelConfig) =>
        createMockChannel({ id: config.id, name: config.name })
      );

      registry.registerFactory('push', factory);

      await registry.createAndRegister({
        id: 'audit-create',
        name: 'Audit Create',
        type: 'push',
        enabled: true,
        defaultTrustLevel: 'standard',
        settings: {},
      });

      const events = audit.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('channel_created');
      expect(events[0].details?.channelId).toBe('audit-create');
    });

    it('should throw error when factory not registered', async () => {
      await expect(
        registry.createAndRegister({
          id: 'test',
          name: 'Test',
          type: 'unknown-type' as 'push',
          enabled: true,
          defaultTrustLevel: 'standard',
          settings: {},
        })
      ).rejects.toThrow('No factory registered for channel type: unknown-type');
    });
  });

  describe('unregister', () => {
    it('should unregister a channel', async () => {
      const channel = createMockChannel({ id: 'to-remove' });
      await registry.register(channel);

      expect(registry.has('to-remove')).toBe(true);

      const result = await registry.unregister('to-remove');

      expect(result).toBe(true);
      expect(registry.has('to-remove')).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('should disconnect channel before unregistering', async () => {
      const channel = createMockChannel({ id: 'connected-channel', connected: true });
      await registry.register(channel);

      await registry.unregister('connected-channel');

      expect(channel.disconnect).toHaveBeenCalled();
    });

    it('should return false when unregistering non-existent channel', async () => {
      const result = await registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('should audit channel unregistration', async () => {
      const channel = createMockChannel({ id: 'audit-unregister', name: 'Audit Unregister' });
      await registry.register(channel);

      await registry.unregister('audit-unregister');

      const events = audit.getEvents();
      const unregisterEvent = events.find((e) => e.action === 'channel_unregistered');
      expect(unregisterEvent).toBeDefined();
      expect(unregisterEvent?.details?.channelId).toBe('audit-unregister');
    });
  });

  describe('get', () => {
    it('should return channel by ID', async () => {
      const channel = createMockChannel({ id: 'get-test' });
      await registry.register(channel);

      const result = registry.get('get-test');

      expect(result).toBe(channel);
    });

    it('should return null for non-existent channel', () => {
      const result = registry.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for registered channel', async () => {
      const channel = createMockChannel({ id: 'has-test' });
      await registry.register(channel);

      expect(registry.has('has-test')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all registered channels', async () => {
      const channel1 = createMockChannel({ id: 'all-1' });
      const channel2 = createMockChannel({ id: 'all-2' });
      const channel3 = createMockChannel({ id: 'all-3' });

      await registry.register(channel1);
      await registry.register(channel2);
      await registry.register(channel3);

      const all = registry.getAll();

      expect(all).toHaveLength(3);
      expect(all).toContain(channel1);
      expect(all).toContain(channel2);
      expect(all).toContain(channel3);
    });

    it('should return empty array when no channels registered', () => {
      const all = registry.getAll();

      expect(all).toEqual([]);
    });
  });

  describe('getConnected', () => {
    it('should return only connected channels', async () => {
      const connected1 = createMockChannel({ id: 'conn-1', connected: true, status: 'connected' });
      const connected2 = createMockChannel({ id: 'conn-2', connected: true, status: 'connected' });
      const disconnected = createMockChannel({
        id: 'disconn',
        connected: false,
        status: 'disconnected',
      });

      await registry.register(connected1);
      await registry.register(connected2);
      await registry.register(disconnected);

      const connected = registry.getConnected();

      expect(connected).toHaveLength(2);
      expect(connected).toContain(connected1);
      expect(connected).toContain(connected2);
      expect(connected).not.toContain(disconnected);
    });
  });

  describe('getByType', () => {
    it('should return channels of specified type', async () => {
      const push1 = createMockChannel({ id: 'push-1', type: 'push' });
      const push2 = createMockChannel({ id: 'push-2', type: 'push' });
      const websocket = createMockChannel({ id: 'ws-1', type: 'websocket' });

      await registry.register(push1);
      await registry.register(push2);
      await registry.register(websocket);

      const pushChannels = registry.getByType('push');

      expect(pushChannels).toHaveLength(2);
      expect(pushChannels).toContain(push1);
      expect(pushChannels).toContain(push2);
      expect(pushChannels).not.toContain(websocket);
    });

    it('should return empty array when no channels of type exist', async () => {
      const push = createMockChannel({ id: 'push-1', type: 'push' });
      await registry.register(push);

      const bidirectional = registry.getByType('bidirectional');

      expect(bidirectional).toEqual([]);
    });
  });

  describe('getByStatus', () => {
    it('should return channels with specified status', async () => {
      const connected = createMockChannel({ id: 'conn', status: 'connected' });
      const error = createMockChannel({ id: 'err', status: 'error' });
      const disconnected = createMockChannel({ id: 'disconn', status: 'disconnected' });

      await registry.register(connected);
      await registry.register(error);
      await registry.register(disconnected);

      const errorChannels = registry.getByStatus('error');

      expect(errorChannels).toHaveLength(1);
      expect(errorChannels).toContain(error);
    });
  });

  describe('getEnabled', () => {
    it('should return only enabled channels', async () => {
      const enabled1 = createMockChannel({ id: 'en-1', enabled: true });
      const enabled2 = createMockChannel({ id: 'en-2', enabled: true });
      const disabled = createMockChannel({ id: 'dis', enabled: false });

      await registry.register(enabled1);
      await registry.register(enabled2);
      await registry.register(disabled);

      const enabledChannels = registry.getEnabled();

      expect(enabledChannels).toHaveLength(2);
      expect(enabledChannels).toContain(enabled1);
      expect(enabledChannels).toContain(enabled2);
      expect(enabledChannels).not.toContain(disabled);
    });
  });

  describe('connectAll', () => {
    it('should connect all enabled channels', async () => {
      const channel1 = createMockChannel({ id: 'conn-1', enabled: true });
      const channel2 = createMockChannel({ id: 'conn-2', enabled: true });
      const disabled = createMockChannel({ id: 'dis', enabled: false });

      await registry.register(channel1);
      await registry.register(channel2);
      await registry.register(disabled);

      const result = await registry.connectAll();

      expect(result.success).toContain('conn-1');
      expect(result.success).toContain('conn-2');
      expect(result.success).not.toContain('dis');
      expect(channel1.connect).toHaveBeenCalled();
      expect(channel2.connect).toHaveBeenCalled();
      expect(disabled.connect).not.toHaveBeenCalled();
    });

    it('should emit channel:connected event for each connected channel', async () => {
      const channel = createMockChannel({ id: 'event-test', enabled: true });
      await registry.register(channel);

      const connectedEvents: unknown[] = [];
      eventBus.on('channel:connected', (payload) => {
        connectedEvents.push(payload);
      });

      await registry.connectAll();

      expect(connectedEvents).toHaveLength(1);
      expect((connectedEvents[0] as { channelId: string }).channelId).toBe('event-test');
    });

    it('should track failed connections', async () => {
      const successChannel = createMockChannel({ id: 'success', enabled: true });
      const failChannel = createMockChannel({ id: 'fail', enabled: true });
      (failChannel.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );

      await registry.register(successChannel);
      await registry.register(failChannel);

      const result = await registry.connectAll();

      expect(result.success).toContain('success');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('fail');
      expect(result.failed[0].error).toBe('Connection failed');
    });

    it('should audit connectAll operation', async () => {
      const channel = createMockChannel({ id: 'audit-conn', enabled: true });
      await registry.register(channel);

      await registry.connectAll();

      const events = audit.getEvents();
      const connectEvent = events.find((e) => e.action === 'channels_connect_all');
      expect(connectEvent).toBeDefined();
      expect(connectEvent?.details?.success).toBe(1);
      expect(connectEvent?.details?.failed).toBe(0);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connected channels', async () => {
      const channel1 = createMockChannel({ id: 'disc-1', connected: true, status: 'connected' });
      const channel2 = createMockChannel({ id: 'disc-2', connected: true, status: 'connected' });

      await registry.register(channel1);
      await registry.register(channel2);

      await registry.disconnectAll();

      expect(channel1.disconnect).toHaveBeenCalled();
      expect(channel2.disconnect).toHaveBeenCalled();
    });

    it('should emit channel:disconnected event for each channel', async () => {
      const channel = createMockChannel({
        id: 'disc-event',
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      const disconnectedEvents: unknown[] = [];
      eventBus.on('channel:disconnected', (payload) => {
        disconnectedEvents.push(payload);
      });

      await registry.disconnectAll();

      expect(disconnectedEvents).toHaveLength(1);
      expect((disconnectedEvents[0] as { channelId: string }).channelId).toBe('disc-event');
    });

    it('should handle disconnect errors gracefully', async () => {
      const failChannel = createMockChannel({
        id: 'disc-fail',
        connected: true,
        status: 'connected',
      });
      (failChannel.disconnect as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Disconnect error')
      );

      await registry.register(failChannel);

      // Should not throw
      await expect(registry.disconnectAll()).resolves.not.toThrow();

      // Should audit the error
      const events = audit.getEvents();
      const errorEvent = events.find((e) => e.action === 'channel_disconnect_error');
      expect(errorEvent).toBeDefined();
    });

    it('should audit disconnectAll operation', async () => {
      const channel = createMockChannel({ id: 'audit-disc', connected: true, status: 'connected' });
      await registry.register(channel);

      await registry.disconnectAll();

      const events = audit.getEvents();
      const discEvent = events.find((e) => e.action === 'channels_disconnect_all');
      expect(discEvent).toBeDefined();
      expect(discEvent?.details?.count).toBe(1);
    });
  });

  describe('getStatusSummary', () => {
    it('should return status summary for all channels', async () => {
      const channel1 = createMockChannel({
        id: 'status-1',
        name: 'Channel 1',
        type: 'push',
        status: 'connected',
        enabled: true,
      });
      const channel2 = createMockChannel({
        id: 'status-2',
        name: 'Channel 2',
        type: 'websocket',
        status: 'error',
        enabled: false,
      });

      await registry.register(channel1);
      await registry.register(channel2);

      const summary = registry.getStatusSummary();

      expect(summary).toHaveLength(2);
      expect(summary).toContainEqual({
        id: 'status-1',
        name: 'Channel 1',
        type: 'push',
        status: 'connected',
        enabled: true,
      });
      expect(summary).toContainEqual({
        id: 'status-2',
        name: 'Channel 2',
        type: 'websocket',
        status: 'error',
        enabled: false,
      });
    });
  });

  describe('getCapabilitiesSummary', () => {
    it('should return capabilities for all channels', async () => {
      const channel1 = createMockChannel({ id: 'cap-1' });
      const channel2 = createMockChannel({ id: 'cap-2' });

      await registry.register(channel1);
      await registry.register(channel2);

      const summary = registry.getCapabilitiesSummary();

      expect(summary['cap-1']).toBeDefined();
      expect(summary['cap-2']).toBeDefined();
      expect(summary['cap-1'].attachments).toBe(true);
      expect(summary['cap-1'].replies).toBe(true);
    });
  });

  describe('enable', () => {
    it('should enable a channel', async () => {
      const channel = createMockChannel({ id: 'enable-test', enabled: false });
      await registry.register(channel);

      const result = await registry.enable('enable-test');

      expect(result).toBe(true);
      expect(channel.updateConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('should return false for non-existent channel', async () => {
      const result = await registry.enable('non-existent');

      expect(result).toBe(false);
    });

    it('should audit enable operation', async () => {
      const channel = createMockChannel({ id: 'audit-enable', enabled: false });
      await registry.register(channel);

      await registry.enable('audit-enable');

      const events = audit.getEvents();
      const enableEvent = events.find((e) => e.action === 'channel_enabled');
      expect(enableEvent).toBeDefined();
      expect(enableEvent?.details?.channelId).toBe('audit-enable');
    });
  });

  describe('disable', () => {
    it('should disable a channel', async () => {
      const channel = createMockChannel({ id: 'disable-test', enabled: true });
      await registry.register(channel);

      const result = await registry.disable('disable-test');

      expect(result).toBe(true);
      expect(channel.updateConfig).toHaveBeenCalledWith({ enabled: false });
    });

    it('should disconnect channel when disabling', async () => {
      const channel = createMockChannel({
        id: 'disc-disable',
        enabled: true,
        connected: true,
        status: 'connected',
      });
      await registry.register(channel);

      await registry.disable('disc-disable');

      expect(channel.disconnect).toHaveBeenCalled();
    });

    it('should return false for non-existent channel', async () => {
      const result = await registry.disable('non-existent');

      expect(result).toBe(false);
    });

    it('should audit disable operation', async () => {
      const channel = createMockChannel({ id: 'audit-disable', enabled: true });
      await registry.register(channel);

      await registry.disable('audit-disable');

      const events = audit.getEvents();
      const disableEvent = events.find((e) => e.action === 'channel_disabled');
      expect(disableEvent).toBeDefined();
      expect(disableEvent?.details?.channelId).toBe('audit-disable');
    });
  });

  describe('countByStatus', () => {
    it('should return count of channels by status', async () => {
      const connected1 = createMockChannel({ id: 'c1', status: 'connected' });
      const connected2 = createMockChannel({ id: 'c2', status: 'connected' });
      const disconnected = createMockChannel({ id: 'd1', status: 'disconnected' });
      const error = createMockChannel({ id: 'e1', status: 'error' });

      await registry.register(connected1);
      await registry.register(connected2);
      await registry.register(disconnected);
      await registry.register(error);

      const counts = registry.countByStatus();

      expect(counts.connected).toBe(2);
      expect(counts.disconnected).toBe(1);
      expect(counts.error).toBe(1);
      expect(counts.connecting).toBe(0);
      expect(counts.rate_limited).toBe(0);
    });

    it('should return all zeros when no channels registered', () => {
      const counts = registry.countByStatus();

      expect(counts.connected).toBe(0);
      expect(counts.disconnected).toBe(0);
      expect(counts.error).toBe(0);
      expect(counts.connecting).toBe(0);
      expect(counts.rate_limited).toBe(0);
    });
  });

  describe('clear', () => {
    it('should disconnect and remove all channels', async () => {
      const channel1 = createMockChannel({
        id: 'clear-1',
        connected: true,
        status: 'connected',
      });
      const channel2 = createMockChannel({
        id: 'clear-2',
        connected: true,
        status: 'connected',
      });

      await registry.register(channel1);
      await registry.register(channel2);

      await registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
      expect(channel1.disconnect).toHaveBeenCalled();
      expect(channel2.disconnect).toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it('should return number of registered channels', async () => {
      expect(registry.size).toBe(0);

      await registry.register(createMockChannel({ id: 'size-1' }));
      expect(registry.size).toBe(1);

      await registry.register(createMockChannel({ id: 'size-2' }));
      expect(registry.size).toBe(2);

      await registry.unregister('size-1');
      expect(registry.size).toBe(1);
    });
  });
});
