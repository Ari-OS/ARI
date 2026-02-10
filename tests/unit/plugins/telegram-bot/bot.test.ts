import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import { createBot } from '../../../../src/plugins/telegram-bot/bot.js';

describe('createBot', () => {
  it('should throw when no bot token provided', () => {
    const eventBus = new EventBus();

    expect(() => createBot({
      eventBus,
      orchestrator: null,
      costTracker: null,
      registry: null,
      config: {
        botToken: undefined,
        allowedUserIds: [],
        rateLimit: { perChat: 1, global: 30 },
        features: { crypto: true, pokemon: true, tts: true, dev: false },
      },
    })).toThrow('Telegram bot token not configured');
  });

  it('should create bot when token is provided', () => {
    const eventBus = new EventBus();

    const bot = createBot({
      eventBus,
      orchestrator: null,
      costTracker: null,
      registry: null,
      config: {
        botToken: 'test:token123',
        allowedUserIds: [],
        rateLimit: { perChat: 1, global: 30 },
        features: { crypto: true, pokemon: true, tts: true, dev: false },
      },
    });

    expect(bot).toBeDefined();
  });
});
