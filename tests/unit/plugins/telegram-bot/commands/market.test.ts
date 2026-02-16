/**
 * Tests for /market Telegram command — market overview and prices
 */

import { describe, it, expect, vi } from 'vitest';
import { handleMarket } from '../../../../../src/plugins/telegram-bot/commands/market.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';
import type { PluginRegistry } from '../../../../../src/plugins/registry.js';

describe('/market command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleMarket>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  it('should show overview by default', async () => {
    const ctx = createMockCtx('/market');
    const eventBus = createMockEventBus();

    await handleMarket(ctx, eventBus, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Market Overview');
  });

  it('should show crypto prices when requested', async () => {
    const mockRegistry = {
      getPlugin: vi.fn().mockReturnValue({
        getStatus: () => 'active',
        getConfig: () => ({ defaultCoins: ['bitcoin'] }),
        getClient: () => ({
          getPrice: vi.fn().mockResolvedValue({
            bitcoin: { usd: 50000, usd_24h_change: 2.5 },
          }),
        }),
      }),
    } as unknown as PluginRegistry;

    const ctx = createMockCtx('/market crypto');
    const eventBus = createMockEventBus();

    await handleMarket(ctx, eventBus, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Crypto Prices');
  });

  it('should show stocks placeholder', async () => {
    const ctx = createMockCtx('/market stocks');
    const eventBus = createMockEventBus();

    await handleMarket(ctx, eventBus, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('coming soon');
  });

  it('should show alerts when requested', async () => {
    const mockRegistry = {
      getPlugin: vi.fn().mockReturnValue({
        getStatus: () => 'active',
        getPortfolio: () => ({
          getAllAlerts: vi.fn().mockReturnValue([]),
        }),
      }),
    } as unknown as PluginRegistry;

    const ctx = createMockCtx('/market alerts');
    const eventBus = createMockEventBus();

    await handleMarket(ctx, eventBus, mockRegistry);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Market Alerts');
  });

  it('should handle registry not available', async () => {
    const ctx = createMockCtx('/market crypto');
    const eventBus = createMockEventBus();

    await handleMarket(ctx, eventBus, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('not available');
  });
});
