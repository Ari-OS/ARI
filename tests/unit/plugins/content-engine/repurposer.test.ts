// tests/unit/plugins/content-engine/repurposer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentRepurposer } from '../../../../src/plugins/content-engine/repurposer.js';
import type { AIOrchestrator } from '../../../../src/ai/orchestrator.js';
import type { ContentDraft } from '../../../../src/plugins/content-engine/types.js';

describe('ContentRepurposer', () => {
  let mockOrchestrator: AIOrchestrator;
  let repurposer: ContentRepurposer;

  beforeEach(() => {
    mockOrchestrator = {
      execute: vi.fn().mockResolvedValue({
        content: 'Repurposed content here',
        model: 'claude-sonnet-4.5',
        cost: 0.001,
      }),
    } as unknown as AIOrchestrator;

    repurposer = new ContentRepurposer(mockOrchestrator);
  });

  it('should repurpose x_thread to linkedin', async () => {
    const draft: ContentDraft = {
      id: 'draft-001',
      topicBrief: {
        headline: 'AI automation for small business',
        keyPoints: ['Saves time', 'Reduces errors', 'Scales easily'],
        angle: 'Practical implementation',
        targetPlatform: 'x_thread',
        sourceItemIds: ['item-1'],
        threadabilityScore: 85,
      },
      platform: 'x_thread',
      content: ['Hook tweet', 'Body tweet 1', 'Body tweet 2'],
      status: 'published',
      createdAt: '2026-02-16T10:00:00Z',
    };

    const result = await repurposer.repurpose(draft, 'linkedin');

    expect(result.platform).toBe('linkedin');
    expect(result.status).toBe('pending');
    expect(result.metadata.repurposedFrom).toBe('draft-001');
    expect(result.metadata.originalPlatform).toBe('x_thread');
    expect(mockOrchestrator.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'analysis',
        agent: 'autonomous',
      })
    );
  });

  it('should repurpose linkedin to x_thread', async () => {
    mockOrchestrator.execute = vi.fn().mockResolvedValue({
      content: 'Tweet 1\n---\nTweet 2\n---\nTweet 3',
      model: 'claude-sonnet-4.5',
      cost: 0.002,
    });

    const draft: ContentDraft = {
      id: 'draft-002',
      topicBrief: {
        headline: 'Long-form LinkedIn post',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
        angle: 'Professional perspective',
        targetPlatform: 'linkedin',
        sourceItemIds: ['item-2'],
        threadabilityScore: 70,
      },
      platform: 'linkedin',
      content: ['This is a long LinkedIn post with multiple paragraphs...'],
      status: 'published',
      createdAt: '2026-02-16T11:00:00Z',
    };

    const result = await repurposer.repurpose(draft, 'x_thread');

    expect(result.platform).toBe('x_thread');
    expect(result.content.length).toBeGreaterThan(1);
    expect(result.content).toEqual(['Tweet 1', 'Tweet 2', 'Tweet 3']);
  });

  it('should repurpose any content to quick_take', async () => {
    mockOrchestrator.execute = vi.fn().mockResolvedValue({
      content: 'AI automation saves 10+ hours/week for small businesses. Start with one repetitive task.',
      model: 'claude-haiku-4.5',
      cost: 0.0005,
    });

    const draft: ContentDraft = {
      id: 'draft-003',
      topicBrief: {
        headline: 'AI automation benefits',
        keyPoints: ['Time savings', 'Cost reduction'],
        angle: 'Quick insight',
        targetPlatform: 'blog_outline',
        sourceItemIds: ['item-3'],
        threadabilityScore: 50,
      },
      platform: 'blog_outline',
      content: ['Full blog outline with multiple sections...'],
      status: 'approved',
      createdAt: '2026-02-16T12:00:00Z',
    };

    const result = await repurposer.repurpose(draft, 'quick_take');

    expect(result.platform).toBe('quick_take');
    expect(result.content.length).toBe(1);
    expect(result.content[0].length).toBeLessThanOrEqual(280);
  });

  it('should include model cost in repurposed draft', async () => {
    mockOrchestrator.execute = vi.fn().mockResolvedValue({
      content: 'Repurposed content',
      model: 'claude-opus-4.6',
      cost: 0.005,
    });

    const draft: ContentDraft = {
      id: 'draft-004',
      topicBrief: {
        headline: 'Test topic',
        keyPoints: ['Key point'],
        angle: 'Test angle',
        targetPlatform: 'x_single',
        sourceItemIds: ['item-4'],
        threadabilityScore: 60,
      },
      platform: 'x_single',
      content: ['Original tweet'],
      status: 'published',
      createdAt: '2026-02-16T13:00:00Z',
    };

    const result = await repurposer.repurpose(draft, 'linkedin');

    expect(result.modelUsed).toBe('claude-opus-4.6');
    expect(result.costUsd).toBe(0.005);
  });

  it('should enforce platform constraints on output', async () => {
    mockOrchestrator.execute = vi.fn().mockResolvedValue({
      content: 'Tweet 1\n---\nTweet 2\n---\nTweet 3\n---\nTweet 4\n---\nTweet 5\n---\nTweet 6\n---\nTweet 7\n---\nTweet 8\n---\nTweet 9',
      model: 'claude-sonnet-4.5',
      cost: 0.002,
    });

    const draft: ContentDraft = {
      id: 'draft-005',
      topicBrief: {
        headline: 'Long content',
        keyPoints: ['Many points'],
        angle: 'Comprehensive',
        targetPlatform: 'blog_outline',
        sourceItemIds: ['item-5'],
        threadabilityScore: 90,
      },
      platform: 'blog_outline',
      content: ['Very long blog content...'],
      status: 'published',
      createdAt: '2026-02-16T14:00:00Z',
    };

    const result = await repurposer.repurpose(draft, 'x_thread');

    // x_thread max is 8 parts
    expect(result.content.length).toBeLessThanOrEqual(8);
  });
});
