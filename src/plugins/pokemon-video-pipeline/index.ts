/**
 * Pokemon TCG Video Pipeline
 *
 * Automates the creation of Pokémon TCG market analysis videos.
 * TCGPlayer API (Trend Detection) -> Claude (Script) -> DALL·E 3 (Thumbnail) ->
 * HeyGen (Avatar Video) -> AssemblyAI (Captions) -> YouTube (Publish)
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { AIOrchestrator } from '../../ai/orchestrator.js';

const log = createLogger('pokemon-video-pipeline');

export interface VideoProject {
  id: string;
  cardName: string;
  trend: 'spike' | 'crash';
  priceChangePercent: number;
  status: 'pending_script' | 'pending_approval' | 'generating_assets' | 'ready_to_publish' | 'published';
  script?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  youtubeId?: string;
}

export class PokemonVideoPipeline {
  private projects = new Map<string, VideoProject>();

  constructor(
    private eventBus: EventBus,
    private orchestrator: AIOrchestrator
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for market spikes detected by the Pokemon TCG plugin
    this.eventBus.on('pokemon:price_spike', (payload: { cardName: string; changePercent: number }) => {
      log.info(`Detected price spike for ${payload.cardName}, initiating video pipeline`);
      this.initiateVideoProject(payload.cardName, 'spike', payload.changePercent).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to initiate video project');
      });
    });

    // Listen for Telegram approvals
    this.eventBus.on('telegram:video_approved', (payload: { projectId: string }) => {
      this.processApprovedVideo(payload.projectId).catch((err: unknown) => {
        log.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to process approved video');
      });
    });
  }

  async initiateVideoProject(cardName: string, trend: 'spike' | 'crash', changePercent: number) {
    const id = `vid_${Date.now()}`;
    const project: VideoProject = {
      id,
      cardName,
      trend,
      priceChangePercent: changePercent,
      status: 'pending_script',
    };
    this.projects.set(id, project);

    // 1. Script Generation (Claude)
    const prompt = `You are a Pokémon TCG market analyst for the YouTube channel "PayThePryce".
Write a punchy, 60-second YouTube Shorts script about the card ${cardName}, which just experienced a ${changePercent}% price ${trend}.
Format: Hook, Market Analysis, Actionable Insight, Call to Action.`;

    const scriptResponse = await this.orchestrator.query(prompt, 'video-pipeline');
    project.script = scriptResponse;
    project.status = 'pending_approval';

    // 2. Request Telegram Approval
    this.eventBus.emit('telegram:request_approval', {
      projectId: id,
      category: 'video_pipeline',
      timestamp: new Date().toISOString()
    });
  }

  async processApprovedVideo(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.status = 'generating_assets';

    // 3. Thumbnail Generation (DALL·E 3)
    log.info(`Generating thumbnail for ${project.cardName}...`);
    project.thumbnailUrl = await this.generateThumbnail(project.cardName);

    // 4. HeyGen Avatar Video
    log.info(`Generating HeyGen video for ${project.cardName}...`);
    project.videoUrl = await this.generateHeyGenVideo(project.script || '');

    // 5. AssemblyAI Captions (assumed integrated into HeyGen or processed post-render)
    log.info(`Generating captions for ${project.cardName}...`);
    
    project.status = 'ready_to_publish';

    // 6. Auto-Publish via YouTube API
    log.info(`Publishing to YouTube: ${project.cardName}`);
    project.youtubeId = await this.publishToYouTube(project);
    project.status = 'published';

    this.eventBus.emit('video:published', {
      projectId,
      youtubeVideoId: project.youtubeId,
      title: `Video for ${project.cardName}`,
      platform: 'youtube'
    });
  }

  private generateThumbnail(cardName: string): Promise<string> {
    // Mocked DALL·E 3 integration
    return Promise.resolve(`https://dalle.mock/thumbnail_${encodeURIComponent(cardName)}.png`);
  }

  private generateHeyGenVideo(_script: string): Promise<string> {
    // Mocked HeyGen API integration
    return Promise.resolve(`https://heygen.mock/video_${Date.now()}.mp4`);
  }

  private publishToYouTube(_project: VideoProject): Promise<string> {
    // Mocked YouTube API integration
    return Promise.resolve(`yt_${Date.now()}`);
  }
}
