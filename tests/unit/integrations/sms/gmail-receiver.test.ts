/**
 * GmailReceiver Tests
 *
 * Tests for the IMAP-based Gmail SMS receiver.
 * Focus areas:
 * - IMAP connection handling
 * - Message parsing and filtering
 * - Error recovery and reconnection
 * - Event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock imap-simple before importing GmailReceiver
vi.mock('imap-simple', () => ({
  default: {
    connect: vi.fn(),
  },
}));

// Mock mailparser
vi.mock('mailparser', () => ({
  simpleParser: vi.fn(),
}));

import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { GmailReceiver, type ReceiverConfig, type IncomingSMS } from '../../../../src/integrations/sms/gmail-receiver.js';
import type { SMSConfig } from '../../../../src/autonomous/types.js';

describe('GmailReceiver', () => {
  let receiver: GmailReceiver;
  let mockConnection: {
    openBox: Mock;
    search: Mock;
    addFlags: Mock;
    end: Mock;
  };
  const defaultConfig: ReceiverConfig = {
    gmailUser: 'test@gmail.com',
    gmailAppPassword: 'test-app-password',
    phoneNumber: '5551234567',
    carrierGateway: 'vtext.com',
    pollIntervalMs: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock connection
    mockConnection = {
      openBox: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      addFlags: vi.fn().mockResolvedValue(undefined),
      end: vi.fn(),
    };

    (imaps.connect as Mock).mockResolvedValue(mockConnection);
    vi.mocked(simpleParser).mockResolvedValue({
      from: { text: '5551234567@vtext.com' },
      text: 'Test SMS body',
      date: new Date(),
    } as any);

    receiver = new GmailReceiver(defaultConfig);
  });

  afterEach(() => {
    receiver.stop();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should set default poll interval if not provided', () => {
      const configWithoutInterval: ReceiverConfig = {
        gmailUser: 'test@gmail.com',
        gmailAppPassword: 'test-pass',
        phoneNumber: '5551234567',
        carrierGateway: 'vtext.com',
      };
      const recv = new GmailReceiver(configWithoutInterval);
      expect(recv).toBeInstanceOf(GmailReceiver);
      expect(recv).toBeInstanceOf(EventEmitter);
    });

    it('should use provided poll interval', () => {
      const recv = new GmailReceiver({ ...defaultConfig, pollIntervalMs: 5000 });
      expect(recv).toBeInstanceOf(GmailReceiver);
    });
  });

  describe('fromSMSConfig', () => {
    it('should create receiver from valid SMSConfig', () => {
      const smsConfig: SMSConfig = {
        enabled: true,
        gmailUser: 'user@gmail.com',
        gmailAppPassword: 'app-pass',
        phoneNumber: '5559876543',
        carrierGateway: 'txt.att.net',
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxPerHour: 5,
        timezone: 'America/New_York',
      };

      const recv = GmailReceiver.fromSMSConfig(smsConfig);
      expect(recv).toBeInstanceOf(GmailReceiver);
    });

    it('should return null if gmailUser is missing', () => {
      const smsConfig: SMSConfig = {
        enabled: true,
        gmailAppPassword: 'app-pass',
        phoneNumber: '5559876543',
        carrierGateway: 'vtext.com',
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxPerHour: 5,
        timezone: 'America/New_York',
      };

      const recv = GmailReceiver.fromSMSConfig(smsConfig);
      expect(recv).toBeNull();
    });

    it('should return null if gmailAppPassword is missing', () => {
      const smsConfig: SMSConfig = {
        enabled: true,
        gmailUser: 'user@gmail.com',
        phoneNumber: '5559876543',
        carrierGateway: 'vtext.com',
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxPerHour: 5,
        timezone: 'America/New_York',
      };

      const recv = GmailReceiver.fromSMSConfig(smsConfig);
      expect(recv).toBeNull();
    });

    it('should return null if phoneNumber is missing', () => {
      const smsConfig: SMSConfig = {
        enabled: true,
        gmailUser: 'user@gmail.com',
        gmailAppPassword: 'app-pass',
        carrierGateway: 'vtext.com',
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxPerHour: 5,
        timezone: 'America/New_York',
      };

      const recv = GmailReceiver.fromSMSConfig(smsConfig);
      expect(recv).toBeNull();
    });

    it('should use default carrier gateway if not provided', () => {
      const smsConfig: SMSConfig = {
        enabled: true,
        gmailUser: 'user@gmail.com',
        gmailAppPassword: 'app-pass',
        phoneNumber: '5559876543',
        quietHoursStart: 22,
        quietHoursEnd: 7,
        maxPerHour: 5,
        timezone: 'America/New_York',
      };

      const recv = GmailReceiver.fromSMSConfig(smsConfig);
      expect(recv).toBeInstanceOf(GmailReceiver);
    });
  });

  describe('IMAP connection handling', () => {
    it('should connect to Gmail IMAP with correct config', async () => {
      const result = await receiver.connect();

      expect(result).toBe(true);
      expect(imaps.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          imap: expect.objectContaining({
            user: 'test@gmail.com',
            password: 'test-app-password',
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
          }),
        })
      );
    });

    it('should emit connected event on successful connection', async () => {
      const connectedHandler = vi.fn();
      receiver.on('connected', connectedHandler);

      await receiver.connect();

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should return false and emit error on connection failure', async () => {
      (imaps.connect as Mock).mockRejectedValue(new Error('Connection refused'));

      const errorHandler = vi.fn();
      receiver.on('error', errorHandler);

      const result = await receiver.connect();

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('IMAP connection failed'),
        })
      );
    });

    it('should handle non-Error rejection during connection', async () => {
      (imaps.connect as Mock).mockRejectedValue('String error');

      const errorHandler = vi.fn();
      receiver.on('error', errorHandler);

      const result = await receiver.connect();

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Unknown error'),
        })
      );
    });

    it('should disconnect and emit event', async () => {
      await receiver.connect();

      const disconnectedHandler = vi.fn();
      receiver.on('disconnected', disconnectedHandler);

      receiver.disconnect();

      expect(mockConnection.end).toHaveBeenCalled();
      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      await receiver.connect();
      mockConnection.end.mockImplementation(() => {
        throw new Error('Disconnect error');
      });

      // Should not throw
      expect(() => receiver.disconnect()).not.toThrow();
    });

    it('should handle disconnect when not connected', () => {
      const disconnectedHandler = vi.fn();
      receiver.on('disconnected', disconnectedHandler);

      receiver.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe('start and stop', () => {
    it('should start polling and emit started event', async () => {
      const startedHandler = vi.fn();
      receiver.on('started', startedHandler);

      await receiver.start();

      expect(receiver.isRunning()).toBe(true);
      expect(startedHandler).toHaveBeenCalled();
    });

    it('should not start twice if already running', async () => {
      await receiver.start();

      // Second start should be a no-op
      await receiver.start();

      expect(imaps.connect).toHaveBeenCalledTimes(1);
    });

    it('should throw if connection fails during start', async () => {
      (imaps.connect as Mock).mockRejectedValue(new Error('Connection failed'));

      // When connection fails, start() should throw an error
      await expect(receiver.start()).rejects.toThrow();
    });

    it('should stop polling and disconnect', async () => {
      await receiver.start();

      const stoppedHandler = vi.fn();
      receiver.on('stopped', stoppedHandler);

      receiver.stop();

      expect(receiver.isRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should not stop if not running', () => {
      const stoppedHandler = vi.fn();
      receiver.on('stopped', stoppedHandler);

      receiver.stop();

      expect(stoppedHandler).not.toHaveBeenCalled();
    });

    it('should poll at configured interval', async () => {
      await receiver.start();

      // Initial poll happens immediately
      expect(mockConnection.openBox).toHaveBeenCalledTimes(1);

      // Advance timer by poll interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockConnection.openBox).toHaveBeenCalledTimes(2);

      // Another interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockConnection.openBox).toHaveBeenCalledTimes(3);
    });
  });

  describe('message polling and parsing', () => {
    const createMockMessage = (uid: number, from: string, body: string) => ({
      attributes: { uid },
      parts: [
        {
          which: '',
          body: Buffer.from(body),
        },
      ],
    });

    it('should parse and emit valid SMS messages', async () => {
      const mockMessage = createMockMessage(1, '5551234567@vtext.com', 'Test message');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Hello from SMS',
        date: new Date('2024-01-15T10:00:00Z'),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          from: '5551234567@vtext.com',
          body: 'Hello from SMS',
        })
      );
    });

    it('should filter messages from other senders', async () => {
      const mockMessage = createMockMessage(1, 'other@example.com', 'Not from phone');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: 'other@example.com' },
        text: 'Not from phone',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should match messages with phone number in different formats', async () => {
      const mockMessage = createMockMessage(1, '555-123-4567', 'Formatted phone');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '<5551234567@vtext.com>' },
        text: 'From formatted address',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalled();
    });

    it('should not process the same message twice', async () => {
      const mockMessage = createMockMessage(1, '5551234567@vtext.com', 'Test');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Test message',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();
      expect(messageHandler).toHaveBeenCalledTimes(1);

      // Advance timer and poll again
      await vi.advanceTimersByTimeAsync(1000);
      expect(messageHandler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should mark messages as read after processing', async () => {
      const mockMessage = createMockMessage(42, '5551234567@vtext.com', 'Test');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Mark as read test',
        date: new Date(),
      } as any);

      await receiver.start();

      expect(mockConnection.addFlags).toHaveBeenCalledWith(42, ['\\Seen']);
    });

    it('should handle mark as read errors gracefully', async () => {
      const mockMessage = createMockMessage(1, '5551234567@vtext.com', 'Test');
      mockConnection.search.mockResolvedValue([mockMessage]);
      mockConnection.addFlags.mockRejectedValue(new Error('Flag error'));

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Test message',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      // Should not throw
      await receiver.start();
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should skip messages without body', async () => {
      const mockMessage = {
        attributes: { uid: 1 },
        parts: [], // No body
      };
      mockConnection.search.mockResolvedValue([mockMessage]);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should skip empty SMS bodies', async () => {
      const mockMessage = createMockMessage(1, '5551234567@vtext.com', 'Test');
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: '   ',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('SMS body extraction', () => {
    const createMockMessage = (uid: number) => ({
      attributes: { uid },
      parts: [{ which: '', body: Buffer.from('test') }],
    });

    it('should strip original message patterns (dashes)', async () => {
      mockConnection.search.mockResolvedValue([createMockMessage(1)]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Reply text\n\n--- Original Message ---\nOriginal content',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Reply text',
        })
      );
    });

    it('should strip "On ... wrote:" patterns', async () => {
      mockConnection.search.mockResolvedValue([createMockMessage(2)]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'My reply\n\nOn Jan 15, 2024, someone wrote:\n> quoted text',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'My reply',
        })
      );
    });

    it('should strip "Sent from" signatures', async () => {
      mockConnection.search.mockResolvedValue([createMockMessage(3)]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Short reply\n\nSent from my iPhone',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Short reply',
        })
      );
    });

    it('should strip quoted text (>)', async () => {
      mockConnection.search.mockResolvedValue([createMockMessage(4)]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'New reply\n\n> > Previous quoted content',
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'New reply',
        })
      );
    });

    it('should handle messages with no text content', async () => {
      mockConnection.search.mockResolvedValue([createMockMessage(5)]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: undefined,
        date: new Date(),
      } as any);

      const messageHandler = vi.fn();
      receiver.on('message', messageHandler);

      await receiver.start();

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('error recovery', () => {
    it('should emit error and attempt reconnect on poll failure', async () => {
      await receiver.connect();

      mockConnection.openBox.mockRejectedValueOnce(new Error('INBOX unavailable'));

      const errorHandler = vi.fn();
      receiver.on('error', errorHandler);

      // Start receiver (this triggers initial poll which will fail)
      (receiver as any).running = true;
      // Don't trigger reconnect to avoid infinite async loop in test
      const originalReconnect = (receiver as any).reconnect;
      (receiver as any).reconnect = vi.fn();

      await (receiver as any).poll();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Poll failed'),
        })
      );

      (receiver as any).reconnect = originalReconnect;
    });

    it('should handle non-Error during poll', async () => {
      await receiver.connect();
      mockConnection.openBox.mockRejectedValueOnce('String error');

      const errorHandler = vi.fn();
      receiver.on('error', errorHandler);

      (receiver as any).running = true;
      // Don't trigger reconnect to avoid infinite async loop
      const originalReconnect = (receiver as any).reconnect;
      (receiver as any).reconnect = vi.fn();

      await (receiver as any).poll();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Unknown error'),
        })
      );

      (receiver as any).reconnect = originalReconnect;
    });

    it('should not poll if not running', async () => {
      await receiver.connect();

      // Manually call poll without setting running
      await (receiver as any).poll();

      expect(mockConnection.openBox).not.toHaveBeenCalled();
    });

    it('should not poll if not connected', async () => {
      // Don't connect, try to poll
      (receiver as any).running = true;
      await (receiver as any).poll();

      expect(mockConnection.openBox).not.toHaveBeenCalled();
    });

    it('should wait before reconnecting after error', async () => {
      await receiver.connect();
      mockConnection.openBox.mockRejectedValueOnce(new Error('Connection lost'));

      (receiver as any).running = true;

      // Start reconnect process
      const reconnectPromise = (receiver as any).reconnect();

      // Should wait 5 seconds
      expect((imaps.connect as Mock).mock.calls.length).toBe(1);

      // Advance timer
      await vi.advanceTimersByTimeAsync(5000);
      await reconnectPromise;

      // Should have attempted reconnect
      expect((imaps.connect as Mock).mock.calls.length).toBe(2);
    });

    it('should not reconnect if stopped during wait', async () => {
      await receiver.connect();

      (receiver as any).running = true;
      const reconnectPromise = (receiver as any).reconnect();

      // Stop during reconnect wait
      (receiver as any).running = false;

      await vi.advanceTimersByTimeAsync(5000);
      await reconnectPromise;

      // Should not have reconnected
      expect((imaps.connect as Mock).mock.calls.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', async () => {
      const stats = receiver.getStats();

      expect(stats).toEqual({
        running: false,
        processedCount: 0,
        lastPollTime: expect.any(Date),
      });
    });

    it('should update stats after processing messages', async () => {
      const mockMessage = {
        attributes: { uid: 1 },
        parts: [{ which: '', body: Buffer.from('test') }],
      };
      mockConnection.search.mockResolvedValue([mockMessage]);

      vi.mocked(simpleParser).mockResolvedValue({
        from: { text: '5551234567@vtext.com' },
        text: 'Test message',
        date: new Date(),
      } as any);

      await receiver.start();

      const stats = receiver.getStats();
      expect(stats.running).toBe(true);
      expect(stats.processedCount).toBe(1);
    });
  });

  describe('from address extraction', () => {
    it('should extract email from angle brackets', () => {
      const result = (receiver as any).extractFromAddress('<test@example.com>');
      expect(result).toBe('test@example.com');
    });

    it('should handle plain email address', () => {
      const result = (receiver as any).extractFromAddress('test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('should handle display name with email', () => {
      const result = (receiver as any).extractFromAddress('John Doe <john@example.com>');
      expect(result).toBe('john@example.com');
    });

    it('should lowercase email addresses', () => {
      const result = (receiver as any).extractFromAddress('TEST@EXAMPLE.COM');
      expect(result).toBe('test@example.com');
    });
  });

  describe('phone matching', () => {
    it('should match exact sender address', () => {
      const result = (receiver as any).isFromUserPhone('5551234567@vtext.com');
      expect(result).toBe(true);
    });

    it('should match phone number within address', () => {
      const result = (receiver as any).isFromUserPhone('us5551234567@carrier.com');
      expect(result).toBe(true);
    });

    it('should not match different phone numbers', () => {
      const result = (receiver as any).isFromUserPhone('5559999999@vtext.com');
      expect(result).toBe(false);
    });

    it('should handle phone numbers with formatting', () => {
      const recv = new GmailReceiver({
        ...defaultConfig,
        phoneNumber: '(555) 123-4567',
      });
      const result = (recv as any).isFromUserPhone('5551234567@vtext.com');
      expect(result).toBe(true);
    });
  });
});
