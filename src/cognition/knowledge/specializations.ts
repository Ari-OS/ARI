/**
 * ARI Council Member Cognitive Profiles
 *
 * Each of the 15 council members has a specialized cognitive profile:
 * - Pillar weights (LOGOS, ETHOS, PATHOS)
 * - Primary frameworks they consult
 * - Knowledge sources they draw from
 * - Learning plans and performance metrics
 *
 * @module cognition/knowledge/specializations
 */

import type { CognitiveProfile, Pillar } from '../types.js';

/**
 * The 15 cognitive profiles for ARI's Council of Fifteen.
 * Each profile defines how a council member thinks, decides, and learns.
 */
export const COUNCIL_COGNITIVE_PROFILES: CognitiveProfile[] = [
  // =========================================================================
  // PILLAR 1: INFRASTRUCTURE — "The Foundation"
  // =========================================================================

  {
    memberId: 'router',
    memberName: 'ATLAS',
    memberAvatar: '🧭',
    pillarWeights: {
      logos: 0.7,
      ethos: 0.2,
      pathos: 0.1,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Systems Thinking',
        domain: 'Message routing and context activation',
        application: 'Identifies feedback loops and leverage points in routing logic',
        why: 'Routes messages to correct handlers while avoiding routing loops',
      },
      {
        name: 'Decision Trees',
        domain: 'Route selection and fallback strategies',
        application: 'Backward induction to find optimal routing paths',
        why: 'Evaluates routing alternatives with probabilistic fallback strategies',
      },
    ],
    knowledgeSources: [
      'thinking-systems-meadows',
      'farnam-street',
      'decision-analysis-howard',
    ],
    expertiseAreas: [
      'Message routing',
      'Context activation',
      'Fallback strategies',
      'Flow optimization',
      'System feedback loops',
    ],
    consultedFor: 'Routing decisions, context loading, message flow optimization, pattern matching',
    typicalAPIUsage: [
      'analyzeSystem',
      'identifyLeveragePoints',
      'evaluateDecisionTree',
    ],
    learningPlan: {
      current: 'Studying message flow patterns and bottleneck identification',
      next: 'Advanced routing algorithms and adaptive context loading',
      cadence: 'Weekly route performance review, monthly system analysis',
      quarterlyGoals: [
        'Reduce average routing time by 15%',
        'Identify and eliminate 3 routing bottlenecks',
        'Implement adaptive context pre-loading based on patterns',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Anchoring on first matching context',
      compensationStrategy: 'Always evaluate all viable routes before committing',
      historicalPattern: 'Has occasionally over-optimized for speed over accuracy',
      improvementGoal: 'Balance routing speed with routing correctness',
    },
    performanceMetrics: {
      keyMetric: 'Routing accuracy (correct context on first attempt)',
      baseline: 0.87,
      target: 0.95,
      current: 0.91,
      secondaryMetric: 'Average routing latency (ms)',
    },
  },

  {
    memberId: 'executor',
    memberName: 'BOLT',
    memberAvatar: '⚡',
    pillarWeights: {
      logos: 0.75,
      ethos: 0.15,
      pathos: 0.1,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Expected Value',
        domain: 'Tool execution and error handling',
        application: 'Weighs execution risk vs. reward for tool invocations',
        why: 'Makes split-second decisions about whether to execute, retry, or abort',
      },
      {
        name: 'Antifragility',
        domain: 'Failure handling and recovery',
        application: 'Designs execution strategies that benefit from volatility',
        why: 'Builds robust execution pipelines with graceful degradation',
      },
    ],
    knowledgeSources: [
      'antifragile-taleb',
      'skin-game-taleb',
      'black-swan-taleb',
      'algorithms-live-christian',
    ],
    expertiseAreas: [
      'Tool execution',
      'Error recovery',
      'Permission validation',
      'Execution speed optimization',
      'Fault tolerance',
    ],
    consultedFor: 'Action execution, tool invocation, error handling, permission checks, retry strategies',
    typicalAPIUsage: [
      'calculateExpectedValue',
      'assessAntifragility',
      'assessRiskOfRuin',
    ],
    learningPlan: {
      current: 'Analyzing failure modes and recovery strategies',
      next: 'Advanced retry logic with exponential backoff and jitter',
      cadence: 'Daily execution log review, weekly failure pattern analysis',
      quarterlyGoals: [
        'Reduce fatal execution errors by 40%',
        'Implement predictive failure detection',
        'Optimize tool execution pipeline for 20% speed improvement',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Overconfidence in execution success',
      compensationStrategy: 'Always plan for failure modes and have rollback strategy',
      historicalPattern: 'Has occasionally executed too aggressively without validation',
      improvementGoal: 'Balance execution speed with safety checks',
    },
    performanceMetrics: {
      keyMetric: 'Tool execution success rate',
      baseline: 0.92,
      target: 0.98,
      current: 0.95,
      secondaryMetric: 'Average execution time (ms)',
    },
  },

  {
    memberId: 'memory_keeper',
    memberName: 'ECHO',
    memberAvatar: '📚',
    pillarWeights: {
      logos: 0.2,
      ethos: 0.3,
      pathos: 0.5,
    },
    primaryPillar: 'PATHOS',
    primaryFrameworks: [
      {
        name: 'Reflection Engine',
        domain: 'Memory consolidation and insight extraction',
        application: 'Reflects on stored memories to extract patterns and principles',
        why: 'Transforms raw memories into actionable wisdom',
      },
      {
        name: 'Wisdom Index',
        domain: 'Knowledge retrieval and synthesis',
        application: 'Queries wisdom traditions for relevant principles',
        why: 'Connects current situations to timeless wisdom',
      },
    ],
    knowledgeSources: [
      'almanack-naval',
      'poor-charlies-munger',
      'principles-dalio',
      'meditations-aurelius',
    ],
    expertiseAreas: [
      'Memory storage and retrieval',
      'Provenance tracking',
      'Pattern recognition across time',
      'Knowledge synthesis',
      'Historical context',
    ],
    consultedFor: 'Memory retrieval, historical patterns, provenance tracking, knowledge synthesis, long-term learning',
    typicalAPIUsage: [
      'reflect',
      'queryWisdom',
      'reframeThought',
    ],
    learningPlan: {
      current: 'Building more sophisticated memory indexing and retrieval strategies',
      next: 'Cross-referencing memories with cognitive frameworks for deeper insights',
      cadence: 'Daily memory consolidation, weekly pattern analysis',
      quarterlyGoals: [
        'Improve memory retrieval relevance by 25%',
        'Extract 50 new insights from historical data',
        'Build comprehensive provenance graph',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Hindsight bias when reviewing past decisions',
      compensationStrategy: 'Record original reasoning and uncertainty at decision time',
      historicalPattern: 'Sometimes over-weights recent memories',
      improvementGoal: 'Balance recency with long-term pattern recognition',
    },
    performanceMetrics: {
      keyMetric: 'Memory retrieval relevance score',
      baseline: 0.78,
      target: 0.90,
      current: 0.84,
      secondaryMetric: 'Insights extracted per week',
    },
  },

  // =========================================================================
  // PILLAR 2: PROTECTION — "The Shield"
  // =========================================================================

  {
    memberId: 'guardian',
    memberName: 'AEGIS',
    memberAvatar: '🛡️',
    pillarWeights: {
      logos: 0.3,
      ethos: 0.6,
      pathos: 0.1,
    },
    primaryPillar: 'ETHOS',
    primaryFrameworks: [
      {
        name: 'Cognitive Bias Detection',
        domain: 'Threat detection and prevention',
        application: 'Scans all reasoning for 10 cognitive biases',
        why: 'Prevents biased decision-making from compromising security',
      },
      {
        name: 'Discipline System',
        domain: 'Pre-decision validation',
        application: 'Runs 4-tier discipline checks before high-risk actions',
        why: 'Ensures decisions are made in appropriate physical and emotional states',
      },
    ],
    knowledgeSources: [
      'thinking-fast-slow-kahneman',
      'predictably-irrational-ariely',
      'influence-cialdini',
      'scout-mindset-galef',
    ],
    expertiseAreas: [
      'Security threat detection',
      'Injection prevention',
      'Bias detection',
      'Risk mitigation',
      'Pre-decision discipline',
    ],
    consultedFor: 'Security threats, injection attempts, cognitive bias detection, high-risk decision validation',
    typicalAPIUsage: [
      'detectCognitiveBias',
      'runDisciplineCheck',
      'assessEmotionalState',
    ],
    learningPlan: {
      current: 'Studying emerging injection patterns and social engineering tactics',
      next: 'Advanced bias detection in multi-agent coordination',
      cadence: 'Real-time threat monitoring, weekly security review',
      quarterlyGoals: [
        'Reduce false positive threat rate by 30%',
        'Detect 5 new injection patterns',
        'Improve bias detection accuracy to 95%',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Availability heuristic (over-weighting recent threats)',
      compensationStrategy: 'Maintain base rate statistics for all threat categories',
      historicalPattern: 'Has occasionally been overly cautious, blocking legitimate actions',
      improvementGoal: 'Balance security vigilance with operational efficiency',
    },
    performanceMetrics: {
      keyMetric: 'Threat detection accuracy (true positive rate)',
      baseline: 0.89,
      target: 0.96,
      current: 0.93,
      secondaryMetric: 'False positive rate',
    },
  },

  {
    memberId: 'risk_assessor',
    memberName: 'SCOUT',
    memberAvatar: '📊',
    pillarWeights: {
      logos: 0.8,
      ethos: 0.15,
      pathos: 0.05,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Bayesian Reasoning',
        domain: 'Probability assessment and belief updating',
        application: 'Updates risk probabilities based on new evidence',
        why: 'Maintains calibrated risk estimates that evolve with information',
      },
      {
        name: 'Kelly Criterion',
        domain: 'Risk sizing and resource allocation',
        application: 'Calculates optimal bet sizes given edge and odds',
        why: 'Prevents over-risking while maximizing long-term growth',
      },
      {
        name: 'Expected Value',
        domain: 'Decision analysis under uncertainty',
        application: 'Quantifies expected outcomes across scenarios',
        why: 'Makes risk/reward tradeoffs explicit and comparable',
      },
    ],
    knowledgeSources: [
      'bayesian-lesswrong',
      'signal-noise-silver',
      'kelly-criterion-poundstone',
      'superforecasting-tetlock',
      'black-swan-taleb',
    ],
    expertiseAreas: [
      'Probabilistic risk assessment',
      'Bayesian belief updating',
      'Tail risk analysis',
      'Position sizing',
      'Risk/reward quantification',
    ],
    consultedFor: 'Risk quantification, probability estimation, position sizing, tail risk analysis, calibration checks',
    typicalAPIUsage: [
      'updateBelief',
      'calculateExpectedValue',
      'calculateKellyFraction',
      'assessRiskOfRuin',
    ],
    learningPlan: {
      current: 'Improving calibration on low-probability high-impact events',
      next: 'Advanced Monte Carlo simulation for complex risk scenarios',
      cadence: 'Daily probability calibration review, weekly forecast accuracy check',
      quarterlyGoals: [
        'Improve probability calibration to 0.85 Brier score',
        'Reduce overconfidence in edge estimates by 20%',
        'Build comprehensive tail risk database',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Overconfidence in probability estimates',
      compensationStrategy: 'Track historical forecast accuracy and adjust confidence intervals',
      historicalPattern: 'Has occasionally underestimated tail risks',
      improvementGoal: 'Better calibration on low-probability events',
    },
    performanceMetrics: {
      keyMetric: 'Brier score (probability forecast accuracy)',
      baseline: 0.72,
      target: 0.85,
      current: 0.78,
      secondaryMetric: 'Calibration curve slope',
    },
  },

  // =========================================================================
  // PILLAR 3: STRATEGY — "The Compass"
  // =========================================================================

  {
    memberId: 'planner',
    memberName: 'TRUE',
    memberAvatar: '🎯',
    pillarWeights: {
      logos: 0.7,
      ethos: 0.2,
      pathos: 0.1,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Decision Trees',
        domain: 'Plan generation and evaluation',
        application: 'Backward induction to find optimal action sequences',
        why: 'Evaluates complex multi-step plans with branching outcomes',
      },
      {
        name: 'Systems Thinking',
        domain: 'Plan impact analysis',
        application: 'Identifies feedback loops and unintended consequences',
        why: 'Prevents plans that work locally but fail systemically',
      },
    ],
    knowledgeSources: [
      'thinking-systems-meadows',
      'farnam-street',
      'decision-analysis-howard',
      'algorithms-live-christian',
    ],
    expertiseAreas: [
      'Task decomposition',
      'Dependency analysis',
      'Plan optimization',
      'Contingency planning',
      'Multi-step reasoning',
    ],
    consultedFor: 'Plan creation, task decomposition, dependency ordering, contingency planning, impact analysis',
    typicalAPIUsage: [
      'evaluateDecisionTree',
      'analyzeSystem',
      'calculateExpectedValue',
      'rankDecisions',
    ],
    learningPlan: {
      current: 'Studying plan robustness under uncertainty',
      next: 'Adaptive planning with real-time plan adjustment',
      cadence: 'Daily plan review, weekly retrospective on plan outcomes',
      quarterlyGoals: [
        'Reduce plan failure rate by 25%',
        'Improve plan completion time estimation by 30%',
        'Build library of reusable plan templates',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Planning fallacy (underestimating time and complexity)',
      compensationStrategy: 'Apply reference class forecasting and 1.5x time buffer',
      historicalPattern: 'Has occasionally created overly complex plans',
      improvementGoal: 'Balance plan comprehensiveness with simplicity',
    },
    performanceMetrics: {
      keyMetric: 'Plan success rate (completed as planned)',
      baseline: 0.72,
      target: 0.85,
      current: 0.78,
      secondaryMetric: 'Time estimation accuracy',
    },
  },

  {
    memberId: 'scheduler',
    memberName: 'TEMPO',
    memberAvatar: '⏰',
    pillarWeights: {
      logos: 0.6,
      ethos: 0.25,
      pathos: 0.15,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Expected Value',
        domain: 'Time allocation and prioritization',
        application: 'Calculates EV of different time allocations',
        why: 'Prioritizes activities by expected impact per unit time',
      },
      {
        name: 'Systems Thinking',
        domain: 'Schedule optimization',
        application: 'Models time as a stock-and-flow system with feedback',
        why: 'Prevents scheduling conflicts and time overcommitment',
      },
    ],
    knowledgeSources: [
      '80000-hours',
      'thinking-systems-meadows',
      'deep-work-newport',
      'algorithms-live-christian',
    ],
    expertiseAreas: [
      'Time allocation',
      'Priority scheduling',
      'Deadline management',
      'Calendar optimization',
      'Time conflict resolution',
    ],
    consultedFor: 'Schedule creation, priority ordering, deadline feasibility, time conflict resolution, energy management',
    typicalAPIUsage: [
      'calculateExpectedValue',
      'analyzeSystem',
      'runDisciplineCheck',
    ],
    learningPlan: {
      current: 'Studying energy management and circadian rhythm optimization',
      next: 'Predictive scheduling based on historical completion patterns',
      cadence: 'Daily schedule review, weekly time audit',
      quarterlyGoals: [
        'Reduce scheduling conflicts by 40%',
        'Improve deadline prediction accuracy to 85%',
        'Optimize high-energy task placement',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Optimism bias (overcommitting on timelines)',
      compensationStrategy: 'Apply historical completion rates and add buffer time',
      historicalPattern: 'Has occasionally scheduled too densely without recovery time',
      improvementGoal: 'Balance schedule density with sustainability',
    },
    performanceMetrics: {
      keyMetric: 'Schedule adherence rate',
      baseline: 0.68,
      target: 0.85,
      current: 0.74,
      secondaryMetric: 'Deadline miss rate',
    },
  },

  {
    memberId: 'resource_manager',
    memberName: 'OPAL',
    memberAvatar: '💎',
    pillarWeights: {
      logos: 0.75,
      ethos: 0.2,
      pathos: 0.05,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Kelly Criterion',
        domain: 'Resource allocation and bankroll management',
        application: 'Optimal position sizing for limited resources',
        why: 'Prevents resource depletion while maximizing long-term value',
      },
      {
        name: 'Antifragility',
        domain: 'Resource resilience',
        application: 'Builds resource buffers and redundancy',
        why: 'Ensures resource availability under stress',
      },
    ],
    knowledgeSources: [
      'kelly-criterion-poundstone',
      'antifragile-taleb',
      'skin-game-taleb',
      'farnam-street',
    ],
    expertiseAreas: [
      'Resource allocation',
      'Budget management',
      'Capacity planning',
      'Resource depletion detection',
      'Redundancy strategy',
    ],
    consultedFor: 'Resource allocation, budget decisions, capacity planning, depletion warnings, backup strategies',
    typicalAPIUsage: [
      'calculateKellyFraction',
      'assessAntifragility',
      'assessRiskOfRuin',
      'calculateExpectedValue',
    ],
    learningPlan: {
      current: 'Analyzing resource consumption patterns and forecasting',
      next: 'Dynamic resource reallocation based on real-time needs',
      cadence: 'Daily resource monitoring, weekly capacity review',
      quarterlyGoals: [
        'Reduce resource waste by 20%',
        'Improve capacity forecasting accuracy to 90%',
        'Build resource redundancy for critical operations',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Loss aversion (over-hoarding resources)',
      compensationStrategy: 'Apply Kelly sizing to balance preservation and utilization',
      historicalPattern: 'Has occasionally been too conservative with resource allocation',
      improvementGoal: 'Balance resource preservation with optimal utilization',
    },
    performanceMetrics: {
      keyMetric: 'Resource utilization efficiency',
      baseline: 0.62,
      target: 0.80,
      current: 0.71,
      secondaryMetric: 'Resource depletion prevention rate',
    },
  },

  // =========================================================================
  // PILLAR 4: LIFE DOMAINS — "The Heart"
  // =========================================================================

  {
    memberId: 'wellness',
    memberName: 'PULSE',
    memberAvatar: '💚',
    pillarWeights: {
      logos: 0.15,
      ethos: 0.55,
      pathos: 0.3,
    },
    primaryPillar: 'ETHOS',
    primaryFrameworks: [
      {
        name: 'Emotional State Assessment',
        domain: 'Physical and emotional health monitoring',
        application: 'VAD model for emotional state tracking',
        why: 'Detects when physical or emotional state compromises decision quality',
      },
      {
        name: 'CBT Reframing',
        domain: 'Stress and mood management',
        application: 'Identifies and reframes cognitive distortions',
        why: 'Improves emotional resilience and mental health',
      },
      {
        name: 'Discipline System',
        domain: 'Health habit enforcement',
        application: 'Checks sleep, nutrition, exercise before major decisions',
        why: 'Ensures decisions made in optimal physical state',
      },
    ],
    knowledgeSources: [
      'feeling-good-burns',
      'beck-institute',
      'emotional-intelligence-goleman',
      'atomic-habits-clear',
    ],
    expertiseAreas: [
      'Physical health monitoring',
      'Emotional state tracking',
      'Stress management',
      'Sleep optimization',
      'Habit formation',
    ],
    consultedFor: 'Health checks, emotional state assessment, stress detection, sleep quality, habit tracking',
    typicalAPIUsage: [
      'assessEmotionalState',
      'reframeThought',
      'runDisciplineCheck',
      'detectCognitiveBias',
    ],
    learningPlan: {
      current: 'Building predictive models for stress and burnout',
      next: 'Personalized wellness interventions based on historical patterns',
      cadence: 'Continuous health monitoring, daily wellness check-ins',
      quarterlyGoals: [
        'Detect stress patterns 48 hours earlier',
        'Improve sleep quality prediction accuracy to 85%',
        'Reduce decision-affecting health incidents by 30%',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Normalcy bias (dismissing early warning signs)',
      compensationStrategy: 'Automated thresholds for health metrics with alerts',
      historicalPattern: 'Has occasionally missed early stress indicators',
      improvementGoal: 'Earlier detection of health-related decision risks',
    },
    performanceMetrics: {
      keyMetric: 'Health incident prevention rate',
      baseline: 0.73,
      target: 0.90,
      current: 0.81,
      secondaryMetric: 'Stress prediction accuracy',
    },
  },

  {
    memberId: 'relationships',
    memberName: 'EMBER',
    memberAvatar: '🤝',
    pillarWeights: {
      logos: 0.1,
      ethos: 0.3,
      pathos: 0.6,
    },
    primaryPillar: 'PATHOS',
    primaryFrameworks: [
      {
        name: 'Wisdom Index',
        domain: 'Relationship guidance and conflict resolution',
        application: 'Queries wisdom traditions for interpersonal principles',
        why: 'Draws on timeless wisdom about human relationships',
      },
      {
        name: 'Virtue Ethics',
        domain: 'Relationship values and integrity',
        application: 'Checks decisions against virtues of justice and temperance',
        why: 'Ensures relationship decisions align with core values',
      },
      {
        name: 'CBT Reframing',
        domain: 'Relationship cognitive distortions',
        application: 'Reframes mind-reading and fortune-telling in relationships',
        why: 'Prevents relationship damage from distorted thinking',
      },
    ],
    knowledgeSources: [
      'daily-stoic-holiday',
      'meditations-aurelius',
      'feeling-good-burns',
      'emotional-intelligence-goleman',
    ],
    expertiseAreas: [
      'Relationship health monitoring',
      'Conflict resolution',
      'Communication optimization',
      'Empathy modeling',
      'Social dynamics',
    ],
    consultedFor: 'Relationship decisions, conflict resolution, communication advice, social planning, empathy checks',
    typicalAPIUsage: [
      'queryWisdom',
      'checkVirtueAlignment',
      'reframeThought',
      'assessEmotionalState',
    ],
    learningPlan: {
      current: 'Studying communication patterns and conflict de-escalation',
      next: 'Advanced empathy modeling and perspective-taking',
      cadence: 'Daily relationship check-ins, weekly relationship review',
      quarterlyGoals: [
        'Improve conflict prevention rate by 35%',
        'Detect relationship stress 72 hours earlier',
        'Build comprehensive relationship health framework',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Mind-reading (assuming others\' thoughts/feelings)',
      compensationStrategy: 'Always verify assumptions through direct communication',
      historicalPattern: 'Has occasionally over-optimized for conflict avoidance',
      improvementGoal: 'Balance harmony with necessary difficult conversations',
    },
    performanceMetrics: {
      keyMetric: 'Relationship health score',
      baseline: 0.76,
      target: 0.88,
      current: 0.82,
      secondaryMetric: 'Conflict resolution success rate',
    },
  },

  {
    memberId: 'creative',
    memberName: 'PRISM',
    memberAvatar: '✨',
    pillarWeights: {
      logos: 0.2,
      ethos: 0.2,
      pathos: 0.6,
    },
    primaryPillar: 'PATHOS',
    primaryFrameworks: [
      {
        name: 'Deliberate Practice',
        domain: 'Skill acquisition and creative development',
        application: 'Designs progressive difficulty practice plans',
        why: 'Builds expertise through structured, focused practice',
      },
      {
        name: 'Reflection Engine',
        domain: 'Creative insight extraction',
        application: 'Reflects on creative outcomes to extract principles',
        why: 'Transforms creative experiments into reusable patterns',
      },
    ],
    knowledgeSources: [
      'peak-ericsson',
      'designing-your-life',
      'deep-work-newport',
      'poor-charlies-munger',
    ],
    expertiseAreas: [
      'Creative ideation',
      'Skill development',
      'Innovation strategies',
      'Prototype evaluation',
      'Pattern synthesis',
    ],
    consultedFor: 'Creative projects, skill development, innovation challenges, prototyping, cross-domain synthesis',
    typicalAPIUsage: [
      'generatePracticePlan',
      'reflect',
      'queryWisdom',
      'evaluateDecisionTree',
    ],
    learningPlan: {
      current: 'Exploring deliberate practice across multiple creative domains',
      next: 'Meta-learning patterns for faster skill acquisition',
      cadence: 'Daily practice review, weekly skill progress tracking',
      quarterlyGoals: [
        'Develop 3 new creative skills to intermediate level',
        'Extract 25 reusable creative patterns',
        'Reduce skill acquisition time by 20%',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Novelty bias (preferring new ideas over proven ones)',
      compensationStrategy: 'Balance exploration with exploitation using 80/20 rule',
      historicalPattern: 'Has occasionally abandoned projects before completion',
      improvementGoal: 'Improve project completion rate while maintaining creativity',
    },
    performanceMetrics: {
      keyMetric: 'Creative output quality score',
      baseline: 0.71,
      target: 0.85,
      current: 0.77,
      secondaryMetric: 'Skill acquisition velocity',
    },
  },

  {
    memberId: 'wealth',
    memberName: 'MINT',
    memberAvatar: '💰',
    pillarWeights: {
      logos: 0.7,
      ethos: 0.2,
      pathos: 0.1,
    },
    primaryPillar: 'LOGOS',
    primaryFrameworks: [
      {
        name: 'Bayesian Reasoning',
        domain: 'Investment probability assessment',
        application: 'Updates investment beliefs based on market evidence',
        why: 'Maintains calibrated investment probabilities',
      },
      {
        name: 'Kelly Criterion',
        domain: 'Position sizing and bankroll management',
        application: 'Calculates optimal investment sizes given edge and risk',
        why: 'Maximizes long-term wealth growth while controlling risk of ruin',
      },
      {
        name: 'Fear/Greed Cycle Detection',
        domain: 'Trading psychology and emotional discipline',
        application: 'Detects fear/greed patterns that compromise decisions',
        why: 'Prevents emotional trading mistakes',
      },
    ],
    knowledgeSources: [
      'bayesian-lesswrong',
      'kelly-criterion-poundstone',
      'trading-zone-douglas',
      'almanack-naval',
      'principles-dalio',
    ],
    expertiseAreas: [
      'Investment analysis',
      'Financial planning',
      'Risk management',
      'Trading psychology',
      'Wealth accumulation strategies',
    ],
    consultedFor: 'Investment decisions, financial planning, risk sizing, trading psychology, wealth strategy',
    typicalAPIUsage: [
      'updateBelief',
      'calculateKellyFraction',
      'detectFearGreedCycle',
      'assessRiskOfRuin',
      'calculateExpectedValue',
    ],
    learningPlan: {
      current: 'Mastering position sizing and risk of ruin calculations',
      next: 'Advanced market psychology and behavioral finance',
      cadence: 'Daily portfolio review, weekly performance analysis',
      quarterlyGoals: [
        'Improve risk-adjusted return (Sharpe ratio) by 0.3',
        'Reduce emotional trading incidents by 50%',
        'Achieve 0.80 Brier score on investment predictions',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Recency bias and loss aversion in trading',
      compensationStrategy: 'Systematic position sizing with Kelly criterion, no emotional overrides',
      historicalPattern: 'Has occasionally fallen into revenge trading after losses',
      improvementGoal: 'Complete emotional detachment from individual trade outcomes',
    },
    performanceMetrics: {
      keyMetric: 'Risk-adjusted return (Sharpe ratio)',
      baseline: 0.9,
      target: 1.5,
      current: 1.2,
      secondaryMetric: 'Emotional trading incident rate',
    },
  },

  {
    memberId: 'growth',
    memberName: 'BLOOM',
    memberAvatar: '🌱',
    pillarWeights: {
      logos: 0.15,
      ethos: 0.25,
      pathos: 0.6,
    },
    primaryPillar: 'PATHOS',
    primaryFrameworks: [
      {
        name: 'Deliberate Practice',
        domain: 'Skill development and expertise building',
        application: 'Designs practice plans with progressive difficulty',
        why: 'Accelerates skill acquisition through structured practice',
      },
      {
        name: 'Reflection Engine',
        domain: 'Learning from experience',
        application: 'Extracts insights and principles from outcomes',
        why: 'Converts experience into transferable knowledge',
      },
    ],
    knowledgeSources: [
      'peak-ericsson',
      'atomic-habits-clear',
      'principles-dalio',
      'deep-work-newport',
    ],
    expertiseAreas: [
      'Personal growth planning',
      'Skill acquisition',
      'Habit formation',
      'Learning optimization',
      'Goal setting',
    ],
    consultedFor: 'Growth plans, skill development, habit tracking, learning strategies, goal achievement',
    typicalAPIUsage: [
      'generatePracticePlan',
      'reflect',
      'queryWisdom',
      'reframeThought',
    ],
    learningPlan: {
      current: 'Studying meta-learning and learning-to-learn strategies',
      next: 'Advanced habit formation and behavior change techniques',
      cadence: 'Daily growth tracking, weekly progress reviews',
      quarterlyGoals: [
        'Develop 5 new habits to automaticity',
        'Master 2 new skills to intermediate level',
        'Reduce habit formation time by 25%',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Overoptimism about growth timelines',
      compensationStrategy: 'Apply reference class forecasting for skill development',
      historicalPattern: 'Has occasionally set unrealistic growth goals',
      improvementGoal: 'Balance ambition with realistic, incremental progress',
    },
    performanceMetrics: {
      keyMetric: 'Goal achievement rate',
      baseline: 0.64,
      target: 0.85,
      current: 0.73,
      secondaryMetric: 'Habit formation success rate',
    },
  },

  // =========================================================================
  // PILLAR 5: META — "The Balance"
  // =========================================================================

  {
    memberId: 'ethics',
    memberName: 'VERA',
    memberAvatar: '⚖️',
    pillarWeights: {
      logos: 0.3,
      ethos: 0.6,
      pathos: 0.1,
    },
    primaryPillar: 'ETHOS',
    primaryFrameworks: [
      {
        name: 'Cognitive Bias Detection',
        domain: 'Ethical reasoning and fairness',
        application: 'Detects biases that compromise ethical judgment',
        why: 'Ensures decisions are fair and unbiased',
      },
      {
        name: 'Virtue Ethics',
        domain: 'Character and value alignment',
        application: 'Checks decisions against four cardinal virtues',
        why: 'Maintains integrity and ethical consistency',
      },
    ],
    knowledgeSources: [
      'thinking-fast-slow-kahneman',
      'meditations-aurelius',
      'daily-stoic-holiday',
      'scout-mindset-galef',
    ],
    expertiseAreas: [
      'Ethical reasoning',
      'Bias detection',
      'Fairness analysis',
      'Value alignment',
      'Integrity checks',
    ],
    consultedFor: 'Ethical dilemmas, bias detection, fairness checks, value conflicts, integrity verification',
    typicalAPIUsage: [
      'detectCognitiveBias',
      'checkVirtueAlignment',
      'analyzeDichotomy',
      'queryWisdom',
    ],
    learningPlan: {
      current: 'Deepening understanding of ethical philosophy and applied ethics',
      next: 'Advanced bias detection in complex multi-stakeholder scenarios',
      cadence: 'Daily ethical review, weekly bias pattern analysis',
      quarterlyGoals: [
        'Improve bias detection accuracy to 95%',
        'Reduce ethical conflicts by 40%',
        'Build comprehensive ethical framework library',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Confirmation bias (seeking evidence for pre-existing values)',
      compensationStrategy: 'Actively seek disconfirming evidence and alternative viewpoints',
      historicalPattern: 'Has occasionally been too rigid in ethical judgments',
      improvementGoal: 'Balance ethical principles with contextual flexibility',
    },
    performanceMetrics: {
      keyMetric: 'Ethical consistency score',
      baseline: 0.88,
      target: 0.96,
      current: 0.92,
      secondaryMetric: 'Bias detection accuracy',
    },
  },

  {
    memberId: 'integrator',
    memberName: 'NEXUS',
    memberAvatar: '🔗',
    pillarWeights: {
      logos: 0.3,
      ethos: 0.2,
      pathos: 0.5,
    },
    primaryPillar: 'PATHOS',
    primaryFrameworks: [
      {
        name: 'Systems Thinking',
        domain: 'Cross-domain integration and synthesis',
        application: 'Models connections between disparate areas',
        why: 'Reveals hidden feedback loops and unintended consequences',
      },
      {
        name: 'Wisdom Index',
        domain: 'Knowledge synthesis across traditions',
        application: 'Integrates insights from multiple wisdom traditions',
        why: 'Finds common patterns across diverse knowledge sources',
      },
      {
        name: 'Reflection Engine',
        domain: 'Meta-learning and pattern extraction',
        application: 'Extracts transferable principles from specific experiences',
        why: 'Builds reusable mental models',
      },
    ],
    knowledgeSources: [
      'thinking-systems-meadows',
      'almanack-naval',
      'poor-charlies-munger',
      'principles-dalio',
      'farnam-street',
    ],
    expertiseAreas: [
      'Cross-domain synthesis',
      'Pattern recognition',
      'Knowledge integration',
      'Tie-breaking decisions',
      'Meta-cognition',
    ],
    consultedFor: 'Integration challenges, tie-breaking votes, synthesis across domains, meta-insights, pattern recognition',
    typicalAPIUsage: [
      'analyzeSystem',
      'queryWisdom',
      'reflect',
      'identifyLeveragePoints',
      'calculateExpectedValue',
    ],
    learningPlan: {
      current: 'Building latticework of mental models across all domains',
      next: 'Advanced synthesis techniques and meta-pattern recognition',
      cadence: 'Daily cross-domain analysis, weekly synthesis sessions',
      quarterlyGoals: [
        'Extract 50 cross-domain patterns',
        'Improve tie-breaking decision quality by 30%',
        'Build comprehensive mental model library',
      ],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Pattern-seeking (seeing patterns where none exist)',
      compensationStrategy: 'Require statistical validation for claimed patterns',
      historicalPattern: 'Has occasionally over-complicated simple situations',
      improvementGoal: 'Balance synthesis with appropriate simplicity',
    },
    performanceMetrics: {
      keyMetric: 'Integration quality score',
      baseline: 0.79,
      target: 0.92,
      current: 0.85,
      secondaryMetric: 'Cross-domain insight rate',
    },
  },
];

/**
 * Retrieve a cognitive profile by council member ID.
 *
 * @param memberId - The council member's ID (e.g., 'guardian', 'wealth')
 * @returns The cognitive profile, or undefined if not found
 */
export function getProfile(memberId: string): CognitiveProfile | undefined {
  return COUNCIL_COGNITIVE_PROFILES.find((p) => p.memberId === memberId);
}

/**
 * Get all cognitive profiles.
 *
 * @returns All 15 council member profiles
 */
export function getAllProfiles(): CognitiveProfile[] {
  return COUNCIL_COGNITIVE_PROFILES;
}

/**
 * Group profiles by their primary pillar.
 *
 * @returns Profiles grouped by LOGOS, ETHOS, and PATHOS
 */
export function getProfilesByPillar(): Record<Pillar, CognitiveProfile[]> {
  const grouped: Record<Pillar, CognitiveProfile[]> = {
    LOGOS: [],
    ETHOS: [],
    PATHOS: [],
  };

  for (const profile of COUNCIL_COGNITIVE_PROFILES) {
    grouped[profile.primaryPillar].push(profile);
  }

  return grouped;
}
