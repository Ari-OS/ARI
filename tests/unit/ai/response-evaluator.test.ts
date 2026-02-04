import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseEvaluator } from '../../../src/ai/response-evaluator.js';
import type { AIRequest, AIResponse } from '../../../src/ai/types.js';

describe('ResponseEvaluator', () => {
  let evaluator: ResponseEvaluator;

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

  const makeResponse = (overrides?: Partial<AIResponse>): AIResponse => ({
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    content: 'This is a valid response with enough content to pass length checks.',
    model: 'claude-sonnet-4',
    inputTokens: 100,
    outputTokens: 50,
    cost: 0.001,
    duration: 500,
    cached: false,
    qualityScore: 1.0,
    escalated: false,
    ...overrides,
  });

  beforeEach(() => {
    evaluator = new ResponseEvaluator();
  });

  describe('evaluate — quality scoring', () => {
    it('should score good response at 1.0', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse(),
        'trivial',
      );
      expect(result.qualityScore).toBe(1.0);
      expect(result.shouldEscalate).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should penalize uncertainty phrases', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: "I'm not sure about this, but maybe it works" }),
        'standard',
      );
      expect(result.qualityScore).toBeLessThan(1.0);
      expect(result.reasons).toContain('Response contains uncertainty phrases');
    });

    it('should cap uncertainty penalty at 0.30', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({
          content: "I'm not sure, I don't know, it's possible, maybe, perhaps this might be right",
        }),
        'standard',
      );
      // Even with many phrases, penalty caps at 0.30
      expect(result.qualityScore).toBeGreaterThanOrEqual(0.5);
    });

    it('should penalize empty responses', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: '' }),
        'standard',
      );
      expect(result.qualityScore).toBeLessThanOrEqual(0.5);
      expect(result.reasons).toContain('Response is empty');
    });

    it('should penalize error responses', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: 'Error: something went wrong' }),
        'standard',
      );
      expect(result.qualityScore).toBeLessThan(1.0);
      expect(result.reasons).toContain('Response indicates an error');
    });

    it('should penalize short responses for complex tasks', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: 'Yes.' }),
        'complex',
      );
      expect(result.qualityScore).toBeLessThan(1.0);
      expect(result.reasons.some(r => r.includes('too short'))).toBe(true);
    });

    it('should penalize code tasks without code blocks', () => {
      const result = evaluator.evaluate(
        makeRequest({ category: 'code_generation' }),
        makeResponse({ content: 'You should create a function that does the thing.' }),
        'standard',
      );
      expect(result.qualityScore).toBeLessThan(1.0);
      expect(result.reasons).toContain('Code task response missing code blocks');
    });

    it('should not penalize code tasks with code blocks', () => {
      const result = evaluator.evaluate(
        makeRequest({ category: 'code_generation' }),
        makeResponse({ content: 'Here is the code:\n```typescript\nconst x = 1;\n```' }),
        'standard',
      );
      expect(result.reasons).not.toContain('Code task response missing code blocks');
    });
  });

  describe('evaluate — escalation', () => {
    it('should escalate low quality complex tasks', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: "I'm not sure, maybe this could work, I don't know..." }),
        'complex',
      );
      expect(result.shouldEscalate).toBe(true);
    });

    it('should not escalate trivial tasks even with low quality', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: '' }),
        'trivial',
      );
      expect(result.shouldEscalate).toBe(false);
    });

    it('should not escalate already-escalated responses', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({
          content: "I'm not sure about this.",
          escalated: true,
        }),
        'complex',
      );
      expect(result.shouldEscalate).toBe(false);
    });

    it('should not escalate simple tasks', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse({ content: '' }),
        'simple',
      );
      expect(result.shouldEscalate).toBe(false);
    });
  });

  describe('evaluate — quality score bounds', () => {
    it('should clamp score to minimum 0', () => {
      const result = evaluator.evaluate(
        makeRequest({ category: 'code_generation' }),
        makeResponse({ content: '' }),
        'critical',
      );
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should clamp score to maximum 1', () => {
      const result = evaluator.evaluate(
        makeRequest(),
        makeResponse(),
        'trivial',
      );
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });
  });
});
