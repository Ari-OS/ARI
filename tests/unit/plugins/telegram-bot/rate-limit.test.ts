import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import { createRateLimitMiddleware } from '../../../../src/plugins/telegram-bot/middleware/rate-limit.js';

describe('Rate Limit Middleware', () => {
  it('should allow first request', async () => {
    const eventBus = new EventBus();
    const middleware = createRateLimitMiddleware({ perChat: 1, global: 30 }, eventBus);
    const next = vi.fn();

    const ctx = {
      from: { id: 123 },
      chat: { id: 100 },
    } as never;

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block rapid per-chat requests', async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on('telegram:rate_limited', (e) => events.push(e));

    const middleware = createRateLimitMiddleware({ perChat: 1, global: 30 }, eventBus);
    const next = vi.fn();

    const ctx = {
      from: { id: 123 },
      chat: { id: 100 },
    } as never;

    // First request passes
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second rapid request blocked
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1); // Not called again
    expect(events).toHaveLength(1);
  });

  it('should allow different chats independently', async () => {
    const eventBus = new EventBus();
    const middleware = createRateLimitMiddleware({ perChat: 1, global: 30 }, eventBus);
    const next = vi.fn();

    const ctx1 = { from: { id: 123 }, chat: { id: 100 } } as never;
    const ctx2 = { from: { id: 456 }, chat: { id: 200 } } as never;

    await middleware(ctx1, next);
    await middleware(ctx2, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
