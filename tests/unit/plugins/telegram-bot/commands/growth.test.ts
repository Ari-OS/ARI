/**
 * Tests for /growth Telegram command — content pipeline status
 */

import { describe, it, expect, vi } from 'vitest';
import { handleGrowth } from '../../../../../src/plugins/telegram-bot/commands/growth.js';
import type { PluginRegistry } from '../../../../../src/plugins/registry.js';

describe('/growth command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleGrowth>[0];
  }

  it('should show pipeline status by default', async () => {
    const ctx = createMockCtx('/growth');
    const mockRegistry = {} as PluginRegistry;

    await handleGrowth(ctx, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Growth Pipeline');
  });

  it('should show ideas placeholder', async () => {
    const ctx = createMockCtx('/growth ideas');
    const mockRegistry = {} as PluginRegistry;

    await handleGrowth(ctx, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Content Ideas');
  });

  it('should handle missing registry', async () => {
    const ctx = createMockCtx('/growth');

    await handleGrowth(ctx, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('not available');
  });
});
