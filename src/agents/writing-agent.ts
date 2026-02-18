/**
 * WritingAgent — Specialized agent for content writing.
 *
 * Supports blog, tweet, script, and email formats.
 * Applies humanizeQuick to strip AI-speak before returning.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { humanizeQuick } from '../plugins/content-engine/humanizer.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('writing-agent');

// ── Types ────────────────────────────────────────────────────────────────────

export type WritingFormat = 'blog' | 'tweet' | 'script' | 'email';

export interface WritingResult {
  content: string;
  wordCount: number;
  format: string;
  suggestions: string[];
}

interface WritingAgentConfig {
  orchestrator: AIOrchestrator;
  eventBus: EventBus;
}

// ── Format prompts ───────────────────────────────────────────────────────────

const FORMAT_PROMPTS: Record<WritingFormat, string> = {
  blog: 'Write a blog post. Use clear headings, conversational tone, and actionable takeaways.',
  tweet: 'Write a tweet (max 280 chars). Be punchy, direct, no hashtag spam.',
  script: 'Write a video script. Include hook, body, and call-to-action. Conversational delivery.',
  email: 'Write a professional email. Clear subject line suggestion, concise body, specific ask.',
};

// ── WritingAgent ─────────────────────────────────────────────────────────────

export class WritingAgent {
  private readonly orchestrator: AIOrchestrator;
  private readonly eventBus: EventBus;

  constructor(config: WritingAgentConfig) {
    this.orchestrator = config.orchestrator;
    this.eventBus = config.eventBus;
  }

  /**
   * Draft content in the specified format.
   */
  async draft(
    topic: string,
    format: WritingFormat,
    context?: string,
  ): Promise<WritingResult> {
    const requestId = randomUUID();

    log.info({ requestId, topic, format }, 'writing started');
    this.eventBus.emit('agent:writing_started', {
      topic,
      format,
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = [
      'You are a skilled content writer. Write in a direct, human voice.',
      FORMAT_PROMPTS[format],
      'Also provide 2-3 improvement suggestions as a JSON array under "suggestions".',
      'Return your response as JSON with fields: content (string), suggestions (string[]).',
      context ? `Additional context: ${context}` : '',
    ].filter(Boolean).join('\n');

    try {
      const response = await this.orchestrator.execute({
        content: `Write about: ${topic}`,
        category: 'creative',
        systemPrompt,
        agent: 'writing_agent',
        maxTokens: 2048,
      });

      const parsed = this.parseResponse(response.content, format);

      // Humanize output to strip AI-speak
      parsed.content = humanizeQuick(parsed.content);
      parsed.wordCount = parsed.content.split(/\s+/).filter(Boolean).length;

      log.info({
        requestId,
        format,
        wordCount: parsed.wordCount,
      }, 'writing completed');

      this.eventBus.emit('agent:writing_completed', {
        topic,
        format,
        wordCount: parsed.wordCount,
        timestamp: new Date().toISOString(),
      });

      return parsed;
    } catch (err) {
      log.error({ requestId, err }, 'writing failed');
      return {
        content: `Writing failed: ${err instanceof Error ? err.message : String(err)}`,
        wordCount: 0,
        format,
        suggestions: [],
      };
    }
  }

  /**
   * Parse LLM response into structured WritingResult.
   */
  private parseResponse(content: string, format: string): WritingResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const text = typeof parsed.content === 'string' ? parsed.content : content;
        return {
          content: text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          format,
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      content,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      format,
      suggestions: [],
    };
  }
}
