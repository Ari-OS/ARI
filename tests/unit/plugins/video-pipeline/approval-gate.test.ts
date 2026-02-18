import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalGate } from '../../../../src/plugins/video-pipeline/approval-gate.js';
import type { EventBus } from '../../../../src/kernel/event-bus.js';

// ── Mock EventBus ─────────────────────────────────────────────────────────────

function makeMockEventBus(): EventBus {
  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
      return () => {};
    }),
    emit: vi.fn((event: string, payload: unknown) => {
      handlers.get(event)?.forEach((h) => h(payload));
    }),
    off: vi.fn(),
    once: vi.fn(),
    clear: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0),
    getHandlerErrorCount: vi.fn().mockReturnValue(0),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

const mockTelegram = {
  sendMessage: vi.fn<[string, { parseMode?: 'HTML' | 'Markdown' }?], Promise<void>>(),
  sendPhoto: vi.fn<[string, string?], Promise<void>>(),
};

/** Get the requestId emitted with video:approval_requested */
function getEmittedRequestId(eventBus: EventBus): string {
  const calls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
  const call = calls.find(([event]: [string]) => event === 'video:approval_requested');
  return (call![1] as { requestId: string }).requestId;
}

/**
 * Yield to the event loop to allow:
 * 1. sendApprovalNotification await to resolve (1 tick)
 * 2. requestApproval to reach pendingApprovals.set (2nd tick)
 */
async function yieldMicrotasks(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

describe('ApprovalGate', () => {
  let gate: ApprovalGate;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.resetAllMocks();
    eventBus = makeMockEventBus();
    gate = new ApprovalGate(eventBus);
    mockTelegram.sendMessage.mockResolvedValue(undefined);
    mockTelegram.sendPhoto.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Clean up any pending approvals
    for (const r of ApprovalGate.getPendingRequests()) {
      ApprovalGate.handleApprovalResponse(eventBus, r.id, 'reject', 'test-cleanup');
    }
  });

  it('registers approval_response listener on construction', () => {
    expect(eventBus.on).toHaveBeenCalledWith('video:approval_response', expect.any(Function));
  });

  it('emits video:approval_requested when requesting approval', async () => {
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-1',
      type: 'script',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks(); // let sendApprovalNotification + pendingApprovals.set complete
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve');
    await promise;
    expect(eventBus.emit).toHaveBeenCalledWith(
      'video:approval_requested',
      expect.objectContaining({ type: 'script', videoProjectId: 'proj-1' }),
    );
  });

  it('resolves with approved=true for approve action', async () => {
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-2',
      type: 'video',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks();
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve', 'looks good');
    const result = await promise;
    expect(result.approved).toBe(true);
    expect(result.action).toBe('approve');
    expect(result.feedback).toBe('looks good');
  });

  it('resolves with approved=false for reject action', async () => {
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-3',
      type: 'thumbnail',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks();
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'reject');
    const result = await promise;
    expect(result.approved).toBe(false);
    expect(result.action).toBe('reject');
  });

  it('sets editFeedback when action is edit', async () => {
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-4',
      type: 'publish',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks();
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'edit', 'change the title');
    const result = await promise;
    expect(result.action).toBe('edit');
    expect(result.editFeedback).toBe('change the title');
    expect(result.approved).toBe(false);
  });

  it('skips Telegram when no notifier is set', async () => {
    // No notifier set — sendApprovalNotification returns immediately
    const promise = gate.requestApproval({
      videoProjectId: 'proj-7',
      type: 'script',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks(); // let pendingApprovals.set run
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve');
    await promise;
    expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    expect(mockTelegram.sendPhoto).not.toHaveBeenCalled();
  });

  it('tracks and removes pending requests on resolution', async () => {
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-8',
      type: 'video',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks();
    expect(ApprovalGate.hasPendingRequest(requestId)).toBe(true);
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve');
    await promise;
    expect(ApprovalGate.hasPendingRequest(requestId)).toBe(false);
  });

  it('silently ignores approval response for unknown requestId', () => {
    expect(() => {
      ApprovalGate.handleApprovalResponse(eventBus, 'unknown-id', 'approve');
    }).not.toThrow();
  });

  it('resolves even when Telegram sendMessage throws', async () => {
    mockTelegram.sendMessage.mockRejectedValue(new Error('Telegram down'));
    gate.setTelegramNotifier(mockTelegram);
    const promise = gate.requestApproval({
      videoProjectId: 'proj-9',
      type: 'script',
      previewText: 'preview',
      timeoutMs: 5_000,
    });
    const requestId = getEmittedRequestId(eventBus);
    await yieldMicrotasks(3); // extra tick for error handling
    ApprovalGate.handleApprovalResponse(eventBus, requestId, 'approve');
    await expect(promise).resolves.toMatchObject({ approved: true });
  });
});
