import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../../../src/ai/model-registry.js';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('getModel', () => {
    it('should return opus 4.6 with correct pricing', () => {
      const model = registry.getModel('claude-opus-4.6');
      expect(model.id).toBe('claude-opus-4.6');
      expect(model.quality).toBe(10);
      expect(model.speed).toBe(5);
      expect(model.costPer1MInput).toBe(5.0);
      expect(model.costPer1MOutput).toBe(25.0);
      expect(model.maxContextTokens).toBe(1_000_000);
      expect(model.isAvailable).toBe(true);
    });

    it('should return opus 4.5 with correct pricing', () => {
      const model = registry.getModel('claude-opus-4.5');
      expect(model.id).toBe('claude-opus-4.5');
      expect(model.quality).toBe(9);
      expect(model.speed).toBe(4);
      expect(model.costPer1MInput).toBe(5.0);
      expect(model.costPer1MOutput).toBe(25.0);
      expect(model.isAvailable).toBe(true);
    });

    it('should return sonnet 4.5 as available by default', () => {
      const model = registry.getModel('claude-sonnet-4.5');
      expect(model.id).toBe('claude-sonnet-4.5');
      expect(model.isAvailable).toBe(true);
    });

    it('should return sonnet 4 with correct specs', () => {
      const model = registry.getModel('claude-sonnet-4');
      expect(model.quality).toBe(7);
      expect(model.speed).toBe(7);
      expect(model.costPer1MInput).toBe(3.0);
      expect(model.isAvailable).toBe(true);
    });

    it('should return haiku 4.5 with correct specs', () => {
      const model = registry.getModel('claude-haiku-4.5');
      expect(model.quality).toBe(6);
      expect(model.speed).toBe(10);
      expect(model.costPer1MInput).toBe(1.0);
    });

    it('should return haiku 3 as the cheapest model', () => {
      const model = registry.getModel('claude-haiku-3');
      expect(model.costPer1MInput).toBe(0.25);
      expect(model.costPer1MOutput).toBe(1.25);
    });

    it('should throw for unknown model', () => {
      expect(() => registry.getModel('gpt-4' as never)).toThrow();
    });
  });

  describe('listModels', () => {
    it('should list all 22 models', () => {
      const models = registry.listModels();
      expect(models).toHaveLength(22);
    });

    it('should filter available only', () => {
      const available = registry.listModels({ availableOnly: true });
      // Anthropic models (7) are available by default: opus-4.6, opus-4.5, sonnet-4.6, sonnet-4.5, sonnet-4, haiku-4.5, haiku-3.5
      expect(available).toHaveLength(7);
      expect(available.every(m => m.isAvailable)).toBe(true);
    });
  });

  describe('setAvailability', () => {
    it('should enable gpt-5.2', () => {
      registry.setAvailability('gpt-5.2', true);
      const model = registry.getModel('gpt-5.2');
      expect(model.isAvailable).toBe(true);
    });

    it('should disable a model', () => {
      registry.setAvailability('claude-opus-4.5', false);
      const model = registry.getModel('claude-opus-4.5');
      expect(model.isAvailable).toBe(false);
    });
  });

  describe('getCost', () => {
    it('should calculate cost for sonnet 4', () => {
      const cost = registry.getCost('claude-sonnet-4', 1000, 500);
      // Input: 1000/1M * $3.00 = $0.003
      // Output: 500/1M * $15.00 = $0.0075
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost for haiku 3', () => {
      const cost = registry.getCost('claude-haiku-3', 10000, 1000);
      // Input: 10000/1M * $0.25 = $0.0025
      // Output: 1000/1M * $1.25 = $0.00125
      expect(cost).toBeCloseTo(0.00375, 5);
    });

    it('should apply cache discount', () => {
      const normalCost = registry.getCost('claude-sonnet-4', 1000, 500);
      const cachedCost = registry.getCost('claude-sonnet-4', 1000, 500, 800);
      // Cached tokens reduce input cost
      expect(cachedCost).toBeLessThan(normalCost);
    });
  });

  describe('isAvailable', () => {
    it('should return true for available models', () => {
      expect(registry.isAvailable('claude-sonnet-4')).toBe(true);
      expect(registry.isAvailable('claude-haiku-3')).toBe(true);
    });

    it('should return false for unavailable models', () => {
      expect(registry.isAvailable('gpt-5.2')).toBe(false);
      expect(registry.isAvailable('gemini-2.5-pro')).toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on input tokens', () => {
      const estimate = registry.estimateCost('claude-haiku-3', 1000);
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('getCheapestAvailable', () => {
    it('should return haiku 3 as cheapest', () => {
      const cheapest = registry.getCheapestAvailable();
      expect(cheapest.id).toBe('claude-haiku-3');
    });
  });

  describe('getHighestQualityAvailable', () => {
    it('should return opus 4.6 as highest quality', () => {
      const best = registry.getHighestQualityAvailable();
      expect(best.id).toBe('claude-opus-4.6');
    });

    it('should return next best when opus disabled', () => {
      registry.setAvailability('claude-opus-4.6', false);
      registry.setAvailability('claude-opus-4.5', false);
      const best = registry.getHighestQualityAvailable();
      expect(best.id).toBe('claude-sonnet-4.6'); // quality 9, higher than sonnet-4.5 (8)
    });
  });
});
