/**
 * Tests for /search Telegram command — Perplexity web search
 */

import { describe, it, expect, vi } from 'vitest';
import { handleSearch } from '../../../../../src/plugins/telegram-bot/commands/search.js';
import type { PerplexityClient } from '../../../../../src/integrations/perplexity/client.js';

describe('/search command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleSearch>[0];
  }

  it('should show help when no query provided', async () => {
    const ctx = createMockCtx('/search');
    await handleSearch(ctx, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Web Search');
    expect(reply).toContain('Usage');
  });

  it('should show error when client not configured', async () => {
    const ctx = createMockCtx('/search TypeScript best practices');
    await handleSearch(ctx, null);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('PERPLEXITY_API_KEY');
  });

  it('should perform search when query and client provided', async () => {
    const mockClient = {
      search: vi.fn().mockResolvedValue({
        answer: 'TypeScript is a typed superset of JavaScript.',
        citations: ['https://www.typescriptlang.org/'],
        model: 'llama-3.1-sonar-small-128k-online',
        usage: { promptTokens: 10, completionTokens: 20 },
      }),
    } as unknown as PerplexityClient;

    const ctx = createMockCtx('/search TypeScript best practices');
    await handleSearch(ctx, mockClient);

    expect(ctx.reply).toHaveBeenCalledTimes(2); // "Searching..." + result
    const searchingReply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(searchingReply).toContain('Searching');

    const resultReply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(resultReply).toContain('TypeScript is a typed superset');
    expect(resultReply).toContain('Sources');
  });

  it('should split long results into multiple messages', async () => {
    const longAnswer = 'x'.repeat(5000);
    const mockClient = {
      search: vi.fn().mockResolvedValue({
        answer: longAnswer,
        citations: [],
        model: 'llama-3.1-sonar-small-128k-online',
        usage: { promptTokens: 10, completionTokens: 20 },
      }),
    } as unknown as PerplexityClient;

    const ctx = createMockCtx('/search query');
    await handleSearch(ctx, mockClient);

    // Should be 3+ calls: "Searching..." + at least 2 result chunks
    const callCount = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(3);
    // Each chunk should be within Telegram limits
    for (let i = 1; i < callCount; i++) {
      const chunk = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[i][0] as string;
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it('should handle search errors', async () => {
    const mockClient = {
      search: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
    } as unknown as PerplexityClient;

    const ctx = createMockCtx('/search query');
    await handleSearch(ctx, mockClient);

    const errorReply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(errorReply).toContain('failed');
  });
});
