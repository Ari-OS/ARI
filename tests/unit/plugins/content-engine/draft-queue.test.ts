// tests/unit/plugins/content-engine/draft-queue.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DraftQueue } from '../../../../src/plugins/content-engine/draft-queue.js';
import { EventBus } from '../../../../src/kernel/event-bus.js';
import type { ContentDraft, TopicBrief } from '../../../../src/plugins/content-engine/types.js';

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('not found')),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('DraftQueue', () => {
  let queue: DraftQueue;
  let eventBus: EventBus;

  const sampleBrief: TopicBrief = {
    headline: 'AI agents are changing everything',
    keyPoints: ['Agents can now use tools', 'Cost is dropping'],
    angle: 'How solo devs can leverage this',
    targetPlatform: 'x_thread',
    sourceItemIds: ['intel-001'],
    threadabilityScore: 85,
  };

  beforeEach(() => {
    eventBus = new EventBus();
    queue = new DraftQueue(eventBus, '/tmp/test-content');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addDraft', () => {
    it('should create a draft with pending status', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook tweet', 'Body tweet', 'CTA'],
        modelUsed: 'claude-sonnet-4',
        costUsd: 0.02,
      });

      expect(draft.id).toMatch(/^draft-\d{4}-\d{2}-\d{2}-/);
      expect(draft.status).toBe('pending');
      expect(draft.content).toHaveLength(3);
    });

    it('should emit content:draft_generated event', async () => {
      const spy = vi.fn();
      eventBus.on('content:draft_generated', spy);

      await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
        modelUsed: 'claude-sonnet-4',
        costUsd: 0.01,
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'x_thread',
        topicHeadline: 'AI agents are changing everything',
      }));
    });
  });

  describe('updateStatus', () => {
    it('should transition from pending to approved', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });

      const updated = await queue.updateStatus(draft.id, 'approved');
      expect(updated.status).toBe('approved');
      expect(updated.reviewedAt).toBeDefined();
    });

    it('should transition from pending to rejected with reason', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'linkedin',
        content: ['Post text'],
      });

      const updated = await queue.updateStatus(draft.id, 'rejected', 'Too generic');
      expect(updated.status).toBe('rejected');
      expect(updated.rejectionReason).toBe('Too generic');
    });

    it('should emit content:draft_reviewed on status change', async () => {
      const spy = vi.fn();
      eventBus.on('content:draft_reviewed', spy);

      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });
      await queue.updateStatus(draft.id, 'approved');

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        draftId: draft.id,
        action: 'approved',
      }));
    });

    it('should throw on invalid draft ID', async () => {
      await expect(queue.updateStatus('nonexistent', 'approved')).rejects.toThrow();
    });
  });

  describe('getPending', () => {
    it('should return only pending drafts', async () => {
      await queue.addDraft({ topicBrief: sampleBrief, platform: 'x_thread', content: ['A'] });
      await queue.addDraft({ topicBrief: sampleBrief, platform: 'linkedin', content: ['B'] });
      const draft3 = await queue.addDraft({ topicBrief: sampleBrief, platform: 'x_single', content: ['C'] });
      await queue.updateStatus(draft3.id, 'approved');

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
    });
  });

  describe('getApproved', () => {
    it('should return only approved drafts', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'x_thread',
        content: ['Hook'],
      });
      await queue.updateStatus(draft.id, 'approved');

      const approved = queue.getApproved();
      expect(approved).toHaveLength(1);
      expect(approved[0].id).toBe(draft.id);
    });
  });

  describe('getDraft', () => {
    it('should return a specific draft by ID', async () => {
      const draft = await queue.addDraft({
        topicBrief: sampleBrief,
        platform: 'linkedin',
        content: ['Post'],
      });

      const found = queue.getDraft(draft.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(draft.id);
    });

    it('should return undefined for unknown ID', () => {
      expect(queue.getDraft('unknown')).toBeUndefined();
    });
  });
});
