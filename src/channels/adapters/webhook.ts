import type {
  ChannelConfig,
  OutboundMessage,
  SendResult,
  InboundMessage,
} from '../types.js';
import { BaseChannel } from './base.js';

/**
 * Webhook-specific configuration
 */
export interface WebhookConfig {
  /** Outbound webhook URL */
  outboundUrl: string;
  /** HTTP method for outbound */
  method?: 'POST' | 'PUT';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Authentication type */
  authType?: 'none' | 'bearer' | 'basic' | 'apikey';
  /** Auth token (for bearer/apikey) */
  authToken?: string;
  /** Auth header name (for apikey) */
  authHeader?: string;
  /** Basic auth username */
  basicUsername?: string;
  /** Basic auth password */
  basicPassword?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
  };
  /** Response field containing message ID */
  responseIdField?: string;
}

/**
 * WebhookChannel
 *
 * Generic webhook channel adapter.
 * Supports sending messages via configurable webhooks.
 * Inbound messages are received via gateway webhook endpoint.
 */
export class WebhookChannel extends BaseChannel {
  private webhookConfig: WebhookConfig;

  constructor(config: ChannelConfig, webhookConfig: WebhookConfig) {
    super({
      ...config,
      type: 'push', // Webhook is primarily push-based
      capabilities: {
        typingIndicator: false,
        reactions: false,
        attachments: true,
        replies: false,
        editing: false,
        deletion: false,
        readReceipts: false,
        maxMessageLength: undefined, // Depends on target
        supportedAttachments: ['image', 'file'],
        ...config.capabilities,
      },
    });

    this.webhookConfig = webhookConfig;
  }

  /**
   * Connect to webhook (validate configuration)
   */
  async connect(): Promise<void> {
    if (!this.webhookConfig.outboundUrl) {
      throw new Error('Webhook outbound URL is required');
    }

    // Validate URL
    try {
      new URL(this.webhookConfig.outboundUrl);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    this.setStatus('connected');
    return Promise.resolve();
  }

  /**
   * Disconnect (no-op for webhook)
   */
  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
    return Promise.resolve();
  }

  /**
   * Send a message via webhook
   */
  protected async doSend(message: OutboundMessage): Promise<SendResult> {
    const headers = this.buildHeaders();
    const body = this.buildBody(message);

    let lastError: Error | null = null;
    const retry = this.webhookConfig.retry || { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000 };

    for (let attempt = 0; attempt < retry.maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, this.webhookConfig.timeout || 30000);

        const response = await fetch(this.webhookConfig.outboundUrl, {
          method: this.webhookConfig.method || 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          let messageId: string | undefined;

          // Try to extract message ID from response
          if (this.webhookConfig.responseIdField) {
            try {
              const data = await response.json() as Record<string, unknown>;
              messageId = String(data[this.webhookConfig.responseIdField]);
            } catch {
              // Ignore JSON parse errors
            }
          }

          return this.createSendResult(true, messageId);
        }

        // Non-retryable errors
        if (response.status >= 400 && response.status < 500) {
          return this.createSendResult(false, undefined, `HTTP ${response.status}: ${response.statusText}`);
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retry (exponential backoff)
      if (attempt < retry.maxAttempts - 1) {
        const delay = Math.min(
          retry.initialDelay * Math.pow(2, attempt),
          retry.maxDelay
        );
        await this.sleep(delay);
      }
    }

    return this.createSendResult(false, undefined, lastError?.message || 'Request failed');
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ARI/2.0',
      ...this.webhookConfig.headers,
    };

    // Add authentication
    switch (this.webhookConfig.authType) {
      case 'bearer':
        if (this.webhookConfig.authToken) {
          headers['Authorization'] = `Bearer ${this.webhookConfig.authToken}`;
        }
        break;

      case 'basic':
        if (this.webhookConfig.basicUsername && this.webhookConfig.basicPassword) {
          const credentials = Buffer.from(
            `${this.webhookConfig.basicUsername}:${this.webhookConfig.basicPassword}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'apikey':
        if (this.webhookConfig.authToken) {
          const headerName = this.webhookConfig.authHeader || 'X-API-Key';
          headers[headerName] = this.webhookConfig.authToken;
        }
        break;
    }

    return headers;
  }

  /**
   * Build request body
   */
  private buildBody(message: OutboundMessage): Record<string, unknown> {
    return {
      id: message.id,
      recipient: message.recipientId,
      content: message.content,
      priority: message.priority,
      timestamp: new Date().toISOString(),
      sessionId: message.sessionId,
      replyTo: message.replyTo,
      attachments: message.attachments.map(a => ({
        id: a.id,
        type: a.type,
        url: a.url,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
      })),
      ...message.options,
    };
  }

  /**
   * Handle inbound webhook request
   */
  handleInboundWebhook(
    body: Record<string, unknown>,
    headers?: Record<string, string>
  ): InboundMessage | null {
    // Extract required fields
    const content = body.content || body.message || body.text;
    const senderId = body.senderId || body.sender || body.from || body.user;

    if (typeof content !== 'string' || typeof senderId !== 'string') {
      return null;
    }

    return this.createInboundMessage(
      content,
      senderId,
      {
        id: typeof body.id === 'string' ? body.id : undefined,
        senderName: typeof body.senderName === 'string' ? body.senderName : undefined,
        groupId: typeof body.groupId === 'string' ? body.groupId : undefined,
        replyTo: typeof body.replyTo === 'string' ? body.replyTo : undefined,
        metadata: {
          raw: body,
          headers,
        },
      }
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a webhook channel from configuration
 */
export function createWebhookChannel(
  config: ChannelConfig,
  webhookConfig: WebhookConfig
): WebhookChannel {
  return new WebhookChannel(config, webhookConfig);
}
