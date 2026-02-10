import type { Context, NextFunction } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING MIDDLEWARE — Emit events for commands and audit trail
// ═══════════════════════════════════════════════════════════════════════════════

export function createLoggingMiddleware(eventBus: EventBus) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id ?? 0;
    const chatId = ctx.chat?.id ?? 0;

    // Detect command from message text
    const text = ctx.message?.text ?? '';
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].slice(1).split('@')[0];
      eventBus.emit('telegram:command_received', {
        command,
        userId,
        chatId,
        timestamp: new Date().toISOString(),
      });
    }

    await next();
  };
}
