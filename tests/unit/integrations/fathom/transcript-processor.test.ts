import { describe, it, expect, vi } from 'vitest';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockBus = { emit: vi.fn(), on: vi.fn() } as unknown as EventBus;

describe('TranscriptProcessor', () => {
  it('should instantiate', async () => {
    const { TranscriptProcessor } = await import('../../../../src/integrations/fathom/transcript-processor.js');
    const processor = new TranscriptProcessor({ eventBus: mockBus });
    expect(processor).toBeDefined();
  });

  it('should process a transcript and return structured result', async () => {
    const { TranscriptProcessor } = await import('../../../../src/integrations/fathom/transcript-processor.js');
    const processor = new TranscriptProcessor({ eventBus: mockBus });
    const result = await processor.process({
      meetingId: 'test-123',
      title: 'Q1 Planning',
      rawTranscript: 'Action item: Set up CI pipeline by Friday. TODO: Write tests. Good progress everyone!',
      participants: ['John', 'Jane'],
      durationMinutes: 30,
      recordedAt: new Date().toISOString(),
    });
    expect(result).toHaveProperty('meetingId', 'test-123');
    expect(result).toHaveProperty('actionItems');
    expect(Array.isArray(result.actionItems)).toBe(true);
    expect(result).toHaveProperty('sentiment');
    expect(typeof result.sentiment).toBe('string');
  });

  it('should extract action items from text', async () => {
    const { TranscriptProcessor } = await import('../../../../src/integrations/fathom/transcript-processor.js');
    const processor = new TranscriptProcessor({ eventBus: mockBus });
    const items = processor.extractActionItems('Action item: Fix the bug. TODO: Write tests.');
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should get sentiment as string category', async () => {
    const { TranscriptProcessor } = await import('../../../../src/integrations/fathom/transcript-processor.js');
    const processor = new TranscriptProcessor({ eventBus: mockBus });
    const sentiment = processor.getSentiment('Great progress on the project! Very positive outcome.');
    expect(typeof sentiment).toBe('string');
    expect(['positive', 'neutral', 'negative', 'mixed']).toContain(sentiment);
  });
});
