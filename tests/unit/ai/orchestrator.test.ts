import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { AIOrchestrator } from '../../../src/ai/orchestrator.js';
import { ProviderRegistry } from '../../../src/ai/provider-registry.js';
import { ModelRegistry } from '../../../src/ai/model-registry.js';
import type { AIRequest, AIResponse } from '../../../src/ai/types.js';
import type { LLMCompletionResponse } from '../../../src/ai/providers/types.js';

describe('AIOrchestrator', () => {
  let eventBus: EventBus;
  let orchestrator: AIOrchestrator;
  let mockProviderRegistry: ProviderRegistry;
  let mockCompleteWithFallback: ReturnType<typeof vi.fn>;

  const makeRequest = (overrides?: Partial<AIRequest>): AIRequest => ({
    content: 'Test request',
    category: 'query',
    agent: 'core',
    trustLevel: 'system',
    priority: 'STANDARD',
    enableCaching: true,
    securitySensitive: false,
    ...overrides,
  });

  const makeMockResponse = (overrides?: Partial<LLMCompletionResponse>): LLMCompletionResponse => ({
    content: 'Mock response content',
    model: 'claude-haiku-3',
    provider: 'anthropic',
    inputTokens: 100,
    outputTokens: 50,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    durationMs: 100,
    cost: 0.001,
    finishReason: 'stop',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();

    // Create mock ProviderRegistry with mocked completeWithFallback
    const modelRegistry = new ModelRegistry();
    mockProviderRegistry = new ProviderRegistry(eventBus, modelRegistry);
    mockCompleteWithFallback = vi.fn().mockResolvedValue(makeMockResponse());
    mockProviderRegistry.completeWithFallback = mockCompleteWithFallback;

    // Also mock testAllProviders for testConnection
    mockProviderRegistry.testAllProviders = vi.fn().mockResolvedValue(
      new Map([['anthropic', { connected: true, latencyMs: 50 }]])
    );

    orchestrator = new AIOrchestrator(eventBus, {
      providerRegistry: mockProviderRegistry,
    });
  });

  describe('constructor', () => {
    it('should initialize without apiKey (uses providerRegistry)', () => {
      expect(() => new AIOrchestrator(eventBus, {}))
        .not.toThrow();
    });

    it('should accept providerRegistry', () => {
      const modelRegistry = new ModelRegistry();
      const registry = new ProviderRegistry(eventBus, modelRegistry);
      expect(() => new AIOrchestrator(eventBus, { providerRegistry: registry }))
        .not.toThrow();
    });
  });

  describe('execute — basic pipeline', () => {
    it('should return a valid AIResponse', async () => {
      const response = await orchestrator.execute(makeRequest());
      expect(response.requestId).toBeDefined();
      expect(response.content).toBe('Mock response content');
      expect(response.model).toBeDefined();
      expect(response.inputTokens).toBe(100);
      expect(response.outputTokens).toBe(50);
      expect(response.cost).toBeGreaterThan(0);
      expect(response.duration).toBeGreaterThanOrEqual(0);
      expect(response.qualityScore).toBeGreaterThan(0);
      expect(response.escalated).toBe(false);
    });

    it('should validate the request', async () => {
      await expect(orchestrator.execute({
        ...makeRequest(),
        content: '',
      })).rejects.toThrow();
    });
  });

  describe('execute — event emission', () => {
    it('should emit ai:request_received', async () => {
      const events: unknown[] = [];
      eventBus.on('ai:request_received', (data) => events.push(data));

      await orchestrator.execute(makeRequest());
      expect(events).toHaveLength(1);
      expect((events[0] as Record<string, unknown>).category).toBe('query');
    });

    it('should emit ai:model_selected', async () => {
      const events: unknown[] = [];
      eventBus.on('ai:model_selected', (data) => events.push(data));

      await orchestrator.execute(makeRequest());
      expect(events).toHaveLength(1);
      const event = events[0] as Record<string, unknown>;
      expect(event.model).toBeDefined();
      expect(event.valueScore).toBeGreaterThanOrEqual(0);
    });

    it('should emit llm:request_complete — THE CRITICAL FIX', async () => {
      const events: unknown[] = [];
      eventBus.on('llm:request_complete', (data) => events.push(data));

      await orchestrator.execute(makeRequest());
      expect(events).toHaveLength(1);
      const event = events[0] as Record<string, unknown>;
      expect(event.model).toBeDefined();
      expect(event.inputTokens).toBe(100);
      expect(event.outputTokens).toBe(50);
      expect(event.cost).toBeGreaterThan(0);
      expect(event.success).toBe(true);
      expect(event.timestamp).toBeDefined();
    });

    it('should emit ai:response_evaluated', async () => {
      const events: unknown[] = [];
      eventBus.on('ai:response_evaluated', (data) => events.push(data));

      await orchestrator.execute(makeRequest());
      expect(events).toHaveLength(1);
      const event = events[0] as Record<string, unknown>;
      expect(event.qualityScore).toBeGreaterThan(0);
      expect(event.escalated).toBe(false);
    });

    it('should emit llm:request_start', async () => {
      const events: unknown[] = [];
      eventBus.on('llm:request_start', (data) => events.push(data));

      await orchestrator.execute(makeRequest());
      expect(events).toHaveLength(1);
    });
  });

  describe('execute — model routing', () => {
    it('should route heartbeat to cheapest model', async () => {
      const response = await orchestrator.execute(makeRequest({
        category: 'heartbeat',
        content: 'ping',
      }));
      expect(response.model).toBe('claude-haiku-3');
    });
  });

  describe('execute — circuit breaker', () => {
    it('should throw when circuit breaker is open', async () => {
      // Force circuit breaker open by triggering failures
      mockCompleteWithFallback.mockRejectedValue(new Error('API error'));

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        await orchestrator.execute(makeRequest()).catch(() => {});
      }

      // Next call should fail with circuit breaker error
      await expect(orchestrator.execute(makeRequest()))
        .rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  describe('convenience methods', () => {
    it('query should return string content', async () => {
      const result = await orchestrator.query('What is 2+2?');
      expect(typeof result).toBe('string');
      expect(result).toBe('Mock response content');
    });

    it('chat should handle multi-turn messages', async () => {
      const result = await orchestrator.chat([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'How are you?' },
      ]);
      expect(typeof result).toBe('string');
    });

    it('summarize should return short text', async () => {
      const longText = 'A'.repeat(500);
      const result = await orchestrator.summarize(longText, 200);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('summarize should return text as-is if short', async () => {
      const result = await orchestrator.summarize('short text', 200);
      expect(result).toBe('short text');
    });

    it('parseCommand should return parsed JSON', async () => {
      // Mock returns non-JSON, so it should return the fallback
      const result = await orchestrator.parseCommand('open notes');
      expect(result.intent).toBe('unknown');
      expect(result.raw).toBe('open notes');
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = orchestrator.getStatus();
      expect(status.enabled).toBe(false); // Default feature flag
      expect(status.circuitBreakerState).toBe('CLOSED');
      expect(status.totalRequests).toBe(0);
      expect(status.totalErrors).toBe(0);
      expect(status.totalCost).toBe(0);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should track metrics after requests', async () => {
      await orchestrator.execute(makeRequest());
      const status = orchestrator.getStatus();
      expect(status.totalRequests).toBe(1);
      expect(status.totalCost).toBeGreaterThan(0);
      expect(status.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRegistry', () => {
    it('should expose the model registry', () => {
      const reg = orchestrator.getRegistry();
      expect(reg).toBeDefined();
      const models = reg.listModels();
      expect(models.length).toBe(22);
    });
  });

  describe('error handling', () => {
    it('should emit failed llm:request_complete on API error', async () => {
      mockCompleteWithFallback.mockRejectedValue(new Error('API error'));

      const events: unknown[] = [];
      eventBus.on('llm:request_complete', (data) => events.push(data));

      await orchestrator.execute(makeRequest()).catch(() => {});
      expect(events).toHaveLength(1);
      expect((events[0] as Record<string, unknown>).success).toBe(false);
    });
  });

  describe('ModelExecutionPolicy', () => {
    it('should downgrade model when input tokens exceed maxInputTokens', async () => {
      const downgrades: unknown[] = [];
      eventBus.on('ai:policy_downgrade', (data) => downgrades.push(data));

      // A request with very long content that exceeds a tight token cap
      const longContent = 'a'.repeat(10000); // ~2500 tokens

      await orchestrator.execute(makeRequest({
        content: longContent,
        executionPolicy: {
          taskType: 'background',
          maxInputTokens: 100,   // very low cap to force downgrade
          costCapUsd: 1.0,
          fallbackModel: 'claude-haiku-3',
        },
      }));

      expect(downgrades).toHaveLength(1);
      const downgrade = downgrades[0] as Record<string, unknown>;
      expect(downgrade.reason).toBe('token_cap_exceeded');
      expect(downgrade.fallbackModel).toBe('claude-haiku-3');
      expect(downgrade.taskType).toBe('background');
    });

    it('should not downgrade when within policy limits', async () => {
      const downgrades: unknown[] = [];
      eventBus.on('ai:policy_downgrade', (data) => downgrades.push(data));

      await orchestrator.execute(makeRequest({
        content: 'Short request',
        executionPolicy: {
          taskType: 'interactive',
          maxInputTokens: 10000,   // generous cap
          costCapUsd: 10.0,        // generous budget
          fallbackModel: 'claude-haiku-3',
        },
      }));

      // Should succeed without downgrade
      expect(downgrades).toHaveLength(0);
    });

    it('should still return a valid response when policy downgrade occurs', async () => {
      const longContent = 'b'.repeat(10000);

      const response = await orchestrator.execute(makeRequest({
        content: longContent,
        executionPolicy: {
          taskType: 'background',
          maxInputTokens: 10,
          costCapUsd: 0.001,
          fallbackModel: 'claude-haiku-3',
        },
      }));

      expect(response.content).toBeDefined();
      expect(response.requestId).toBeDefined();
    });

    it('should work without executionPolicy (backwards compat)', async () => {
      const response = await orchestrator.execute(makeRequest());
      expect(response.content).toBeDefined();
    });
  });
});
