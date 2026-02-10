import type { Context, NextFunction } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE — Whitelist check, silent reject unauthorized
// ═══════════════════════════════════════════════════════════════════════════════

export function createAuthMiddleware(
  allowedUserIds: number[],
  eventBus: EventBus,
) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId) return; // No user info = ignore

    // Empty allowlist = allow all (useful for development)
    if (allowedUserIds.length > 0 && !allowedUserIds.includes(userId)) {
      eventBus.emit('telegram:auth_rejected', {
        userId,
        chatId: ctx.chat?.id ?? 0,
        timestamp: new Date().toISOString(),
      });
      // Silent reject — don't respond to unauthorized users
      return;
    }

    await next();
  };
}
