import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoisted mock for execFileNoThrow ──────────────────────────────────────────

const { mockExecFileNoThrow } = vi.hoisted(() => ({
  mockExecFileNoThrow: vi.fn(),
}));

vi.mock('../../../../src/utils/execFileNoThrow.js', () => ({
  execFileNoThrow: mockExecFileNoThrow,
}));

// ── Mock fs ───────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
}));

// ── Import class AFTER mocks ──────────────────────────────────────────────────

import { VideoAssembler } from '../../../../src/plugins/video-pipeline/video-assembler.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ffmpegSuccess() {
  mockExecFileNoThrow.mockResolvedValue({ stdout: '', stderr: 'frame=100', status: 0 });
}

function ffmpegFail(stderr = 'Invalid input', status = 1) {
  mockExecFileNoThrow.mockResolvedValue({ stdout: '', stderr, status });
}

describe('VideoAssembler', () => {
  let assembler: VideoAssembler;

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new VideoAssembler('/tmp/videos');
    ffmpegSuccess();
  });

  describe('burnCaptions', () => {
    it('should call execFileNoThrow with ffmpeg and subtitle filter', async () => {
      await assembler.burnCaptions('/input.mp4', '/captions.srt', '/output.mp4');

      expect(mockExecFileNoThrow).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-i', '/input.mp4', '-y', '/output.mp4']),
        expect.objectContaining({ timeoutMs: expect.any(Number) }),
      );
    });

    it('should include subtitles filter in ffmpeg args', async () => {
      await assembler.burnCaptions('/input.mp4', '/captions.srt', '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      expect(args.join(' ')).toContain('subtitles=');
    });

    it('should throw when ffmpeg exits with non-zero status', async () => {
      ffmpegFail('No such file', 1);
      await expect(assembler.burnCaptions('/bad.mp4', '/srt', '/out.mp4'))
        .rejects.toThrow('FFmpeg exited with code 1');
    });

    it('should copy audio stream unchanged', async () => {
      await assembler.burnCaptions('/input.mp4', '/captions.srt', '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      expect(args).toContain('-c:a');
      expect(args).toContain('copy');
    });
  });

  describe('extractShortsClip', () => {
    it('should use crop filter for portrait format', async () => {
      await assembler.extractShortsClip('/input.mp4', 10, 30, '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      expect(args.join(' ')).toContain('crop=');
    });

    it('should include start time in seek args', async () => {
      await assembler.extractShortsClip('/input.mp4', 15, 45, '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      expect(args).toContain('-ss');
      expect(args).toContain('15');
    });

    it('should include duration in args', async () => {
      await assembler.extractShortsClip('/input.mp4', 0, 60, '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      expect(args).toContain('-t');
      expect(args).toContain('60');
    });
  });

  describe('addTextOverlays', () => {
    it('should include drawtext filter with hook and CTA text', async () => {
      await assembler.addTextOverlays('/input.mp4', 'My Hook', 'Subscribe!', '/output.mp4');

      const args = mockExecFileNoThrow.mock.calls[0][1] as string[];
      const argsStr = args.join(' ');
      expect(argsStr).toContain('drawtext=');
    });
  });

  describe('concatenate', () => {
    it('should write concat list and call ffmpeg with concat demuxer', async () => {
      const { writeFileSync } = await import('node:fs');

      await assembler.concatenate(['/a.mp4', '/b.mp4'], '/out.mp4');

      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
      expect(mockExecFileNoThrow).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-f', 'concat']),
        expect.any(Object),
      );
    });
  });

  describe('produceShortsVideo', () => {
    it('should run 3-step pipeline', async () => {
      await assembler.produceShortsVideo({
        inputPath: '/input.mp4',
        srtPath: '/caps.srt',
        hookText: 'Hook text here',
        ctaText: 'Subscribe now',
        startSeconds: 0,
        durationSeconds: 30,
        projectId: 'test-project',
      });

      // 3 ffmpeg calls: extractShortsClip, burnCaptions, addTextOverlays
      expect(mockExecFileNoThrow).toHaveBeenCalledTimes(3);
    });

    it('should return a path containing the projectId', async () => {
      const result = await assembler.produceShortsVideo({
        inputPath: '/input.mp4',
        srtPath: '/caps.srt',
        hookText: 'Hook',
        ctaText: 'CTA',
        startSeconds: 0,
        durationSeconds: 30,
        projectId: 'proj-abc',
      });

      expect(result).toContain('proj-abc');
    });
  });

  describe('produceLongFormVideo', () => {
    it('should burn captions and return output path', async () => {
      const result = await assembler.produceLongFormVideo({
        inputPath: '/input.mp4',
        srtPath: '/caps.srt',
        projectId: 'longform-1',
      });

      expect(mockExecFileNoThrow).toHaveBeenCalledTimes(1); // only burnCaptions
      expect(result).toContain('longform-1');
    });
  });
});
