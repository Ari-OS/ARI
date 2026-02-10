import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SpeechGenerator } from '../../../../src/plugins/tts/speech-generator.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { TtsConfig } from '../../../../src/plugins/tts/types.js';

describe('SpeechGenerator', () => {
  let generator: SpeechGenerator;
  let eventBus: EventBus;
  let tempDir: string;
  let config: TtsConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ari-tts-test-'));
    eventBus = new EventBus();
    config = {
      apiKey: 'test-key',
      defaultVoice: 'test-voice',
      defaultModel: 'test-model',
      dailyCap: 2.00,
      costPer1000Chars: 0.30,
    };
    generator = new SpeechGenerator(config, tempDir, eventBus, null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('estimateCost', () => {
    it('should estimate cost based on text length', () => {
      expect(generator.estimateCost('hello')).toBeCloseTo(0.0015, 4);
      expect(generator.estimateCost('a'.repeat(1000))).toBeCloseTo(0.30, 2);
      expect(generator.estimateCost('a'.repeat(5000))).toBeCloseTo(1.50, 2);
    });
  });

  describe('getDailySpend', () => {
    it('should start at 0', () => {
      expect(generator.getDailySpend()).toBe(0);
    });
  });

  describe('getDailyCap', () => {
    it('should return configured cap', () => {
      expect(generator.getDailyCap()).toBe(2.00);
    });
  });

  describe('speak', () => {
    it('should generate speech via API', async () => {
      const audioData = Buffer.from('fake-audio-data');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength,
        ),
      } as Response);

      const result = await generator.speak({ text: 'Hello world', requestedBy: 'test' });
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.textLength).toBe(11);
      expect(result.cached).toBe(false);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should use cache on second request', async () => {
      const audioData = Buffer.from('fake-audio');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength,
        ),
      } as Response);

      await generator.speak({ text: 'Hello', requestedBy: 'test' });

      // Second call should use cache
      const result = await generator.speak({ text: 'Hello', requestedBy: 'test' });
      expect(result.cached).toBe(true);
      expect(result.estimatedCost).toBe(0);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should emit speech_generated event', async () => {
      const events: unknown[] = [];
      eventBus.on('tts:speech_generated', (e) => events.push(e));

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      } as Response);

      await generator.speak({ text: 'Hello', requestedBy: 'test' });
      expect(events).toHaveLength(1);
    });

    it('should reject when daily budget exceeded', async () => {
      const expensiveGenerator = new SpeechGenerator(
        { ...config, dailyCap: 0.001 },
        tempDir,
        eventBus,
        null,
      );

      await expect(
        expensiveGenerator.speak({ text: 'a'.repeat(1000), requestedBy: 'test' }),
      ).rejects.toThrow('TTS daily budget exceeded');
    });

    it('should emit budget_rejected event when over budget', async () => {
      const events: unknown[] = [];
      eventBus.on('tts:budget_rejected', (e) => events.push(e));

      const expensiveGenerator = new SpeechGenerator(
        { ...config, dailyCap: 0.001 },
        tempDir,
        eventBus,
        null,
      );

      await expensiveGenerator.speak({ text: 'a'.repeat(1000), requestedBy: 'test' }).catch(() => {});
      expect(events).toHaveLength(1);
    });

    it('should throw when no API key configured', async () => {
      const noKeyGenerator = new SpeechGenerator(
        { ...config, apiKey: undefined },
        tempDir,
        eventBus,
        null,
      );

      await expect(
        noKeyGenerator.speak({ text: 'Hello', requestedBy: 'test' }),
      ).rejects.toThrow('ElevenLabs API key not configured');
    });
  });

  describe('speakToFile', () => {
    it('should save audio to file', async () => {
      const audioData = Buffer.from('audio-content');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength,
        ),
      } as Response);

      const outputPath = path.join(tempDir, 'output.mp3');
      await generator.speakToFile('Hello', outputPath, 'test');
      expect(existsSync(outputPath)).toBe(true);
    });
  });
});
