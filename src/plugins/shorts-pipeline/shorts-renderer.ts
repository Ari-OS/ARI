/**
 * Shorts Renderer — Portrait-Mode Video Rendering for Short-Form Content
 *
 * Renders short-form video using the HeyGen API in portrait mode (9:16)
 * suitable for YouTube Shorts, TikTok, and Instagram Reels.
 *
 * Layer: Plugins (Shorts Pipeline)
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('shorts-renderer');

// ─── Constants ───────────────────────────────────────────────────────────────

const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

/** Portrait mode dimensions for Shorts/TikTok/Reels */
const PORTRAIT_WIDTH = 1080;
const PORTRAIT_HEIGHT = 1920;

/** Square mode dimensions */
const SQUARE_WIDTH = 1080;
const SQUARE_HEIGHT = 1080;

/** Default polling interval between HeyGen status checks */
const POLL_INTERVAL_MS = 5_000;

/** Default render timeout (10 minutes) */
const DEFAULT_TIMEOUT_MS = 600_000;

const DEFAULT_AVATAR_ID = 'shorts-avatar-v1';
const DEFAULT_VOICE_ID = 'natural-en-us';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShortsRenderJob {
  jobId: string;
  scriptId: string;
  avatarId: string;
  voiceId: string;
  script: string;
  style: 'portrait' | 'square';
  backgroundUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  renderUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ShortsRenderResult {
  jobId: string;
  renderUrl: string;
  durationSec: number;
  fileSizeBytes: number;
}

// ─── HeyGen API response shapes ───────────────────────────────────────────────

interface HeyGenCreateResponse {
  error: string | null;
  data: {
    video_id: string;
  };
}

interface HeyGenStatusResponse {
  error: string | null;
  data: {
    status: string;
    video_url?: string;
    duration?: number;
    error?: string;
  };
}

// ─── ShortsRenderer ──────────────────────────────────────────────────────────

export class ShortsRenderer {
  private readonly eventBus: EventBus;
  private readonly apiKey: string | null;
  private readonly jobs: Map<string, ShortsRenderJob> = new Map();

  constructor(params: { eventBus: EventBus; heygenApiKey?: string }) {
    this.eventBus = params.eventBus;
    this.apiKey = params.heygenApiKey ?? null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Submit a render job to HeyGen.
   * Falls back to mock completion when no API key is configured.
   */
  async render(params: {
    scriptId: string;
    script: string;
    avatarId?: string;
    voiceId?: string;
  }): Promise<ShortsRenderJob> {
    const jobId = randomUUID();
    const avatarId = params.avatarId ?? DEFAULT_AVATAR_ID;
    const voiceId = params.voiceId ?? DEFAULT_VOICE_ID;
    const now = new Date().toISOString();

    const job: ShortsRenderJob = {
      jobId,
      scriptId: params.scriptId,
      avatarId,
      voiceId,
      script: params.script,
      style: 'portrait',
      status: 'pending',
      createdAt: now,
    };

    this.jobs.set(jobId, job);

    this.eventBus.emit('audit:log', {
      action: 'shorts_render_submitted',
      agent: 'shorts-renderer',
      trustLevel: 'system',
      details: { jobId, scriptId: params.scriptId, timestamp: now },
    });

    this.eventBus.emit('video:stage_started', {
      projectId: jobId,
      stage: 'shorts_render',
      timestamp: now,
    });

    log.info({ jobId, scriptId: params.scriptId, avatarId, voiceId }, 'Shorts render job submitted');

    if (!this.apiKey) {
      return this.completeMock(job);
    }

    try {
      const heygenVideoId = await this.submitToHeygen(job);
      job.status = 'processing';
      // errorMessage slot stores the HeyGen video ID while polling
      this.jobs.set(jobId, { ...job, errorMessage: heygenVideoId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error({ jobId, error: message }, 'Failed to submit render to HeyGen');
      job.status = 'failed';
      job.errorMessage = message;
      job.completedAt = new Date().toISOString();
      this.jobs.set(jobId, job);
    }

    return this.jobs.get(jobId) ?? job;
  }

  /**
   * Poll HeyGen for the current render status of a job.
   */
  async pollStatus(jobId: string): Promise<ShortsRenderJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Shorts render job not found: ${jobId}`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }

    if (!this.apiKey) {
      return job;
    }

    // errorMessage slot stores the HeyGen video ID when status is 'processing'
    const heygenVideoId = job.errorMessage;
    if (!heygenVideoId) {
      return job;
    }

    try {
      const result = await this.fetchHeygenStatus(heygenVideoId);
      const updated = this.applyHeygenStatus(job, result);
      this.jobs.set(jobId, updated);
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn({ jobId, heygenVideoId, error: message }, 'Error polling HeyGen status');
      return job;
    }
  }

  /**
   * Poll until the render completes or the timeout elapses.
   */
  async waitForCompletion(
    jobId: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<ShortsRenderResult> {
    const deadline = Date.now() + timeoutMs;

    log.info({ jobId, timeoutMs }, 'Waiting for shorts render completion');

    while (Date.now() < deadline) {
      const job = await this.pollStatus(jobId);

      if (job.status === 'completed') {
        if (!job.renderUrl) {
          throw new Error(`Render job ${jobId} completed but has no render URL`);
        }

        const completedAt = job.completedAt ?? new Date().toISOString();

        this.eventBus.emit('video:stage_completed', {
          projectId: jobId,
          stage: 'shorts_render',
          data: { renderUrl: job.renderUrl },
          timestamp: completedAt,
        });

        this.eventBus.emit('audit:log', {
          action: 'shorts_render_completed',
          agent: 'shorts-renderer',
          trustLevel: 'system',
          details: { jobId, renderUrl: job.renderUrl, timestamp: completedAt },
        });

        log.info({ jobId, renderUrl: job.renderUrl }, 'Shorts render completed');

        return {
          jobId,
          renderUrl: job.renderUrl,
          durationSec: 0,
          fileSizeBytes: 0,
        };
      }

      if (job.status === 'failed') {
        throw new Error(
          `Shorts render job ${jobId} failed: ${job.errorMessage ?? 'unknown error'}`,
        );
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(
      `Shorts render job ${jobId} did not complete within ${timeoutMs / 60_000} minutes`,
    );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async submitToHeygen(job: ShortsRenderJob): Promise<string> {
    const dimensions =
      job.style === 'portrait'
        ? { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT }
        : { width: SQUARE_WIDTH, height: SQUARE_HEIGHT };

    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: job.avatarId,
          },
          voice: {
            type: 'text',
            input_text: job.script,
            voice_id: job.voiceId,
          },
          ...(job.backgroundUrl
            ? {
                background: {
                  type: 'image',
                  url: job.backgroundUrl,
                },
              }
            : {}),
        },
      ],
      dimension: dimensions,
    };

    const response = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as HeyGenCreateResponse;

    if (data.error) {
      throw new Error(`HeyGen API error: ${data.error}`);
    }

    log.info({ heygenVideoId: data.data.video_id }, 'HeyGen shorts render initiated');
    return data.data.video_id;
  }

  private async fetchHeygenStatus(heygenVideoId: string): Promise<HeyGenStatusResponse> {
    const response = await fetch(`${HEYGEN_API_BASE}/video/${heygenVideoId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': this.apiKey!,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen status API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<HeyGenStatusResponse>;
  }

  private applyHeygenStatus(job: ShortsRenderJob, result: HeyGenStatusResponse): ShortsRenderJob {
    const raw = result.data.status.toLowerCase();
    const updated = { ...job };

    if (raw === 'completed' || raw === 'success') {
      updated.status = 'completed';
      updated.renderUrl = result.data.video_url;
      updated.completedAt = new Date().toISOString();
      updated.errorMessage = undefined;
    } else if (raw === 'failed' || raw === 'error') {
      updated.status = 'failed';
      updated.errorMessage = result.data.error ?? 'HeyGen render failed';
      updated.completedAt = new Date().toISOString();
    } else {
      updated.status = 'processing';
    }

    return updated;
  }

  private completeMock(job: ShortsRenderJob): ShortsRenderJob {
    const completedAt = new Date().toISOString();
    const renderUrl = `https://mock-cdn.heygen.com/shorts/${job.jobId}.mp4`;

    const completed: ShortsRenderJob = {
      ...job,
      status: 'completed',
      renderUrl,
      completedAt,
      errorMessage: undefined,
    };

    this.jobs.set(job.jobId, completed);

    log.info({ jobId: job.jobId }, 'Shorts render mock completed (no API key configured)');

    this.eventBus.emit('video:stage_completed', {
      projectId: job.jobId,
      stage: 'shorts_render',
      data: { renderUrl, mock: true },
      timestamp: completedAt,
    });

    this.eventBus.emit('audit:log', {
      action: 'shorts_render_mock_completed',
      agent: 'shorts-renderer',
      trustLevel: 'system',
      details: { jobId: job.jobId, timestamp: completedAt },
    });

    return completed;
  }
}
