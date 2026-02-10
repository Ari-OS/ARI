import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import { createAuthMiddleware } from '../../../../src/plugins/telegram-bot/middleware/auth.js';

describe('Auth Middleware', () => {
  it('should allow users in whitelist', async () => {
    const eventBus = new EventBus();
    const middleware = createAuthMiddleware([123, 456], eventBus);
    const next = vi.fn();

    const ctx = {
      from: { id: 123 },
      chat: { id: 100 },
    } as never;

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block users not in whitelist (silent)', async () => {
    const eventBus = new EventBus();
    const events: unknown[] = [];
    eventBus.on('telegram:auth_rejected', (e) => events.push(e));

    const middleware = createAuthMiddleware([123], eventBus);
    const next = vi.fn();

    const ctx = {
      from: { id: 999 },
      chat: { id: 100 },
    } as never;

    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('should allow all when whitelist is empty', async () => {
    const eventBus = new EventBus();
    const middleware = createAuthMiddleware([], eventBus);
    const next = vi.fn();

    const ctx = {
      from: { id: 999 },
      chat: { id: 100 },
    } as never;

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('should ignore messages without user info', async () => {
    const eventBus = new EventBus();
    const middleware = createAuthMiddleware([123], eventBus);
    const next = vi.fn();

    const ctx = { from: undefined, chat: { id: 100 } } as never;

    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });
});
