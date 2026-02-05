/* eslint-disable @typescript-eslint/require-await */
/**
 * PATHOS Pillar — The Domain of Growth
 *
 * Note: Functions are async for future extensibility (database lookups, API calls).
 *
 * PATHOS provides ARI with therapeutic and self-improvement capabilities:
 *
 * - **CBT Reframing**: Identify and reframe cognitive distortions
 * - **Stoic Philosophy**: Dichotomy of control and virtue ethics
 * - **Reflection Engine**: Extract insights from experiences
 * - **Wisdom Index**: Query curated wisdom across traditions
 * - **Meta-Learning**: Deliberate practice and skill development
 *
 * @module cognition/pathos
 * @pillar PATHOS (Growth)
 * @version 1.0.0
 */

import { EventBus } from '../../kernel/event-bus.js';
import type {
  CBTReframe,
  CognitiveDistortion,
  DichotomyAnalysis,
  VirtueCheck,
  ReflectionResult,
  Insight,
  WisdomResponse,
  WisdomTradition,
  PracticePlan,
  Outcome,
} from '../types.js';
import {
  DISTORTION_PATTERNS,
  WISDOM_PRINCIPLES,
  CARDINAL_VIRTUES,
} from '../constants.js';
import { CBTError, StoicError, ReflectionError, WisdomError } from '../errors.js';

// Module-level EventBus — defaults to private, can be replaced with shared bus
let eventBus = new EventBus();

/**
 * Replace the module-level EventBus with a shared instance.
 * Called by CognitionLayer.initialize() to connect PATHOS events to the kernel bus.
 */
export function setPathosEventBus(bus: EventBus): void {
  eventBus = bus;
}

// =============================================================================
// CBT REFRAMING
// =============================================================================

/**
 * Detect cognitive distortions and generate reframes
 *
 * Based on David Burns' 10 cognitive distortions from CBT.
 *
 * @param thought - The thought to analyze
 * @param context - Optional context for richer analysis
 * @returns Reframe with identified distortions
 */
export async function reframeThought(
  thought: string,
  context?: {
    situation?: string;
    evidence?: string[];
    historicalData?: unknown[];
  }
): Promise<CBTReframe> {
  if (!thought || thought.trim().length === 0) {
    throw new CBTError({ message: 'Thought cannot be empty', code: 'EMPTY_THOUGHT', context: { thought } });
  }

  const distortionsFound: Array<{
    type: CognitiveDistortion;
    severity: number;
    evidence: string[];
    triggerPhrases: string[];
  }> = [];

  // Detect distortions
  for (const [distortionType, config] of Object.entries(DISTORTION_PATTERNS)) {
    const matches = config.patterns.filter(p => p.test(thought));

    if (matches.length > 0) {
      const triggerPhrases = matches.map(m => {
        const match = thought.match(m);
        return match ? match[0] : '';
      }).filter(p => p.length > 0);

      distortionsFound.push({
        type: distortionType as CognitiveDistortion,
        severity: Math.min(1.0, matches.length * 0.35),
        evidence: matches.map(m => {
          const match = thought.match(m);
          return match ? `Found: "${match[0]}"` : 'Pattern match';
        }),
        triggerPhrases,
      });
    }
  }

  // Generate reframe
  let reframedThought = thought;
  let balancedPerspective = '';
  let actionable = '';

  if (distortionsFound.length > 0) {
    const primaryDistortion = distortionsFound.sort((a, b) => b.severity - a.severity)[0];
    const config = DISTORTION_PATTERNS[primaryDistortion.type];

    // Apply reframe strategy
    reframedThought = applyReframeStrategy(thought, primaryDistortion.type);
    balancedPerspective = config.reframeStrategy;
    actionable = generateCBTActionable(primaryDistortion.type);
  } else {
    reframedThought = thought;
    balancedPerspective = 'No cognitive distortions detected. Thought appears balanced.';
    actionable = 'Continue with this thought pattern.';
  }

  // Generate evidence for/against
  const evidenceFor: string[] = context?.evidence?.filter(e => e.includes('supports') || e.includes('confirms')) || [];
  const evidenceAgainst: string[] = context?.evidence?.filter(e => e.includes('contradicts') || e.includes('against')) || [];

  const result: CBTReframe = {
    originalThought: thought,
    distortionsDetected: distortionsFound,
    primaryDistortion: distortionsFound.length > 0 ? distortionsFound[0].type : undefined,
    reframedThought,
    balancedPerspective,
    evidenceFor,
    evidenceAgainst,
    actionable,
    provenance: {
      framework: 'Cognitive Behavioral Therapy (Beck, 1960s)',
      computedAt: new Date(),
    },
  };

  // Emit event
  if (distortionsFound.length > 0) {
    eventBus.emit('audit:log', {
      action: 'cognition:thought_reframed',
      agent: 'PATHOS',
      trustLevel: 'system',
      details: {
        distortions: distortionsFound.map(d => d.type),
        originalLength: thought.length,
        framework: 'CBT Reframing',
      },
    });
  }

  return result;
}

function applyReframeStrategy(thought: string, distortion: CognitiveDistortion): string {
  const strategies: Record<CognitiveDistortion, (t: string) => string> = {
    ALL_OR_NOTHING: (t) => t
      .replace(/\b(completely|totally|entirely)\b/gi, 'partially')
      .replace(/\b(always|never)\b/gi, 'sometimes')
      .replace(/\bruined\b/gi, 'affected'),
    OVERGENERALIZATION: (t) => t
      .replace(/\bthis always happens\b/gi, 'this happened this time')
      .replace(/\beveryone\b/gi, 'some people')
      .replace(/\bno one\b/gi, 'few people'),
    MENTAL_FILTER: (t) => t + ' However, there were also positive aspects worth noting.',
    CATASTROPHIZING: (t) => t
      .replace(/\b(disaster|catastrophe|the end)\b/gi, 'challenge')
      .replace(/\bworst (thing|case)\b/gi, 'difficult situation')
      .replace(/\b(can't|won't) (survive|recover|handle)\b/gi, 'will find a way to manage'),
    DISQUALIFYING_POSITIVE: (t) => t + ' This success is meaningful and worth acknowledging.',
    MIND_READING: (t) => t
      .replace(/\bthey think\b/gi, 'I imagine they might think')
      .replace(/\beveryone knows\b/gi, 'some people might notice'),
    FORTUNE_TELLING: (t) => t
      .replace(/\bwill definitely\b/gi, 'might')
      .replace(/\bthere's no (point|chance)\b/gi, 'the outcome is uncertain'),
    EMOTIONAL_REASONING: (t) => t
      .replace(/\bI feel like I'm\b/gi, "I feel like I'm, but objectively I")
      .replace(/\bmust be true because I feel\b/gi, 'I feel this way, but the evidence shows'),
    SHOULD_STATEMENTS: (t) => t
      .replace(/\bI should\b/gi, 'I would like to')
      .replace(/\bI have to\b/gi, 'I choose to')
      .replace(/\bI must\b/gi, 'I prefer to'),
    PERSONALIZATION: (t) => t
      .replace(/\bmy fault\b/gi, 'one of many factors')
      .replace(/\bbecause of me\b/gi, 'partly related to my actions and other factors'),
  };

  return strategies[distortion]?.(thought) || thought;
}

function generateCBTActionable(distortion: CognitiveDistortion): string {
  const actions: Record<CognitiveDistortion, string> = {
    ALL_OR_NOTHING: 'Rate the situation on a scale of 1-10 instead of pass/fail',
    OVERGENERALIZATION: 'Count actual instances - how many times has this really happened?',
    MENTAL_FILTER: 'Write down three things that went well today',
    CATASTROPHIZING: 'Write out best case, worst case, and most likely case scenarios',
    DISQUALIFYING_POSITIVE: 'Accept the compliment or success at face value',
    MIND_READING: 'Ask the person directly what they think instead of assuming',
    FORTUNE_TELLING: 'List evidence for and against this prediction',
    EMOTIONAL_REASONING: "Separate feelings from facts - what would a neutral observer say?",
    SHOULD_STATEMENTS: 'Replace "should" with "would prefer" and notice how it feels',
    PERSONALIZATION: 'List all factors that contributed, not just your own',
  };

  return actions[distortion] || 'Examine the evidence for and against this thought';
}

// =============================================================================
// STOIC PHILOSOPHY
// =============================================================================

/**
 * Analyze a situation using the Dichotomy of Control
 *
 * Based on Epictetus's fundamental Stoic principle.
 *
 * @param situation - The situation to analyze
 * @param elements - Elements to categorize as controllable or uncontrollable
 * @returns Dichotomy analysis with focus recommendations
 */
export async function analyzeDichotomy(
  situation: string,
  elements: Array<{
    item: string;
    category?: 'controllable' | 'uncontrollable';
  }>
): Promise<DichotomyAnalysis> {
  if (!situation || situation.trim().length === 0) {
    throw new StoicError({ message: 'Situation cannot be empty', code: 'EMPTY_SITUATION', context: { situation } });
  }

  const controllable: Array<{
    item: string;
    actionable: string;
    effort: number;
    impact: number;
    priority: number;
  }> = [];

  const uncontrollable: Array<{
    item: string;
    acceptance: string;
    wastedEnergy: number;
  }> = [];

  let priorityIndex = 1;
  for (const element of elements) {
    // Auto-categorize if not specified
    const category = element.category || categorizeElement(element.item);

    if (category === 'controllable') {
      const effort = estimateEffort(element.item);
      const impact = estimateImpact(element.item);
      controllable.push({
        item: element.item,
        actionable: generateActionable(element.item),
        effort,
        impact,
        priority: priorityIndex++,
      });
    } else {
      uncontrollable.push({
        item: element.item,
        acceptance: generateAcceptance(element.item),
        wastedEnergy: estimateWastedEnergy(element.item),
      });
    }
  }

  function estimateImpact(item: string): number {
    // Higher impact for items with significant keywords
    const highImpactPatterns = [/important/i, /critical/i, /key/i, /major/i, /significant/i];
    const matches = highImpactPatterns.filter(p => p.test(item)).length;
    return Math.min(1, 0.5 + matches * 0.2);
  }

  // Determine focus and release areas
  const focusArea = controllable.length > 0
    ? controllable.sort((a, b) => b.effort - a.effort)[0].item
    : 'There are no controllable elements - focus on your response and attitude';

  const releaseArea = uncontrollable.length > 0
    ? uncontrollable.sort((a, b) => b.wastedEnergy - a.wastedEnergy)[0].item
    : 'Good - no uncontrollable elements identified';

  // Select relevant Stoic quote
  const stoicQuote = selectStoicQuote(situation, controllable.length, uncontrollable.length);

  // Calculate total wasted energy
  const totalWastedEnergy = uncontrollable.reduce((sum, u) => sum + u.wastedEnergy, 0);

  // Generate action plan
  const actionPlan = controllable
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(c => c.actionable);

  const result: DichotomyAnalysis = {
    situation,
    controllable,
    uncontrollable,
    totalWastedEnergy,
    recommendation: generateDichotomyRecommendation(controllable, uncontrollable),
    focusArea,
    releaseArea,
    actionPlan,
    stoicQuote,
    provenance: {
      framework: 'Dichotomy of Control (Epictetus, ~125 AD)',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:dichotomy_analyzed',
    agent: 'PATHOS',
    trustLevel: 'system',
    details: {
      situation: situation.substring(0, 100),
      controllableCount: controllable.length,
      uncontrollableCount: uncontrollable.length,
      framework: 'Stoic Dichotomy',
    },
  });

  return result;
}

function categorizeElement(item: string): 'controllable' | 'uncontrollable' {
  // Common uncontrollable patterns
  const uncontrollablePatterns = [
    /\b(other people|their|they|market|economy|weather|past|history)\b/i,
    /\b(outcome|result|consequence|reputation|opinion)\b/i,
    /\b(luck|fate|chance|random)\b/i,
  ];

  // Common controllable patterns
  const controllablePatterns = [
    /\b(my|our|I|we)\b/i,
    /\b(effort|action|decision|choice|response|attitude|preparation)\b/i,
    /\b(practice|study|work|train|improve)\b/i,
  ];

  const isUncontrollable = uncontrollablePatterns.some(p => p.test(item));
  const isControllable = controllablePatterns.some(p => p.test(item));

  if (isUncontrollable && !isControllable) return 'uncontrollable';
  if (isControllable && !isUncontrollable) return 'controllable';

  // Default to controllable if mentions "my" or "I", otherwise uncontrollable
  return /\b(my|I|our|we)\b/i.test(item) ? 'controllable' : 'uncontrollable';
}

function generateActionable(item: string): string {
  return `Take concrete action: ${item.toLowerCase()}`;
}

function generateAcceptance(item: string): string {
  return `Accept and release: ${item.toLowerCase()} is outside your control`;
}

function estimateEffort(item: string): number {
  // Higher effort for things requiring more work
  if (/\b(major|significant|big|large|complete)\b/i.test(item)) return 0.8;
  if (/\b(moderate|some|partial)\b/i.test(item)) return 0.5;
  return 0.3;
}

function estimateWastedEnergy(item: string): number {
  // Higher wasted energy for things people commonly obsess over
  if (/\b(opinion|reputation|outcome|result)\b/i.test(item)) return 0.9;
  if (/\b(other people|they|their)\b/i.test(item)) return 0.7;
  return 0.4;
}

function selectStoicQuote(
  situation: string,
  controllableCount: number,
  uncontrollableCount: number
): { text: string; source: string; relevance: string } {
  if (uncontrollableCount > controllableCount) {
    return {
      text: "Make the best use of what is in your power, and take the rest as it happens.",
      source: "Epictetus, Enchiridion",
      relevance: "Many elements are outside your control - focus on what you can influence",
    };
  }

  if (/\b(fear|afraid|anxious|worried)\b/i.test(situation)) {
    return {
      text: "We suffer more often in imagination than in reality.",
      source: "Seneca, Letters from a Stoic",
      relevance: "The fear may be worse than the actual outcome",
    };
  }

  return {
    text: "The happiness of your life depends upon the quality of your thoughts.",
    source: "Marcus Aurelius, Meditations",
    relevance: "Your response to the situation matters more than the situation itself",
  };
}

function generateDichotomyRecommendation(
  controllable: Array<{ item: string; effort: number }>,
  uncontrollable: Array<{ item: string; wastedEnergy: number }>
): string {
  if (controllable.length === 0) {
    return 'Focus entirely on your internal response and attitude. Practice acceptance.';
  }

  if (uncontrollable.length === 0) {
    return 'All elements are within your control. Take decisive action.';
  }

  const highEffort = controllable.filter(c => c.effort > 0.6);
  const highWaste = uncontrollable.filter(u => u.wastedEnergy > 0.7);

  if (highWaste.length > 0) {
    return `Release energy spent on: ${highWaste.map(u => u.item).join(', ')}. Redirect to: ${controllable[0].item}`;
  }

  return `Focus energy on controllable elements, especially: ${highEffort[0]?.item || controllable[0].item}`;
}

/**
 * Check decision alignment with Stoic cardinal virtues
 */
export async function checkVirtueAlignment(
  decision: string,
  _context?: { situation?: string; stakeholders?: string[] }
): Promise<VirtueCheck> {
  type VirtueResult = {
    virtue: 'WISDOM' | 'COURAGE' | 'JUSTICE' | 'TEMPERANCE';
    aligned: boolean;
    score: number;
    reasoning: string;
    examples: string[];
  };

  const alignments: Record<string, VirtueResult> = {};

  for (const [virtue, config] of Object.entries(CARDINAL_VIRTUES)) {
    const { aligned, score, reasoning, examples } = assessVirtueAlignment(decision, virtue, config);
    alignments[virtue.toLowerCase()] = {
      virtue: virtue as 'WISDOM' | 'COURAGE' | 'JUSTICE' | 'TEMPERANCE',
      aligned,
      score,
      reasoning,
      examples,
    };
  }

  const scores = Object.values(alignments).map(a => a.score);
  const overallAlignment = scores.reduce((a, b) => a + b, 0) / scores.length;

  const conflicts = Object.entries(alignments)
    .filter(([_, a]) => !a.aligned)
    .map(([virtue, a]) => `${virtue}: ${a.reasoning}`);

  // Determine alignment level
  const alignmentLevel: 'EXEMPLARY' | 'GOOD' | 'MIXED' | 'POOR' =
    overallAlignment >= 0.8 ? 'EXEMPLARY' :
    overallAlignment >= 0.6 ? 'GOOD' :
    overallAlignment >= 0.4 ? 'MIXED' : 'POOR';

  // Generate improvements
  const improvements = conflicts.length > 0
    ? conflicts.map(c => `Improve ${c.split(':')[0]} alignment`)
    : ['Maintain current virtue alignment'];

  const result: VirtueCheck = {
    decision,
    virtueAlignment: {
      wisdom: alignments.wisdom,
      courage: alignments.courage,
      justice: alignments.justice,
      temperance: alignments.temperance,
    },
    overallAlignment,
    alignmentLevel,
    recommendation: overallAlignment > 0.7
      ? 'Decision aligns well with Stoic virtues'
      : 'Consider how to better align with: ' + conflicts.slice(0, 2).join('; '),
    conflicts,
    improvements,
    provenance: {
      framework: 'Stoic Virtue Ethics (Marcus Aurelius)',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:virtue_check',
    agent: 'PATHOS',
    trustLevel: 'system',
    details: {
      decision: decision.substring(0, 100),
      overallAlignment,
      conflicts: conflicts.length,
      framework: 'Virtue Ethics',
    },
  });

  return result;
}

function assessVirtueAlignment(
  decision: string,
  virtue: string,
  config: typeof CARDINAL_VIRTUES[keyof typeof CARDINAL_VIRTUES]
): { aligned: boolean; score: number; reasoning: string; examples: string[] } {
  const lowerDecision = decision.toLowerCase();

  // Check for manifestations of the virtue
  const positiveMatches = config.manifestations.filter(m =>
    lowerDecision.includes(m.toLowerCase())
  );

  // Check for opposites of the virtue
  const negativeMatches = config.opposites.filter(o =>
    lowerDecision.includes(o.toLowerCase())
  );

  const hasPositive = positiveMatches.length > 0;
  const hasNegative = negativeMatches.length > 0;

  let score = 0.5; // Neutral baseline
  let reasoning = '';
  const examples: string[] = [];

  if (hasPositive && !hasNegative) {
    score = 0.9;
    reasoning = `Decision demonstrates ${virtue.toLowerCase()}`;
    examples.push(...positiveMatches.map(m => `Shows ${m}`));
  } else if (hasNegative && !hasPositive) {
    score = 0.2;
    reasoning = `Decision may conflict with ${virtue.toLowerCase()}`;
    examples.push(...negativeMatches.map(m => `Includes ${m}`));
  } else if (hasPositive && hasNegative) {
    score = 0.5;
    reasoning = `Mixed signals regarding ${virtue.toLowerCase()}`;
    examples.push(`Positive: ${positiveMatches.join(', ')}`, `Concerning: ${negativeMatches.join(', ')}`);
  } else {
    score = 0.6;
    reasoning = `Neutral regarding ${virtue.toLowerCase()}`;
    examples.push('No explicit virtue indicators detected');
  }

  return {
    aligned: score >= 0.5,
    score,
    reasoning,
    examples,
  };
}

// =============================================================================
// REFLECTION ENGINE
// =============================================================================

/**
 * Reflect on an outcome to extract insights
 *
 * Based on Kolb's Learning Cycle (1984).
 *
 * @param outcome - The outcome to reflect on
 * @param context - Context about the decision and process
 * @returns Reflection with insights and principles
 */
export async function reflect(
  outcome: Outcome,
  context: {
    originalDecision: string;
    reasoning?: string;
    expectedOutcome?: string;
    expectedValue?: number;
    actualProcess?: string;
    timeframe?: string;
  }
): Promise<ReflectionResult> {
  if (!context.originalDecision) {
    throw new ReflectionError({ message: 'Original decision is required for reflection', code: 'MISSING_DECISION', context: { context } });
  }

  const insights: Insight[] = [];
  const principles: string[] = [];
  const whatWorked: string[] = [];
  const whatDidntWork: string[] = [];
  const nextActions: string[] = [];

  // Analyze outcome
  const isPositive = outcome.value > 0;
  const wasExpected = context.expectedOutcome
    ? outcome.description.toLowerCase().includes(context.expectedOutcome.toLowerCase())
    : null;

  // Generate insights based on outcome type
  if (isPositive) {
    whatWorked.push(`Decision "${context.originalDecision}" led to positive outcome`);

    if (context.reasoning) {
      insights.push({
        id: `insight-${Date.now()}-1`,
        type: 'SUCCESS',
        description: `Reasoning that worked: ${context.reasoning.substring(0, 200)}`,
        evidence: [outcome.description],
        actionable: 'Apply similar reasoning to future decisions',
        confidence: 0.8,
        generalizes: true,
        priority: 'MEDIUM',
        framework: 'Reflection Engine',
        timestamp: new Date(),
      });
    }

    principles.push('This approach works well in similar situations');
  } else {
    whatDidntWork.push(`Decision "${context.originalDecision}" led to negative outcome`);

    insights.push({
      id: `insight-${Date.now()}-2`,
      type: 'MISTAKE',
      description: `What went wrong: ${outcome.description}`,
      evidence: [context.originalDecision],
      actionable: 'Avoid or adjust this approach in future',
      confidence: 0.7,
      generalizes: wasExpected === false,
      priority: 'HIGH',
      framework: 'Reflection Engine',
      timestamp: new Date(),
    });

    nextActions.push('Review decision-making process');
    nextActions.push('Identify what could have been done differently');
  }

  // Pattern detection
  if (wasExpected === false) {
    insights.push({
      id: `insight-${Date.now()}-3`,
      type: 'PATTERN',
      description: 'Outcome differed from expectations',
      evidence: [
        `Expected: ${context.expectedOutcome}`,
        `Actual: ${outcome.description}`,
      ],
      actionable: 'Calibrate future predictions',
      confidence: 0.9,
      generalizes: true,
      priority: 'MEDIUM',
      framework: 'Reflection Engine',
      timestamp: new Date(),
    });
  }

  // Emotional processing
  const emotionalProcessing = isPositive
    ? 'Acknowledge the success without overconfidence. Extract the lessons.'
    : 'Process any negative emotions. Separate the outcome from your self-worth. Focus on learning.';

  const actualValue = outcome.value;
  const expectedValue = typeof context.expectedValue === 'number'
    ? context.expectedValue
    : (context.expectedOutcome ? (isPositive ? actualValue * 0.8 : actualValue * 1.2) : actualValue);
  const delta = actualValue - expectedValue;
  const lessonsLearned = principles.concat(
    insights.map(i => i.description.substring(0, 100))
  );

  const result: ReflectionResult = {
    outcomeId: `outcome-${Date.now()}`,
    action: context.originalDecision,
    result: isPositive ? 'success' : 'failure',
    expectedValue,
    actualValue,
    delta,
    insights,
    principles,
    whatWorked,
    whatDidntWork,
    nextActions,
    emotionalProcessing,
    lessonsLearned,
    provenance: {
      framework: 'Reflection Engine (Kolb Learning Cycle, 1984)',
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:reflection_complete',
    agent: 'PATHOS',
    trustLevel: 'system',
    details: {
      outcomeValue: outcome.value,
      insightsGenerated: insights.length,
      principlesExtracted: principles.length,
      framework: 'Reflection Engine',
    },
  });

  return result;
}

// =============================================================================
// WISDOM INDEX
// =============================================================================

/**
 * Query the wisdom index for relevant principles
 *
 * @param query - What wisdom is sought
 * @param traditions - Preferred wisdom traditions (optional)
 * @returns Relevant wisdom with application guidance
 */
export async function queryWisdom(
  query: string,
  traditions?: WisdomTradition[]
): Promise<WisdomResponse> {
  if (!query || query.trim().length === 0) {
    throw new WisdomError({ message: 'Query cannot be empty', code: 'EMPTY_QUERY', context: { query } });
  }

  const lowerQuery = query.toLowerCase();

  // Find relevant principles
  const relevantPrinciples = Object.entries(WISDOM_PRINCIPLES).flatMap(([tradition, config]) => {
    if (traditions && !traditions.includes(tradition as WisdomTradition)) {
      return [];
    }

    return config.corePrinciples.map(p => ({
      ...p,
      tradition: tradition as WisdomTradition,
      relevance: calculateRelevance(lowerQuery, { principle: p.principle, keywords: p.principle.toLowerCase().split(' ') }),
    }));
  });

  // Sort by relevance
  relevantPrinciples.sort((a, b) => b.relevance - a.relevance);

  // Get top match
  const topMatch = relevantPrinciples[0];

  if (!topMatch || topMatch.relevance < 0.1) {
    // Fallback to universal wisdom
    const universalPrinciple = WISDOM_PRINCIPLES.UNIVERSAL.corePrinciples[0];
    return {
      query,
      principle: universalPrinciple?.principle || 'Seek understanding before action',
      source: universalPrinciple?.source || 'Universal wisdom',
      application: 'Apply careful consideration to your situation',
      alternatives: [],
      confidence: 0.5,
      tradition: 'UNIVERSAL',
      provenance: {
        text: 'No specific match found - providing general guidance',
        indexedAt: new Date(),
      },
    };
  }

  const alternatives = relevantPrinciples
    .slice(1, 4)
    .filter(p => p.relevance > 0.3)
    .map(p => `${p.tradition}: ${p.principle}`);

  const result: WisdomResponse = {
    query,
    principle: topMatch.principle,
    source: topMatch.source,
    application: generateWisdomApplication(topMatch.application, query),
    alternatives,
    confidence: Math.min(0.95, topMatch.relevance + 0.3),
    tradition: topMatch.tradition,
    provenance: {
      text: `From ${topMatch.source}`,
      fetchedFrom: topMatch.tradition,
      indexedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:wisdom_consulted',
    agent: 'PATHOS',
    trustLevel: 'system',
    details: {
      query: query.substring(0, 100),
      tradition: topMatch.tradition,
      principle: topMatch.principle.substring(0, 50),
      framework: 'Wisdom Index',
    },
  });

  return result;
}

function calculateRelevance(
  query: string,
  principle: { principle: string; keywords: string[] }
): number {
  let relevance = 0;

  // Keyword matching
  for (const keyword of principle.keywords) {
    if (query.includes(keyword.toLowerCase())) {
      relevance += 0.2;
    }
  }

  // Principle text matching
  const principleWords = principle.principle.toLowerCase().split(/\s+/);
  const queryWords = query.split(/\s+/);

  for (const qWord of queryWords) {
    if (principleWords.some(pWord => pWord.includes(qWord) || qWord.includes(pWord))) {
      relevance += 0.1;
    }
  }

  return Math.min(1, relevance);
}

function generateWisdomApplication(
  application: string,
  query: string
): string {
  // Personalize the application based on query
  if (!application) {
    return `Apply this principle to your situation: ${query}`;
  }
  return application;
}

// =============================================================================
// META-LEARNING
// =============================================================================

/**
 * Generate a deliberate practice plan for skill development
 *
 * Based on K. Anders Ericsson's Deliberate Practice framework.
 *
 * @param skill - The skill to develop
 * @param currentLevel - Current skill level (0-1)
 * @param targetLevel - Target skill level (0-1)
 * @param constraints - Time and resource constraints
 * @returns Practice plan with milestones
 */
export async function generatePracticePlan(
  skill: string,
  currentLevel: number,
  targetLevel: number,
  constraints?: {
    hoursPerWeek?: number;
    weeks?: number;
    resources?: string[];
  }
): Promise<PracticePlan> {
  if (currentLevel < 0 || currentLevel > 1 || targetLevel < 0 || targetLevel > 1) {
    throw new Error('Skill levels must be between 0 and 1');
  }

  if (targetLevel <= currentLevel) {
    throw new Error('Target level must be higher than current level');
  }

  const gap = targetLevel - currentLevel;
  const hoursPerWeek = constraints?.hoursPerWeek || 5;
  // totalWeeks could be used for extended practice plans in the future
  // const totalWeeks = constraints?.weeks || Math.ceil(gap * 20);

  // Estimate hours needed (roughly 100 hours per 0.1 improvement)
  const estimatedHours = Math.ceil(gap * 1000);
  const actualWeeks = Math.ceil(estimatedHours / hoursPerWeek);

  // Generate specific goals
  const specificGoals = [
    {
      goal: `Improve ${skill} fundamentals`,
      metric: 'error rate',
      baseline: currentLevel,
      target: currentLevel + gap * 0.3,
    },
    {
      goal: `Develop ${skill} consistency`,
      metric: 'consistency score',
      baseline: currentLevel,
      target: currentLevel + gap * 0.6,
    },
    {
      goal: `Master ${skill} at target level`,
      metric: 'performance rating',
      baseline: currentLevel,
      target: targetLevel,
    },
  ];

  // Identify weaknesses to address
  const weaknessesToAddress = [
    `Initial unfamiliarity with advanced ${skill} techniques`,
    `Lack of feedback mechanisms`,
    `Inconsistent practice schedule`,
  ];

  // Practice schedule
  const practiceSchedule = {
    frequency: `${hoursPerWeek} hours per week`,
    duration: Math.round(hoursPerWeek / 3 * 60), // minutes per session
    timing: 'Consistent daily slots recommended',
  };

  // Feedback mechanisms
  const feedbackMechanism = [
    'Self-assessment after each session',
    'Weekly progress review',
    'Monthly skill evaluation',
    constraints?.resources?.includes('mentor')
      ? 'Regular mentor feedback'
      : 'Peer feedback when available',
  ];

  // Difficulty progression
  const difficultyProgression = Array.from({ length: Math.min(12, actualWeeks) }, (_, i) => ({
    week: i + 1,
    difficulty: i < 4 ? 'foundation' : i < 8 ? 'intermediate' : 'advanced',
    challenge: i < 4
      ? 'Master basics and build consistency'
      : i < 8
      ? 'Tackle increasingly complex challenges'
      : 'Push beyond comfort zone',
    focus: i < 4
      ? `Core ${skill} fundamentals`
      : i < 8
      ? `Intermediate ${skill} techniques`
      : `Advanced ${skill} mastery`,
  }));

  // Milestones
  const milestones = [
    {
      level: currentLevel + gap * 0.25,
      description: 'Fundamentals mastered',
      estimatedWeek: Math.ceil(actualWeeks * 0.25),
      criteria: ['Complete basic exercises', 'Pass foundation assessment'],
    },
    {
      level: currentLevel + gap * 0.5,
      description: 'Intermediate proficiency',
      estimatedWeek: Math.ceil(actualWeeks * 0.5),
      criteria: ['Apply skills in practice scenarios', 'Demonstrate consistency'],
    },
    {
      level: currentLevel + gap * 0.75,
      description: 'Advanced competency',
      estimatedWeek: Math.ceil(actualWeeks * 0.75),
      criteria: ['Handle complex challenges', 'Teach basics to others'],
    },
    {
      level: targetLevel,
      description: 'Target level achieved',
      estimatedWeek: actualWeeks,
      criteria: ['Achieve target skill level', 'Demonstrate mastery under pressure'],
    },
  ];

  // Identify strengths to leverage
  const strengthsToLeverage = [
    `Existing foundation at level ${currentLevel.toFixed(1)}`,
    'Commitment to deliberate practice',
    constraints?.resources ? `Available resources: ${constraints.resources.join(', ')}` : 'Self-motivation',
  ];

  // Identify potential obstacles
  const potentialObstacles = [
    'Inconsistent practice schedule',
    'Plateaus in skill development',
    'Lack of immediate feedback',
    'Competing priorities',
  ];

  // Motivational strategies
  const motivationalStrategies = [
    'Track progress weekly to visualize improvement',
    'Celebrate milestone achievements',
    'Connect practice to long-term goals',
    'Use accountability partners or communities',
    'Remember why you started when motivation drops',
  ];

  const result: PracticePlan = {
    skill,
    currentLevel,
    targetLevel,
    gap,
    estimatedHours,
    timeframe: `${actualWeeks} weeks`,
    specificGoals,
    weaknessesToAddress,
    strengthsToLeverage,
    potentialObstacles,
    practiceSchedule,
    feedbackMechanism,
    difficultyProgression,
    milestones,
    motivationalStrategies,
    resources: constraints?.resources || ['Self-study', 'Online resources'],
    provenance: {
      framework: 'Deliberate Practice (Ericsson, 2016)',
      principles: [
        'Focused attention on specific aspects',
        'Immediate feedback',
        'Pushing beyond comfort zone',
        'Consistent practice schedule',
      ],
      computedAt: new Date(),
    },
  };

  eventBus.emit('audit:log', {
    action: 'cognition:practice_plan_created',
    agent: 'PATHOS',
    trustLevel: 'system',
    details: {
      skill,
      currentLevel,
      targetLevel,
      estimatedHours,
      weeks: actualWeeks,
      framework: 'Deliberate Practice',
    },
  });

  return result;
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  CBTReframe,
  CognitiveDistortion,
  DichotomyAnalysis,
  VirtueCheck,
  ReflectionResult,
  Insight,
  WisdomResponse,
  WisdomTradition,
  PracticePlan,
  Outcome,
};
