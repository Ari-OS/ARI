import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createLogger } from '../../kernel/logger.js';
import type {
  CreateVideoParams,
  VideoStatusResult,
  Avatar,
  HeyGenVoice,
  HeyGenCreateResponse,
  HeyGenStatusResponse,
  HeyGenAvatarsResponse,
  HeyGenVoicesResponse,
} from './types.js';

const log = createLogger('video-avatar-renderer');

const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

// Dimensions by format
const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  long_form: { width: 1920, height: 1080 },
  short:     { width: 1080, height: 1920 },
  tutorial:  { width: 1920, height: 1080 },
};

// Polling config
const POLL_INTERVAL_MS = 30_000;  // 30 seconds between polls
const MAX_POLL_ATTEMPTS = 60;      // 30 min max wait (30s * 60)

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export class AvatarRenderer {
  private readonly apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? null;
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('HeyGen API key not configured. Set HEYGEN_API_KEY environment variable.');
    }
    return this.apiKey;
  }

  private authHeaders(): Record<string, string> {
    return {
      'X-Api-Key': this.requireApiKey(),
      'Content-Type': 'application/json',
    };
  }

  // ── Create Video ────────────────────────────────────────────────────────────

  async createVideo(params: CreateVideoParams): Promise<{ videoId: string }> {
    const { scriptText, avatarId, voiceId, format } = params;
    const dimensions = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS['long_form'];

    log.info(
      { avatarId, voiceId, format, scriptLength: scriptText.length },
      'Creating HeyGen avatar video',
    );

    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
          },
          voice: {
            type: 'text',
            input_text: scriptText,
            voice_id: voiceId,
          },
        },
      ],
      dimension: {
        width: dimensions.width,
        height: dimensions.height,
      },
    };

    const response = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'HeyGen createVideo request failed');
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as HeyGenCreateResponse;

    if (data.error) {
      throw new Error(`HeyGen API error: ${data.error}`);
    }

    log.info({ videoId: data.data.video_id, format }, 'HeyGen video creation initiated');
    return { videoId: data.data.video_id };
  }

  // ── Get Video Status ────────────────────────────────────────────────────────

  async getVideoStatus(videoId: string): Promise<VideoStatusResult> {
    log.info({ videoId }, 'Checking HeyGen video status');

    const response = await fetch(`${HEYGEN_API_BASE}/video/${videoId}`, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, videoId, error: errorText }, 'HeyGen status request failed');
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as HeyGenStatusResponse;

    if (data.error) {
      throw new Error(`HeyGen API error: ${data.error}`);
    }

    const normalizedStatus = this.normalizeStatus(data.data.status);

    log.info({ videoId, status: normalizedStatus }, 'HeyGen video status retrieved');

    return {
      status: normalizedStatus,
      videoUrl: data.data.video_url ?? null,
      duration: data.data.duration ?? null,
      error: data.data.error ?? null,
    };
  }

  // ── Poll Until Complete ─────────────────────────────────────────────────────

  async waitForCompletion(
    videoId: string,
    onProgress?: (attempt: number, status: string) => void,
  ): Promise<VideoStatusResult> {
    log.info({ videoId }, 'Polling HeyGen for video completion');

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const result = await this.getVideoStatus(videoId);

      onProgress?.(attempt, result.status);

      if (result.status === 'completed') {
        log.info({ videoId, attempt }, 'HeyGen video completed');
        return result;
      }

      if (result.status === 'failed') {
        log.error({ videoId, attempt, error: result.error }, 'HeyGen video failed');
        throw new Error(`HeyGen video ${videoId} failed: ${result.error ?? 'unknown error'}`);
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        log.info({ videoId, attempt, status: result.status }, `Waiting ${POLL_INTERVAL_MS / 1000}s before next poll`);
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    throw new Error(`HeyGen video ${videoId} did not complete after ${MAX_POLL_ATTEMPTS} polls (${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 60000} min)`);
  }

  // ── Download Video to Disk ──────────────────────────────────────────────────

  async downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
    log.info({ videoUrl, outputPath }, 'Downloading HeyGen video to disk');

    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(videoUrl, {
      signal: AbortSignal.timeout(300_000), // 5 min download timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from video download');
    }

    const fileStream = createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);

    log.info({ outputPath }, 'Video downloaded successfully');
  }

  // ── List Avatars ────────────────────────────────────────────────────────────

  async listAvatars(): Promise<Avatar[]> {
    log.info('Listing HeyGen avatars');

    const response = await fetch(`${HEYGEN_API_BASE}/avatars`, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'HeyGen listAvatars request failed');
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as HeyGenAvatarsResponse;

    if (data.error) {
      throw new Error(`HeyGen API error: ${data.error}`);
    }

    const avatars: Avatar[] = data.data.avatars.map((a) => ({
      avatarId: a.avatar_id,
      avatarName: a.avatar_name,
      gender: a.gender,
      previewImageUrl: a.preview_image_url ?? null,
    }));

    log.info({ count: avatars.length }, 'HeyGen avatars listed');
    return avatars;
  }

  // ── List Voices ─────────────────────────────────────────────────────────────

  async listVoices(): Promise<HeyGenVoice[]> {
    log.info('Listing HeyGen voices');

    const response = await fetch(`${HEYGEN_API_BASE}/voices`, {
      method: 'GET',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, error: errorText }, 'HeyGen listVoices request failed');
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as HeyGenVoicesResponse;

    if (data.error) {
      throw new Error(`HeyGen API error: ${data.error}`);
    }

    const voices: HeyGenVoice[] = data.data.voices.map((v) => ({
      voiceId: v.voice_id,
      language: v.language,
      gender: v.gender,
      name: v.name,
      previewAudioUrl: v.preview_audio ?? null,
      supportsPause: v.support_pause,
    }));

    log.info({ count: voices.length }, 'HeyGen voices listed');
    return voices;
  }

  // ── Delete Video ─────────────────────────────────────────────────────────────

  async deleteVideo(videoId: string): Promise<void> {
    log.info({ videoId }, 'Deleting HeyGen video');

    const response = await fetch(`${HEYGEN_API_BASE}/video/${videoId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error({ status: response.status, videoId, error: errorText }, 'HeyGen deleteVideo failed');
      throw new Error(`HeyGen API error ${response.status}: ${errorText}`);
    }

    log.info({ videoId }, 'HeyGen video deleted');
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private normalizeStatus(raw: string): VideoStatusResult['status'] {
    const lower = raw.toLowerCase();
    if (lower === 'completed' || lower === 'success') return 'completed';
    if (lower === 'failed' || lower === 'error') return 'failed';
    if (lower === 'processing' || lower === 'in_progress') return 'processing';
    return 'pending';
  }
}
