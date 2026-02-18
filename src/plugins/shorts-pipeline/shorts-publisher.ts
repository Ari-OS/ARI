/**
 * Shorts Publisher — Cross-Platform Distribution for Short-Form Video
 *
 * Posts rendered shorts to YouTube Shorts, Instagram Reels, and TikTok
 * via their respective platform APIs. Gracefully skips unconfigured
 * platforms and records per-platform results.
 *
 * Layer: Plugins (Shorts Pipeline)
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('shorts-publisher');

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShortsPlatform = 'youtube-shorts' | 'instagram-reels' | 'tiktok';

export interface ShortsPublishJob {
  jobId: string;
  renderUrl: string;
  title: string;
  description: string;
  hashtags: string[];
  platforms: ShortsPlatform[];
  results: Array<{
    platform: string;
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
    publishedAt?: string;
  }>;
  completedAt?: string;
}

// ─── YouTube API shapes ───────────────────────────────────────────────────────

interface YouTubeVideoInsertResponse {
  kind: string;
  id: string;
  status: {
    uploadStatus: string;
    privacyStatus: string;
  };
}

// ─── Instagram Graph API shapes ───────────────────────────────────────────────

interface InstagramMediaContainerResponse {
  id: string;
}

interface InstagramPublishResponse {
  id: string;
}

// ─── TikTok API shapes ────────────────────────────────────────────────────────

interface TikTokPublishResponse {
  data: {
    publish_id: string;
  };
  error: {
    code: string;
    message: string;
  } | null;
}

// ─── ShortsPublisher ─────────────────────────────────────────────────────────

export class ShortsPublisher {
  private readonly eventBus: EventBus;
  private readonly youtubeAccessToken: string | null;
  private readonly instagramToken: string | null;
  private readonly tiktokToken: string | null;

  constructor(params: {
    eventBus: EventBus;
    youtubeAccessToken?: string;
    instagramToken?: string;
    tiktokToken?: string;
  }) {
    this.eventBus = params.eventBus;
    this.youtubeAccessToken = params.youtubeAccessToken ?? null;
    this.instagramToken = params.instagramToken ?? null;
    this.tiktokToken = params.tiktokToken ?? null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Publish a rendered short to one or more platforms.
   * Returns a job record with per-platform success/failure results.
   */
  async publish(params: {
    renderUrl: string;
    title: string;
    description: string;
    hashtags: string[];
    platforms?: ShortsPlatform[];
  }): Promise<ShortsPublishJob> {
    const jobId = randomUUID();
    const platforms = params.platforms ?? ['youtube-shorts'];
    const now = new Date().toISOString();

    const job: ShortsPublishJob = {
      jobId,
      renderUrl: params.renderUrl,
      title: params.title,
      description: params.description,
      hashtags: params.hashtags,
      platforms,
      results: [],
    };

    this.eventBus.emit('audit:log', {
      action: 'shorts_publish_started',
      agent: 'shorts-publisher',
      trustLevel: 'system',
      details: { jobId, platforms, timestamp: now },
    });

    log.info({ jobId, platforms, title: params.title }, 'Starting shorts publish job');

    // Fan out to each platform sequentially to avoid rate-limit collisions
    for (const platform of platforms) {
      try {
        switch (platform) {
          case 'youtube-shorts':
            await this.publishToYouTubeShorts(job);
            break;
          case 'instagram-reels':
            await this.publishToInstagram(job);
            break;
          case 'tiktok':
            await this.publishToTikTok(job);
            break;
        }
      } catch (error: unknown) {
        // Individual platform failures are captured in results; don't abort others
        const message = error instanceof Error ? error.message : String(error);
        log.error({ jobId, platform, error: message }, 'Unhandled error publishing to platform');
        job.results.push({ platform, success: false, error: message });

        this.eventBus.emit('content:publish_failed', {
          draftId: jobId,
          platform,
          error: message,
        });
      }
    }

    job.completedAt = new Date().toISOString();

    const successCount = job.results.filter((r) => r.success).length;
    const failCount = job.results.filter((r) => !r.success).length;
    const publishedIds = job.results
      .filter((r) => r.success && r.postId)
      .map((r) => r.postId as string);

    this.eventBus.emit('audit:log', {
      action: 'shorts_publish_completed',
      agent: 'shorts-publisher',
      trustLevel: 'system',
      details: { jobId, successCount, failCount, timestamp: job.completedAt },
    });

    if (publishedIds.length > 0) {
      this.eventBus.emit('content:published', {
        draftId: jobId,
        platform: platforms.join(','),
        publishedIds,
      });
    }

    log.info(
      { jobId, successCount, failCount, platforms },
      'Shorts publish job completed',
    );

    return job;
  }

  // ─── Platform Publishers ───────────────────────────────────────────────────

  private async publishToYouTubeShorts(job: ShortsPublishJob): Promise<void> {
    const platform = 'youtube-shorts';

    if (!this.youtubeAccessToken) {
      log.warn({ jobId: job.jobId }, 'YouTube not configured — skipping');
      job.results.push({ platform, success: false, error: 'not configured' });
      return;
    }

    log.info({ jobId: job.jobId }, 'Publishing to YouTube Shorts');

    // YouTube Shorts: video must include #Shorts in title or description.
    const shortsTitle = job.title.includes('#Shorts')
      ? job.title
      : `${job.title} #Shorts`;

    const hashtagString = job.hashtags.join(' ');
    const fullDescription = `${job.description}\n\n${hashtagString}\n\n#Shorts`;

    const metadata = {
      snippet: {
        title: shortsTitle,
        description: fullDescription,
        tags: [...job.hashtags.map((h) => h.replace(/^#/, '')), 'Shorts', 'YouTubeShorts'],
        categoryId: '22', // People & Blogs
        defaultLanguage: 'en',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    // Initiate resumable upload session
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.youtubeAccessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      const message = `YouTube upload init failed: ${initResponse.status} ${errorText}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      const message = 'YouTube did not return a resumable upload URL';
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    // Fetch the video bytes from the render URL
    const videoResponse = await fetch(job.renderUrl, {
      signal: AbortSignal.timeout(300_000),
    });

    if (!videoResponse.ok || !videoResponse.body) {
      const message = `Failed to fetch render URL: ${videoResponse.status}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const videoBytes = await videoResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBytes.byteLength),
      },
      body: videoBytes,
      signal: AbortSignal.timeout(600_000),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      const message = `YouTube video upload failed: ${uploadResponse.status} ${errorText}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const videoData = await uploadResponse.json() as YouTubeVideoInsertResponse;
    const videoId = videoData.id;
    const postUrl = `https://www.youtube.com/shorts/${videoId}`;
    const publishedAt = new Date().toISOString();

    job.results.push({ platform, success: true, postId: videoId, postUrl, publishedAt });

    this.eventBus.emit('content:published', {
      draftId: job.jobId,
      platform,
      publishedIds: [videoId],
    });

    log.info({ jobId: job.jobId, videoId, postUrl }, 'Published to YouTube Shorts');
  }

  private async publishToInstagram(job: ShortsPublishJob): Promise<void> {
    const platform = 'instagram-reels';

    if (!this.instagramToken) {
      log.warn({ jobId: job.jobId }, 'Instagram not configured — skipping');
      job.results.push({ platform, success: false, error: 'not configured' });
      return;
    }

    log.info({ jobId: job.jobId }, 'Publishing to Instagram Reels');

    // Instagram Graph API: two-step (create container, then publish)
    const hashtagString = job.hashtags.join(' ');
    const caption = `${job.description}\n\n${hashtagString}`;

    // Step 1: Create a Reels media container
    const containerResponse = await fetch(
      'https://graph.facebook.com/v18.0/me/media',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.instagramToken}`,
        },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: job.renderUrl,
          caption,
          share_to_feed: true,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!containerResponse.ok) {
      const errorText = await containerResponse.text();
      const message = `Instagram container creation failed: ${containerResponse.status} ${errorText}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const containerData = await containerResponse.json() as InstagramMediaContainerResponse;
    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishResponse = await fetch(
      'https://graph.facebook.com/v18.0/me/media_publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.instagramToken}`,
        },
        body: JSON.stringify({ creation_id: containerId }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      const message = `Instagram publish failed: ${publishResponse.status} ${errorText}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const publishData = await publishResponse.json() as InstagramPublishResponse;
    const postId = publishData.id;
    const publishedAt = new Date().toISOString();

    job.results.push({ platform, success: true, postId, publishedAt });

    this.eventBus.emit('content:published', {
      draftId: job.jobId,
      platform,
      publishedIds: [postId],
    });

    log.info({ jobId: job.jobId, postId }, 'Published to Instagram Reels');
  }

  private async publishToTikTok(job: ShortsPublishJob): Promise<void> {
    const platform = 'tiktok';

    if (!this.tiktokToken) {
      log.warn({ jobId: job.jobId }, 'TikTok not configured — skipping');
      job.results.push({ platform, success: false, error: 'not configured' });
      return;
    }

    log.info({ jobId: job.jobId }, 'Publishing to TikTok');

    // TikTok Content Posting API v2
    const hashtagString = job.hashtags.join(' ');

    const response = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tiktokToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: `${job.title} ${hashtagString}`.slice(0, 150),
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: job.renderUrl,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      const message = `TikTok publish failed: ${response.status} ${errorText}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const data = await response.json() as TikTokPublishResponse;

    if (data.error) {
      const message = `TikTok API error: ${data.error.code} — ${data.error.message}`;
      job.results.push({ platform, success: false, error: message });
      this.eventBus.emit('content:publish_failed', { draftId: job.jobId, platform, error: message });
      return;
    }

    const publishId = data.data.publish_id;
    const publishedAt = new Date().toISOString();

    job.results.push({ platform, success: true, postId: publishId, publishedAt });

    this.eventBus.emit('content:published', {
      draftId: job.jobId,
      platform,
      publishedIds: [publishId],
    });

    log.info({ jobId: job.jobId, publishId }, 'Published to TikTok');
  }
}
