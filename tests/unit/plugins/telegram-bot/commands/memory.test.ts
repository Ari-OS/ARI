/**
 * Tests for /memory Telegram command — store and recall memory
 */

import { describe, it, expect, vi } from 'vitest';
import { handleMemory } from '../../../../../src/plugins/telegram-bot/commands/memory.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';

describe('/memory command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleMemory>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  it('should show help when no arguments', async () => {
    const ctx = createMockCtx('/memory');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Memory Management');
    expect(reply).toContain('Usage');
  });

  it('should show usage for store without content', async () => {
    const ctx = createMockCtx('/memory store');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Usage');
  });

  it('should show usage for recall without query', async () => {
    const ctx = createMockCtx('/memory recall');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Usage');
  });

  it('should show stats when requested', async () => {
    const ctx = createMockCtx('/memory stats');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Statistics');
  });

  it('should handle unknown subcommand', async () => {
    const ctx = createMockCtx('/memory unknown');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Unknown subcommand');
  });

  it('should handle errors gracefully', async () => {
    const ctx = createMockCtx('/memory store test content');
    const eventBus = createMockEventBus();

    await handleMemory(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalled();
  });
});
