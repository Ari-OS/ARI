import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentDrafter } from '../../../../src/plugins/content-engine/content-drafter.js';
import type { TopicBrief, ContentEngineConfig } from '../../../../src/plugins/content-engine/types.js';

const mockOrchestrator = {
  chat: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
};

describe('ContentDrafter', () => {
  let drafter: ContentDrafter;
  const config: ContentEngineConfig = {
    draftsPerDay: 3,
    autoSendForReview: true,
    publishingEnabled: false,
    platforms: ['x_thread', 'linkedin'],
    minThreadabilityScore: 60,
    voiceProfile: {
      persona: '@PayThePryce',
      tone: 'pragmatic builder, technical but accessible',
      audience: 'solo devs, indie hackers, small business owners',
      style: 'direct, no fluff, actionable takeaways',
      avoids: 'corporate jargon, hype without substance',
    },
  };

  const sampleBrief: TopicBrief = {
    headline: 'Claude 4.6 Released',
    keyPoints: ['Computer use built-in', 'Faster than 4.5', 'New agentic capabilities'],
    angle: 'How solo devs can leverage this',
    targetPlatform: 'x_thread',
    sourceItemIds: ['intel-001'],
    threadabilityScore: 85,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    drafter = new ContentDrafter(mockOrchestrator as never, config);
  });

  describe('generateDraft', () => {
    it('should generate an X thread from a topic brief', async () => {
      mockOrchestrator.chat.mockResolvedValue(
        'TWEET 1: Claude 4.6 just dropped and it changes everything.\n\n' +
        'TWEET 2: Here\'s what\'s new.\n\n' +
        'TWEET 3: Computer use is built in.\n\n' +
        'TWEET 4: Follow @PayThePryce for more.',
      );

      const result = await drafter.generateDraft(sampleBrief);

      expect(result.content.length).toBeGreaterThanOrEqual(1);
      expect(result.platform).toBe('x_thread');
      expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    });

    it('should generate a LinkedIn post', async () => {
      const linkedinBrief: TopicBrief = {
        ...sampleBrief,
        targetPlatform: 'linkedin',
      };

      mockOrchestrator.chat.mockResolvedValue(
        'I\'ve been building AI agents for 6 months now...',
      );

      const result = await drafter.generateDraft(linkedinBrief);

      expect(result.platform).toBe('linkedin');
      expect(result.content).toHaveLength(1);
    });

    it('should pass voice profile in system prompt', async () => {
      mockOrchestrator.chat.mockResolvedValue('TWEET 1: content here');

      await drafter.generateDraft(sampleBrief);

      const systemPrompt = mockOrchestrator.chat.mock.calls[0][1] as string;
      expect(systemPrompt).toContain('@PayThePryce');
      expect(systemPrompt).toContain('pragmatic builder');
      expect(systemPrompt).toContain('solo devs');
    });

    it('should include topic brief details in the user message', async () => {
      mockOrchestrator.chat.mockResolvedValue('TWEET 1: content');

      await drafter.generateDraft(sampleBrief);

      const messages = mockOrchestrator.chat.mock.calls[0][0] as Array<{ content: string }>;
      expect(messages[0].content).toContain('Claude 4.6 Released');
      expect(messages[0].content).toContain('Computer use built-in');
    });
  });

  describe('parseThreadResponse', () => {
    it('should split thread response into individual tweets', () => {
      const response =
        'TWEET 1: Hook tweet here\n\nTWEET 2: Body tweet\n\nTWEET 3: CTA tweet';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets).toHaveLength(3);
      expect(tweets[0]).toBe('Hook tweet here');
    });

    it('should handle numbered format', () => {
      const response = '1. First tweet\n\n2. Second tweet\n\n3. Third tweet';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle single-paragraph response as single item', () => {
      const response = 'This is a single LinkedIn post about AI.';
      const tweets = drafter.parseThreadResponse(response);
      expect(tweets).toHaveLength(1);
    });
  });
});
