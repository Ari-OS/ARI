import { createReadStream, statSync } from 'node:fs';
import { createLogger } from '../../kernel/logger.js';
import type { PublishJob } from './types.js';

const log = createLogger('video-youtube-publisher');

// ─── OAuth2 token refresh ─────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ─── YouTube API shapes ───────────────────────────────────────────────────────

interface YouTubeVideoInsertResponse {
  kind: string;
  id: string;
  status: {
    uploadStatus: string;
    privacyStatus: string;
    publishAt?: string;
  };
}

// ─── YouTube category IDs ─────────────────────────────────────────────────────

const YOUTUBE_CATEGORIES = {
  education:          27,
  howto:              26,
  scienceTechnology:  28,
  peopleBlogs:        22,
} as const;

// ─── Optimal publishing schedule ─────────────────────────────────────────────

// Based on SOP: Tue/Wed/Thu 12pm-3pm ET for long-form, any day 6-9pm ET for Shorts
// Returns ISO timestamp for next optimal slot
function nextPublishTime(platform: 'youtube' | 'youtube_shorts'): string {
  const now = new Date();

  if (platform === 'youtube_shorts') {
    // Next 6pm ET (22:00 UTC)
    const target = new Date(now);
    target.setUTCHours(22, 0, 0, 0);
    if (target <= now) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return target.toISOString();
  }

  // Long-form: next Tue/Wed/Thu at 12pm ET (17:00 UTC)
  const optimalDays = [2, 3, 4]; // Tue=2, Wed=3, Thu=4

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(now.getUTCDate() + offset);
    candidate.setUTCHours(17, 0, 0, 0); // 12pm ET = 17:00 UTC

    if (optimalDays.includes(candidate.getUTCDay()) && candidate > now) {
      return candidate.toISOString();
    }
  }

  // Fallback: 7 days from now
  const fallback = new Date(now);
  fallback.setUTCDate(now.getUTCDate() + 7);
  return fallback.toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE PUBLISHER
// ═══════════════════════════════════════════════════════════════════════════════

export class YouTubePublisher {
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly refreshToken: string | null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(params: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  }) {
    this.clientId = params.clientId ?? null;
    this.clientSecret = params.clientSecret ?? null;
    this.refreshToken = params.refreshToken ?? null;
  }

  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.refreshToken);
  }

  private requireConfig(): void {
    if (!this.isConfigured()) {
      throw new Error('YouTube credentials not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.');
    }
  }

  // ── OAuth2 access token ───────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    this.requireConfig();

    const body = new URLSearchParams({
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      refresh_token: this.refreshToken!,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube OAuth token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    log.info('YouTube access token refreshed');
    return this.accessToken;
  }

  // ── Upload video ──────────────────────────────────────────────────────────────

  async uploadVideo(params: {
    videoPath: string;
    thumbnailPath?: string;
    job: PublishJob;
    scheduleAt?: string;
  }): Promise<{ videoId: string }> {
    const { videoPath, thumbnailPath, job, scheduleAt } = params;

    this.requireConfig();
    const token = await this.getAccessToken();

    const isShorts = job.platform === 'youtube_shorts';
    const publishAt = scheduleAt ?? nextPublishTime(job.platform);

    log.info(
      { videoPath, platform: job.platform, publishAt, title: job.title },
      'Uploading video to YouTube',
    );

    // Step 1: Initiate resumable upload
    const metadata = {
      snippet: {
        title: job.title,
        description: job.description,
        tags: isShorts
          ? [...job.tags, 'shorts', 'youtubeshorts']
          : job.tags,
        categoryId: String(YOUTUBE_CATEGORIES.education),
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: scheduleAt ? 'private' : 'public',
        publishAt: scheduleAt ? publishAt : undefined,
        selfDeclaredMadeForKids: false,
      },
    };

    const fileSize = statSync(videoPath).size;

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`YouTube upload init failed: ${initResponse.status} ${errorText}`);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('YouTube did not return upload URL');
    }

    log.info({ uploadUrl: uploadUrl.slice(0, 80) }, 'Resumable upload URL received');

    // Step 2: Upload the file
    const fileStream = createReadStream(videoPath);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      fileStream.on('data', (chunk: string | Buffer) => {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk));
        }
      });
      fileStream.on('end', () => resolve());
      fileStream.on('error', reject);
    });

    const fileBuffer = Buffer.concat(chunks);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fileSize),
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(600_000), // 10 min upload timeout
    });

    if (!uploadResponse.ok && uploadResponse.status !== 200 && uploadResponse.status !== 201) {
      const errorText = await uploadResponse.text();
      throw new Error(`YouTube video upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const videoData = await uploadResponse.json() as YouTubeVideoInsertResponse;
    const videoId = videoData.id;

    log.info({ videoId, platform: job.platform }, 'YouTube video uploaded successfully');

    // Step 3 (optional): Set thumbnail
    if (thumbnailPath && videoId) {
      await this.setThumbnail(videoId, thumbnailPath, token);
    }

    return { videoId };
  }

  // ── Set thumbnail ─────────────────────────────────────────────────────────────

  private async setThumbnail(videoId: string, thumbnailPath: string, token: string): Promise<void> {
    log.info({ videoId, thumbnailPath }, 'Setting YouTube thumbnail');

    const { readFileSync } = await import('node:fs');
    const imageBuffer = readFileSync(thumbnailPath);

    const response = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/png',
          'Content-Length': String(imageBuffer.length),
        },
        body: imageBuffer,
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      log.warn({ videoId, status: response.status, error: errorText }, 'Failed to set thumbnail (non-fatal)');
      // Non-fatal — thumbnail can be set manually
    } else {
      log.info({ videoId }, 'Thumbnail set on YouTube video');
    }
  }

  // ── Build optimized description ───────────────────────────────────────────────

  static buildDescription(params: {
    descriptionCore: string;
    timestampsText?: string;
    channelName?: string;
    links?: Record<string, string>;
  }): string {
    const { descriptionCore, timestampsText, channelName, links } = params;
    const parts: string[] = [descriptionCore];

    if (timestampsText) {
      parts.push('', '── Timestamps ──', timestampsText);
    }

    if (links && Object.keys(links).length > 0) {
      parts.push('', '── Links ──');
      for (const [label, url] of Object.entries(links)) {
        parts.push(`${label}: ${url}`);
      }
    }

    if (channelName) {
      parts.push(
        '',
        '── Subscribe ──',
        `Subscribe to ${channelName} for more: https://youtube.com/@PayThePryce`,
      );
    }

    return parts.join('\n');
  }

  // ── Get recommended publish time ──────────────────────────────────────────────

  static getOptimalPublishTime(platform: 'youtube' | 'youtube_shorts'): string {
    return nextPublishTime(platform);
  }

  getConfigStatus(): { configured: boolean; details: string } {
    const configured = this.isConfigured();
    return {
      configured,
      details: configured
        ? 'YouTube OAuth credentials configured'
        : 'Missing: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN',
    };
  }
}
