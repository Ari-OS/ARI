import { randomUUID } from 'node:crypto';
import { createLogger } from '../../kernel/logger.js';
import type { ApprovalRequest } from './types.js';
import type { EventBus } from '../../kernel/event-bus.js';

const log = createLogger('video-approval-gate');

// ─── Pending approvals store (in-memory) ─────────────────────────────────────

const pendingApprovals = new Map<string, {
  request: ApprovalRequest;
  resolve: (result: ApprovalResult) => void;
  reject: (err: Error) => void;
}>();

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ApprovalResult {
  approved: boolean;
  feedback: string;
  action: 'approve' | 'reject' | 'edit';
  editFeedback?: string;
}

// ─── Telegram notification adapter (duck-typed) ───────────────────────────────

interface TelegramNotifier {
  sendMessage: (text: string, options?: { parseMode?: 'HTML' | 'Markdown' }) => Promise<void>;
  sendPhoto: (photoPath: string, caption?: string) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL GATE
// ═══════════════════════════════════════════════════════════════════════════════

export class ApprovalGate {
  private readonly eventBus: EventBus;
  private telegram: TelegramNotifier | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  setTelegramNotifier(notifier: TelegramNotifier): void {
    this.telegram = notifier;
  }

  // ── Event listeners (responses from Telegram bot) ────────────────────────────

  private setupEventListeners(): void {
    // Listen for approval responses emitted by the Telegram bot command handler
    this.eventBus.on('video:approval_response', (payload: unknown) => {
      const data = payload as {
        requestId: string;
        action: 'approve' | 'reject' | 'edit';
        feedback?: string;
      };

      const pending = pendingApprovals.get(data.requestId);
      if (!pending) {
        log.warn({ requestId: data.requestId }, 'Approval response for unknown request');
        return;
      }

      log.info({ requestId: data.requestId, action: data.action }, 'Approval response received');

      const result: ApprovalResult = {
        approved: data.action === 'approve',
        feedback: data.feedback ?? '',
        action: data.action,
        editFeedback: data.action === 'edit' ? data.feedback : undefined,
      };

      pending.resolve(result);
      pendingApprovals.delete(data.requestId);
    });
  }

  // ── Request approval ──────────────────────────────────────────────────────────

  async requestApproval(params: {
    videoProjectId: string;
    type: ApprovalRequest['type'];
    previewText: string;
    previewUrl?: string;
    thumbnailPath?: string;
    timeoutMs?: number;
  }): Promise<ApprovalResult> {
    const { videoProjectId, type, previewText, previewUrl, thumbnailPath, timeoutMs = 3_600_000 } = params;

    const request: ApprovalRequest = {
      id: randomUUID(),
      videoProjectId,
      type,
      previewText,
      previewUrl,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    log.info({ requestId: request.id, type, videoProjectId }, 'Requesting approval');

    // Emit to audit
    this.eventBus.emit('video:approval_requested', {
      requestId: request.id,
      type,
      videoProjectId,
      timestamp: request.requestedAt,
    });

    // Send Telegram notification
    await this.sendApprovalNotification(request, thumbnailPath);

    // Wait for response via promise
    return new Promise<ApprovalResult>((resolve, reject) => {
      pendingApprovals.set(request.id, { request, resolve, reject });

      // Timeout
      setTimeout(() => {
        if (pendingApprovals.has(request.id)) {
          pendingApprovals.delete(request.id);
          log.warn({ requestId: request.id }, 'Approval request timed out');
          reject(new Error(`Approval request ${request.id} timed out after ${timeoutMs / 60000} minutes`));
        }
      }, timeoutMs);
    });
  }

  // ── Send Telegram notification ────────────────────────────────────────────────

  private async sendApprovalNotification(
    request: ApprovalRequest,
    thumbnailPath?: string,
  ): Promise<void> {
    if (!this.telegram) {
      log.warn({ requestId: request.id }, 'No Telegram notifier — approval notification skipped');
      return;
    }

    const typeLabels: Record<ApprovalRequest['type'], string> = {
      script:    'Script Review',
      video:     'Video Review',
      thumbnail: 'Thumbnail Review',
      publish:   'Publish Approval',
    };

    const message = [
      `<b>ARI Video Pipeline — ${typeLabels[request.type]}</b>`,
      ``,
      request.previewText,
      ``,
      `<b>Reply with:</b>`,
      `  <code>approve ${request.id}</code> — approve and continue`,
      `  <code>reject ${request.id}</code> — cancel this video`,
      `  <code>edit ${request.id} [your feedback]</code> — revise and re-submit`,
    ].join('\n');

    try {
      if (thumbnailPath && (request.type === 'thumbnail' || request.type === 'publish')) {
        await this.telegram.sendPhoto(thumbnailPath, message);
      } else {
        await this.telegram.sendMessage(message, { parseMode: 'HTML' });
      }

      log.info({ requestId: request.id }, 'Approval notification sent to Telegram');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ requestId: request.id, error: errorMsg }, 'Failed to send Telegram approval notification');
    }
  }

  // ── Handle response from Telegram bot ────────────────────────────────────────

  // Called by the Telegram bot command handler when user replies
  static handleApprovalResponse(
    eventBus: EventBus,
    requestId: string,
    action: 'approve' | 'reject' | 'edit',
    feedback?: string,
  ): void {
    eventBus.emit('video:approval_response', { requestId, action, feedback });
  }

  // ── Get pending requests ──────────────────────────────────────────────────────

  static getPendingRequests(): ApprovalRequest[] {
    return Array.from(pendingApprovals.values()).map((p) => p.request);
  }

  static hasPendingRequest(requestId: string): boolean {
    return pendingApprovals.has(requestId);
  }
}
