import type { EventBus } from '../../kernel/event-bus.js';
import type { XClient } from '../../integrations/twitter/client.js';
import type { DraftQueue } from './draft-queue.js';
import type { ContentDraft } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-publisher');

export interface PublishResult {
  success: boolean;
  publishedIds: string[];
  error?: string;
}

export class ContentPublisher {
  private readonly eventBus: EventBus;
  private readonly xClient: XClient;
  private readonly draftQueue: DraftQueue;

  constructor(eventBus: EventBus, xClient: XClient, draftQueue: DraftQueue) {
    this.eventBus = eventBus;
    this.xClient = xClient;
    this.draftQueue = draftQueue;
  }

  async publishDraft(draftId: string): Promise<PublishResult> {
    const draft = this.draftQueue.getDraft(draftId);
    if (!draft) {
      return { success: false, publishedIds: [], error: `Draft not found: ${draftId}` };
    }

    if (draft.status !== 'approved') {
      return { success: false, publishedIds: [], error: `Draft must be approved before publishing (current: ${draft.status})` };
    }

    if (!this.xClient.isReady()) {
      return { success: false, publishedIds: [], error: 'X client not initialized — check X_BEARER_TOKEN' };
    }

    try {
      let publishedIds: string[];

      if (draft.platform === 'x_thread' && draft.content.length > 1) {
        publishedIds = await this.publishThread(draft);
      } else if (draft.platform === 'x_single' || draft.platform === 'quick_take') {
        publishedIds = await this.publishTweet(draft);
      } else {
        // LinkedIn, blog_outline — not yet supported for auto-publish
        return { success: false, publishedIds: [], error: `Auto-publishing not supported for ${draft.platform}` };
      }

      // Update draft status
      const updated = await this.draftQueue.updateStatus(draftId, 'published');
      // Store published IDs in metadata
      if (updated) {
        updated.publishedIds = publishedIds;
        updated.publishedAt = new Date().toISOString();
      }

      this.eventBus.emit('content:published', {
        draftId,
        platform: draft.platform,
        publishedIds,
      });

      log.info({ draftId, platform: draft.platform, tweetCount: publishedIds.length }, 'Content published');
      return { success: true, publishedIds };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.eventBus.emit('content:publish_failed', {
        draftId,
        platform: draft.platform,
        error: errorMsg,
      });

      log.error({ draftId, error: errorMsg }, 'Publishing failed');
      return { success: false, publishedIds: [], error: errorMsg };
    }
  }

  async publishAllApproved(): Promise<{ published: number; failed: number }> {
    const approved = this.draftQueue.getApproved();
    let published = 0;
    let failed = 0;

    for (const draft of approved) {
      const result = await this.publishDraft(draft.id);
      if (result.success) {
        published++;
      } else {
        failed++;
      }
    }

    return { published, failed };
  }

  private async publishTweet(draft: ContentDraft): Promise<string[]> {
    const text = draft.content[0];
    const result = await this.xClient.postTweet(text);
    return result.id ? [result.id] : [];
  }

  private async publishThread(draft: ContentDraft): Promise<string[]> {
    const result = await this.xClient.postThread(draft.content);
    return result.ids;
  }
}
