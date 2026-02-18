import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KeywordTracker } from '../../../../src/plugins/seo-engine/keyword-tracker.js';
import type { KeywordData } from '../../../../src/plugins/seo-engine/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

vi.mock('node:fs/promises');

const mockOrchestrator = {
  chat: vi.fn(),
};

describe('KeywordTracker', () => {
  let tracker: KeywordTracker;
  let dataDir: string;

  beforeEach(() => {
    vi.resetAllMocks();
    dataDir = path.join(os.tmpdir(), 'seo-test-' + Date.now());
    tracker = new KeywordTracker(mockOrchestrator, dataDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init', () => {
    it('should initialize with empty keywords when no persisted file exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await tracker.init();

      expect(tracker.getTrackedCount()).toBe(0);
    });

    it('should load persisted keywords from disk on init', async () => {
      const stored: Record<string, KeywordData> = {
        'freelance web developer': {
          keyword: 'freelance web developer',
          volume: 1200,
          difficulty: 25,
          intent: 'commercial',
        },
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(stored));

      await tracker.init();

      expect(tracker.getTrackedCount()).toBe(1);
      expect(tracker.getKeyword('freelance web developer')).toEqual(stored['freelance web developer']);
    });
  });

  describe('discoverKeywords', () => {
    it('should discover keywords via AI and store them', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const aiResponse: KeywordData[] = [
        { keyword: 'best freelance tools 2026', volume: 500, difficulty: 20, intent: 'informational' },
        { keyword: 'how to find freelance clients', volume: 800, difficulty: 28, intent: 'informational' },
      ];
      mockOrchestrator.chat.mockResolvedValue(JSON.stringify(aiResponse));

      await tracker.init();
      const result = await tracker.discoverKeywords('freelancing', 2);

      expect(result).toHaveLength(2);
      expect(result[0].keyword).toBe('best freelance tools 2026');
      expect(tracker.getTrackedCount()).toBe(2);
    });

    it('should handle AI failure gracefully and return empty array', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      mockOrchestrator.chat.mockRejectedValue(new Error('AI unavailable'));

      await tracker.init();
      const result = await tracker.discoverKeywords('freelancing');

      expect(result).toEqual([]);
      expect(tracker.getTrackedCount()).toBe(0);
    });

    it('should handle JSON parse errors in AI response gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      mockOrchestrator.chat.mockResolvedValue('not valid json { broken');

      await tracker.init();
      const result = await tracker.discoverKeywords('freelancing');

      expect(result).toEqual([]);
    });
  });

  describe('addKeyword and getKeyword', () => {
    it('should add and retrieve a keyword by key', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await tracker.init();

      const kw: KeywordData = {
        keyword: 'pryceless solutions review',
        volume: 200,
        difficulty: 15,
        intent: 'navigational',
      };
      tracker.addKeyword(kw);

      expect(tracker.getKeyword('pryceless solutions review')).toEqual(kw);
    });

    it('should return undefined for an unknown keyword', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await tracker.init();

      expect(tracker.getKeyword('nonexistent keyword')).toBeUndefined();
    });
  });

  describe('generateContentBrief', () => {
    it('should generate a content brief from AI response', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      const brief = {
        keyword: 'freelance pricing guide',
        intent: 'informational',
        targetWordCount: 1500,
        suggestedTitle: 'Freelance Pricing Guide: How to Charge What You\'re Worth',
        suggestedHeadings: ['Why Most Freelancers Underprice', 'The Value-Based Pricing Model'],
        lsiKeywords: ['hourly rate', 'project pricing', 'value pricing'],
        faqs: ['How do I set my freelance rate?'],
        competitorInsights: ['Top-ranking articles use case studies'],
      };
      mockOrchestrator.chat.mockResolvedValue(JSON.stringify(brief));

      await tracker.init();
      const result = await tracker.generateContentBrief('freelance pricing guide');

      expect(result.keyword).toBe('freelance pricing guide');
      expect(result.suggestedTitle).toContain('Freelance Pricing');
      expect(result.lsiKeywords).toContain('hourly rate');
    });
  });

  describe('getTrackedCount', () => {
    it('should return the correct count of tracked keywords', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await tracker.init();

      expect(tracker.getTrackedCount()).toBe(0);
      tracker.addKeyword({ keyword: 'kw1' });
      tracker.addKeyword({ keyword: 'kw2' });
      expect(tracker.getTrackedCount()).toBe(2);
    });
  });

  describe('getKeywords', () => {
    it('should return all tracked keywords as an array', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await tracker.init();

      tracker.addKeyword({ keyword: 'keyword one', intent: 'informational' });
      tracker.addKeyword({ keyword: 'keyword two', intent: 'commercial' });

      const all = tracker.getKeywords();
      expect(all).toHaveLength(2);
      expect(all.map((k) => k.keyword)).toContain('keyword one');
    });
  });
});
