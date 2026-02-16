/**
 * Gmail IMAP Integration
 *
 * Connects to Gmail via IMAP to fetch and classify emails
 * Requires Gmail App Password (https://support.google.com/accounts/answer/185833)
 *
 * Usage:
 *   const gmail = new GmailClient({
 *     email: 'user@gmail.com',
 *     appPassword: process.env.GMAIL_APP_PASSWORD,
 *   });
 *   await gmail.connect();
 *   const newEmails = await gmail.fetchNew();
 */

import * as imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('gmail-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GmailConfig {
  email: string;
  appPassword: string;
  imapHost?: string; // default: imap.gmail.com
  imapPort?: number; // default: 993
}

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: Date;
  labels: string[];
  isRead: boolean;
  classification?: 'important' | 'actionable' | 'fyi' | 'spam';
}

// ─── Gmail Client ───────────────────────────────────────────────────────────

export class GmailClient {
  private config: Required<GmailConfig>;
  private connection: imaps.ImapSimple | null = null;
  private lastFetchDate: Date | null = null;

  constructor(config: GmailConfig) {
    if (!config.email || !config.appPassword) {
      throw new Error('Gmail email and appPassword are required');
    }

    this.config = {
      email: config.email,
      appPassword: config.appPassword,
      imapHost: config.imapHost || 'imap.gmail.com',
      imapPort: config.imapPort || 993,
    };
  }

  /**
   * Connect to Gmail IMAP server
   */
  async connect(): Promise<boolean> {
    try {
      if (this.connection) {
        log.debug('Already connected to Gmail');
        return true;
      }

      const imapConfig = {
        imap: {
          user: this.config.email,
          password: this.config.appPassword,
          host: this.config.imapHost,
          port: this.config.imapPort,
          tls: true,
          authTimeout: 30000,
        },
      };

      this.connection = await imaps.connect(imapConfig);
      log.info({ email: this.config.email }, 'Connected to Gmail');
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ error: message }, 'Failed to connect to Gmail');
      throw new Error(`Gmail connection failed: ${message}`);
    }
  }

  /**
   * Fetch new emails since last check (or all recent if first time)
   */
  async fetchNew(since?: Date): Promise<GmailMessage[]> {
    if (!this.connection) {
      throw new Error('Not connected - call connect() first');
    }

    try {
      await this.connection.openBox('INBOX');

      const sinceDate = since || this.lastFetchDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h default
      const searchCriteria = [['SINCE', sinceDate]];
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT'],
        markSeen: false,
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);
      log.debug({ count: messages.length }, 'Fetched messages from Gmail');

      const parsed: GmailMessage[] = [];
      for (const item of messages) {
        try {
          const all = item.parts.find(part => part.which === 'TEXT');
          const header = item.parts.find(part => part.which === 'HEADER');

          if (!all?.body || !header?.body) continue;

          // Type assertion needed as imap-simple types are not precise
          const mail = await simpleParser(all.body as Buffer | string);

          const message: GmailMessage = {
            id: item.attributes.uid.toString(),
            from: mail.from?.text || 'unknown',
            subject: mail.subject || '(no subject)',
            body: mail.text || mail.html || '',
            date: mail.date || new Date(),
            labels: [], // Gmail labels would require additional API call
            isRead: item.attributes.flags.includes('\\Seen'),
            classification: this.classifyEmail(mail.subject || '', mail.text || mail.html || ''),
          };

          parsed.push(message);
        } catch (err: unknown) {
          log.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to parse email');
        }
      }

      this.lastFetchDate = new Date();
      log.info({ count: parsed.length, since: sinceDate.toISOString() }, 'Fetched and classified emails');

      return parsed;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ error: message }, 'Failed to fetch emails');
      throw new Error(`Failed to fetch emails: ${message}`);
    }
  }

  /**
   * Disconnect from Gmail
   */
  disconnect(): void {
    if (this.connection) {
      try {
        this.connection.end();
        this.connection = null;
        log.info('Disconnected from Gmail');
      } catch (error: unknown) {
        log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Error during disconnect');
      }
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Classify email based on subject and body content
   * Simple heuristic-based classification (no LLM call)
   */
  private classifyEmail(subject: string, body: string): 'important' | 'actionable' | 'fyi' | 'spam' {
    const combined = `${subject} ${body}`.toLowerCase();

    // Spam indicators
    const spamPatterns = [
      /unsubscribe/i,
      /click here now/i,
      /limited time offer/i,
      /act now/i,
      /congratulations! you('ve| have) won/i,
      /nigerian prince/i,
    ];
    if (spamPatterns.some(pattern => pattern.test(combined))) {
      return 'spam';
    }

    // Important indicators
    const importantPatterns = [
      /urgent/i,
      /asap/i,
      /critical/i,
      /security alert/i,
      /password reset/i,
      /action required/i,
      /invoice/i,
      /payment/i,
    ];
    if (importantPatterns.some(pattern => pattern.test(combined))) {
      return 'important';
    }

    // Actionable indicators
    const actionablePatterns = [
      /\brsvp\b/i,
      /\bconfirm\b/i,
      /\breview\b/i,
      /\bapprove\b/i,
      /\brespond\b/i,
      /\breply by\b/i,
      /\bdeadline\b/i,
      /\bdue date\b/i,
    ];
    if (actionablePatterns.some(pattern => pattern.test(combined))) {
      return 'actionable';
    }

    // Default to FYI
    return 'fyi';
  }
}
