/**
 * ARI Gmail IMAP Receiver for Two-Way SMS
 *
 * Polls Gmail inbox for SMS replies from the carrier gateway.
 * When you reply to a text from ARI, the carrier routes it back
 * to Gmail as an email (e.g., from 1234567890@vtext.com).
 *
 * This class:
 * 1. Connects to Gmail via IMAP
 * 2. Polls for new messages from the user's phone number
 * 3. Parses the SMS content
 * 4. Emits events for processing
 * 5. Marks messages as read
 */

import imaps from 'imap-simple';
import { simpleParser, type ParsedMail } from 'mailparser';
import { EventEmitter } from 'node:events';
import type { SMSConfig } from '../../autonomous/types.js';

export interface IncomingSMS {
  id: string;
  from: string;
  body: string;
  receivedAt: Date;
  raw?: ParsedMail;
}

export interface ReceiverConfig {
  gmailUser: string;
  gmailAppPassword: string;
  phoneNumber: string;
  carrierGateway: string;
  pollIntervalMs?: number;
}

export class GmailReceiver extends EventEmitter {
  private config: ReceiverConfig;
  private connection: imaps.ImapSimple | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private running = false;
  private processedIds: Set<string> = new Set();
  private lastPollTime: Date = new Date(0);

  constructor(config: ReceiverConfig) {
    super();
    this.config = {
      pollIntervalMs: 30000, // Default 30 seconds
      ...config,
    };
  }

  /**
   * Create from SMSConfig
   */
  static fromSMSConfig(config: SMSConfig): GmailReceiver | null {
    if (!config.gmailUser || !config.gmailAppPassword || !config.phoneNumber) {
      return null;
    }

    return new GmailReceiver({
      gmailUser: config.gmailUser,
      gmailAppPassword: config.gmailAppPassword,
      phoneNumber: config.phoneNumber,
      carrierGateway: config.carrierGateway ?? 'vtext.com',
    });
  }

  /**
   * Get the expected sender address for SMS replies
   */
  private getSenderAddress(): string {
    const phone = this.config.phoneNumber.replace(/\D/g, '');
    return `${phone}@${this.config.carrierGateway}`;
  }

  /**
   * Connect to Gmail IMAP
   */
  async connect(): Promise<boolean> {
    try {
      const imapConfig: imaps.ImapSimpleOptions = {
        imap: {
          user: this.config.gmailUser,
          password: this.config.gmailAppPassword,
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 10000,
        },
      };

      this.connection = await imaps.connect(imapConfig);
      this.emit('connected');
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`IMAP connection failed: ${msg}`));
      return false;
    }
  }

  /**
   * Disconnect from Gmail
   */
  disconnect(): void {
    if (this.connection) {
      try {
        this.connection.end();
      } catch {
        // Ignore disconnect errors
      }
      this.connection = null;
    }
    this.emit('disconnected');
  }

  /**
   * Start polling for new messages
   */
  async start(): Promise<void> {
    if (this.running) return;

    const connected = await this.connect();
    if (!connected) {
      throw new Error('Failed to connect to Gmail IMAP');
    }

    this.running = true;
    this.emit('started');

    // Initial poll
    await this.poll();

    // Schedule recurring polls
    this.pollTimer = setInterval(
      () => void this.poll(),
      this.config.pollIntervalMs
    );
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.disconnect();
    this.emit('stopped');
  }

  /**
   * Poll for new messages
   */
  private async poll(): Promise<void> {
    if (!this.connection || !this.running) return;

    try {
      await this.connection.openBox('INBOX');

      // Search criteria: unread messages from the carrier gateway
      // Note: Some carriers use different "from" formats
      const searchCriteria = [
        'UNSEEN',
        ['SINCE', this.getSearchDate()],
      ];

      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false, // We'll mark seen after processing
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);

      for (const message of messages) {
         
        const uid = message.attributes.uid;
        const uidStr = String(uid);

        // Skip already processed
        if (this.processedIds.has(uidStr)) continue;

        // Parse the full message
        interface ImapMessagePart { which: string; body: Buffer | string; size: number; }
        const all = (message.parts as ImapMessagePart[]).find((p) => p.which === '');
        if (!all?.body) continue;

        const parsed = await simpleParser(all.body as Buffer);

        // Check if it's from the user's phone number
        const fromAddress = this.extractFromAddress(parsed.from?.text ?? '');
        if (!this.isFromUserPhone(fromAddress)) continue;

        // Extract the SMS body
        const smsBody = this.extractSMSBody(parsed);

        if (smsBody.trim()) {
          const incomingSMS: IncomingSMS = {
            id: uidStr,
            from: fromAddress,
            body: smsBody,
            receivedAt: parsed.date ?? new Date(),
            raw: parsed,
          };

          this.emit('message', incomingSMS);
          this.processedIds.add(uidStr);

          // Mark as read
          await this.markAsRead(uid);
        }
      }

      this.lastPollTime = new Date();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`Poll failed: ${msg}`));

      // Reconnect on error
      if (this.running) {
        await this.reconnect();
      }
    }
  }

  /**
   * Get date for SINCE search (look back 24 hours)
   */
  private getSearchDate(): Date {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date;
  }

  /**
   * Extract email address from "From" field
   */
  private extractFromAddress(from: string): string {
    // Handle formats like "1234567890@vtext.com" or "<1234567890@vtext.com>"
    const match = from.match(/<?([^<>\s]+@[^<>\s]+)>?/);
    return match?.[1]?.toLowerCase() ?? from.toLowerCase();
  }

  /**
   * Check if the message is from the user's phone
   */
  private isFromUserPhone(fromAddress: string): boolean {
    const expectedSender = this.getSenderAddress().toLowerCase();

    // Direct match
    if (fromAddress === expectedSender) return true;

    // Phone number match (some carriers format differently)
    const phone = this.config.phoneNumber.replace(/\D/g, '');
    if (fromAddress.includes(phone)) return true;

    return false;
  }

  /**
   * Extract the actual SMS text from the email
   */
  private extractSMSBody(parsed: ParsedMail): string {
    // SMS replies typically come as plain text
    let body = parsed.text ?? '';

    // Some carriers include the original message - try to extract just the reply
    // Common patterns:
    // - "Reply message\n\nOn [date], [sender] wrote:\n> original"
    // - "Reply message\n\n----- Original Message -----"

    const separators = [
      /\n\n-{3,}\s*Original Message/i,
      /\n\nOn .+ wrote:/i,
      /\n\n>{1,}/,
      /\n\nSent from/i,
    ];

    for (const sep of separators) {
      const match = body.search(sep);
      if (match > 0) {
        body = body.substring(0, match);
        break;
      }
    }

    // Clean up
    return body.trim();
  }

  /**
   * Mark a message as read
   */
  private async markAsRead(uid: number): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.addFlags(uid, ['\\Seen']);
    } catch {
      // Non-critical error
    }
  }

  /**
   * Reconnect after error
   */
  private async reconnect(): Promise<void> {
    this.disconnect();

    // Wait before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (this.running) {
      await this.connect();
    }
  }

  /**
   * Check if receiver is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get stats
   */
  getStats(): {
    running: boolean;
    processedCount: number;
    lastPollTime: Date;
  } {
    return {
      running: this.running,
      processedCount: this.processedIds.size,
      lastPollTime: this.lastPollTime,
    };
  }
}
