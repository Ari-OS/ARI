import type { Context, NextFunction } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT MIDDLEWARE — Per-chat + global rate limiting
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitConfig {
  perChat: number;   // max messages per second per chat
  global: number;    // max messages per second global
}

export function createRateLimitMiddleware(
  config: RateLimitConfig,
  eventBus: EventBus,
) {
  const chatTimestamps: Map<number, number[]> = new Map();
  const globalTimestamps: number[] = [];

  function cleanOldTimestamps(timestamps: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return timestamps.filter(t => t >= cutoff);
  }

  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const chatId = ctx.chat?.id ?? 0;
    const userId = ctx.from?.id ?? 0;
    const now = Date.now();
    const windowMs = 1000; // 1 second window

    // Global rate check
    const cleanedGlobal = cleanOldTimestamps(globalTimestamps, windowMs);
    globalTimestamps.length = 0;
    globalTimestamps.push(...cleanedGlobal);

    if (globalTimestamps.length >= config.global) {
      eventBus.emit('telegram:rate_limited', {
        userId,
        chatId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Per-chat rate check
    const chatHistory = chatTimestamps.get(chatId) ?? [];
    const cleanedChat = cleanOldTimestamps(chatHistory, windowMs);

    if (cleanedChat.length >= config.perChat) {
      eventBus.emit('telegram:rate_limited', {
        userId,
        chatId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Record timestamps
    cleanedChat.push(now);
    chatTimestamps.set(chatId, cleanedChat);
    globalTimestamps.push(now);

    await next();
  };
}
