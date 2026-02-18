import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RevisionEngine } from '../../../../src/plugins/content-engine/revision-engine.js';
import type { RevisionRequest } from '../../../../src/plugins/content-engine/revision-engine.js';

const mockOrchestrator = {
  chat: vi.fn(),
};

describe('RevisionEngine', () => {
  let engine: RevisionEngine;

  const baseRequest: RevisionRequest = {
    draftContent: 'AI tools are changing everything. Here is why you should care.',
    platform: 'x_single',
    headline: 'AI Tools in 2026',
    feedback: 'Make the opening punchier and add a specific example.',
    version: 1,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    engine = new RevisionEngine(mockOrchestrator);
  });

  describe('revise', () => {
    it('should revise draft with feedback and increment version', async () => {
      mockOrchestrator.chat.mockResolvedValue(
        'GPT-4o cut my research time by 80%. AI tools are not changing everything — they already did.',
      );

      const result = await engine.revise(baseRequest);

      expect(result.revisedContent).toBe(
        'GPT-4o cut my research time by 80%. AI tools are not changing everything — they already did.',
      );
      expect(result.version).toBe(2);
      expect(mockOrchestrator.chat).toHaveBeenCalledTimes(1);
    });

    it('should include feedback summary in changesDescription', async () => {
      mockOrchestrator.chat.mockResolvedValue('Revised content here.');

      const result = await engine.revise(baseRequest);

      expect(result.changesDescription).toContain('Applied feedback:');
      expect(result.changesDescription).toContain(
        'Make the opening punchier and add a specific example.',
      );
    });

    it('should truncate long feedback in changesDescription to 100 chars with ellipsis', async () => {
      const longFeedback =
        'This feedback is intentionally very long and goes well beyond one hundred characters in total length so it must be truncated.';
      mockOrchestrator.chat.mockResolvedValue('Revised content.');

      const result = await engine.revise({ ...baseRequest, feedback: longFeedback });

      expect(result.changesDescription).toContain('...');
      // The description should contain the first 100 chars of the feedback
      expect(result.changesDescription).toContain(longFeedback.slice(0, 100));
      // It should NOT contain the full feedback text beyond the cutoff
      expect(result.changesDescription).not.toContain(longFeedback.slice(101));
    });

    it('should throw on orchestrator failure with descriptive message', async () => {
      mockOrchestrator.chat.mockRejectedValue(new Error('API timeout'));

      await expect(engine.revise(baseRequest)).rejects.toThrow(
        'Failed to revise draft: API timeout',
      );
    });

    it('should trim whitespace from revised content', async () => {
      mockOrchestrator.chat.mockResolvedValue(
        '   \n  Content with surrounding whitespace.   \n',
      );

      const result = await engine.revise(baseRequest);

      expect(result.revisedContent).toBe('Content with surrounding whitespace.');
    });

    it('should pass platform and headline context in the user message', async () => {
      mockOrchestrator.chat.mockResolvedValue('Revised.');

      await engine.revise(baseRequest);

      const messages = mockOrchestrator.chat.mock.calls[0][0] as Array<{
        role: string;
        content: string;
      }>;
      expect(messages[0].content).toContain('Platform: x_single');
      expect(messages[0].content).toContain('Headline: AI Tools in 2026');
      expect(messages[0].content).toContain(baseRequest.draftContent);
      expect(messages[0].content).toContain(baseRequest.feedback);
    });

    it('should embed PayThePryce brand rules in the system prompt', async () => {
      mockOrchestrator.chat.mockResolvedValue('Revised.');

      await engine.revise(baseRequest);

      const systemPrompt = mockOrchestrator.chat.mock.calls[0][1] as string;
      expect(systemPrompt).toContain('PayThePryce');
      expect(systemPrompt).toContain('direct, no filler, confident');
    });
  });
});
