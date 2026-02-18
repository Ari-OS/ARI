/**
 * ARI Earnings Analyzer — RAG-Powered Earnings Report Analysis
 *
 * Analyzes quarterly earnings reports using AIOrchestrator for
 * structured insight extraction. Supports cross-quarter comparisons
 * and key metric tracking.
 *
 * Features:
 *   - Structured earnings insight extraction via LLM
 *   - Quarter-over-quarter comparison
 *   - Key metric tracking (revenue, EPS, guidance)
 *   - Earnings summary history per ticker
 *
 * Layer: L5 (Autonomous Operations)
 */

import { randomUUID } from 'node:crypto';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('earnings-analyzer');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EarningsInsight {
  id: string;
  ticker: string;
  quarter: string;
  revenue: number | null;
  revenueGrowthYoY: number | null;
  eps: number | null;
  epsEstimate: number | null;
  epsSurprise: number | null;
  guidanceRevenue: string | null;
  guidanceEps: string | null;
  keyHighlights: string[];
  risks: string[];
  sentiment: 'bullish' | 'neutral' | 'bearish';
  sentimentScore: number; // -1.0 to 1.0
  summary: string;
  analyzedAt: string;
}

export interface QuarterComparison {
  ticker: string;
  q1: EarningsInsight;
  q2: EarningsInsight;
  revenueChange: number | null;
  epsChange: number | null;
  sentimentShift: number;
  keyDifferences: string[];
  trend: 'improving' | 'stable' | 'declining';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a financial analyst for Pryceless Solutions.
Analyze the following earnings report and return a structured JSON object.

Return ONLY valid JSON:
{
  "quarter": "Q1 2026",
  "revenue": 12500000000,
  "revenueGrowthYoY": 15.2,
  "eps": 2.45,
  "epsEstimate": 2.30,
  "epsSurprise": 6.5,
  "guidanceRevenue": "$12.8B-$13.2B",
  "guidanceEps": "$2.50-$2.60",
  "keyHighlights": ["Strong cloud growth", "New product launch"],
  "risks": ["Supply chain headwinds", "Currency exposure"],
  "sentiment": "bullish",
  "sentimentScore": 0.7,
  "summary": "1-2 sentence summary of the earnings"
}

Use null for any data points not found in the report.

Ticker: $TICKER
Report:
`;

const COMPARISON_PROMPT = `You are a financial analyst for Pryceless Solutions.
Compare these two quarterly earnings reports and identify key differences.

Return ONLY valid JSON:
{
  "keyDifferences": ["Revenue grew 15% QoQ", "Margins expanded by 200bps", ...],
  "trend": "improving" | "stable" | "declining"
}

Q1 Summary: $Q1_SUMMARY
Q2 Summary: $Q2_SUMMARY
`;

// ─── EarningsAnalyzer ───────────────────────────────────────────────────────

export class EarningsAnalyzer {
  private readonly orchestrator: AIOrchestrator;
  private insights: Map<string, EarningsInsight[]> = new Map(); // ticker -> insights

  constructor(orchestrator: AIOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Analyze an earnings report and extract structured insights
   */
  async analyzeReport(ticker: string, reportText: string): Promise<EarningsInsight> {
    const id = randomUUID();
    const normalizedTicker = ticker.toUpperCase();

    const prompt = ANALYSIS_PROMPT
      .replace('$TICKER', normalizedTicker) + reportText.slice(0, 8000);

    let insight: EarningsInsight = this.buildDefaultInsight(id, normalizedTicker);

    try {
      const response = await this.orchestrator.query(prompt, 'core');
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        insight = this.parseInsight(id, normalizedTicker, parsed);
      }
    } catch (error) {
      log.warn({ error, ticker: normalizedTicker }, 'LLM earnings analysis failed, using defaults');
    }

    // Store the insight
    const existing = this.insights.get(normalizedTicker) ?? [];
    existing.push(insight);
    this.insights.set(normalizedTicker, existing);

    log.info(
      { ticker: normalizedTicker, quarter: insight.quarter, sentiment: insight.sentiment },
      'Earnings report analyzed',
    );

    return insight;
  }

  /**
   * Compare two quarters for a given ticker
   */
  async compareQuarters(
    ticker: string,
    q1: EarningsInsight,
    q2: EarningsInsight,
  ): Promise<QuarterComparison> {
    const normalizedTicker = ticker.toUpperCase();

    const revenueChange = (q1.revenue !== null && q2.revenue !== null)
      ? ((q2.revenue - q1.revenue) / q1.revenue) * 100
      : null;

    const epsChange = (q1.eps !== null && q2.eps !== null)
      ? ((q2.eps - q1.eps) / Math.abs(q1.eps)) * 100
      : null;

    const sentimentShift = q2.sentimentScore - q1.sentimentScore;

    let keyDifferences: string[] = [];
    let trend: 'improving' | 'stable' | 'declining' = 'stable';

    // Use LLM for comparison insights
    try {
      const prompt = COMPARISON_PROMPT
        .replace('$Q1_SUMMARY', q1.summary)
        .replace('$Q2_SUMMARY', q2.summary);

      const response = await this.orchestrator.query(prompt, 'core');
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (Array.isArray(parsed.keyDifferences)) {
          keyDifferences = parsed.keyDifferences.map(String);
        }
        if (typeof parsed.trend === 'string') {
          trend = parsed.trend as 'improving' | 'stable' | 'declining';
        }
      }
    } catch (error) {
      log.warn({ error, ticker: normalizedTicker }, 'LLM comparison failed, using computed values');

      // Fallback: compute trend from numbers
      if (revenueChange !== null) {
        if (revenueChange > 5) trend = 'improving';
        else if (revenueChange < -5) trend = 'declining';
      }

      keyDifferences = [];
      if (revenueChange !== null) {
        keyDifferences.push(`Revenue ${revenueChange >= 0 ? 'grew' : 'declined'} ${Math.abs(revenueChange).toFixed(1)}% QoQ`);
      }
      if (epsChange !== null) {
        keyDifferences.push(`EPS ${epsChange >= 0 ? 'increased' : 'decreased'} ${Math.abs(epsChange).toFixed(1)}% QoQ`);
      }
    }

    const comparison: QuarterComparison = {
      ticker: normalizedTicker,
      q1,
      q2,
      revenueChange: revenueChange !== null ? Math.round(revenueChange * 100) / 100 : null,
      epsChange: epsChange !== null ? Math.round(epsChange * 100) / 100 : null,
      sentimentShift: Math.round(sentimentShift * 100) / 100,
      keyDifferences,
      trend,
    };

    log.info(
      { ticker: normalizedTicker, trend, sentimentShift },
      'Quarter comparison complete',
    );

    return comparison;
  }

  /**
   * Get all earnings insights for a ticker
   */
  getEarningsSummary(ticker: string): EarningsInsight[] {
    const normalizedTicker = ticker.toUpperCase();
    return this.insights.get(normalizedTicker) ?? [];
  }

  /**
   * Get the most recent insight for a ticker
   */
  getLatestInsight(ticker: string): EarningsInsight | null {
    const insights = this.getEarningsSummary(ticker);
    return insights.length > 0 ? insights[insights.length - 1] : null;
  }

  /**
   * List all tickers that have been analyzed
   */
  listTickers(): string[] {
    return Array.from(this.insights.keys());
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private buildDefaultInsight(id: string, ticker: string): EarningsInsight {
    return {
      id,
      ticker,
      quarter: 'Unknown',
      revenue: null,
      revenueGrowthYoY: null,
      eps: null,
      epsEstimate: null,
      epsSurprise: null,
      guidanceRevenue: null,
      guidanceEps: null,
      keyHighlights: [],
      risks: [],
      sentiment: 'neutral',
      sentimentScore: 0,
      summary: 'Analysis pending',
      analyzedAt: new Date().toISOString(),
    };
  }

  private parseInsight(
    id: string,
    ticker: string,
    parsed: Record<string, unknown>,
  ): EarningsInsight {
    return {
      id,
      ticker,
      quarter: typeof parsed.quarter === 'string' ? parsed.quarter : 'Unknown',
      revenue: typeof parsed.revenue === 'number' ? parsed.revenue : null,
      revenueGrowthYoY: typeof parsed.revenueGrowthYoY === 'number' ? parsed.revenueGrowthYoY : null,
      eps: typeof parsed.eps === 'number' ? parsed.eps : null,
      epsEstimate: typeof parsed.epsEstimate === 'number' ? parsed.epsEstimate : null,
      epsSurprise: typeof parsed.epsSurprise === 'number' ? parsed.epsSurprise : null,
      guidanceRevenue: typeof parsed.guidanceRevenue === 'string' ? parsed.guidanceRevenue : null,
      guidanceEps: typeof parsed.guidanceEps === 'string' ? parsed.guidanceEps : null,
      keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights.map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      sentiment: this.parseSentiment(parsed.sentiment),
      sentimentScore: typeof parsed.sentimentScore === 'number'
        ? Math.max(-1, Math.min(1, parsed.sentimentScore))
        : 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis complete',
      analyzedAt: new Date().toISOString(),
    };
  }

  private parseSentiment(value: unknown): 'bullish' | 'neutral' | 'bearish' {
    if (typeof value === 'string') {
      if (value === 'bullish' || value === 'neutral' || value === 'bearish') {
        return value;
      }
    }
    return 'neutral';
  }
}
