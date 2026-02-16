// tests/unit/plugins/content-engine/events.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../../src/kernel/event-bus.js';

describe('Content Engine Events', () => {
  it('should emit and receive content:draft_generated', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:draft_generated', handler);

    bus.emit('content:draft_generated', {
      draftId: 'draft-001',
      platform: 'x_thread',
      topicHeadline: 'AI agents are here',
      costUsd: 0.02,
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      platform: 'x_thread',
      topicHeadline: 'AI agents are here',
      costUsd: 0.02,
    });
  });

  it('should emit and receive content:draft_reviewed', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:draft_reviewed', handler);

    bus.emit('content:draft_reviewed', {
      draftId: 'draft-001',
      action: 'approved',
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      action: 'approved',
    });
  });

  it('should emit and receive content:published', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:published', handler);

    bus.emit('content:published', {
      draftId: 'draft-001',
      platform: 'x_thread',
      publishedIds: ['tweet-1', 'tweet-2'],
    });

    expect(handler).toHaveBeenCalledWith({
      draftId: 'draft-001',
      platform: 'x_thread',
      publishedIds: ['tweet-1', 'tweet-2'],
    });
  });

  it('should emit and receive content:trend_analyzed', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('content:trend_analyzed', handler);

    bus.emit('content:trend_analyzed', {
      topicCount: 3,
      topDomains: ['ai', 'programming'],
    });

    expect(handler).toHaveBeenCalledWith({
      topicCount: 3,
      topDomains: ['ai', 'programming'],
    });
  });
});
