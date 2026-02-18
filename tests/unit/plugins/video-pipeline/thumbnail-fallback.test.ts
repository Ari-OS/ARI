import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThumbnailFallback } from '../../../../src/plugins/video-pipeline/thumbnail-fallback.js';
import type { ThumbnailFallbackResult, ThumbnailStyle } from '../../../../src/plugins/video-pipeline/thumbnail-fallback.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof ThumbnailFallback>[0]['eventBus'];

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

describe('ThumbnailFallback', () => {
  let fallback: ThumbnailFallback;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    process.env.FAL_API_KEY = 'test-fal-key';
    fallback = new ThumbnailFallback({ eventBus: mockEventBus });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('generate() — successful generation', () => {
    it('should return a ThumbnailFallbackResult', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      const result = await fallback.generate({
        prompt: 'sunset over mountain',
        style: 'youtube',
      });

      expect(result.url).toBe('https://fal.ai/image.png');
      expect(result.provider).toBe('fal_flux');
      expect(result.generatedAt).toBeDefined();
    });

    it('should include style modifier in the prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      await fallback.generate({ prompt: 'test', style: 'youtube' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.prompt).toContain('YouTube thumbnail');
      expect(body.prompt).toContain('bold text overlay');
    });

    it('should use default youtube dimensions (1280x720)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      const result = await fallback.generate({ prompt: 'test', style: 'youtube' });

      expect(result.dimensions.width).toBe(1280);
      expect(result.dimensions.height).toBe(720);
    });

    it('should use default shorts dimensions (1080x1920)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      const result = await fallback.generate({ prompt: 'test', style: 'shorts' });

      expect(result.dimensions.width).toBe(1080);
      expect(result.dimensions.height).toBe(1920);
    });

    it('should use default blog dimensions (1200x630)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      const result = await fallback.generate({ prompt: 'test', style: 'blog' });

      expect(result.dimensions.width).toBe(1200);
      expect(result.dimensions.height).toBe(630);
    });

    it('should use custom dimensions when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      const result = await fallback.generate({
        prompt: 'test',
        style: 'youtube',
        width: 1920,
        height: 1080,
      });

      expect(result.dimensions.width).toBe(1920);
      expect(result.dimensions.height).toBe(1080);
    });

    it('should send correct API headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      await fallback.generate({ prompt: 'test', style: 'youtube' });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Key test-fal-key');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should enable safety checker in API request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      await fallback.generate({ prompt: 'test', style: 'youtube' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.enable_safety_checker).toBe(true);
    });

    it('should request exactly 1 image', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      await fallback.generate({ prompt: 'test', style: 'youtube' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.num_images).toBe(1);
    });

    it('should emit video:thumbnail_fallback_used event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
      });

      await fallback.generate({ prompt: 'test', style: 'youtube' });

      expect(mockEmit).toHaveBeenCalledWith('video:thumbnail_fallback_used', expect.objectContaining({
        url: 'https://fal.ai/image.png',
        provider: 'fal_flux',
      }));
    });
  });

  describe('generate() — error handling', () => {
    it('should throw when FAL_API_KEY is not configured', async () => {
      delete process.env.FAL_API_KEY;
      const noKeyFallback = new ThumbnailFallback({ eventBus: mockEventBus });

      await expect(noKeyFallback.generate({
        prompt: 'test',
        style: 'youtube',
      })).rejects.toThrow('FAL_API_KEY not configured');
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(fallback.generate({
        prompt: 'test',
        style: 'youtube',
      })).rejects.toThrow('fal.ai FLUX API returned 500');
    });

    it('should throw when API returns no image URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [] }),
      });

      await expect(fallback.generate({
        prompt: 'test',
        style: 'youtube',
      })).rejects.toThrow('fal.ai FLUX API returned no image URL');
    });

    it('should throw when images array is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'no images' }),
      });

      await expect(fallback.generate({
        prompt: 'test',
        style: 'youtube',
      })).rejects.toThrow('fal.ai FLUX API returned no image URL');
    });

    it('should throw when image object has no url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [{ width: 1280 }] }),
      });

      await expect(fallback.generate({
        prompt: 'test',
        style: 'youtube',
      })).rejects.toThrow('fal.ai FLUX API returned no image URL');
    });
  });

  describe('generate() — style modifiers', () => {
    const styles: ThumbnailStyle[] = ['youtube', 'shorts', 'blog'];

    for (const style of styles) {
      it(`should apply ${style} style modifier to prompt`, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ images: [{ url: 'https://fal.ai/image.png' }] }),
        });

        await fallback.generate({ prompt: 'base prompt', style });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
        expect(body.prompt).toContain('base prompt');
        expect((body.prompt as string).length).toBeGreaterThan('base prompt'.length);
      });
    }
  });
});
