import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { EventBus } from '../../kernel/event-bus.js';
import type { CostTracker } from '../../observability/cost-tracker.js';
import type { TtsConfig, SpeechRequest, SpeechResult } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SPEECH GENERATOR (ElevenLabs TTS)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates speech from text using ElevenLabs TTS API.
 *
 * Features:
 * - Budget gating: estimate cost → check daily cap → proceed or reject
 * - Audio caching: cache by SHA-256 hash of text in dataDir/cache/
 * - Cost: ~$0.30 per 1000 chars, daily cap $2
 */
export class SpeechGenerator {
  private readonly config: TtsConfig;
  private readonly cacheDir: string;
  private readonly eventBus: EventBus;
  private readonly costTracker: CostTracker | null;
  private dailySpend: number = 0;
  private lastResetDate: string = '';

  constructor(
    config: TtsConfig,
    dataDir: string,
    eventBus: EventBus,
    costTracker: CostTracker | null,
  ) {
    this.config = config;
    this.cacheDir = path.join(dataDir, 'cache');
    this.eventBus = eventBus;
    this.costTracker = costTracker;

    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    this.resetDailyIfNeeded();
  }

  // ── Public API ─────────────────────────────────────────────────────

  async speak(request: SpeechRequest): Promise<SpeechResult> {
    const voice = request.voice ?? this.config.defaultVoice;
    const model = request.model ?? this.config.defaultModel;
    const estimatedCost = this.estimateCost(request.text);

    // Check daily budget
    this.resetDailyIfNeeded();
    if (this.dailySpend + estimatedCost > this.config.dailyCap) {
      this.eventBus.emit('tts:budget_rejected', {
        textLength: request.text.length,
        estimatedCost,
        dailyCap: this.config.dailyCap,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        `TTS daily budget exceeded: $${this.dailySpend.toFixed(2)} spent, ` +
        `$${estimatedCost.toFixed(3)} needed, $${this.config.dailyCap.toFixed(2)} cap`,
      );
    }

    // Check cache
    const cacheKey = this.getCacheKey(request.text, voice, model);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.eventBus.emit('tts:speech_generated', {
        textLength: request.text.length,
        cost: 0,
        cached: true,
        voice,
        timestamp: new Date().toISOString(),
      });

      return {
        audioBuffer: cached,
        textLength: request.text.length,
        estimatedCost: 0,
        cached: true,
        voice,
      };
    }

    // Generate speech via ElevenLabs API
    if (!this.config.apiKey) {
      throw new Error('ElevenLabs API key not configured. Set ELEVENLABS_API_KEY environment variable.');
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: model,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ElevenLabs API error: ${response.status} — ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Cache the result
    this.saveToCache(cacheKey, audioBuffer);

    // Track cost
    this.dailySpend += estimatedCost;

    this.eventBus.emit('tts:speech_generated', {
      textLength: request.text.length,
      cost: estimatedCost,
      cached: false,
      voice,
      timestamp: new Date().toISOString(),
    });

    return {
      audioBuffer,
      textLength: request.text.length,
      estimatedCost,
      cached: false,
      voice,
    };
  }

  async speakToFile(text: string, outputPath: string, requestedBy: string): Promise<SpeechResult> {
    const result = await this.speak({ text, requestedBy });
    const dir = path.dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputPath, result.audioBuffer);
    return result;
  }

  estimateCost(text: string): number {
    return (text.length / 1000) * this.config.costPer1000Chars;
  }

  getDailySpend(): number {
    this.resetDailyIfNeeded();
    return this.dailySpend;
  }

  getDailyCap(): number {
    return this.config.dailyCap;
  }

  // ── Cache ──────────────────────────────────────────────────────────

  private getCacheKey(text: string, voice: string, model: string): string {
    return createHash('sha256')
      .update(`${text}:${voice}:${model}`)
      .digest('hex');
  }

  private getFromCache(key: string): Buffer | null {
    const filePath = path.join(this.cacheDir, `${key}.mp3`);
    if (existsSync(filePath)) {
      return readFileSync(filePath);
    }
    return null;
  }

  private saveToCache(key: string, data: Buffer): void {
    const filePath = path.join(this.cacheDir, `${key}.mp3`);
    writeFileSync(filePath, data);
  }

  // ── Daily Reset ────────────────────────────────────────────────────

  private resetDailyIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = today;
    }
  }
}
