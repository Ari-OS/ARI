/**
 * ARI vNext — Input Sanitizer
 *
 * ARCHITECTURAL INVARIANT: CONTENT ≠ COMMAND
 *
 * Sanitizes ALL inbound content. Suspicious patterns are
 * DETECTED and LOGGED but NOT BLOCKED (shadow integration).
 *
 * @module security/sanitizer
 * @version 1.0.0
 */

import * as crypto from 'node:crypto';
import {
  type InboundMessage,
  type SanitizationFlags,
  type SanitizedMessage,
  type Result,
  ok,
  err,
} from '../types/index.js';
import { getConfig } from '../config/config.js';
import { securityLogger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// SUSPICIOUS PATTERNS (SHADOW INTEGRATION)
// ═══════════════════════════════════════════════════════════════════════════

const SUSPICIOUS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'ignore_instructions',
    pattern: /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  },
  {
    name: 'disregard_rules',
    pattern: /disregard\s+(all\s+)?(previous\s+)?(rules|guidelines)/i,
  },
  { name: 'new_instructions', pattern: /new\s+(system\s+)?instructions?:/i },
  { name: 'you_are_now', pattern: /you\s+are\s+now\s+/i },
  { name: 'pretend_to_be', pattern: /pretend\s+(to\s+be|you'?re)/i },
  { name: 'act_as', pattern: /act\s+as\s+(if|though|a)/i },
  {
    name: 'jailbreak',
    pattern: /jailbreak|dan\s+mode|developer\s+mode/i,
  },
  { name: 'reveal_prompt', pattern: /reveal\s+(your\s+)?(system\s+)?prompt/i },
  {
    name: 'show_instructions',
    pattern: /show\s+(me\s+)?(your\s+)?instructions/i,
  },
  {
    name: 'what_is_prompt',
    pattern: /what\s+(is|are)\s+(your\s+)?(system\s+)?prompt/i,
  },
  {
    name: 'execute_command',
    pattern: /\bexecute:\s*|run:\s*|eval\s*\(/i,
  },
  { name: 'system_command', pattern: /\$\(|`[^`]+`|\bexec\s*\(/i },
  { name: 'system_tag', pattern: /\[system\]|\[admin\]|\[root\]/i },
  {
    name: 'xml_injection',
    pattern: /<\/?system>|<\/?prompt>|<\/?instructions>/i,
  },
  { name: 'markdown_injection', pattern: /```system|```admin/i },
  { name: 'base64_content', pattern: /base64:|data:[^,]+;base64,/i },
  { name: 'unicode_escape', pattern: /\\u[0-9a-f]{4}/i },
  {
    name: 'tool_call',
    pattern: /call\s+tool|invoke\s+function|execute\s+tool/i,
  },
  {
    name: 'memory_write',
    pattern: /write\s+to\s+memory|store\s+(this\s+)?in\s+memory/i,
  },
  {
    name: 'bypass_security',
    pattern: /bypass\s+(the\s+)?(security|safety|filter)/i,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

class RateLimiter {
  private buckets: Map<string, RateLimiterState> = new Map();
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(perMinute: number) {
    this.maxTokens = perMinute;
    this.refillRate = perMinute / 60000;
  }

  checkAndConsume(sender: string): boolean {
    const now = Date.now();
    let state = this.buckets.get(sender);

    if (state === undefined) {
      state = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(sender, state);
    } else {
      const elapsed = now - state.lastRefill;
      state.tokens = Math.min(this.maxTokens, state.tokens + elapsed * this.refillRate);
      state.lastRefill = now;
    }

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return true;
    }

    return false;
  }

  getRemainingTokens(sender: string): number {
    const state = this.buckets.get(sender);
    if (state === undefined) {
      return this.maxTokens;
    }

    const now = Date.now();
    const elapsed = now - state.lastRefill;
    return Math.min(this.maxTokens, state.tokens + elapsed * this.refillRate);
  }

  clear(): void {
    this.buckets.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SANITIZER CLASS
// ═══════════════════════════════════════════════════════════════════════════

interface SanitizerConfig {
  maxMessageBytes: number;
  perSenderPerMinute: number;
}

export class Sanitizer {
  private readonly config: SanitizerConfig;
  private readonly rateLimiter: RateLimiter;

  constructor(config?: Partial<SanitizerConfig>) {
    const appConfig = getConfig();
    this.config = {
      maxMessageBytes: config?.maxMessageBytes ?? appConfig.limits.max_message_bytes,
      perSenderPerMinute: config?.perSenderPerMinute ?? appConfig.limits.per_sender_per_minute,
    };
    this.rateLimiter = new RateLimiter(this.config.perSenderPerMinute);
  }

  sanitize(message: InboundMessage): Result<SanitizedMessage, Error> {
    const startTime = performance.now();

    try {
      const messageId = crypto.randomUUID();
      const originalSize = Buffer.byteLength(message.content, 'utf-8');

      const flags: SanitizationFlags = {
        size_truncated: false,
        rate_limited: false,
        encoding_fixed: false,
        control_chars_stripped: false,
        suspicious_patterns: [],
        original_size_bytes: originalSize,
        final_size_bytes: 0,
        processing_time_ms: 0,
      };

      // Step 1: Rate limit check
      if (!this.rateLimiter.checkAndConsume(message.sender)) {
        flags.rate_limited = true;
        securityLogger.warn(
          { sender: message.sender, channel: message.channel },
          'Rate limit exceeded',
        );
      }

      let content = message.content;

      // Step 2: Fix encoding
      const encodingResult = this.fixEncoding(content);
      if (encodingResult.wasFixed) {
        flags.encoding_fixed = true;
        content = encodingResult.text;
      }

      // Step 3: Strip control characters
      const controlResult = this.stripControlChars(content);
      if (controlResult.wasStripped) {
        flags.control_chars_stripped = true;
        content = controlResult.text;
      }

      // Step 4: Truncate if needed
      if (Buffer.byteLength(content, 'utf-8') > this.config.maxMessageBytes) {
        content = this.truncateToBytes(content, this.config.maxMessageBytes);
        flags.size_truncated = true;
        securityLogger.info(
          {
            sender: message.sender,
            originalSize,
            maxSize: this.config.maxMessageBytes,
          },
          'Message truncated',
        );
      }

      // Step 5: Detect suspicious patterns (SHADOW INTEGRATION)
      flags.suspicious_patterns = this.detectSuspiciousPatterns(content);
      if (flags.suspicious_patterns.length > 0) {
        securityLogger.warn(
          {
            sender: message.sender,
            channel: message.channel,
            patterns: flags.suspicious_patterns,
          },
          'Suspicious patterns detected (logged, not blocked)',
        );
      }

      flags.final_size_bytes = Buffer.byteLength(content, 'utf-8');
      flags.processing_time_ms = performance.now() - startTime;

      const sanitized: SanitizedMessage = {
        message_id: messageId,
        original: message,
        sanitized_content: content,
        flags,
        sanitized_at: new Date().toISOString(),
      };

      return ok(sanitized);
    } catch (error) {
      securityLogger.error({ error }, 'Sanitization failed');
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private fixEncoding(text: string): { text: string; wasFixed: boolean } {
    const buffer = Buffer.from(text, 'utf-8');
    const fixed = buffer.toString('utf-8');
    const cleaned = fixed.replace(/\uFFFD/g, '');

    return {
      text: cleaned,
      wasFixed: cleaned !== text,
    };
  }

  private stripControlChars(text: string): { text: string; wasStripped: boolean } {
    let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    return {
      text: cleaned,
      wasStripped: cleaned !== text,
    };
  }

  private truncateToBytes(text: string, maxBytes: number): string {
    const buffer = Buffer.from(text, 'utf-8');

    if (buffer.length <= maxBytes) {
      return text;
    }

    let truncateAt = maxBytes;
    while (
      truncateAt > 0 &&
      (buffer[truncateAt] ?? 0) >= 0x80 &&
      (buffer[truncateAt] ?? 0) < 0xc0
    ) {
      truncateAt--;
    }

    return buffer.subarray(0, truncateAt).toString('utf-8');
  }

  private detectSuspiciousPatterns(text: string): string[] {
    const detected: string[] = [];

    for (const { name, pattern } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        detected.push(name);
      }
    }

    return detected;
  }

  getRateLimitRemaining(sender: string): number {
    return this.rateLimiter.getRemainingTokens(sender);
  }

  clearRateLimiter(): void {
    this.rateLimiter.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let sanitizerInstance: Sanitizer | null = null;

export function getSanitizer(): Sanitizer {
  if (sanitizerInstance === null) {
    sanitizerInstance = new Sanitizer();
  }
  return sanitizerInstance;
}

export function createSanitizer(config?: Partial<SanitizerConfig>): Sanitizer {
  return new Sanitizer(config);
}

export function resetSanitizer(): void {
  sanitizerInstance = null;
}
