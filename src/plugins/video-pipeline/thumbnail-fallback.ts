/**
 * ARI Thumbnail Fallback Generator
 *
 * Generates thumbnails using fal.ai FLUX as a fallback when DALL-E fails.
 * Provides a reliable secondary path for image generation in the video pipeline.
 *
 * Layer: Plugin (video-pipeline)
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('video-thumbnail-fallback');

// ─── Types ───────────────────────────────────────────────────────────────────

export type ThumbnailStyle = 'youtube' | 'shorts' | 'blog';
export type ThumbnailProvider = 'fal_flux' | 'dall_e';

export interface ThumbnailFallbackResult {
  url: string;
  provider: ThumbnailProvider;
  prompt: string;
  dimensions: { width: number; height: number };
  generatedAt: string;
}

interface ThumbnailGenerateParams {
  prompt: string;
  style: ThumbnailStyle;
  width?: number;
  height?: number;
}

// ─── Style dimensions ────────────────────────────────────────────────────────

const STYLE_DEFAULTS: Record<ThumbnailStyle, { width: number; height: number; modifier: string }> = {
  youtube: {
    width: 1280,
    height: 720,
    modifier: 'YouTube thumbnail, bold text overlay, high contrast, dramatic, eye-catching, 16:9',
  },
  shorts: {
    width: 1080,
    height: 1920,
    modifier: 'YouTube Shorts cover, vertical, bold text, vibrant colors, mobile-optimized, 9:16',
  },
  blog: {
    width: 1200,
    height: 630,
    modifier: 'blog header image, clean design, professional, readable text overlay',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// THUMBNAIL FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

export class ThumbnailFallback {
  private readonly eventBus: EventBus;
  private readonly falApiKey: string | null;

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
    this.falApiKey = process.env.FAL_API_KEY ?? null;
  }

  /**
   * Generate a thumbnail using fal.ai FLUX.
   * Called as fallback when DALL-E generation fails.
   */
  async generate(params: ThumbnailGenerateParams): Promise<ThumbnailFallbackResult> {
    const { prompt, style } = params;
    const defaults = STYLE_DEFAULTS[style];
    const width = params.width ?? defaults.width;
    const height = params.height ?? defaults.height;
    const styledPrompt = `${prompt}. ${defaults.modifier}`;

    log.info({ prompt, style, width, height }, 'Generating thumbnail via fal.ai FLUX fallback');

    if (!this.falApiKey) {
      throw new Error('FAL_API_KEY not configured. Set FAL_API_KEY environment variable for thumbnail fallback.');
    }

    const url = await this.callFalFlux(styledPrompt, width, height);

    const result: ThumbnailFallbackResult = {
      url,
      provider: 'fal_flux',
      prompt: styledPrompt,
      dimensions: { width, height },
      generatedAt: new Date().toISOString(),
    };

    this.eventBus.emit('video:thumbnail_fallback_used', {
      url: result.url,
      provider: result.provider,
      prompt: result.prompt,
      timestamp: result.generatedAt,
    });

    log.info({ url, style }, 'Thumbnail fallback generated');
    return result;
  }

  // ── fal.ai FLUX API call ───────────────────────────────────────────────────

  private async callFalFlux(
    prompt: string,
    width: number,
    height: number,
  ): Promise<string> {
    const response = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${this.falApiKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: { width, height },
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(`fal.ai FLUX API returned ${response.status}: ${body}`);
    }

    const data = await response.json() as {
      images?: Array<{ url?: string }>;
    };

    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error('fal.ai FLUX API returned no image URL');
    }

    return imageUrl;
  }
}
