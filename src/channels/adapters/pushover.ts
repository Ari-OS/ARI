import type {
  ChannelConfig,
  OutboundMessage,
  SendResult,
  MessagePriority,
} from '../types.js';
import { BaseChannel } from './base.js';

/**
 * Pushover-specific configuration
 */
export interface PushoverConfig {
  /** Pushover application API token */
  appToken: string;
  /** Pushover user key */
  userKey: string;
  /** Device name (optional, for targeting specific device) */
  device?: string;
  /** Polling interval for Open Client API (ms) */
  pollInterval?: number;
  /** Open Client secret (for receiving messages) */
  openClientSecret?: string;
  /** Open Client device ID (for receiving messages) */
  openClientDeviceId?: string;
}

/**
 * Map ARI priority to Pushover priority
 */
const PRIORITY_MAP: Record<MessagePriority, number> = {
  lowest: -2,
  low: -1,
  normal: 0,
  high: 1,
  emergency: 2,
};

/**
 * PushoverChannel
 *
 * Bidirectional Pushover channel adapter.
 * Supports sending notifications and receiving replies via Open Client API.
 */
export class PushoverChannel extends BaseChannel {
  private pushoverConfig: PushoverConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMessageId: number = 0;

  constructor(config: ChannelConfig, pushoverConfig: PushoverConfig) {
    super({
      ...config,
      type: 'bidirectional',
      capabilities: {
        typingIndicator: false,
        reactions: false,
        attachments: true,
        replies: true,
        editing: false,
        deletion: false,
        readReceipts: false,
        maxMessageLength: 1024,
        supportedAttachments: ['image'],
        ...config.capabilities,
      },
    });

    this.pushoverConfig = pushoverConfig;
  }

  /**
   * Connect to Pushover
   */
  async connect(): Promise<void> {
    // Validate configuration
    if (!this.pushoverConfig.appToken) {
      throw new Error('Pushover app token is required');
    }
    if (!this.pushoverConfig.userKey) {
      throw new Error('Pushover user key is required');
    }

    // Test connection by validating the user
    await this.validateUser();

    this.setStatus('connected');

    // Start polling for messages if Open Client is configured
    if (this.pushoverConfig.openClientSecret && this.pushoverConfig.openClientDeviceId) {
      this.startPolling();
    }
  }

  /**
   * Disconnect from Pushover
   */
  async disconnect(): Promise<void> {
    this.stopPolling();
    this.setStatus('disconnected');
    return Promise.resolve();
  }

  /**
   * Validate user key
   */
  private async validateUser(): Promise<void> {
    const response = await fetch('https://api.pushover.net/1/users/validate.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: this.pushoverConfig.appToken,
        user: this.pushoverConfig.userKey,
      }),
    });

    const data = await response.json() as { status: number; errors?: string[] };

    if (data.status !== 1) {
      throw new Error(`Pushover validation failed: ${data.errors?.join(', ') || 'Unknown error'}`);
    }
  }

  /**
   * Send a message via Pushover
   */
  protected async doSend(message: OutboundMessage): Promise<SendResult> {
    const params: Record<string, string> = {
      token: this.pushoverConfig.appToken,
      user: this.pushoverConfig.userKey,
      message: message.content,
      priority: String(PRIORITY_MAP[message.priority || 'normal']),
    };

    // Add device if specified
    if (this.pushoverConfig.device) {
      params.device = this.pushoverConfig.device;
    }

    // Add title if in options
    if (message.options?.title && typeof message.options.title === 'string') {
      params.title = message.options.title;
    }

    // Add URL if in options
    if (message.options?.url && typeof message.options.url === 'string') {
      params.url = message.options.url;
    }

    // Add sound if in options
    if (message.options?.sound && typeof message.options.sound === 'string') {
      params.sound = message.options.sound;
    }

    // Emergency priority requires retry and expire
    if (message.priority === 'emergency') {
      const retry = typeof message.options?.retry === 'number' ? message.options.retry : 60;
      const expire = typeof message.options?.expire === 'number' ? message.options.expire : 3600;
      params.retry = String(retry);
      params.expire = String(expire);
    }

    // Handle attachments (first image only)
    let body: URLSearchParams | FormData;
    const hasImageAttachment = message.attachments.some(a => a.type === 'image');

    if (hasImageAttachment) {
      const imageAttachment = message.attachments.find(a => a.type === 'image');
      if (imageAttachment?.data) {
        body = new FormData();
        for (const [key, value] of Object.entries(params)) {
          body.append(key, value);
        }
        // Convert base64 to blob
        const buffer = Buffer.from(imageAttachment.data, 'base64');
        const blob = new Blob([buffer], { type: imageAttachment.mimeType || 'image/png' });
        body.append('attachment', blob, imageAttachment.filename || 'image.png');
      } else {
        body = new URLSearchParams(params);
      }
    } else {
      body = new URLSearchParams(params);
    }

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      body,
    });

    const data = await response.json() as { status: number; request: string; errors?: string[] };

    if (data.status === 1) {
      return this.createSendResult(true, data.request);
    } else {
      return this.createSendResult(false, undefined, data.errors?.join(', ') || 'Send failed');
    }
  }

  /**
   * Start polling for messages (Open Client API)
   */
  private startPolling(): void {
    if (this.pollTimer) return;

    const interval = this.pushoverConfig.pollInterval || 10000;

    this.pollTimer = setInterval(() => {
      this.pollMessages().catch((error) => {
        // Log but continue polling
        // eslint-disable-next-line no-console
        console.error('Pushover poll error:', error);
      });
    }, interval);

    // Initial poll
    void this.pollMessages();
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll for new messages
   */
  private async pollMessages(): Promise<void> {
    if (!this.pushoverConfig.openClientSecret || !this.pushoverConfig.openClientDeviceId) {
      return;
    }

    const response = await fetch(
      `https://api.pushover.net/1/messages.json?secret=${this.pushoverConfig.openClientSecret}&device_id=${this.pushoverConfig.openClientDeviceId}`,
      { method: 'GET' }
    );

    const data = await response.json() as {
      status: number;
      messages?: Array<{
        id: number;
        message: string;
        app: string;
        aid: number;
        uid: number;
        date: number;
        title?: string;
        priority: number;
      }>;
    };

    if (data.status === 1 && data.messages) {
      for (const msg of data.messages) {
        // Skip already processed messages
        if (msg.id <= this.lastMessageId) continue;

        this.lastMessageId = msg.id;

        const inbound = this.createInboundMessage(
          msg.message,
          String(msg.uid),
          {
            id: String(msg.id),
            metadata: {
              app: msg.app,
              aid: msg.aid,
              title: msg.title,
              priority: msg.priority,
              date: msg.date,
            },
          }
        );

        this.queueMessage(inbound);
      }

      // Delete processed messages
      if (data.messages.length > 0) {
        await this.deleteMessages(this.lastMessageId);
      }
    }
  }

  /**
   * Delete processed messages from server
   */
  private async deleteMessages(upToId: number): Promise<void> {
    if (!this.pushoverConfig.openClientSecret || !this.pushoverConfig.openClientDeviceId) {
      return;
    }

    await fetch(
      `https://api.pushover.net/1/devices/${this.pushoverConfig.openClientDeviceId}/update_highest_message.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.pushoverConfig.openClientSecret,
          message: String(upToId),
        }),
      }
    );
  }
}

/**
 * Create a Pushover channel from configuration
 */
export function createPushoverChannel(
  config: ChannelConfig,
  pushoverConfig: PushoverConfig
): PushoverChannel {
  return new PushoverChannel(config, pushoverConfig);
}
