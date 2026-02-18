import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CaptionsGenerator } from '../../../../src/plugins/video-pipeline/captions-generator.js';

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

// ─── Sample AssemblyAI responses ──────────────────────────────────────────────

const mockTranscriptCreated = { id: 'tx-123' };

const mockTranscriptCompleted = {
  id: 'tx-123',
  status: 'completed',
  text: 'Hello world this is a test',
  words: [
    { text: 'Hello', start: 0, end: 500, confidence: 0.98 },
    { text: 'world', start: 600, end: 1100, confidence: 0.99 },
    { text: 'this', start: 1200, end: 1500, confidence: 0.97 },
    { text: 'is', start: 1600, end: 1800, confidence: 0.99 },
    { text: 'a', start: 1900, end: 2000, confidence: 0.99 },
    { text: 'test', start: 2100, end: 2500, confidence: 0.96 },
  ],
  error: null,
};

function mockApiOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockApiError(status = 400, body = 'Error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  });
}

describe('CaptionsGenerator', () => {
  let generator: CaptionsGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new CaptionsGenerator('test-assembly-ai-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('submitTranscription', () => {
    it('should POST to AssemblyAI and return transcript ID', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));

      const id = await generator.submitTranscription('https://example.com/audio.mp4');

      expect(id).toBe('tx-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('assemblyai.com'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include audio_url in request body', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));

      await generator.submitTranscription('https://example.com/audio.mp4');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { audio_url: string };
      expect(body.audio_url).toBe('https://example.com/audio.mp4');
    });

    it('should include authorization header', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));

      await generator.submitTranscription('https://example.com/audio.mp4');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>).authorization).toBe('test-assembly-ai-key');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(401, 'Unauthorized'));

      await expect(generator.submitTranscription('https://example.com/audio.mp4'))
        .rejects.toThrow();
    });
  });

  describe('waitForTranscription', () => {
    it('should return completed transcript', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCompleted));

      const result = await generator.waitForTranscription('tx-123');

      expect(result.status).toBe('completed');
      expect(result.text).toBe('Hello world this is a test');
    });

    it('should throw when transcript status is error', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk({
        id: 'tx-err',
        status: 'error',
        text: null,
        words: null,
        error: 'Audio file not found',
      }));

      await expect(generator.waitForTranscription('tx-err'))
        .rejects.toThrow('Audio file not found');
    });
  });

  describe('generateSrt', () => {
    it('should return SRT content and path', async () => {
      // submitTranscription
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));
      // waitForTranscription (already completed)
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCompleted));

      const result = await generator.generateSrt('https://example.com/audio.mp4', '/tmp', 'proj-1');

      expect(result.transcriptId).toBe('tx-123');
      expect(result.srtContent).toContain('-->');
      expect(result.srtPath).toContain('proj-1.srt');
    });

    it('should write SRT to disk', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCompleted));

      await generator.generateSrt('https://example.com/audio.mp4', '/tmp', 'proj-2');

      const { writeFileSync } = await import('node:fs');
      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    });

    it('should throw when transcript has no words', async () => {
      mockFetch.mockResolvedValueOnce(mockApiOk(mockTranscriptCreated));
      mockFetch.mockResolvedValueOnce(mockApiOk({
        ...mockTranscriptCompleted,
        words: [],
      }));

      await expect(generator.generateSrt('https://example.com/audio.mp4', '/tmp', 'proj-3'))
        .rejects.toThrow('no word timestamps');
    });
  });
});
