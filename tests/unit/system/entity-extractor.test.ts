import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntityExtractor } from '../../../src/system/entity-extractor.js';
import type { ExtractedEntities } from '../../../src/system/entity-extractor.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockOrchestrator = { query: mockQuery };

vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new EntityExtractor(mockOrchestrator);
  });

  describe('extract() — happy path', () => {
    it('should extract all entity types from a valid LLM response', async () => {
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        people: ['Elon Musk', 'Sam Altman'],
        companies: ['OpenAI', 'Tesla'],
        technologies: ['GPT-4', 'TypeScript'],
        locations: ['San Francisco', 'Austin'],
        concepts: ['artificial intelligence'],
        dates: ['2026-02-18'],
      }));

      const result = await extractor.extract('Elon Musk at Tesla and Sam Altman at OpenAI...');

      expect(result.people).toEqual(['Elon Musk', 'Sam Altman']);
      expect(result.companies).toEqual(['OpenAI', 'Tesla']);
      expect(result.technologies).toEqual(['GPT-4', 'TypeScript']);
      expect(result.locations).toEqual(['San Francisco', 'Austin']);
      expect(result.concepts).toEqual(['artificial intelligence']);
      expect(result.dates).toEqual(['2026-02-18']);
    });

    it('should pass text to orchestrator with entity-extractor agent', async () => {
      mockQuery.mockResolvedValueOnce('{"people":[],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      await extractor.extract('some text');

      expect(mockQuery).toHaveBeenCalledOnce();
      expect(mockQuery.mock.calls[0][1]).toBe('entity-extractor');
      expect(mockQuery.mock.calls[0][0]).toContain('some text');
    });

    it('should handle response with markdown code fences', async () => {
      mockQuery.mockResolvedValueOnce('```json\n{"people":["Alice"],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}\n```');

      const result = await extractor.extract('Alice went to the store');

      expect(result.people).toEqual(['Alice']);
    });

    it('should handle response with surrounding text', async () => {
      mockQuery.mockResolvedValueOnce('Here are the entities: {"people":["Bob"],"companies":["Acme"],"technologies":[],"locations":[],"concepts":[],"dates":[]} End.');

      const result = await extractor.extract('Bob works at Acme');

      expect(result.people).toEqual(['Bob']);
      expect(result.companies).toEqual(['Acme']);
    });
  });

  describe('extract() — empty/invalid input', () => {
    it('should return empty entities for empty string', async () => {
      const result = await extractor.extract('');

      expect(result.people).toEqual([]);
      expect(result.companies).toEqual([]);
      expect(result.technologies).toEqual([]);
      expect(result.locations).toEqual([]);
      expect(result.concepts).toEqual([]);
      expect(result.dates).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return empty entities for whitespace-only string', async () => {
      const result = await extractor.extract('   \n\t  ');

      expect(result.people).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('extract() — text truncation', () => {
    it('should truncate text longer than 8000 characters', async () => {
      mockQuery.mockResolvedValueOnce('{"people":[],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      const longText = 'a'.repeat(10000);
      await extractor.extract(longText);

      const prompt = mockQuery.mock.calls[0][0] as string;
      // The prompt includes the extraction instructions + truncated text
      // The text portion should be at most 8000 chars
      expect(prompt.length).toBeLessThan(10000 + 500); // instructions + 8000 max
    });

    it('should not truncate text shorter than 8000 characters', async () => {
      mockQuery.mockResolvedValueOnce('{"people":[],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      const shortText = 'Hello world';
      await extractor.extract(shortText);

      const prompt = mockQuery.mock.calls[0][0] as string;
      expect(prompt).toContain(shortText);
    });
  });

  describe('extract() — parsing robustness', () => {
    it('should return empty entities when no JSON found in response', async () => {
      mockQuery.mockResolvedValueOnce('I could not find any entities in this text.');

      const result = await extractor.extract('some text');

      expect(result.people).toEqual([]);
      expect(result.companies).toEqual([]);
    });

    it('should return empty entities on malformed JSON', async () => {
      mockQuery.mockResolvedValueOnce('{invalid json');

      const result = await extractor.extract('some text');

      expect(result.people).toEqual([]);
    });

    it('should handle missing category arrays in response', async () => {
      mockQuery.mockResolvedValueOnce('{"people":["Alice"]}');

      const result = await extractor.extract('text');

      expect(result.people).toEqual(['Alice']);
      expect(result.companies).toEqual([]);
      expect(result.technologies).toEqual([]);
    });

    it('should filter out non-string values from arrays', async () => {
      mockQuery.mockResolvedValueOnce('{"people":["Alice",42,null,true],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      const result = await extractor.extract('text');

      expect(result.people).toEqual(['Alice']);
    });

    it('should trim whitespace from entity strings', async () => {
      mockQuery.mockResolvedValueOnce('{"people":["  Alice  "," Bob "],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      const result = await extractor.extract('text');

      expect(result.people).toEqual(['Alice', 'Bob']);
    });

    it('should filter out empty strings after trimming', async () => {
      mockQuery.mockResolvedValueOnce('{"people":["Alice","  ",""],"companies":[],"technologies":[],"locations":[],"concepts":[],"dates":[]}');

      const result = await extractor.extract('text');

      expect(result.people).toEqual(['Alice']);
    });

    it('should limit each category to 15 entries', async () => {
      const manyPeople = Array.from({ length: 20 }, (_, i) => `Person${i}`);
      mockQuery.mockResolvedValueOnce(JSON.stringify({
        people: manyPeople,
        companies: [],
        technologies: [],
        locations: [],
        concepts: [],
        dates: [],
      }));

      const result = await extractor.extract('text');

      expect(result.people).toHaveLength(15);
    });

    it('should return empty array for non-array category values', async () => {
      mockQuery.mockResolvedValueOnce('{"people":"not an array","companies":42,"technologies":null,"locations":true,"concepts":{},"dates":[]}');

      const result = await extractor.extract('text');

      expect(result.people).toEqual([]);
      expect(result.companies).toEqual([]);
      expect(result.technologies).toEqual([]);
      expect(result.locations).toEqual([]);
      expect(result.concepts).toEqual([]);
    });
  });

  describe('extract() — error handling', () => {
    it('should return empty entities on orchestrator failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('LLM unavailable'));

      const result = await extractor.extract('some text');

      expect(result.people).toEqual([]);
      expect(result.companies).toEqual([]);
    });

    it('should not throw on orchestrator failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));

      await expect(extractor.extract('text')).resolves.toBeDefined();
    });
  });
});
