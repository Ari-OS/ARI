import { describe, it, expect, vi } from 'vitest';
import { handleStatus } from '../../../../src/plugins/telegram-bot/commands/status.js';
import { handleBriefing } from '../../../../src/plugins/telegram-bot/commands/briefing.js';
import { handleDev } from '../../../../src/plugins/telegram-bot/commands/dev.js';

function mockCtx(text: string = '') {
  return {
    from: { id: 123 },
    chat: { id: 100 },
    message: { text },
    reply: vi.fn(),
    replyWithVoice: vi.fn(),
  } as never;
}

describe('Telegram Command Handlers', () => {
  describe('handleStatus', () => {
    it('should show status when registry available', async () => {
      const ctx = mockCtx('/status');
      const registry = {
        listPlugins: () => [
          { id: 'crypto', name: 'CoinGecko Crypto', status: 'active', capabilities: ['briefing'] },
          { id: 'tts', name: 'ElevenLabs TTS', status: 'active', capabilities: ['data'] },
        ],
      } as never;

      await handleStatus(ctx, registry);
      expect((ctx as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
        expect.stringContaining('ARI System Status'),
        expect.any(Object),
      );
    });

    it('should handle missing registry', async () => {
      const ctx = mockCtx('/status');
      await handleStatus(ctx, null);
      expect((ctx as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
        expect.stringContaining('not available'),
        expect.any(Object),
      );
    });
  });

  describe('handleBriefing', () => {
    it('should show briefing contributions', async () => {
      const ctx = mockCtx('/briefing');
      const registry = {
        collectBriefings: vi.fn().mockResolvedValue([
          { pluginId: 'crypto', section: 'Crypto', content: 'BTC: $50k', priority: 1, category: 'info' },
        ]),
      } as never;

      await handleBriefing(ctx, registry);
      expect((ctx as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
        expect.stringContaining('ARI Briefing'),
        expect.any(Object),
      );
    });

    it('should handle empty briefings', async () => {
      const ctx = mockCtx('/briefing');
      const registry = {
        collectBriefings: vi.fn().mockResolvedValue([]),
      } as never;

      await handleBriefing(ctx, registry);
      expect((ctx as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith('No briefing data available from plugins.');
    });
  });

  describe('handleDev', () => {
    it('should show Phase 8 placeholder', async () => {
      const ctx = mockCtx('/dev');
      await handleDev(ctx);
      expect((ctx as { reply: ReturnType<typeof vi.fn> }).reply).toHaveBeenCalledWith(
        expect.stringContaining('Phase 8'),
        expect.any(Object),
      );
    });
  });
});
