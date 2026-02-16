import { describe, it, expect, beforeEach } from 'vitest';
import { GmailClient, type GmailConfig } from '../../../../src/integrations/gmail/client.js';

describe('GmailClient', () => {
  let config: GmailConfig;

  beforeEach(() => {
    config = {
      email: 'test@gmail.com',
      appPassword: 'test-app-password',
    };
  });

  describe('constructor', () => {
    it('should validate email is provided', () => {
      expect(() => new GmailClient({ email: '', appPassword: 'pwd' }))
        .toThrow('Gmail email and appPassword are required');
    });

    it('should validate appPassword is provided', () => {
      expect(() => new GmailClient({ email: 'test@gmail.com', appPassword: '' }))
        .toThrow('Gmail email and appPassword are required');
    });

    it('should use default IMAP host and port', () => {
      const client = new GmailClient(config);
      expect(client).toBeDefined();
    });

    it('should accept custom IMAP host and port', () => {
      const customConfig = {
        ...config,
        imapHost: 'custom.imap.host',
        imapPort: 9999,
      };
      const client = new GmailClient(customConfig);
      expect(client).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      const client = new GmailClient(config);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('fetchNew', () => {
    it('should throw when not connected', async () => {
      const client = new GmailClient(config);
      await expect(client.fetchNew()).rejects.toThrow('Not connected - call connect() first');
    });
  });

  describe('classification', () => {
    it('should classify spam emails', () => {
      const client = new GmailClient(config);
      // Access private method via type assertion for testing
      const classify = (client as unknown as { classifyEmail: (s: string, b: string) => string }).classifyEmail;

      const result = classify.call(client, 'CLICK HERE NOW! Limited time offer', 'You have won!');
      expect(result).toBe('spam');
    });

    it('should classify important emails', () => {
      const client = new GmailClient(config);
      const classify = (client as unknown as { classifyEmail: (s: string, b: string) => string }).classifyEmail;

      const result = classify.call(client, 'URGENT: Security Alert', 'Your password needs to be reset');
      expect(result).toBe('important');
    });

    it('should classify actionable emails', () => {
      const client = new GmailClient(config);
      const classify = (client as unknown as { classifyEmail: (s: string, b: string) => string }).classifyEmail;

      const result = classify.call(client, 'Please RSVP', 'Confirm your attendance by Friday');
      expect(result).toBe('actionable');
    });

    it('should default to fyi classification', () => {
      const client = new GmailClient(config);
      const classify = (client as unknown as { classifyEmail: (s: string, b: string) => string }).classifyEmail;

      const result = classify.call(client, 'Weekly Newsletter', 'Here is your weekly update');
      expect(result).toBe('fyi');
    });
  });

  describe('connection lifecycle', () => {
    it('should handle connection state correctly', () => {
      const client = new GmailClient(config);
      expect(client.isConnected()).toBe(false);

      // Disconnect when not connected should be safe
      expect(() => client.disconnect()).not.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid credentials gracefully', async () => {
      const client = new GmailClient({
        email: 'invalid@gmail.com',
        appPassword: 'wrong-password',
      });

      // Connection will fail with invalid credentials
      // We expect this to throw an error
      await expect(client.connect()).rejects.toThrow('Gmail connection failed');
    });
  });
});
