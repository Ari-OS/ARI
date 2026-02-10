import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
} from '../types.js';
import { SpeechGenerator } from './speech-generator.js';
import { TtsConfigSchema } from './types.js';
import type { SpeechResult } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TTS PLUGIN (ElevenLabs)
// ═══════════════════════════════════════════════════════════════════════════════

export class TtsPlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'tts',
    name: 'ElevenLabs TTS',
    version: '1.0.0',
    description: 'Text-to-speech via ElevenLabs with budget gating and audio caching',
    author: 'ARI',
    capabilities: ['data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private generator!: SpeechGenerator;

  // ── Lifecycle ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(deps: PluginDependencies): Promise<void> {
    const config = TtsConfigSchema.parse({
      ...deps.config,
      apiKey: (deps.config.apiKey as string | undefined) ?? process.env.ELEVENLABS_API_KEY,
    });

    this.generator = new SpeechGenerator(
      config,
      deps.dataDir,
      deps.eventBus,
      deps.costTracker,
    );

    this.status = 'active';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async shutdown(): Promise<void> {
    this.status = 'shutdown';
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    if (!process.env.ELEVENLABS_API_KEY) {
      return { healthy: false, details: 'ELEVENLABS_API_KEY not set' };
    }
    return { healthy: true, details: 'API key configured' };
  }

  // ── Public API (used by Telegram Bot + CLI) ────────────────────────

  async speak(text: string, requestedBy: string): Promise<SpeechResult> {
    return this.generator.speak({ text, requestedBy });
  }

  async speakToFile(text: string, outputPath: string, requestedBy: string): Promise<SpeechResult> {
    return this.generator.speakToFile(text, outputPath, requestedBy);
  }

  estimateCost(text: string): number {
    return this.generator.estimateCost(text);
  }

  getDailySpend(): number {
    return this.generator.getDailySpend();
  }

  getDailyCap(): number {
    return this.generator.getDailyCap();
  }
}
