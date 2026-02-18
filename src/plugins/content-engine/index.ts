import type { EventBus } from '../../kernel/event-bus.js';
import type {
  DomainPlugin,
  PluginManifest,
  PluginStatus,
  PluginDependencies,
  BriefingContribution,
  ScheduledTaskDefinition,
} from '../types.js';
import { ContentEngineConfigSchema } from './types.js';
import type { ContentEngineConfig } from './types.js';
import { TrendAnalyzer } from './trend-analyzer.js';
import { ContentDrafter } from './content-drafter.js';
import { DraftQueue } from './draft-queue.js';
import { ContentPublisher } from './publisher.js';
import { ContentRepurposer } from './repurposer.js';
import { EngagementBot } from './engagement-bot.js';
import { ContentAnalytics } from './analytics.js';
import { FeedbackLoop } from './feedback-loop.js';
import { IntentMonitor } from './intent-monitor.js';
import { ContentQualityScorer } from './quality-scorer.js';
import { RevisionEngine } from './revision-engine.js';
import type { XClient } from '../../integrations/twitter/client.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-engine');

export class ContentEnginePlugin implements DomainPlugin {
  readonly manifest: PluginManifest = {
    id: 'content-engine',
    name: 'Content Engine',
    version: '1.0.0',
    description: 'AI-powered content generation pipeline: trend analysis → draft generation → review → publish',
    author: 'ARI',
    capabilities: ['briefing', 'scheduling', 'data'],
    dependencies: [],
  };

  private status: PluginStatus = 'registered';
  private eventBus!: EventBus;
  private config!: ContentEngineConfig;
  private trendAnalyzer!: TrendAnalyzer;
  private drafter!: ContentDrafter;
  private draftQueue!: DraftQueue;
  private publisher!: ContentPublisher;
  private repurposer: ContentRepurposer | null = null;
  private engagementBot: EngagementBot | null = null;
  private analytics: ContentAnalytics | null = null;
  private feedbackLoop: FeedbackLoop | null = null;
  private intentMonitor: IntentMonitor | null = null;
  private qualityScorer: ContentQualityScorer | null = null;
  private revisionEngine: RevisionEngine | null = null;

  async initialize(deps: PluginDependencies): Promise<void> {
    this.eventBus = deps.eventBus;
    this.config = ContentEngineConfigSchema.parse(deps.config);
    this.trendAnalyzer = new TrendAnalyzer(this.config);
    this.draftQueue = new DraftQueue(deps.eventBus, deps.dataDir);
    await this.draftQueue.init();

    // Components that accept null xClient — instantiate now, xClient wired later via initPublisher
    this.analytics = new ContentAnalytics(null);
    await this.analytics.loadMetrics();
    this.feedbackLoop = new FeedbackLoop(this.analytics);
    this.engagementBot = new EngagementBot(null, null);
    this.intentMonitor = new IntentMonitor(null, null);

    if (deps.orchestrator) {
      this.drafter = new ContentDrafter(deps.orchestrator, this.config);
      this.repurposer = new ContentRepurposer(deps.orchestrator);
      this.qualityScorer = new ContentQualityScorer(deps.orchestrator);
      const orch = deps.orchestrator;
      this.revisionEngine = new RevisionEngine({
        chat: (messages: Array<{ role: string; content: string }>, systemPrompt?: string) =>
          orch.chat(
            messages.map((m) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })),
            systemPrompt,
          ),
      });
      // Wire orchestrator into engagement and intent components
      this.engagementBot = new EngagementBot(null, deps.orchestrator);
      this.intentMonitor = new IntentMonitor(null, deps.orchestrator);
    }

    // Publisher requires XClient — initialized externally if available
    this.status = 'active';
    log.info('Content engine plugin initialized');
  }

  initPublisher(xClient: XClient): void {
    this.publisher = new ContentPublisher(this.eventBus, xClient, this.draftQueue);
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
    const pending = this.draftQueue.getPending().length;
    const approved = this.draftQueue.getApproved().length;
    return {
      healthy: this.status === 'active',
      details: `${pending} pending, ${approved} approved drafts`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async contributeToBriefing(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null> {
    if (type !== 'morning') return null;

    const pending = this.draftQueue.getPending();
    const approved = this.draftQueue.getApproved();

    if (pending.length === 0 && approved.length === 0) return null;

    const lines: string[] = [];
    if (pending.length > 0) {
      lines.push(`${pending.length} draft${pending.length > 1 ? 's' : ''} awaiting review`);
      for (const d of pending.slice(0, 2)) {
        lines.push(`  ▸ ${d.topicBrief.headline.slice(0, 60)} (${d.platform})`);
      }
    }
    if (approved.length > 0) {
      lines.push(`${approved.length} approved, ready to publish`);
    }

    return {
      pluginId: this.manifest.id,
      section: 'Content Pipeline',
      content: lines.join('\n'),
      priority: 40,
      category: 'info',
    };
  }

  getScheduledTasks(): ScheduledTaskDefinition[] {
    return []; // Scheduled via scheduler.ts handlers, not plugin tasks
  }

  // ── Public API (used by Telegram commands + scheduler handlers) ────

  getTrendAnalyzer(): TrendAnalyzer {
    return this.trendAnalyzer;
  }

  getDrafter(): ContentDrafter {
    return this.drafter;
  }

  getDraftQueue(): DraftQueue {
    return this.draftQueue;
  }

  getPublisher(): ContentPublisher | undefined {
    return this.publisher;
  }

  getConfig(): ContentEngineConfig {
    return this.config;
  }

  getRepurposer(): ContentRepurposer | null {
    return this.repurposer;
  }

  getEngagementBot(): EngagementBot | null {
    return this.engagementBot;
  }

  getAnalytics(): ContentAnalytics | null {
    return this.analytics;
  }

  getFeedbackLoop(): FeedbackLoop | null {
    return this.feedbackLoop;
  }

  getIntentMonitor(): IntentMonitor | null {
    return this.intentMonitor;
  }

  getQualityScorer(): ContentQualityScorer | null {
    return this.qualityScorer;
  }

  getRevisionEngine(): RevisionEngine | null {
    return this.revisionEngine;
  }
}
