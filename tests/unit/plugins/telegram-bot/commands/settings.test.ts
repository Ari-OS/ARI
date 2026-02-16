/**
 * Tests for /settings Telegram command — notification preferences
 */

import { describe, it, expect, vi } from 'vitest';
import { handleSettings } from '../../../../../src/plugins/telegram-bot/commands/settings.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';

describe('/settings command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleSettings>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  it('should show current settings when no arguments', async () => {
    const ctx = createMockCtx('/settings');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Notification Settings');
    expect(reply).toContain('Quiet hours');
    expect(reply).toContain('Verbose mode');
  });

  it('should update quiet setting with "on"', async () => {
    const ctx = createMockCtx('/settings quiet on');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Settings Updated');
    expect(reply).toContain('Quiet hours: ON');
  });

  it('should update quiet setting with "off"', async () => {
    const ctx = createMockCtx('/settings quiet off');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Settings Updated');
    expect(reply).toContain('Quiet hours: OFF');
  });

  it('should show usage for quiet without value', async () => {
    const ctx = createMockCtx('/settings quiet');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Usage');
  });

  it('should update verbose setting with "on"', async () => {
    const ctx = createMockCtx('/settings verbose on');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Settings Updated');
    expect(reply).toContain('Verbose mode: ON');
  });

  it('should handle unknown setting', async () => {
    const ctx = createMockCtx('/settings unknown on');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Unknown setting');
  });

  it('should emit telemetry events', async () => {
    const ctx = createMockCtx('/settings quiet on');
    const eventBus = createMockEventBus();

    await handleSettings(ctx, eventBus);

    expect(eventBus.emit).toHaveBeenCalledWith('telegram:settings_changed', {
      userId: 123456,
      setting: 'quiet',
      value: 'on',
    });
  });
});
