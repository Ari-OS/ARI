/**
 * Tests for /growth Telegram command — Growth Pod dashboard
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

  it('should show Growth Pod dashboard by default', async () => {
    const ctx = createMockCtx('/growth');
    const mockRegistry = {} as PluginRegistry;

    await handleGrowth(ctx, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Growth Pod');
  });

  it('should show morning digest for /growth digest', async () => {
    const ctx = createMockCtx('/growth digest');
    const mockRegistry = {} as PluginRegistry;

    await handleGrowth(ctx, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Morning Digest');
  });

  it('should show Growth Pod dashboard even when registry is null', async () => {
    const ctx = createMockCtx('/growth');

    await handleGrowth(ctx, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Growth Pod');
  });
});
