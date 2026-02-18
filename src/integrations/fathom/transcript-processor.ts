/**
 * TRANSCRIPT PROCESSOR — Processes Fathom meeting transcripts via Claude
 *
 * Extracts summaries, key decisions, action items, follow-up topics, and
 * sentiment from raw meeting transcripts. Uses Claude haiku-4-5 when an
 * API key is provided; falls back to rule-based extraction otherwise.
 *
 * Phase 20: Meeting-to-Action-Items Pipeline
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('transcript-processor');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MeetingTranscript {
  meetingId: string;
  title: string;
  date: string;
  durationMinutes: number;
  participants: string[];
  rawTranscript: string;
  segments?: Array<{ speaker: string; text: string; timestamp: string }>;
}

export interface ProcessedTranscript {
  meetingId: string;
  title: string;
  date: string;
  summary: string;
  keyDecisions: string[];
  actionItems: Array<{
    description: string;
    owner?: string;
    dueDate?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  followUpTopics: string[];
  sentiment: 'positive' | 'neutral' | 'mixed' | 'negative';
  processedAt: string;
}

interface ClaudeResponse {
  summary?: string;
  keyDecisions?: unknown[];
  actionItems?: unknown[];
  followUpTopics?: unknown[];
  sentiment?: string;
}

interface RawActionItem {
  description?: unknown;
  owner?: unknown;
  dueDate?: unknown;
  priority?: unknown;
}

// ─── Processor ──────────────────────────────────────────────────────────────

export class TranscriptProcessor {
  private readonly eventBus: EventBus;
  private readonly client: Anthropic | null;

  constructor(params: { eventBus: EventBus; anthropicApiKey?: string }) {
    this.eventBus = params.eventBus;
    this.client = params.anthropicApiKey
      ? new Anthropic({ apiKey: params.anthropicApiKey })
      : null;
  }

  /**
   * Process a meeting transcript into structured data.
   * Uses Claude when available, falls back to rule-based extraction.
   */
  async process(transcript: MeetingTranscript): Promise<ProcessedTranscript> {
    log.info(
      { meetingId: transcript.meetingId, title: transcript.title },
      'Processing transcript',
    );

    const processedAt = new Date().toISOString();
    let result: ProcessedTranscript;

    if (this.client) {
      result = await this.processWithClaude(transcript, processedAt);
    } else {
      result = this.processWithRules(transcript, processedAt);
    }

    this.eventBus.emit('audit:log', {
      action: 'transcript:processed',
      agent: 'transcript-processor',
      trustLevel: 'system',
      details: {
        meetingId: transcript.meetingId,
        title: transcript.title,
        actionItemCount: result.actionItems.length,
        keyDecisionCount: result.keyDecisions.length,
        sentiment: result.sentiment,
        usedLlm: this.client !== null,
      },
    });

    log.info(
      {
        meetingId: transcript.meetingId,
        actionItems: result.actionItems.length,
        keyDecisions: result.keyDecisions.length,
      },
      'Transcript processing complete',
    );

    return result;
  }

  /**
   * Rule-based extraction of action items from phrases commonly used in meetings.
   */
  extractActionItems(
    text: string,
  ): ProcessedTranscript['actionItems'] {
    const items: ProcessedTranscript['actionItems'] = [];
    const lines = text.split(/[\n.!?]+/).map((l) => l.trim()).filter(Boolean);

    const actionPatterns = [
      /action item[:\s]+(.+)/i,
      /todo[:\s]+(.+)/i,
      /\bwill\s+(do|handle|take care of|follow up|send|create|update|review|fix|write|build|check)\b.{0,80}/i,
      /\bi'?ll\s+\w.{0,80}/i,
      /@\w+\s+(?:please\s+)?.{5,80}/i,
      /\bneeds? to\s+\w.{0,80}/i,
      /\bshouldn?'?t?\s+forget\s+to\b.{0,80}/i,
    ];

    for (const line of lines) {
      for (const pattern of actionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const description = (match[1] ?? match[0]).trim().slice(0, 200);
          if (description.length > 5) {
            const priority = this.inferPriority(line);
            items.push({ description, priority });
          }
          break;
        }
      }
    }

    // Deduplicate by description prefix
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.description.slice(0, 40).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Simple keyword-based sentiment detection.
   */
  getSentiment(text: string): ProcessedTranscript['sentiment'] {
    const lower = text.toLowerCase();

    const positiveWords = [
      'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'good',
      'progress', 'success', 'achieved', 'completed', 'approved', 'agree',
      'excited', 'happy', 'thrilled', 'love', 'perfect', 'brilliant',
    ];
    const negativeWords = [
      'problem', 'issue', 'concern', 'blocked', 'failed', 'error',
      'disappointed', 'frustrat', 'behind', 'delayed', 'miss', 'bad',
      'wrong', 'broken', 'terrible', 'horrible', 'awful', 'reject',
    ];

    let posScore = 0;
    let negScore = 0;

    for (const word of positiveWords) {
      const matches = lower.match(new RegExp(word, 'g'));
      posScore += matches ? matches.length : 0;
    }
    for (const word of negativeWords) {
      const matches = lower.match(new RegExp(word, 'g'));
      negScore += matches ? matches.length : 0;
    }

    if (posScore === 0 && negScore === 0) return 'neutral';
    if (posScore > 0 && negScore > 0) return 'mixed';
    if (posScore > negScore) return 'positive';
    return 'negative';
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async processWithClaude(
    transcript: MeetingTranscript,
    processedAt: string,
  ): Promise<ProcessedTranscript> {
    const prompt = this.buildClaudePrompt(transcript);

    const message = await this.client!.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText =
      message.content[0]?.type === 'text' ? message.content[0].text : '';

    const parsed = this.parseClaudeResponse(responseText, transcript);

    return {
      meetingId: transcript.meetingId,
      title: transcript.title,
      date: transcript.date,
      summary: parsed.summary ?? this.buildFallbackSummary(transcript),
      keyDecisions: parsed.keyDecisions,
      actionItems: parsed.actionItems,
      followUpTopics: parsed.followUpTopics,
      sentiment: parsed.sentiment,
      processedAt,
    };
  }

  private processWithRules(
    transcript: MeetingTranscript,
    processedAt: string,
  ): ProcessedTranscript {
    const text = transcript.rawTranscript;
    return {
      meetingId: transcript.meetingId,
      title: transcript.title,
      date: transcript.date,
      summary: this.buildFallbackSummary(transcript),
      keyDecisions: [],
      actionItems: this.extractActionItems(text),
      followUpTopics: [],
      sentiment: this.getSentiment(text),
      processedAt,
    };
  }

  private buildClaudePrompt(transcript: MeetingTranscript): string {
    const cap = transcript.rawTranscript.slice(0, 8000);
    return [
      `Meeting: "${transcript.title}"`,
      `Date: ${transcript.date}`,
      `Duration: ${transcript.durationMinutes} minutes`,
      `Participants: ${transcript.participants.join(', ')}`,
      '',
      '---TRANSCRIPT---',
      cap,
      '---END---',
      '',
      'Analyze the transcript and respond with ONLY valid JSON in this exact shape:',
      '{',
      '  "summary": "<3-5 sentence summary>",',
      '  "keyDecisions": ["<decision 1>", "..."],',
      '  "actionItems": [',
      '    { "description": "...", "owner": "<name or null>", "dueDate": "<ISO date or null>", "priority": "high|medium|low" }',
      '  ],',
      '  "followUpTopics": ["<topic 1>", "..."],',
      '  "sentiment": "positive|neutral|mixed|negative"',
      '}',
    ].join('\n');
  }

  private parseClaudeResponse(
    response: string,
    transcript: MeetingTranscript,
  ): {
    summary: string;
    keyDecisions: string[];
    actionItems: ProcessedTranscript['actionItems'];
    followUpTopics: string[];
    sentiment: ProcessedTranscript['sentiment'];
  } {
    const fallback = {
      summary: this.buildFallbackSummary(transcript),
      keyDecisions: [] as string[],
      actionItems: [] as ProcessedTranscript['actionItems'],
      followUpTopics: [] as string[],
      sentiment: this.getSentiment(transcript.rawTranscript),
    };

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;

      const raw = JSON.parse(jsonMatch[0]) as ClaudeResponse;

      return {
        summary: typeof raw.summary === 'string' ? raw.summary : fallback.summary,
        keyDecisions: this.toStringArray(raw.keyDecisions),
        actionItems: this.normalizeActionItems(raw.actionItems),
        followUpTopics: this.toStringArray(raw.followUpTopics),
        sentiment: this.normalizeSentiment(raw.sentiment),
      };
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse Claude response, using fallback',
      );
      return fallback;
    }
  }

  private normalizeActionItems(raw: unknown): ProcessedTranscript['actionItems'] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((item: unknown): item is RawActionItem =>
        typeof item === 'object' && item !== null,
      )
      .map((item: RawActionItem) => ({
        description: (typeof item.description === 'string' ? item.description : '').trim(),
        owner: typeof item.owner === 'string' && item.owner ? item.owner : undefined,
        dueDate: typeof item.dueDate === 'string' && item.dueDate ? item.dueDate : undefined,
        priority: this.normalizePriority(
          typeof item.priority === 'string' ? item.priority : undefined,
        ),
      }))
      .filter((item) => item.description.length > 0);
  }

  private toStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private normalizeSentiment(raw: unknown): ProcessedTranscript['sentiment'] {
    const valid = ['positive', 'neutral', 'mixed', 'negative'] as const;
    if (typeof raw === 'string' && valid.includes(raw as ProcessedTranscript['sentiment'])) {
      return raw as ProcessedTranscript['sentiment'];
    }
    return 'neutral';
  }

  private normalizePriority(raw: string | undefined): 'high' | 'medium' | 'low' {
    const lower = (raw ?? '').toLowerCase().trim();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'medium';
  }

  private inferPriority(line: string): 'high' | 'medium' | 'low' {
    const lower = line.toLowerCase();
    if (/urgent|asap|critical|immediately|today|right away/.test(lower)) return 'high';
    if (/low priority|eventually|whenever|if time/.test(lower)) return 'low';
    return 'medium';
  }

  private buildFallbackSummary(transcript: MeetingTranscript): string {
    return transcript.rawTranscript.trim().slice(0, 500);
  }
}
