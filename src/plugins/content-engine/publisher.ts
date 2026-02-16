import type { EventBus } from '../../kernel/event-bus.js';
import type { XClient } from '../../integrations/twitter/client.js';
import type { DraftQueue } from './draft-queue.js';
import type { ContentDraft } from './types.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-publisher');

// ─── Content Validation Constants ─────────────────────────────────────────────

const MAX_TWEET_LENGTH = 280;

// Patterns that might indicate secrets (API keys, tokens, etc.)
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)[\s:=]+['"]?[\w-]{20,}/i,
  /(?:bearer|token)[\s:=]+['"]?[\w-]{20,}/i,
  /(?:password|passwd|pwd)[\s:=]+['"]?\S{8,}/i,
  /(?:secret|private[_-]?key)[\s:=]+['"]?[\w-]{20,}/i,
  /sk-[a-zA-Z0-9]{32,}/, // OpenAI-style keys
  /ghp_[a-zA-Z0-9]{36,}/, // GitHub tokens
  /xoxb-[a-zA-Z0-9-]+/, // Slack tokens
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate content before publishing.
 * Checks for character limits, potential secrets, and other safety issues.
 */
function validateContent(content: string[]): ValidationResult {
  const errors: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const text = content[i];
    const tweetNum = content.length > 1 ? ` (tweet ${i + 1})` : '';

    // Check character limit
    if (text.length > MAX_TWEET_LENGTH) {
      errors.push(`Exceeds ${MAX_TWEET_LENGTH} character limit${tweetNum}: ${text.length} chars`);
    }

    // Check for potential secrets
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`Potential secret detected${tweetNum} — publishing blocked for safety`);
        break; // One secret error per tweet is enough
      }
    }

    // Check for empty content
    if (text.trim().length === 0) {
      errors.push(`Empty content${tweetNum}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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

    // ── Security: Validate content before publishing ──
    const validation = validateContent(draft.content);
    if (!validation.valid) {
      const errorMsg = `Content validation failed: ${validation.errors.join('; ')}`;
      log.warn({ draftId, errors: validation.errors }, 'Content validation blocked publishing');
      return { success: false, publishedIds: [], error: errorMsg };
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
