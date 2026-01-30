import { createHmac, timingSafeEqual } from 'crypto';
import type {
  ChannelConfig,
  OutboundMessage,
  SendResult,
} from '../types.js';
import { BaseChannel } from './base.js';

/**
 * Slack-specific configuration
 */
export interface SlackConfig {
  /** Bot OAuth token (xoxb-...) */
  botToken: string;
  /** App-level token for Socket Mode (xapp-...) */
  appToken?: string;
  /** Signing secret for webhook verification */
  signingSecret?: string;
  /** Allowed channel IDs */
  allowedChannels?: string[];
  /** Allowed user IDs */
  allowedUsers?: string[];
  /** Default channel for outbound messages */
  defaultChannel?: string;
}

/**
 * Slack API response types
 */
interface SlackResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
}

// SlackUser interface for future use
// interface SlackUser {
//   id: string;
//   name: string;
//   real_name?: string;
// }

interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
}

/**
 * SlackChannel
 *
 * Slack workspace channel adapter.
 * Supports messaging via Slack Web API.
 */
export class SlackChannel extends BaseChannel {
  private slackConfig: SlackConfig;
  private apiBaseUrl = 'https://slack.com/api';

  constructor(config: ChannelConfig, slackConfig: SlackConfig) {
    super({
      ...config,
      type: 'bidirectional',
      capabilities: {
        typingIndicator: false,
        reactions: true,
        attachments: true,
        replies: true,
        editing: true,
        deletion: true,
        readReceipts: false,
        maxMessageLength: 40000,
        supportedAttachments: ['image', 'file'],
        ...config.capabilities,
      },
    });

    this.slackConfig = slackConfig;
  }

  /**
   * Connect to Slack
   */
  async connect(): Promise<void> {
    if (!this.slackConfig.botToken) {
      throw new Error('Slack bot token is required');
    }

    // Verify token by calling auth.test
    const auth = await this.callApi<{ user_id: string; team: string }>('auth.test');
    if (!auth) {
      throw new Error('Failed to verify Slack bot token');
    }

    this.setStatus('connected');

    // Note: For receiving messages, Slack requires either:
    // 1. Socket Mode (requires appToken)
    // 2. Webhook/Events API (requires external HTTP server)
    // This implementation provides the infrastructure but actual
    // message receiving would need to be handled by the gateway
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
    return Promise.resolve();
  }

  /**
   * Send a message via Slack
   */
  protected async doSend(message: OutboundMessage): Promise<SendResult> {
    const params: Record<string, unknown> = {
      channel: message.recipientId || this.slackConfig.defaultChannel,
      text: message.content,
    };

    // Add thread reply
    if (message.replyTo) {
      params.thread_ts = message.replyTo;
    }

    // Add blocks if in options
    if (message.options?.blocks) {
      params.blocks = message.options.blocks;
    }

    // Add unfurl options
    if (message.options?.unfurlLinks !== undefined) {
      params.unfurl_links = message.options.unfurlLinks;
    }
    if (message.options?.unfurlMedia !== undefined) {
      params.unfurl_media = message.options.unfurlMedia;
    }

    const result = await this.callApi<SlackResponse>('chat.postMessage', params);

    if (result?.ok) {
      return this.createSendResult(true, result.ts);
    } else {
      return this.createSendResult(false, undefined, result?.error || 'Failed to send message');
    }
  }

  /**
   * React to a message
   */
  react(_messageId: string, _reaction: string): boolean {
    // Need channel which we don't have from just messageId
    // This would need to be tracked separately
    return false;
  }

  /**
   * Edit a message
   */
  edit(_messageId: string, _newContent: string): boolean {
    // Need channel which we don't have from just messageId
    return false;
  }

  /**
   * Delete a message
   */
  delete(_messageId: string): boolean {
    // Need channel which we don't have from just messageId
    return false;
  }

  /**
   * Call Slack Web API
   */
  private async callApi<T>(method: string, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${method}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.slackConfig.botToken}`,
          'Content-Type': 'application/json',
        },
        body: params ? JSON.stringify(params) : undefined,
      });

      const data = await response.json() as T & { ok: boolean; error?: string };

      if (data.ok) {
        return data;
      }

      // eslint-disable-next-line no-console
      console.error(`Slack API error: ${data.error}`);
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Slack API call failed:', error);
      return null;
    }
  }

  /**
   * Handle Slack event (from webhook or Socket Mode)
   */
  handleEvent(event: SlackEvent): void {
    if (event.type !== 'message' || !event.text || !event.user) {
      return;
    }

    // Check allowed channels
    if (
      this.slackConfig.allowedChannels &&
      event.channel &&
      !this.slackConfig.allowedChannels.includes(event.channel)
    ) {
      return;
    }

    // Check allowed users
    if (
      this.slackConfig.allowedUsers &&
      !this.slackConfig.allowedUsers.includes(event.user)
    ) {
      return;
    }

    const inbound = this.createInboundMessage(
      event.text,
      event.user,
      {
        id: event.ts,
        groupId: event.channel,
        replyTo: event.thread_ts,
        metadata: {
          channel: event.channel,
          threadTs: event.thread_ts,
        },
      }
    );

    this.queueMessage(inbound);
  }

  /**
   * Verify Slack request signature
   */
  verifySignature(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!this.slackConfig.signingSecret) return false;

    const sigBasestring = `v0:${timestamp}:${body}`;
    const mySignature = 'v0=' + createHmac('sha256', this.slackConfig.signingSecret)
      .update(sigBasestring)
      .digest('hex');

    return timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  }
}

/**
 * Create a Slack channel from configuration
 */
export function createSlackChannel(
  config: ChannelConfig,
  slackConfig: SlackConfig
): SlackChannel {
  return new SlackChannel(config, slackConfig);
}
