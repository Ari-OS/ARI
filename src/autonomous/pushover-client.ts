/**
 * ARI Pushover Client
 *
 * Two-way Pushover communication:
 * - Send notifications to the operator
 * - Receive commands from the operator via Open Client API
 *
 * Security:
 * - Never sends sensitive data in notifications
 * - Validates incoming messages
 * - Rate limits outbound notifications
 */

import { PushoverMessage, PushoverResponse } from './types.js';

const PUSHOVER_API = 'https://api.pushover.net/1';
const PUSHOVER_CLIENT_API = 'https://client.pushover.net';

interface PushoverConfig {
  userKey: string;
  apiToken: string;
  deviceId?: string;
  secret?: string;
  enabled?: boolean;  // Set to false to disable all Pushover API calls
}

// GLOBAL KILL SWITCH - Pushover is PERMANENTLY DISABLED
// Pushover was causing spam issues and cost problems
// Use Twilio SMS or other notification channels instead
// To re-enable, change this function to check PUSHOVER_ENABLED env var
function isPushoverDisabled(): boolean {
  return true; // ALWAYS disabled - use Twilio SMS instead
}

interface NotificationOptions {
  title?: string;
  priority?: -2 | -1 | 0 | 1 | 2;
  sound?: string;
  url?: string;
  urlTitle?: string;
}

export class PushoverClient {
  private config: PushoverConfig;
  private lastNotification = 0;
  private minIntervalMs = 1000; // Rate limit: 1 notification per second

  constructor(config: PushoverConfig) {
    this.config = config;
  }

  /**
   * Send a notification to the operator
   * Security: Sanitizes message content
   */
  async send(
    message: string,
    options: NotificationOptions = {}
  ): Promise<boolean> {
    // KILL SWITCH - Pushover is disabled to prevent API cost issues
    if (isPushoverDisabled() || this.config.enabled === false) {
      // eslint-disable-next-line no-console
      console.log('[PUSHOVER DISABLED] Would have sent:', options.title || 'notification');
      return false;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastNotification < this.minIntervalMs) {
      await new Promise(r => setTimeout(r, this.minIntervalMs - (now - this.lastNotification)));
    }

    // Sanitize message - remove anything that looks sensitive
    const safeMessage = this.sanitize(message).slice(0, 1024);
    const safeTitle = options.title ? this.sanitize(options.title).slice(0, 250) : undefined;

    try {
      const response = await fetch(`${PUSHOVER_API}/messages.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: this.config.apiToken,
          user: this.config.userKey,
          message: safeMessage,
          ...(safeTitle && { title: safeTitle }),
          ...(options.priority !== undefined && { priority: String(options.priority) }),
          ...(options.sound && { sound: options.sound }),
          ...(options.url && { url: options.url }),
          ...(options.urlTitle && { url_title: options.urlTitle }),
        }).toString(),
      });

      const result = await response.json() as PushoverResponse;
      this.lastNotification = Date.now();

      return result.status === 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Pushover send error:', error);
      return false;
    }
  }

  /**
   * Register device for receiving messages (Open Client API)
   * Returns device secret for message retrieval
   */
  async registerDevice(deviceName: string): Promise<string | null> {
    // KILL SWITCH - Pushover is disabled
    if (isPushoverDisabled() || this.config.enabled === false) {
      return null;
    }

    try {
      const response = await fetch(`${PUSHOVER_API}/devices.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: this.config.apiToken,
          secret: this.config.secret || '',
          name: deviceName,
          os: 'O', // Other
        }).toString(),
      });

      const result = await response.json() as { status: number; id?: string; secret?: string };
      if (result.status === 1 && result.id) {
        return result.secret || result.id;
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Device registration error:', error);
      return null;
    }
  }

  /**
   * Fetch new messages from Pushover (Open Client API)
   * Requires device secret from registration
   */
  async fetchMessages(): Promise<PushoverMessage[]> {
    // KILL SWITCH - Pushover is disabled
    if (isPushoverDisabled() || this.config.enabled === false) {
      return [];
    }

    if (!this.config.secret || !this.config.deviceId) {
      return [];
    }

    try {
      const response = await fetch(
        `${PUSHOVER_CLIENT_API}/messages.json?secret=${this.config.secret}&device_id=${this.config.deviceId}`,
        { method: 'GET' }
      );

      const result = await response.json() as PushoverResponse;

      if (result.status === 1 && result.messages) {
        return result.messages;
      }
      return [];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Fetch messages error:', error);
      return [];
    }
  }

  /**
   * Delete messages after processing (acknowledge receipt)
   */
  async deleteMessages(messageId: number): Promise<boolean> {
    // KILL SWITCH - Pushover is disabled
    if (isPushoverDisabled() || this.config.enabled === false) {
      return false;
    }

    if (!this.config.secret || !this.config.deviceId) {
      return false;
    }

    try {
      const response = await fetch(
        `${PUSHOVER_CLIENT_API}/messages.json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: this.config.secret,
            message: String(messageId),
          }).toString(),
        }
      );

      const result = await response.json() as { status: number };
      return result.status === 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Delete messages error:', error);
      return false;
    }
  }

  /**
   * Login to get device secret (required for receiving messages)
   */
  async login(email: string, password: string, twoFactor?: string): Promise<{ secret: string; deviceId: string } | null> {
    // KILL SWITCH - Pushover is disabled
    if (isPushoverDisabled() || this.config.enabled === false) {
      return null;
    }

    try {
      const params: Record<string, string> = { email, password };
      if (twoFactor) params.twofa = twoFactor;

      const response = await fetch(`${PUSHOVER_CLIENT_API}/login.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });

      const result = await response.json() as { status: number; secret?: string; id?: string };

      if (result.status === 1 && result.secret) {
        return {
          secret: result.secret,
          deviceId: result.id || this.config.deviceId || '',
        };
      }
      return null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Pushover login error:', error);
      return null;
    }
  }

  /**
   * Sanitize content to remove sensitive data
   */
  private sanitize(text: string): string {
    return text
      // Remove potential API keys/tokens (32+ hex chars)
      .replace(/[a-f0-9]{32,}/gi, '[REDACTED]')
      // Remove Bearer tokens
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
      // Remove key=value patterns for sensitive keys
      .replace(/(api[_-]?key|token|secret|password|credential)[=:]\s*[^\s,}]+/gi, '$1=[REDACTED]')
      // Remove email-like patterns in certain contexts
      .replace(/password.*?[^\s]+/gi, 'password=[REDACTED]');
  }

  /**
   * Send a status notification
   */
  async sendStatus(status: 'online' | 'offline' | 'error', details?: string): Promise<boolean> {
    const statusConfig = {
      online: { icon: '✓', sound: 'cosmic', priority: 0 as const },
      offline: { icon: '○', sound: 'falling', priority: 0 as const },
      error: { icon: '✗', sound: 'siren', priority: 1 as const },
    };

    const { icon, sound, priority } = statusConfig[status];
    const message = details || `System is ${status}.`;

    return this.send(message, {
      title: `${icon} ARI ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      priority,
      sound,
    });
  }

  /**
   * Send task completion notification
   */
  async sendTaskComplete(taskId: string, success: boolean, summary: string): Promise<boolean> {
    const icon = success ? '✓' : '✗';
    const word = success ? 'Done' : 'Failed';

    return this.send(summary.slice(0, 500), {
      title: `${icon} ${word}`,
      priority: success ? 0 : 1,
    });
  }

  /**
   * Send daily audit summary
   */
  async sendDailyAudit(audit: {
    tasksCompleted: number;
    tasksFailed: number;
    estimatedCost: number;
    highlights: string[];
    issues: string[];
  }): Promise<boolean> {
    const lines: string[] = [];

    // Stats line
    lines.push(`✓ ${audit.tasksCompleted} done  ✗ ${audit.tasksFailed} failed  ◈ $${audit.estimatedCost.toFixed(2)}`);

    // Highlights
    if (audit.highlights.length > 0) {
      lines.push('');
      audit.highlights.slice(0, 3).forEach(h => {
        lines.push(`▸ ${h}`);
      });
    }

    // Issues
    if (audit.issues.length > 0) {
      lines.push('');
      audit.issues.slice(0, 2).forEach(i => {
        lines.push(`⚠ ${i}`);
      });
    }

    return this.send(lines.join('\n'), {
      title: '▫ Daily Report',
      priority: audit.issues.length > 0 ? 0 : -1,
    });
  }

  /**
   * Send batched summary
   */
  async sendBatchedSummary(items: { type: string; title: string }[]): Promise<boolean> {
    if (items.length === 0) return true;

    const lines: string[] = [];
    lines.push(`${items.length} updates:`);
    lines.push('');

    items.slice(0, 5).forEach(item => {
      lines.push(`▸ ${item.title}`);
    });

    if (items.length > 5) {
      lines.push(`... +${items.length - 5} more`);
    }

    return this.send(lines.join('\n'), {
      title: '▫ Summary',
      priority: -1,
    });
  }

  /**
   * Send cost alert
   */
  async sendCostAlert(spent: number, limit: number, daysRemaining: number): Promise<boolean> {
    const percent = Math.round((spent / limit) * 100);
    const bar = '▓'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));

    return this.send(
      `${bar} ${percent}%\n\n$${spent.toFixed(2)} / $${limit.toFixed(2)}\n${daysRemaining} days left`,
      {
        title: '◈ Budget',
        priority: percent >= 90 ? 1 : 0,
      }
    );
  }

  /**
   * Send opportunity alert
   */
  async sendOpportunity(title: string, description: string, urgency: 'low' | 'medium' | 'high'): Promise<boolean> {
    const indicator = urgency === 'high' ? '▲▲▲' : urgency === 'medium' ? '▲▲' : '▲';

    return this.send(description, {
      title: `◇ ${title} ${indicator}`,
      priority: urgency === 'high' ? 1 : 0,
    });
  }

  /**
   * Send insight
   */
  async sendInsight(domain: string, insight: string): Promise<boolean> {
    return this.send(insight, {
      title: `◇ ${domain.charAt(0).toUpperCase() + domain.slice(1)}`,
      priority: -1,
    });
  }
}
