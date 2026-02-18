/**
 * Video Pipeline Orchestrator
 *
 * End-to-end automation: Topic → Script → HeyGen render → AssemblyAI captions
 * → FFmpeg assembly → DALL-E thumbnail → Telegram approval → YouTube publish.
 *
 * State machine persists VideoProject to ~/.ari/video-projects/<id>.json at
 * each stage so the pipeline survives restarts.
 *
 * Layer: L5 Execution (plugins)
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { ScriptGenerator } from './script-generator.js';
import type { AvatarRenderer } from './avatar-renderer.js';
import type { CaptionsGenerator } from './captions-generator.js';
import type { VideoAssembler } from './video-assembler.js';
import type { ThumbnailGenerator } from './thumbnail-generator.js';
import type { ApprovalGate } from './approval-gate.js';
import { YouTubePublisher } from './youtube-publisher.js';
import type { VideoProject, VideoFormat, VideoScript, VideoPipelineConfig } from './types.js';

const log = createLogger('video-pipeline-orchestrator');

// ─── Project persistence ──────────────────────────────────────────────────────

const PROJECTS_DIR = path.join(homedir(), '.ari', 'video-projects');

function ensureProjectsDir(): void {
  if (!existsSync(PROJECTS_DIR)) {
    mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function saveProject(project: VideoProject): void {
  ensureProjectsDir();
  const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
  writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
}

function loadProject(id: string): VideoProject | null {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as VideoProject;
}

function listProjectFiles(): string[] {
  ensureProjectsDir();
  return readdirSync(PROJECTS_DIR)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => path.join(PROJECTS_DIR, f));
}

// ─── OrchestratorAdapter (duck-typed) ────────────────────────────────────────

export interface OrchestratorChatAdapter {
  chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string>;
}

// ─── Progress callback ────────────────────────────────────────────────────────

export type ProgressCallback = (stage: string, message: string) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class PipelineOrchestrator {
  constructor(
    private readonly eventBus: EventBus,
    private readonly config: VideoPipelineConfig,
    private readonly scriptGenerator: ScriptGenerator,
    private readonly avatarRenderer: AvatarRenderer,
    private readonly captionsGenerator: CaptionsGenerator,
    private readonly videoAssembler: VideoAssembler,
    private readonly thumbnailGenerator: ThumbnailGenerator,
    private readonly approvalGate: ApprovalGate,
    private readonly youtubePublisher: YouTubePublisher,
    private readonly orchestratorChat: OrchestratorChatAdapter | null = null,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Run the full pipeline from topic to published video.
   * Returns the completed VideoProject.
   */
  async run(params: {
    topic: string;
    format?: VideoFormat;
    keywords?: string[];
    onProgress?: ProgressCallback;
  }): Promise<VideoProject> {
    const { topic, format = 'long_form', keywords = [], onProgress } = params;

    const progress = (stage: string, message: string): void => {
      log.info({ stage, topic }, message);
      onProgress?.(stage, message);
      this.eventBus.emit('video:stage_update', { stage, message, topic });
    };

    progress('init', `Starting pipeline for: "${topic}"`);

    // Create initial project record
    const outputDir = this.config.outputDir ?? path.join(homedir(), '.ari', 'video-output');
    const project: VideoProject = {
      id: randomUUID(),
      scriptId: '',
      format,
      title: topic,
      tags: keywords,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      status: 'scripting',
      createdAt: new Date().toISOString(),
    };

    saveProject(project);
    this.emitStageStart(project.id, 'scripting');

    // ── Stage 1: Script Generation ────────────────────────────────────────────
    progress('scripting', 'Generating script...');

    let script = await this.scriptGenerator.generate(topic, format, keywords);
    project.scriptId = script.id;
    project.title = topic;
    saveProject(project);

    progress('scripting', `Script generated (${script.estimatedDuration}min, v${script.version})`);
    this.emitStageComplete(project.id, 'scripting', { scriptId: script.id });

    // ── Stage 2: Script Approval ──────────────────────────────────────────────
    if (this.config.requireApproval) {
      const scriptApproved = await this.requestScriptApproval(project.id, script, progress);

      if (scriptApproved.action === 'edit') {
        // Edit loop: revise up to 3 times until approved or rejected
        const feedback = scriptApproved.editFeedback ?? scriptApproved.feedback;
        script = await this.reviseScriptLoop(script, feedback, project.id, progress);
        project.scriptId = script.id;
        saveProject(project);
      } else if (!scriptApproved.approved) {
        project.status = 'failed';
        saveProject(project);
        throw new Error(`Script rejected: ${scriptApproved.feedback}`);
      }
    }

    // ── Stage 3: HeyGen Render ────────────────────────────────────────────────
    project.status = 'rendering';
    saveProject(project);
    this.emitStageStart(project.id, 'rendering');
    progress('rendering', 'Submitting to HeyGen for avatar render...');

    const avatarId = this.config.avatarId ?? 'default';
    const voiceId = this.config.voiceId ?? 'default';

    const { videoId: heygenVideoId } = await this.avatarRenderer.createVideo({
      scriptText: script.fullScript,
      avatarId,
      voiceId,
      format,
    });

    project.avatarVideoId = heygenVideoId;
    saveProject(project);

    progress('rendering', `HeyGen render started (id: ${heygenVideoId}), waiting for completion...`);

    const renderResult = await this.avatarRenderer.waitForCompletion(
      heygenVideoId,
      (attempt, status) => {
        if (attempt % 3 === 0) {
          progress('rendering', `HeyGen status: ${status} (poll ${attempt})`);
        }
      },
    );

    if (!renderResult.videoUrl) {
      project.status = 'failed';
      saveProject(project);
      throw new Error('HeyGen render completed but returned no video URL');
    }

    project.avatarVideoUrl = renderResult.videoUrl;
    this.emitStageComplete(project.id, 'rendering', { videoUrl: renderResult.videoUrl });

    // Download video to disk
    const rawVideoPath = path.join(outputDir, project.id, 'raw.mp4');
    progress('rendering', 'Downloading rendered video...');
    await this.avatarRenderer.downloadVideo(renderResult.videoUrl, rawVideoPath);
    project.rawVideoPath = rawVideoPath;
    saveProject(project);
    progress('rendering', 'Render complete');

    // ── Stage 4: AssemblyAI Transcription ─────────────────────────────────────
    project.status = 'transcribing';
    saveProject(project);
    this.emitStageStart(project.id, 'transcribing');
    progress('transcribing', 'Generating captions via AssemblyAI...');

    const captionOutputDir = path.join(outputDir, project.id);
    const { srtPath } = await this.captionsGenerator.generateSrt(
      renderResult.videoUrl, // Use CDN URL for AssemblyAI (faster than local)
      captionOutputDir,
      project.id,
      script.targetKeywords, // word boost
    );

    this.emitStageComplete(project.id, 'transcribing', { srtPath });
    progress('transcribing', `Captions generated: ${srtPath}`);

    // ── Stage 5: FFmpeg Assembly ──────────────────────────────────────────────
    project.status = 'assembling';
    saveProject(project);
    this.emitStageStart(project.id, 'assembling');
    progress('assembling', 'Assembling video with captions...');

    let finalVideoPath: string;

    if (format === 'short') {
      finalVideoPath = await this.videoAssembler.produceShortsVideo({
        inputPath: rawVideoPath,
        srtPath,
        hookText: script.outline.hook.slice(0, 40),
        ctaText: script.outline.cta.slice(0, 40),
        startSeconds: 0,
        durationSeconds: 55,
        projectId: project.id,
      });
    } else {
      finalVideoPath = await this.videoAssembler.produceLongFormVideo({
        inputPath: rawVideoPath,
        srtPath,
        projectId: project.id,
      });
    }

    project.captionedVideoPath = finalVideoPath;
    project.outputPath = finalVideoPath;
    saveProject(project);
    this.emitStageComplete(project.id, 'assembling', { outputPath: finalVideoPath });
    progress('assembling', 'Video assembly complete');

    // ── Stage 6: Thumbnail Generation ─────────────────────────────────────────
    if (this.config.autoGenerateThumbnail && this.orchestratorChat) {
      progress('thumbnail', 'Generating thumbnail variants...');
      try {
        const thumbnailOutputDir = path.join(outputDir, project.id, 'thumbnails');
        const { variants } = await this.thumbnailGenerator.generateVariants(
          script,
          thumbnailOutputDir,
          (messages) => this.orchestratorChat!.chat(messages),
        );
        project.thumbnailPath = variants[0] ?? undefined;
        saveProject(project);
        progress('thumbnail', `Thumbnails generated: ${variants.length} variants`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn({ error: errorMsg }, 'Thumbnail generation failed (non-fatal)');
        progress('thumbnail', `Thumbnail generation failed (non-fatal): ${errorMsg}`);
      }
    }

    // ── Stage 7: Generate YouTube Metadata ────────────────────────────────────
    progress('metadata', 'Generating YouTube title, description, tags...');
    let metadata = { title: topic, description: '', tags: keywords };

    if (this.orchestratorChat) {
      try {
        metadata = await this.scriptGenerator.generateMetadata(script, keywords);
        project.title = metadata.title;
        project.description = metadata.description;
        project.tags = metadata.tags;
        saveProject(project);
        progress('metadata', `Title: "${metadata.title}"`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn({ error: errorMsg }, 'Metadata generation failed — using topic as title');
      }
    }

    // ── Stage 8: Publish Approval ─────────────────────────────────────────────
    project.status = 'ready';
    saveProject(project);
    this.emitStageStart(project.id, 'approval');

    if (this.config.requireApproval) {
      progress('approval', 'Requesting publish approval via Telegram...');

      const previewText = [
        `📹 Video ready for publish!`,
        ``,
        `Title: "${project.title}"`,
        `Format: ${format}`,
        `Duration: ~${script.estimatedDuration}min`,
        `Tags: ${project.tags.slice(0, 5).join(', ')}`,
        ``,
        `Description preview:`,
        project.description?.slice(0, 200) ?? '(no description)',
      ].join('\n');

      const publishApproval = await this.approvalGate.requestApproval({
        videoProjectId: project.id,
        type: 'publish',
        previewText,
        thumbnailPath: project.thumbnailPath,
      });

      if (!publishApproval.approved) {
        project.status = 'failed';
        saveProject(project);
        throw new Error(`Publish rejected: ${publishApproval.feedback}`);
      }

      progress('approval', 'Publish approved');
    }

    this.emitStageComplete(project.id, 'approval', {});

    // ── Stage 9: YouTube Upload ───────────────────────────────────────────────
    project.status = 'publishing';
    saveProject(project);
    this.emitStageStart(project.id, 'publishing');
    progress('publishing', 'Uploading to YouTube...');

    const platform: 'youtube' | 'youtube_shorts' = format === 'short' ? 'youtube_shorts' : 'youtube';
    const description = YouTubePublisher.buildDescription({
      descriptionCore: project.description ?? metadata.description,
      channelName: 'PayThePryce',
    });

    const publishJob = {
      id: randomUUID(),
      videoProjectId: project.id,
      platform,
      title: project.title,
      description,
      tags: project.tags,
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
    };

    const { videoId: youtubeVideoId } = await this.youtubePublisher.uploadVideo({
      videoPath: finalVideoPath,
      thumbnailPath: project.thumbnailPath,
      job: publishJob,
    });

    project.status = 'published';
    project.publishedAt = new Date().toISOString();
    saveProject(project);

    this.emitStageComplete(project.id, 'publishing', { youtubeVideoId });
    this.eventBus.emit('video:published', {
      projectId: project.id,
      youtubeVideoId,
      title: project.title,
      platform,
    });

    progress('done', `Published! YouTube video ID: ${youtubeVideoId}`);
    log.info({ projectId: project.id, youtubeVideoId, format }, 'Video pipeline complete');

    return project;
  }

  // ── List all projects ───────────────────────────────────────────────────────

  static listProjects(): VideoProject[] {
    ensureProjectsDir();
    const files = listProjectFiles();
    const projects: VideoProject[] = [];

    for (const file of files) {
      try {
        const raw = readFileSync(file, 'utf-8');
        projects.push(JSON.parse(raw) as VideoProject);
      } catch {
        // skip malformed files
      }
    }

    return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Load project ────────────────────────────────────────────────────────────

  static loadProject(id: string): VideoProject | null {
    return loadProject(id);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async requestScriptApproval(
    projectId: string,
    script: VideoScript,
    progress: ProgressCallback,
  ): Promise<{ approved: boolean; feedback: string; action: 'approve' | 'reject' | 'edit'; editFeedback?: string }> {
    progress('approval', 'Sending script for approval...');

    const previewText = [
      `📝 Script Draft for "${script.topic}" (v${script.version})`,
      ``,
      `Format: ${script.format} | ~${script.estimatedDuration}min`,
      ``,
      `HOOK: ${script.outline.hook}`,
      ``,
      `SECTIONS:`,
      ...script.outline.sections.map((s, i) =>
        `${i + 1}. ${s.heading}\n   ${s.keyPoints.slice(0, 2).join('\n   ')}`,
      ),
      ``,
      `CTA: ${script.outline.cta}`,
      ``,
      `--- Full script excerpt (first 500 chars) ---`,
      script.fullScript.slice(0, 500),
    ].join('\n');

    const result = await this.approvalGate.requestApproval({
      videoProjectId: projectId,
      type: 'script',
      previewText,
    });

    return result;
  }

  private async reviseScriptLoop(
    script: VideoScript,
    feedback: string,
    projectId: string,
    progress: ProgressCallback,
    maxRevisions = 3,
  ): Promise<VideoScript> {
    let current = script;

    for (let revision = 1; revision <= maxRevisions; revision++) {
      progress('revision', `Revising script (round ${revision})...`);
      current = await this.scriptGenerator.revise(current, feedback);
      saveProject({ ...PipelineOrchestrator.loadProject(projectId)!, scriptId: current.id });

      if (!this.config.requireApproval) break;

      const result = await this.requestScriptApproval(projectId, current, progress);

      if (result.approved) {
        progress('revision', `Script approved after ${revision} revision(s)`);
        break;
      }

      if (result.action === 'reject') {
        throw new Error(`Script rejected after ${revision} revision(s): ${result.feedback}`);
      }

      if (revision === maxRevisions) {
        throw new Error(`Script revision limit (${maxRevisions}) reached without approval`);
      }

      feedback = result.editFeedback ?? result.feedback;
    }

    return current;
  }

  private emitStageStart(projectId: string, stage: string): void {
    this.eventBus.emit('video:stage_started', {
      projectId,
      stage,
      timestamp: new Date().toISOString(),
    });
  }

  private emitStageComplete(projectId: string, stage: string, data: Record<string, unknown>): void {
    this.eventBus.emit('video:stage_completed', {
      projectId,
      stage,
      data,
      timestamp: new Date().toISOString(),
    });
  }
}
