import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThumbnailGenerator } from '../../../../src/plugins/video-pipeline/thumbnail-generator.js';
import type { VideoScript } from '../../../../src/plugins/video-pipeline/types.js';

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

// ─── Sample VideoScript ───────────────────────────────────────────────────────

const sampleScript: VideoScript = {
  id: 'script-1',
  topic: 'How to build wealth on a budget',
  format: 'long_form',
  outline: {
    hook: 'You don\'t need $1000 to start investing.',
    sections: [
      {
        heading: 'Start Small',
        keyPoints: ['$5 investments exist', 'Fractional shares'],
        graphicCue: null,
      },
    ],
    cta: 'Subscribe for weekly money tips',
  },
  fullScript: 'Full script content here...',
  estimatedDuration: 12,
  targetKeywords: ['investing', 'wealth'],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};

// ─── Mock orchestrator chat callback ─────────────────────────────────────────

const mockOrchestratorChat = vi.fn<
  [Array<{ role: string; content: string }>],
  Promise<string>
>();

// ─── Mock OpenAI image response ───────────────────────────────────────────────

function mockImageResponse(b64 = 'dGVzdA==') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data: [{ b64_json: b64, revised_prompt: 'A thumbnail' }],
    }),
    text: () => Promise.resolve('{}'),
  });
}

function mockImageError(status = 401) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
    text: () => Promise.resolve('Unauthorized'),
  });
}

describe('ThumbnailGenerator', () => {
  let generator: ThumbnailGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new ThumbnailGenerator('test-openai-key');
    mockOrchestratorChat.mockResolvedValue(
      'DALL-E prompt: A person holding money with text WEALTH SECRETS',
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateConcept', () => {
    it('should call orchestratorChat with script topic in prompt', async () => {
      await generator.generateConcept(sampleScript, mockOrchestratorChat);

      expect(mockOrchestratorChat).toHaveBeenCalledOnce();
      const [messages] = mockOrchestratorChat.mock.calls[0];
      const allContent = messages.map((m) => m.content).join(' ');
      expect(allContent).toContain('How to build wealth');
    });

    it('should return the concept string from orchestratorChat', async () => {
      mockOrchestratorChat.mockResolvedValueOnce('DALL-E prompt: amazing thumbnail');
      const concept = await generator.generateConcept(sampleScript, mockOrchestratorChat);
      expect(concept).toBe('DALL-E prompt: amazing thumbnail');
    });
  });

  describe('generateImage', () => {
    it('should call DALL-E API and return output path', async () => {
      mockFetch.mockResolvedValueOnce(mockImageResponse());

      const outputPath = await generator.generateImage(
        sampleScript,
        'DALL-E prompt: test',
        '/tmp/thumbnails',
        0,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('images/generations'),
        expect.any(Object),
      );
      expect(outputPath).toContain('/tmp/thumbnails');
      expect(outputPath).toContain('.png');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(mockImageError());

      await expect(generator.generateImage(sampleScript, 'test', '/tmp', 0))
        .rejects.toThrow();
    });

    it('should use Bearer authorization header', async () => {
      mockFetch.mockResolvedValueOnce(mockImageResponse());

      await generator.generateImage(sampleScript, 'DALL-E prompt: test', '/tmp/thumbnails', 0);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer test-openai-key');
    });

    it('should throw when no API key is set', async () => {
      const generatorNoKey = new ThumbnailGenerator();
      await expect(generatorNoKey.generateImage(sampleScript, 'test', '/tmp', 0))
        .rejects.toThrow('OpenAI API key not configured');
    });
  });

  describe('generateVariants', () => {
    it('should generate 2 variants for A/B testing', async () => {
      mockOrchestratorChat.mockResolvedValue('DALL-E prompt: variant concept\n\nText overlay: WEALTH SECRETS');
      mockFetch
        .mockResolvedValueOnce(mockImageResponse('dmFyMQ=='))  // variant A
        .mockResolvedValueOnce(mockImageResponse('dmFyMg=='));  // variant B

      const result = await generator.generateVariants(
        sampleScript,
        '/tmp/thumbnails',
        mockOrchestratorChat,
      );

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toContain('thumbnail_v1.png');
      expect(result.variants[1]).toContain('thumbnail_v2.png');
      expect(result.concept).toContain('DALL-E prompt');
    });
  });
});
