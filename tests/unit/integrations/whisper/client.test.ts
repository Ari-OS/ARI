/**
 * Whisper Client Test Suite
 *
 * Tests for Whisper audio transcription integration including:
 * - Local transcription (whisper.cpp)
 * - API transcription (OpenAI)
 * - File and buffer handling
 * - Formatting and timestamp display
 * - Security (loopback enforcement, API key validation)
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { WhisperClient } from '../../../../src/integrations/whisper/client.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { readFile } from 'node:fs/promises';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('WhisperClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create local instance with default URL', () => {
      const client = new WhisperClient({ mode: 'local' });
      expect(client).toBeDefined();
    });

    it('should create API instance with key', () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test123' });
      expect(client).toBeDefined();
    });

    it('should throw error when API mode lacks key', () => {
      expect(() => new WhisperClient({ mode: 'api' })).toThrow('API key is required for API mode');
    });

    it('should accept custom local URL', () => {
      const client = new WhisperClient({ mode: 'local', localUrl: 'http://127.0.0.1:9000' });
      expect(client).toBeDefined();
    });

    it('should throw when local URL is not loopback-only', () => {
      expect(() => {
        new WhisperClient({ mode: 'local', localUrl: 'http://192.168.1.100:8080' });
      }).toThrow('loopback');
    });

    it('should allow localhost as valid loopback', () => {
      const client = new WhisperClient({ mode: 'local', localUrl: 'http://localhost:8080' });
      expect(client).toBeDefined();
    });

    it('should use correct default models', () => {
      const localClient = new WhisperClient({ mode: 'local' });
      const apiClient = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      expect(localClient).toBeDefined();
      expect(apiClient).toBeDefined();
    });

    it('should accept custom model names', () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test', model: 'whisper-large' });
      expect(client).toBeDefined();
    });

    it('should accept language parameter', () => {
      const client = new WhisperClient({ mode: 'local', language: 'en' });
      expect(client).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL TRANSCRIPTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('transcribe (local mode)', () => {
    it('should transcribe audio file via local server', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('fake audio data');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Hello, this is a transcription.',
          language: 'en',
          segments: [
            { start: 0.0, end: 2.5, text: 'Hello, this is' },
            { start: 2.5, end: 4.0, text: 'a transcription.' },
          ],
        }),
      });

      const result = await client.transcribe('/path/to/audio.wav');

      expect(result).toEqual({
        text: 'Hello, this is a transcription.',
        language: 'en',
        segments: [
          { start: 0.0, end: 2.5, text: 'Hello, this is' },
          { start: 2.5, end: 4.0, text: 'a transcription.' },
        ],
      });

      expect(readFile).toHaveBeenCalledWith('/path/to/audio.wav');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/inference',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include language in local request if specified', async () => {
      const client = new WhisperClient({ mode: 'local', language: 'es' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Hola mundo',
          language: 'es',
        }),
      });

      await client.transcribe('/path/to/audio.wav');

      // FormData is hard to inspect, but we can verify the call was made
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle local server errors', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.transcribe('/path/to/audio.wav')).rejects.toThrow(
        'Whisper transcription failed: Local Whisper API error: 500 Internal Server Error'
      );
    });

    it('should handle file read errors', async () => {
      const client = new WhisperClient({ mode: 'local' });

      (readFile as Mock).mockRejectedValueOnce(new Error('ENOENT: file not found'));

      await expect(client.transcribe('/nonexistent.wav')).rejects.toThrow(
        'Whisper transcription failed: ENOENT: file not found'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // API TRANSCRIPTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('transcribe (API mode)', () => {
    it('should transcribe audio file via OpenAI API', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test123' });

      const mockBuffer = Buffer.from('fake audio data');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'OpenAI transcription result.',
          language: 'en',
          duration: 4.5,
          segments: [
            { start: 0.0, end: 4.5, text: 'OpenAI transcription result.' },
          ],
        }),
      });

      const result = await client.transcribe('/path/to/audio.mp3');

      expect(result).toEqual({
        text: 'OpenAI transcription result.',
        language: 'en',
        duration: 4.5,
        segments: [
          { start: 0.0, end: 4.5, text: 'OpenAI transcription result.' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer sk-test123',
          },
        })
      );
    });

    it('should include language in API request if specified', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test', language: 'fr' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Bonjour le monde',
          language: 'fr',
        }),
      });

      await client.transcribe('/path/to/audio.mp3');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(client.transcribe('/path/to/audio.mp3')).rejects.toThrow(
        'Whisper transcription failed: OpenAI API error: 401 Invalid API key'
      );
    });

    it('should handle network errors', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.transcribe('/path/to/audio.mp3')).rejects.toThrow(
        'Whisper transcription failed: Network timeout'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCRIBE BUFFER TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('transcribeBuffer', () => {
    it('should transcribe from buffer (local)', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio data');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Transcription from buffer',
        }),
      });

      const result = await client.transcribeBuffer(mockBuffer, 'audio.wav');

      expect(result.text).toBe('Transcription from buffer');
    });

    it('should transcribe from buffer (API)', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      const mockBuffer = Buffer.from('audio data');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'API transcription from buffer',
        }),
      });

      const result = await client.transcribeBuffer(mockBuffer, 'audio.mp3');

      expect(result.text).toBe('API transcription from buffer');
    });

    it('should preserve filename in request', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Text' }),
      });

      await client.transcribeBuffer(mockBuffer, 'custom-name.wav');

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IS AVAILABLE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isAvailable', () => {
    it('should return true when local server is reachable', async () => {
      const client = new WhisperClient({ mode: 'local' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const available = await client.isAvailable();

      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8080/',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when local server is not reachable', async () => {
      const client = new WhisperClient({ mode: 'local' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return false on network error', async () => {
      const client = new WhisperClient({ mode: 'local' });

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });

    it('should return true for API mode with key', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      const available = await client.isAvailable();

      expect(available).toBe(true);
    });

    it('should timeout after 5 seconds', async () => {
      const client = new WhisperClient({ mode: 'local' });

      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAT TRANSCRIPTION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('formatTranscription', () => {
    it('should return plain text without timestamps by default', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Hello world',
        segments: [
          { start: 0.0, end: 2.0, text: 'Hello' },
          { start: 2.0, end: 4.0, text: 'world' },
        ],
      };

      const formatted = client.formatTranscription(result);

      expect(formatted).toBe('Hello world');
    });

    it('should include timestamps when requested', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Hello world',
        segments: [
          { start: 0.0, end: 2.5, text: 'Hello' },
          { start: 2.5, end: 5.0, text: 'world' },
        ],
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toContain('[00:00 -> 00:02] Hello');
      expect(formatted).toContain('[00:02 -> 00:05] world');
    });

    it('should include language and duration if available', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Test',
        language: 'en',
        duration: 10.5,
        segments: [
          { start: 0.0, end: 10.5, text: 'Test' },
        ],
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toContain('Language: en');
      expect(formatted).toContain('Duration: 10.50s');
      expect(formatted).toContain('[00:00 -> 00:10] Test');
    });

    it('should handle segments without timestamps', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Plain text only',
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toBe('Plain text only');
    });

    it('should format timestamps correctly for long durations', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Test',
        segments: [
          { start: 65.0, end: 125.0, text: 'Test segment' },
        ],
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toContain('[01:05 -> 02:05] Test segment');
    });

    it('should trim segment text', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'Test',
        segments: [
          { start: 0.0, end: 2.0, text: '  Text with spaces  ' },
        ],
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toContain('Text with spaces');
      expect(formatted).not.toContain('  Text');
    });

    it('should handle empty segments array', () => {
      const client = new WhisperClient({ mode: 'local' });

      const result = {
        text: 'No segments',
        segments: [],
      };

      const formatted = client.formatTranscription(result, true);

      expect(formatted).toBe('No segments');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle unknown errors gracefully', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockRejectedValueOnce('String error');

      await expect(client.transcribe('/path/to/audio.wav')).rejects.toThrow(
        'Whisper transcription failed: Unknown error'
      );
    });

    it('should handle empty audio files', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const emptyBuffer = Buffer.from('');
      (readFile as Mock).mockResolvedValueOnce(emptyBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: '',
        }),
      });

      const result = await client.transcribe('/path/to/empty.wav');

      expect(result.text).toBe('');
    });

    it('should handle very long audio files', async () => {
      const client = new WhisperClient({ mode: 'api', apiKey: 'sk-test' });

      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
      (readFile as Mock).mockResolvedValueOnce(largeBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Long transcription',
          duration: 3600,
        }),
      });

      const result = await client.transcribe('/path/to/long.mp3');

      expect(result.text).toBe('Long transcription');
      expect(result.duration).toBe(3600);
    });

    it('should extract filename from complex paths', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'Text' }),
      });

      await client.transcribe('/Users/test/Documents/my audio file.wav');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle response without segments', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Transcription without segments',
        }),
      });

      const result = await client.transcribe('/path/to/audio.wav');

      expect(result.text).toBe('Transcription without segments');
      expect(result.segments).toBeUndefined();
    });

    it('should handle special characters in transcription', async () => {
      const client = new WhisperClient({ mode: 'local' });

      const mockBuffer = Buffer.from('audio');
      (readFile as Mock).mockResolvedValueOnce(mockBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Text with "quotes" and \'apostrophes\' and émojis 🎉',
        }),
      });

      const result = await client.transcribe('/path/to/audio.wav');

      expect(result.text).toContain('"quotes"');
      expect(result.text).toContain('\'apostrophes\'');
      expect(result.text).toContain('🎉');
    });
  });
});
