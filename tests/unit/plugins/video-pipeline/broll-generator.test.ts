import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BRollGenerator } from '../../../../src/plugins/video-pipeline/broll-generator.js';
import type { BRollResult, BRollStyle, BRollAspectRatio } from '../../../../src/plugins/video-pipeline/broll-generator.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof BRollGenerator>[0]['eventBus'];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockFetch = vi.fn();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BRollGenerator', () => {
  let generator: BRollGenerator;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    // Set API keys so providers are available
    process.env.SEEDANCE_API_KEY = 'seedance-key';
    process.env.RUNWAY_API_KEY = 'runway-key';
    process.env.PIKA_API_KEY = 'pika-key';
    generator = new BRollGenerator({ eventBus: mockEventBus });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('generate() — successful generation', () => {
    it('should return a BRollResult with valid fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      const result = await generator.generate({
        prompt: 'sunset over ocean',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(result.id).toBeDefined();
      expect(result.url).toBe('https://example.com/video.mp4');
      expect(result.duration).toBe(5);
      expect(result.style).toBe('cinematic');
      expect(result.provider).toBe('seedance');
    });

    it('should include style modifiers in the prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      await generator.generate({
        prompt: 'city skyline',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.prompt).toContain('cinematic');
      expect(body.prompt).toContain('shallow depth of field');
    });

    it('should use correct dimensions for 16:9', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.width).toBe(1920);
      expect(body.height).toBe(1080);
    });

    it('should use correct dimensions for 9:16', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'social',
        aspectRatio: '9:16',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.width).toBe(1080);
      expect(body.height).toBe(1920);
    });

    it('should use correct dimensions for 1:1', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'tutorial',
        aspectRatio: '1:1',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.width).toBe(1080);
      expect(body.height).toBe(1080);
    });

    it('should emit video:broll_generated event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(mockEmit).toHaveBeenCalledWith('video:broll_generated', expect.objectContaining({
        provider: 'seedance',
        style: 'cinematic',
        duration: 5,
      }));
    });
  });

  describe('generate() — provider fallback chain', () => {
    it('should try seedance first, then runway on failure', async () => {
      // Seedance fails
      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('error'), status: 500 });
      // Runway succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://runway.com/video.mp4' }),
      });

      const result = await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(result.provider).toBe('runway');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should try pika after seedance and runway fail', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('error'), status: 500 });
      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('error'), status: 500 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://pika.art/video.mp4' }),
      });

      const result = await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(result.provider).toBe('pika');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw when all providers fail', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('error'), status: 500 });

      await expect(generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      })).rejects.toThrow();
    });

    it('should skip providers without API keys', async () => {
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.RUNWAY_API_KEY;
      // Only pika has key
      const gen = new BRollGenerator({ eventBus: mockEventBus });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://pika.art/video.mp4' }),
      });

      const result = await gen.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(result.provider).toBe('pika');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw when no providers are configured', async () => {
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.RUNWAY_API_KEY;
      delete process.env.PIKA_API_KEY;
      const gen = new BRollGenerator({ eventBus: mockEventBus });

      await expect(gen.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      })).rejects.toThrow('No video generation providers configured');
    });
  });

  describe('generate() — API response handling', () => {
    it('should handle video_url field in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ video_url: 'https://example.com/alt.mp4' }),
      });

      const result = await generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      });

      expect(result.url).toBe('https://example.com/alt.mp4');
    });

    it('should throw when API returns no URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });
      // Fallback providers also fail
      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('err'), status: 500 });
      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('err'), status: 500 });

      await expect(generator.generate({
        prompt: 'test',
        duration: 5,
        style: 'cinematic',
        aspectRatio: '16:9',
      })).rejects.toThrow();
    });
  });

  describe('generate() — style modifiers', () => {
    const styles: BRollStyle[] = ['cinematic', 'documentary', 'tutorial', 'social'];

    for (const style of styles) {
      it(`should include ${style} style modifier in prompt`, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
        });

        await generator.generate({
          prompt: 'base prompt',
          duration: 5,
          style,
          aspectRatio: '16:9',
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
        expect(body.prompt).toContain('base prompt');
        expect((body.prompt as string).length).toBeGreaterThan('base prompt'.length);
      });
    }
  });

  describe('generateOptions()', () => {
    it('should generate multiple B-roll options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/video.mp4' }),
      });

      const results = await generator.generateOptions('test prompt', 3);

      expect(results).toHaveLength(3);
    });

    it('should throw when all options fail', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('error'), status: 500 });

      await expect(generator.generateOptions('test', 2)).rejects.toThrow('Failed to generate any B-roll options');
    });

    it('should return partial results when some options succeed', async () => {
      // First succeeds, second fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://example.com/1.mp4' }),
        })
        .mockResolvedValue({ ok: false, text: () => Promise.resolve('error'), status: 500 });

      const results = await generator.generateOptions('test', 2);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
