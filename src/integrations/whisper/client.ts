/**
 * ARI Whisper Integration Client
 *
 * Provides audio transcription via:
 * - Local whisper.cpp server (privacy-first, loopback-only)
 * - OpenAI Whisper API (requires API key)
 *
 * Security: Local mode enforces loopback-only (127.0.0.1) per ARI's security invariants.
 *
 * References:
 * - whisper.cpp: https://github.com/ggerganov/whisper.cpp
 * - OpenAI API: https://platform.openai.com/docs/api-reference/audio
 */

import { readFile } from 'node:fs/promises';
import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('whisper-client');

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:8080';
const DEFAULT_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_API_MODEL = 'whisper-1';
const DEFAULT_LOCAL_MODEL = 'base';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface WhisperConfig {
  mode: 'local' | 'api';
  localUrl?: string;
  apiKey?: string;
  model?: string;
  language?: string;
}

/**
 * Whisper transcription client
 */
export class WhisperClient {
  private config: Required<Pick<WhisperConfig, 'mode' | 'model'>> &
    Pick<WhisperConfig, 'localUrl' | 'apiKey' | 'language'>;

  /**
   * Create a new Whisper client
   *
   * @param config - Client configuration
   */
  constructor(config: WhisperConfig) {
    if (config.mode === 'api' && !config.apiKey) {
      throw new Error('API key is required for API mode');
    }

    this.config = {
      mode: config.mode,
      localUrl: config.localUrl ?? DEFAULT_LOCAL_URL,
      apiKey: config.apiKey,
      model: config.model ?? (config.mode === 'api' ? DEFAULT_API_MODEL : DEFAULT_LOCAL_MODEL),
      language: config.language,
    };

    // Security: Enforce loopback-only for local mode per ARI's security invariants (ADR-001)
    if (this.config.mode === 'local' && this.config.localUrl) {
      this.validateEndpoint(this.config.localUrl);
    }

    logger.info('Whisper client initialized', {
      mode: this.config.mode,
      model: this.config.model,
      url: this.config.mode === 'local' ? this.config.localUrl : DEFAULT_API_URL,
    });
  }

  /**
   * Validate that a local endpoint is loopback-only (ADR-001 security invariant).
   * Throws if the URL resolves to anything other than 127.0.0.1 or localhost.
   */
  private validateEndpoint(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Whisper: invalid local URL: ${url}`);
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') {
      throw new Error(
        `Whisper local mode requires loopback URL (127.0.0.1 or localhost). ` +
        `Got: ${hostname}. Non-loopback endpoints are not permitted (ADR-001).`,
      );
    }
  }

  /**
   * Transcribe audio file
   *
   * @param audioPath - Path to audio file
   * @returns Transcription result
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    try {
      const buffer = await readFile(audioPath);
      const filename = audioPath.split('/').pop() ?? 'audio.wav';

      return this.transcribeBuffer(buffer, filename);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Whisper transcription failed', { error: msg, audioPath });
      throw new Error(`Whisper transcription failed: ${msg}`);
    }
  }

  /**
   * Transcribe audio buffer
   *
   * @param buffer - Audio file buffer
   * @param filename - Filename for the audio (used in multipart form)
   * @returns Transcription result
   */
  async transcribeBuffer(buffer: Buffer, filename: string): Promise<TranscriptionResult> {
    if (this.config.mode === 'local') {
      return this.transcribeLocal(buffer, filename);
    } else {
      return this.transcribeApi(buffer, filename);
    }
  }

  /**
   * Transcribe via local whisper.cpp server
   */
  private async transcribeLocal(buffer: Buffer, filename: string): Promise<TranscriptionResult> {
    try {
      const url = `${this.config.localUrl}/inference`;

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)]);
      formData.append('file', blob, filename);

      if (this.config.language) {
        formData.append('language', this.config.language);
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Local Whisper API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        text: string;
        language?: string;
        segments?: Array<{
          start: number;
          end: number;
          text: string;
        }>;
      };

      return {
        text: data.text,
        language: data.language,
        segments: data.segments?.map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Local Whisper transcription failed', { error: msg, filename });
      throw new Error(`Local Whisper transcription failed: ${msg}`);
    }
  }

  /**
   * Transcribe via OpenAI Whisper API
   */
  private async transcribeApi(buffer: Buffer, filename: string): Promise<TranscriptionResult> {
    try {
      const url = DEFAULT_API_URL;

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)]);
      formData.append('file', blob, filename);
      formData.append('model', this.config.model);

      if (this.config.language) {
        formData.append('language', this.config.language);
      }

      // Request detailed response with timestamps
      formData.append('response_format', 'verbose_json');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as {
        text: string;
        language?: string;
        duration?: number;
        segments?: Array<{
          start: number;
          end: number;
          text: string;
        }>;
      };

      return {
        text: data.text,
        language: data.language,
        duration: data.duration,
        segments: data.segments?.map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('OpenAI Whisper transcription failed', { error: msg, filename });
      throw new Error(`OpenAI Whisper transcription failed: ${msg}`);
    }
  }

  /**
   * Check if Whisper is available
   *
   * @returns True if Whisper is reachable, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.mode === 'local') {
        // Try to ping the local server
        const url = `${this.config.localUrl}/`;
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        return response.ok;
      } else {
        // For API mode, we can't really test without making a real request
        // Just check if we have an API key
        return !!this.config.apiKey;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.debug('Whisper not available', { error: msg, mode: this.config.mode });
      return false;
    }
  }

  /**
   * Format transcription result as readable text
   *
   * @param result - Transcription result
   * @param includeTimestamps - Whether to include timestamps for segments
   * @returns Formatted text
   */
  formatTranscription(result: TranscriptionResult, includeTimestamps = false): string {
    if (!includeTimestamps || !result.segments || result.segments.length === 0) {
      return result.text;
    }

    const lines: string[] = [];

    if (result.language) {
      lines.push(`Language: ${result.language}`);
    }

    if (result.duration) {
      lines.push(`Duration: ${result.duration.toFixed(2)}s`);
    }

    if (lines.length > 0) {
      lines.push(''); // Blank line
    }

    for (const segment of result.segments) {
      const timestamp = `[${this.formatTimestamp(segment.start)} -> ${this.formatTimestamp(segment.end)}]`;
      lines.push(`${timestamp} ${segment.text.trim()}`);
    }

    return lines.join('\n');
  }

  /**
   * Format timestamp in MM:SS format
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
