import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AvatarRenderer } from '../../../../src/plugins/video-pipeline/avatar-renderer.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('AvatarRenderer', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Test 1: Create Video Request ─────────────────────────────────────────

  it('should create video request with correct params', async () => {
    const renderer = new AvatarRenderer('test-api-key');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { video_id: 'vid-abc-123' },
        error: null,
      }),
    });

    const result = await renderer.createVideo({
      scriptText: 'This is a test script.',
      avatarId: 'avatar-1',
      voiceId: 'voice-1',
      dimensions: { width: 1920, height: 1080 },
    });

    expect(result.videoId).toBe('vid-abc-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.heygen.com/v2/video/generate');
    expect(options.method).toBe('POST');

    const headers = options.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('test-api-key');

    const body = JSON.parse(options.body as string) as {
      video_inputs: Array<{
        character: { type: string; avatar_id: string };
        voice: { type: string; voice_id: string; input_text: string };
      }>;
      dimension: { width: number; height: number };
    };
    expect(body.video_inputs[0]?.character.avatar_id).toBe('avatar-1');
    expect(body.video_inputs[0]?.voice.voice_id).toBe('voice-1');
    expect(body.video_inputs[0]?.voice.input_text).toBe('This is a test script.');
    expect(body.dimension.width).toBe(1920);
    expect(body.dimension.height).toBe(1080);
  });

  // ── Test 2: Check Video Status ────────────────────────────────────────────

  it('should check video status', async () => {
    const renderer = new AvatarRenderer('test-api-key');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'completed',
          video_url: 'https://cdn.heygen.com/videos/vid-abc-123.mp4',
          duration: 180,
        },
        error: null,
      }),
    });

    const result = await renderer.getVideoStatus('vid-abc-123');

    expect(result.status).toBe('completed');
    expect(result.videoUrl).toBe('https://cdn.heygen.com/videos/vid-abc-123.mp4');
    expect(result.duration).toBe(180);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('vid-abc-123');
  });

  // ── Test 3: Throw When No API Key ─────────────────────────────────────────

  it('should throw when no API key configured', async () => {
    const renderer = new AvatarRenderer();

    await expect(
      renderer.createVideo({
        scriptText: 'Test script',
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
      }),
    ).rejects.toThrow('HeyGen API key not configured');

    await expect(renderer.getVideoStatus('some-id')).rejects.toThrow(
      'HeyGen API key not configured',
    );

    await expect(renderer.listAvatars()).rejects.toThrow('HeyGen API key not configured');

    // fetch should never have been called
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── Test 4: Handle API Errors Gracefully ─────────────────────────────────

  it('should handle API errors gracefully', async () => {
    const renderer = new AvatarRenderer('test-api-key');

    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    await expect(
      renderer.createVideo({
        scriptText: 'Test',
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
      }),
    ).rejects.toThrow('HeyGen API error 429');
  });

  // ── Test 5: List Avatars ───────────────────────────────────────────────────

  it('should list avatars', async () => {
    const renderer = new AvatarRenderer('test-api-key');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          avatars: [
            {
              avatar_id: 'avatar-001',
              avatar_name: 'Alex',
              gender: 'male',
              preview_image_url: 'https://cdn.heygen.com/avatars/alex.jpg',
            },
            {
              avatar_id: 'avatar-002',
              avatar_name: 'Sarah',
              gender: 'female',
              preview_image_url: null,
            },
          ],
        },
        error: null,
      }),
    });

    const avatars = await renderer.listAvatars();

    expect(avatars).toHaveLength(2);
    expect(avatars[0]?.avatarId).toBe('avatar-001');
    expect(avatars[0]?.avatarName).toBe('Alex');
    expect(avatars[0]?.gender).toBe('male');
    expect(avatars[0]?.previewImageUrl).toBe('https://cdn.heygen.com/avatars/alex.jpg');
    expect(avatars[1]?.avatarId).toBe('avatar-002');
    expect(avatars[1]?.previewImageUrl).toBeNull();
  });
});
