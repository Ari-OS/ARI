import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentRouter } from '../../../../src/plugins/telegram-bot/intent-router.js';
import type { Context } from 'grammy';
import type { EventBus } from '../../../../src/kernel/event-bus.js';
import type { AIOrchestrator } from '../../../../src/ai/orchestrator.js';

// Mock event bus
const createMockEventBus = (): EventBus => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  clear: vi.fn(),
  listenerCount: vi.fn(),
  getHandlerErrorCount: vi.fn(),
  setHandlerTimeout: vi.fn(),
});

// Mock orchestrator
const createMockOrchestrator = (response: string): AIOrchestrator => ({
  chat: vi.fn().mockResolvedValue(response),
  execute: vi.fn(),
  query: vi.fn(),
  summarize: vi.fn(),
  parseCommand: vi.fn(),
  getStatus: vi.fn(),
  testConnection: vi.fn(),
  shutdown: vi.fn(),
  getRegistry: vi.fn(),
  getProviderRegistry: vi.fn(),
  getCascadeRouter: vi.fn(),
});

// Mock context
const createMockContext = (text: string): Context => ({
  message: {
    text,
    message_id: 1,
    date: Date.now(),
    chat: { id: 123, type: 'private' },
  },
  reply: vi.fn().mockResolvedValue({}),
} as unknown as Context);

describe('IntentRouter', () => {
  let eventBus: EventBus;
  let router: IntentRouter;

  beforeEach(() => {
    eventBus = createMockEventBus();
    router = new IntentRouter(null, eventBus);
  });

  describe('registerRoute', () => {
    it('should register a route', () => {
      router.registerRoute({
        intent: 'test',
        patterns: [/hello/i],
        handler: vi.fn(),
        priority: 10,
      });

      expect(router.getRegisteredIntents()).toContain('test');
      expect(router.getRouteCount()).toBe(1);
    });

    it('should sort routes by priority descending', () => {
      router.registerRoute({
        intent: 'low',
        patterns: [/low/i],
        handler: vi.fn(),
        priority: 10,
      });

      router.registerRoute({
        intent: 'high',
        patterns: [/high/i],
        handler: vi.fn(),
        priority: 100,
      });

      router.registerRoute({
        intent: 'medium',
        patterns: [/medium/i],
        handler: vi.fn(),
        priority: 50,
      });

      const intents = router.getRegisteredIntents();
      expect(intents).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('fast path routing', () => {
    it('should match simple regex pattern', async () => {
      const handler = vi.fn();
      router.registerRoute({
        intent: 'greeting',
        patterns: [/hello/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('hello there');
      const result = await router.route(ctx);

      expect(result).toMatchObject({
        intent: 'greeting',
        confidence: 0.95,
        routedVia: 'fast_path',
      });
      expect(handler).toHaveBeenCalledWith(ctx, expect.any(Array), {});
      expect(eventBus.emit).toHaveBeenCalledWith('telegram:intent_routed', {
        intent: 'greeting',
        via: 'fast_path',
        timestamp: expect.any(String),
      });
    });

    it('should extract entities from regex groups', async () => {
      const handler = vi.fn();
      router.registerRoute({
        intent: 'crypto_price',
        patterns: [/price of (\w+)/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('What is the price of bitcoin?');
      await router.route(ctx);

      expect(handler).toHaveBeenCalled();
      const match = handler.mock.calls[0]?.[1] as RegExpMatchArray;
      expect(match[1]).toBe('bitcoin');
    });

    it('should try multiple patterns for the same intent', async () => {
      const handler = vi.fn();
      router.registerRoute({
        intent: 'crypto_price',
        patterns: [
          /price of (\w+)/i,
          /what'?s (\w+) trading at/i,
          /how much is (\w+)/i,
        ],
        handler,
        priority: 10,
      });

      const ctx1 = createMockContext('price of bitcoin');
      await router.route(ctx1);
      expect(handler).toHaveBeenCalledTimes(1);

      const ctx2 = createMockContext('what\'s ethereum trading at');
      await router.route(ctx2);
      expect(handler).toHaveBeenCalledTimes(2);

      const ctx3 = createMockContext('how much is dogecoin');
      await router.route(ctx3);
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should route to higher priority intent first', async () => {
      const lowHandler = vi.fn();
      const highHandler = vi.fn();

      router.registerRoute({
        intent: 'low',
        patterns: [/crypto/i],
        handler: lowHandler,
        priority: 10,
      });

      router.registerRoute({
        intent: 'high',
        patterns: [/crypto price/i],
        handler: highHandler,
        priority: 100,
      });

      const ctx = createMockContext('crypto price alert');
      await router.route(ctx);

      // Should match high priority first
      expect(highHandler).toHaveBeenCalledTimes(1);
      expect(lowHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe('AI classification fallback', () => {
    it('should use AI when no regex matches', async () => {
      const orchestrator = createMockOrchestrator(
        JSON.stringify({
          intent: 'status_check',
          confidence: 0.85,
          entities: {},
        }),
      );

      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      const handler = vi.fn();

      routerWithAI.registerRoute({
        intent: 'status_check',
        patterns: [/system status/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('How is everything running?');
      const result = await routerWithAI.route(ctx);

      expect(result).toMatchObject({
        intent: 'status_check',
        confidence: 0.85,
        routedVia: 'ai_classification',
      });
      expect(handler).toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith('telegram:intent_routed', {
        intent: 'status_check',
        via: 'ai_classification',
        confidence: 0.85,
        timestamp: expect.any(String),
      });
    });

    it('should reject low confidence AI classifications', async () => {
      const orchestrator = createMockOrchestrator(
        JSON.stringify({
          intent: 'status_check',
          confidence: 0.3, // Below clarification threshold (0.45) → uses default handler
          entities: {},
        }),
      );

      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      const handler = vi.fn();
      const defaultHandler = vi.fn();

      routerWithAI.registerRoute({
        intent: 'status_check',
        patterns: [/system status/i],
        handler,
        priority: 10,
      });

      routerWithAI.setDefaultHandler(defaultHandler);

      const ctx = createMockContext('How is everything running?');
      const result = await routerWithAI.route(ctx);

      expect(result).toBeNull();
      expect(handler).not.toHaveBeenCalled();
      expect(defaultHandler).toHaveBeenCalled();
    });

    it('should handle AI classification errors gracefully', async () => {
      const orchestrator = createMockOrchestrator('invalid json');
      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      const defaultHandler = vi.fn();

      routerWithAI.setDefaultHandler(defaultHandler);

      const ctx = createMockContext('random text');
      const result = await routerWithAI.route(ctx);

      expect(result).toBeNull();
      expect(defaultHandler).toHaveBeenCalled();
    });

    it('should extract entities from AI response', async () => {
      const orchestrator = createMockOrchestrator(
        JSON.stringify({
          intent: 'crypto_price',
          confidence: 0.95,
          entities: { coin: 'bitcoin', exchange: 'coinbase' },
        }),
      );

      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      const handler = vi.fn();

      routerWithAI.registerRoute({
        intent: 'crypto_price',
        patterns: [/price/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('Can you tell me about bitcoin on coinbase?');
      const result = await routerWithAI.route(ctx);

      expect(result?.extractedEntities).toEqual({
        coin: 'bitcoin',
        exchange: 'coinbase',
      });
      expect(handler).toHaveBeenCalledWith(
        ctx,
        null,
        { coin: 'bitcoin', exchange: 'coinbase' },
      );
    });
  });

  describe('default handler', () => {
    it('should call default handler when no intent matches', async () => {
      const defaultHandler = vi.fn();
      router.setDefaultHandler(defaultHandler);

      const ctx = createMockContext('random text with no pattern');
      await router.route(ctx);

      expect(defaultHandler).toHaveBeenCalledWith(ctx);
    });

    it('should not call default handler when intent matches', async () => {
      const handler = vi.fn();
      const defaultHandler = vi.fn();

      router.registerRoute({
        intent: 'greeting',
        patterns: [/hello/i],
        handler,
        priority: 10,
      });

      router.setDefaultHandler(defaultHandler);

      const ctx = createMockContext('hello world');
      await router.route(ctx);

      expect(handler).toHaveBeenCalled();
      expect(defaultHandler).not.toHaveBeenCalled();
    });
  });

  describe('routeText', () => {
    it('should route text without ctx.message.text', async () => {
      const handler = vi.fn();
      router.registerRoute({
        intent: 'greeting',
        patterns: [/hello/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('');
      const result = await router.routeText(ctx, 'hello from voice');

      expect(result).toMatchObject({
        intent: 'greeting',
        confidence: 0.95,
        routedVia: 'fast_path',
      });
      expect(handler).toHaveBeenCalled();
    });

    it('should use AI classification for routeText', async () => {
      const orchestrator = createMockOrchestrator(
        JSON.stringify({
          intent: 'status_check',
          confidence: 0.95,
          entities: {},
        }),
      );

      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      const handler = vi.fn();

      routerWithAI.registerRoute({
        intent: 'status_check',
        patterns: [/system status/i],
        handler,
        priority: 10,
      });

      const ctx = createMockContext('');
      const result = await routerWithAI.routeText(ctx, 'How are things?');

      expect(result).toMatchObject({
        intent: 'status_check',
        routedVia: 'ai_classification',
      });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should return null when message has no text', async () => {
      const ctx = { message: {} } as unknown as Context;
      const result = await router.route(ctx);
      expect(result).toBeNull();
    });

    it('should return null when no message at all', async () => {
      const ctx = {} as unknown as Context;
      const result = await router.route(ctx);
      expect(result).toBeNull();
    });

    it('should handle empty pattern list', async () => {
      const handler = vi.fn();
      const defaultHandler = vi.fn();

      router.registerRoute({
        intent: 'no_patterns',
        patterns: [],
        handler,
        priority: 10,
      });

      router.setDefaultHandler(defaultHandler);

      const ctx = createMockContext('hello');
      await router.route(ctx);

      expect(handler).not.toHaveBeenCalled();
      expect(defaultHandler).toHaveBeenCalled();
    });

    it('should truncate long text in AI prompt', async () => {
      const orchestrator = createMockOrchestrator(
        JSON.stringify({ intent: 'test', confidence: 0.8, entities: {} }),
      );

      const routerWithAI = new IntentRouter(orchestrator, eventBus);
      routerWithAI.registerRoute({
        intent: 'test',
        patterns: [],
        handler: vi.fn(),
        priority: 10,
      });

      const longText = 'a'.repeat(500);
      const ctx = createMockContext(longText);
      await routerWithAI.route(ctx);

      expect(orchestrator.chat).toHaveBeenCalled();
      const call = (orchestrator.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const prompt = call?.[0]?.[0]?.content as string;
      // Should truncate to 300 chars (new limit)
      expect(prompt).toContain('a'.repeat(300));
      expect(prompt).not.toContain('a'.repeat(400)); // 400+ chars should be truncated
    });
  });

  describe('getters', () => {
    it('should return registered intents', () => {
      router.registerRoute({
        intent: 'intent1',
        patterns: [/a/],
        handler: vi.fn(),
        priority: 10,
      });

      router.registerRoute({
        intent: 'intent2',
        patterns: [/b/],
        handler: vi.fn(),
        priority: 20,
      });

      const intents = router.getRegisteredIntents();
      expect(intents).toContain('intent1');
      expect(intents).toContain('intent2');
      expect(intents).toHaveLength(2);
    });

    it('should return route count', () => {
      expect(router.getRouteCount()).toBe(0);

      router.registerRoute({
        intent: 'test',
        patterns: [/test/],
        handler: vi.fn(),
        priority: 10,
      });

      expect(router.getRouteCount()).toBe(1);
    });
  });
});
