import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import {
  PushoverClient,
  type PushoverConfig,
  type PushoverMessage,
} from '../../../../src/integrations/pushover/pushover-client.js';

// Mock https module
vi.mock('node:https', () => {
  const mockRequest = vi.fn();
  return {
    default: {
      request: mockRequest,
    },
    request: mockRequest,
  };
});

// Helper to create a mock response
function createMockResponse(statusCode: number, body: string) {
  const response = new EventEmitter() as EventEmitter & { statusCode: number };
  response.statusCode = statusCode;

  // Simulate async data arrival
  setTimeout(() => {
    response.emit('data', body);
    response.emit('end');
  }, 0);

  return response;
}

// Helper to create a mock request
function createMockRequest() {
  const request = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  request.write = vi.fn();
  request.end = vi.fn();
  return request;
}

describe('PushoverClient', () => {
  let client: PushoverClient;
  let mockHttpsRequest: ReturnType<typeof vi.fn>;
  const defaultConfig: PushoverConfig = {
    userKey: 'test-user-key',
    apiToken: 'test-api-token',
    device: 'test-device',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHttpsRequest = vi.mocked(https.request);
    client = new PushoverClient(defaultConfig);
  });

  afterEach(() => {
    client.stopReceiving();
  });

  describe('Message Sending with Validation', () => {
    it('should send a basic message successfully', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, request: 'req-123' }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test message' });

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req-123');
      expect(mockReq.write).toHaveBeenCalled();
      expect(mockReq.end).toHaveBeenCalled();

      // Verify the request body contains the message
      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.message).toBe('Test message');
      expect(parsed.token).toBe('test-api-token');
      expect(parsed.user).toBe('test-user-key');
    });

    it('should include all message fields when provided', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, request: 'req-456' }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const fullMessage: PushoverMessage = {
        title: 'Test Title',
        message: 'Full message body',
        priority: 1,
        sound: 'cashregister',
        url: 'https://example.com',
        urlTitle: 'Click here',
        device: 'custom-device',
        html: true,
      };

      const result = await client.send(fullMessage);

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.title).toBe('Test Title');
      expect(parsed.message).toBe('Full message body');
      expect(parsed.priority).toBe(1);
      expect(parsed.sound).toBe('cashregister');
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.url_title).toBe('Click here');
      expect(parsed.device).toBe('custom-device');
      expect(parsed.html).toBe(1);
    });

    it('should use default values for optional fields', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await client.send({ message: 'Minimal message' });

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.title).toBe('ARI');
      expect(parsed.priority).toBe(0);
      expect(parsed.sound).toBe('pushover');
      expect(parsed.device).toBe('test-device');
      expect(parsed.html).toBe(0);
    });

    it('should send to correct API endpoint', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        expect(options.hostname).toBe('api.pushover.net');
        expect(options.port).toBe(443);
        expect(options.path).toBe('/1/messages.json');
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        callback(mockRes);
        return mockReq;
      });

      await client.send({ message: 'Test' });
    });
  });

  describe('Priority Levels', () => {
    it('should send quiet notification with priority -1', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await client.quiet('Quiet message', 'Quiet Title');

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.priority).toBe(-1);
      expect(parsed.message).toBe('Quiet message');
      expect(parsed.title).toBe('Quiet Title');
    });

    it('should send normal notification with priority 0', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await client.notify('Normal message');

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.priority).toBe(0);
    });

    it('should send alert with priority 1 and siren sound', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await client.alert('Alert message', 'Alert Title');

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.priority).toBe(1);
      expect(parsed.sound).toBe('siren');
      expect(parsed.message).toBe('Alert message');
      expect(parsed.title).toBe('Alert Title');
    });

    it('should send emergency with priority 2, retry, and expire', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, request: 'emerg-123' }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.emergency('Emergency!', 'Critical');

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('emerg-123');

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.priority).toBe(2);
      expect(parsed.retry).toBe(60);
      expect(parsed.expire).toBe(3600);
      expect(parsed.sound).toBe('alien');
      expect(parsed.title).toBe('Critical');
    });

    it('should use default title for emergency messages', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await client.emergency('Emergency without title');

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.title).toBe('ARI EMERGENCY');
    });

    it('should support all priority levels in send()', async () => {
      const priorities: Array<-2 | -1 | 0 | 1 | 2> = [-2, -1, 0, 1, 2];

      for (const priority of priorities) {
        const mockReq = createMockRequest();
        const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

        mockHttpsRequest.mockImplementation((options, callback) => {
          callback(mockRes);
          return mockReq;
        });

        await client.send({ message: `Priority ${priority}`, priority });

        const writtenData = mockReq.write.mock.calls[0][0];
        const parsed = JSON.parse(writtenData);
        expect(parsed.priority).toBe(priority);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle API error responses', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(
        400,
        JSON.stringify({ status: 0, errors: ['invalid token', 'missing user'] })
      );

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid token, missing user');
    });

    it('should handle single API error', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(400, JSON.stringify({ status: 0, errors: ['rate limited'] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('rate limited');
    });

    it('should handle API error without errors array', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(400, JSON.stringify({ status: 0 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should handle network errors', async () => {
      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation(() => {
        setTimeout(() => {
          mockReq.emit('error', new Error('Connection refused'));
        }, 0);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle invalid JSON response', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, 'invalid json{{{');

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid response');
    });

    it('should handle emergency message errors', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(
        400,
        JSON.stringify({ status: 0, errors: ['emergency requires acknowledge'] })
      );

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.emergency('Emergency!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('emergency requires acknowledge');
    });

    it('should handle emergency network error', async () => {
      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation(() => {
        setTimeout(() => {
          mockReq.emit('error', new Error('Network timeout'));
        }, 0);
        return mockReq;
      });

      const result = await client.emergency('Emergency!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle emergency invalid JSON', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, 'not json');

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.emergency('Emergency!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid response');
    });
  });

  describe('Credential Verification', () => {
    it('should verify valid credentials', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        expect(options.path).toBe('/1/users/validate.json');
        callback(mockRes);
        return mockReq;
      });

      const result = await client.verify();

      expect(result).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.token).toBe('test-api-token');
      expect(parsed.user).toBe('test-user-key');
    });

    it('should return false for invalid credentials', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(400, JSON.stringify({ status: 0, errors: ['invalid user key'] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.verify();

      expect(result).toBe(false);
    });

    it('should return false on verify network error', async () => {
      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation(() => {
        setTimeout(() => {
          mockReq.emit('error', new Error('Connection failed'));
        }, 0);
        return mockReq;
      });

      const result = await client.verify();

      expect(result).toBe(false);
    });

    it('should return false on verify invalid JSON', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, 'not valid json');

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.verify();

      expect(result).toBe(false);
    });
  });

  describe('Message Receiving (Open Client)', () => {
    it('should fail to start receiving without secret', async () => {
      const clientWithoutSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
      });

      const errorHandler = vi.fn();
      clientWithoutSecret.on('error', errorHandler);

      const result = await clientWithoutSecret.startReceiving();

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].message).toBe('Secret required for receiving messages');
    });

    it('should start receiving with secret', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages: [] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const startedHandler = vi.fn();
      clientWithSecret.on('started', startedHandler);

      const result = await clientWithSecret.startReceiving();

      expect(result).toBe(true);
      expect(startedHandler).toHaveBeenCalled();
      expect(clientWithSecret.isRunning()).toBe(true);

      clientWithSecret.stopReceiving();
    });

    it('should not start receiving if already running', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages: [] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await clientWithSecret.startReceiving();
      const result = await clientWithSecret.startReceiving();

      expect(result).toBe(true);
      expect(clientWithSecret.isRunning()).toBe(true);

      clientWithSecret.stopReceiving();
    });

    it('should emit message events for new messages', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const messages = [
        {
          id: 1,
          umid: 100,
          message: 'First message',
          app: 'TestApp',
          aid: 1,
          icon: 'icon',
          date: Date.now(),
          priority: 0,
          acked: 0,
        },
        {
          id: 2,
          umid: 101,
          message: 'Second message',
          app: 'TestApp',
          aid: 1,
          icon: 'icon',
          date: Date.now(),
          priority: 1,
          acked: 0,
        },
      ];
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const messageHandler = vi.fn();
      clientWithSecret.on('message', messageHandler);

      await clientWithSecret.startReceiving();

      // Wait for async message processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(messageHandler).toHaveBeenCalledTimes(2);
      expect(messageHandler.mock.calls[0][0].message).toBe('First message');
      expect(messageHandler.mock.calls[1][0].message).toBe('Second message');

      clientWithSecret.stopReceiving();
    });

    it('should not emit duplicate messages', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const messages = [
        {
          id: 1,
          umid: 100,
          message: 'First message',
          app: 'TestApp',
          aid: 1,
          icon: 'icon',
          date: Date.now(),
          priority: 0,
          acked: 0,
        },
      ];

      let callCount = 0;
      mockHttpsRequest.mockImplementation((options, callback) => {
        const mockReq = createMockRequest();
        const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages }));
        callCount++;
        callback(mockRes);
        return mockReq;
      });

      const messageHandler = vi.fn();
      clientWithSecret.on('message', messageHandler);

      // Start with short poll interval
      await clientWithSecret.startReceiving(50);

      // Wait for multiple polls
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should only emit the message once despite multiple polls
      expect(messageHandler).toHaveBeenCalledTimes(1);

      clientWithSecret.stopReceiving();
    });

    it('should stop receiving and emit stopped event', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages: [] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const stoppedHandler = vi.fn();
      clientWithSecret.on('stopped', stoppedHandler);

      await clientWithSecret.startReceiving();
      expect(clientWithSecret.isRunning()).toBe(true);

      clientWithSecret.stopReceiving();

      expect(clientWithSecret.isRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should handle fetch message errors gracefully', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation(() => {
        setTimeout(() => {
          mockReq.emit('error', new Error('Fetch failed'));
        }, 0);
        return mockReq;
      });

      const errorHandler = vi.fn();
      clientWithSecret.on('error', errorHandler);

      await clientWithSecret.startReceiving();

      // Wait for error to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].message).toBe('Fetch failed');

      clientWithSecret.stopReceiving();
    });

    it('should handle invalid JSON in fetch messages', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, 'not json');

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const errorHandler = vi.fn();
      clientWithSecret.on('error', errorHandler);

      await clientWithSecret.startReceiving();

      // Wait for error to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].message).toBe('Failed to parse messages');

      clientWithSecret.stopReceiving();
    });

    it('should use correct URL for fetching messages', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'my-device',
        secret: 'my-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages: [] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        expect(options.path).toBe('/1/messages.json?secret=my-secret&device_id=my-device');
        expect(options.method).toBe('GET');
        callback(mockRes);
        return mockReq;
      });

      await clientWithSecret.startReceiving();

      clientWithSecret.stopReceiving();
    });
  });

  describe('Delete Messages', () => {
    it('should delete messages up to specified ID', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        expect(options.path).toBe('/1/devices/test-device/update_highest_message.json');
        expect(options.method).toBe('POST');
        callback(mockRes);
        return mockReq;
      });

      const result = await clientWithSecret.deleteMessages(123);

      expect(result).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.secret).toBe('test-secret');
      expect(parsed.message).toBe(123);
    });

    it('should return false without secret or device', async () => {
      const clientWithoutSecretDevice = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
      });

      const result = await clientWithoutSecretDevice.deleteMessages(123);

      expect(result).toBe(false);
    });

    it('should return false on delete error', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation(() => {
        setTimeout(() => {
          mockReq.emit('error', new Error('Delete failed'));
        }, 0);
        return mockReq;
      });

      const result = await clientWithSecret.deleteMessages(123);

      expect(result).toBe(false);
    });

    it('should return false on delete invalid response', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, 'invalid');

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await clientWithSecret.deleteMessages(123);

      expect(result).toBe(false);
    });

    it('should return false when API returns error status', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(400, JSON.stringify({ status: 0 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await clientWithSecret.deleteMessages(123);

      expect(result).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should handle empty message gracefully', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: '' });

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.message).toBe('');
    });

    it('should handle special characters in message', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const specialMessage = 'Test <script>alert("xss")</script> & "quotes" \' newline\n tab\t';

      const result = await client.send({ message: specialMessage });

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.message).toBe(specialMessage);
    });

    it('should handle unicode characters', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const unicodeMessage = 'Hello! Test emoji support.';

      const result = await client.send({ message: unicodeMessage });

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.message).toBe(unicodeMessage);
    });

    it('should handle very long messages', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const longMessage = 'A'.repeat(10000);

      const result = await client.send({ message: longMessage });

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      expect(parsed.message).toBe(longMessage);
      expect(parsed.message.length).toBe(10000);
    });

    it('should handle null/undefined title gracefully', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1 }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.notify('Message without title');

      expect(result.success).toBe(true);

      const writtenData = mockReq.write.mock.calls[0][0];
      const parsed = JSON.parse(writtenData);
      // notify() doesn't pass a title, so it should default to 'ARI'
      expect(parsed.title).toBe('ARI');
    });
  });

  describe('Rate Limiting Behavior', () => {
    it('should handle rate limit error response', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse(
        429,
        JSON.stringify({ status: 0, errors: ['over app rate limit'] })
      );

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await client.send({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });

    it('should handle multiple sequential requests', async () => {
      let requestCount = 0;
      mockHttpsRequest.mockImplementation((options, callback) => {
        requestCount++;
        const mockReq = createMockRequest();
        const mockRes = createMockResponse(200, JSON.stringify({ status: 1, request: `req-${requestCount}` }));
        callback(mockRes);
        return mockReq;
      });

      const results = await Promise.all([
        client.send({ message: 'Message 1' }),
        client.send({ message: 'Message 2' }),
        client.send({ message: 'Message 3' }),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(requestCount).toBe(3);
    });
  });

  describe('Client State', () => {
    it('should report not running initially', () => {
      expect(client.isRunning()).toBe(false);
    });

    it('should report running after startReceiving', async () => {
      const clientWithSecret = new PushoverClient({
        userKey: 'test-user',
        apiToken: 'test-token',
        device: 'test-device',
        secret: 'test-secret',
      });

      const mockReq = createMockRequest();
      const mockRes = createMockResponse(200, JSON.stringify({ status: 1, messages: [] }));

      mockHttpsRequest.mockImplementation((options, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await clientWithSecret.startReceiving();

      expect(clientWithSecret.isRunning()).toBe(true);

      clientWithSecret.stopReceiving();

      expect(clientWithSecret.isRunning()).toBe(false);
    });

    it('should be safe to call stopReceiving multiple times', () => {
      expect(() => {
        client.stopReceiving();
        client.stopReceiving();
        client.stopReceiving();
      }).not.toThrow();
    });

    it('should be safe to call stopReceiving without starting', () => {
      const newClient = new PushoverClient(defaultConfig);
      expect(() => {
        newClient.stopReceiving();
      }).not.toThrow();
      expect(newClient.isRunning()).toBe(false);
    });
  });
});
