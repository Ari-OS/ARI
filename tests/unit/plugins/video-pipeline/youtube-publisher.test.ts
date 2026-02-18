import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YouTubePublisher } from '../../../../src/plugins/video-pipeline/youtube-publisher.js';
import type { PublishJob } from '../../../../src/plugins/video-pipeline/types.js';

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Mock fs — createReadStream must emit 'data' + 'end' for the upload to work ─

vi.mock('node:fs', () => {
  const makeStream = () => {
    const callbacks: Record<string, Array<(...args: unknown[]) => void>> = {};
    const stream = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!callbacks[event]) callbacks[event] = [];
        callbacks[event].push(cb);
        if (event === 'end') queueMicrotask(() => cb()); // auto-end
        return stream;
      }),
      pipe: vi.fn(),
    };
    return stream;
  };

  return {
    createReadStream: vi.fn(() => makeStream()),
    statSync: vi.fn().mockReturnValue({ size: 50 * 1024 * 1024 }), // 50MB
  };
});

// ─── Sample data ───────────────────────────────────────────────────────────────

const sampleJob: PublishJob = {
  videoPath: '/tmp/output.mp4',
  thumbnailPath: '/tmp/thumb.png',
  title: 'How I Made $10,000 in 30 Days',
  description: 'In this video I share my exact strategy...',
  tags: ['money', 'investing', 'wealth'],
  platform: 'youtube',
  scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockTokenOk() {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      access_token: 'ya29.mock-token',
      expires_in: 3600,
      token_type: 'Bearer',
    }),
    text: () => Promise.resolve('OK'),
  };
}

function mockInitUploadOk(uploadUrl = 'https://upload.example.com/upload-session-123') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => h === 'Location' ? uploadUrl : null },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('OK'),
  };
}

function mockUploadFileOk(videoId = 'dQw4w9WgXcQ') {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      kind: 'youtube#video',
      id: videoId,
      status: { uploadStatus: 'uploaded', privacyStatus: 'private' },
    }),
    text: () => Promise.resolve('OK'),
  };
}

function mockApiError(status = 401, message = 'Unauthorized') {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve({ error: { message } }),
    text: () => Promise.resolve(message),
  };
}

describe('YouTubePublisher', () => {
  let publisher: YouTubePublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = new YouTubePublisher({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadVideo', () => {
    it('should refresh token, initiate and complete resumable upload', async () => {
      mockFetch
        .mockResolvedValueOnce(mockTokenOk())         // getAccessToken
        .mockResolvedValueOnce(mockInitUploadOk())    // initiate resumable upload
        .mockResolvedValueOnce(mockUploadFileOk());   // upload file

      const result = await publisher.uploadVideo({
        videoPath: sampleJob.videoPath,
        job: sampleJob,
      });

      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should POST to Google OAuth token endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce(mockTokenOk())
        .mockResolvedValueOnce(mockInitUploadOk())
        .mockResolvedValueOnce(mockUploadFileOk());

      await publisher.uploadVideo({ videoPath: sampleJob.videoPath, job: sampleJob });

      const [tokenUrl] = mockFetch.mock.calls[0] as [string];
      expect(tokenUrl).toContain('oauth2.googleapis.com');
    });

    it('should include refresh_token in OAuth request body', async () => {
      mockFetch
        .mockResolvedValueOnce(mockTokenOk())
        .mockResolvedValueOnce(mockInitUploadOk())
        .mockResolvedValueOnce(mockUploadFileOk());

      await publisher.uploadVideo({ videoPath: sampleJob.videoPath, job: sampleJob });

      const [, tokenOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(tokenOptions.body?.toString()).toContain('test-refresh-token');
    });

    it('should throw when credentials are not configured', async () => {
      const unconfigured = new YouTubePublisher({});
      await expect(unconfigured.uploadVideo({ videoPath: '/tmp/v.mp4', job: sampleJob }))
        .rejects.toThrow();
    });

    it('should throw when token refresh fails', async () => {
      mockFetch.mockResolvedValueOnce(mockApiError(401));

      await expect(publisher.uploadVideo({ videoPath: sampleJob.videoPath, job: sampleJob }))
        .rejects.toThrow();
    });

    it('should cache access token for subsequent calls', async () => {
      mockFetch
        .mockResolvedValueOnce(mockTokenOk())           // first token fetch
        .mockResolvedValueOnce(mockInitUploadOk())      // first init
        .mockResolvedValueOnce(mockUploadFileOk())      // first upload
        .mockResolvedValueOnce(mockInitUploadOk())      // second init (no token fetch)
        .mockResolvedValueOnce(mockUploadFileOk());     // second upload

      await publisher.uploadVideo({ videoPath: sampleJob.videoPath, job: sampleJob });
      await publisher.uploadVideo({ videoPath: sampleJob.videoPath, job: sampleJob });

      // Token should only be fetched once
      const tokenCalls = (mockFetch.mock.calls as Array<[string]>).filter(
        ([url]) => url.includes('oauth2.googleapis.com'),
      );
      expect(tokenCalls).toHaveLength(1);
    });
  });

  describe('static methods', () => {
    it('getOptimalPublishTime returns future ISO timestamp for youtube', () => {
      const time = YouTubePublisher.getOptimalPublishTime('youtube');
      expect(new Date(time).getTime()).toBeGreaterThan(Date.now());
    });

    it('getOptimalPublishTime returns future ISO timestamp for youtube_shorts', () => {
      const time = YouTubePublisher.getOptimalPublishTime('youtube_shorts');
      expect(new Date(time).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
