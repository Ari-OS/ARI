/**
 * GmailSMS Tests
 *
 * Tests for the SMTP-based Gmail SMS sender.
 * Focus areas:
 * - Rate limiting works correctly
 * - Quiet hours are respected
 * - Message sanitization (truncation, deduplication)
 * - SMTP connection handling
 * - Error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Mock nodemailer before importing GmailSMS
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(),
}));

import { createTransport } from 'nodemailer';
import { GmailSMS } from '../../../../src/integrations/sms/gmail-sms.js';
import type { SMSConfig } from '../../../../src/autonomous/types.js';

describe('GmailSMS', () => {
  let sms: GmailSMS;
  let mockTransporter: {
    sendMail: Mock;
    verify: Mock;
  };

  const defaultConfig: SMSConfig = {
    enabled: true,
    gmailUser: 'test@gmail.com',
    gmailAppPassword: 'test-app-password',
    phoneNumber: '5551234567',
    carrierGateway: 'vtext.com',
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7, // 7 AM
    maxPerHour: 5,
    timezone: 'America/Indiana/Indianapolis',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Set time to 2 PM (14:00) - outside quiet hours
    vi.setSystemTime(new Date('2024-01-15T14:00:00-05:00'));

    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
      verify: vi.fn().mockResolvedValue(true),
    };

    (createTransport as Mock).mockReturnValue(mockTransporter);

    sms = new GmailSMS(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('init', () => {
    it('should initialize with valid config', () => {
      const result = sms.init();

      expect(result).toBe(true);
      expect(sms.isReady()).toBe(true);
      expect(createTransport).toHaveBeenCalledWith({
        service: 'gmail',
        auth: {
          user: 'test@gmail.com',
          pass: 'test-app-password',
        },
      });
    });

    it('should fail if not enabled', () => {
      const disabledSms = new GmailSMS({ ...defaultConfig, enabled: false });
      const result = disabledSms.init();

      expect(result).toBe(false);
      expect(disabledSms.isReady()).toBe(false);
    });

    it('should fail if gmailUser is missing', () => {
      const noUserSms = new GmailSMS({ ...defaultConfig, gmailUser: undefined });
      const result = noUserSms.init();

      expect(result).toBe(false);
    });

    it('should fail if gmailAppPassword is missing', () => {
      const noPassSms = new GmailSMS({ ...defaultConfig, gmailAppPassword: undefined });
      const result = noPassSms.init();

      expect(result).toBe(false);
    });

    it('should handle transport creation errors', () => {
      (createTransport as Mock).mockImplementation(() => {
        throw new Error('Transport creation failed');
      });

      const result = sms.init();

      expect(result).toBe(false);
      expect(sms.isReady()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should return false if not initialized', () => {
      expect(sms.isReady()).toBe(false);
    });

    it('should return false if no phone number', () => {
      const noPhoneSms = new GmailSMS({ ...defaultConfig, phoneNumber: undefined });
      noPhoneSms.init();

      expect(noPhoneSms.isReady()).toBe(false);
    });

    it('should return true when properly configured', () => {
      sms.init();
      expect(sms.isReady()).toBe(true);
    });
  });

  describe('quiet hours', () => {
    it('should detect quiet hours (night)', () => {
      // Set to 11 PM - during quiet hours
      vi.setSystemTime(new Date('2024-01-15T23:00:00-05:00'));

      expect(sms.isQuietHours()).toBe(true);
    });

    it('should detect quiet hours (early morning)', () => {
      // Set to 3 AM - during quiet hours
      vi.setSystemTime(new Date('2024-01-16T03:00:00-05:00'));

      expect(sms.isQuietHours()).toBe(true);
    });

    it('should not be quiet hours during day', () => {
      // Set to 2 PM - outside quiet hours
      vi.setSystemTime(new Date('2024-01-15T14:00:00-05:00'));

      expect(sms.isQuietHours()).toBe(false);
    });

    it('should handle quiet hours edge - start', () => {
      // Set to exactly 10 PM - start of quiet hours
      vi.setSystemTime(new Date('2024-01-15T22:00:00-05:00'));

      expect(sms.isQuietHours()).toBe(true);
    });

    it('should handle quiet hours edge - end', () => {
      // Set to exactly 7 AM - end of quiet hours (should NOT be quiet)
      vi.setSystemTime(new Date('2024-01-15T07:00:00-05:00'));

      expect(sms.isQuietHours()).toBe(false);
    });

    it('should handle non-wrapping quiet hours', () => {
      // Config where start < end (e.g., 8 AM to 5 PM quiet)
      const daytimeQuietSms = new GmailSMS({
        ...defaultConfig,
        quietHoursStart: 8,
        quietHoursEnd: 17,
      });

      // 10 AM - should be quiet
      vi.setSystemTime(new Date('2024-01-15T10:00:00-05:00'));
      expect(daytimeQuietSms.isQuietHours()).toBe(true);

      // 7 PM - should not be quiet
      vi.setSystemTime(new Date('2024-01-15T19:00:00-05:00'));
      expect(daytimeQuietSms.isQuietHours()).toBe(false);
    });

    it('should block sending during quiet hours', async () => {
      sms.init();
      vi.setSystemTime(new Date('2024-01-15T23:30:00-05:00'));

      const result = await sms.send('Test message');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('Quiet hours active');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should allow sending with forceDelivery during quiet hours', async () => {
      sms.init();
      vi.setSystemTime(new Date('2024-01-15T23:30:00-05:00'));

      const result = await sms.send('Urgent message', { forceDelivery: true });

      expect(result.sent).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    it('should allow messages under rate limit', async () => {
      sms.init();

      for (let i = 0; i < 5; i++) {
        const result = await sms.send(`Message ${i}`);
        expect(result.sent).toBe(true);
      }
    });

    it('should block messages exceeding rate limit', async () => {
      sms.init();

      // Send 5 messages (the limit)
      for (let i = 0; i < 5; i++) {
        await sms.send(`Message ${i}`);
      }

      // 6th message should be blocked
      const result = await sms.send('One more');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
    });

    it('should reset rate limit after 1 hour', async () => {
      sms.init();

      // Send 5 messages
      for (let i = 0; i < 5; i++) {
        await sms.send(`Message ${i}`);
      }

      // Advance time by 1 hour + 1 minute
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Should be able to send again
      const result = await sms.send('After reset');

      expect(result.sent).toBe(true);
    });

    it('should allow forceDelivery to bypass rate limit', async () => {
      sms.init();

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await sms.send(`Message ${i}`);
      }

      // Force delivery should work
      const result = await sms.send('Forced message', { forceDelivery: true });

      expect(result.sent).toBe(true);
    });

    it('should correctly report rate limit remaining', async () => {
      sms.init();

      expect(sms.getStats().rateLimitRemaining).toBe(5);

      await sms.send('Message 1');
      expect(sms.getStats().rateLimitRemaining).toBe(4);

      await sms.send('Message 2');
      await sms.send('Message 3');
      expect(sms.getStats().rateLimitRemaining).toBe(2);
    });

    it('should correctly detect rate limited state', () => {
      sms.init();

      expect(sms.isRateLimited()).toBe(false);

      // Manually fill the send history
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        (sms as any).sendHistory.push({ sentAt: now, message: `msg${i}` });
      }

      expect(sms.isRateLimited()).toBe(true);
    });
  });

  describe('duplicate detection', () => {
    it('should block duplicate messages within 5 minutes', async () => {
      sms.init();

      await sms.send('Same message');

      // Send same message again immediately
      const result = await sms.send('Same message');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('Duplicate message blocked');
    });

    it('should allow duplicate messages after 5 minutes', async () => {
      sms.init();

      await sms.send('Same message');

      // Advance time by 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      const result = await sms.send('Same message');

      expect(result.sent).toBe(true);
    });

    it('should allow different messages', async () => {
      sms.init();

      await sms.send('First message');
      const result = await sms.send('Second message');

      expect(result.sent).toBe(true);
    });

    it('should allow forceDelivery to bypass duplicate check', async () => {
      sms.init();

      await sms.send('Same message');
      const result = await sms.send('Same message', { forceDelivery: true });

      expect(result.sent).toBe(true);
    });

    it('should detect duplicates correctly', () => {
      sms.init();

      (sms as any).sendHistory.push({
        sentAt: Date.now(),
        message: 'test message',
      });

      expect(sms.isDuplicate('test message')).toBe(true);
      expect(sms.isDuplicate('different message')).toBe(false);
    });
  });

  describe('message sending', () => {
    it('should send message to correct recipient', async () => {
      sms.init();

      await sms.send('Test message');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: '5551234567@vtext.com',
        subject: 'ARI',
        text: 'Test message',
      });
    });

    it('should use custom subject', async () => {
      sms.init();

      await sms.send('Test message', { subject: 'Custom Subject' });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Custom Subject',
        })
      );
    });

    it('should strip non-digit characters from phone number', async () => {
      const formattedPhoneSms = new GmailSMS({
        ...defaultConfig,
        phoneNumber: '(555) 123-4567',
      });
      formattedPhoneSms.init();

      await formattedPhoneSms.send('Test');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '5551234567@vtext.com',
        })
      );
    });

    it('should return messageId on success', async () => {
      sms.init();

      const result = await sms.send('Test message');

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('test-msg-id');
      expect(result.reason).toBe('Sent');
    });

    it('should handle SMTP errors', async () => {
      sms.init();
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await sms.send('Test message');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('SMTP error');
      expect(result.reason).toContain('SMTP connection failed');
    });

    it('should handle non-Error SMTP failures', async () => {
      sms.init();
      mockTransporter.sendMail.mockRejectedValue('String error');

      const result = await sms.send('Test message');

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Unknown error');
    });

    it('should return not configured when not initialized', async () => {
      const result = await sms.send('Test message');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('SMS not configured');
    });
  });

  describe('message truncation', () => {
    it('should not truncate messages under 155 characters', async () => {
      sms.init();
      const shortMessage = 'A'.repeat(100);

      const result = await sms.send(shortMessage);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: shortMessage,
        })
      );
      // truncated is not set (falsy) for non-truncated messages
      expect(result.truncated).toBeFalsy();
    });

    it('should truncate messages over 155 characters', async () => {
      sms.init();
      const longMessage = 'A'.repeat(200);

      const result = await sms.send(longMessage);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/^A{152}\.\.\.$/),
        })
      );
      expect(result.truncated).toBe(true);
    });

    it('should indicate truncation status', async () => {
      sms.init();

      const shortResult = await sms.send('Short message');
      expect(shortResult.truncated).toBeFalsy();

      const longResult = await sms.send('A'.repeat(200));
      expect(longResult.truncated).toBe(true);
    });

    it('should not truncate exactly 155 characters', async () => {
      sms.init();
      const exactMessage = 'A'.repeat(155);

      const result = await sms.send(exactMessage);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: exactMessage,
        })
      );
      expect(result.truncated).toBeFalsy();
    });

    it('should truncate at 156 characters', async () => {
      sms.init();
      const justOverMessage = 'A'.repeat(156);

      const result = await sms.send(justOverMessage);

      expect(result.truncated).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should return true on successful verification', async () => {
      sms.init();

      const result = await sms.testConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false on verification failure', async () => {
      sms.init();
      mockTransporter.verify.mockRejectedValue(new Error('Auth failed'));

      const result = await sms.testConnection();

      expect(result).toBe(false);
    });

    it('should return false when not initialized', async () => {
      const result = await sms.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct initial stats', () => {
      sms.init();

      const stats = sms.getStats();

      expect(stats).toEqual({
        sentThisHour: 0,
        rateLimitRemaining: 5,
        isQuietHours: false,
      });
    });

    it('should track sent messages', async () => {
      sms.init();

      await sms.send('Message 1');
      await sms.send('Message 2');

      const stats = sms.getStats();

      expect(stats.sentThisHour).toBe(2);
      expect(stats.rateLimitRemaining).toBe(3);
    });

    it('should report quiet hours status', () => {
      sms.init();

      // Set to quiet hours
      vi.setSystemTime(new Date('2024-01-15T23:00:00-05:00'));

      const stats = sms.getStats();

      expect(stats.isQuietHours).toBe(true);
    });

    it('should only count messages within the hour window', async () => {
      sms.init();

      // Send 2 messages
      await sms.send('Message 1');
      await sms.send('Message 2');

      expect(sms.getStats().sentThisHour).toBe(2);

      // Advance 61 minutes
      vi.advanceTimersByTime(61 * 60 * 1000);

      expect(sms.getStats().sentThisHour).toBe(0);
      expect(sms.getStats().rateLimitRemaining).toBe(5);
    });
  });

  describe('injection prevention', () => {
    it('should not modify message content (sanitization is external)', async () => {
      sms.init();
      const potentiallyDangerous = 'run $(rm -rf /)';

      await sms.send(potentiallyDangerous);

      // GmailSMS itself doesn't sanitize - it sends what it receives
      // Sanitization happens at a higher layer
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: potentiallyDangerous,
        })
      );
    });

    it('should handle special characters in messages', async () => {
      sms.init();
      const specialChars = 'Test <script>alert(1)</script> & "quotes"';

      await sms.send(specialChars);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: specialChars,
        })
      );
    });

    it('should handle unicode characters', async () => {
      sms.init();
      const unicode = 'Test with emoji \u{1F4A1} and accents: cafe';

      await sms.send(unicode);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: unicode,
        })
      );
    });

    it('should handle newlines in messages', async () => {
      sms.init();
      const multiline = 'Line 1\nLine 2\nLine 3';

      await sms.send(multiline);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: multiline,
        })
      );
    });
  });

  describe('carrier gateway handling', () => {
    it('should use configured carrier gateway', async () => {
      const attSms = new GmailSMS({
        ...defaultConfig,
        carrierGateway: 'txt.att.net',
      });
      attSms.init();

      await attSms.send('Test');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '5551234567@txt.att.net',
        })
      );
    });

    it('should handle T-Mobile gateway', async () => {
      const tmobileSms = new GmailSMS({
        ...defaultConfig,
        carrierGateway: 'tmomail.net',
      });
      tmobileSms.init();

      await tmobileSms.send('Test');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '5551234567@tmomail.net',
        })
      );
    });
  });
});
