 
/**
 * ARI Cognitive Layer 0: Cross-Pillar Synthesis
 *
 * This module synthesizes results from LOGOS, ETHOS, and PATHOS to provide
 * unified cognitive recommendations. It runs all three pillars in parallel,
 * combines their outputs with weighted confidence, and detects conflicts
 * that require human review.
 *
 * @module cognition/synthesis
 * @version 1.0.0
 */

import type { EventBus } from '../kernel/event-bus.js';
import { calculateExpectedValue } from './logos/index.js';
import { detectCognitiveBias } from './ethos/index.js';
import { checkVirtueAlignment } from './pathos/index.js';
import type { Decision } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result from a single cognitive pillar
 */
export interface PillarResult {
  pillar: 'LOGOS' | 'ETHOS' | 'PATHOS';
  recommendation: string;
  confidence: number;
  reasoning: string;
}

/**
 * Synthesized result from all three pillars
 */
export interface SynthesisResult {
  consensus: boolean;
  recommendation: string;
  confidence: number;
  pillarResults: PillarResult[];
  conflicts: string[];
  flagForHumanReview: boolean;
}

// =============================================================================
// SYNTHESIS ENGINE
// =============================================================================

/**
 * Synthesize cognitive results from all three pillars
 *
 * Runs LOGOS (reason), ETHOS (character), and PATHOS (growth) analyses in parallel,
 * then combines their outputs with weighted confidence scoring. Conflicts between
 * pillars (confidence gap > 0.3) trigger human review flag.
 *
 * @param decision - The decision to analyze
 * @param eventBus - Optional EventBus for audit logging
 * @returns Synthesized cognitive recommendation
 *
 * @example
 * ```typescript
 * const result = await synthesize({
 *   description: 'Launch new product',
 *   context: { marketData: {...} }
 * }, eventBus);
 *
 * if (result.flagForHumanReview) {
 *   console.log('Conflicts detected:', result.conflicts);
 * }
 * console.log('Recommendation:', result.recommendation);
 * ```
 */
export async function synthesize(
  decision: { description: string; context: Record<string, unknown> },
  eventBus?: EventBus,
): Promise<SynthesisResult> {
  const startTime = Date.now();

  // Run all three pillar analyses in parallel using Promise.allSettled
  const [logosResult, ethosResult, pathosResult] = await Promise.allSettled([
    analyzeWithLogos(decision),
    analyzeWithEthos(decision),
    analyzeWithPathos(decision),
  ]);

  // Extract pillar results, handling failures gracefully
  const pillarResults: PillarResult[] = [];
  const errors: string[] = [];

  // Process LOGOS result
  if (logosResult.status === 'fulfilled') {
    pillarResults.push(logosResult.value);
  } else {
    errors.push(`LOGOS analysis failed: ${logosResult.reason}`);
    // Provide fallback result
    pillarResults.push({
      pillar: 'LOGOS',
      recommendation: 'PROCEED',
      confidence: 0.5,
      reasoning: 'LOGOS analysis unavailable',
    });
  }

  // Process ETHOS result
  if (ethosResult.status === 'fulfilled') {
    pillarResults.push(ethosResult.value);
  } else {
    errors.push(`ETHOS analysis failed: ${ethosResult.reason}`);
    pillarResults.push({
      pillar: 'ETHOS',
      recommendation: 'PROCEED',
      confidence: 0.5,
      reasoning: 'ETHOS analysis unavailable',
    });
  }

  // Process PATHOS result
  if (pathosResult.status === 'fulfilled') {
    pillarResults.push(pathosResult.value);
  } else {
    errors.push(`PATHOS analysis failed: ${pathosResult.reason}`);
    pillarResults.push({
      pillar: 'PATHOS',
      recommendation: 'PROCEED',
      confidence: 0.5,
      reasoning: 'PATHOS analysis unavailable',
    });
  }

  // Combine outputs with weighted confidence (LOGOS 0.4, ETHOS 0.3, PATHOS 0.3)
  const weights = { LOGOS: 0.4, ETHOS: 0.3, PATHOS: 0.3 };
  const weightedConfidence = pillarResults.reduce((sum, result) => {
    return sum + result.confidence * weights[result.pillar];
  }, 0);

  // Detect conflicts: If any pillar disagrees (confidence gap > 0.3), flag for human review
  const confidences = pillarResults.map((r) => r.confidence);
  const maxConfidence = Math.max(...confidences);
  const minConfidence = Math.min(...confidences);
  const confidenceGap = maxConfidence - minConfidence;

  const conflicts: string[] = [];
  if (confidenceGap > 0.3) {
    // Find which pillars disagree
    const highConfidencePillars = pillarResults.filter((r) => r.confidence > 0.7);
    const lowConfidencePillars = pillarResults.filter((r) => r.confidence < 0.4);

    if (highConfidencePillars.length > 0 && lowConfidencePillars.length > 0) {
      conflicts.push(
        `Conflict: ${highConfidencePillars.map((r) => r.pillar).join(', ')} confident (${maxConfidence.toFixed(2)}), ` +
        `but ${lowConfidencePillars.map((r) => r.pillar).join(', ')} uncertain (${minConfidence.toFixed(2)})`
      );
    }
  }

  // Add error conflicts if any pillar failed
  conflicts.push(...errors);

  // Determine consensus
  const consensus = confidenceGap <= 0.3 && errors.length === 0;

  // Generate unified recommendation
  const recommendation = generateUnifiedRecommendation(pillarResults, consensus);

  // Flag for human review if conflicts detected
  const flagForHumanReview = conflicts.length > 0;

  const result: SynthesisResult = {
    consensus,
    recommendation,
    confidence: weightedConfidence,
    pillarResults,
    conflicts,
    flagForHumanReview,
  };

  // Emit synthesis event
  if (eventBus) {
    const duration = Date.now() - startTime;
    eventBus.emit('audit:log', {
      action: 'cognition:synthesis_complete',
      agent: 'CognitiveSynthesis',
      trustLevel: 'system',
      details: {
        decision: decision.description.substring(0, 100),
        consensus: result.consensus,
        confidence: result.confidence,
        conflicts: result.conflicts.length,
        flagForHumanReview: result.flagForHumanReview,
        duration,
        framework: 'Cross-Pillar Synthesis',
      },
    });
  }

  return result;
}

// =============================================================================
// PILLAR ANALYZERS
// =============================================================================

/**
 * Analyze decision using LOGOS (mathematical reasoning)
 */
async function analyzeWithLogos(
  decision: { description: string; context: Record<string, unknown> }
): Promise<PillarResult> {
  // Convert to Decision type for calculateExpectedValue
  // If context provides outcomes, use them; otherwise create default outcomes
  const outcomes = extractOutcomes(decision);

  const logosDecision: Decision = {
    description: decision.description,
    outcomes,
    context: decision.context,
  };

  const evResult = await calculateExpectedValue(logosDecision);

  // Map EV recommendation to standardized format
  const recommendation = evResult.recommendation; // 'PROCEED', 'CAUTION', 'AVOID'
  const reasoning = evResult.reasoning.join('. ');

  return {
    pillar: 'LOGOS',
    recommendation,
    confidence: evResult.confidence,
    reasoning: `Expected Value: ${evResult.expectedValue.toFixed(2)}. ${reasoning}`,
  };
}

/**
 * Analyze decision using ETHOS (bias detection)
 */
async function analyzeWithEthos(
  decision: { description: string; context: Record<string, unknown> }
): Promise<PillarResult> {
  // Use decision description as reasoning text for bias detection
  const biasResult = await detectCognitiveBias(decision.description, {
    domain: typeof decision.context.domain === 'string' ? decision.context.domain : undefined,
  });

  // Map bias risk level to recommendation
  let recommendation: string;
  if (biasResult.riskLevel === 'CRITICAL' || biasResult.riskLevel === 'HIGH') {
    recommendation = 'AVOID';
  } else if (biasResult.riskLevel === 'MODERATE') {
    recommendation = 'CAUTION';
  } else {
    recommendation = 'PROCEED';
  }

  const confidence = 1 - biasResult.overallRisk;
  const reasoning = biasResult.biasesDetected.length > 0
    ? `Biases detected: ${biasResult.biasesDetected.map((b) => b.type).join(', ')}. ${biasResult.recommendations[0] || ''}`
    : 'No significant biases detected';

  return {
    pillar: 'ETHOS',
    recommendation,
    confidence,
    reasoning,
  };
}

/**
 * Analyze decision using PATHOS (virtue alignment)
 */
async function analyzeWithPathos(
  decision: { description: string; context: Record<string, unknown> }
): Promise<PillarResult> {
  const virtueResult = await checkVirtueAlignment(decision.description, {
    situation: typeof decision.context.situation === 'string' ? decision.context.situation : undefined,
  });

  // Map virtue alignment to recommendation
  let recommendation: string;
  if (virtueResult.alignmentLevel === 'POOR') {
    recommendation = 'AVOID';
  } else if (virtueResult.alignmentLevel === 'MIXED') {
    recommendation = 'CAUTION';
  } else {
    recommendation = 'PROCEED';
  }

  const confidence = virtueResult.overallAlignment;
  const reasoning = `Virtue alignment: ${virtueResult.alignmentLevel}. ${virtueResult.recommendation}`;

  return {
    pillar: 'PATHOS',
    recommendation,
    confidence,
    reasoning,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract outcomes from decision context, or create defaults
 */
function extractOutcomes(decision: { description: string; context: Record<string, unknown> }): Array<{
  description: string;
  probability: number;
  value: number;
}> {
  // Check if outcomes are provided in context
  if (decision.context.outcomes && Array.isArray(decision.context.outcomes)) {
    return decision.context.outcomes as Array<{
      description: string;
      probability: number;
      value: number;
    }>;
  }

  // Create default binary outcomes (success/failure) if not provided
  return [
    {
      description: 'Success',
      probability: 0.5,
      value: 100,
    },
    {
      description: 'Failure',
      probability: 0.5,
      value: -50,
    },
  ];
}

/**
 * Generate unified recommendation from all pillar results
 */
function generateUnifiedRecommendation(
  pillarResults: PillarResult[],
  consensus: boolean
): string {
  if (consensus) {
    // All pillars agree
    const primaryRecommendation = pillarResults[0].recommendation;
    const reasons = pillarResults
      .map((r) => `${r.pillar}: ${r.reasoning}`)
      .join('. ');
    return `${primaryRecommendation}. All pillars agree. ${reasons}`;
  } else {
    // Pillars disagree
    const recommendations = pillarResults
      .map((r) => `${r.pillar} (${(r.confidence * 100).toFixed(0)}%): ${r.recommendation} - ${r.reasoning}`)
      .join('. ');
    return `Pillars disagree - human review recommended. ${recommendations}`;
  }
}
