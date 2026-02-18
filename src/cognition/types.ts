/**
 * ARI Cognitive Layer 0: Type Definitions
 *
 * This file contains all Zod schemas and TypeScript types for the cognitive layer.
 * Organized by pillar: LOGOS (Reason), ETHOS (Character), PATHOS (Growth)
 *
 * @module cognition/types
 * @version 1.0.0
 */

import { z } from 'zod';

// =============================================================================
// LAYER 0 EVENT EMITTER — keeps L0 self-contained (no kernel imports)
// =============================================================================

/**
 * Minimal event emitter interface for Layer 0 cognitive code.
 * Accepts the real EventBus (L1) at runtime via dependency injection,
 * but L0 only depends on this local interface — no kernel imports.
 */
export interface CognitiveEventEmitter {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
}

/** No-op emitter used when no bus is provided at construction time. */
const NOOP_EMITTER: CognitiveEventEmitter = {
  emit: () => undefined,
  on: () => () => undefined,
};

export function createNoopEmitter(): CognitiveEventEmitter {
  return NOOP_EMITTER;
}

// =============================================================================
// COMMON TYPES
// =============================================================================

/**
 * Cognitive pillar identifiers
 */
export const PillarSchema = z.enum(['LOGOS', 'ETHOS', 'PATHOS']);
export type Pillar = z.infer<typeof PillarSchema>;

/**
 * Provenance tracking for all cognitive outputs
 */
export const ProvenanceSchema = z.object({
  framework: z.string(),
  computedAt: z.date(),
  version: z.string().optional(),
  source: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/**
 * Generic cognitive result wrapper
 */
export const CognitiveResultSchema = z.object({
  pillar: PillarSchema,
  framework: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
  provenance: ProvenanceSchema,
  educationalNote: z.string().optional(),
});
export type CognitiveResult = z.infer<typeof CognitiveResultSchema>;

// =============================================================================
// LOGOS: REASON PILLAR
// =============================================================================

// -----------------------------------------------------------------------------
// Bayesian Reasoning
// -----------------------------------------------------------------------------

/**
 * A belief or hypothesis with probability
 */
export const BeliefSchema = z.object({
  hypothesis: z.string().min(1),
  priorProbability: z.number().min(0).max(1),
  description: z.string().optional(),
  lastUpdated: z.date().optional(),
  confidenceInterval: z
    .object({
      lower: z.number().min(0).max(1),
      upper: z.number().min(0).max(1),
    })
    .optional(),
});
export type Belief = z.infer<typeof BeliefSchema>;

/**
 * Evidence that affects a belief
 */
export const EvidenceSchema = z.object({
  description: z.string().min(1),
  likelihoodRatio: z.number().positive(),
  strength: z.enum(['weak', 'moderate', 'strong']),
  source: z.string().optional(),
  timestamp: z.date().optional(),
  reliability: z.number().min(0).max(1).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Result of a Bayesian belief update
 */
export const BayesianUpdateSchema = z.object({
  hypothesis: z.string(),
  priorProbability: z.number(),
  posteriorProbability: z.number(),
  evidenceUsed: z.array(EvidenceSchema),
  shift: z.number(),
  shiftDirection: z.enum(['increased', 'decreased', 'unchanged']),
  interpretation: z.string(),
  confidence: z.number().min(0).max(1),
  provenance: z.object({
    framework: z.literal('Bayesian Reasoning (Bayes, 1763)'),
    computedAt: z.date(),
  }),
});
export type BayesianUpdate = z.infer<typeof BayesianUpdateSchema>;

// -----------------------------------------------------------------------------
// Expected Value
// -----------------------------------------------------------------------------

/**
 * A possible outcome of a decision
 */
export const OutcomeSchema = z.object({
  description: z.string().min(1),
  probability: z.number().min(0).max(1),
  value: z.number(),
  confidence: z.number().min(0).max(1).optional(),
  timeframe: z.string().optional(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

/**
 * A decision to be evaluated
 */
export const DecisionSchema = z.object({
  description: z.string().min(1),
  outcomes: z.array(OutcomeSchema).min(1),
  context: z.record(z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  deadline: z.date().optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;

/**
 * Expected value calculation result
 */
export const ExpectedValueResultSchema = z.object({
  decision: z.string(),
  expectedValue: z.number(),
  variance: z.number(),
  standardDeviation: z.number(),
  coefficientOfVariation: z.number(),
  outcomes: z.array(OutcomeSchema),
  bestCase: OutcomeSchema,
  worstCase: OutcomeSchema,
  mostLikelyCase: OutcomeSchema,
  breakEvenProbability: z.number().optional(),
  sensitivityAnalysis: z
    .object({
      mostCriticalOutcome: z.string(),
      breakEvenPoint: z.number().optional(),
    })
    .optional(),
  recommendation: z.enum(['PROCEED', 'CAUTION', 'AVOID']),
  reasoning: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  provenance: z.object({
    framework: z.literal('Expected Value Theory'),
    computedAt: z.date(),
  }),
});
export type ExpectedValueResult = z.infer<typeof ExpectedValueResultSchema>;

/**
 * Ranked decision for comparing alternatives
 */
export const RankedDecisionSchema = ExpectedValueResultSchema.extend({
  rank: z.number().int().positive(),
  relativeStrength: z.number(),
});
export type RankedDecision = z.infer<typeof RankedDecisionSchema>;

// -----------------------------------------------------------------------------
// Kelly Criterion
// -----------------------------------------------------------------------------

/**
 * Input for Kelly Criterion calculation
 */
export const KellyInputSchema = z.object({
  winProbability: z.number().min(0).max(1),
  winAmount: z.number().positive(),
  lossAmount: z.number().positive(),
  currentCapital: z.number().positive().optional(),
  maxRiskTolerance: z.number().min(0).max(1).optional(),
});
export type KellyInput = z.infer<typeof KellyInputSchema>;

/**
 * Kelly Criterion calculation result
 */
export const KellyResultSchema = z.object({
  fullKelly: z.number(),
  halfKelly: z.number(),
  quarterKelly: z.number(),
  recommendedFraction: z.number(),
  recommendedStrategy: z.enum(['full', 'half', 'quarter', 'avoid']),
  edge: z.number(),
  odds: z.number(),
  expectedGrowthRate: z.number(),
  riskOfRuin: z.number().optional(),
  warnings: z.array(z.string()),
  dollarAmount: z.number().optional(),
  provenance: z.object({
    framework: z.literal('Kelly Criterion (Kelly, 1956)'),
    computedAt: z.date(),
  }),
});
export type KellyResult = z.infer<typeof KellyResultSchema>;

/**
 * Risk of ruin simulation result
 */
export const RiskOfRuinResultSchema = z.object({
  riskOfRuin: z.number(),
  medianEndingCapital: z.number(),
  percentile5: z.number(),
  percentile25: z.number(),
  percentile75: z.number(),
  percentile95: z.number(),
  maxDrawdown: z.number(),
  iterations: z.number(),
  betsSimulated: z.number(),
});
export type RiskOfRuinResult = z.infer<typeof RiskOfRuinResultSchema>;

// -----------------------------------------------------------------------------
// Decision Trees
// -----------------------------------------------------------------------------

/**
 * Node in a decision tree
 */
export interface DecisionNode {
  id: string;
  type: 'decision' | 'chance' | 'terminal';
  description: string;
  probability?: number;
  value?: number;
  children?: DecisionNode[];
}

export const DecisionNodeSchema: z.ZodType<DecisionNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(['decision', 'chance', 'terminal']),
    description: z.string(),
    probability: z.number().min(0).max(1).optional(),
    value: z.number().optional(),
    children: z.array(DecisionNodeSchema).optional(),
  })
);

/**
 * Decision tree analysis result
 */
export const DecisionTreeResultSchema = z.object({
  rootNode: DecisionNodeSchema,
  optimalPath: z.array(z.string()),
  optimalValue: z.number(),
  allPaths: z.array(
    z.object({
      path: z.array(z.string()),
      expectedValue: z.number(),
      probability: z.number(),
    })
  ),
  sensitivityAnalysis: z
    .array(
      z.object({
        nodeId: z.string(),
        impact: z.number(),
      })
    )
    .optional(),
  provenance: z.object({
    framework: z.literal('Decision Tree Analysis (Backward Induction)'),
    computedAt: z.date(),
  }),
});
export type DecisionTreeResult = z.infer<typeof DecisionTreeResultSchema>;

// -----------------------------------------------------------------------------
// Systems Thinking
// -----------------------------------------------------------------------------

/**
 * Component in a system
 */
export const SystemComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['stock', 'flow', 'feedback', 'delay', 'external']),
  description: z.string(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  connections: z.array(
    z.object({
      targetId: z.string(),
      relationship: z.enum(['positive', 'negative', 'delayed']),
      strength: z.number().min(0).max(1),
    })
  ),
});
export type SystemComponent = z.infer<typeof SystemComponentSchema>;

/**
 * System definition for analysis
 */
export const SystemDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  components: z.array(SystemComponentSchema),
  boundaries: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
});
export type SystemDefinition = z.infer<typeof SystemDefinitionSchema>;

/**
 * Leverage point identified in a system (Meadows' 12 leverage points)
 */
export const LeveragePointSchema = z.object({
  level: z.number().int().min(1).max(12),
  name: z.string(),
  description: z.string(),
  effectiveness: z.enum(['low', 'medium', 'high', 'transformative']),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'very_hard']),
  examples: z.array(z.string()),
  application: z.string(),
  relatedComponents: z.array(z.string()),
});
export type LeveragePoint = z.infer<typeof LeveragePointSchema>;

/**
 * Systems thinking analysis result
 */
export const SystemsAnalysisResultSchema = z.object({
  system: z.string(),
  feedbackLoops: z.array(
    z.object({
      type: z.enum(['reinforcing', 'balancing']),
      components: z.array(z.string()),
      description: z.string(),
      dominance: z.enum(['dominant', 'secondary', 'latent']),
    })
  ),
  leveragePoints: z.array(LeveragePointSchema),
  delays: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      duration: z.string(),
      impact: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
  warnings: z.array(z.string()),
  provenance: z.object({
    framework: z.literal('Systems Thinking (Donella Meadows)'),
    computedAt: z.date(),
  }),
});
export type SystemsAnalysisResult = z.infer<typeof SystemsAnalysisResultSchema>;

// -----------------------------------------------------------------------------
// Antifragility
// -----------------------------------------------------------------------------

/**
 * Stressor and its effect on an item
 */
export const StressorEffectSchema = z.object({
  stressor: z.string(),
  effect: z.enum(['harms', 'neutral', 'benefits']),
  magnitude: z.number().min(-1).max(1),
  mechanism: z.string().optional(),
});
export type StressorEffect = z.infer<typeof StressorEffectSchema>;

/**
 * Antifragility analysis result
 */
export const AntifragilityAnalysisSchema = z.object({
  item: z.string(),
  category: z.enum(['fragile', 'robust', 'antifragile']),
  score: z.number().min(-1).max(1),
  stressors: z.array(StressorEffectSchema),
  optionality: z.object({
    score: z.number().min(0).max(1),
    options: z.array(z.string()),
    description: z.string(),
  }),
  convexity: z.object({
    score: z.number().min(-1).max(1),
    description: z.string(),
    upside: z.string(),
    downside: z.string(),
  }),
  barbell: z
    .object({
      safeComponent: z.string(),
      riskyComponent: z.string(),
      allocation: z.object({
        safe: z.number(),
        risky: z.number(),
      }),
    })
    .optional(),
  recommendations: z.array(z.string()),
  provenance: z.object({
    framework: z.literal('Antifragility (Taleb, 2012)'),
    computedAt: z.date(),
  }),
});
export type AntifragilityAnalysis = z.infer<typeof AntifragilityAnalysisSchema>;

// =============================================================================
// ETHOS: CHARACTER PILLAR
// =============================================================================

// -----------------------------------------------------------------------------
// Cognitive Bias Detection
// -----------------------------------------------------------------------------

/**
 * The 10 cognitive biases ARI detects
 */
export const CognitiveBiasSchema = z.enum([
  'CONFIRMATION_BIAS',
  'SUNK_COST_FALLACY',
  'RECENCY_BIAS',
  'LOSS_AVERSION',
  'OVERCONFIDENCE',
  'ANCHORING',
  'AVAILABILITY_HEURISTIC',
  'HINDSIGHT_BIAS',
  'GAMBLERS_FALLACY',
  'DUNNING_KRUGER',
]);
export type CognitiveBias = z.infer<typeof CognitiveBiasSchema>;

/**
 * Single bias detection result
 */
export const BiasDetectionSchema = z.object({
  type: CognitiveBiasSchema,
  detected: z.boolean(),
  severity: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  patterns: z.array(z.string()),
  mitigation: z.string(),
  source: z.string(),
});
export type BiasDetection = z.infer<typeof BiasDetectionSchema>;

/**
 * Complete bias analysis result
 */
export const BiasAnalysisSchema = z.object({
  reasoning: z.string(),
  biasesDetected: z.array(BiasDetectionSchema),
  biasesChecked: z.array(CognitiveBiasSchema),
  overallRisk: z.number().min(0).max(1),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
  recommendations: z.array(z.string()),
  debiasedReasoning: z.string().optional(),
  provenance: z.object({
    framework: z.literal('Cognitive Bias Detection (Kahneman & Tversky)'),
    computedAt: z.date(),
  }),
});
export type BiasAnalysis = z.infer<typeof BiasAnalysisSchema>;

// -----------------------------------------------------------------------------
// Emotional State (VAD Model)
// -----------------------------------------------------------------------------

/**
 * Emotional state using Russell's Circumplex Model (VAD)
 */
export const EmotionalStateSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  dominance: z.number().min(0).max(1),
  emotions: z.array(z.string()),
  primaryEmotion: z.string(),
  intensity: z.number().min(0).max(1),
  stability: z.enum(['stable', 'fluctuating', 'volatile']),
  riskToDecisionQuality: z.number().min(0).max(1),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
  recommendations: z.array(z.string()),
  coolingOffPeriod: z.string().optional(),
  provenance: z.object({
    framework: z.literal("Russell's Circumplex Model (VAD)"),
    computedAt: z.date(),
  }),
});
export type EmotionalState = z.infer<typeof EmotionalStateSchema>;

/**
 * Context for emotional state assessment
 */
export const EmotionalContextSchema = z.object({
  recentOutcomes: z
    .array(
      z.object({
        description: z.string(),
        result: z.enum(['success', 'failure', 'partial']),
        value: z.number().optional(),
        timestamp: z.date(),
      })
    )
    .optional(),
  currentStressors: z.array(z.string()).optional(),
  sleepQuality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
  lastMealTime: z.date().optional(),
  physicalState: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
});
export type EmotionalContext = z.infer<typeof EmotionalContextSchema>;

// -----------------------------------------------------------------------------
// Fear/Greed Cycle Detection
// -----------------------------------------------------------------------------

/**
 * Fear/greed pattern types
 */
export const FearGreedPatternSchema = z.enum([
  'FEAR_SPIRAL',
  'GREED_CHASE',
  'REVENGE_TRADING',
  'EUPHORIA',
  'PANIC_SELLING',
  'FOMO',
  'NONE',
]);
export type FearGreedPattern = z.infer<typeof FearGreedPatternSchema>;

/**
 * Fear/greed cycle detection result
 */
export const FearGreedCycleSchema = z.object({
  pattern: FearGreedPatternSchema,
  detected: z.boolean(),
  severity: z.number().min(0).max(1),
  phase: z.enum(['early', 'mid', 'late', 'none']),
  evidence: z.array(z.string()),
  triggers: z.array(z.string()),
  behavioralSigns: z.array(z.string()),
  recommendation: z.string(),
  interventions: z.array(z.string()),
  expectedDuration: z.string().optional(),
  provenance: z.object({
    framework: z.literal('Trading Psychology (Mark Douglas)'),
    computedAt: z.date(),
  }),
});
export type FearGreedCycle = z.infer<typeof FearGreedCycleSchema>;

// -----------------------------------------------------------------------------
// Discipline System
// -----------------------------------------------------------------------------

/**
 * Physical state check
 */
export const PhysicalCheckSchema = z.object({
  sleep: z.object({
    adequate: z.boolean(),
    hours: z.number().optional(),
    quality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
  }),
  nutrition: z.object({
    adequate: z.boolean(),
    lastMeal: z.date().optional(),
    hydration: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
  }),
  exercise: z.object({
    recent: z.boolean(),
    lastActivity: z.date().optional(),
  }),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()),
});
export type PhysicalCheck = z.infer<typeof PhysicalCheckSchema>;

/**
 * Timing check
 */
export const TimingCheckSchema = z.object({
  rushed: z.boolean(),
  appropriateTime: z.boolean(),
  timeOfDay: z.enum(['optimal', 'acceptable', 'suboptimal']),
  deadline: z.date().optional(),
  deadlinePressure: z.boolean(),
  score: z.number().min(0).max(1),
  issues: z.array(z.string()),
});
export type TimingCheck = z.infer<typeof TimingCheckSchema>;

/**
 * Preparation check
 */
export const PreparationCheckSchema = z.object({
  researchDone: z.boolean(),
  alternativesConsidered: z.boolean(),
  stakeholdersConsulted: z.boolean(),
  dataGathered: z.boolean(),
  score: z.number().min(0).max(1),
  gaps: z.array(z.string()),
});
export type PreparationCheck = z.infer<typeof PreparationCheckSchema>;

/**
 * Meta check (self-awareness)
 */
export const MetaCheckSchema = z.object({
  biasChecked: z.boolean(),
  secondOpinionSought: z.boolean(),
  reversibilityConsidered: z.boolean(),
  worstCaseConsidered: z.boolean(),
  score: z.number().min(0).max(1),
  gaps: z.array(z.string()),
});
export type MetaCheck = z.infer<typeof MetaCheckSchema>;

/**
 * Complete discipline check result
 */
export const DisciplineCheckSchema = z.object({
  decision: z.string(),
  agent: z.string(),
  physical: PhysicalCheckSchema,
  emotional: z.object({
    state: EmotionalStateSchema,
    riskScore: z.number(),
    score: z.number().min(0).max(1),
  }),
  timing: TimingCheckSchema,
  preparation: PreparationCheckSchema,
  meta: MetaCheckSchema,
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  threshold: z.number(),
  violations: z.array(z.string()),
  recommendations: z.array(z.string()),
  blockers: z.array(z.string()),
  shouldProceed: z.boolean(),
  waitPeriod: z.string().optional(),
  provenance: z.object({
    framework: z.literal('Pre-Decision Discipline System'),
    computedAt: z.date(),
  }),
});
export type DisciplineCheck = z.infer<typeof DisciplineCheckSchema>;

/**
 * Context for discipline check
 */
export const DisciplineContextSchema = z.object({
  sleep: z
    .object({
      hours: z.number(),
      quality: z.enum(['poor', 'fair', 'good', 'excellent']),
    })
    .optional(),
  lastMeal: z.date().optional(),
  lastExercise: z.date().optional(),
  currentTime: z.date().optional(),
  deadline: z.date().optional(),
  researchDocuments: z.array(z.string()).optional(),
  alternativesConsidered: z.array(z.string()).optional(),
  consultedParties: z.array(z.string()).optional(),
  emotional: z
    .object({
      valence: z.number().min(-1).max(1),
      arousal: z.number().min(0).max(1),
      dominance: z.number().min(0).max(1),
      context: z.string().optional(),
    })
    .optional(),
});
export type DisciplineContext = z.infer<typeof DisciplineContextSchema>;

// =============================================================================
// PATHOS: GROWTH PILLAR
// =============================================================================

// -----------------------------------------------------------------------------
// CBT Reframing
// -----------------------------------------------------------------------------

/**
 * The 10 cognitive distortions (David Burns)
 */
export const CognitiveDistortionSchema = z.enum([
  'ALL_OR_NOTHING',
  'OVERGENERALIZATION',
  'MENTAL_FILTER',
  'CATASTROPHIZING',
  'DISQUALIFYING_POSITIVE',
  'MIND_READING',
  'FORTUNE_TELLING',
  'EMOTIONAL_REASONING',
  'SHOULD_STATEMENTS',
  'PERSONALIZATION',
]);
export type CognitiveDistortion = z.infer<typeof CognitiveDistortionSchema>;

/**
 * Detected distortion with details
 */
export const DetectedDistortionSchema = z.object({
  type: CognitiveDistortionSchema,
  severity: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  triggerPhrases: z.array(z.string()),
});
export type DetectedDistortion = z.infer<typeof DetectedDistortionSchema>;

/**
 * CBT reframe result
 */
export const CBTReframeSchema = z.object({
  originalThought: z.string(),
  distortionsDetected: z.array(DetectedDistortionSchema),
  primaryDistortion: CognitiveDistortionSchema.optional(),
  reframedThought: z.string(),
  balancedPerspective: z.string(),
  evidenceFor: z.array(z.string()),
  evidenceAgainst: z.array(z.string()),
  actionable: z.string(),
  affirmation: z.string().optional(),
  provenance: z.object({
    framework: z.literal('Cognitive Behavioral Therapy (Beck, 1960s)'),
    computedAt: z.date(),
  }),
});
export type CBTReframe = z.infer<typeof CBTReframeSchema>;

/**
 * Context for CBT reframing
 */
export const ReframingContextSchema = z.object({
  situation: z.string().optional(),
  historicalData: z.array(z.unknown()).optional(),
  evidence: z.array(z.string()).optional(),
  recentEvents: z
    .array(
      z.object({
        event: z.string(),
        outcome: z.string(),
        timestamp: z.date(),
      })
    )
    .optional(),
});
export type ReframingContext = z.infer<typeof ReframingContextSchema>;

// -----------------------------------------------------------------------------
// DBT Skills
// -----------------------------------------------------------------------------

/**
 * DBT skill categories
 */
export const DBTSkillCategorySchema = z.enum([
  'MINDFULNESS',
  'DISTRESS_TOLERANCE',
  'EMOTION_REGULATION',
  'INTERPERSONAL_EFFECTIVENESS',
]);
export type DBTSkillCategory = z.infer<typeof DBTSkillCategorySchema>;

/**
 * DBT skill recommendation
 */
export const DBTSkillRecommendationSchema = z.object({
  category: DBTSkillCategorySchema,
  skill: z.string(),
  acronym: z.string().optional(),
  description: z.string(),
  steps: z.array(z.string()),
  whenToUse: z.string(),
  example: z.string(),
  provenance: z.object({
    framework: z.literal('Dialectical Behavior Therapy (Linehan, 1993)'),
    computedAt: z.date(),
  }),
});
export type DBTSkillRecommendation = z.infer<typeof DBTSkillRecommendationSchema>;

// -----------------------------------------------------------------------------
// Stoic Philosophy
// -----------------------------------------------------------------------------

/**
 * Controllable factor analysis
 */
export const ControllableFactorSchema = z.object({
  item: z.string(),
  actionable: z.string(),
  effort: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
  priority: z.number().int().positive(),
});
export type ControllableFactor = z.infer<typeof ControllableFactorSchema>;

/**
 * Uncontrollable factor analysis
 */
export const UncontrollableFactorSchema = z.object({
  item: z.string(),
  acceptance: z.string(),
  wastedEnergy: z.number().min(0).max(1),
  reframe: z.string().optional(),
});
export type UncontrollableFactor = z.infer<typeof UncontrollableFactorSchema>;

/**
 * Dichotomy of control analysis result
 */
export const DichotomyAnalysisSchema = z.object({
  situation: z.string(),
  controllable: z.array(ControllableFactorSchema),
  uncontrollable: z.array(UncontrollableFactorSchema),
  totalWastedEnergy: z.number(),
  recommendation: z.string(),
  focusArea: z.string(),
  releaseArea: z.string(),
  actionPlan: z.array(z.string()),
  stoicQuote: z
    .object({
      text: z.string(),
      source: z.string(),
      relevance: z.string(),
    })
    .optional(),
  provenance: z.object({
    framework: z.literal('Dichotomy of Control (Epictetus, ~125 AD)'),
    computedAt: z.date(),
  }),
});
export type DichotomyAnalysis = z.infer<typeof DichotomyAnalysisSchema>;

/**
 * The four cardinal virtues
 */
export const CardinalVirtueSchema = z.enum([
  'WISDOM',
  'COURAGE',
  'JUSTICE',
  'TEMPERANCE',
]);
export type CardinalVirtue = z.infer<typeof CardinalVirtueSchema>;

/**
 * Virtue alignment check
 */
export const VirtueAlignmentSchema = z.object({
  virtue: CardinalVirtueSchema,
  aligned: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  examples: z.array(z.string()),
});
export type VirtueAlignment = z.infer<typeof VirtueAlignmentSchema>;

/**
 * Complete virtue check result
 */
export const VirtueCheckSchema = z.object({
  decision: z.string(),
  virtueAlignment: z.object({
    wisdom: VirtueAlignmentSchema,
    courage: VirtueAlignmentSchema,
    justice: VirtueAlignmentSchema,
    temperance: VirtueAlignmentSchema,
  }),
  overallAlignment: z.number().min(0).max(1),
  alignmentLevel: z.enum(['EXEMPLARY', 'GOOD', 'MIXED', 'POOR']),
  recommendation: z.string(),
  conflicts: z.array(z.string()),
  improvements: z.array(z.string()),
  stoicQuote: z
    .object({
      text: z.string(),
      source: z.string(),
    })
    .optional(),
  provenance: z.object({
    framework: z.literal('Stoic Virtue Ethics (Marcus Aurelius)'),
    computedAt: z.date(),
  }),
});
export type VirtueCheck = z.infer<typeof VirtueCheckSchema>;

// -----------------------------------------------------------------------------
// Reflection Engine
// -----------------------------------------------------------------------------

/**
 * Insight types
 */
export const InsightTypeSchema = z.enum([
  'SUCCESS',
  'MISTAKE',
  'PATTERN',
  'PRINCIPLE',
  'ANTIPATTERN',
  'OPPORTUNITY',
  'WARNING',
]);
export type InsightType = z.infer<typeof InsightTypeSchema>;

/**
 * A single insight
 */
export const InsightSchema = z.object({
  id: z.string(),
  type: InsightTypeSchema,
  description: z.string(),
  evidence: z.array(z.string()),
  actionable: z.string(),
  confidence: z.number().min(0).max(1),
  generalizes: z.boolean(),
  domain: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  framework: z.string(),
  relatedInsights: z.array(z.string()).optional(),
  timestamp: z.date(),
});
export type Insight = z.infer<typeof InsightSchema>;

/**
 * Reflection result
 */
export const ReflectionResultSchema = z.object({
  outcomeId: z.string(),
  action: z.string(),
  result: z.enum(['success', 'failure', 'partial']),
  expectedValue: z.number(),
  actualValue: z.number(),
  delta: z.number(),
  insights: z.array(InsightSchema),
  principles: z.array(z.string()),
  whatWorked: z.array(z.string()),
  whatDidntWork: z.array(z.string()),
  nextActions: z.array(z.string()),
  emotionalProcessing: z.string(),
  gratitude: z.array(z.string()).optional(),
  lessonsLearned: z.array(z.string()),
  provenance: z.object({
    framework: z.literal('Reflection Engine (Kolb Learning Cycle, 1984)'),
    computedAt: z.date(),
  }),
});
export type ReflectionResult = z.infer<typeof ReflectionResultSchema>;

// -----------------------------------------------------------------------------
// Wisdom Index
// -----------------------------------------------------------------------------

/**
 * Wisdom tradition sources
 */
export const WisdomTraditionSchema = z.enum([
  'STOIC',
  'DALIO',
  'MUNGER',
  'MUSASHI',
  'NAVAL',
  'TALEB',
  'MEADOWS',
  'ERICSSON',
  'BECK',
  'UNIVERSAL',
]);
export type WisdomTradition = z.infer<typeof WisdomTraditionSchema>;

/**
 * A wisdom entry
 */
export const WisdomEntrySchema = z.object({
  id: z.string(),
  principle: z.string(),
  source: z.string(),
  citation: z.string(),
  tradition: WisdomTraditionSchema,
  context: z.string(),
  application: z.array(z.string()),
  keywords: z.array(z.string()),
  examples: z.array(z.string()),
  relatedPrinciples: z.array(z.string()),
  tier: z.enum(['CORE', 'ADVANCED', 'SPECIALIZED']),
});
export type WisdomEntry = z.infer<typeof WisdomEntrySchema>;

/**
 * Wisdom query response
 */
export const WisdomResponseSchema = z.object({
  query: z.string(),
  principle: z.string(),
  source: z.string(),
  quote: z.string().optional(),
  application: z.string(),
  alternatives: z.array(z.string()),
  contraindications: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  tradition: WisdomTraditionSchema,
  relatedWisdom: z.array(z.string()).optional(),
  provenance: z.object({
    text: z.string(),
    fetchedFrom: z.string().optional(),
    indexedAt: z.date(),
  }),
});
export type WisdomResponse = z.infer<typeof WisdomResponseSchema>;

// -----------------------------------------------------------------------------
// Meta-Learning
// -----------------------------------------------------------------------------

/**
 * Learning goal
 */
export const LearningGoalSchema = z.object({
  goal: z.string(),
  metric: z.string(),
  baseline: z.number(),
  target: z.number(),
  currentProgress: z.number().optional(),
});
export type LearningGoal = z.infer<typeof LearningGoalSchema>;

/**
 * Milestone in learning plan
 */
export const MilestoneSchema = z.object({
  level: z.number(),
  description: z.string(),
  estimatedWeek: z.number(),
  criteria: z.array(z.string()),
  reward: z.string().optional(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

/**
 * Difficulty progression step
 */
export const DifficultyStepSchema = z.object({
  week: z.number(),
  difficulty: z.string(),
  challenge: z.string(),
  focus: z.string(),
});
export type DifficultyStep = z.infer<typeof DifficultyStepSchema>;

/**
 * Practice plan for skill acquisition
 */
export const PracticePlanSchema = z.object({
  skill: z.string(),
  currentLevel: z.number().min(0).max(100),
  targetLevel: z.number().min(0).max(100),
  gap: z.number(),
  estimatedHours: z.number(),
  timeframe: z.string(),
  specificGoals: z.array(LearningGoalSchema),
  weaknessesToAddress: z.array(z.string()),
  strengthsToLeverage: z.array(z.string()),
  practiceSchedule: z.object({
    frequency: z.string(),
    duration: z.number(),
    timing: z.string(),
    restDays: z.array(z.string()).optional(),
  }),
  feedbackMechanism: z.array(z.string()),
  difficultyProgression: z.array(DifficultyStepSchema),
  milestones: z.array(MilestoneSchema),
  resources: z.array(z.string()),
  potentialObstacles: z.array(z.string()),
  motivationalStrategies: z.array(z.string()),
  provenance: z.object({
    framework: z.literal('Deliberate Practice (Ericsson, 2016)'),
    principles: z.array(z.string()),
    computedAt: z.date(),
  }),
});
export type PracticePlan = z.infer<typeof PracticePlanSchema>;

// =============================================================================
// KNOWLEDGE MANAGEMENT
// =============================================================================

/**
 * Trust levels for knowledge sources
 */
export const TrustLevelSchema = z.enum([
  'VERIFIED',
  'STANDARD',
  'UNTRUSTED',
  'HOSTILE',
]);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

/**
 * Knowledge source definition
 */
export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  category: z.enum([
    'OFFICIAL',
    'RESEARCH',
    'DOCUMENTATION',
    'COMMUNITY',
    'NEWS',
    'BOOK',
    'COURSE',
  ]),
  trustLevel: TrustLevelSchema,
  pillar: z.enum(['LOGOS', 'ETHOS', 'PATHOS', 'CROSS_CUTTING']),
  councilMembers: z.array(z.string()),
  frameworks: z.array(z.string()),
  updateFrequency: z.enum(['daily', 'weekly', 'monthly', 'static']),
  contentType: z.enum([
    'article',
    'paper',
    'book',
    'video',
    'course',
    'documentation',
  ]),
  keyTopics: z.array(z.string()),
  integrationPriority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  securityNotes: z.string().optional(),
  sampleInsights: z.array(z.string()),
  enabled: z.boolean(),
  lastFetched: z.date().optional(),
  fetchErrors: z.number().optional(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

/**
 * Validation pipeline stage
 */
export const ValidationStageSchema = z.enum([
  'WHITELIST',
  'SANITIZE',
  'BIAS_CHECK',
  'FACT_CHECK',
  'HUMAN_REVIEW',
]);
export type ValidationStage = z.infer<typeof ValidationStageSchema>;

/**
 * Validation result
 */
export const ValidationResultSchema = z.object({
  sourceId: z.string(),
  contentId: z.string(),
  stage: ValidationStageSchema,
  stageNumber: z.number().int().min(1).max(5),
  passed: z.boolean(),
  reason: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  nextStage: ValidationStageSchema.optional(),
  requiresHumanReview: z.boolean(),
  timestamp: z.date(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Council member cognitive profile
 */
export const CognitiveProfileSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  memberAvatar: z.string(),
  pillarWeights: z.object({
    logos: z.number().min(0).max(1),
    ethos: z.number().min(0).max(1),
    pathos: z.number().min(0).max(1),
  }),
  primaryPillar: PillarSchema,
  primaryFrameworks: z.array(
    z.object({
      name: z.string(),
      domain: z.string(),
      application: z.string(),
      why: z.string(),
    })
  ),
  knowledgeSources: z.array(z.string()),
  expertiseAreas: z.array(z.string()),
  consultedFor: z.string(),
  typicalAPIUsage: z.array(z.string()),
  learningPlan: z.object({
    current: z.string(),
    next: z.string(),
    cadence: z.string(),
    quarterlyGoals: z.array(z.string()),
  }),
  cognitiveBiasAwareness: z.object({
    naturalTendency: z.string(),
    compensationStrategy: z.string(),
    historicalPattern: z.string(),
    improvementGoal: z.string(),
  }),
  performanceMetrics: z.object({
    keyMetric: z.string(),
    baseline: z.number(),
    target: z.number(),
    current: z.number().optional(),
    secondaryMetric: z.string().optional(),
  }),
});
export type CognitiveProfile = z.infer<typeof CognitiveProfileSchema>;

// =============================================================================
// LEARNING LOOP
// =============================================================================

/**
 * Learning loop stages
 */
export const LearningStageSchema = z.enum([
  'PERFORMANCE_REVIEW',
  'GAP_ANALYSIS',
  'SOURCE_DISCOVERY',
  'KNOWLEDGE_INTEGRATION',
  'SELF_ASSESSMENT',
]);
export type LearningStage = z.infer<typeof LearningStageSchema>;

/**
 * Performance review result
 */
export const PerformanceReviewSchema = z.object({
  period: z.object({
    start: z.date(),
    end: z.date(),
    durationHours: z.number(),
  }),
  decisions: z.object({
    total: z.number(),
    successful: z.number(),
    failed: z.number(),
    partial: z.number(),
    successRate: z.number(),
  }),
  expectedValueAccuracy: z.object({
    meanError: z.number(),
    rmse: z.number(),
    calibration: z.number(),
    overconfidenceRate: z.number(),
    underconfidenceRate: z.number(),
  }),
  biasesDetected: z.object({
    total: z.number(),
    byType: z.record(CognitiveBiasSchema, z.number()),
    trend: z.enum(['increasing', 'decreasing', 'stable']),
    mostCommon: CognitiveBiasSchema.optional(),
  }),
  emotionalRisk: z.object({
    avgRisk: z.number(),
    highRiskDecisions: z.number(),
    highRiskRate: z.number(),
  }),
  frameworkUsage: z.array(
    z.object({
      framework: z.string(),
      usageCount: z.number(),
      successRate: z.number(),
    })
  ),
  patterns: z.array(z.string()),
  insights: z.array(InsightSchema),
  recommendations: z.array(z.string()),
  overallGrade: z.enum(['A', 'B', 'C', 'D', 'F']),
  timestamp: z.date(),
});
export type PerformanceReview = z.infer<typeof PerformanceReviewSchema>;

/**
 * Knowledge gap
 */
export const KnowledgeGapSchema = z.object({
  id: z.string(),
  description: z.string(),
  context: z.string(),
  frequency: z.number(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  suggestedFrameworks: z.array(z.string()),
  suggestedSources: z.array(z.string()),
  affectedMembers: z.array(z.string()),
  priority: z.number(),
  status: z.enum(['NEW', 'ACKNOWLEDGED', 'ADDRESSING', 'RESOLVED']),
  createdAt: z.date(),
  resolvedAt: z.date().optional(),
});
export type KnowledgeGap = z.infer<typeof KnowledgeGapSchema>;

/**
 * Gap analysis result
 */
export const GapAnalysisResultSchema = z.object({
  period: z.object({
    start: z.date(),
    end: z.date(),
  }),
  gaps: z.array(KnowledgeGapSchema),
  topGaps: z.array(KnowledgeGapSchema),
  gapsResolved: z.array(z.string()),
  recommendations: z.array(z.string()),
  newSourceSuggestions: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      rationale: z.string(),
      estimatedTrust: TrustLevelSchema,
      pillar: PillarSchema,
    })
  ),
  timestamp: z.date(),
});
export type GapAnalysisResult = z.infer<typeof GapAnalysisResultSchema>;

/**
 * Self-assessment result
 */
export const SelfAssessmentSchema = z.object({
  period: z.object({
    start: z.date(),
    end: z.date(),
    previousStart: z.date(),
    previousEnd: z.date(),
  }),
  decisionQuality: z.object({
    thisPeriod: z.number(),
    lastPeriod: z.number(),
    change: z.number(),
    trend: z.enum(['IMPROVING', 'DECLINING', 'STABLE']),
    percentileRank: z.number().optional(),
  }),
  biasReduction: z.object({
    biasesThisPeriod: z.number(),
    biasesLastPeriod: z.number(),
    reduction: z.number(),
    reductionPercentage: z.number(),
    mostCommonBias: CognitiveBiasSchema.optional(),
    mostImprovedBias: CognitiveBiasSchema.optional(),
  }),
  knowledgeGrowth: z.object({
    documentsAdded: z.number(),
    sourcesAdded: z.number(),
    queriesAnswered: z.number(),
    querySuccessRate: z.number(),
    gapsResolved: z.number(),
  }),
  learningVelocity: z.object({
    insightsPerWeek: z.number(),
    principlesExtracted: z.number(),
    transferLearnings: z.number(),
    retentionRate: z.number(),
  }),
  frameworkEffectiveness: z.array(
    z.object({
      framework: z.string(),
      pillar: PillarSchema,
      usageCount: z.number(),
      successRate: z.number(),
      impact: z.number(),
      trend: z.enum(['IMPROVING', 'DECLINING', 'STABLE']),
    })
  ),
  councilMemberPerformance: z
    .array(
      z.object({
        memberId: z.string(),
        memberName: z.string(),
        decisionCount: z.number(),
        successRate: z.number(),
        improvement: z.number(),
      })
    )
    .optional(),
  overallImprovement: z.number(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  gradeExplanation: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  nextMonthFocus: z.array(z.string()),
  timestamp: z.date(),
});
export type SelfAssessment = z.infer<typeof SelfAssessmentSchema>;

// =============================================================================
// VISUALIZATION
// =============================================================================

/**
 * Insight block for Claude Code display
 */
export const InsightBlockSchema = z.object({
  pillar: PillarSchema,
  framework: z.string(),
  title: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.union([z.string(), z.array(z.string())]),
      highlight: z.enum(['positive', 'negative', 'warning', 'neutral']).optional(),
    })
  ),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
  educationalNote: z.string().optional(),
});
export type InsightBlock = z.infer<typeof InsightBlockSchema>;

/**
 * Cognitive activity event for dashboard
 */
export const CognitiveActivityEventSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  agent: z.string(),
  pillar: PillarSchema,
  api: z.string(),
  framework: z.string(),
  input: z.record(z.unknown()),
  result: z.record(z.unknown()),
  confidence: z.number(),
  duration: z.number(),
  educationalNote: z.string().optional(),
});
export type CognitiveActivityEvent = z.infer<typeof CognitiveActivityEventSchema>;

/**
 * Learning progress for dashboard
 */
export const LearningProgressSchema = z.object({
  currentStage: LearningStageSchema,
  stageProgress: z.number().min(0).max(1),
  lastReview: z.date(),
  lastGapAnalysis: z.date(),
  lastAssessment: z.date(),
  nextReview: z.date(),
  nextGapAnalysis: z.date(),
  nextAssessment: z.date(),
  recentInsights: z.array(InsightSchema),
  recentInsightsCount: z.number(),
  improvementTrend: z.enum(['IMPROVING', 'STABLE', 'DECLINING']),
  currentGrade: z.enum(['A', 'B', 'C', 'D', 'F']),
  streakDays: z.number(),
});
export type LearningProgress = z.infer<typeof LearningProgressSchema>;

/**
 * Pillar health status
 */
export const PillarHealthSchema = z.object({
  pillar: PillarSchema,
  health: z.number().min(0).max(1),
  healthLevel: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']),
  apisActive: z.number(),
  apisTotal: z.number(),
  lastActivity: z.date(),
  topFramework: z.string(),
  frameworkUsage: z.array(
    z.object({
      framework: z.string(),
      usageCount: z.number(),
      successRate: z.number(),
    })
  ),
  recentErrors: z.number(),
  avgResponseTime: z.number(),
});
export type PillarHealth = z.infer<typeof PillarHealthSchema>;

/**
 * Overall cognitive health
 */
export const CognitiveHealthSchema = z.object({
  overall: z.number().min(0).max(1),
  overallLevel: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']),
  pillars: z.array(PillarHealthSchema),
  learningLoopActive: z.boolean(),
  learningLoopStage: LearningStageSchema,
  knowledgeSources: z.number(),
  knowledgeSourcesActive: z.number(),
  councilProfilesLoaded: z.number(),
  lastUpdated: z.date(),
});
export type CognitiveHealth = z.infer<typeof CognitiveHealthSchema>;

// =============================================================================
// NOTE: All types are already exported via z.infer<> above each schema
// No additional export block needed - TypeScript infers types from Zod schemas
// =============================================================================
