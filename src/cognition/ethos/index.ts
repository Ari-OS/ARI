/* eslint-disable @typescript-eslint/require-await */
/**
 * ETHOS Pillar — The Domain of Character
 *
 * Note: Functions are async for future extensibility (database lookups, API calls).
 *
 * ETHOS provides ARI with self-awareness and emotional intelligence:
 *
 * - **Bias Detection**: Identify cognitive biases affecting reasoning
 * - **Emotional State**: Monitor emotional state using VAD model
 * - **Fear/Greed Detection**: Catch destructive emotional cycles
 * - **Discipline System**: Pre-decision checks for readiness
 * - **Trading Psychology**: Domain-specific psychological patterns
 *
 * @module cognition/ethos
 * @pillar ETHOS (Character)
 * @version 1.0.0
 */

import { CognitiveEventEmitter, createNoopEmitter } from '../types.js';
import type {
  BiasAnalysis,
  BiasDetection,
  CognitiveBias,
  EmotionalState,
  FearGreedCycle,
  DisciplineCheck,
  DisciplineContext,
} from '../types.js';
import { BIAS_PATTERNS, EMOTION_MAPPINGS } from '../constants.js';
import { BiasDetectionError, EmotionalStateError } from '../errors.js';

// Module-level EventBus — defaults to private, can be replaced with shared bus
let eventBus: CognitiveEventEmitter = createNoopEmitter();

/**
 * Replace the module-level EventBus with a shared instance.
 * Called by CognitionLayer.initialize() to connect ETHOS events to the kernel bus.
 */
export function setEthosEventBus(bus: CognitiveEventEmitter): void {
  eventBus = bus;
}

// =============================================================================
// BIAS DETECTION
// =============================================================================

/**
 * Detect cognitive biases in reasoning text
 *
 * Analyzes text for 10 major cognitive biases based on Kahneman & Tversky research.
 *
 * @param reasoning - The reasoning text to analyze
 * @param context - Optional context for enhanced detection
 * @returns Bias analysis with detected biases and mitigations
 */
export async function detectCognitiveBias(
  reasoning: string,
  context?: {
    historicalDecisions?: Array<{ description: string; outcome: string }>;
    domain?: string;
    expertise?: 'novice' | 'intermediate' | 'expert';
  }
): Promise<BiasAnalysis> {
  if (!reasoning || reasoning.trim().length === 0) {
    throw new BiasDetectionError({
      message: 'Reasoning text cannot be empty',
      code: 'EMPTY_REASONING',
      context: { reasoning },
    });
  }

  const biasesDetected: BiasDetection[] = [];

  // Check each bias pattern
  for (const [biasType, config] of Object.entries(BIAS_PATTERNS)) {
    const matches = config.patterns.filter(p => p.test(reasoning));

    if (matches.length > 0) {
      const severity = Math.min(1.0, matches.length * 0.3 * config.severity_weight);

      biasesDetected.push({
        type: biasType as CognitiveBias,
        detected: true,
        severity,
        evidence: matches.map(m => {
          const match = reasoning.match(m);
          return match ? `Found: "${match[0]}"` : 'Pattern match';
        }),
        patterns: matches.map(m => m.source),
        mitigation: config.mitigation,
        source: config.source,
      });
    }
  }

  // Context-based detection enhancements
  if (context?.expertise === 'novice') {
    const hasOverconfidence = biasesDetected.find(b => b.type === 'OVERCONFIDENCE');
    const hasSimplification = /\b(easy|simple|obvious)\b/i.test(reasoning);

    if (!hasOverconfidence && hasSimplification) {
      biasesDetected.push({
        type: 'DUNNING_KRUGER',
        detected: true,
        severity: 0.4,
        evidence: ['Novice expertise level combined with simplification language'],
        patterns: ['novice + simplification'],
        mitigation: BIAS_PATTERNS.DUNNING_KRUGER.mitigation,
        source: BIAS_PATTERNS.DUNNING_KRUGER.source,
      });
    }
  }

  // Historical pattern detection
  if (context?.historicalDecisions && context.historicalDecisions.length > 0) {
    const recentLosses = context.historicalDecisions.filter(d =>
      d.outcome.toLowerCase().includes('loss') ||
      d.outcome.toLowerCase().includes('fail')
    );

    if (recentLosses.length >= 2 && /\b(due|overdue|bound to)\b/i.test(reasoning)) {
      const hasGamblersFallacy = biasesDetected.find(b => b.type === 'GAMBLERS_FALLACY');
      if (!hasGamblersFallacy) {
        biasesDetected.push({
          type: 'GAMBLERS_FALLACY',
          detected: true,
          severity: 0.6,
          evidence: [`Recent losses (${recentLosses.length}) combined with "due" language`],
          patterns: ['consecutive losses + "due" language'],
          mitigation: BIAS_PATTERNS.GAMBLERS_FALLACY.mitigation,
          source: BIAS_PATTERNS.GAMBLERS_FALLACY.source,
        });
      }
    }
  }

  // Calculate overall risk
  const overallRisk = biasesDetected.length > 0
    ? Math.min(1.0, biasesDetected.reduce((sum, b) => sum + b.severity, 0) / biasesDetected.length)
    : 0;

  // Determine risk level
  const riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' =
    overallRisk >= 0.8 ? 'CRITICAL' :
    overallRisk >= 0.6 ? 'HIGH' :
    overallRisk >= 0.3 ? 'MODERATE' : 'LOW';

  // All bias types checked
  const biasesChecked = Object.keys(BIAS_PATTERNS) as CognitiveBias[];

  // Generate recommendations
  const recommendations = biasesDetected.map(b => b.mitigation);
  if (biasesDetected.length > 2) {
    recommendations.unshift('Multiple biases detected - consider seeking outside perspective');
  }
  if (biasesDetected.length === 0) {
    recommendations.push('No significant biases detected - proceed with awareness');
  }

  const result: BiasAnalysis = {
    reasoning: reasoning.substring(0, 500),
    biasesDetected,
    biasesChecked,
    overallRisk,
    riskLevel,
    recommendations,
    provenance: {
      framework: 'Cognitive Bias Detection (Kahneman & Tversky)',
      computedAt: new Date(),
    },
  };

  // Emit event if biases detected
  if (biasesDetected.length > 0) {
    eventBus.emit('audit:log', {
      action: 'cognition:bias_detected',
      agent: 'ETHOS',
      trustLevel: 'system',
      details: {
        biases: biasesDetected.map(b => ({ type: b.type, severity: b.severity })),
        overallRisk,
        framework: 'Cognitive Bias Detection',
      },
    });
  }

  return result;
}

/**
 * Get bias information without analyzing text
 */
export function getBiasInfo(biasType: CognitiveBias): {
  name: string;
  description: string;
  mitigation: string;
  source: string;
  examples: string[];
} | null {
  const bias = BIAS_PATTERNS[biasType];
  if (!bias) return null;

  return {
    name: biasType.replace(/_/g, ' '),
    description: bias.description,
    mitigation: bias.mitigation,
    source: bias.source,
    examples: bias.examples,
  };
}

// =============================================================================
// EMOTIONAL STATE MONITORING
// =============================================================================

/**
 * Assess emotional state using the VAD (Valence-Arousal-Dominance) model
 *
 * Based on Russell's Circumplex Model of affect.
 *
 * @param input - Emotional indicators
 * @returns Emotional state with risk assessment
 */
export async function assessEmotionalState(input: {
  valence: number;  // -1 (negative) to +1 (positive)
  arousal: number;  // 0 (calm) to 1 (excited)
  dominance: number; // 0 (submissive) to 1 (dominant)
  context?: string;
}): Promise<EmotionalState> {
  const { valence, arousal, dominance } = input;

  // Validate inputs
  if (valence < -1 || valence > 1) {
    throw new EmotionalStateError({
      message: 'Valence must be between -1 and 1',
      code: 'INVALID_CONTEXT',
      context: { valence },
    });
  }
  if (arousal < 0 || arousal > 1) {
    throw new EmotionalStateError({
      message: 'Arousal must be between 0 and 1',
      code: 'INVALID_CONTEXT',
      context: { arousal },
    });
  }
  if (dominance < 0 || dominance > 1) {
    throw new EmotionalStateError({
      message: 'Dominance must be between 0 and 1',
      code: 'INVALID_CONTEXT',
      context: { dominance },
    });
  }

  // Map to emotion labels
  const emotions = mapVADToEmotions(valence, arousal, dominance);
  const primaryEmotion = emotions[0] || 'neutral';

  // Calculate risk to decision quality
  const riskToDecisionQuality = calculateEmotionalRisk(valence, arousal, dominance);

  // Determine stability
  const stability: 'stable' | 'fluctuating' | 'volatile' =
    arousal > 0.7 ? 'volatile' :
    arousal > 0.4 ? 'fluctuating' : 'stable';

  // Determine risk level
  const riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' =
    riskToDecisionQuality >= 0.8 ? 'CRITICAL' :
    riskToDecisionQuality >= 0.6 ? 'HIGH' :
    riskToDecisionQuality >= 0.3 ? 'MODERATE' : 'LOW';

  // Generate recommendations
  const recommendations: string[] = [];

  if (riskToDecisionQuality > 0.7) {
    recommendations.push('CRITICAL: Emotional state significantly impairs judgment - delay major decisions');
  } else if (riskToDecisionQuality > 0.5) {
    recommendations.push('WARNING: Elevated emotional state - apply extra scrutiny to decisions');
  }

  if (arousal > 0.7) {
    recommendations.push('High arousal detected - practice grounding techniques before deciding');
  }

  if (valence < -0.5 && dominance < 0.3) {
    recommendations.push('Negative emotion with low control - seek support or wait before acting');
  }

  if (valence > 0.5 && arousal > 0.7) {
    recommendations.push('Euphoria risk - be wary of overconfidence and impulsive decisions');
  }

  const result: EmotionalState = {
    valence,
    arousal,
    dominance,
    emotions,
    primaryEmotion,
    intensity: arousal,
    stability,
    riskToDecisionQuality,
    riskLevel,
    recommendations,
    provenance: {
      framework: "Russell's Circumplex Model (VAD)",
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:emotional_state_assessed',
    agent: 'ETHOS',
    trustLevel: 'system',
    details: {
      valence,
      arousal,
      dominance,
      emotions: emotions.slice(0, 3),
      riskToDecisionQuality,
      framework: 'Emotional State (VAD)',
    },
  });

  return result;
}

function mapVADToEmotions(valence: number, arousal: number, dominance: number): string[] {
  const emotions: string[] = [];

  // Find matching emotions from the mapping (array structure with min/max ranges)
  for (const mapping of EMOTION_MAPPINGS) {
    const vInRange = valence >= mapping.valence.min && valence <= mapping.valence.max;
    const aInRange = arousal >= mapping.arousal.min && arousal <= mapping.arousal.max;
    const dInRange = dominance >= mapping.dominance.min && dominance <= mapping.dominance.max;

    if (vInRange && aInRange && dInRange) {
      emotions.push(mapping.name);
    }
  }

  // If no close matches, use quadrant-based labels
  if (emotions.length === 0) {
    if (valence > 0 && arousal > 0.5) emotions.push('Excitement');
    else if (valence > 0 && arousal <= 0.5) emotions.push('Contentment');
    else if (valence < 0 && arousal > 0.5) emotions.push('Anxiety');
    else if (valence < 0 && arousal <= 0.5) emotions.push('Sadness');
    else emotions.push('Neutral');
  }

  return emotions;
}

function calculateEmotionalRisk(valence: number, arousal: number, dominance: number): number {
  // High arousal increases risk
  let risk = arousal * 0.4;

  // Extreme valence increases risk (both very positive and very negative)
  risk += Math.abs(valence) * 0.3;

  // Low dominance (feeling out of control) increases risk
  risk += (1 - dominance) * 0.3;

  return Math.min(1, Math.max(0, risk));
}

// =============================================================================
// FEAR/GREED CYCLE DETECTION
// =============================================================================

/**
 * Detect fear/greed cycles in decision-making patterns
 *
 * Based on Mark Douglas's Trading Psychology framework.
 *
 * @param indicators - Behavioral indicators
 * @returns Fear/greed cycle analysis
 */
export async function detectFearGreedCycle(indicators: {
  recentDecisions?: Array<{
    description: string;
    outcome: 'win' | 'loss' | 'neutral';
    emotionalReaction?: string;
  }>;
  currentMood?: string;
  behavioralSigns?: string[];
  marketConditions?: 'bull' | 'bear' | 'sideways';
}): Promise<FearGreedCycle> {
  let pattern: 'FEAR_SPIRAL' | 'GREED_CHASE' | 'REVENGE_TRADING' | 'EUPHORIA' | 'PANIC_SELLING' | 'FOMO' | 'NONE' = 'NONE';
  let detected = false;
  let severity = 0;
  const evidence: string[] = [];
  const triggers: string[] = [];
  const detectedBehavioralSigns: string[] = [];
  let phase: 'early' | 'mid' | 'late' | 'none' = 'none';

  const { recentDecisions = [], currentMood, behavioralSigns: inputBehavioralSigns = [], marketConditions } = indicators;

  // Analyze recent decision patterns
  const recentLosses = recentDecisions.filter(d => d.outcome === 'loss');
  const recentWins = recentDecisions.filter(d => d.outcome === 'win');

  // Fear Spiral Detection
  if (recentLosses.length >= 2) {
    const fearIndicators = inputBehavioralSigns.filter(s =>
      /\b(scared|afraid|anxious|worried|hesitant|paralyz)/i.test(s)
    );

    if (fearIndicators.length > 0 || currentMood?.toLowerCase().includes('fear')) {
      pattern = 'FEAR_SPIRAL';
      detected = true;
      severity = Math.min(1, 0.3 + (recentLosses.length * 0.15) + (fearIndicators.length * 0.1));
      evidence.push(`${recentLosses.length} recent losses`);
      evidence.push(...fearIndicators.map(s => `Behavioral sign: ${s}`));
      triggers.push(...recentLosses.map(l => l.description));
      detectedBehavioralSigns.push(...fearIndicators);
      phase = severity < 0.4 ? 'early' : severity < 0.7 ? 'mid' : 'late';
    }
  }

  // Greed Chase Detection
  if (recentWins.length >= 2 && marketConditions === 'bull') {
    const greedIndicators = inputBehavioralSigns.filter(s =>
      /\b(more|bigger|aggressive|fomo|missing out|double)/i.test(s)
    );

    if (greedIndicators.length > 0) {
      pattern = 'GREED_CHASE';
      detected = true;
      severity = Math.min(1, 0.3 + (recentWins.length * 0.15) + (greedIndicators.length * 0.1));
      evidence.push(`${recentWins.length} recent wins in bull market`);
      evidence.push(...greedIndicators.map(s => `Behavioral sign: ${s}`));
      triggers.push(...recentWins.map(w => w.description));
      detectedBehavioralSigns.push(...greedIndicators);
      phase = severity < 0.4 ? 'early' : severity < 0.7 ? 'mid' : 'late';
    }
  }

  // Revenge Trading Detection
  const recentLossWithReaction = recentDecisions.filter(
    d => d.outcome === 'loss' && d.emotionalReaction?.toLowerCase().includes('angry')
  );

  if (recentLossWithReaction.length >= 1) {
    const revengeIndicators = inputBehavioralSigns.filter(s =>
      /\b(make it back|recover|revenge|show them|prove)/i.test(s)
    );

    if (revengeIndicators.length > 0) {
      pattern = 'REVENGE_TRADING';
      detected = true;
      severity = Math.min(1, 0.5 + (revengeIndicators.length * 0.15));
      evidence.push('Recent loss with angry emotional reaction');
      evidence.push(...revengeIndicators.map(s => `Behavioral sign: ${s}`));
      triggers.push(...recentLossWithReaction.map(l => l.description));
      detectedBehavioralSigns.push(...revengeIndicators);
      phase = 'mid'; // Revenge trading is typically already problematic
    }
  }

  // Euphoria Detection
  if (recentWins.length >= 3) {
    const euphoriaIndicators = inputBehavioralSigns.filter(s =>
      /\b(invincible|can't lose|genius|easy|always)/i.test(s)
    );

    if (euphoriaIndicators.length > 0 || currentMood?.toLowerCase().includes('euphori')) {
      pattern = 'EUPHORIA';
      detected = true;
      severity = Math.min(1, 0.4 + (recentWins.length * 0.1) + (euphoriaIndicators.length * 0.15));
      evidence.push(`${recentWins.length} consecutive wins`);
      evidence.push(...euphoriaIndicators.map(s => `Behavioral sign: ${s}`));
      triggers.push(...recentWins.map(w => w.description));
      detectedBehavioralSigns.push(...euphoriaIndicators);
      phase = severity < 0.5 ? 'early' : severity < 0.8 ? 'mid' : 'late';
    }
  }

  // Generate recommendation
  let recommendation = '';
  switch (pattern) {
    case 'FEAR_SPIRAL':
      recommendation = 'Take a break. Review your strategy with fresh eyes. Consider reducing position sizes.';
      break;
    case 'GREED_CHASE':
      recommendation = 'Return to your base strategy. Don\'t increase position sizes after wins. Remember: the market doesn\'t care about your winning streak.';
      break;
    case 'REVENGE_TRADING':
      recommendation = 'STOP trading immediately. The market doesn\'t owe you money back. Take at least 24 hours off.';
      break;
    case 'EUPHORIA':
      recommendation = 'Be cautious. Overconfidence is the most expensive bias. Review risk management rules.';
      break;
    default:
      recommendation = 'No concerning patterns detected. Maintain awareness and discipline.';
  }

  const result: FearGreedCycle = {
    pattern,
    detected,
    severity,
    phase,
    evidence,
    triggers,
    behavioralSigns: detectedBehavioralSigns,
    recommendation,
    interventions: [recommendation], // Main recommendation as intervention
    provenance: {
      framework: 'Trading Psychology (Mark Douglas)',
      computedAt: new Date(),
    },
  };

  if (detected) {
    eventBus.emit('audit:log', {
      action: 'cognition:fear_greed_detected',
      agent: 'ETHOS',
      trustLevel: 'system',
      details: {
        pattern,
        severity,
        phase,
        framework: 'Fear/Greed Detection',
      },
    });
  }

  return result;
}

// =============================================================================
// PRE-DECISION DISCIPLINE SYSTEM
// =============================================================================

/**
 * Run pre-decision discipline checks
 *
 * Ensures physical, emotional, and preparatory readiness before major decisions.
 *
 * @param decision - Decision description
 * @param agent - Agent performing the decision
 * @param context - Context for discipline check
 * @returns Discipline assessment with pass/fail
 */
export async function runDisciplineCheck(
  decision: string,
  agent: string,
  context: DisciplineContext = {}
): Promise<DisciplineCheck> {
  const violations: string[] = [];
  const recommendations: string[] = [];
  const blockers: string[] = [];

  // Physical checks
  const physicalScore = calculatePhysicalScore(context, violations, recommendations);

  // Emotional checks - use provided emotional state or assess
  const emotionalInput = context.emotional ?? { valence: 0, arousal: 0.5, dominance: 0.5 };
  const emotionalState = await assessEmotionalState({
    valence: emotionalInput.valence,
    arousal: emotionalInput.arousal,
    dominance: emotionalInput.dominance,
    context: emotionalInput.context,
  });
  const emotionalScore = 1 - emotionalState.riskToDecisionQuality;
  if (emotionalState.riskLevel === 'HIGH' || emotionalState.riskLevel === 'CRITICAL') {
    violations.push(`High emotional risk: ${emotionalState.riskLevel}`);
    blockers.push('Emotional state too volatile for decision');
    recommendations.push(...emotionalState.recommendations);
  }

  // Timing checks
  const timingScore = calculateTimingScore(context, violations, recommendations);

  // Preparation checks
  const preparationScore = calculatePreparationScore(context, violations, recommendations);

  // Meta checks
  const metaScore = calculateMetaScore(context, violations, recommendations);

  // Overall score
  const overallScore = (
    physicalScore * 0.2 +
    emotionalScore * 0.25 +
    timingScore * 0.15 +
    preparationScore * 0.25 +
    metaScore * 0.15
  );

  const passed = overallScore >= 0.7 && violations.length < 3;
  const threshold = 0.7;
  const shouldProceed = passed && blockers.length === 0;
  const waitPeriod = shouldProceed ? undefined : '24 hours recommended';

  const result: DisciplineCheck = {
    decision,
    agent,
    physical: {
      sleep: {
        adequate: context.sleep ? context.sleep.hours >= 7 : true,
        hours: context.sleep?.hours,
        quality: context.sleep?.quality,
      },
      nutrition: {
        adequate: !!context.lastMeal,
        lastMeal: context.lastMeal,
      },
      exercise: {
        recent: !!context.lastExercise,
        lastActivity: context.lastExercise,
      },
      score: physicalScore,
      issues: violations.filter(v => v.includes('sleep') || v.includes('meal')),
    },
    emotional: {
      state: emotionalState,
      riskScore: emotionalState.riskToDecisionQuality,
      score: emotionalScore,
    },
    timing: {
      rushed: false,
      appropriateTime: true,
      timeOfDay: 'acceptable',
      deadline: context.deadline,
      deadlinePressure: !!context.deadline,
      score: timingScore,
      issues: violations.filter(v => v.includes('rushed') || v.includes('deadline')),
    },
    preparation: {
      researchDone: !!context.researchDocuments && context.researchDocuments.length > 0,
      alternativesConsidered: !!context.alternativesConsidered && context.alternativesConsidered.length > 0,
      stakeholdersConsulted: !!context.consultedParties && context.consultedParties.length > 0,
      dataGathered: !!context.researchDocuments,
      score: preparationScore,
      gaps: violations.filter(v => v.includes('research') || v.includes('alternatives') || v.includes('stakeholder')),
    },
    meta: {
      biasChecked: false, // Would need to be passed in
      secondOpinionSought: !!context.consultedParties,
      reversibilityConsidered: false,
      worstCaseConsidered: false,
      score: metaScore,
      gaps: violations.filter(v => v.includes('bias') || v.includes('opinion') || v.includes('reversib')),
    },
    overallScore,
    passed,
    threshold,
    violations,
    recommendations,
    blockers,
    shouldProceed,
    waitPeriod,
    provenance: {
      framework: 'Pre-Decision Discipline System',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:discipline_check',
    agent: 'ETHOS',
    trustLevel: 'system',
    details: {
      decision,
      passed,
      overallScore,
      violations: violations.length,
      framework: 'Discipline System',
    },
  });

  return result;
}

function calculatePhysicalScore(
  context: DisciplineContext,
  violations: string[],
  recommendations: string[]
): number {
  let score = 1.0;

  if (context.sleep) {
    if (context.sleep.hours < 6) {
      score -= 0.4;
      violations.push('Severely sleep deprived (< 6 hours)');
      recommendations.push('Get adequate sleep before major decisions');
    } else if (context.sleep.hours < 7) {
      score -= 0.2;
      recommendations.push('Consider getting more sleep for optimal cognition');
    }
  }

  if (!context.lastMeal) {
    score -= 0.15;
    recommendations.push('Eat something - hunger impairs judgment');
  }

  return Math.max(0, score);
}

function calculateTimingScore(
  context: DisciplineContext,
  violations: string[],
  recommendations: string[]
): number {
  let score = 1.0;

  if (context.deadline) {
    const hoursUntilDeadline = (context.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDeadline < 1) {
      score -= 0.3;
      violations.push('Very tight deadline');
      recommendations.push('Very tight deadline - focus on essentials');
    }
  }

  return Math.max(0, score);
}

function calculatePreparationScore(
  context: DisciplineContext,
  violations: string[],
  recommendations: string[]
): number {
  let score = 0.4; // Base score

  if (context.researchDocuments && context.researchDocuments.length > 0) {
    score += 0.3;
  } else {
    recommendations.push('Complete research before deciding');
  }

  if (context.alternativesConsidered && context.alternativesConsidered.length > 0) {
    score += 0.2;
  } else {
    violations.push('Alternatives not considered');
    recommendations.push('Consider at least 2-3 alternatives before deciding');
  }

  if (context.consultedParties && context.consultedParties.length > 0) {
    score += 0.1;
  }

  return Math.min(1, score);
}

function calculateMetaScore(
  context: DisciplineContext,
  violations: string[],
  recommendations: string[]
): number {
  let score = 0.4;

  // Bias check would need to be tracked separately
  recommendations.push('Run a bias check on your reasoning');

  if (context.consultedParties && context.consultedParties.length > 0) {
    score += 0.2;
  } else {
    recommendations.push('Consider seeking a second opinion');
  }

  // Reversibility would need to be tracked separately
  recommendations.push('Consider: Is this decision reversible?');

  return Math.min(1, score);
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  BiasAnalysis,
  BiasDetection,
  CognitiveBias,
  EmotionalState,
  FearGreedCycle,
  DisciplineCheck,
  DisciplineContext,
};
