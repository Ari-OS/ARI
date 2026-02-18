import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('video-captions-generator');

const ASSEMBLY_AI_BASE = 'https://api.assemblyai.com/v2';

// Poll config
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 min max

// ─── AssemblyAI API shapes ────────────────────────────────────────────────────

interface AssemblyAITranscriptRequest {
  audio_url: string;
  language_code?: string;
  punctuate?: boolean;
  format_text?: boolean;
  word_boost?: string[];
}

interface AssemblyAIWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string | null;
  words: AssemblyAIWord[] | null;
  error: string | null;
}

// ─── SRT formatting ───────────────────────────────────────────────────────────

function msToSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Groups individual word timestamps into subtitle blocks.
 * Each block: 2-4 words, max 4 seconds duration.
 * Style: Bold white text on dark background, word-by-word pop (SRT format).
 */
function wordsToSrt(words: AssemblyAIWord[]): string {
  if (words.length === 0) return '';

  const WORDS_PER_BLOCK = 3;
  const blocks: string[] = [];
  let index = 1;

  for (let i = 0; i < words.length; i += WORDS_PER_BLOCK) {
    const chunk = words.slice(i, i + WORDS_PER_BLOCK);
    const startMs = chunk[0]?.start ?? 0;
    const endMs = chunk[chunk.length - 1]?.end ?? 0;
    const text = chunk.map((w) => w.text).join(' ');

    blocks.push(
      `${index}\n${msToSrtTime(startMs)} --> ${msToSrtTime(endMs)}\n${text}\n`,
    );
    index++;
  }

  return blocks.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPTIONS GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class CaptionsGenerator {
  private readonly apiKey: string | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? null;
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key not configured. Set ASSEMBLY_AI_API_KEY environment variable.');
    }
    return this.apiKey;
  }

  private authHeaders(): Record<string, string> {
    return {
      authorization: this.requireApiKey(),
      'content-type': 'application/json',
    };
  }

  // ── Submit transcription job ─────────────────────────────────────────────────

  async submitTranscription(
    audioUrl: string,
    wordBoost: string[] = [],
  ): Promise<string> {
    log.info({ audioUrl }, 'Submitting AssemblyAI transcription job');

    const body: AssemblyAITranscriptRequest = {
      audio_url: audioUrl,
      language_code: 'en',
      punctuate: true,
      format_text: true,
      word_boost: wordBoost.length > 0 ? wordBoost : undefined,
    };

    const response = await fetch(`${ASSEMBLY_AI_BASE}/transcript`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AssemblyAI submit error ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { id: string };
    log.info({ transcriptId: data.id }, 'AssemblyAI transcription job submitted');
    return data.id;
  }

  // ── Poll for completion ───────────────────────────────────────────────────────

  async waitForTranscription(
    transcriptId: string,
    onProgress?: (attempt: number, status: string) => void,
  ): Promise<AssemblyAITranscriptResponse> {
    log.info({ transcriptId }, 'Polling AssemblyAI for transcription completion');

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${ASSEMBLY_AI_BASE}/transcript/${transcriptId}`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AssemblyAI poll error ${response.status}: ${errorText}`);
      }

      const data = await response.json() as AssemblyAITranscriptResponse;
      onProgress?.(attempt, data.status);

      if (data.status === 'completed') {
        log.info({ transcriptId, attempt }, 'AssemblyAI transcription completed');
        return data;
      }

      if (data.status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${data.error ?? 'unknown error'}`);
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    throw new Error(`AssemblyAI transcription ${transcriptId} did not complete after ${MAX_POLL_ATTEMPTS} polls`);
  }

  // ── Generate SRT file ─────────────────────────────────────────────────────────

  async generateSrt(
    audioUrl: string,
    outputDir: string,
    projectId: string,
    wordBoost: string[] = [],
  ): Promise<{ transcriptId: string; srtContent: string; srtPath: string }> {
    log.info({ projectId, outputDir }, 'Generating SRT captions');

    // Submit
    const transcriptId = await this.submitTranscription(audioUrl, wordBoost);

    // Wait
    const transcript = await this.waitForTranscription(transcriptId);

    if (!transcript.words || transcript.words.length === 0) {
      throw new Error('AssemblyAI returned no word timestamps');
    }

    // Convert to SRT
    const srtContent = wordsToSrt(transcript.words);

    // Write to disk
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const srtPath = path.join(outputDir, `${projectId}.srt`);
    writeFileSync(srtPath, srtContent, 'utf-8');

    log.info({ projectId, srtPath, wordCount: transcript.words.length }, 'SRT captions generated');

    return { transcriptId, srtContent, srtPath };
  }
}
