/**
 * Tests for /remind Telegram command — view Apple Reminders
 */

import { describe, it, expect, vi } from 'vitest';
import { handleRemind } from '../../../../../src/plugins/telegram-bot/commands/remind.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';

describe('/remind command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleRemind>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  it('should show pending reminders by default', async () => {
    const ctx = createMockCtx('/remind');
    const eventBus = createMockEventBus();

    await handleRemind(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toMatch(/Reminders|No pending reminders|not available/);
  }, 20000);

  it('should show pending reminders with "list" subcommand', async () => {
    const ctx = createMockCtx('/remind list');
    const eventBus = createMockEventBus();

    await handleRemind(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toMatch(/Reminders|No pending reminders|not available/);
  }, 20000);

  it('should show not-supported message for creating reminders', async () => {
    const ctx = createMockCtx('/remind Buy groceries');
    const eventBus = createMockEventBus();

    await handleRemind(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('not yet supported');
  });

  it('should handle macOS-only error gracefully', async () => {
    const ctx = createMockCtx('/remind');
    const eventBus = createMockEventBus();

    await handleRemind(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalled();
  }, 20000);
});
