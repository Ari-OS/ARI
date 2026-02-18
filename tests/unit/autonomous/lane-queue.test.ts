import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import { LaneQueue } from '../../../src/autonomous/lane-queue.js';
import type { Lane, QueueItem } from '../../../src/autonomous/lane-queue.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

// ── Mock EventBus ────────────────────────────────────────────────────────────

function createMockEventBus(): EventBus & { emitted: Array<{ event: string; payload: unknown }> } {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  return {
    emitted,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
    },
    on() { return () => {}; },
    off() {},
    once() { return () => {}; },
    listenerCount() { return 0; },
    removeAllListeners() {},
  } as unknown as EventBus & { emitted: Array<{ event: string; payload: unknown }> };
}

// ── Mock fs ──────────────────────────────────────────────────────────────────

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      mkdirSync: vi.fn(),
      appendFileSync: vi.fn(),
      existsSync: vi.fn().mockReturnValue(false),
      readFileSync: vi.fn().mockReturnValue(''),
    },
  };
});

describe('LaneQueue', () => {
  let queue: LaneQueue;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    queue = new LaneQueue(eventBus);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Enqueue / Dequeue ────────────────────────────────────────────────────

  it('should enqueue and dequeue an item', () => {
    const item = queue.enqueue('user', { task: 'test' });
    expect(item.id).toBeDefined();
    expect(item.lane).toBe('user');
    expect(item.status).toBe('pending');
    expect(item.payload).toEqual({ task: 'test' });

    const dequeued = queue.dequeue('user');
    expect(dequeued).not.toBeNull();
    expect(dequeued!.id).toBe(item.id);
    expect(dequeued!.status).toBe('running');
  });

  it('should return null when dequeuing from empty lane', () => {
    const result = queue.dequeue('user');
    expect(result).toBeNull();
  });

  it('should return null when dequeuing from a different lane', () => {
    queue.enqueue('user', { task: 'test' });
    const result = queue.dequeue('scheduled');
    expect(result).toBeNull();
  });

  // ── Priority ordering ───────────────────────────────────────────────────

  it('should dequeue higher priority items first', () => {
    queue.enqueue('background', { task: 'low' }, 1);
    queue.enqueue('background', { task: 'high' }, 10);
    queue.enqueue('background', { task: 'medium' }, 5);

    const first = queue.dequeue('background');
    expect(first).not.toBeNull();
    expect((first!.payload as Record<string, string>).task).toBe('high');

    const second = queue.dequeue('background');
    expect(second).not.toBeNull();
    expect((second!.payload as Record<string, string>).task).toBe('medium');

    const third = queue.dequeue('background');
    expect(third).not.toBeNull();
    expect((third!.payload as Record<string, string>).task).toBe('low');
  });

  it('should dequeue FIFO within same priority', () => {
    queue.enqueue('background', { task: 'first' }, 5);
    queue.enqueue('background', { task: 'second' }, 5);

    const first = queue.dequeue('background');
    expect((first!.payload as Record<string, string>).task).toBe('first');
  });

  // ── Lane concurrency limits ─────────────────────────────────────────────

  it('should enforce user lane concurrency of 1', () => {
    queue.enqueue('user', { task: 'a' });
    queue.enqueue('user', { task: 'b' });

    const first = queue.dequeue('user');
    expect(first).not.toBeNull();

    // Second dequeue should return null (concurrency limit reached)
    const second = queue.dequeue('user');
    expect(second).toBeNull();
  });

  it('should enforce scheduled lane concurrency of 1', () => {
    queue.enqueue('scheduled', { task: 'a' });
    queue.enqueue('scheduled', { task: 'b' });

    queue.dequeue('scheduled');
    const second = queue.dequeue('scheduled');
    expect(second).toBeNull();
  });

  it('should enforce initiative lane concurrency of 2', () => {
    queue.enqueue('initiative', { task: 'a' });
    queue.enqueue('initiative', { task: 'b' });
    queue.enqueue('initiative', { task: 'c' });

    queue.dequeue('initiative');
    queue.dequeue('initiative');
    const third = queue.dequeue('initiative');
    expect(third).toBeNull();
  });

  it('should enforce background lane concurrency of 3', () => {
    queue.enqueue('background', { task: 'a' });
    queue.enqueue('background', { task: 'b' });
    queue.enqueue('background', { task: 'c' });
    queue.enqueue('background', { task: 'd' });

    queue.dequeue('background');
    queue.dequeue('background');
    queue.dequeue('background');
    const fourth = queue.dequeue('background');
    expect(fourth).toBeNull();
  });

  it('should allow dequeue after markComplete frees a slot', () => {
    queue.enqueue('user', { task: 'a' });
    queue.enqueue('user', { task: 'b' });

    const first = queue.dequeue('user');
    expect(first).not.toBeNull();

    queue.markComplete(first!.id);

    const second = queue.dequeue('user');
    expect(second).not.toBeNull();
    expect((second!.payload as Record<string, string>).task).toBe('b');
  });

  // ── markComplete / markFailed ───────────────────────────────────────────

  it('should mark an item as completed', () => {
    const item = queue.enqueue('user', { task: 'test' });
    queue.dequeue('user');
    queue.markComplete(item.id);

    const retrieved = queue.get(item.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe('completed');
  });

  it('should mark an item as failed and re-queue for retry', () => {
    const item = queue.enqueue('user', { task: 'test' });
    queue.dequeue('user');
    queue.markFailed(item.id, 'timeout');

    const retrieved = queue.get(item.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe('pending'); // re-queued
    expect(retrieved!.retries).toBe(1);
    expect(retrieved!.error).toBe('timeout');
  });

  it('should mark item as permanently failed after max retries', () => {
    const item = queue.enqueue('user', { task: 'test' });
    queue.dequeue('user');

    // Fail 3 times (maxRetries = 3)
    queue.markFailed(item.id, 'error 1');
    queue.dequeue('user'); // re-dequeue after retry
    queue.markFailed(item.id, 'error 2');
    queue.dequeue('user'); // re-dequeue after retry
    queue.markFailed(item.id, 'error 3');

    const retrieved = queue.get(item.id);
    expect(retrieved!.status).toBe('failed');
    expect(retrieved!.retries).toBe(3);
  });

  it('should handle markComplete on unknown id gracefully', () => {
    // Should not throw
    queue.markComplete('nonexistent-id');
  });

  it('should handle markFailed on unknown id gracefully', () => {
    // Should not throw
    queue.markFailed('nonexistent-id', 'some error');
  });

  // ── getStats ────────────────────────────────────────────────────────────

  it('should return correct stats per lane', () => {
    queue.enqueue('user', { task: 'u1' });
    queue.enqueue('user', { task: 'u2' });
    queue.enqueue('scheduled', { task: 's1' });
    queue.enqueue('background', { task: 'b1' });

    // Dequeue and complete one user task
    const u1 = queue.dequeue('user');
    queue.markComplete(u1!.id);

    // Dequeue and fail one background task permanently
    const b1 = queue.dequeue('background');
    queue.markFailed(b1!.id, 'err');
    queue.dequeue('background');
    queue.markFailed(b1!.id, 'err');
    queue.dequeue('background');
    queue.markFailed(b1!.id, 'err');

    const stats = queue.getStats();

    expect(stats.user.pending).toBe(1);
    expect(stats.user.completed).toBe(1);
    expect(stats.scheduled.pending).toBe(1);
    expect(stats.background.failed).toBe(1);
    expect(stats.initiative.pending).toBe(0);
  });

  it('should return zero counts for empty queue', () => {
    const stats = queue.getStats();
    const lanes: Lane[] = ['user', 'scheduled', 'initiative', 'background'];
    for (const lane of lanes) {
      expect(stats[lane].pending).toBe(0);
      expect(stats[lane].running).toBe(0);
      expect(stats[lane].completed).toBe(0);
      expect(stats[lane].failed).toBe(0);
    }
  });

  // ── Persistence ─────────────────────────────────────────────────────────

  it('should persist items to JSONL file on enqueue', () => {
    queue.enqueue('user', { task: 'persist-test' });

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('pending.jsonl'),
      expect.stringContaining('"persist-test"'),
      'utf-8',
    );
  });

  // ── Rehydrate ───────────────────────────────────────────────────────────

  it('should rehydrate pending items from JSONL file', () => {
    const pendingItem: QueueItem = {
      id: 'rehydrate-1',
      lane: 'user',
      priority: 5,
      payload: { task: 'rehydrated' },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retries: 0,
      maxRetries: 3,
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pendingItem) + '\n');

    queue.rehydrate();

    const item = queue.get('rehydrate-1');
    expect(item).toBeDefined();
    expect(item!.status).toBe('pending');
    expect((item!.payload as Record<string, string>).task).toBe('rehydrated');
  });

  it('should reset running items to pending on rehydrate', () => {
    const runningItem: QueueItem = {
      id: 'running-1',
      lane: 'scheduled',
      priority: 3,
      payload: { task: 'was-running' },
      createdAt: new Date().toISOString(),
      status: 'running',
      retries: 0,
      maxRetries: 3,
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(runningItem) + '\n');

    queue.rehydrate();

    const item = queue.get('running-1');
    expect(item).toBeDefined();
    expect(item!.status).toBe('pending');
  });

  it('should skip completed items on rehydrate', () => {
    const completedItem: QueueItem = {
      id: 'completed-1',
      lane: 'user',
      priority: 1,
      payload: { task: 'done' },
      createdAt: new Date().toISOString(),
      status: 'completed',
      retries: 0,
      maxRetries: 3,
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(completedItem) + '\n');

    queue.rehydrate();

    const item = queue.get('completed-1');
    expect(item).toBeUndefined();
  });

  it('should handle missing JSONL file on rehydrate', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Should not throw
    queue.rehydrate();

    const stats = queue.getStats();
    expect(stats.user.pending).toBe(0);
  });

  it('should skip malformed JSONL lines on rehydrate', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'not valid json\n' +
      JSON.stringify({
        id: 'good-1',
        lane: 'user',
        priority: 1,
        payload: {},
        createdAt: new Date().toISOString(),
        status: 'pending',
        retries: 0,
        maxRetries: 3,
      }) + '\n',
    );

    queue.rehydrate();

    expect(queue.get('good-1')).toBeDefined();
  });

  // ── Events ──────────────────────────────────────────────────────────────

  it('should emit queue:enqueued event on enqueue', () => {
    queue.enqueue('user', { task: 'test' });

    const enqueued = eventBus.emitted.find((e) => e.event === 'queue:enqueued');
    expect(enqueued).toBeDefined();
    expect((enqueued!.payload as Record<string, unknown>).lane).toBe('user');
  });

  it('should emit queue:completed event on markComplete', () => {
    const item = queue.enqueue('user', { task: 'test' });
    queue.dequeue('user');
    queue.markComplete(item.id);

    const completed = eventBus.emitted.find((e) => e.event === 'queue:completed');
    expect(completed).toBeDefined();
    expect((completed!.payload as Record<string, unknown>).id).toBe(item.id);
  });

  it('should emit queue:failed event on markFailed', () => {
    const item = queue.enqueue('user', { task: 'test' });
    queue.dequeue('user');
    queue.markFailed(item.id, 'broke');

    const failed = eventBus.emitted.find((e) => e.event === 'queue:failed');
    expect(failed).toBeDefined();
    expect((failed!.payload as Record<string, unknown>).error).toBe('broke');
  });

  // ── Concurrency limit accessor ─────────────────────────────────────────

  it('should report correct concurrency limits', () => {
    expect(queue.getConcurrencyLimit('user')).toBe(1);
    expect(queue.getConcurrencyLimit('scheduled')).toBe(1);
    expect(queue.getConcurrencyLimit('initiative')).toBe(2);
    expect(queue.getConcurrencyLimit('background')).toBe(3);
  });

  // ── Default priority ───────────────────────────────────────────────────

  it('should default priority to 0 when not specified', () => {
    const item = queue.enqueue('user', { task: 'default-priority' });
    expect(item.priority).toBe(0);
  });
});
