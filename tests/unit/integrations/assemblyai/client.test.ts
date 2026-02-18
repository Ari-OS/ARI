import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssemblyAIClient } from '../../../../src/integrations/assemblyai/client.js';
import type { AssemblyAIWord } from '../../../../src/integrations/assemblyai/client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeTranscriptResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transcript-abc123',
    status: 'completed',
    text: 'Hello world this is a test',
    words: [
      { text: 'Hello', start: 0, end: 500, confidence: 0.99 },
      { text: 'world', start: 600, end: 1100, confidence: 0.98 },
      { text: 'this', start: 1200, end: 1500, confidence: 0.97 },
      { text: 'is', start: 1600, end: 1800, confidence: 0.99 },
      { text: 'a', start: 1900, end: 2000, confidence: 0.95 },
      { text: 'test', start: 2100, end: 2600, confidence: 0.98 },
    ],
    error: null,
    ...overrides,
  };
}

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('AssemblyAIClient', () => {
  let client: AssemblyAIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AssemblyAIClient('test-api-key');
  });

  describe('constructor', () => {
    it('should create client with API key', () => {
      expect(client).toBeDefined();
    });

    it('should throw if no API key provided', () => {
      expect(() => new AssemblyAIClient('')).toThrow('API key is required');
    });
  });

  describe('transcribe', () => {
    it('should submit job and return transcript on immediate completion', async () => {
      // Submit returns job ID
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 'transcript-abc123' }));
      // Poll returns completed
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTranscriptResponse()));

      const result = await client.transcribe('https://example.com/audio.mp3');

      expect(result.id).toBe('transcript-abc123');
      expect(result.text).toBe('Hello world this is a test');
      expect(result.words).toHaveLength(6);
      expect(result.words[0]).toMatchObject({ text: 'Hello', start: 0, end: 500 });
    });

    it('should poll until completed', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce(makeFetchResponse({ id: 'poll-test-id' })) // submit
        .mockResolvedValueOnce(makeFetchResponse({ id: 'poll-test-id', status: 'queued', text: null, words: null, error: null }))
        .mockResolvedValueOnce(makeFetchResponse({ id: 'poll-test-id', status: 'processing', text: null, words: null, error: null }))
        .mockResolvedValueOnce(makeFetchResponse(makeTranscriptResponse({ id: 'poll-test-id' })));

      const transcribePromise = client.transcribe('https://example.com/audio.mp3');
      // Advance fake timers past the two POLL_INTERVAL_MS delays
      await vi.runAllTimersAsync();
      const result = await transcribePromise;

      vi.useRealTimers();

      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 submit + 3 polls
      expect(result.id).toBe('poll-test-id');
    });

    it('should pass wordBoost option', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse({ id: 'boost-test' }))
        .mockResolvedValueOnce(makeFetchResponse(makeTranscriptResponse({ id: 'boost-test' })));

      await client.transcribe('https://example.com/audio.mp3', {
        wordBoost: ['ARI', 'Pryceless'],
      });

      const submitCall = mockFetch.mock.calls[0];
      const body = JSON.parse(submitCall[1].body as string) as Record<string, unknown>;
      expect(body.word_boost).toEqual(['ARI', 'Pryceless']);
    });

    it('should throw on submit error', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ error: 'bad request' }, false, 400));

      await expect(client.transcribe('https://example.com/audio.mp3')).rejects.toThrow('AssemblyAI submit error 400');
    });

    it('should throw if transcription fails', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 'fail-id' }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        id: 'fail-id', status: 'error', text: null, words: null, error: 'Audio format not supported',
      }));

      await expect(client.transcribe('https://example.com/bad.mp3')).rejects.toThrow('Audio format not supported');
    });

    it('should return empty words array when API returns null', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ id: 'null-words' }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        id: 'null-words', status: 'completed', text: 'Hello', words: null, error: null,
      }));

      const result = await client.transcribe('https://example.com/audio.mp3');
      expect(result.words).toEqual([]);
    });
  });

  describe('generateSrt', () => {
    const words: AssemblyAIWord[] = [
      { text: 'Hello', start: 0, end: 500, confidence: 0.99 },
      { text: 'world', start: 600, end: 1100, confidence: 0.98 },
      { text: 'this', start: 1200, end: 1500, confidence: 0.97 },
      { text: 'is', start: 1600, end: 1800, confidence: 0.99 },
      { text: 'a', start: 1900, end: 2000, confidence: 0.95 },
      { text: 'test', start: 2100, end: 2600, confidence: 0.98 },
    ];

    it('should generate valid SRT with 3 words per block by default', () => {
      const srt = client.generateSrt(words);

      expect(srt).toContain('1\n');
      expect(srt).toContain('00:00:00,000 --> 00:00:01,500');
      expect(srt).toContain('Hello world this');
      expect(srt).toContain('2\n');
      expect(srt).toContain('is a test');
    });

    it('should respect custom wordsPerBlock', () => {
      const srt = client.generateSrt(words, 2);

      // 6 words / 2 per block = 3 blocks
      const blockCount = (srt.match(/^\d+$/gm) ?? []).length;
      expect(blockCount).toBe(3);
    });

    it('should return empty string for empty words array', () => {
      expect(client.generateSrt([])).toBe('');
    });

    it('should format timestamps correctly', () => {
      const oneHourWords: AssemblyAIWord[] = [
        { text: 'Late', start: 3_661_500, end: 3_662_000, confidence: 1.0 },
      ];
      const srt = client.generateSrt(oneHourWords, 1);
      expect(srt).toContain('01:01:01,500 --> 01:01:02,000');
    });
  });
});
