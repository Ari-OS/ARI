/**
 * AssemblyAI Integration — Speech-to-Text Client
 *
 * Provides transcription with word-level timestamps and SRT generation.
 * Used by the video pipeline (captions-generator) and voice interface (Phase 10).
 *
 * API: https://www.assemblyai.com/docs
 * Layer: L2 System (integrations)
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('assemblyai-client');

const BASE_URL = 'https://api.assemblyai.com/v2';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 min max
const DEFAULT_WORDS_PER_BLOCK = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssemblyAIWord {
  text: string;
  start: number; // ms
  end: number;   // ms
  confidence: number;
}

export interface TranscriptResult {
  id: string;
  text: string;
  words: AssemblyAIWord[];
}

export interface TranscribeOptions {
  languageCode?: string;
  wordBoost?: string[];
  punctuate?: boolean;
  formatText?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// ── AssemblyAI API response shapes ───────────────────────────────────────────

interface ApiTranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string | null;
  words: AssemblyAIWord[] | null;
  error: string | null;
}

// ── Client ────────────────────────────────────────────────────────────────────

export class AssemblyAIClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('AssemblyAI API key is required');
    this.apiKey = apiKey;
  }

  private get authHeaders(): Record<string, string> {
    return {
      authorization: this.apiKey,
      'content-type': 'application/json',
    };
  }

  // ── Core API ─────────────────────────────────────────────────────────────────

  /**
   * Submit a transcription job and poll until complete.
   * Returns transcript text + word-level timestamps.
   */
  async transcribe(audioUrl: string, options: TranscribeOptions = {}): Promise<TranscriptResult> {
    const transcriptId = await this.submitJob(audioUrl, options);
    const result = await this.pollUntilComplete(transcriptId);
    return {
      id: result.id,
      text: result.text ?? '',
      words: result.words ?? [],
    };
  }

  private async submitJob(audioUrl: string, options: TranscribeOptions): Promise<string> {
    log.info({ audioUrl }, 'Submitting AssemblyAI transcription job');

    const response = await fetch(`${BASE_URL}/transcript`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: options.languageCode ?? 'en',
        punctuate: options.punctuate ?? true,
        format_text: options.formatText ?? true,
        word_boost: options.wordBoost && options.wordBoost.length > 0 ? options.wordBoost : undefined,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AssemblyAI submit error ${response.status}: ${text}`);
    }

    const data = await response.json() as { id: string };
    log.info({ transcriptId: data.id }, 'AssemblyAI job submitted');
    return data.id;
  }

  private async pollUntilComplete(transcriptId: string): Promise<ApiTranscriptResponse> {
    log.info({ transcriptId }, 'Polling AssemblyAI transcription');

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${BASE_URL}/transcript/${transcriptId}`, {
        headers: this.authHeaders,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AssemblyAI poll error ${response.status}: ${text}`);
      }

      const data = await response.json() as ApiTranscriptResponse;

      if (data.status === 'completed') {
        log.info({ transcriptId, attempt }, 'AssemblyAI transcription complete');
        return data;
      }

      if (data.status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${data.error ?? 'unknown error'}`);
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    throw new Error(`AssemblyAI transcription ${transcriptId} did not complete after ${MAX_POLL_ATTEMPTS} polls`);
  }

  // ── SRT generation ───────────────────────────────────────────────────────────

  /**
   * Convert word-level timestamps to SRT format.
   * Groups words into subtitle blocks (default: 3 words per block).
   */
  generateSrt(words: AssemblyAIWord[], wordsPerBlock = DEFAULT_WORDS_PER_BLOCK): string {
    if (words.length === 0) return '';

    const blocks: string[] = [];
    let index = 1;

    for (let i = 0; i < words.length; i += wordsPerBlock) {
      const chunk = words.slice(i, i + wordsPerBlock);
      const startMs = chunk[0]?.start ?? 0;
      const endMs = chunk[chunk.length - 1]?.end ?? 0;
      const text = chunk.map(w => w.text).join(' ');

      blocks.push(`${index}\n${msToSrtTimestamp(startMs)} --> ${msToSrtTimestamp(endMs)}\n${text}\n`);
      index++;
    }

    return blocks.join('\n');
  }
}
