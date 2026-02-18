/**
 * Contact Manager — Intelligent CRM Operations
 *
 * High-level contact management with natural language query handling,
 * interaction logging, follow-up recommendations, and weekly reporting.
 * Built on top of CRMStore with LLM-powered query interpretation.
 *
 * Usage:
 *   const manager = new ContactManager({ store, eventBus, orchestrator });
 *   const response = await manager.handleQuery('Find all clients at Acme');
 *   manager.logInteraction(contactId, { type: 'meeting', summary: '...', ... });
 *   const followUps = manager.getFollowUpRecommendations();
 *   const report = manager.generateWeeklyReport();
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';
import type { CRMStore, Contact } from './crm-store.js';

const log = createLogger('contact-manager');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Interaction {
  type: 'email' | 'call' | 'meeting' | 'message' | 'note';
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  date: string;
}

export interface FollowUpRecommendation {
  contact: Contact;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedAction: string;
  daysSinceContact: number;
}

export interface CRMWeeklyReport {
  followUpsNeeded: number;
  newProspects: number;
  pipelineValue: number;
  atRisk: Array<{ contact: Contact; reason: string }>;
  summary: string;
}

interface Orchestrator {
  query(prompt: string, agent?: string): Promise<string>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FOLLOW_UP_THRESHOLDS = {
  client: { high: 14, medium: 21, low: 30 },
  prospect: { high: 7, medium: 14, low: 21 },
  partner: { high: 21, medium: 30, low: 45 },
  personal: { high: 30, medium: 60, low: 90 },
  other: { high: 30, medium: 60, low: 90 },
} as const;

const SCORE_BOOSTS: Record<Interaction['type'], number> = {
  meeting: 15,
  call: 10,
  email: 5,
  message: 3,
  note: 1,
};

const SENTIMENT_MULTIPLIER: Record<Interaction['sentiment'], number> = {
  positive: 1.5,
  neutral: 1.0,
  negative: 0.5,
};

const NL_QUERY_PROMPT = `You are a CRM assistant for Pryceless Solutions.
Interpret the user's natural language query about contacts and return a JSON action.

Actions:
- { "action": "search", "query": "search terms" }
- { "action": "create", "name": "Name", "category": "client|prospect|partner|personal|other", "email": "optional", "company": "optional" }
- { "action": "stats" }
- { "action": "stale", "days": 30 }
- { "action": "followups" }

User query: `;

// ─── ContactManager ─────────────────────────────────────────────────────────

export class ContactManager {
  private store: CRMStore;
  private eventBus: EventBus;
  private orchestrator: Orchestrator;

  constructor(params: {
    store: CRMStore;
    eventBus: EventBus;
    orchestrator: Orchestrator;
  }) {
    this.store = params.store;
    this.eventBus = params.eventBus;
    this.orchestrator = params.orchestrator;
  }

  /**
   * Handle a natural language CRM query via LLM
   */
  async handleQuery(query: string): Promise<string> {
    try {
      const response = await this.orchestrator.query(
        `${NL_QUERY_PROMPT}${query}`,
        'crm-assistant',
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return `I could not interpret that CRM query. Try: "search John" or "show stats".`;
      }

      const action = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      switch (action.action) {
        case 'search': {
          const contacts = this.store.searchContacts(typeof action.query === 'string' ? action.query : query);
          if (contacts.length === 0) return 'No contacts found.';
          return contacts.map(c =>
            `${c.name} (${c.category})${c.company ? ` @ ${c.company}` : ''}${c.email ? ` — ${c.email}` : ''} [Score: ${c.relationshipScore}]`
          ).join('\n');
        }

        case 'create': {
          const contact = this.store.createContact({
            name: typeof action.name === 'string' ? action.name : '',
            email: typeof action.email === 'string' ? action.email : undefined,
            company: typeof action.company === 'string' ? action.company : undefined,
            category: (action.category as Contact['category']) ?? 'other',
            tags: [],
            notes: '',
            relationshipScore: 50,
            lastContactDate: new Date().toISOString(),
          });

          this.eventBus.emit('crm:contact_created', {
            contactId: contact.id,
            name: contact.name,
            category: contact.category,
            timestamp: new Date().toISOString(),
          });

          return `Created contact: ${contact.name} (${contact.category})`;
        }

        case 'stats': {
          const stats = this.store.getStats();
          const categories = Object.entries(stats.byCategory)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
          return [
            `Total contacts: ${stats.totalContacts}`,
            `Stale (30+ days): ${stats.staleContacts}`,
            `Avg relationship score: ${stats.avgRelationshipScore}`,
            `By category:\n${categories}`,
          ].join('\n');
        }

        case 'stale': {
          const days = Number(action.days ?? 30);
          const stale = this.store.getStaleContacts(days);
          if (stale.length === 0) return `No contacts stale for ${days}+ days.`;
          return `${stale.length} stale contact(s):\n` + stale.map(c =>
            `  ${c.name} — last contact: ${c.lastContactDate.slice(0, 10)}`
          ).join('\n');
        }

        case 'followups': {
          const recs = this.getFollowUpRecommendations();
          if (recs.length === 0) return 'No follow-ups needed right now.';
          return recs.map(r =>
            `[${r.urgency.toUpperCase()}] ${r.contact.name}: ${r.reason} — ${r.suggestedAction}`
          ).join('\n');
        }

        default:
          return `Unknown action: ${String(action.action)}. Try "search", "create", "stats", "stale", or "followups".`;
      }
    } catch (error) {
      log.error({ error, query }, 'Failed to handle CRM query');
      return 'Failed to process CRM query. Please try again.';
    }
  }

  /**
   * Log an interaction with a contact
   */
  logInteraction(contactId: string, interaction: Interaction): void {
    const contact = this.store.getContact(contactId);
    if (!contact) {
      log.warn({ contactId }, 'Cannot log interaction: contact not found');
      return;
    }

    // Boost relationship score based on interaction type and sentiment
    const baseBoost = SCORE_BOOSTS[interaction.type] ?? 5;
    const multiplier = SENTIMENT_MULTIPLIER[interaction.sentiment] ?? 1;
    const boost = Math.round(baseBoost * multiplier);
    const newScore = Math.min(100, contact.relationshipScore + boost);

    this.store.updateContact(contactId, {
      relationshipScore: newScore,
      lastContactDate: interaction.date,
      notes: contact.notes
        ? `${contact.notes}\n[${interaction.date.slice(0, 10)}] ${interaction.type}: ${interaction.summary}`
        : `[${interaction.date.slice(0, 10)}] ${interaction.type}: ${interaction.summary}`,
    });

    this.eventBus.emit('crm:interaction_logged', {
      contactId,
      type: interaction.type,
      summary: interaction.summary,
      timestamp: new Date().toISOString(),
    });

    log.info({ contactId, type: interaction.type, newScore }, 'Interaction logged');
  }

  /**
   * Get follow-up recommendations based on contact staleness
   */
  getFollowUpRecommendations(): FollowUpRecommendation[] {
    const recommendations: FollowUpRecommendation[] = [];
    const stats = this.store.getStats();

    // Check all categories for stale contacts
    for (const category of ['client', 'prospect', 'partner', 'personal', 'other'] as const) {
      if (!stats.byCategory[category]) continue;

      const thresholds = FOLLOW_UP_THRESHOLDS[category];

      // Get contacts stale past the "low" threshold for this category
      const staleContacts = this.store.getStaleContacts(thresholds.low)
        .filter(c => c.category === category);

      for (const contact of staleContacts) {
        const daysSince = this.daysSinceContact(contact.lastContactDate);
        let urgency: 'high' | 'medium' | 'low';
        let reason: string;
        let suggestedAction: string;

        if (daysSince >= thresholds.high * 2) {
          urgency = 'high';
          reason = `No contact in ${daysSince} days — relationship at risk`;
          suggestedAction = `Schedule a call or send a personal message to ${contact.name}`;
        } else if (daysSince >= thresholds.medium) {
          urgency = 'medium';
          reason = `${daysSince} days since last contact`;
          suggestedAction = `Send a check-in email to ${contact.name}`;
        } else {
          urgency = 'low';
          reason = `Due for routine follow-up (${daysSince} days)`;
          suggestedAction = `Drop a quick note to ${contact.name}`;
        }

        recommendations.push({
          contact,
          reason,
          urgency,
          suggestedAction,
          daysSinceContact: daysSince,
        });

        this.eventBus.emit('crm:follow_up_needed', {
          contactId: contact.id,
          name: contact.name,
          daysSinceContact: daysSince,
          urgency,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Sort by urgency (high first) then by days since contact
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.daysSinceContact - a.daysSinceContact;
    });

    return recommendations;
  }

  /**
   * Generate a weekly CRM report
   */
  generateWeeklyReport(): CRMWeeklyReport {
    const stats = this.store.getStats();
    const followUps = this.getFollowUpRecommendations();
    const followUpsNeeded = followUps.length;

    // Count new prospects (created in the last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const allProspects = this.store.searchContacts('').filter(
      c => c.category === 'prospect' && new Date(c.createdAt) > weekAgo
    );
    const newProspects = allProspects.length;

    // At-risk: high urgency follow-ups for clients and prospects
    const atRisk = followUps
      .filter(r => r.urgency === 'high' && ['client', 'prospect'].includes(r.contact.category))
      .map(r => ({ contact: r.contact, reason: r.reason }));

    // Pipeline value estimate (prospect count * avg deal size placeholder)
    const prospectCount = stats.byCategory['prospect'] ?? 0;
    const pipelineValue = prospectCount * 2500; // Placeholder: $2,500 avg

    const summaryParts: string[] = [];
    summaryParts.push(`CRM Weekly Report for Pryceless Solutions`);
    summaryParts.push(`Total contacts: ${stats.totalContacts}`);
    summaryParts.push(`Follow-ups needed: ${followUpsNeeded}`);
    summaryParts.push(`New prospects this week: ${newProspects}`);
    summaryParts.push(`Pipeline value estimate: $${pipelineValue.toLocaleString()}`);

    if (atRisk.length > 0) {
      summaryParts.push(`At-risk relationships: ${atRisk.length}`);
      for (const r of atRisk.slice(0, 3)) {
        summaryParts.push(`  - ${r.contact.name}: ${r.reason}`);
      }
    }

    summaryParts.push(`Avg relationship score: ${stats.avgRelationshipScore}`);

    return {
      followUpsNeeded,
      newProspects,
      pipelineValue,
      atRisk,
      summary: summaryParts.join('\n'),
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private daysSinceContact(lastContactDate: string): number {
    const last = new Date(lastContactDate);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
