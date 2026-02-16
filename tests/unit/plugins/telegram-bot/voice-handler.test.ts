import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleVoice } from '../../../../src/plugins/telegram-bot/voice-handler.js';
import type { VoiceHandlerDeps } from '../../../../src/plugins/telegram-bot/voice-handler.js';
import type { Context } from 'grammy';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

// Mock WhisperClient
vi.mock('../../../../src/integrations/whisper/client.js', () => ({
  WhisperClient: vi.fn().mockImplementation(() => ({
    transcribeBuffer: vi.fn().mockResolvedValue({
      text: 'hello world',
      language: 'en',
      duration: 2.5,
    }),
  })),
}));

describe('voice-handler', () => {
  let mockCtx: Partial<Context>;
  let mockEventBus: EventBus;
  let mockOnTranscribed: ReturnType<typeof vi.fn>;
  let deps: VoiceHandlerDeps;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    } as unknown as EventBus;

    mockOnTranscribed = vi.fn().mockResolvedValue(undefined);

    mockCtx = {
      message: {
        voice: {
          file_id: 'test-file-id',
          file_unique_id: 'unique-id',
          duration: 2,
          mime_type: 'audio/ogg',
          file_size: 1024,
        },
      },
      getFile: vi.fn().mockResolvedValue({
        file_path: 'voice/test.ogg',
      }),
      reply: vi.fn().mockResolvedValue(undefined),
      api: {
        token: 'test-bot-token',
      },
    };

    deps = {
      whisperApiKey: 'test-api-key',
      eventBus: mockEventBus,
    };

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
  });

  it('should transcribe voice message successfully', async () => {
    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      '<i>Heard:</i> "hello world"',
      { parse_mode: 'HTML' },
    );

    expect(mockOnTranscribed).toHaveBeenCalledWith(
      mockCtx,
      'hello world',
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('telegram:voice_transcribed', {
      duration: 2,
      textLength: 11,
      timestamp: expect.any(String),
    });
  });

  it('should handle missing API key', async () => {
    deps.whisperApiKey = null;

    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      'Voice transcription requires OPENAI_API_KEY to be configured.',
    );

    expect(mockOnTranscribed).not.toHaveBeenCalled();
  });

  it('should handle missing voice data', async () => {
    mockCtx.message = {};

    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith('No voice data received.');
    expect(mockOnTranscribed).not.toHaveBeenCalled();
  });

  it('should handle file download failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith('Failed to download voice message.');
    expect(mockOnTranscribed).not.toHaveBeenCalled();
  });

  it('should handle transcription error', async () => {
    const { WhisperClient } = await import('../../../../src/integrations/whisper/client.js');
    vi.mocked(WhisperClient).mockImplementationOnce(() => ({
      transcribeBuffer: vi.fn().mockRejectedValue(new Error('Transcription failed')),
    }) as never);

    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Voice processing failed'),
    );

    expect(mockEventBus.emit).toHaveBeenCalledWith('system:error', {
      error: expect.any(Error),
      context: 'voice_handler',
    });

    expect(mockOnTranscribed).not.toHaveBeenCalled();
  });

  it('should handle audio messages', async () => {
    mockCtx.message = {
      audio: {
        file_id: 'test-audio-id',
        file_unique_id: 'unique-audio-id',
        duration: 3,
        mime_type: 'audio/mpeg',
      },
    };

    await handleVoice(mockCtx as Context, deps, mockOnTranscribed);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      '<i>Heard:</i> "hello world"',
      { parse_mode: 'HTML' },
    );

    expect(mockOnTranscribed).toHaveBeenCalledWith(
      mockCtx,
      'hello world',
    );
  });
});
