/* eslint-disable @typescript-eslint/require-await */
/**
 * LOGOS Pillar — The Domain of Reason
 *
 * Note: Functions are async for future extensibility (database lookups, API calls).
 *
 * LOGOS provides ARI with rigorous analytical frameworks for decision-making:
 *
 * - **Bayesian Reasoning**: Update beliefs based on evidence using probability theory
 * - **Expected Value**: Calculate rational decision values with uncertainty
 * - **Kelly Criterion**: Optimal position sizing for risk management
 * - **Decision Trees**: Structure complex decisions with multiple branches
 * - **Systems Thinking**: Analyze feedback loops and leverage points
 * - **Antifragility**: Assess resilience and benefit from volatility
 *
 * @module cognition/logos
 * @pillar LOGOS (Reason)
 * @version 1.0.0
 */

// =============================================================================
// BAYESIAN REASONING
// =============================================================================

// Note: z (Zod) available for runtime validation at API boundaries
import { EventBus } from '../../kernel/event-bus.js';
import type {
  Belief,
  Evidence,
  BayesianUpdate,
} from '../types.js';
import { BayesianError } from '../errors.js';

// Module-level EventBus — defaults to private, can be replaced with shared bus
let eventBus = new EventBus();

/**
 * Replace the module-level EventBus with a shared instance.
 * Called by CognitionLayer.initialize() to connect LOGOS events to the kernel bus.
 */
export function setLogosEventBus(bus: EventBus): void {
  eventBus = bus;
}

/**
 * Calculate posterior probability using Bayes' theorem
 *
 * P(H|E) = P(E|H) × P(H) / P(E)
 *
 * @param p_h - Prior probability P(H)
 * @param p_e_given_h - Likelihood P(E|H)
 * @param p_e - Marginal probability P(E)
 * @returns Posterior probability P(H|E)
 */
export function calculatePosterior(
  p_h: number,
  p_e_given_h: number,
  p_e: number
): number {
  if (p_h < 0 || p_h > 1) {
    throw new BayesianError({
      message: 'P(H) must be between 0 and 1',
      code: 'INVALID_PROBABILITY',
      context: { parameter: 'p_h', value: p_h },
    });
  }
  if (p_e_given_h < 0 || p_e_given_h > 1) {
    throw new BayesianError({
      message: 'P(E|H) must be between 0 and 1',
      code: 'INVALID_PROBABILITY',
      context: { parameter: 'p_e_given_h', value: p_e_given_h },
    });
  }
  if (p_e <= 0 || p_e > 1) {
    throw new BayesianError({
      message: 'P(E) must be between 0 and 1 (exclusive of 0)',
      code: 'INVALID_PROBABILITY',
      context: { parameter: 'p_e', value: p_e },
    });
  }

  return (p_e_given_h * p_h) / p_e;
}

/**
 * Update belief with new evidence using likelihood ratio
 *
 * Uses odds form of Bayes: posterior_odds = prior_odds × likelihood_ratio
 *
 * @param prior - Prior belief with probability
 * @param evidence - New evidence with likelihood ratio
 * @returns Updated belief with interpretation and provenance
 */
export async function updateBelief(
  prior: Belief,
  evidence: Evidence
): Promise<BayesianUpdate> {
  const p_h = prior.priorProbability;
  const lr = evidence.likelihoodRatio;

  if (p_h <= 0 || p_h >= 1) {
    throw new BayesianError({
      message: 'Prior probability must be between 0 and 1 (exclusive)',
      code: 'INVALID_PROBABILITY',
      context: { priorProbability: p_h },
    });
  }

  if (lr <= 0) {
    throw new BayesianError({
      message: 'Likelihood ratio must be positive',
      code: 'INVALID_EVIDENCE',
      context: { likelihoodRatio: lr },
    });
  }

  // Calculate posterior using odds form of Bayes
  const priorOdds = p_h / (1 - p_h);
  const posteriorOdds = priorOdds * lr;
  const posteriorProbability = posteriorOdds / (1 + posteriorOdds);

  // Clamp to valid probability range
  const clampedPosterior = Math.max(0.001, Math.min(0.999, posteriorProbability));

  const shift = clampedPosterior - p_h;

  // Determine shift direction
  const shiftDirection: 'increased' | 'decreased' | 'unchanged' =
    Math.abs(shift) < 0.001 ? 'unchanged' :
    shift > 0 ? 'increased' : 'decreased';

  // Generate interpretation
  let interpretation: string;
  if (Math.abs(shift) < 0.05) {
    interpretation = 'Evidence has minimal impact on belief';
  } else if (shift > 0.2) {
    interpretation = 'Strong supporting evidence significantly increases confidence';
  } else if (shift > 0) {
    interpretation = 'Evidence moderately supports the hypothesis';
  } else if (shift < -0.2) {
    interpretation = 'Strong contradicting evidence significantly decreases confidence';
  } else {
    interpretation = 'Evidence moderately contradicts the hypothesis';
  }

  const confidence = calculateBayesianConfidence(p_h, clampedPosterior, evidence.strength);

  const result: BayesianUpdate = {
    hypothesis: prior.hypothesis,
    priorProbability: p_h,
    posteriorProbability: clampedPosterior,
    evidenceUsed: [evidence],
    shift,
    shiftDirection,
    interpretation,
    confidence,
    provenance: {
      framework: 'Bayesian Reasoning (Bayes, 1763)',
      computedAt: new Date(),
    },
  };

  // Emit event for tracking
  eventBus.emit('audit:log', {
    action: 'cognition:belief_updated',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      hypothesis: result.hypothesis,
      priorProbability: result.priorProbability,
      posteriorProbability: result.posteriorProbability,
      shift: result.shift,
      framework: 'Bayesian',
    },
  });

  return result;
}

/**
 * Update belief with multiple pieces of evidence sequentially
 */
export async function updateBeliefSequential(
  belief: Belief,
  evidenceList: Evidence[]
): Promise<BayesianUpdate> {
  if (evidenceList.length === 0) {
    return {
      hypothesis: belief.hypothesis,
      priorProbability: belief.priorProbability,
      posteriorProbability: belief.priorProbability,
      evidenceUsed: [],
      shift: 0,
      shiftDirection: 'unchanged',
      interpretation: 'No evidence provided',
      confidence: 0.5,
      provenance: {
        framework: 'Bayesian Reasoning (Bayes, 1763)',
        computedAt: new Date(),
      },
    };
  }

  let currentBelief = belief;
  const allEvidence: Evidence[] = [];

  for (const evidence of evidenceList) {
    const update = await updateBelief(currentBelief, evidence);
    currentBelief = {
      hypothesis: belief.hypothesis,
      priorProbability: update.posteriorProbability,
    };
    allEvidence.push(evidence);
  }

  const totalShift = currentBelief.priorProbability - belief.priorProbability;
  const shiftDirection: 'increased' | 'decreased' | 'unchanged' =
    Math.abs(totalShift) < 0.001 ? 'unchanged' :
    totalShift > 0 ? 'increased' : 'decreased';

  return {
    hypothesis: belief.hypothesis,
    priorProbability: belief.priorProbability,
    posteriorProbability: currentBelief.priorProbability,
    evidenceUsed: allEvidence,
    shift: totalShift,
    shiftDirection,
    interpretation: interpretTotalShift(totalShift, evidenceList.length),
    confidence: calculateSequentialConfidence(evidenceList),
    provenance: {
      framework: 'Bayesian Reasoning (Bayes, 1763)',
      computedAt: new Date(),
    },
  };
}

function calculateBayesianConfidence(prior: number, posterior: number, strength: string): number {
  const strengthMultiplier = { weak: 0.6, moderate: 0.8, strong: 0.95 }[strength] || 0.7;
  const uncertainty = Math.min(prior, 1 - prior) + Math.min(posterior, 1 - posterior);
  return Math.max(0.5, strengthMultiplier * (1 - uncertainty / 2));
}

function calculateSequentialConfidence(evidenceList: Evidence[]): number {
  const avgStrength = evidenceList.reduce((sum, e) => {
    const s = { weak: 0.3, moderate: 0.6, strong: 0.9 }[e.strength] || 0.5;
    return sum + s;
  }, 0) / evidenceList.length;

  return Math.min(0.95, avgStrength + (evidenceList.length * 0.05));
}

function interpretTotalShift(shift: number, evidenceCount: number): string {
  const direction = shift > 0 ? 'supporting' : 'contradicting';
  const magnitude = Math.abs(shift);

  if (magnitude < 0.05) return `After ${evidenceCount} pieces of evidence, belief remains essentially unchanged`;
  if (magnitude < 0.15) return `${evidenceCount} pieces of ${direction} evidence caused moderate belief shift`;
  if (magnitude < 0.30) return `${evidenceCount} pieces of ${direction} evidence caused significant belief shift`;
  return `${evidenceCount} pieces of ${direction} evidence caused major belief revision`;
}

// =============================================================================
// EXPECTED VALUE
// =============================================================================

import type {
  Decision,
  Outcome,
  ExpectedValueResult,
} from '../types.js';
import { ExpectedValueError } from '../errors.js';

/**
 * Calculate expected value of a decision
 *
 * EV = Σ (probability_i × value_i) for all outcomes
 *
 * @param decision - Decision with outcomes and probabilities
 * @returns Expected value result with recommendation
 */
export async function calculateExpectedValue(
  decision: Decision
): Promise<ExpectedValueResult> {
  if (!decision.outcomes || decision.outcomes.length === 0) {
    throw new ExpectedValueError({
      message: 'Decision must have at least one outcome',
      code: 'INVALID_OUTCOMES',
      context: { decision: decision.description },
    });
  }

  // Validate probabilities sum to 1
  const totalProbability = decision.outcomes.reduce((sum, o) => sum + o.probability, 0);
  if (Math.abs(totalProbability - 1.0) > 0.01) {
    throw new ExpectedValueError({
      message: `Probabilities must sum to 1.0 (got ${totalProbability.toFixed(3)})`,
      code: 'PROBABILITIES_NOT_SUM_TO_ONE',
      context: { outcomes: decision.outcomes, totalProbability },
    });
  }

  // Calculate expected value
  const expectedValue = decision.outcomes.reduce(
    (sum, o) => sum + (o.probability * o.value),
    0
  );

  // Calculate variance
  const variance = decision.outcomes.reduce(
    (sum, o) => sum + (o.probability * Math.pow(o.value - expectedValue, 2)),
    0
  );

  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = expectedValue !== 0 ? Math.abs(standardDeviation / expectedValue) : Infinity;

  // Find best, worst, and most likely cases
  const sortedOutcomes = [...decision.outcomes].sort((a, b) => b.value - a.value);
  const bestCase = sortedOutcomes[0];
  const worstCase = sortedOutcomes[sortedOutcomes.length - 1];
  const mostLikelyCase = [...decision.outcomes].sort((a, b) => b.probability - a.probability)[0];

  // Sensitivity analysis (wire up schema fields)
  const mostCriticalOutcome = [...decision.outcomes]
    .map(o => ({ outcome: o, impact: o.probability * Math.abs(o.value - expectedValue) }))
    .sort((a, b) => b.impact - a.impact)[0]?.outcome;

  let breakEvenProbability: number | undefined;
  if (bestCase && worstCase && bestCase.value !== worstCase.value) {
    const denom = bestCase.value - worstCase.value;
    const pBreakEven = denom !== 0 ? (-worstCase.value / denom) : NaN;
    if (Number.isFinite(pBreakEven) && pBreakEven >= 0 && pBreakEven <= 1) {
      breakEvenProbability = pBreakEven;
    }
  }

  const sensitivityAnalysis = mostCriticalOutcome
    ? {
        mostCriticalOutcome: mostCriticalOutcome.description,
        breakEvenPoint: breakEvenProbability,
      }
    : undefined;

  // Generate recommendation
  const { recommendation, reasoning } = generateEVRecommendation(
    expectedValue,
    standardDeviation,
    bestCase,
    worstCase
  );

  // Calculate confidence
  const confidence = calculateEVConfidence(decision.outcomes, standardDeviation);

  const result: ExpectedValueResult = {
    decision: decision.description,
    expectedValue,
    variance,
    standardDeviation,
    coefficientOfVariation,
    outcomes: decision.outcomes,
    bestCase,
    worstCase,
    mostLikelyCase,
    breakEvenProbability,
    sensitivityAnalysis,
    recommendation,
    reasoning,
    confidence,
    provenance: {
      framework: 'Expected Value Theory',
      computedAt: new Date(),
    },
  };

  // Emit event
  eventBus.emit('audit:log', {
    action: 'cognition:expected_value_calculated',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      decision: decision.description,
      expectedValue,
      recommendation,
      framework: 'Expected Value',
    },
  });

  return result;
}

/**
 * Rank multiple decisions by expected value
 */
export async function rankDecisions(
  decisions: Decision[]
): Promise<Array<ExpectedValueResult & { rank: number }>> {
  const results = await Promise.all(
    decisions.map(d => calculateExpectedValue(d))
  );

  return results
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function generateEVRecommendation(
  ev: number,
  sd: number,
  best: Outcome,
  worst: Outcome
): { recommendation: 'PROCEED' | 'CAUTION' | 'AVOID'; reasoning: string[] } {
  const reasoning: string[] = [];

  // EV analysis
  if (ev > 0) {
    reasoning.push(`Positive expected value: +${ev.toFixed(2)}`);
  } else if (ev < 0) {
    reasoning.push(`Negative expected value: ${ev.toFixed(2)}`);
  } else {
    reasoning.push('Expected value is zero (break-even)');
  }

  // Risk analysis (coefficient of variation)
  const cv = ev !== 0 ? Math.abs(sd / ev) : Infinity;
  if (cv < 0.5) {
    reasoning.push('Low volatility relative to expected return');
  } else if (cv < 1.0) {
    reasoning.push('Moderate volatility - some uncertainty');
  } else {
    reasoning.push('High volatility - significant uncertainty');
  }

  // Downside analysis
  if (worst.value < 0 && worst.probability > 0.2) {
    reasoning.push(`Significant downside risk: ${(worst.probability * 100).toFixed(0)}% chance of ${worst.value.toFixed(2)}`);
  }

  // Upside analysis
  if (best.value > 0 && best.probability > 0.3) {
    reasoning.push(`Good upside potential: ${(best.probability * 100).toFixed(0)}% chance of +${best.value.toFixed(2)}`);
  }

  // Recommendation
  let recommendation: 'PROCEED' | 'CAUTION' | 'AVOID';

  if (ev > 0 && cv < 1.0) {
    recommendation = 'PROCEED';
    reasoning.push('Recommendation: PROCEED - positive EV with acceptable risk');
  } else if (ev > 0 && cv >= 1.0) {
    recommendation = 'CAUTION';
    reasoning.push('Recommendation: CAUTION - positive EV but high volatility');
  } else if (ev <= 0 && worst.value >= 0) {
    recommendation = 'CAUTION';
    reasoning.push('Recommendation: CAUTION - no upside but no downside');
  } else {
    recommendation = 'AVOID';
    reasoning.push('Recommendation: AVOID - negative or zero EV');
  }

  return { recommendation, reasoning };
}

function calculateEVConfidence(outcomes: Outcome[], sd: number): number {
  // Higher confidence with more outcomes and lower standard deviation
  const outcomeBonus = Math.min(0.2, outcomes.length * 0.05);
  const sdPenalty = Math.min(0.3, sd * 0.001);

  // Check if outcomes have confidence values
  const avgOutcomeConfidence = outcomes.reduce(
    (sum, o) => sum + (o.confidence || 0.7),
    0
  ) / outcomes.length;

  return Math.min(0.95, Math.max(0.5, avgOutcomeConfidence + outcomeBonus - sdPenalty));
}

// =============================================================================
// KELLY CRITERION
// =============================================================================

import type {
  KellyInput,
  KellyResult,
} from '../types.js';
import { KellyError } from '../errors.js';

/**
 * Calculate optimal position size using Kelly Criterion
 *
 * Kelly % = (bp - q) / b
 * where:
 *   b = odds received on the bet (win amount / loss amount)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 *
 * @param input - Win probability, win amount, loss amount
 * @returns Kelly fractions with recommendations
 */
export async function calculateKellyFraction(
  input: KellyInput
): Promise<KellyResult> {
  const { winProbability, winAmount, lossAmount, currentCapital } = input;

  if (winProbability <= 0 || winProbability >= 1) {
    throw new KellyError({
      message: 'Win probability must be between 0 and 1 (exclusive)',
      code: 'INVALID_PROBABILITY',
      context: { winProbability },
    });
  }

  if (winAmount <= 0) {
    throw new KellyError({
      message: 'Win amount must be positive',
      code: 'INVALID_INPUT',
      context: { winAmount },
    });
  }

  if (lossAmount <= 0) {
    throw new KellyError({
      message: 'Loss amount must be positive',
      code: 'INVALID_INPUT',
      context: { lossAmount },
    });
  }

  const p = winProbability;
  const q = 1 - p;
  const profitOdds = winAmount / lossAmount; // net odds / profit multiple (b)
  const grossOdds = 1 + profitOdds; // includes stake back; useful for log-growth formulas

  // Calculate edge
  const edge = (p * profitOdds) - q;

  // Kelly formula
  const fullKelly = (p * profitOdds - q) / profitOdds;

  // Clamp to valid range
  const clampedFullKelly = Math.max(0, Math.min(1, fullKelly));
  const halfKelly = clampedFullKelly / 2;
  const quarterKelly = clampedFullKelly / 4;

  // Expected growth rate (log utility)
  const expectedGrowthRate = clampedFullKelly > 0
    ? p * Math.log(1 + clampedFullKelly * (grossOdds - 1)) + q * Math.log(1 - clampedFullKelly)
    : 0;

  // Generate warnings
  const warnings: string[] = [];

  if (edge <= 0) {
    warnings.push('CRITICAL: Negative or zero edge - do not bet');
  }

  if (fullKelly > 0.5) {
    warnings.push('WARNING: Full Kelly > 50% - extremely aggressive');
  } else if (fullKelly > 0.3) {
    warnings.push('CAUTION: Full Kelly > 30% - very aggressive');
  }

  if (p > 0.8) {
    warnings.push('NOTE: High win probability may indicate overconfidence');
  }

  // Determine recommended strategy
  let recommendedStrategy: 'full' | 'half' | 'quarter' | 'avoid';
  let recommendedFraction: number;

  if (edge <= 0) {
    recommendedStrategy = 'avoid';
    recommendedFraction = 0;
  } else if (fullKelly > 0.3) {
    recommendedStrategy = 'quarter';
    recommendedFraction = quarterKelly;
    warnings.push('Using quarter-Kelly due to high volatility');
  } else if (fullKelly > 0.15) {
    recommendedStrategy = 'half';
    recommendedFraction = halfKelly;
    warnings.push('Using half-Kelly for conservative position sizing');
  } else {
    recommendedStrategy = 'full';
    recommendedFraction = clampedFullKelly;
  }

  const result: KellyResult = {
    fullKelly: clampedFullKelly,
    halfKelly,
    quarterKelly,
    recommendedFraction,
    recommendedStrategy,
    edge,
    odds: profitOdds,
    expectedGrowthRate,
    warnings,
    dollarAmount: currentCapital ? recommendedFraction * currentCapital : undefined,
    provenance: {
      framework: 'Kelly Criterion (Kelly, 1956)',
      computedAt: new Date(),
    },
  };

  // Emit event
  eventBus.emit('audit:log', {
    action: 'cognition:kelly_calculated',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      recommendedFraction: result.recommendedFraction,
      strategy: result.recommendedStrategy,
      edge: result.edge,
      framework: 'Kelly Criterion',
    },
  });

  return result;
}

/**
 * Assess risk of ruin using Monte Carlo simulation
 */
export async function assessRiskOfRuin(
  strategy: {
    kellyFraction: number;
    winProbability: number;
    winAmount: number;
    lossAmount: number;
  },
  iterations: number = 10000
): Promise<{
  riskOfRuin: number;
  medianEndingCapital: number;
  percentile5: number;
  percentile95: number;
  maxDrawdown: number;
}> {
  const { kellyFraction, winProbability, winAmount, lossAmount } = strategy;
  const results: number[] = [];
  let ruinCount = 0;
  const drawdowns: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let capital = 1.0;
    let peak = 1.0;
    let maxDrawdown = 0;

    // Simulate 100 bets
    for (let bet = 0; bet < 100; bet++) {
      const betSize = capital * kellyFraction;

      if (Math.random() < winProbability) {
        capital += betSize * (winAmount / lossAmount);
      } else {
        capital -= betSize;
      }

      if (capital > peak) peak = capital;
      const drawdown = (peak - capital) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      if (capital <= 0.01) {
        ruinCount++;
        break;
      }
    }

    results.push(capital);
    drawdowns.push(maxDrawdown);
  }

  results.sort((a, b) => a - b);

  return {
    riskOfRuin: ruinCount / iterations,
    medianEndingCapital: results[Math.floor(iterations / 2)],
    percentile5: results[Math.floor(iterations * 0.05)],
    percentile95: results[Math.floor(iterations * 0.95)],
    maxDrawdown: Math.max(...drawdowns),
  };
}

// =============================================================================
// DECISION TREES
// =============================================================================

import type { DecisionNode, DecisionTreeResult } from '../types.js';

/**
 * Evaluate a decision tree using expected value rollback
 *
 * @param root - Root node of the decision tree
 * @returns Optimal path and expected value
 */
export async function evaluateDecisionTree(
  root: DecisionNode
): Promise<DecisionTreeResult> {
  const evaluation = evaluateNode(root);
  const optimalPath = findOptimalPath(root, evaluation.decisions);
  const allPaths = enumerateDecisionTreePaths(root);

  const result: DecisionTreeResult = {
    rootNode: root,
    optimalPath,
    optimalValue: evaluation.value,
    allPaths,
    provenance: {
      framework: 'Decision Tree Analysis (Backward Induction)',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:decision_tree_evaluated',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      expectedValue: evaluation.value,
      optimalPathLength: optimalPath.length,
      framework: 'Decision Tree',
    },
  });

  return result;
}

interface NodeEvaluation {
  value: number;
  decisions: Map<string, string>;
}

function evaluateNode(node: DecisionNode): NodeEvaluation {
  const decisions = new Map<string, string>();

  if (node.type === 'terminal' || !node.children || node.children.length === 0) {
    return { value: node.value || 0, decisions };
  }

  if (node.type === 'chance') {
    // Expected value of all outcomes
    let ev = 0;
    for (const child of node.children) {
      const childEval = evaluateNode(child);
      ev += (child.probability || 0) * childEval.value;
      // Merge decisions from child
      childEval.decisions.forEach((v, k) => decisions.set(k, v));
    }
    return { value: ev, decisions };
  }

  if (node.type === 'decision') {
    // Pick the best option
    let bestValue = -Infinity;
    let bestChild: DecisionNode | null = null;

    for (const child of node.children) {
      const childEval = evaluateNode(child);
      if (childEval.value > bestValue) {
        bestValue = childEval.value;
        bestChild = child;
        // Clear and set new decisions
        decisions.clear();
        childEval.decisions.forEach((v, k) => decisions.set(k, v));
      }
    }

    if (bestChild) {
      decisions.set(node.id, bestChild.id);
    }

    return { value: bestValue, decisions };
  }

  return { value: 0, decisions };
}

function findOptimalPath(root: DecisionNode, decisions: Map<string, string>): string[] {
  const path: string[] = [root.id];
  let current = root;

  while (current.children && current.children.length > 0) {
    if (current.type === 'decision') {
      const chosenId = decisions.get(current.id);
      const chosen = current.children.find(c => c.id === chosenId);
      if (chosen) {
        path.push(chosen.id);
        current = chosen;
      } else {
        break;
      }
    } else {
      // For chance nodes, show all possible outcomes
      break;
    }
  }

  return path;
}

function enumerateDecisionTreePaths(
  root: DecisionNode
): Array<{ path: string[]; expectedValue: number; probability: number }> {
  const paths = enumeratePaths(root, [], 1);
  // Normalize: keep only valid probabilities (0..1)
  return paths.map(p => ({
    path: p.path,
    expectedValue: p.expectedValue,
    probability: Math.max(0, Math.min(1, p.probability)),
  }));
}

function enumeratePaths(
  node: DecisionNode,
  path: string[],
  probability: number
): Array<{ path: string[]; expectedValue: number; probability: number }> {
  const nextPath = [...path, node.id];

  if (node.type === 'terminal' || !node.children || node.children.length === 0) {
    return [{ path: nextPath, expectedValue: node.value || 0, probability }];
  }

  if (node.type === 'chance') {
    return node.children.flatMap(child =>
      enumeratePaths(child, nextPath, probability * (child.probability ?? 0))
    );
  }

  // Decision node: explore all decision branches (probability stays the same)
  return node.children.flatMap(child => enumeratePaths(child, nextPath, probability));
}

// =============================================================================
// SYSTEMS THINKING
// =============================================================================

import type {
  SystemComponent,
  LeveragePoint,
  SystemsAnalysisResult,
} from '../types.js';

/**
 * Identify leverage points in a system
 *
 * Based on Donella Meadows' 12 Leverage Points
 *
 * @param components - System components to analyze
 * @param situation - Description of the situation
 * @returns Identified leverage points ranked by effectiveness
 */
export async function identifyLeveragePoints(
  components: SystemComponent[],
  situation: string
): Promise<LeveragePoint[]> {
  const leveragePoints: LeveragePoint[] = [];

  // Analyze feedback loops
  const feedbackLoops = components.filter(c => c.type === 'feedback');
  if (feedbackLoops.length > 0) {
    leveragePoints.push({
      level: 7,
      name: 'Reinforcing feedback loops',
      description: 'Strengthen or weaken system feedback loops',
      effectiveness: 'high',
      difficulty: 'moderate',
      examples: feedbackLoops.map(f => f.name),
      application: `Found ${feedbackLoops.length} feedback loops that could be strengthened or weakened`,
      relatedComponents: feedbackLoops.map(f => f.id),
    });
  }

  // Analyze delays
  const delays = components.filter(c => c.type === 'delay');
  if (delays.length > 0) {
    leveragePoints.push({
      level: 9,
      name: 'Delays',
      description: 'Adjust timing of information and material flows',
      effectiveness: 'medium',
      difficulty: 'moderate',
      examples: delays.map(d => d.name),
      application: `Found ${delays.length} delays that could be adjusted`,
      relatedComponents: delays.map(d => d.id),
    });
  }

  // Analyze stocks and flows
  const stocks = components.filter(c => c.type === 'stock');
  const flows = components.filter(c => c.type === 'flow');

  if (stocks.length > 0) {
    leveragePoints.push({
      level: 10,
      name: 'Stock and flow structures',
      description: 'Modify physical structure of flows and stocks',
      effectiveness: 'low',
      difficulty: 'hard',
      examples: stocks.map(s => s.name),
      application: `System has ${stocks.length} stocks and ${flows.length} flows`,
      relatedComponents: [...stocks.map(s => s.id), ...flows.map(f => f.id)],
    });
  }

  // Sort by effectiveness (lower level = higher leverage)
  leveragePoints.sort((a, b) => a.level - b.level);

  eventBus.emit('audit:log', {
    action: 'cognition:leverage_points_identified',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      situation: situation.substring(0, 100),
      leveragePointsFound: leveragePoints.length,
      topLeverageLevel: leveragePoints[0]?.level,
      framework: 'Systems Thinking',
    },
  });

  return leveragePoints;
}

/**
 * Analyze a system for feedback loops and structure
 */
export async function analyzeSystem(
  components: SystemComponent[],
  situation: string
): Promise<SystemsAnalysisResult> {
  const leveragePoints = await identifyLeveragePoints(components, situation);

  // Build connection graph - extract target IDs from connections
  const connections: Map<string, string[]> = new Map();
  for (const component of components) {
    connections.set(component.id, component.connections.map(c => c.targetId));
  }

  // Detect cycles (feedback loops)
  const cycles = detectCycles(connections);

  // Identify delays
  const delays = components
    .flatMap(c =>
      c.connections
        .filter(conn => conn.relationship === 'delayed')
        .map(conn => ({
          source: c.id,
          target: conn.targetId,
          duration: 'unknown',
          impact: `Delayed connection from ${c.name}`,
        }))
    );

  return {
    system: situation,
    feedbackLoops: cycles.map(c => ({
      type: 'reinforcing' as const,
      components: c,
      description: `Loop: ${c.join(' → ')}`,
      dominance: c.length > 3 ? 'dominant' as const : 'secondary' as const,
    })),
    leveragePoints,
    delays,
    recommendations: leveragePoints.slice(0, 3).map(lp =>
      `Focus on ${lp.name}: ${lp.application}`
    ),
    warnings: [],
    provenance: {
      framework: 'Systems Thinking (Donella Meadows)',
      computedAt: new Date(),
    },
  };
}

function detectCycles(connections: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = connections.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of connections.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return cycles;
}

// =============================================================================
// ANTIFRAGILITY
// =============================================================================

import type { AntifragilityAnalysis, StressorEffect } from '../types.js';

/**
 * Assess antifragility of a system, strategy, or decision
 *
 * Based on Nassim Taleb's Antifragility framework
 *
 * @param item - What to assess
 * @param stressors - Potential stressors to analyze
 * @returns Antifragility assessment
 */
export async function assessAntifragility(
  item: string,
  stressors: Array<{
    stressor: string;
    effect: 'harms' | 'neutral' | 'benefits';
    magnitude?: number;
  }>
): Promise<AntifragilityAnalysis> {
  // Analyze each stressor
  const analyzedStressors: StressorEffect[] = stressors.map(s => {
    const effect = s.effect;
    const magnitude = s.magnitude || 0.5;

    return {
      stressor: s.stressor,
      effect,
      magnitude,
    };
  });

  // Calculate overall score
  // -1 = fragile, 0 = robust, +1 = antifragile
  const effects = analyzedStressors.map(s => {
    if (s.effect === 'benefits') return s.magnitude;
    if (s.effect === 'harms') return -s.magnitude;
    return 0;
  });

  const avgEffect = effects.reduce((a, b) => a + b, 0) / effects.length;

  // Determine category
  let category: 'fragile' | 'robust' | 'antifragile';
  if (avgEffect > 0.2) {
    category = 'antifragile';
  } else if (avgEffect < -0.2) {
    category = 'fragile';
  } else {
    category = 'robust';
  }

  // Calculate optionality (ability to benefit from upside)
  const upsideStressors = analyzedStressors.filter(s => s.effect === 'benefits');
  const optionality = upsideStressors.length / Math.max(1, stressors.length);

  // Calculate convexity (asymmetric payoff)
  const upside = upsideStressors.reduce((sum, s) => sum + s.magnitude, 0);
  const downside = analyzedStressors
    .filter(s => s.effect === 'harms')
    .reduce((sum, s) => sum + s.magnitude, 0);
  const convexity = upside > 0 ? upside / Math.max(0.1, downside) : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (category === 'fragile') {
    recommendations.push('Add redundancy to reduce single points of failure');
    recommendations.push('Create options that benefit from volatility');
    recommendations.push('Reduce exposure to tail risks');
  } else if (category === 'robust') {
    recommendations.push('Look for ways to benefit from stressors');
    recommendations.push('Maintain current resilience while exploring optionality');
  } else {
    recommendations.push('Continue leveraging volatility as a strength');
    recommendations.push('Ensure you\'re not over-exposed to any single stressor');
  }

  const result: AntifragilityAnalysis = {
    item,
    category,
    score: avgEffect,
    stressors: analyzedStressors,
    optionality: {
      score: optionality,
      options: upsideStressors.map(s => s.stressor),
      description: `${upsideStressors.length} beneficial stressors identified`,
    },
    convexity: {
      score: convexity - 1, // Normalize to -1 to 1 range
      description: convexity > 1 ? 'Asymmetric upside' : 'Limited upside',
      upside: `Potential gain from ${upsideStressors.length} positive stressors`,
      downside: `Risk from ${analyzedStressors.filter(s => s.effect === 'harms').length} negative stressors`,
    },
    recommendations,
    provenance: {
      framework: 'Antifragility (Taleb, 2012)',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:antifragility_assessed',
    agent: 'LOGOS',
    trustLevel: 'system',
    details: {
      item,
      category,
      score: avgEffect,
      framework: 'Antifragility',
    },
  });

  return result;
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  Belief,
  Evidence,
  BayesianUpdate,
  Decision,
  Outcome,
  ExpectedValueResult,
  KellyInput,
  KellyResult,
  DecisionNode,
  DecisionTreeResult,
  SystemComponent,
  LeveragePoint,
  SystemsAnalysisResult,
  AntifragilityAnalysis,
};
