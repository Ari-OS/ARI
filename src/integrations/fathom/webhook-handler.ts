/**
 * FATHOM WEBHOOK HANDLER — Receives meeting data from Fathom webhooks
 *
 * Processes incoming Fathom webhook payloads containing meeting transcripts,
 * extracts action items via ActionItemExtractor, and emits events for
 * downstream consumers (task creation, briefings, etc.).
 *
 * Phase 20: Meeting-to-Action-Items Pipeline
 */

import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';
import { ActionItemExtractor } from './action-item-extractor.js';
import type { ActionItem } from './action-item-extractor.js';

const log = createLogger('fathom-webhook');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FathomPayload {
  meetingId: string;
  title: string;
  date: string;
  participants: string[];
  transcript: string;
  duration: number;
}

export interface FathomResult {
  meetingId: string;
  processed: boolean;
  actionItems: ActionItem[];
}

// ─── Handler ────────────────────────────────────────────────────────────────

export class FathomWebhookHandler {
  private readonly eventBus: EventBus;
  private readonly extractor: ActionItemExtractor | null;

  constructor(params: {
    eventBus: EventBus;
    extractor?: ActionItemExtractor;
  }) {
    this.eventBus = params.eventBus;
    this.extractor = params.extractor ?? null;
  }

  /**
   * Process incoming webhook from Fathom.
   * Validates payload, extracts action items, emits events.
   */
  async processWebhook(payload: FathomPayload): Promise<FathomResult> {
    const { meetingId, title, participants, transcript, duration } = payload;

    log.info({ meetingId, title, participants: participants.length, duration }, 'Processing Fathom webhook');

    if (!meetingId || !transcript) {
      log.warn({ meetingId }, 'Invalid Fathom payload: missing meetingId or transcript');
      return { meetingId: meetingId ?? 'unknown', processed: false, actionItems: [] };
    }

    if (transcript.trim().length === 0) {
      log.warn({ meetingId }, 'Empty transcript, skipping extraction');
      this.emitMeetingProcessed(payload, []);
      return { meetingId, processed: true, actionItems: [] };
    }

    let actionItems: ActionItem[] = [];

    if (this.extractor) {
      try {
        actionItems = await this.extractor.extract(transcript, participants);
        log.info({ meetingId, actionItemCount: actionItems.length }, 'Action items extracted');
      } catch (error) {
        log.error(
          { meetingId, error: error instanceof Error ? error.message : String(error) },
          'Failed to extract action items',
        );
      }
    }

    this.emitMeetingProcessed(payload, actionItems);

    if (actionItems.length > 0) {
      this.emitActionItemsExtracted(meetingId, actionItems);
    }

    return { meetingId, processed: true, actionItems };
  }

  private emitMeetingProcessed(payload: FathomPayload, actionItems: ActionItem[]): void {
    this.eventBus.emit('audit:log', {
      action: 'fathom:meeting_processed',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        meetingId: payload.meetingId,
        title: payload.title,
        participantCount: payload.participants.length,
        duration: payload.duration,
        actionItemCount: actionItems.length,
      },
    });
  }

  private emitActionItemsExtracted(meetingId: string, actionItems: ActionItem[]): void {
    this.eventBus.emit('audit:log', {
      action: 'fathom:action_items_extracted',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        meetingId,
        count: actionItems.length,
        assignees: [...new Set(actionItems.map(a => a.assignee))],
      },
    });
  }
}
