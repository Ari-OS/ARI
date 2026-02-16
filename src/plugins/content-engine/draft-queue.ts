// src/plugins/content-engine/draft-queue.ts
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../../kernel/event-bus.js';
import { ContentDraftSchema, type ContentDraft, type ContentPlatform, type DraftStatus, type TopicBrief } from './types.js';

interface AddDraftParams {
  topicBrief: TopicBrief;
  platform: ContentPlatform;
  content: string[];
  modelUsed?: string;
  costUsd?: number;
}

export class DraftQueue {
  private drafts: Map<string, ContentDraft> = new Map();
  private eventBus: EventBus;
  private dataDir: string;
  private counter = 0;

  constructor(eventBus: EventBus, dataDir: string) {
    this.eventBus = eventBus;
    this.dataDir = dataDir;
  }

  async init(): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    await this.loadFromDisk();
  }

  async addDraft(params: AddDraftParams): Promise<ContentDraft> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    this.counter++;
    const id = `draft-${dateStr}-${String(this.counter).padStart(3, '0')}`;

    const draft = ContentDraftSchema.parse({
      id,
      topicBrief: params.topicBrief,
      platform: params.platform,
      content: params.content,
      status: 'pending',
      createdAt: now.toISOString(),
      modelUsed: params.modelUsed,
      costUsd: params.costUsd,
    });

    this.drafts.set(id, draft);
    await this.persist(draft);

    this.eventBus.emit('content:draft_generated', {
      draftId: id,
      platform: params.platform,
      topicHeadline: params.topicBrief.headline,
      costUsd: params.costUsd ?? 0,
    });

    return draft;
  }

  async updateStatus(draftId: string, status: DraftStatus, reason?: string): Promise<ContentDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    const now = new Date().toISOString();
    const updated: ContentDraft = {
      ...draft,
      status,
      reviewedAt: ['approved', 'rejected', 'edited'].includes(status) ? now : draft.reviewedAt,
      publishedAt: status === 'published' ? now : draft.publishedAt,
      rejectionReason: status === 'rejected' ? reason : draft.rejectionReason,
    };

    if (status === 'edited' && reason) {
      updated.editRequests = [...draft.editRequests, reason];
    }

    this.drafts.set(draftId, updated);
    await this.persist(updated);

    if (['approved', 'rejected', 'edited'].includes(status)) {
      this.eventBus.emit('content:draft_reviewed', {
        draftId,
        action: status as 'approved' | 'edited' | 'rejected',
        reason,
      });
    }

    return updated;
  }

  getDraft(id: string): ContentDraft | undefined {
    return this.drafts.get(id);
  }

  getPending(): ContentDraft[] {
    return [...this.drafts.values()].filter((d) => d.status === 'pending');
  }

  getApproved(): ContentDraft[] {
    return [...this.drafts.values()].filter((d) => d.status === 'approved');
  }

  getAll(): ContentDraft[] {
    return [...this.drafts.values()];
  }

  private async persist(draft: ContentDraft): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    await fs.mkdir(draftsDir, { recursive: true });
    const filePath = join(draftsDir, `${draft.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(draft, null, 2));
  }

  private async loadFromDisk(): Promise<void> {
    const draftsDir = join(this.dataDir, 'drafts');
    try {
      const files = await fs.readdir(draftsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(join(draftsDir, file), 'utf-8');
          const parsed = JSON.parse(data) as unknown;
          const draft = ContentDraftSchema.parse(parsed);
          this.drafts.set(draft.id, draft);
          this.counter = Math.max(this.counter, parseInt(draft.id.split('-').pop() ?? '0', 10));
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Directory may not exist yet
    }
  }
}
