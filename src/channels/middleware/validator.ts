import type {
  ChannelCapabilities,
} from '../types.js';
import {
  InboundMessageSchema,
  OutboundMessageSchema,
} from '../types.js';

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: unknown;
}

/**
 * MessageValidator
 *
 * Validates inbound and outbound messages against schemas
 * and channel-specific constraints.
 */
export class MessageValidator {
  /**
   * Validate an inbound message
   */
  static validateInbound(
    message: unknown,
    capabilities?: ChannelCapabilities
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const parseResult = InboundMessageSchema.safeParse(message);
    if (!parseResult.success) {
      return {
        valid: false,
        errors: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        warnings: [],
      };
    }

    const validated = parseResult.data;

    // Capability-based validation
    if (capabilities) {
      // Check attachments
      if (validated.attachments.length > 0 && !capabilities.attachments) {
        warnings.push('Channel does not support attachments, they will be ignored');
      }

      // Check message length
      if (capabilities.maxMessageLength && validated.content.length > capabilities.maxMessageLength) {
        errors.push(`Message exceeds maximum length of ${capabilities.maxMessageLength} characters`);
      }

      // Check attachment types
      if (capabilities.supportedAttachments && capabilities.supportedAttachments.length > 0) {
        for (const attachment of validated.attachments) {
          if (!capabilities.supportedAttachments.includes(attachment.type)) {
            warnings.push(`Attachment type '${attachment.type}' may not be supported`);
          }
        }
      }

      // Check reply support
      if (validated.replyTo && !capabilities.replies) {
        warnings.push('Channel does not support replies, reply context will be ignored');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: validated,
    };
  }

  /**
   * Validate an outbound message
   */
  static validateOutbound(
    message: unknown,
    capabilities?: ChannelCapabilities
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const parseResult = OutboundMessageSchema.safeParse(message);
    if (!parseResult.success) {
      return {
        valid: false,
        errors: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        warnings: [],
      };
    }

    const validated = parseResult.data;

    // Basic content validation
    if (!validated.content || validated.content.trim().length === 0) {
      errors.push('Message content cannot be empty');
    }

    // Capability-based validation
    if (capabilities) {
      // Check message length
      if (capabilities.maxMessageLength && validated.content.length > capabilities.maxMessageLength) {
        errors.push(`Message exceeds maximum length of ${capabilities.maxMessageLength} characters`);
      }

      // Check attachments
      if (validated.attachments.length > 0 && !capabilities.attachments) {
        warnings.push('Channel does not support attachments, they will be ignored');
      }

      // Check attachment types
      if (capabilities.supportedAttachments && capabilities.supportedAttachments.length > 0) {
        for (const attachment of validated.attachments) {
          if (!capabilities.supportedAttachments.includes(attachment.type)) {
            warnings.push(`Attachment type '${attachment.type}' may not be supported`);
          }
        }
      }

      // Check reply support
      if (validated.replyTo && !capabilities.replies) {
        warnings.push('Channel does not support replies, reply context will be ignored');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: validated,
    };
  }

  /**
   * Validate message content for common issues
   */
  static validateContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Empty check
    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    // Check for potential encoding issues
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content)) {
      warnings.push('Content contains control characters');
    }

    // Check for extremely long lines
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 4096) {
        warnings.push(`Line ${i + 1} is very long (${lines[i].length} chars)`);
      }
    }

    // Check for potential XSS (for channels that render HTML)
    if (/<script|javascript:|on\w+=/i.test(content)) {
      warnings.push('Content contains potential script content');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize message content for safe display
   */
  static sanitizeContent(content: string, maxLength?: number): string {
    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize newlines
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Trim excessive whitespace
    sanitized = sanitized.replace(/[ \t]+/g, ' ');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Trim overall
    sanitized = sanitized.trim();

    // Truncate if needed
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }

    return sanitized;
  }

  /**
   * Validate recipient ID format
   */
  static validateRecipientId(recipientId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!recipientId || recipientId.trim().length === 0) {
      errors.push('Recipient ID cannot be empty');
    }

    // Check for special characters that might cause issues
    if (/[<>"'\\]/.test(recipientId)) {
      warnings.push('Recipient ID contains special characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate sender ID format
   */
  static validateSenderId(senderId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!senderId || senderId.trim().length === 0) {
      errors.push('Sender ID cannot be empty');
    }

    // Check for special characters
    if (/[<>"'\\]/.test(senderId)) {
      warnings.push('Sender ID contains special characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate attachment
   */
  static validateAttachment(
    attachment: unknown,
    supportedTypes?: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure check
    if (typeof attachment !== 'object' || attachment === null) {
      return {
        valid: false,
        errors: ['Invalid attachment format'],
        warnings: [],
      };
    }

    const att = attachment as Record<string, unknown>;

    // Required fields
    if (!att.id || typeof att.id !== 'string') {
      errors.push('Attachment must have an id');
    }

    if (!att.type || typeof att.type !== 'string') {
      errors.push('Attachment must have a type');
    }

    // Check type support
    if (supportedTypes && typeof att.type === 'string' && !supportedTypes.includes(att.type)) {
      warnings.push(`Attachment type '${att.type}' may not be supported`);
    }

    // Check for either URL or data
    if (!att.url && !att.data) {
      errors.push('Attachment must have either url or data');
    }

    // Validate URL format
    if (att.url && typeof att.url === 'string') {
      try {
        new URL(att.url);
      } catch {
        errors.push('Invalid attachment URL');
      }
    }

    // Check data encoding (should be base64)
    if (att.data && typeof att.data === 'string') {
      if (!/^[A-Za-z0-9+/=]+$/.test(att.data)) {
        warnings.push('Attachment data may not be valid base64');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Create a validator with channel-specific capabilities
 */
export function createChannelValidator(capabilities: ChannelCapabilities) {
  return {
    validateInbound: (message: unknown) =>
      MessageValidator.validateInbound(message, capabilities),
    validateOutbound: (message: unknown) =>
      MessageValidator.validateOutbound(message, capabilities),
    validateContent: (content: string) =>
      MessageValidator.validateContent(content),
    sanitizeContent: (content: string) =>
      MessageValidator.sanitizeContent(content, capabilities.maxMessageLength),
    validateRecipientId: (recipientId: string) =>
      MessageValidator.validateRecipientId(recipientId),
    validateSenderId: (senderId: string) =>
      MessageValidator.validateSenderId(senderId),
    validateAttachment: (attachment: unknown) =>
      MessageValidator.validateAttachment(attachment, capabilities.supportedAttachments),
  };
}
