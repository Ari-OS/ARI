import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { ModelRegistry } from '../../../src/ai/model-registry.js';
import { ProviderRegistry } from '../../../src/ai/provider-registry.js';
import type { LLMProvider, LLMProviderConfig, LLMCompletionResponse } from '../../../src/ai/providers/types.js';

// Mock provider for testing
function createMockProvider(id: 'anthropic' | 'openai' | 'google' | 'xai', models: string[]): LLMProvider {
  return {
    id,
    name: `Mock ${id}`,
    initialize: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({
      content: 'test response',
      model: models[0],
      provider: id,
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      durationMs: 100,
      cost: 0,
      finishReason: 'stop',
    } as LLMCompletionResponse),
    testConnection: vi.fn().mockResolvedValue({ connected: true, latencyMs: 50 }),
    listModels: vi.fn().mockReturnValue(models),
    supportsModel: vi.fn().mockImplementation((model: string) => models.includes(model)),
    supportsCaching: vi.fn().mockReturnValue(true),
    getHealthStatus: vi.fn().mockReturnValue({
      providerId: id,
      status: 'healthy',
      lastCheckAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      latencyMs: 50,
      consecutiveFailures: 0,
      circuitBreakerState: 'CLOSED',
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ProviderRegistry', () => {
  let eventBus: EventBus;
  let modelRegistry: ModelRegistry;
  let registry: ProviderRegistry;

  beforeEach(() => {
    eventBus = new EventBus();
    modelRegistry = new ModelRegistry();
    registry = new ProviderRegistry(eventBus, modelRegistry);
  });

  describe('registerProvider', () => {
    it('should register a provider and emit connected event', async () => {
      const connectedSpy = vi.fn();
      eventBus.on('provider:connected', connectedSpy);

      await registry.registerProvider({
        id: 'anthropic',
        apiKey: 'test-key-1234567890',
        enabled: true,
        maxRetries: 3,
        timeoutMs: 60000,
        priority: 10,
      });

      expect(registry.isProviderRegistered('anthropic')).toBe(true);
      expect(connectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'anthropic' }),
      );
    });

    it('should list active providers', async () => {
      await registry.registerProvider({
        id: 'anthropic',
        apiKey: 'test-key-1234567890',
        enabled: true,
        maxRetries: 3,
        timeoutMs: 60000,
        priority: 10,
      });

      const active = registry.getActiveProviders();
      expect(active).toContain('anthropic');
    });
  });

  describe('getProviderForModel', () => {
    it('should find provider for registered model', async () => {
      await registry.registerProvider({
        id: 'anthropic',
        apiKey: 'test-key-1234567890',
        enabled: true,
        maxRetries: 3,
        timeoutMs: 60000,
        priority: 10,
      });

      const provider = registry.getProviderForModel('claude-opus-4.6');
      expect(provider).toBeDefined();
      expect(provider.id).toBe('anthropic');
    });

    it('should throw for unknown model with no providers', () => {
      expect(() => registry.getProviderForModel('nonexistent-model')).toThrow(
        'No provider available for model',
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return null for unregistered provider', () => {
      expect(registry.getHealthStatus('openai')).toBeNull();
    });

    it('should return health status for registered provider', async () => {
      await registry.registerProvider({
        id: 'anthropic',
        apiKey: 'test-key-1234567890',
        enabled: true,
        maxRetries: 3,
        timeoutMs: 60000,
        priority: 10,
      });

      const health = registry.getHealthStatus('anthropic');
      expect(health).toBeDefined();
      expect(health?.providerId).toBe('anthropic');
    });
  });

  describe('shutdownAll', () => {
    it('should shutdown all providers and emit disconnected events', async () => {
      const disconnectedSpy = vi.fn();
      eventBus.on('provider:disconnected', disconnectedSpy);

      await registry.registerProvider({
        id: 'anthropic',
        apiKey: 'test-key-1234567890',
        enabled: true,
        maxRetries: 3,
        timeoutMs: 60000,
        priority: 10,
      });

      await registry.shutdownAll();

      expect(registry.getActiveProviders()).toHaveLength(0);
      expect(disconnectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'anthropic', reason: 'shutdown' }),
      );
    });
  });
});
