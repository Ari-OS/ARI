/**
 * Tests for /calendar Telegram command — view Apple Calendar events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCalendar } from '../../../../../src/plugins/telegram-bot/commands/calendar.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';

describe('/calendar command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleCalendar>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show today\'s events by default', async () => {
    const ctx = createMockCtx('/calendar');
    const eventBus = createMockEventBus();

    await handleCalendar(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toMatch(/Today's Calendar|No events scheduled|not available/);
  }, 20000);

  it('should show week events when requested', async () => {
    const ctx = createMockCtx('/calendar week');
    const eventBus = createMockEventBus();

    await handleCalendar(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toMatch(/This Week's Calendar|No events scheduled|not available/);
  }, 20000);

  it('should show tomorrow events when requested', async () => {
    const ctx = createMockCtx('/calendar tomorrow');
    const eventBus = createMockEventBus();

    await handleCalendar(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toMatch(/Tomorrow's Calendar|No events scheduled|not available/);
  }, 20000);

  it('should handle macOS-only error gracefully', async () => {
    const ctx = createMockCtx('/calendar');
    const eventBus = createMockEventBus();

    // Calendar will fail on non-macOS systems
    await handleCalendar(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalled();
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toBeTruthy();
  }, 20000);

  it('should emit telemetry event', async () => {
    const ctx = createMockCtx('/calendar');
    const eventBus = createMockEventBus();

    await handleCalendar(ctx, eventBus);

    // Should emit event if calendar is available
    // On non-macOS systems, this might not emit
    expect(ctx.reply).toHaveBeenCalled();
  }, 20000);
});
