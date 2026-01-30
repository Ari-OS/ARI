import type { EventBus } from '../kernel/event-bus.js';
import type { AuditLogger } from '../kernel/audit.js';
import type {
  Channel,
  ChannelConfig,
  ChannelFactory,
  ChannelStatus,
  ChannelCapabilities,
} from './types.js';

/**
 * Channel Registry Entry
 */
interface RegistryEntry {
  channel: Channel;
  config: ChannelConfig;
  factory?: ChannelFactory;
  registeredAt: Date;
}

/**
 * ChannelRegistry
 *
 * Central registry for all communication channels.
 * Provides channel discovery, lifecycle management, and status tracking.
 */
export class ChannelRegistry {
  private channels: Map<string, RegistryEntry> = new Map();
  private factories: Map<string, ChannelFactory> = new Map();
  private eventBus: EventBus;
  private audit: AuditLogger;

  constructor(eventBus: EventBus, audit: AuditLogger) {
    this.eventBus = eventBus;
    this.audit = audit;
  }

  /**
   * Register a channel factory for creating channels of a specific type
   */
  registerFactory(type: string, factory: ChannelFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Register a channel instance
   */
  async register(channel: Channel): Promise<void> {
    if (this.channels.has(channel.id)) {
      throw new Error(`Channel ${channel.id} is already registered`);
    }

    const entry: RegistryEntry = {
      channel,
      config: channel.getConfig(),
      registeredAt: new Date(),
    };

    this.channels.set(channel.id, entry);

    await this.audit.log('channel_registered', 'system', 'system', {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
    });
  }

  /**
   * Create and register a channel from configuration
   */
  async createAndRegister(config: ChannelConfig): Promise<Channel> {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`No factory registered for channel type: ${config.type}`);
    }

    const channel = factory(config);

    const entry: RegistryEntry = {
      channel,
      config,
      factory,
      registeredAt: new Date(),
    };

    this.channels.set(channel.id, entry);

    await this.audit.log('channel_created', 'system', 'system', {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
    });

    return channel;
  }

  /**
   * Unregister a channel
   */
  async unregister(channelId: string): Promise<boolean> {
    const entry = this.channels.get(channelId);
    if (!entry) return false;

    // Disconnect if connected
    if (entry.channel.isConnected()) {
      await entry.channel.disconnect();
    }

    this.channels.delete(channelId);

    await this.audit.log('channel_unregistered', 'system', 'system', {
      channelId,
      channelName: entry.channel.name,
    });

    return true;
  }

  /**
   * Get a channel by ID
   */
  get(channelId: string): Channel | null {
    const entry = this.channels.get(channelId);
    return entry ? entry.channel : null;
  }

  /**
   * Check if a channel is registered
   */
  has(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  /**
   * Get all registered channels
   */
  getAll(): Channel[] {
    return Array.from(this.channels.values()).map(e => e.channel);
  }

  /**
   * Get all connected channels
   */
  getConnected(): Channel[] {
    return this.getAll().filter(c => c.isConnected());
  }

  /**
   * Get channels by type
   */
  getByType(type: string): Channel[] {
    return this.getAll().filter(c => c.type === type);
  }

  /**
   * Get channels by status
   */
  getByStatus(status: ChannelStatus): Channel[] {
    return this.getAll().filter(c => c.getStatus() === status);
  }

  /**
   * Get enabled channels
   */
  getEnabled(): Channel[] {
    return Array.from(this.channels.values())
      .filter(e => e.config.enabled)
      .map(e => e.channel);
  }

  /**
   * Connect all enabled channels
   */
  async connectAll(): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const enabled = this.getEnabled();
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const channel of enabled) {
      try {
        await channel.connect();
        success.push(channel.id);

        this.eventBus.emit('channel:connected', {
          channelId: channel.id,
          channelName: channel.name,
          connectedAt: new Date(),
        });
      } catch (error) {
        failed.push({
          id: channel.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.audit.log('channels_connect_all', 'system', 'system', {
      success: success.length,
      failed: failed.length,
      failedIds: failed.map(f => f.id),
    });

    return { success, failed };
  }

  /**
   * Disconnect all channels
   */
  async disconnectAll(): Promise<void> {
    const connected = this.getConnected();

    for (const channel of connected) {
      try {
        await channel.disconnect();

        this.eventBus.emit('channel:disconnected', {
          channelId: channel.id,
          channelName: channel.name,
          reason: 'registry_disconnect_all',
          disconnectedAt: new Date(),
        });
      } catch (error) {
        // Log but continue with other channels
        await this.audit.log('channel_disconnect_error', 'system', 'system', {
          channelId: channel.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.audit.log('channels_disconnect_all', 'system', 'system', {
      count: connected.length,
    });
  }

  /**
   * Get channel status summary
   */
  getStatusSummary(): Array<{
    id: string;
    name: string;
    type: string;
    status: ChannelStatus;
    enabled: boolean;
  }> {
    return Array.from(this.channels.values()).map(entry => ({
      id: entry.channel.id,
      name: entry.channel.name,
      type: entry.channel.type,
      status: entry.channel.getStatus(),
      enabled: entry.config.enabled,
    }));
  }

  /**
   * Get channel capabilities summary
   */
  getCapabilitiesSummary(): Record<string, ChannelCapabilities> {
    const summary: Record<string, ChannelCapabilities> = {};

    for (const entry of this.channels.values()) {
      summary[entry.channel.id] = entry.channel.getCapabilities();
    }

    return summary;
  }

  /**
   * Enable a channel
   */
  async enable(channelId: string): Promise<boolean> {
    const entry = this.channels.get(channelId);
    if (!entry) return false;

    entry.config.enabled = true;
    entry.channel.updateConfig({ enabled: true });

    await this.audit.log('channel_enabled', 'system', 'system', {
      channelId,
    });

    return true;
  }

  /**
   * Disable a channel
   */
  async disable(channelId: string): Promise<boolean> {
    const entry = this.channels.get(channelId);
    if (!entry) return false;

    // Disconnect if connected
    if (entry.channel.isConnected()) {
      await entry.channel.disconnect();
    }

    entry.config.enabled = false;
    entry.channel.updateConfig({ enabled: false });

    await this.audit.log('channel_disabled', 'system', 'system', {
      channelId,
    });

    return true;
  }

  /**
   * Get total channel count
   */
  get size(): number {
    return this.channels.size;
  }

  /**
   * Get count by status
   */
  countByStatus(): Record<ChannelStatus, number> {
    const counts: Record<ChannelStatus, number> = {
      connected: 0,
      disconnected: 0,
      connecting: 0,
      error: 0,
      rate_limited: 0,
    };

    for (const entry of this.channels.values()) {
      const status = entry.channel.getStatus();
      counts[status]++;
    }

    return counts;
  }

  /**
   * Clear all channels (for testing)
   */
  async clear(): Promise<void> {
    await this.disconnectAll();
    this.channels.clear();
  }
}
