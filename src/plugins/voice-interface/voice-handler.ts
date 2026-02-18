/**
 * Voice Interface Handler — Phase 10
 *
 * Full voice pipeline: Telegram voice message -> Whisper transcribe -> orchestrator -> TTS reply
 *
 * Pipeline steps:
 *   1. Save audio buffer to temp file
 *   2. Transcribe via WhisperClient
 *   3. Send transcript confirmation
 *   4. Process via orchestrator.query()
 *   5. Humanize response
 *   6. Generate TTS audio via SpeechGenerator (ElevenLabs)
 *   7. Send audio reply + text fallback
 *   8. Clean up temp file
 *   9. Emit voice:transcribed and voice:response_sent events
 */

import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EventBus } from '../../kernel/event-bus.js';
import type { WhisperClient, TranscriptionResult } from '../../integrations/whisper/client.js';
import type { SpeechResult } from '../tts/types.js';
import { humanizeQuick } from '../content-engine/humanizer.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('voice-handler');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VoiceResponse {
  transcript: string;
  response: string;
  audioBuffer?: Buffer;
  durationMs: number;
}

export interface VoiceHandlerParams {
  whisperClient: WhisperClient;
  ttsClient: { speak(text: string, requestedBy: string): Promise<SpeechResult> };
  orchestrator: { query(prompt: string, agent?: string): Promise<string> };
  eventBus: EventBus;
}

export interface VoiceMessageParams {
  audioBuffer: Buffer;
  chatId: number;
  userId: string;
  sendReply: (text: string) => Promise<void>;
  sendAudio: (audioBuffer: Buffer) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class VoiceHandler {
  private readonly whisperClient: WhisperClient;
  private readonly ttsClient: { speak(text: string, requestedBy: string): Promise<SpeechResult> };
  private readonly orchestrator: { query(prompt: string, agent?: string): Promise<string> };
  private readonly eventBus: EventBus;

  constructor(params: VoiceHandlerParams) {
    this.whisperClient = params.whisperClient;
    this.ttsClient = params.ttsClient;
    this.orchestrator = params.orchestrator;
    this.eventBus = params.eventBus;
  }

  /**
   * Handle a voice message through the full pipeline:
   * transcribe -> confirm -> process -> humanize -> TTS -> reply
   */
  async handleVoiceMessage(params: VoiceMessageParams): Promise<VoiceResponse> {
    const startTime = Date.now();
    const { audioBuffer, chatId, userId, sendReply, sendAudio } = params;

    // Step 1: Save audio buffer to temp file
    const tempPath = path.join(tmpdir(), `ari-voice-${randomUUID()}.ogg`);
    let transcript = '';
    let response = '';
    let resultAudio: Buffer | undefined;

    try {
      await writeFile(tempPath, audioBuffer);
      log.info({ chatId, userId, tempPath }, 'Saved voice message to temp file');

      // Step 2: Transcribe via WhisperClient
      let transcription: TranscriptionResult;
      try {
        transcription = await this.whisperClient.transcribe(tempPath);
        transcript = transcription.text.trim();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg, userId }, 'Transcription failed');
        this.eventBus.emit('voice:error', {
          userId,
          stage: 'transcription',
          error: msg,
          timestamp: new Date().toISOString(),
        });
        await sendReply('Could not transcribe the voice message. Please try again or send text.');
        return {
          transcript: '',
          response: 'Transcription failed',
          durationMs: Date.now() - startTime,
        };
      }

      if (!transcript) {
        await sendReply('Could not detect any speech in the voice message.');
        return {
          transcript: '',
          response: 'No speech detected',
          durationMs: Date.now() - startTime,
        };
      }

      // Emit transcription event
      this.eventBus.emit('voice:transcribed', {
        userId,
        transcript,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Step 3: Send transcript confirmation
      await sendReply(`\uD83C\uDF99 I heard: "${transcript}"`);

      // Step 4: Process via orchestrator
      try {
        response = await this.orchestrator.query(transcript);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg, userId }, 'Orchestrator processing failed');
        this.eventBus.emit('voice:error', {
          userId,
          stage: 'processing',
          error: msg,
          timestamp: new Date().toISOString(),
        });
        await sendReply('Something went wrong processing your request. Please try again.');
        return {
          transcript,
          response: 'Processing failed',
          durationMs: Date.now() - startTime,
        };
      }

      // Step 5: Apply humanizeQuick to response
      response = humanizeQuick(response);

      // Step 6: Generate TTS audio
      try {
        const speechResult = await this.ttsClient.speak(response, userId);
        resultAudio = speechResult.audioBuffer;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        log.warn({ error: msg, userId }, 'TTS generation failed, falling back to text-only');
        this.eventBus.emit('voice:error', {
          userId,
          stage: 'tts',
          error: msg,
          timestamp: new Date().toISOString(),
        });
        // TTS failure is non-fatal — fall through to text-only reply
      }

      // Step 7: Send audio reply + text fallback
      if (resultAudio) {
        await sendAudio(resultAudio);
      }
      await sendReply(response);

      const durationMs = Date.now() - startTime;

      // Step 9: Emit response event
      this.eventBus.emit('voice:response_sent', {
        userId,
        transcript,
        responseLength: response.length,
        hadAudio: !!resultAudio,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      log.info({ userId, chatId, durationMs, hadAudio: !!resultAudio }, 'Voice pipeline complete');

      return {
        transcript,
        response,
        audioBuffer: resultAudio,
        durationMs,
      };
    } finally {
      // Step 8: Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Temp file cleanup failure is non-critical
        log.debug({ tempPath }, 'Failed to clean up temp file');
      }
    }
  }
}
