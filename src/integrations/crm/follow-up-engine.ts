/**
 * CRM Follow-Up Engine — Stale Contact Detection & Follow-Up Recommendations
 *
 * Integrates with CRMStore and InteractionLog to detect stale relationships
 * and generate actionable follow-up recommendations. Emits EventBus events
 * for proactive notification delivery.
 *
 * Features:
 *   - Configurable staleness thresholds per contact category
 *   - Interaction frequency analysis for urgency scoring
 *   - Follow-up queue with priority ordering
 *   - EventBus integration for proactive alerts
 *
 * Layer: Integrations (CRM)
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { CRMStore, Contact, ContactCategory } from './crm-store.js';
import type { InteractionLog } from './interaction-log.js';

const log = createLogger('follow-up-engine');

// ─── Types ──────────────────────────────────────────────────────────────────

export type FollowUpUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface FollowUp {
  contactId: string;
  contactName: string;
  category: ContactCategory;
  urgency: FollowUpUrgency;
  daysSinceContact: number;
  interactionCount30d: number;
  relationshipScore: number;
  reason: string;
  suggestedAction: string;
  suggestedChannel: string;
  generatedAt: string;
}

export interface FollowUpSummary {
  total: number;
  byCritical: number;
  byHigh: number;
  byMedium: number;
  byLow: number;
  topContacts: Array<{ name: string; urgency: FollowUpUrgency; days: number }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Days without contact before follow-up triggers, per category */
const STALE_THRESHOLDS: Record<ContactCategory, Record<FollowUpUrgency, number>> = {
  client: { critical: 45, high: 30, medium: 21, low: 14 },
  prospect: { critical: 30, high: 21, medium: 14, low: 7 },
  partner: { critical: 60, high: 45, medium: 30, low: 21 },
  personal: { critical: 90, high: 60, medium: 45, low: 30 },
  other: { critical: 90, high: 60, medium: 45, low: 30 },
};

const SUGGESTED_ACTIONS: Record<FollowUpUrgency, string> = {
  critical: 'Schedule an in-person meeting or call immediately',
  high: 'Send a personal message or schedule a call this week',
  medium: 'Send a check-in email with something of value',
  low: 'Drop a quick note or share relevant content',
};

const SUGGESTED_CHANNELS: Record<FollowUpUrgency, string> = {
  critical: 'call',
  high: 'email',
  medium: 'email',
  low: 'telegram',
};

// ─── FollowUpEngine ─────────────────────────────────────────────────────────

export class FollowUpEngine {
  private readonly store: CRMStore;
  private readonly interactionLog: InteractionLog;
  private readonly eventBus: EventBus;
  private followUpQueue: FollowUp[] = [];

  constructor(params: {
    store: CRMStore;
    interactionLog: InteractionLog;
    eventBus: EventBus;
  }) {
    this.store = params.store;
    this.interactionLog = params.interactionLog;
    this.eventBus = params.eventBus;
  }

  /**
   * Scan for stale contacts and populate the follow-up queue
   */
  scanStaleContacts(thresholdDays?: number): FollowUp[] {
    const effectiveThreshold = thresholdDays ?? 14;
    const staleContacts = this.store.getStaleContacts(effectiveThreshold);

    const followUps: FollowUp[] = [];

    for (const contact of staleContacts) {
      const followUp = this.buildFollowUp(contact);
      if (followUp) {
        followUps.push(followUp);
      }
    }

    // Sort by urgency (critical first), then by days since contact
    const urgencyOrder: Record<FollowUpUrgency, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    followUps.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.daysSinceContact - a.daysSinceContact;
    });

    // Update the queue and emit events
    this.followUpQueue = followUps;

    for (const followUp of followUps) {
      if (followUp.urgency === 'critical' || followUp.urgency === 'high') {
        this.eventBus.emit('crm:follow_up_needed', {
          contactId: followUp.contactId,
          name: followUp.contactName,
          daysSinceContact: followUp.daysSinceContact,
          urgency: followUp.urgency,
          timestamp: new Date().toISOString(),
        });
      }
    }

    log.info(
      { total: followUps.length, critical: followUps.filter(f => f.urgency === 'critical').length },
      'Stale contact scan complete',
    );

    return followUps;
  }

  /**
   * Generate a detailed follow-up recommendation for a specific contact
   */
  generateFollowUp(contactId: string): FollowUp | null {
    const contact = this.store.getContact(contactId);
    if (!contact) {
      log.warn({ contactId }, 'Contact not found for follow-up generation');
      return null;
    }

    return this.buildFollowUp(contact);
  }

  /**
   * Get the current follow-up queue
   */
  getFollowUpQueue(): FollowUp[] {
    return [...this.followUpQueue];
  }

  /**
   * Get a summary of follow-up needs
   */
  getSummary(): FollowUpSummary {
    const queue = this.followUpQueue;

    return {
      total: queue.length,
      byCritical: queue.filter(f => f.urgency === 'critical').length,
      byHigh: queue.filter(f => f.urgency === 'high').length,
      byMedium: queue.filter(f => f.urgency === 'medium').length,
      byLow: queue.filter(f => f.urgency === 'low').length,
      topContacts: queue.slice(0, 5).map(f => ({
        name: f.contactName,
        urgency: f.urgency,
        days: f.daysSinceContact,
      })),
    };
  }

  /**
   * Remove a contact from the follow-up queue (e.g., after follow-up is done)
   */
  markFollowedUp(contactId: string): boolean {
    const initialLength = this.followUpQueue.length;
    this.followUpQueue = this.followUpQueue.filter(f => f.contactId !== contactId);
    return this.followUpQueue.length < initialLength;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private buildFollowUp(contact: Contact): FollowUp | null {
    const daysSince = this.daysSinceContact(contact.lastContactDate);
    const thresholds = STALE_THRESHOLDS[contact.category];
    const interactionCount30d = this.interactionLog.countInteractions(contact.id, 30);

    // Determine urgency based on thresholds
    let urgency: FollowUpUrgency;
    if (daysSince >= thresholds.critical) {
      urgency = 'critical';
    } else if (daysSince >= thresholds.high) {
      urgency = 'high';
    } else if (daysSince >= thresholds.medium) {
      urgency = 'medium';
    } else if (daysSince >= thresholds.low) {
      urgency = 'low';
    } else {
      return null; // Not stale enough
    }

    // Boost urgency for high-value contacts with no recent interactions
    if (interactionCount30d === 0 && contact.relationshipScore >= 70 && urgency !== 'critical') {
      const urgencyLevels: FollowUpUrgency[] = ['low', 'medium', 'high', 'critical'];
      const currentIdx = urgencyLevels.indexOf(urgency);
      if (currentIdx < urgencyLevels.length - 1) {
        urgency = urgencyLevels[currentIdx + 1];
      }
    }

    const reason = this.buildReason(contact, daysSince, interactionCount30d);
    const suggestedAction = SUGGESTED_ACTIONS[urgency]
      .replace('$NAME', contact.name);
    const suggestedChannel = SUGGESTED_CHANNELS[urgency];

    return {
      contactId: contact.id,
      contactName: contact.name,
      category: contact.category,
      urgency,
      daysSinceContact: daysSince,
      interactionCount30d,
      relationshipScore: contact.relationshipScore,
      reason,
      suggestedAction,
      suggestedChannel,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildReason(
    contact: Contact,
    daysSince: number,
    interactionCount30d: number,
  ): string {
    const parts: string[] = [];

    parts.push(`No contact with ${contact.name} in ${daysSince} days`);

    if (interactionCount30d === 0) {
      parts.push('zero interactions in the last 30 days');
    } else {
      parts.push(`${interactionCount30d} interaction(s) in the last 30 days`);
    }

    if (contact.relationshipScore < 30) {
      parts.push('relationship score is declining');
    }

    if (contact.category === 'client' || contact.category === 'prospect') {
      parts.push(`${contact.category} relationship at risk`);
    }

    return parts.join(' — ');
  }

  private daysSinceContact(lastContactDate: string): number {
    const last = new Date(lastContactDate);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
