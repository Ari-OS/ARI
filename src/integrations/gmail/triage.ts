/**
 * Email Triage — Intelligent Email Classification
 *
 * Uses LLM to classify emails into actionable categories with priority
 * scoring and suggested actions. Integrates with the AI orchestrator
 * for classification and with EventBus for notification flow.
 *
 * Categories:
 *   - client_inquiry: Direct client communication
 *   - opportunity: Business opportunities, leads
 *   - action_required: Needs a response or action
 *   - fyi: Informational, no action needed
 *   - spam: Unwanted messages
 *   - newsletter: Subscriptions, digests
 *
 * Usage:
 *   const triage = new EmailTriage({ orchestrator, eventBus });
 *   const result = await triage.classify(email);
 *   const batch = await triage.triageBatch(emails);
 *   const summary = triage.getSummary(batch);
 */

import { createLogger } from '../../kernel/logger.js';
import type { EventBus } from '../../kernel/event-bus.js';

const log = createLogger('email-triage');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  hasAttachments: boolean;
}

export type EmailCategory =
  | 'client_inquiry'
  | 'opportunity'
  | 'action_required'
  | 'fyi'
  | 'spam'
  | 'newsletter';

export interface EmailClassification {
  emailId: string;
  category: EmailCategory;
  confidence: number;
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
  summary: string;
}

export interface TriageSummary {
  total: number;
  byCategory: Record<EmailCategory, number>;
  actionRequired: EmailClassification[];
  highlights: string[];
}

interface Orchestrator {
  query(prompt: string, agent?: string): Promise<string>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are an email classifier for Pryceless Solutions.
Classify each email into exactly one category and provide a JSON response.

Categories:
- client_inquiry: Direct communication from existing or potential clients
- opportunity: Business opportunities, partnership proposals, leads
- action_required: Requires a response or specific action (invoices, deadlines, requests)
- fyi: Informational only, no action needed
- spam: Unwanted, unsolicited, or phishing
- newsletter: Subscription content, digests, marketing from known senders

Priority rules:
- high: Client inquiries, time-sensitive action items, opportunities > $1K
- medium: General action items, moderate opportunities
- low: FYI, newsletters, non-urgent

Respond ONLY with valid JSON matching this schema:
{
  "category": "client_inquiry" | "opportunity" | "action_required" | "fyi" | "spam" | "newsletter",
  "confidence": 0.0 to 1.0,
  "suggestedAction": "Brief action recommendation",
  "priority": "high" | "medium" | "low",
  "summary": "One sentence summary"
}`;

const ALL_CATEGORIES: EmailCategory[] = [
  'client_inquiry',
  'opportunity',
  'action_required',
  'fyi',
  'spam',
  'newsletter',
];

const DEFAULT_CLASSIFICATION: Omit<EmailClassification, 'emailId'> = {
  category: 'fyi',
  confidence: 0.5,
  suggestedAction: 'Review manually',
  priority: 'low',
  summary: 'Could not classify automatically',
};

// ─── EmailTriage ────────────────────────────────────────────────────────────

export class EmailTriage {
  private orchestrator: Orchestrator;
  private eventBus: EventBus;

  constructor(params: {
    orchestrator: Orchestrator;
    eventBus: EventBus;
  }) {
    this.orchestrator = params.orchestrator;
    this.eventBus = params.eventBus;
  }

  /**
   * Classify a single email using the LLM
   */
  async classify(email: EmailMessage): Promise<EmailClassification> {
    const prompt = `${CLASSIFICATION_SYSTEM_PROMPT}

Email:
From: ${email.from}
Subject: ${email.subject}
Has Attachments: ${email.hasAttachments ? 'Yes' : 'No'}
Received: ${email.receivedAt}

Body (first 500 chars):
${email.body.slice(0, 500)}`;

    try {
      const response = await this.orchestrator.query(prompt, 'email-triage');
      const classification = this.parseClassification(response, email.id);

      this.eventBus.emit('email:triaged', {
        emailId: email.id,
        category: classification.category,
        priority: classification.priority,
        timestamp: new Date().toISOString(),
      });

      if (classification.priority === 'high' || classification.category === 'action_required') {
        this.eventBus.emit('email:action_required', {
          emailId: email.id,
          subject: email.subject,
          suggestedAction: classification.suggestedAction,
          timestamp: new Date().toISOString(),
        });
      }

      log.info({
        emailId: email.id,
        category: classification.category,
        priority: classification.priority,
        confidence: classification.confidence,
      }, 'Email classified');

      return classification;
    } catch (error) {
      log.error({ emailId: email.id, error }, 'Failed to classify email');
      return {
        emailId: email.id,
        ...DEFAULT_CLASSIFICATION,
      };
    }
  }

  /**
   * Triage a batch of emails
   */
  async triageBatch(emails: EmailMessage[]): Promise<EmailClassification[]> {
    log.info({ count: emails.length }, 'Starting batch triage');

    const results: EmailClassification[] = [];
    for (const email of emails) {
      const classification = await this.classify(email);
      results.push(classification);
    }

    log.info({
      total: results.length,
      highPriority: results.filter(r => r.priority === 'high').length,
      actionRequired: results.filter(r => r.category === 'action_required').length,
    }, 'Batch triage complete');

    return results;
  }

  /**
   * Generate a triage summary from classifications
   */
  getSummary(classifications: EmailClassification[]): TriageSummary {
    const byCategory: Record<EmailCategory, number> = {
      client_inquiry: 0,
      opportunity: 0,
      action_required: 0,
      fyi: 0,
      spam: 0,
      newsletter: 0,
    };

    for (const c of classifications) {
      if (ALL_CATEGORIES.includes(c.category)) {
        byCategory[c.category]++;
      }
    }

    const actionRequired = classifications.filter(
      c => c.category === 'action_required' || c.priority === 'high'
    );

    const highlights: string[] = [];

    if (byCategory.client_inquiry > 0) {
      highlights.push(`${byCategory.client_inquiry} client inquiry(ies) need attention`);
    }
    if (byCategory.opportunity > 0) {
      highlights.push(`${byCategory.opportunity} new opportunity(ies) detected`);
    }
    if (actionRequired.length > 0) {
      highlights.push(`${actionRequired.length} item(s) require action`);
    }
    if (byCategory.spam > 0) {
      highlights.push(`${byCategory.spam} spam message(s) filtered`);
    }

    return {
      total: classifications.length,
      byCategory,
      actionRequired,
      highlights,
    };
  }

  /**
   * Parse LLM response into a typed classification
   */
  private parseClassification(response: string, emailId: string): EmailClassification {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        log.warn({ emailId, response: response.slice(0, 200) }, 'No JSON found in LLM response');
        return { emailId, ...DEFAULT_CLASSIFICATION };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const category = ALL_CATEGORIES.includes(parsed.category as EmailCategory)
        ? (parsed.category as EmailCategory)
        : DEFAULT_CLASSIFICATION.category;

      const priority = ['high', 'medium', 'low'].includes(parsed.priority as string)
        ? (parsed.priority as 'high' | 'medium' | 'low')
        : DEFAULT_CLASSIFICATION.priority;

      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : DEFAULT_CLASSIFICATION.confidence;

      return {
        emailId,
        category,
        confidence,
        suggestedAction: typeof parsed.suggestedAction === 'string'
          ? parsed.suggestedAction
          : DEFAULT_CLASSIFICATION.suggestedAction,
        priority,
        summary: typeof parsed.summary === 'string'
          ? parsed.summary
          : DEFAULT_CLASSIFICATION.summary,
      };
    } catch (error) {
      log.warn({ emailId, error }, 'Failed to parse classification response');
      return { emailId, ...DEFAULT_CLASSIFICATION };
    }
  }
}
