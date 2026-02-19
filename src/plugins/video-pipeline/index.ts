import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
} from '../types.js';
import { VideoPipelineConfigSchema } from './types.js';
import type { VideoPipelineConfig } from './types.js';
import { ScriptGenerator } from './script-generator.js';
import { AvatarRenderer } from './avatar-renderer.js';
import { CaptionsGenerator } from './captions-generator.js';
import { VideoAssembler } from './video-assembler.js';
import { ThumbnailGenerator } from './thumbnail-generator.js';
import { ApprovalGate } from './approval-gate.js';
import { YouTubePublisher } from './youtube-publisher.js';
import { PipelineOrchestrator } from './pipeline-orchestrator.js';

const log = createLogger('video-pipeline');

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO PIPELINE PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

export class VideoPipelinePlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'video-pipeline',
    name: 'Video Pipeline',
    version: '1.0.0',
    description: 'Automated video content pipeline: script → avatar → captions → assembly',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private config!: VideoPipelineConfig;
  private scriptGenerator: ScriptGenerator | null = null;
  private avatarRenderer: AvatarRenderer | null = null;
  private captionsGenerator: CaptionsGenerator | null = null;
  private videoAssembler: VideoAssembler | null = null;
  private thumbnailGenerator: ThumbnailGenerator | null = null;
  private approvalGate: ApprovalGate | null = null;
  private youtubePublisher: YouTubePublisher | null = null;
  private orchestrator: PipelineOrchestrator | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.config = VideoPipelineConfigSchema.parse(deps.config);

    const outputDir = this.config.outputDir ?? path.join(homedir(), '.ari', 'video-output');

    // Build AI adapter (used by both ScriptGenerator and PipelineOrchestrator)
    let orchAdapter: { chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) => Promise<string> } | null = null;
    if (deps.orchestrator) {
      const orch = deps.orchestrator;
      orchAdapter = {
        chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) =>
          orch.chat(
            messages.map((m) => ({
              role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: m.content,
            })),
            systemPrompt,
          ),
      };
      this.scriptGenerator = new ScriptGenerator(orchAdapter);
    }

    this.avatarRenderer = new AvatarRenderer(this.config.heygenApiKey);
    this.captionsGenerator = new CaptionsGenerator(this.config.assemblyAiApiKey);
    this.videoAssembler = new VideoAssembler(outputDir);
    this.thumbnailGenerator = new ThumbnailGenerator(this.config.openaiApiKey);
    this.approvalGate = new ApprovalGate(this.eventBus);
    this.youtubePublisher = new YouTubePublisher({
      clientId: this.config.youtubeClientId,
      clientSecret: this.config.youtubeClientSecret,
      refreshToken: this.config.youtubeRefreshToken,
    });

    if (this.scriptGenerator) {
      this.orchestrator = new PipelineOrchestrator(
        this.eventBus,
        this.config,
        this.scriptGenerator,
        this.avatarRenderer,
        this.captionsGenerator,
        this.videoAssembler,
        this.thumbnailGenerator,
        this.approvalGate,
        this.youtubePublisher,
        orchAdapter,
      );
    }

    this.status = 'active';
    log.info('Video pipeline plugin initialized');

    this.eventBus.emit('plugin:initialized', {
      pluginId: this.manifest.id,
      durationMs: 0,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async shutdown(): Promise<void> {
    this.status = 'shutdown';
    log.info('Video pipeline plugin shut down');
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const hasScriptGen = this.scriptGenerator !== null;
    const hasHeyGen = Boolean(this.config?.heygenApiKey);

    const details = [
      `script-generator: ${hasScriptGen ? 'ready' : 'no orchestrator'}`,
      `heygen: ${hasHeyGen ? 'configured' : 'no api key'}`,
    ].join(', ');

    return {
      healthy: this.status === 'active',
      details,
    };
  }

  // ── Briefing Contribution ───────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/require-await
  async contributeToBriefing(
    type: 'morning' | 'evening' | 'weekly',
  ): Promise<BriefingContribution | null> {
    if (type !== 'morning') return null;

    const heygenReady = Boolean(this.config?.heygenApiKey);
    const scriptGenReady = this.scriptGenerator !== null;

    return {
      pluginId: this.manifest.id,
      section: 'Video Pipeline',
      content: [
        'Video pipeline status:',
        `  Script generator: ${scriptGenReady ? 'ready' : 'unavailable (no AI orchestrator)'}`,
        `  HeyGen renderer: ${heygenReady ? 'configured' : 'not configured (set HEYGEN_API_KEY)'}`,
      ].join('\n'),
      priority: 40,
      category: 'info',
    };
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getScriptGenerator(): ScriptGenerator | null {
    return this.scriptGenerator;
  }

  getAvatarRenderer(): AvatarRenderer | null {
    return this.avatarRenderer;
  }

  getOrchestrator(): PipelineOrchestrator | null {
    return this.orchestrator;
  }

  getApprovalGate(): ApprovalGate | null {
    return this.approvalGate;
  }

  getConfig(): VideoPipelineConfig {
    return this.config;
  }
}
