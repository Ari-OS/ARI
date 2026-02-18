/**
 * AnalysisAgent — Specialized agent for data analysis.
 *
 * Accepts raw data and a question, uses LLM to produce
 * structured insights with confidence scoring.
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('analysis-agent');

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  answer: string;
  insights: string[];
  confidence: number;
  dataPoints: number;
}

interface AnalysisAgentConfig {
  orchestrator: AIOrchestrator;
  eventBus: EventBus;
}

// ── AnalysisAgent ────────────────────────────────────────────────────────────

export class AnalysisAgent {
  private readonly orchestrator: AIOrchestrator;
  private readonly eventBus: EventBus;

  constructor(config: AnalysisAgentConfig) {
    this.orchestrator = config.orchestrator;
    this.eventBus = config.eventBus;
  }

  /**
   * Analyze data to answer a specific question.
   */
  async analyze(data: string, question: string): Promise<AnalysisResult> {
    const requestId = randomUUID();

    log.info({ requestId, question, dataLength: data.length }, 'analysis started');
    this.eventBus.emit('agent:analysis_started', {
      question,
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = [
      'You are a data analyst. Analyze the provided data to answer the question.',
      'Return your response as JSON with these fields:',
      '- answer: string (direct answer to the question)',
      '- insights: string[] (additional insights discovered)',
      '- confidence: number (0-1, confidence in your analysis)',
      '- dataPoints: number (how many data points you identified)',
    ].join('\n');

    try {
      const response = await this.orchestrator.execute({
        content: `Question: ${question}\n\nData:\n${data}`,
        category: 'analysis',
        systemPrompt,
        agent: 'analysis_agent',
        maxTokens: 2048,
      });

      const parsed = this.parseResponse(response.content, data);

      log.info({
        requestId,
        dataPoints: parsed.dataPoints,
        confidence: parsed.confidence,
        insightCount: parsed.insights.length,
      }, 'analysis completed');

      this.eventBus.emit('agent:analysis_completed', {
        question,
        dataPoints: parsed.dataPoints,
        confidence: parsed.confidence,
        timestamp: new Date().toISOString(),
      });

      return parsed;
    } catch (err) {
      log.error({ requestId, err }, 'analysis failed');
      return {
        answer: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        insights: [],
        confidence: 0,
        dataPoints: 0,
      };
    }
  }

  /**
   * Parse LLM response into structured AnalysisResult.
   */
  private parseResponse(content: string, rawData: string): AnalysisResult {
    // Estimate data points from the raw data (lines, comma-separated values, etc.)
    const estimatedDataPoints = rawData.split('\n').filter((l) => l.trim().length > 0).length;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        return {
          answer: typeof parsed.answer === 'string' ? parsed.answer : content,
          insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          dataPoints: typeof parsed.dataPoints === 'number' ? parsed.dataPoints : estimatedDataPoints,
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      answer: content,
      insights: [],
      confidence: 0.5,
      dataPoints: estimatedDataPoints,
    };
  }
}
