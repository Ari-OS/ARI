import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { ModelRegistry } from '../../../src/ai/model-registry.js';
import { CascadeRouter } from '../../../src/ai/cascade-router.js';
import type { ProviderRegistry } from '../../../src/ai/provider-registry.js';
import type { LLMCompletionResponse } from '../../../src/ai/providers/types.js';

function createMockProviderRegistry(responses: Map<string, LLMCompletionResponse | Error>): ProviderRegistry {
  return {
    complete: vi.fn().mockImplementation(async (request: { model: string }) => {
      const response = responses.get(request.model);
      if (response instanceof Error) throw response;
      if (!response) throw new Error(`No mock for model: ${request.model}`);
      return response;
    }),
    completeWithFallback: vi.fn(),
    getProviderForModel: vi.fn().mockImplementation((model: string) => {
      if (responses.has(model)) return { id: 'anthropic' };
      throw new Error(`No provider for model: ${model}`);
    }),
    registerProvider: vi.fn(),
    registerFromEnv: vi.fn(),
    getHealthStatus: vi.fn(),
    testAllProviders: vi.fn(),
    getActiveProviders: vi.fn().mockReturnValue([]),
    getProvider: vi.fn(),
    isProviderRegistered: vi.fn(),
    shutdownAll: vi.fn(),
  } as unknown as ProviderRegistry;
}

function mockResponse(model: string, content: string, cost: number): LLMCompletionResponse {
  return {
    content,
    model,
    provider: 'anthropic',
    inputTokens: 100,
    outputTokens: 50,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    durationMs: 100,
    cost,
    finishReason: 'stop',
  };
}

describe('CascadeRouter', () => {
  let eventBus: EventBus;
  let modelRegistry: ModelRegistry;

  beforeEach(() => {
    eventBus = new EventBus();
    modelRegistry = new ModelRegistry();
  });

  describe('execute', () => {
    it('should stop at first model when quality is high enough', async () => {
      const responses = new Map([
        ['gemini-2.5-flash-lite', mockResponse('gemini-2.5-flash-lite', 'Here is a detailed answer with step 1, step 2, and step 3 for your question about the topic.', 0.001)],
      ]);

      const providers = createMockProviderRegistry(responses);
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      const completeSpy = vi.fn();
      eventBus.on('cascade:complete', completeSpy);

      const result = await router.execute(
        {
          messages: [{ role: 'user', content: 'What is TypeScript?' }],
          maxTokens: 1000,
          cachingEnabled: true,
          responseFormat: 'text',
        },
        'frugal',
      );

      expect(result.content).toContain('detailed answer');
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: 'frugal',
          finalModel: 'gemini-2.5-flash-lite',
          totalSteps: 1,
        }),
      );
    });

    it('should escalate when quality is too low', async () => {
      const responses = new Map([
        ['gemini-2.5-flash-lite', mockResponse('gemini-2.5-flash-lite', 'I am not sure.', 0.001)],
        ['claude-haiku-4.5', mockResponse('claude-haiku-4.5', 'Here is a comprehensive answer with all the details you need about TypeScript.', 0.01)],
      ]);

      const providers = createMockProviderRegistry(responses);
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      const stepSpy = vi.fn();
      eventBus.on('cascade:step_complete', stepSpy);

      const result = await router.execute(
        {
          messages: [{ role: 'user', content: 'What is TypeScript?' }],
          maxTokens: 1000,
          cachingEnabled: true,
          responseFormat: 'text',
        },
        'frugal',
      );

      // First step should have escalated (low quality "I am not sure")
      expect(stepSpy).toHaveBeenCalledWith(
        expect.objectContaining({ step: 0, escalated: true }),
      );
      // Final result should be from the second model
      expect(result.model).toBe('claude-haiku-4.5');
    });

    it('should always accept last model in chain', async () => {
      // Both models give low-quality uncertain answers
      // The first will escalate (below 0.5 threshold), last always accepts
      const responses = new Map([
        ['claude-sonnet-4.5', mockResponse('claude-sonnet-4.5', 'I\'m not sure, I don\'t know, unclear', 0.05)],
        ['claude-opus-4.6', mockResponse('claude-opus-4.6', 'also uncertain and I cannot determine', 0.1)],
      ]);

      const providers = createMockProviderRegistry(responses);
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      const result = await router.execute(
        {
          messages: [{ role: 'user', content: 'This is a very complex question that requires a detailed and thorough answer about advanced topics in distributed computing.' }],
          maxTokens: 1000,
          cachingEnabled: true,
          responseFormat: 'text',
        },
        'quality',
      );

      // Last model always accepted regardless of quality
      expect(result.model).toBe('claude-opus-4.6');
    });

    it('should throw for unknown chain', async () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      await expect(
        router.execute(
          {
            messages: [{ role: 'user', content: 'test' }],
            maxTokens: 100,
            cachingEnabled: true,
            responseFormat: 'text',
          },
          'nonexistent',
        ),
      ).rejects.toThrow('Unknown cascade chain');
    });

    it('should skip unavailable models and try next', async () => {
      const responses = new Map([
        // gemini-2.5-flash-lite NOT available (not in map)
        ['claude-haiku-4.5', mockResponse('claude-haiku-4.5', 'Here is a good answer.', 0.01)],
      ]);

      const providers = createMockProviderRegistry(responses);
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      const result = await router.execute(
        {
          messages: [{ role: 'user', content: 'test' }],
          maxTokens: 100,
          cachingEnabled: true,
          responseFormat: 'text',
        },
        'frugal',
      );

      expect(result.model).toBe('claude-haiku-4.5');
    });
  });

  describe('selectChain', () => {
    it('should select security chain for security-sensitive tasks', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      expect(router.selectChain('chat', true, 'simple')).toBe('security');
    });

    it('should select code chain for code tasks', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      expect(router.selectChain('code_generation', false, 'standard')).toBe('code');
    });

    it('should select quality chain for critical complexity', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      expect(router.selectChain('chat', false, 'critical')).toBe('quality');
    });

    it('should default to frugal chain', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      expect(router.selectChain('chat', false, 'simple')).toBe('frugal');
    });
  });

  describe('chain management', () => {
    it('should list all default chains', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      const chains = router.listChains();
      expect(chains.length).toBeGreaterThanOrEqual(7);
      expect(chains.map(c => c.id)).toContain('frugal');
      expect(chains.map(c => c.id)).toContain('security');
    });

    it('should allow registering custom chains', () => {
      const providers = createMockProviderRegistry(new Map());
      const router = new CascadeRouter(eventBus, providers, modelRegistry);

      router.registerChain({
        id: 'custom',
        name: 'Custom Chain',
        steps: [
          { model: 'claude-haiku-4.5', threshold: 0.5 },
          { model: 'claude-opus-4.6', threshold: 0.0 },
        ],
      });

      expect(router.getChain('custom')).toBeDefined();
      expect(router.getChain('custom')?.name).toBe('Custom Chain');
    });
  });
});
