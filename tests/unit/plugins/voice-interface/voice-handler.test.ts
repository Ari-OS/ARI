import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { VoiceHandler } from '../../../../src/plugins/voice-interface/voice-handler.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import { humanizeQuick } from '../../../../src/plugins/content-engine/humanizer.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

function createMockWhisperClient(overrides: Partial<{
  transcribe: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    transcribe: overrides.transcribe ?? vi.fn().mockResolvedValue({
      text: 'Hello ARI',
      language: 'en',
      duration: 2.5,
    }),
    transcribeBuffer: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    formatTranscription: vi.fn(),
  };
}

function createMockTtsClient(overrides: Partial<{
  speak: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    speak: overrides.speak ?? vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from('fake-audio-data'),
      textLength: 20,
      estimatedCost: 0.006,
      cached: false,
      voice: 'test-voice',
    }),
  };
}

function createMockOrchestrator(overrides: Partial<{
  query: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    query: overrides.query ?? vi.fn().mockResolvedValue(
      'Certainly! Here is your answer. I hope this helps!',
    ),
  };
}

function createMockMessageParams(overrides: Partial<{
  sendReply: ReturnType<typeof vi.fn>;
  sendAudio: ReturnType<typeof vi.fn>;
  audioBuffer: Buffer;
  chatId: number;
  userId: string;
}> = {}) {
  return {
    audioBuffer: overrides.audioBuffer ?? Buffer.from('fake-voice-data'),
    chatId: overrides.chatId ?? 12345,
    userId: overrides.userId ?? 'user-1',
    sendReply: overrides.sendReply ?? vi.fn().mockResolvedValue(undefined),
    sendAudio: overrides.sendAudio ?? vi.fn().mockResolvedValue(undefined),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('VoiceHandler', () => {
  let eventBus: EventBus;
  let handler: VoiceHandler;
  let mockWhisper: ReturnType<typeof createMockWhisperClient>;
  let mockTts: ReturnType<typeof createMockTtsClient>;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(() => {
    vi.restoreAllMocks();
    eventBus = new EventBus();
    mockWhisper = createMockWhisperClient();
    mockTts = createMockTtsClient();
    mockOrchestrator = createMockOrchestrator();
    handler = new VoiceHandler({
      whisperClient: mockWhisper as unknown as ConstructorParameters<typeof VoiceHandler>[0]['whisperClient'],
      ttsClient: mockTts,
      orchestrator: mockOrchestrator,
      eventBus,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Successful pipeline ──────────────────────────────────────────────

  it('should complete the full voice pipeline: transcribe -> process -> TTS -> reply', async () => {
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    // Whisper was called
    expect(mockWhisper.transcribe).toHaveBeenCalledTimes(1);
    // Orchestrator was called with the transcript
    expect(mockOrchestrator.query).toHaveBeenCalledWith('Hello ARI');
    // TTS was called with humanized response
    expect(mockTts.speak).toHaveBeenCalledTimes(1);
    // Audio was sent
    expect(params.sendAudio).toHaveBeenCalledTimes(1);
    // Text reply was sent (transcript confirmation + response)
    expect(params.sendReply).toHaveBeenCalledTimes(2);

    expect(result.transcript).toBe('Hello ARI');
    expect(result.response).toBeTruthy();
    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should return VoiceResponse with correct shape', async () => {
    const params = createMockMessageParams();
    const result = await handler.handleVoiceMessage(params);

    expect(result).toHaveProperty('transcript');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('audioBuffer');
    expect(result).toHaveProperty('durationMs');
    expect(typeof result.transcript).toBe('string');
    expect(typeof result.response).toBe('string');
    expect(typeof result.durationMs).toBe('number');
  });

  // ── Transcript confirmation ──────────────────────────────────────────

  it('should send transcript confirmation message', async () => {
    const params = createMockMessageParams();
    await handler.handleVoiceMessage(params);

    // First call should be the transcript confirmation
    const firstCallArg = params.sendReply.mock.calls[0][0] as string;
    expect(firstCallArg).toContain('I heard:');
    expect(firstCallArg).toContain('Hello ARI');
  });

  // ── humanizeQuick applied ────────────────────────────────────────────

  it('should apply humanizeQuick to the orchestrator response', async () => {
    const aiResponse = 'Certainly! Here is your answer. I hope this helps!';
    mockOrchestrator.query.mockResolvedValue(aiResponse);
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    // humanizeQuick should strip "Certainly!" and "I hope this helps!"
    const expected = humanizeQuick(aiResponse);
    expect(result.response).toBe(expected);
    // Verify it actually changed
    expect(result.response).not.toBe(aiResponse);
  });

  it('should pass the humanized response to TTS, not the raw one', async () => {
    const aiResponse = 'Absolutely! The weather is great today. Feel free to ask more!';
    mockOrchestrator.query.mockResolvedValue(aiResponse);
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    const ttsArg = mockTts.speak.mock.calls[0][0] as string;
    const humanized = humanizeQuick(aiResponse);
    expect(ttsArg).toBe(humanized);
  });

  // ── TTS failure fallback ─────────────────────────────────────────────

  it('should fall back to text-only when TTS fails', async () => {
    mockTts.speak.mockRejectedValue(new Error('TTS budget exceeded'));
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    // No audio sent
    expect(params.sendAudio).not.toHaveBeenCalled();
    // Text reply still sent (confirmation + response)
    expect(params.sendReply).toHaveBeenCalledTimes(2);
    expect(result.audioBuffer).toBeUndefined();
    expect(result.transcript).toBe('Hello ARI');
    expect(result.response).toBeTruthy();
  });

  it('should emit voice:error with stage tts when TTS fails', async () => {
    mockTts.speak.mockRejectedValue(new Error('API limit'));
    const events: unknown[] = [];
    eventBus.on('voice:error', (payload) => events.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'user-1',
      stage: 'tts',
      error: 'API limit',
    });
  });

  // ── Transcription failure ────────────────────────────────────────────

  it('should send error message when transcription fails', async () => {
    mockWhisper.transcribe.mockRejectedValue(new Error('Whisper unavailable'));
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    expect(params.sendReply).toHaveBeenCalledTimes(1);
    const msg = params.sendReply.mock.calls[0][0] as string;
    expect(msg).toContain('Could not transcribe');
    expect(result.transcript).toBe('');
    expect(result.response).toBe('Transcription failed');
  });

  it('should not call orchestrator or TTS when transcription fails', async () => {
    mockWhisper.transcribe.mockRejectedValue(new Error('fail'));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(mockOrchestrator.query).not.toHaveBeenCalled();
    expect(mockTts.speak).not.toHaveBeenCalled();
  });

  it('should handle empty transcript gracefully', async () => {
    mockWhisper.transcribe.mockResolvedValue({ text: '   ', language: 'en' });
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    expect(params.sendReply).toHaveBeenCalledTimes(1);
    const msg = params.sendReply.mock.calls[0][0] as string;
    expect(msg).toContain('Could not detect any speech');
    expect(result.transcript).toBe('');
    expect(mockOrchestrator.query).not.toHaveBeenCalled();
  });

  // ── Orchestrator failure ─────────────────────────────────────────────

  it('should send error message when orchestrator fails', async () => {
    mockOrchestrator.query.mockRejectedValue(new Error('Model overloaded'));
    const params = createMockMessageParams();

    const result = await handler.handleVoiceMessage(params);

    // Transcript confirmation + error message
    expect(params.sendReply).toHaveBeenCalledTimes(2);
    const errorMsg = params.sendReply.mock.calls[1][0] as string;
    expect(errorMsg).toContain('Something went wrong');
    expect(result.response).toBe('Processing failed');
    expect(mockTts.speak).not.toHaveBeenCalled();
  });

  // ── Temp file cleanup ────────────────────────────────────────────────

  it('should clean up temp file after successful pipeline', async () => {
    const params = createMockMessageParams();
    await handler.handleVoiceMessage(params);

    // After the pipeline completes, the temp file should be deleted.
    // We verify by checking that the whisper transcribe was called (meaning temp was written)
    // and that unlink ran without error (the pipeline completed).
    expect(mockWhisper.transcribe).toHaveBeenCalledTimes(1);
    const tempPath = mockWhisper.transcribe.mock.calls[0][0] as string;
    expect(tempPath).toContain('ari-voice-');
    // File should be cleaned up
    expect(existsSync(tempPath)).toBe(false);
  });

  it('should clean up temp file even when pipeline errors', async () => {
    mockOrchestrator.query.mockRejectedValue(new Error('fail'));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    const tempPath = mockWhisper.transcribe.mock.calls[0][0] as string;
    expect(existsSync(tempPath)).toBe(false);
  });

  // ── Event emission ───────────────────────────────────────────────────

  it('should emit voice:transcribed event after successful transcription', async () => {
    const events: unknown[] = [];
    eventBus.on('voice:transcribed', (payload) => events.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'user-1',
      transcript: 'Hello ARI',
    });
    expect((events[0] as Record<string, unknown>).durationMs).toBeGreaterThanOrEqual(0);
    expect((events[0] as Record<string, unknown>).timestamp).toBeTruthy();
  });

  it('should emit voice:response_sent event after full pipeline', async () => {
    const events: unknown[] = [];
    eventBus.on('voice:response_sent', (payload) => events.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'user-1',
      transcript: 'Hello ARI',
      hadAudio: true,
    });
    expect((events[0] as Record<string, unknown>).responseLength).toBeGreaterThan(0);
  });

  it('should emit voice:response_sent with hadAudio=false when TTS fails', async () => {
    mockTts.speak.mockRejectedValue(new Error('TTS fail'));
    const events: unknown[] = [];
    eventBus.on('voice:response_sent', (payload) => events.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      hadAudio: false,
    });
  });

  it('should not emit voice:response_sent when transcription fails', async () => {
    mockWhisper.transcribe.mockRejectedValue(new Error('fail'));
    const events: unknown[] = [];
    eventBus.on('voice:response_sent', (payload) => events.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(events).toHaveLength(0);
  });

  it('should emit voice:error with stage transcription when transcription fails', async () => {
    mockWhisper.transcribe.mockRejectedValue(new Error('Whisper down'));
    const errors: unknown[] = [];
    eventBus.on('voice:error', (payload) => errors.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      userId: 'user-1',
      stage: 'transcription',
      error: 'Whisper down',
    });
  });

  it('should emit voice:error with stage processing when orchestrator fails', async () => {
    mockOrchestrator.query.mockRejectedValue(new Error('Overloaded'));
    const errors: unknown[] = [];
    eventBus.on('voice:error', (payload) => errors.push(payload));
    const params = createMockMessageParams();

    await handler.handleVoiceMessage(params);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      stage: 'processing',
      error: 'Overloaded',
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('should pass userId to TTS speak as requestedBy', async () => {
    const params = createMockMessageParams({ userId: 'pryce-42' });
    await handler.handleVoiceMessage(params);

    expect(mockTts.speak).toHaveBeenCalledTimes(1);
    const requestedBy = mockTts.speak.mock.calls[0][1] as string;
    expect(requestedBy).toBe('pryce-42');
  });

  it('should trim whitespace from transcript', async () => {
    mockWhisper.transcribe.mockResolvedValue({
      text: '  What time is it?  ',
      language: 'en',
    });
    const params = createMockMessageParams();
    const result = await handler.handleVoiceMessage(params);

    expect(result.transcript).toBe('What time is it?');
    expect(mockOrchestrator.query).toHaveBeenCalledWith('What time is it?');
  });
});
