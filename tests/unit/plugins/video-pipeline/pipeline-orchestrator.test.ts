import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineOrchestrator } from '../../../../src/plugins/video-pipeline/pipeline-orchestrator.js';
import type { OrchestratorChatAdapter } from '../../../../src/plugins/video-pipeline/pipeline-orchestrator.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { ScriptGenerator } from '../../../../src/plugins/video-pipeline/script-generator.js';
import type { AvatarRenderer } from '../../../../src/plugins/video-pipeline/avatar-renderer.js';
import type { CaptionsGenerator } from '../../../../src/plugins/video-pipeline/captions-generator.js';
import type { VideoAssembler } from '../../../../src/plugins/video-pipeline/video-assembler.js';
import type { ThumbnailGenerator } from '../../../../src/plugins/video-pipeline/thumbnail-generator.js';
import type { ApprovalGate } from '../../../../src/plugins/video-pipeline/approval-gate.js';
import type { YouTubePublisher } from '../../../../src/plugins/video-pipeline/youtube-publisher.js';
import { VideoPipelineConfigSchema } from '../../../../src/plugins/video-pipeline/types.js';
import type { VideoScript, VideoProject } from '../../../../src/plugins/video-pipeline/types.js';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

// ─── Mock os.homedir to use tmpDir ────────────────────────────────────────────
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: () => process.env.HOME || actual.homedir(),
  };
});

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeScript(overrides: Partial<VideoScript> = {}): VideoScript {
  return {
    id: randomUUID(),
    topic: 'How to build wealth',
    format: 'long_form',
    outline: {
      hook: 'Most people will never be wealthy — here is why',
      hookVariants: ['Rich people know this secret', 'The one thing that changes everything'],
      sections: [
        {
          heading: 'The wealth gap',
          keyPoints: ['Income vs wealth', 'Time in market', 'Compound interest'],
        },
      ],
      shortsClipHint: 'Section 1 compound interest explanation',
      cta: 'Subscribe for weekly wealth tips',
    },
    fullScript: 'Most people will never be wealthy. Here is exactly why, and how to fix it.',
    estimatedDuration: 12,
    targetKeywords: ['wealth', 'investing', 'financial freedom'],
    status: 'draft',
    version: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Mock builders ──────────────────────────────────────────────────────────────

function mockScriptGenerator(script: VideoScript): Partial<ScriptGenerator> {
  return {
    generate: vi.fn().mockResolvedValue(script),
    generateMetadata: vi.fn().mockResolvedValue({
      title: 'How to Build Wealth Fast',
      description: 'In this video I reveal the secrets of wealth building.',
      tags: ['wealth', 'investing'],
    }),
    revise: vi.fn().mockResolvedValue({ ...script, version: 2 }),
  };
}

function mockAvatarRenderer(videoUrl = 'https://cdn.heygen.com/video/test.mp4'): Partial<AvatarRenderer> {
  return {
    createVideo: vi.fn().mockResolvedValue({ videoId: 'heygen-abc123' }),
    waitForCompletion: vi.fn().mockResolvedValue({
      status: 'completed',
      videoUrl,
      duration: 720,
      error: null,
    }),
    downloadVideo: vi.fn().mockResolvedValue(undefined),
  };
}

function mockCaptionsGenerator(srtPath = '/tmp/test.srt'): Partial<CaptionsGenerator> {
  return {
    generateSrt: vi.fn().mockResolvedValue({
      transcriptId: 'transcript-abc',
      srtContent: '1\n00:00:00,000 --> 00:00:02,000\nMost people will never be wealthy.\n',
      srtPath,
    }),
  };
}

function mockVideoAssembler(outputPath = '/tmp/output.mp4'): Partial<VideoAssembler> {
  return {
    produceLongFormVideo: vi.fn().mockResolvedValue(outputPath),
    produceShortsVideo: vi.fn().mockResolvedValue(outputPath),
  };
}

function mockThumbnailGenerator(): Partial<ThumbnailGenerator> {
  return {
    generateVariants: vi.fn().mockResolvedValue({
      concept: 'Bold thumbnail with shocked face',
      textOverlay: 'NEVER BE POOR',
      variants: ['/tmp/thumb_v1.png', '/tmp/thumb_v2.png'],
    }),
  };
}

function mockApprovalGate(approved = true): Partial<ApprovalGate> {
  return {
    requestApproval: vi.fn().mockResolvedValue({
      approved,
      feedback: approved ? 'Looks great!' : 'Not good enough',
      action: approved ? 'approve' : 'reject',
    }),
  };
}

function mockYouTubePublisher(videoId = 'yt-vid-abc123'): Partial<YouTubePublisher> {
  return {
    uploadVideo: vi.fn().mockResolvedValue({ videoId }),
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ari-orch-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  // Override PROJECTS_DIR via home dir mock — handled via vi.stubEnv
  vi.stubEnv('HOME', tmpDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Factory ───────────────────────────────────────────────────────────────────

function makeOrchestrator(options: {
  script?: VideoScript;
  requireApproval?: boolean;
  approvalResult?: boolean;
  format?: 'long_form' | 'short';
} = {}): PipelineOrchestrator {
  const script = options.script ?? makeScript();
  const requireApproval = options.requireApproval ?? false;

  const eventBus = new EventBus();
  const config = VideoPipelineConfigSchema.parse({
    heygenApiKey: 'test-heygen-key',
    avatarId: 'avatar-1',
    voiceId: 'voice-1',
    assemblyAiApiKey: 'test-assembly-key',
    youtubeClientId: 'yt-client',
    youtubeClientSecret: 'yt-secret',
    youtubeRefreshToken: 'yt-refresh',
    openaiApiKey: 'test-openai-key',
    outputDir: join(tmpDir, 'video-output'),
    requireApproval,
    autoGenerateThumbnail: true,
  });

  const orchAdapter: OrchestratorChatAdapter = {
    chat: vi.fn().mockResolvedValue('mock chat response'),
  };

  return new PipelineOrchestrator(
    eventBus,
    config,
    mockScriptGenerator(script) as ScriptGenerator,
    mockAvatarRenderer() as AvatarRenderer,
    mockCaptionsGenerator() as CaptionsGenerator,
    mockVideoAssembler(join(tmpDir, 'final.mp4')) as VideoAssembler,
    mockThumbnailGenerator() as ThumbnailGenerator,
    mockApprovalGate(options.approvalResult ?? true) as ApprovalGate,
    mockYouTubePublisher() as YouTubePublisher,
    orchAdapter,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PipelineOrchestrator', () => {
  describe('run — happy path (no approval)', () => {
    it('should complete full pipeline and return published project', async () => {
      const orch = makeOrchestrator({ requireApproval: false });

      const project = await orch.run({ topic: 'How to build wealth', format: 'long_form' });

      expect(project.status).toBe('published');
      expect(project.avatarVideoId).toBe('heygen-abc123');
      expect(project.captionedVideoPath).toBeTruthy();
      expect(project.publishedAt).toBeTruthy();
    });

    it('should call all pipeline stages in order', async () => {
      const script = makeScript();
      const scriptGen = mockScriptGenerator(script) as ScriptGenerator;
      const avatarRend = mockAvatarRenderer() as AvatarRenderer;
      const captionsGen = mockCaptionsGenerator() as CaptionsGenerator;
      const videoAsm = mockVideoAssembler() as VideoAssembler;
      const thumbGen = mockThumbnailGenerator() as ThumbnailGenerator;
      const approvalGate = mockApprovalGate() as ApprovalGate;
      const ytPublisher = mockYouTubePublisher() as YouTubePublisher;

      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        openaiApiKey: 'ok', outputDir: join(tmpDir, 'out'),
        requireApproval: false, autoGenerateThumbnail: false,
      });

      const orchAdapter: OrchestratorChatAdapter = { chat: vi.fn().mockResolvedValue('ok') };
      const orch = new PipelineOrchestrator(
        eventBus, config, scriptGen, avatarRend, captionsGen,
        videoAsm, thumbGen, approvalGate, ytPublisher, orchAdapter,
      );

      await orch.run({ topic: 'Test' });

      expect(scriptGen.generate).toHaveBeenCalledWith('Test', 'long_form', []);
      expect(avatarRend.createVideo).toHaveBeenCalled();
      expect(avatarRend.waitForCompletion).toHaveBeenCalledWith('heygen-abc123', expect.any(Function));
      expect(avatarRend.downloadVideo).toHaveBeenCalled();
      expect(captionsGen.generateSrt).toHaveBeenCalled();
      expect(videoAsm.produceLongFormVideo).toHaveBeenCalled();
      expect(ytPublisher.uploadVideo).toHaveBeenCalled();
    });

    it('should pass keywords to script generator and metadata', async () => {
      const orch = makeOrchestrator({ requireApproval: false });

      await orch.run({
        topic: 'Personal finance',
        keywords: ['investing', 'savings', 'wealth'],
      });

      // Script generator should receive keywords
      const scriptGenSpy = (orch as unknown as {
        scriptGenerator: { generate: ReturnType<typeof vi.fn> }
      }).scriptGenerator.generate;
      expect(scriptGenSpy).toHaveBeenCalledWith('Personal finance', 'long_form', ['investing', 'savings', 'wealth']);
    });

    it('should invoke produceShortsVideo for short format', async () => {
      const script = makeScript({ format: 'short' });
      const videoAsm = mockVideoAssembler() as VideoAssembler;
      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: false, autoGenerateThumbnail: false,
      });
      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        videoAsm,
        mockThumbnailGenerator() as ThumbnailGenerator,
        mockApprovalGate() as ApprovalGate,
        mockYouTubePublisher() as YouTubePublisher,
        null,
      );

      await orch.run({ topic: 'Quick tip', format: 'short' });

      expect(videoAsm.produceShortsVideo).toHaveBeenCalled();
      expect(videoAsm.produceLongFormVideo).not.toHaveBeenCalled();
    });

    it('should emit video:published event on success', async () => {
      const eventBus = new EventBus();
      const script = makeScript();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: false, autoGenerateThumbnail: false,
      });

      const publishedEvents: unknown[] = [];
      eventBus.on('video:published', (payload) => publishedEvents.push(payload));

      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        mockThumbnailGenerator() as ThumbnailGenerator,
        mockApprovalGate() as ApprovalGate,
        mockYouTubePublisher('yt-published-123') as YouTubePublisher,
        null,
      );

      await orch.run({ topic: 'Test topic' });

      expect(publishedEvents).toHaveLength(1);
      expect((publishedEvents[0] as Record<string, string>).youtubeVideoId).toBe('yt-published-123');
    });

    it('should call onProgress callback at each stage', async () => {
      const orch = makeOrchestrator({ requireApproval: false });
      const stages: string[] = [];

      await orch.run({
        topic: 'Test',
        onProgress: (stage) => stages.push(stage),
      });

      expect(stages).toContain('scripting');
      expect(stages).toContain('rendering');
      expect(stages).toContain('transcribing');
      expect(stages).toContain('assembling');
      expect(stages).toContain('publishing');
      expect(stages).toContain('done');
    });
  });

  describe('run — with approval gates', () => {
    it('should request script approval when requireApproval is true', async () => {
      const approvalGate = mockApprovalGate(true) as ApprovalGate;
      const script = makeScript();
      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: true, autoGenerateThumbnail: false,
      });

      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        mockThumbnailGenerator() as ThumbnailGenerator,
        approvalGate,
        mockYouTubePublisher() as YouTubePublisher,
        null,
      );

      await orch.run({ topic: 'Test' });

      // Should request script approval AND publish approval
      expect(approvalGate.requestApproval).toHaveBeenCalledTimes(2);
      const calls = (approvalGate.requestApproval as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0].type).toBe('script');
      expect(calls[1][0].type).toBe('publish');
    });

    it('should throw when script is rejected', async () => {
      const approvalGate = mockApprovalGate(false) as ApprovalGate;
      const script = makeScript();
      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: true, autoGenerateThumbnail: false,
      });

      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        mockThumbnailGenerator() as ThumbnailGenerator,
        approvalGate,
        mockYouTubePublisher() as YouTubePublisher,
        null,
      );

      await expect(orch.run({ topic: 'Test' }))
        .rejects.toThrow('Script rejected');
    });

    it('should revise script when edit feedback is given', async () => {
      const script = makeScript();
      const scriptGen = mockScriptGenerator(script) as ScriptGenerator;

      // First approval: edit; second approval: approve
      let callCount = 0;
      const approvalGate: Partial<ApprovalGate> = {
        requestApproval: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return { approved: false, feedback: 'Make it more punchy', action: 'edit', editFeedback: 'More punchy!' };
          }
          return { approved: true, feedback: '', action: 'approve' };
        }),
      };

      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: true, autoGenerateThumbnail: false,
      });

      const orch = new PipelineOrchestrator(
        eventBus, config,
        scriptGen,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        mockThumbnailGenerator() as ThumbnailGenerator,
        approvalGate as ApprovalGate,
        mockYouTubePublisher() as YouTubePublisher,
        null,
      );

      const project = await orch.run({ topic: 'Test' });

      expect(scriptGen.revise).toHaveBeenCalledWith(expect.objectContaining({ topic: 'How to build wealth' }), 'More punchy!');
      expect(project.status).toBe('published');
    });
  });

  describe('run — error handling', () => {
    it('should set status to failed when HeyGen render fails', async () => {
      const avatarRend: Partial<AvatarRenderer> = {
        createVideo: vi.fn().mockResolvedValue({ videoId: 'hg-123' }),
        waitForCompletion: vi.fn().mockRejectedValue(new Error('HeyGen render failed: quota exceeded')),
        downloadVideo: vi.fn(),
      };

      const script = makeScript();
      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        outputDir: join(tmpDir, 'out'),
        requireApproval: false, autoGenerateThumbnail: false,
      });

      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        avatarRend as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        mockThumbnailGenerator() as ThumbnailGenerator,
        mockApprovalGate() as ApprovalGate,
        mockYouTubePublisher() as YouTubePublisher,
        null,
      );

      await expect(orch.run({ topic: 'Test' })).rejects.toThrow('HeyGen render failed');
    });

    it('should continue without thumbnail if generation fails', async () => {
      const thumbGen: Partial<ThumbnailGenerator> = {
        generateVariants: vi.fn().mockRejectedValue(new Error('OpenAI quota exceeded')),
      };

      const script = makeScript();
      const eventBus = new EventBus();
      const config = VideoPipelineConfigSchema.parse({
        heygenApiKey: 'hk', avatarId: 'a1', voiceId: 'v1',
        assemblyAiApiKey: 'ak', youtubeClientId: 'yc',
        youtubeClientSecret: 'ys', youtubeRefreshToken: 'yr',
        openaiApiKey: 'ok',
        outputDir: join(tmpDir, 'out'),
        requireApproval: false, autoGenerateThumbnail: true,
      });

      const orchAdapter: OrchestratorChatAdapter = { chat: vi.fn().mockResolvedValue('ok') };

      const orch = new PipelineOrchestrator(
        eventBus, config,
        mockScriptGenerator(script) as ScriptGenerator,
        mockAvatarRenderer() as AvatarRenderer,
        mockCaptionsGenerator() as CaptionsGenerator,
        mockVideoAssembler() as VideoAssembler,
        thumbGen as ThumbnailGenerator,
        mockApprovalGate() as ApprovalGate,
        mockYouTubePublisher() as YouTubePublisher,
        orchAdapter,
      );

      // Should NOT throw — thumbnail failure is non-fatal
      const project = await orch.run({ topic: 'Test' });
      expect(project.status).toBe('published');
      expect(project.thumbnailPath).toBeUndefined();
    });
  });

  describe('static helpers', () => {
    it('listProjects returns empty array when no projects', () => {
      const projects = PipelineOrchestrator.listProjects();
      expect(Array.isArray(projects)).toBe(true);
    });

    it('loadProject returns null for unknown id', () => {
      const result = PipelineOrchestrator.loadProject('non-existent-id');
      expect(result).toBeNull();
    });

    it('listProjects returns saved project after run', async () => {
      const orch = makeOrchestrator({ requireApproval: false });
      await orch.run({ topic: 'Persisted project test' });

      const projects = PipelineOrchestrator.listProjects();
      expect(projects.length).toBeGreaterThanOrEqual(1);
      expect(projects[0]?.status).toBe('published');
    });
  });
});
