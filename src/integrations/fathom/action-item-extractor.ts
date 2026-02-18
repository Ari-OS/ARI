/**
 * ACTION ITEM EXTRACTOR — Parses meeting transcripts into structured action items
 *
 * Uses LLM to analyze transcripts and extract:
 * - Who committed to what
 * - Due dates (explicit or inferred)
 * - Priority based on urgency signals
 * - Relevant context from the transcript
 *
 * Phase 20: Meeting-to-Action-Items Pipeline
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('action-item-extractor');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
}

interface OrchestratorLike {
  query(prompt: string, agent?: string): Promise<string>;
}

interface RawActionItem {
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: string;
  context?: string;
}

// ─── Extractor ──────────────────────────────────────────────────────────────

export class ActionItemExtractor {
  private readonly orchestrator: OrchestratorLike;

  constructor(orchestrator: OrchestratorLike) {
    this.orchestrator = orchestrator;
  }

  /**
   * Extract action items from a meeting transcript.
   * Returns an empty array if the transcript is empty or parsing fails.
   */
  async extract(transcript: string, participants: string[]): Promise<ActionItem[]> {
    if (!transcript || transcript.trim().length === 0) {
      return [];
    }

    const prompt = this.buildExtractionPrompt(transcript, participants);

    try {
      const response = await this.orchestrator.query(prompt, 'core');
      return this.parseResponse(response, participants);
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'LLM extraction failed',
      );
      return [];
    }
  }

  private buildExtractionPrompt(transcript: string, participants: string[]): string {
    return [
      'Extract action items from this meeting transcript.',
      '',
      `Participants: ${participants.join(', ')}`,
      '',
      '---TRANSCRIPT START---',
      transcript.slice(0, 8000), // cap to prevent token overflow
      '---TRANSCRIPT END---',
      '',
      'For each action item found, provide:',
      '- description: What needs to be done',
      '- assignee: Who is responsible (must be one of the participants, or "unassigned")',
      '- dueDate: ISO date string if mentioned, or null',
      '- priority: "high", "medium", or "low" based on urgency signals',
      '- context: A brief relevant excerpt from the transcript',
      '',
      'Respond with ONLY a valid JSON array of action items.',
      'If no action items found, respond with [].',
    ].join('\n');
  }

  private parseResponse(response: string, participants: string[]): ActionItem[] {
    try {
      // Extract JSON array from response (handle markdown fences)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        log.warn('No JSON array found in LLM response');
        return [];
      }

      const parsed: unknown = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        log.warn('Parsed response is not an array');
        return [];
      }

      return parsed
        .filter((item: unknown): item is RawActionItem =>
          typeof item === 'object' && item !== null && 'description' in item,
        )
        .map((item: RawActionItem) => this.normalizeActionItem(item, participants));
    } catch (error) {
      log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse LLM response as JSON',
      );
      return [];
    }
  }

  private normalizeActionItem(raw: RawActionItem, participants: string[]): ActionItem {
    const assignee = this.resolveAssignee(raw.assignee ?? 'unassigned', participants);
    const priority = this.normalizePriority(raw.priority);

    return {
      id: randomUUID(),
      description: String(raw.description ?? '').trim(),
      assignee,
      dueDate: typeof raw.dueDate === 'string' ? raw.dueDate : undefined,
      priority,
      context: String(raw.context ?? '').trim().slice(0, 500),
    };
  }

  private resolveAssignee(rawAssignee: string, participants: string[]): string {
    const lower = rawAssignee.toLowerCase().trim();

    // Exact match
    const exact = participants.find(p => p.toLowerCase() === lower);
    if (exact) return exact;

    // Partial match (first name, last name)
    const partial = participants.find(p =>
      p.toLowerCase().includes(lower) || lower.includes(p.toLowerCase()),
    );
    if (partial) return partial;

    return rawAssignee.trim() || 'unassigned';
  }

  private normalizePriority(raw: string | undefined): 'high' | 'medium' | 'low' {
    const lower = (raw ?? '').toLowerCase().trim();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'medium';
  }
}
