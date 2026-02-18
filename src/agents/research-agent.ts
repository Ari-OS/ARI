/**
 * ResearchAgent — Specialized agent for research tasks.
 *
 * Uses AIOrchestrator for LLM calls to gather findings,
 * synthesize sources, and produce confidence-scored results.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('research-agent');

// ── Types ────────────────────────────────────────────────────────────────────

export interface ResearchResult {
  findings: string[];
  sources: string[];
  confidence: number;
  summary: string;
}

interface ResearchAgentConfig {
  orchestrator: AIOrchestrator;
  eventBus: EventBus;
}

// ── ResearchAgent ────────────────────────────────────────────────────────────

export class ResearchAgent {
  private readonly orchestrator: AIOrchestrator;
  private readonly eventBus: EventBus;

  constructor(config: ResearchAgentConfig) {
    this.orchestrator = config.orchestrator;
    this.eventBus = config.eventBus;
  }

  /**
   * Research a query using LLM with optional source constraints.
   */
  async research(query: string, sources?: string[]): Promise<ResearchResult> {
    const requestId = randomUUID();
    const effectiveSources = sources ?? [];

    log.info({ requestId, query, sourceCount: effectiveSources.length }, 'research started');
    this.eventBus.emit('agent:research_started', {
      query,
      sources: effectiveSources,
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = [
      'You are a research assistant. Analyze the query and provide structured findings.',
      'Return your response as JSON with these fields:',
      '- findings: string[] (key findings, each a concise statement)',
      '- sources: string[] (relevant sources or references)',
      '- confidence: number (0-1, how confident you are in the findings)',
      '- summary: string (2-3 sentence summary)',
      effectiveSources.length > 0
        ? `Focus on these sources: ${effectiveSources.join(', ')}`
        : '',
    ].filter(Boolean).join('\n');

    try {
      const response = await this.orchestrator.execute({
        content: query,
        category: 'research',
        systemPrompt,
        agent: 'research_agent',
        maxTokens: 2048,
      });

      const parsed = this.parseResponse(response.content);

      log.info({
        requestId,
        findingsCount: parsed.findings.length,
        confidence: parsed.confidence,
      }, 'research completed');

      this.eventBus.emit('agent:research_completed', {
        query,
        findingsCount: parsed.findings.length,
        confidence: parsed.confidence,
        timestamp: new Date().toISOString(),
      });

      return parsed;
    } catch (err) {
      log.error({ requestId, err }, 'research failed');
      return {
        findings: [],
        sources: effectiveSources,
        confidence: 0,
        summary: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Parse LLM response into structured ResearchResult.
   * Falls back to treating the entire response as a single finding.
   */
  private parseResponse(content: string): ResearchResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        return {
          findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : [content],
          sources: Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          summary: typeof parsed.summary === 'string' ? parsed.summary : content.slice(0, 200),
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      findings: [content],
      sources: [],
      confidence: 0.5,
      summary: content.slice(0, 200),
    };
  }
}
