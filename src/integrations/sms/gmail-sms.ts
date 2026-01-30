/**
 * ARI SMS via Gmail SMTP
 *
 * Sends SMS messages through Gmail's SMTP server to carrier email-to-SMS gateways.
 * This is a free alternative to Twilio that works with most US carriers.
 *
 * Carrier gateways:
 * - Verizon: [number]@vtext.com
 * - AT&T: [number]@txt.att.net
 * - T-Mobile: [number]@tmomail.net
 * - Sprint: [number]@messaging.sprintpcs.com
 *
 * Requires: Gmail account with App Password (2FA must be enabled)
 *
 * Limitations:
 * - 160 character limit for single SMS
 * - Subject line becomes part of message on some carriers
 * - Delivery not guaranteed (carrier may block)
 */

import { createTransport, type Transporter } from 'nodemailer';
import type { SMSConfig } from '../../autonomous/types.js';

export interface SMSResult {
  sent: boolean;
  reason: string;
  messageId?: string;
  truncated?: boolean;
}

export class GmailSMS {
  private transporter: Transporter | null = null;
  private config: SMSConfig;
  private initialized = false;
  private sendHistory: { sentAt: number; message: string }[] = [];
  private rateLimitWindow = 60 * 60 * 1000; // 1 hour in ms

  constructor(config: SMSConfig) {
    this.config = config;
  }

  /**
   * Initialize the SMTP transporter
   */
  init(): boolean {
    if (!this.config.enabled || !this.config.gmailUser || !this.config.gmailAppPassword) {
      return false;
    }

    try {
      this.transporter = createTransport({
        service: 'gmail',
        auth: {
          user: this.config.gmailUser,
          pass: this.config.gmailAppPassword,
        },
      });

      this.initialized = true;
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if SMS is ready
   */
  isReady(): boolean {
    return this.initialized && this.transporter !== null && !!this.config.phoneNumber;
  }

  /**
   * Get the recipient email address (phone@carrier)
   */
  private getRecipient(): string {
    const phone = this.config.phoneNumber?.replace(/\D/g, '') ?? '';
    return `${phone}@${this.config.carrierGateway}`;
  }

  /**
   * Check if currently in quiet hours
   */
  isQuietHours(): boolean {
    const now = new Date();
    // Convert to Indiana time
    const indianaTime = new Date(
      now.toLocaleString('en-US', { timeZone: this.config.timezone })
    );
    const hour = indianaTime.getHours();

    const { quietHoursStart, quietHoursEnd } = this.config;

    // Handle wrap-around (e.g., 22:00 - 07:00)
    if (quietHoursStart > quietHoursEnd) {
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }

  /**
   * Check if rate limited
   */
  isRateLimited(): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;

    // Clean old entries
    this.sendHistory = this.sendHistory.filter((h) => h.sentAt > windowStart);

    return this.sendHistory.length >= this.config.maxPerHour;
  }

  /**
   * Check for duplicate message in recent history (5 min window)
   */
  isDuplicate(message: string): boolean {
    const now = Date.now();
    const dedupWindow = 5 * 60 * 1000; // 5 minutes

    return this.sendHistory.some(
      (h) => h.sentAt > now - dedupWindow && h.message === message
    );
  }

  /**
   * Send an SMS message
   *
   * @param message - The message text (will be truncated if > 160 chars)
   * @param options - Optional: forceDelivery bypasses quiet hours and rate limits (for P0)
   */
  async send(
    message: string,
    options?: { forceDelivery?: boolean; subject?: string }
  ): Promise<SMSResult> {
    if (!this.isReady() || !this.transporter) {
      return { sent: false, reason: 'SMS not configured' };
    }

    const forceDelivery = options?.forceDelivery ?? false;

    // Check quiet hours (unless forced)
    if (!forceDelivery && this.isQuietHours()) {
      return { sent: false, reason: 'Quiet hours active' };
    }

    // Check rate limit (unless forced)
    if (!forceDelivery && this.isRateLimited()) {
      return { sent: false, reason: 'Rate limit exceeded' };
    }

    // Check for duplicates (unless forced)
    if (!forceDelivery && this.isDuplicate(message)) {
      return { sent: false, reason: 'Duplicate message blocked' };
    }

    // Truncate if needed (SMS limit is ~160 chars)
    let finalMessage = message;
    let truncated = false;
    if (message.length > 155) {
      finalMessage = message.slice(0, 152) + '...';
      truncated = true;
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.config.gmailUser,
        to: this.getRecipient(),
        subject: options?.subject ?? 'ARI',
        text: finalMessage,
      });

      // Record in history
      this.sendHistory.push({
        sentAt: Date.now(),
        message,
      });

      return {
        sent: true,
        reason: 'Sent',
        messageId: result.messageId,
        truncated,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { sent: false, reason: `SMTP error: ${msg}` };
    }
  }

  /**
   * Test the SMS connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isReady() || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current stats
   */
  getStats(): {
    sentThisHour: number;
    rateLimitRemaining: number;
    isQuietHours: boolean;
  } {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    const recentSends = this.sendHistory.filter((h) => h.sentAt > windowStart);

    return {
      sentThisHour: recentSends.length,
      rateLimitRemaining: Math.max(0, this.config.maxPerHour - recentSends.length),
      isQuietHours: this.isQuietHours(),
    };
  }
}
