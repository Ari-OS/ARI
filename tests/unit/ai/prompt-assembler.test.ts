import { describe, it, expect, beforeEach } from 'vitest';
import { PromptAssembler } from '../../../src/ai/prompt-assembler.js';
import type { AIRequest } from '../../../src/ai/types.js';

describe('PromptAssembler', () => {
  let assembler: PromptAssembler;

  const makeRequest = (overrides?: Partial<AIRequest>): AIRequest => ({
    content: 'Hello world',
    category: 'query',
    agent: 'core',
    trustLevel: 'system',
    priority: 'STANDARD',
    enableCaching: true,
    securitySensitive: false,
    ...overrides,
  });

  describe('with caching enabled', () => {
    beforeEach(() => {
      assembler = new PromptAssembler(true);
    });

    it('should include cache_control on core system block', () => {
      const result = assembler.assemble(makeRequest());
      expect(result.system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should include ARI system prompt', () => {
      const result = assembler.assemble(makeRequest());
      expect(result.system[0].text).toContain('ARI');
      expect(result.system[0].type).toBe('text');
    });

    it('should add custom system prompt as second block', () => {
      const result = assembler.assemble(makeRequest({
        systemPrompt: 'A'.repeat(300), // >200 chars to trigger caching
      }));
      expect(result.system).toHaveLength(2);
      expect(result.system[1].text).toContain('A');
      expect(result.system[1].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should not cache short custom prompts', () => {
      const result = assembler.assemble(makeRequest({
        systemPrompt: 'Be brief.',
      }));
      expect(result.system).toHaveLength(2);
      expect(result.system[1].cache_control).toBeUndefined();
    });

    it('should add agent context block', () => {
      const result = assembler.assemble(makeRequest({ agent: 'guardian' }));
      const agentBlock = result.system.find(b => b.text.includes('guardian'));
      expect(agentBlock).toBeDefined();
      expect(agentBlock?.text).toContain('Trust level');
    });

    it('should not add agent block for core', () => {
      const result = assembler.assemble(makeRequest({ agent: 'core' }));
      // Only the core system block (no agent block for 'core')
      expect(result.system).toHaveLength(1);
    });
  });

  describe('with caching disabled', () => {
    beforeEach(() => {
      assembler = new PromptAssembler(false);
    });

    it('should not include cache_control', () => {
      const result = assembler.assemble(makeRequest());
      expect(result.system[0].cache_control).toBeUndefined();
    });
  });

  describe('messages', () => {
    beforeEach(() => {
      assembler = new PromptAssembler(true);
    });

    it('should wrap content as single user message', () => {
      const result = assembler.assemble(makeRequest({ content: 'Hello' }));
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello');
    });

    it('should use explicit messages if provided', () => {
      const messages = [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' },
        { role: 'user' as const, content: 'How are you?' },
      ];
      const result = assembler.assemble(makeRequest({ messages }));
      expect(result.messages).toHaveLength(3);
      expect(result.messages[2].content).toBe('How are you?');
    });
  });

  describe('maxTokens', () => {
    beforeEach(() => {
      assembler = new PromptAssembler(true);
    });

    it('should use category defaults', () => {
      expect(assembler.assemble(makeRequest({ category: 'heartbeat' })).maxTokens).toBe(50);
      expect(assembler.assemble(makeRequest({ category: 'summarize' })).maxTokens).toBe(200);
      expect(assembler.assemble(makeRequest({ category: 'query' })).maxTokens).toBe(1024);
      expect(assembler.assemble(makeRequest({ category: 'code_generation' })).maxTokens).toBe(4096);
      expect(assembler.assemble(makeRequest({ category: 'planning' })).maxTokens).toBe(4096);
    });

    it('should allow override via request', () => {
      const result = assembler.assemble(makeRequest({ maxTokens: 500 }));
      expect(result.maxTokens).toBe(500);
    });
  });
});
