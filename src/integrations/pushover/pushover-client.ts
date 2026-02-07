/**
 * ARI Pushover Client
 *
 * Two-way communication via Pushover:
 * - Send notifications to user's phone
 * - Receive messages via Open Client API (requires desktop registration)
 * - Support for priority levels, sounds, and acknowledgments
 */

import https from 'node:https';
import { EventEmitter } from 'node:events';
import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('pushover-client');

// GLOBAL KILL SWITCH - Disable ALL Pushover API calls
// This was added to prevent API cost issues
// Can be overridden in tests via PUSHOVER_ENABLED=true
function isPushoverIntegrationDisabled(): boolean {
  return process.env.PUSHOVER_ENABLED !== 'true';
}

export interface PushoverConfig {
  userKey: string;
  apiToken: string;
  device?: string;
  secret?: string;  // For receiving messages (Open Client)
}

export interface PushoverMessage {
  title?: string;
  message: string;
  priority?: -2 | -1 | 0 | 1 | 2;  // -2=lowest, 2=emergency
  sound?: string;
  url?: string;
  urlTitle?: string;
  device?: string;
  html?: boolean;
}

export interface PushoverResponse {
  success: boolean;
  requestId?: string;
  error?: string;
}

export interface IncomingMessage {
  id: number;
  umid: number;
  message: string;
  app: string;
  aid: number;
  icon: string;
  date: number;
  priority: number;
  acked: number;
}

// Pushover API response types
interface PushoverApiResponse {
  status: number;
  request?: string;
  errors?: string[];
  messages?: IncomingMessage[];
}

export class PushoverClient extends EventEmitter {
  private config: PushoverConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMessageId = 0;
  private running = false;

  constructor(config: PushoverConfig) {
    super();
    this.config = config;
  }

  /**
   * Send a notification
   */
  async send(msg: PushoverMessage): Promise<PushoverResponse> {
    // KILL SWITCH - Pushover is disabled to prevent API cost issues
    if (isPushoverIntegrationDisabled()) {
      logger.info({ title: msg.title || 'notification' }, '[PUSHOVER INTEGRATION DISABLED] Would have sent');
      return { success: false, error: 'Pushover disabled' };
    }

    return new Promise((resolve) => {
      const data = JSON.stringify({
        token: this.config.apiToken,
        user: this.config.userKey,
        message: msg.message,
        title: msg.title ?? 'ARI',
        priority: msg.priority ?? 0,
        sound: msg.sound ?? 'pushover',
        url: msg.url,
        url_title: msg.urlTitle,
        device: msg.device ?? this.config.device,
        html: msg.html ? 1 : 0,
      });

      const options = {
        hostname: 'api.pushover.net',
        port: 443,
        path: '/1/messages.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as PushoverApiResponse;
            if (parsed.status === 1) {
              resolve({ success: true, requestId: parsed.request });
            } else {
              resolve({ success: false, error: parsed.errors?.join(', ') ?? 'Unknown error' });
            }
          } catch {
            resolve({ success: false, error: 'Invalid response' });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Send with different priority levels
   */
  async notify(message: string, title?: string): Promise<PushoverResponse> {
    return this.send({ message, title, priority: 0 });
  }

  async alert(message: string, title?: string): Promise<PushoverResponse> {
    return this.send({ message, title, priority: 1, sound: 'siren' });
  }

  async emergency(message: string, title?: string): Promise<PushoverResponse> {
    // Priority 2 requires retry and expire parameters
    return new Promise((resolve) => {
      const data = JSON.stringify({
        token: this.config.apiToken,
        user: this.config.userKey,
        message,
        title: title ?? 'ARI EMERGENCY',
        priority: 2,
        sound: 'alien',
        retry: 60,    // Retry every 60 seconds
        expire: 3600, // Expire after 1 hour
      });

      const options = {
        hostname: 'api.pushover.net',
        port: 443,
        path: '/1/messages.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as PushoverApiResponse;
            resolve({
              success: parsed.status === 1,
              requestId: parsed.request,
              error: parsed.errors?.join(', '),
            });
          } catch {
            resolve({ success: false, error: 'Invalid response' });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(data);
      req.end();
    });
  }

  async quiet(message: string, title?: string): Promise<PushoverResponse> {
    return this.send({ message, title, priority: -1 });
  }

  /**
   * Start polling for incoming messages (requires secret)
   */
  async startReceiving(pollIntervalMs = 5000): Promise<boolean> {
    if (!this.config.secret) {
      this.emit('error', new Error('Secret required for receiving messages'));
      return false;
    }

    if (this.running) return true;
    this.running = true;

    // Initial fetch
    await this.fetchMessages();

    // Start polling
    this.pollTimer = setInterval(() => {
      void this.fetchMessages();
    }, pollIntervalMs);

    this.emit('started');
    return true;
  }

  /**
   * Stop receiving messages
   */
  stopReceiving(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Fetch new messages from Open Client API
   */
  private async fetchMessages(): Promise<void> {
    if (!this.config.secret || !this.config.device) return;

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.pushover.net',
        port: 443,
        path: `/1/messages.json?secret=${this.config.secret}&device_id=${this.config.device}`,
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as PushoverApiResponse;
            if (parsed.status === 1 && parsed.messages) {
              for (const msg of parsed.messages) {
                if (msg.id > this.lastMessageId) {
                  this.lastMessageId = msg.id;
                  this.emit('message', msg);
                }
              }
            }
          } catch {
            this.emit('error', new Error('Failed to parse messages'));
          }
          resolve();
        });
      });

      req.on('error', (e) => {
        this.emit('error', e);
        resolve();
      });

      req.end();
    });
  }

  /**
   * Delete messages after processing
   */
  async deleteMessages(upToId: number): Promise<boolean> {
    if (!this.config.secret || !this.config.device) return false;

    return new Promise((resolve) => {
      const data = JSON.stringify({
        secret: this.config.secret,
        message: upToId,
      });

      const options = {
        hostname: 'api.pushover.net',
        port: 443,
        path: `/1/devices/${this.config.device}/update_highest_message.json`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as PushoverApiResponse;
            resolve(parsed.status === 1);
          } catch {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    });
  }

  /**
   * Verify credentials
   */
  async verify(): Promise<boolean> {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        token: this.config.apiToken,
        user: this.config.userKey,
      });

      const options = {
        hostname: 'api.pushover.net',
        port: 443,
        path: '/1/users/validate.json',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as PushoverApiResponse;
            resolve(parsed.status === 1);
          } catch {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    });
  }

  isRunning(): boolean {
    return this.running;
  }
}
