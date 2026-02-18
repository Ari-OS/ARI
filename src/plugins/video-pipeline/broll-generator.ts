/**
 * ARI B-Roll Generator
 *
 * Generates B-roll video clips using AI video generation APIs.
 * Primary provider: Seedance 2.0. Fallbacks: Runway, Pika.
 *
 * B-roll is supplementary footage intercut with the main shot to
 * add visual interest, context, and production value.
 *
 * Layer: Plugin (video-pipeline)
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('video-broll-generator');

// ─── Types ───────────────────────────────────────────────────────────────────

export type BRollStyle = 'cinematic' | 'documentary' | 'tutorial' | 'social';
export type BRollAspectRatio = '16:9' | '9:16' | '1:1';
export type BRollProvider = 'seedance' | 'runway' | 'pika';

export interface BRollResult {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  style: string;
  generatedAt: string;
  provider: BRollProvider;
}

interface BRollGenerateParams {
  prompt: string;
  duration: number;
  style: BRollStyle;
  aspectRatio: BRollAspectRatio;
}

// ─── Style prompt modifiers ──────────────────────────────────────────────────

const STYLE_MODIFIERS: Record<BRollStyle, string> = {
  cinematic: 'cinematic look, shallow depth of field, dramatic lighting, film grain, slow motion',
  documentary: 'documentary style, natural lighting, handheld feel, realistic, observational',
  tutorial: 'clean, well-lit, overhead angle, crisp focus, minimal background, instructional',
  social: 'vibrant colors, dynamic movement, energetic, trendy, vertical-friendly',
};

const ASPECT_DIMENSIONS: Record<BRollAspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// B-ROLL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class BRollGenerator {
  private readonly eventBus: EventBus;
  private readonly seedanceApiKey: string | null;
  private readonly runwayApiKey: string | null;
  private readonly pikaApiKey: string | null;

  constructor(params: { eventBus: EventBus }) {
    this.eventBus = params.eventBus;
    this.seedanceApiKey = process.env.SEEDANCE_API_KEY ?? null;
    this.runwayApiKey = process.env.RUNWAY_API_KEY ?? null;
    this.pikaApiKey = process.env.PIKA_API_KEY ?? null;
  }

  /**
   * Generate a single B-roll clip.
   * Tries Seedance first, then Runway, then Pika.
   */
  async generate(params: BRollGenerateParams): Promise<BRollResult> {
    const { prompt, duration, style, aspectRatio } = params;
    const styledPrompt = `${prompt}. ${STYLE_MODIFIERS[style]}`;
    const dimensions = ASPECT_DIMENSIONS[aspectRatio];

    log.info({ prompt, duration, style, aspectRatio }, 'Generating B-roll clip');

    const providers: Array<{ name: BRollProvider; key: string | null }> = [
      { name: 'seedance', key: this.seedanceApiKey },
      { name: 'runway', key: this.runwayApiKey },
      { name: 'pika', key: this.pikaApiKey },
    ];

    let lastError: Error | null = null;

    for (const provider of providers) {
      if (!provider.key) continue;

      try {
        const url = await this.callProvider(
          provider.name,
          provider.key,
          styledPrompt,
          duration,
          dimensions,
        );

        const result: BRollResult = {
          id: randomUUID(),
          url,
          prompt: styledPrompt,
          duration,
          style,
          generatedAt: new Date().toISOString(),
          provider: provider.name,
        };

        this.eventBus.emit('video:broll_generated', {
          id: result.id,
          prompt: result.prompt,
          duration: result.duration,
          style: result.style,
          provider: result.provider,
          timestamp: result.generatedAt,
        });

        log.info({ id: result.id, provider: provider.name }, 'B-roll generated');
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        log.warn({ provider: provider.name, error: lastError.message }, 'Provider failed, trying next');
      }
    }

    throw lastError ?? new Error('No video generation providers configured. Set SEEDANCE_API_KEY, RUNWAY_API_KEY, or PIKA_API_KEY.');
  }

  /**
   * Generate multiple B-roll options for a given prompt.
   */
  async generateOptions(prompt: string, count = 3): Promise<BRollResult[]> {
    log.info({ prompt, count }, 'Generating B-roll options');

    const results: BRollResult[] = [];
    const styles: BRollStyle[] = ['cinematic', 'documentary', 'tutorial', 'social'];

    for (let i = 0; i < Math.min(count, styles.length); i++) {
      try {
        const result = await this.generate({
          prompt,
          duration: 5,
          style: styles[i],
          aspectRatio: '16:9',
        });
        results.push(result);
      } catch (err) {
        log.warn({ style: styles[i], error: String(err) }, 'Option generation failed');
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to generate any B-roll options');
    }

    return results;
  }

  // ── Provider call abstraction ──────────────────────────────────────────────

  private async callProvider(
    provider: BRollProvider,
    apiKey: string,
    prompt: string,
    duration: number,
    dimensions: { width: number; height: number },
  ): Promise<string> {
    const endpoints: Record<BRollProvider, string> = {
      seedance: 'https://api.seedance.ai/v2/generate',
      runway: 'https://api.runwayml.com/v1/generate',
      pika: 'https://api.pika.art/v1/generate',
    };

    const response = await fetch(endpoints[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        duration,
        width: dimensions.width,
        height: dimensions.height,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(`${provider} API returned ${response.status}: ${body}`);
    }

    const data = await response.json() as { url?: string; video_url?: string };
    const url = data.url ?? data.video_url;

    if (!url) {
      throw new Error(`${provider} API returned no video URL`);
    }

    return url;
  }
}
