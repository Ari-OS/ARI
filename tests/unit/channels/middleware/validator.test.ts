import { describe, it, expect } from 'vitest';
import {
  MessageValidator,
  createChannelValidator,
  type ValidationResult,
} from '../../../../src/channels/middleware/validator.js';
import type { ChannelCapabilities } from '../../../../src/channels/types.js';

describe('MessageValidator', () => {
  describe('validateInbound', () => {
    const validInboundMessage = {
      id: 'msg-123',
      channelId: 'channel-1',
      senderId: 'user-456',
      content: 'Hello, world!',
      timestamp: new Date(),
      trustLevel: 'standard',
      attachments: [],
      metadata: {},
    };

    describe('schema validation', () => {
      it('should validate a valid inbound message', () => {
        const result = MessageValidator.validateInbound(validInboundMessage);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitized).toBeDefined();
      });

      it('should fail validation for missing required fields', () => {
        const result = MessageValidator.validateInbound({});

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should fail validation for missing id', () => {
        const { id, ...messageWithoutId } = validInboundMessage;
        const result = MessageValidator.validateInbound(messageWithoutId);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('id'))).toBe(true);
      });

      it('should fail validation for missing channelId', () => {
        const { channelId, ...messageWithoutChannelId } = validInboundMessage;
        const result = MessageValidator.validateInbound(messageWithoutChannelId);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('channelId'))).toBe(true);
      });

      it('should fail validation for missing senderId', () => {
        const { senderId, ...messageWithoutSenderId } = validInboundMessage;
        const result = MessageValidator.validateInbound(messageWithoutSenderId);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('senderId'))).toBe(true);
      });

      it('should fail validation for missing content', () => {
        const { content, ...messageWithoutContent } = validInboundMessage;
        const result = MessageValidator.validateInbound(messageWithoutContent);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('content'))).toBe(true);
      });

      it('should fail validation for missing timestamp', () => {
        const { timestamp, ...messageWithoutTimestamp } = validInboundMessage;
        const result = MessageValidator.validateInbound(messageWithoutTimestamp);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('timestamp'))).toBe(true);
      });

      it('should validate with optional fields', () => {
        const messageWithOptionals = {
          ...validInboundMessage,
          senderName: 'John Doe',
          groupId: 'group-123',
          replyTo: 'msg-100',
        };

        const result = MessageValidator.validateInbound(messageWithOptionals);

        expect(result.valid).toBe(true);
        expect(result.sanitized).toMatchObject({
          senderName: 'John Doe',
          groupId: 'group-123',
          replyTo: 'msg-100',
        });
      });

      it('should use default values for optional fields', () => {
        const minimalMessage = {
          id: 'msg-1',
          channelId: 'ch-1',
          senderId: 'user-1',
          content: 'test',
          timestamp: new Date(),
        };

        const result = MessageValidator.validateInbound(minimalMessage);

        expect(result.valid).toBe(true);
        expect((result.sanitized as Record<string, unknown>).attachments).toEqual([]);
        expect((result.sanitized as Record<string, unknown>).metadata).toEqual({});
      });
    });

    describe('capability-based validation', () => {
      it('should warn when attachments are used but not supported', () => {
        const messageWithAttachments = {
          ...validInboundMessage,
          attachments: [
            { id: 'att-1', type: 'image', url: 'https://example.com/image.png' },
          ],
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateInbound(
          messageWithAttachments,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('attachments'))).toBe(true);
      });

      it('should error when message exceeds max length', () => {
        const longMessage = {
          ...validInboundMessage,
          content: 'a'.repeat(5000),
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          maxMessageLength: 1000,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateInbound(longMessage, capabilities);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('maximum length'))).toBe(true);
      });

      it('should warn about unsupported attachment types', () => {
        const messageWithAttachments = {
          ...validInboundMessage,
          attachments: [
            { id: 'att-1', type: 'video', url: 'https://example.com/video.mp4' },
          ],
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: true,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: ['image', 'file'],
        };

        const result = MessageValidator.validateInbound(
          messageWithAttachments,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(
          result.warnings.some((w) => w.includes("type 'video'"))
        ).toBe(true);
      });

      it('should warn when reply is used but not supported', () => {
        const messageWithReply = {
          ...validInboundMessage,
          replyTo: 'msg-100',
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateInbound(
          messageWithReply,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('replies'))).toBe(true);
      });

      it('should pass with all supported capabilities', () => {
        const fullMessage = {
          ...validInboundMessage,
          attachments: [
            { id: 'att-1', type: 'image', url: 'https://example.com/image.png' },
          ],
          replyTo: 'msg-100',
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: true,
          reactions: true,
          attachments: true,
          replies: true,
          editing: true,
          deletion: true,
          readReceipts: true,
          maxMessageLength: 10000,
          supportedAttachments: ['image', 'video', 'file'],
        };

        const result = MessageValidator.validateInbound(fullMessage, capabilities);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('validateOutbound', () => {
    const validOutboundMessage = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      channelId: 'channel-1',
      recipientId: 'user-456',
      content: 'Hello, world!',
      priority: 'normal',
      attachments: [],
      options: {},
    };

    describe('schema validation', () => {
      it('should validate a valid outbound message', () => {
        const result = MessageValidator.validateOutbound(validOutboundMessage);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitized).toBeDefined();
      });

      it('should fail validation for missing required fields', () => {
        const result = MessageValidator.validateOutbound({});

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should fail validation for invalid UUID id', () => {
        const invalidMessage = {
          ...validOutboundMessage,
          id: 'not-a-uuid',
        };

        const result = MessageValidator.validateOutbound(invalidMessage);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('id'))).toBe(true);
      });

      it('should fail validation for missing recipientId', () => {
        const { recipientId, ...messageWithoutRecipient } = validOutboundMessage;
        const result = MessageValidator.validateOutbound(messageWithoutRecipient);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('recipientId'))).toBe(true);
      });
    });

    describe('content validation', () => {
      it('should fail validation for empty content', () => {
        const emptyContentMessage = {
          ...validOutboundMessage,
          content: '',
        };

        const result = MessageValidator.validateOutbound(emptyContentMessage);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
      });

      it('should fail validation for whitespace-only content', () => {
        const whitespaceMessage = {
          ...validOutboundMessage,
          content: '   \t\n   ',
        };

        const result = MessageValidator.validateOutbound(whitespaceMessage);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
      });
    });

    describe('capability-based validation', () => {
      it('should error when message exceeds max length', () => {
        const longMessage = {
          ...validOutboundMessage,
          content: 'x'.repeat(5000),
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          maxMessageLength: 1000,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateOutbound(longMessage, capabilities);

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('maximum length'))).toBe(true);
      });

      it('should warn when attachments are used but not supported', () => {
        const messageWithAttachments = {
          ...validOutboundMessage,
          attachments: [
            { id: 'att-1', type: 'image', url: 'https://example.com/image.png' },
          ],
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateOutbound(
          messageWithAttachments,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('attachments'))).toBe(true);
      });

      it('should warn about unsupported attachment types', () => {
        const messageWithAttachments = {
          ...validOutboundMessage,
          attachments: [
            { id: 'att-1', type: 'audio', url: 'https://example.com/audio.mp3' },
          ],
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: true,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: ['image', 'file'],
        };

        const result = MessageValidator.validateOutbound(
          messageWithAttachments,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(
          result.warnings.some((w) => w.includes("type 'audio'"))
        ).toBe(true);
      });

      it('should warn when reply is used but not supported', () => {
        const messageWithReply = {
          ...validOutboundMessage,
          replyTo: 'msg-100',
        };

        const capabilities: ChannelCapabilities = {
          typingIndicator: false,
          reactions: false,
          attachments: false,
          replies: false,
          editing: false,
          deletion: false,
          readReceipts: false,
          supportedAttachments: [],
        };

        const result = MessageValidator.validateOutbound(
          messageWithReply,
          capabilities
        );

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('replies'))).toBe(true);
      });
    });
  });

  describe('validateContent', () => {
    it('should validate clean content', () => {
      const result = MessageValidator.validateContent('Hello, world!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail validation for empty content', () => {
      const result = MessageValidator.validateContent('');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should fail validation for whitespace-only content', () => {
      const result = MessageValidator.validateContent('   \n\t   ');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should warn about control characters', () => {
      const result = MessageValidator.validateContent('Hello\x00World');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('control characters'))).toBe(true);
    });

    it('should warn about very long lines', () => {
      const longLine = 'x'.repeat(5000);
      const result = MessageValidator.validateContent(longLine);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('very long'))).toBe(true);
    });

    it('should warn about potential XSS with script tags', () => {
      const result = MessageValidator.validateContent('<script>alert("xss")</script>');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('script'))).toBe(true);
    });

    it('should warn about javascript: URLs', () => {
      const result = MessageValidator.validateContent('Click here: javascript:alert(1)');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('script'))).toBe(true);
    });

    it('should warn about inline event handlers', () => {
      const result = MessageValidator.validateContent('<img onerror=alert(1)>');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('script'))).toBe(true);
    });

    it('should not false positive on normal content', () => {
      const result = MessageValidator.validateContent(
        'The script I wrote yesterday is working great!'
      );

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('sanitizeContent', () => {
    it('should remove control characters', () => {
      const result = MessageValidator.sanitizeContent('Hello\x00\x01\x02World');

      // Control characters are removed (not replaced with space)
      expect(result).toBe('HelloWorld');
    });

    it('should preserve newlines and tabs', () => {
      const result = MessageValidator.sanitizeContent('Hello\nWorld\tTest');

      // Tabs are normalized to spaces
      expect(result).toBe('Hello\nWorld Test');
    });

    it('should normalize Windows line endings', () => {
      const result = MessageValidator.sanitizeContent('Line1\r\nLine2\r\nLine3');

      expect(result).toBe('Line1\nLine2\nLine3');
    });

    it('should normalize Mac line endings', () => {
      const result = MessageValidator.sanitizeContent('Line1\rLine2\rLine3');

      expect(result).toBe('Line1\nLine2\nLine3');
    });

    it('should collapse excessive whitespace', () => {
      const result = MessageValidator.sanitizeContent('Hello    World');

      expect(result).toBe('Hello World');
    });

    it('should collapse excessive newlines', () => {
      const result = MessageValidator.sanitizeContent('Hello\n\n\n\n\nWorld');

      expect(result).toBe('Hello\n\nWorld');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = MessageValidator.sanitizeContent('   Hello World   ');

      expect(result).toBe('Hello World');
    });

    it('should truncate to maxLength with ellipsis', () => {
      const result = MessageValidator.sanitizeContent('Hello, World!', 10);

      expect(result).toBe('Hello, ...');
      expect(result.length).toBe(10);
    });

    it('should not truncate if under maxLength', () => {
      const result = MessageValidator.sanitizeContent('Hello', 100);

      expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
      const result = MessageValidator.sanitizeContent('');

      expect(result).toBe('');
    });

    it('should handle whitespace-only string', () => {
      const result = MessageValidator.sanitizeContent('   \n\t   ');

      expect(result).toBe('');
    });
  });

  describe('validateRecipientId', () => {
    it('should validate a valid recipient ID', () => {
      const result = MessageValidator.validateRecipientId('user-123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty recipient ID', () => {
      const result = MessageValidator.validateRecipientId('');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should fail validation for whitespace-only recipient ID', () => {
      const result = MessageValidator.validateRecipientId('   ');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should warn about special characters', () => {
      const result = MessageValidator.validateRecipientId('user<script>');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('special characters'))).toBe(true);
    });

    it('should warn about quotes', () => {
      const result = MessageValidator.validateRecipientId('user"name');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('special characters'))).toBe(true);
    });

    it('should warn about backslashes', () => {
      const result = MessageValidator.validateRecipientId('user\\name');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('special characters'))).toBe(true);
    });
  });

  describe('validateSenderId', () => {
    it('should validate a valid sender ID', () => {
      const result = MessageValidator.validateSenderId('user-456');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty sender ID', () => {
      const result = MessageValidator.validateSenderId('');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should fail validation for whitespace-only sender ID', () => {
      const result = MessageValidator.validateSenderId('   ');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should warn about special characters', () => {
      const result = MessageValidator.validateSenderId("user'name");

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('special characters'))).toBe(true);
    });
  });

  describe('validateAttachment', () => {
    it('should validate a valid attachment with URL', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid attachment with data', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
        data: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for non-object attachment', () => {
      const result = MessageValidator.validateAttachment('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid attachment format'))).toBe(
        true
      );
    });

    it('should fail validation for null attachment', () => {
      const result = MessageValidator.validateAttachment(null);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid attachment format'))).toBe(
        true
      );
    });

    it('should fail validation for missing id', () => {
      const attachment = {
        type: 'image',
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should fail validation for non-string id', () => {
      const attachment = {
        id: 123,
        type: 'image',
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should fail validation for missing type', () => {
      const attachment = {
        id: 'att-123',
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should fail validation for non-string type', () => {
      const attachment = {
        id: 'att-123',
        type: 123,
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should fail validation for missing both url and data', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('url or data'))).toBe(true);
    });

    it('should fail validation for invalid URL', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
        url: 'not-a-valid-url',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid attachment URL'))).toBe(true);
    });

    it('should warn about potentially invalid base64 data', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
        data: 'not valid base64!!!',
      };

      const result = MessageValidator.validateAttachment(attachment);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('base64'))).toBe(true);
    });

    it('should warn about unsupported type when supportedTypes provided', () => {
      const attachment = {
        id: 'att-123',
        type: 'video',
        url: 'https://example.com/video.mp4',
      };

      const result = MessageValidator.validateAttachment(attachment, ['image', 'file']);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("type 'video'"))).toBe(true);
    });

    it('should not warn when type is in supportedTypes', () => {
      const attachment = {
        id: 'att-123',
        type: 'image',
        url: 'https://example.com/image.png',
      };

      const result = MessageValidator.validateAttachment(attachment, [
        'image',
        'video',
        'file',
      ]);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('createChannelValidator', () => {
  const capabilities: ChannelCapabilities = {
    typingIndicator: true,
    reactions: true,
    attachments: true,
    replies: true,
    editing: true,
    deletion: true,
    readReceipts: true,
    maxMessageLength: 4000,
    supportedAttachments: ['image', 'file'],
  };

  it('should create a validator with bound capabilities', () => {
    const validator = createChannelValidator(capabilities);

    expect(validator.validateInbound).toBeDefined();
    expect(validator.validateOutbound).toBeDefined();
    expect(validator.validateContent).toBeDefined();
    expect(validator.sanitizeContent).toBeDefined();
    expect(validator.validateRecipientId).toBeDefined();
    expect(validator.validateSenderId).toBeDefined();
    expect(validator.validateAttachment).toBeDefined();
  });

  describe('validateInbound', () => {
    it('should use bound capabilities for validation', () => {
      const validator = createChannelValidator(capabilities);

      const longMessage = {
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'x'.repeat(5000),
        timestamp: new Date(),
        attachments: [],
        metadata: {},
      };

      const result = validator.validateInbound(longMessage);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('4000'))).toBe(true);
    });
  });

  describe('validateOutbound', () => {
    it('should use bound capabilities for validation', () => {
      const validator = createChannelValidator(capabilities);

      const messageWithUnsupportedAttachment = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channelId: 'ch-1',
        recipientId: 'user-1',
        content: 'Hello',
        attachments: [
          { id: 'att-1', type: 'video', url: 'https://example.com/video.mp4' },
        ],
        options: {},
      };

      const result = validator.validateOutbound(messageWithUnsupportedAttachment);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("type 'video'"))).toBe(true);
    });
  });

  describe('sanitizeContent', () => {
    it('should use bound maxMessageLength for truncation', () => {
      const validator = createChannelValidator(capabilities);

      const result = validator.sanitizeContent('x'.repeat(5000));

      expect(result.length).toBe(4000);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('validateAttachment', () => {
    it('should use bound supportedAttachments for validation', () => {
      const validator = createChannelValidator(capabilities);

      const attachment = {
        id: 'att-1',
        type: 'audio',
        url: 'https://example.com/audio.mp3',
      };

      const result = validator.validateAttachment(attachment);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("type 'audio'"))).toBe(true);
    });
  });
});

describe('ValidationResult interface', () => {
  it('should have consistent structure across all validators', () => {
    const results: ValidationResult[] = [
      MessageValidator.validateInbound({
        id: 'msg-1',
        channelId: 'ch-1',
        senderId: 'user-1',
        content: 'test',
        timestamp: new Date(),
      }),
      MessageValidator.validateOutbound({
        id: '550e8400-e29b-41d4-a716-446655440000',
        channelId: 'ch-1',
        recipientId: 'user-1',
        content: 'test',
      }),
      MessageValidator.validateContent('test'),
      MessageValidator.validateRecipientId('user-1'),
      MessageValidator.validateSenderId('user-1'),
      MessageValidator.validateAttachment({
        id: 'att-1',
        type: 'image',
        url: 'https://example.com/image.png',
      }),
    ];

    for (const result of results) {
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });
});
