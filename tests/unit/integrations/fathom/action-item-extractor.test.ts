import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionItemExtractor } from '../../../../src/integrations/fathom/action-item-extractor.js';
import type { ActionItem } from '../../../../src/integrations/fathom/action-item-extractor.js';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK
// ─────────────────────────────────────────────────────────────────────────────

const mockOrchestrator = {
  query: vi.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeActionItemResponse(items: Partial<ActionItem>[]): string {
  return JSON.stringify(
    items.map((item, i) => ({
      description: item.description ?? `Action item ${i + 1}`,
      assignee: item.assignee ?? 'unassigned',
      dueDate: item.dueDate ?? null,
      priority: item.priority ?? 'medium',
      context: item.context ?? 'From the meeting transcript.',
    })),
  );
}

const SAMPLE_TRANSCRIPT = [
  'Alice: We need to finish the API integration by Friday.',
  'Bob: I can take that on. Should be straightforward.',
  'Alice: Great. Also, Charlie, can you review the security audit results?',
  'Charlie: Sure, I will review those by end of week.',
  'Alice: Bob, also make sure to update the documentation.',
].join('\n');

const PARTICIPANTS = ['Alice', 'Bob', 'Charlie'];

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ActionItemExtractor', () => {
  let extractor: ActionItemExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new ActionItemExtractor(mockOrchestrator);
  });

  it('should extract action items from transcript', async () => {
    mockOrchestrator.query.mockResolvedValueOnce(
      makeActionItemResponse([
        { description: 'Finish API integration', assignee: 'Bob', dueDate: '2026-02-21', priority: 'high' },
        { description: 'Review security audit results', assignee: 'Charlie', priority: 'medium' },
        { description: 'Update documentation', assignee: 'Bob', priority: 'low' },
      ]),
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items).toHaveLength(3);
    expect(items[0].description).toBe('Finish API integration');
    expect(items[0].assignee).toBe('Bob');
    expect(items[0].priority).toBe('high');
    expect(items[0].dueDate).toBe('2026-02-21');
    expect(items[0].id).toBeDefined();
  });

  it('should return empty array for empty transcript', async () => {
    const items = await extractor.extract('', PARTICIPANTS);

    expect(items).toHaveLength(0);
    expect(mockOrchestrator.query).not.toHaveBeenCalled();
  });

  it('should return empty array for whitespace-only transcript', async () => {
    const items = await extractor.extract('   \n\t  ', PARTICIPANTS);

    expect(items).toHaveLength(0);
    expect(mockOrchestrator.query).not.toHaveBeenCalled();
  });

  it('should resolve assignee by partial name match', async () => {
    mockOrchestrator.query.mockResolvedValueOnce(
      makeActionItemResponse([
        { description: 'Do the thing', assignee: 'alice' },
      ]),
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items[0].assignee).toBe('Alice');
  });

  it('should default assignee to "unassigned" for unknown names', async () => {
    mockOrchestrator.query.mockResolvedValueOnce(
      makeActionItemResponse([
        { description: 'Do the thing', assignee: 'Dave' },
      ]),
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items[0].assignee).toBe('Dave');
  });

  it('should handle LLM returning empty array', async () => {
    mockOrchestrator.query.mockResolvedValueOnce('[]');

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items).toHaveLength(0);
  });

  it('should handle LLM returning invalid JSON gracefully', async () => {
    mockOrchestrator.query.mockResolvedValueOnce('This is not JSON at all.');

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items).toHaveLength(0);
  });

  it('should handle LLM throwing an error', async () => {
    mockOrchestrator.query.mockRejectedValueOnce(new Error('API timeout'));

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items).toHaveLength(0);
  });

  it('should normalize priority to valid values', async () => {
    mockOrchestrator.query.mockResolvedValueOnce(
      makeActionItemResponse([
        { description: 'Urgent fix', priority: 'high' },
        { description: 'Cleanup', priority: 'low' },
        { description: 'Review', priority: 'MEDIUM' as 'medium' },
        { description: 'Something', priority: 'critical' as 'high' },
      ]),
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items[0].priority).toBe('high');
    expect(items[1].priority).toBe('low');
    expect(items[2].priority).toBe('medium');
    expect(items[3].priority).toBe('medium'); // unknown → medium
  });

  it('should truncate long context strings', async () => {
    const longContext = 'A'.repeat(1000);
    mockOrchestrator.query.mockResolvedValueOnce(
      makeActionItemResponse([
        { description: 'Task', context: longContext },
      ]),
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items[0].context.length).toBeLessThanOrEqual(500);
  });

  it('should handle response wrapped in markdown code fences', async () => {
    const jsonPayload = makeActionItemResponse([
      { description: 'Update API docs', assignee: 'Bob' },
    ]);

    mockOrchestrator.query.mockResolvedValueOnce(
      `\`\`\`json\n${jsonPayload}\n\`\`\``,
    );

    const items = await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Update API docs');
  });

  it('should pass transcript to orchestrator query', async () => {
    mockOrchestrator.query.mockResolvedValueOnce('[]');

    await extractor.extract(SAMPLE_TRANSCRIPT, PARTICIPANTS);

    expect(mockOrchestrator.query).toHaveBeenCalledTimes(1);
    const prompt = mockOrchestrator.query.mock.calls[0][0] as string;
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('Bob');
    expect(prompt).toContain('Charlie');
    expect(prompt).toContain('TRANSCRIPT START');
  });
});
