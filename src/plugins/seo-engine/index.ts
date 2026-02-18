import type { EventBus } from '../../kernel/event-bus.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
} from '../types.js';
import { SEOEngineConfigSchema } from './types.js';
import type { SEOEngineConfig } from './types.js';
import { KeywordTracker } from './keyword-tracker.js';
import { ContentOptimizer } from './content-optimizer.js';
import { LinkedInOptimizer } from './linkedin-optimizer.js';
import { createLogger } from '../../kernel/logger.js';
import path from 'node:path';

const log = createLogger('seo-engine');

export class SEOEnginePlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'seo-engine',
    name: 'SEO Engine',
    version: '1.0.0',
    description: 'SEO automation: keyword tracking, content optimization, SERP monitoring, LinkedIn optimization',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private config!: SEOEngineConfig;
  private keywordTracker: KeywordTracker | null = null;
  private contentOptimizer: ContentOptimizer | null = null;
  private linkedInOptimizer: LinkedInOptimizer | null = null;

  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.config = SEOEngineConfigSchema.parse(deps.config);
    const dataDir = deps.dataDir || path.join(process.env['HOME'] ?? '~', '.ari', 'plugins', 'seo-engine', 'data');

    if (deps.orchestrator) {
      const orch = deps.orchestrator;
      const orchAdapter = {
        chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) =>
          orch.chat(
            messages.map((m) => ({
              role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
              content: m.content,
            })),
            systemPrompt,
          ),
      };
      this.keywordTracker = new KeywordTracker(orchAdapter, dataDir);
      await this.keywordTracker.init();
      this.contentOptimizer = new ContentOptimizer(orchAdapter);
      this.linkedInOptimizer = new LinkedInOptimizer(orchAdapter);
    } else {
      this.contentOptimizer = new ContentOptimizer(null);
    }

    this.status = 'active';
    log.info('SEO engine plugin initialized');
  }

  async shutdown(): Promise<void> {
    if (this.keywordTracker) {
      await this.keywordTracker.save();
    }
    this.status = 'shutdown';
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
    const tracked = this.keywordTracker?.getTrackedCount() ?? 0;
    return { healthy: this.status === 'active', details: `${tracked} keywords tracked` };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async contributeToBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null> {
    if (type !== 'weekly' || !this.keywordTracker) return null;
    const keywords = this.keywordTracker.getKeywords();
    if (keywords.length === 0) return null;
    return {
      pluginId: this.manifest.id,
      section: 'SEO Tracking',
      content: `${keywords.length} keywords tracked`,
      priority: 30,
      category: 'info',
    };
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return [];
  }

  // ── Public API ──────────────────────────────────────────────────────

  getKeywordTracker(): KeywordTracker | null {
    return this.keywordTracker;
  }

  getContentOptimizer(): ContentOptimizer | null {
    return this.contentOptimizer;
  }

  getLinkedInOptimizer(): LinkedInOptimizer | null {
    return this.linkedInOptimizer;
  }

  getConfig(): SEOEngineConfig {
    return this.config;
  }
}
