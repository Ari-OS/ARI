/**
 * Voice Message Handler for Telegram Bot
 *
 * Pipeline: Telegram voice → download → Whisper transcribe → intent router → reply
 *
 * Security: Uses WhisperClient which enforces loopback-only for local mode.
 */

import type { Context } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import { WhisperClient } from '../../integrations/whisper/client.js';

export interface VoiceHandlerDeps {
  whisperApiKey: string | null;
  eventBus: EventBus;
}

/**
 * Handle voice message from Telegram
 *
 * @param ctx - grammY context
 * @param deps - Dependencies (API key, event bus)
 * @param onTranscribed - Callback with transcribed text
 */
export async function handleVoice(
  ctx: Context,
  deps: VoiceHandlerDeps,
  onTranscribed: (ctx: Context, text: string) => Promise<void>,
): Promise<void> {
  if (!deps.whisperApiKey) {
    await ctx.reply('Voice transcription requires OPENAI_API_KEY to be configured.');
    return;
  }

  try {
    // Get file info from Telegram
    const voice = ctx.message?.voice ?? ctx.message?.audio;
    if (!voice) {
      await ctx.reply('No voice data received.');
      return;
    }

    const file = await ctx.getFile();
    if (!file.file_path) {
      await ctx.reply('Could not retrieve voice file.');
      return;
    }

    // Download file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      await ctx.reply('Failed to download voice message.');
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Transcribe with Whisper (API mode)
    const whisper = new WhisperClient({
      mode: 'api',
      apiKey: deps.whisperApiKey,
      model: 'whisper-1',
    });

    const result = await whisper.transcribeBuffer(buffer, file.file_path.split('/').pop() ?? 'voice.ogg');

    deps.eventBus.emit('telegram:voice_transcribed', {
      duration: voice.duration,
      textLength: result.text.length,
      timestamp: new Date().toISOString(),
    });

    // Show transcription to user
    await ctx.reply(`<i>Heard:</i> "${result.text}"`, { parse_mode: 'HTML' });

    // Route through intent system
    await onTranscribed(ctx, result.text);
  } catch (error: unknown) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    await ctx.reply(`Voice processing failed: ${errorObj.message}`);
    deps.eventBus.emit('system:error', {
      error: errorObj,
      context: 'voice_handler',
    });
  }
}
