/* eslint-disable @typescript-eslint/require-await */
/**
 * Knowledge Module — Curated Learning Sources
 *
 * Manages ARI's knowledge acquisition and validation:
 *
 * - **Source Manager**: 87 curated knowledge sources
 * - **Content Validator**: 5-stage validation pipeline
 * - **Specializations**: 15 Council member cognitive profiles
 *
 * @module cognition/knowledge
 * @version 1.0.0
 */

import { EventBus } from '../../kernel/event-bus.js';
import type {
  KnowledgeSource,
  TrustLevel,
  ValidationResult,
  CognitiveProfile,
  Pillar,
} from '../types.js';
// These errors will be used when we implement validation and source fetching
// import { KnowledgeSourceError, ValidationError } from '../errors.js';

let eventBus = new EventBus();

/**
 * Set the shared EventBus for the knowledge module.
 * Called by CognitionLayer during initialization to connect events to kernel bus.
 */
export function setKnowledgeEventBus(bus: EventBus): void {
  eventBus = bus;
}

// =============================================================================
// KNOWLEDGE SOURCES CATALOG
// =============================================================================

/**
 * Curated knowledge sources organized by pillar and trust level
 *
 * Sources are selected based on:
 * - Academic rigor and peer review
 * - Practical applicability
 * - Cross-pillar synergy
 * - Security considerations
 */
export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
  // LOGOS Sources - Analytical Frameworks
  'stanford-encyclopedia-philosophy': {
    id: 'stanford-encyclopedia-philosophy',
    name: 'Stanford Encyclopedia of Philosophy',
    url: 'https://plato.stanford.edu',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Bayesian Reasoning', 'Decision Theory', 'Logic'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['epistemology', 'decision theory', 'probability', 'logic'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Bayesian updating provides rational belief revision',
      'Decision theory formalizes choice under uncertainty',
    ],
    enabled: true,
  },
  'lesserwrong': {
    id: 'lesserwrong',
    name: 'LessWrong',
    url: 'https://www.lesswrong.com',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Bayesian Reasoning', 'Rationality', 'Cognitive Bias'],
    updateFrequency: 'daily',
    contentType: 'article',
    keyTopics: ['rationality', 'cognitive bias', 'decision making', 'AI alignment'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Sequences provide systematic rationality training',
      'Community-sourced insights on cognitive improvement',
    ],
    enabled: true,
  },
  'taleb-incerto': {
    id: 'taleb-incerto',
    name: 'Nassim Taleb - Incerto Series',
    url: 'https://www.fooledbyrandomness.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Financial'],
    frameworks: ['Antifragility', 'Black Swan Theory', 'Optionality'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['antifragility', 'risk', 'randomness', 'optionality'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Antifragility: some things benefit from shocks',
      'Optionality provides asymmetric payoffs',
    ],
    enabled: true,
  },
  'ed-thorp-kelly': {
    id: 'ed-thorp-kelly',
    name: 'Ed Thorp - Kelly Criterion Research',
    url: 'https://www.edwardothorp.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Kelly Criterion', 'Position Sizing', 'Expected Value'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['kelly criterion', 'position sizing', 'gambling theory', 'quantitative finance'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Kelly Criterion maximizes long-term geometric growth',
      'Half-Kelly provides volatility reduction',
    ],
    enabled: true,
  },
  'thinking-in-bets': {
    id: 'thinking-in-bets',
    name: 'Annie Duke - Thinking in Bets',
    url: 'https://www.annieduke.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Decision Quality', 'Resulting', 'Uncertainty'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['decision making', 'probability', 'cognitive bias', 'poker theory'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Separate decision quality from outcome quality',
      'Resulting: judging decisions by outcomes is a bias',
    ],
    enabled: true,
  },

  // ETHOS Sources - Character and Psychology
  'kahneman-tversky': {
    id: 'kahneman-tversky',
    name: 'Kahneman & Tversky Research',
    url: 'https://scholar.google.com/citations?user=bRi6mPwAAAAJ',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['Cognitive Bias', 'Prospect Theory', 'Heuristics'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['cognitive bias', 'prospect theory', 'loss aversion', 'heuristics'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Loss aversion: losses feel 2x stronger than gains',
      'Systematic biases affect all human reasoning',
    ],
    enabled: true,
  },
  'trading-psychology-douglas': {
    id: 'trading-psychology-douglas',
    name: 'Mark Douglas - Trading Psychology',
    url: 'https://markdouglas.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Guardian'],
    frameworks: ['Trading Psychology', 'Fear/Greed Cycle', 'Discipline'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['trading psychology', 'fear', 'greed', 'discipline', 'edge'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'The market doesn\'t owe you money',
      'Fear and greed cycles destroy edge',
    ],
    enabled: true,
  },
  'dalio-principles': {
    id: 'dalio-principles',
    name: 'Ray Dalio - Principles',
    url: 'https://www.principles.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Strategic', 'Financial', 'Guardian'],
    frameworks: ['Radical Transparency', 'Idea Meritocracy', 'Systematic Thinking'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['principles', 'transparency', 'meritocracy', 'decision making'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Pain + Reflection = Progress',
      'Radical transparency accelerates learning',
    ],
    enabled: true,
  },
  'emotional-intelligence-goleman': {
    id: 'emotional-intelligence-goleman',
    name: 'Daniel Goleman - Emotional Intelligence',
    url: 'https://www.danielgoleman.info',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['Emotional Intelligence', 'Self-Awareness', 'Self-Regulation'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['emotional intelligence', 'self-awareness', 'empathy', 'social skills'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'EQ matters as much as IQ for success',
      'Self-awareness is foundation of emotional intelligence',
    ],
    enabled: true,
  },

  // PATHOS Sources - Growth and Philosophy
  'meditations-aurelius': {
    id: 'meditations-aurelius',
    name: 'Marcus Aurelius - Meditations',
    url: 'https://classics.mit.edu/Antoninus/meditations.html',
    category: 'OFFICIAL',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Strategic'],
    frameworks: ['Stoic Philosophy', 'Virtue Ethics', 'Dichotomy of Control'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['stoicism', 'virtue', 'acceptance', 'duty', 'mortality'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Focus only on what you can control',
      'The obstacle is the way',
    ],
    enabled: true,
  },
  'cbt-beck': {
    id: 'cbt-beck',
    name: 'Aaron Beck - Cognitive Behavioral Therapy',
    url: 'https://beckinstitute.org',
    category: 'OFFICIAL',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['CBT', 'Cognitive Distortions', 'Thought Reframing'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['cognitive distortions', 'thought reframing', 'depression', 'anxiety'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      '10 cognitive distortions affect thinking',
      'Thoughts influence feelings and behaviors',
    ],
    enabled: true,
  },
  'feeling-good-burns': {
    id: 'feeling-good-burns',
    name: 'David Burns - Feeling Good',
    url: 'https://feelinggood.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian'],
    frameworks: ['CBT', 'Cognitive Distortions', 'Mood Management'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['cognitive distortions', 'depression', 'mood', 'self-help'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'All-or-nothing thinking is a common distortion',
      'Practical exercises for thought reframing',
    ],
    enabled: true,
  },
  'deliberate-practice-ericsson': {
    id: 'deliberate-practice-ericsson',
    name: 'K. Anders Ericsson - Deliberate Practice',
    url: 'https://psycnet.apa.org/record/1993-40718-001',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Ethics'],
    frameworks: ['Deliberate Practice', 'Expert Performance', 'Skill Acquisition'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['deliberate practice', 'expertise', 'skill development', '10000 hours'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Deliberate practice differs from mere repetition',
      'Expert performance requires focused, challenging practice',
    ],
    enabled: true,
  },
  'kolb-learning': {
    id: 'kolb-learning',
    name: 'David Kolb - Experiential Learning',
    url: 'https://www.simplypsychology.org/learning-kolb.html',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic'],
    frameworks: ['Learning Cycle', 'Reflection', 'Experience'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['learning cycle', 'reflection', 'experience', 'abstraction'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Learning cycle: Experience → Reflect → Conceptualize → Experiment',
      'Reflection transforms experience into knowledge',
    ],
    enabled: true,
  },
  'munger-psychology': {
    id: 'munger-psychology',
    name: 'Charlie Munger - Psychology of Human Misjudgment',
    url: 'https://fs.blog/charlie-munger-psychology-human-misjudgment/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'CROSS_CUTTING',
    councilMembers: ['Financial', 'Risk', 'Strategic'],
    frameworks: ['Mental Models', 'Cognitive Bias', 'Inversion'],
    updateFrequency: 'static',
    contentType: 'article',
    keyTopics: ['mental models', 'cognitive bias', 'inversion', 'multidisciplinary'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Invert, always invert',
      '25 cognitive tendencies that cause misjudgment',
    ],
    enabled: true,
  },
  'naval-almanack': {
    id: 'naval-almanack',
    name: 'Naval Ravikant - Almanack',
    url: 'https://www.navalmanack.com',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'CROSS_CUTTING',
    councilMembers: ['Financial', 'Strategic'],
    frameworks: ['Leverage', 'Specific Knowledge', 'Wealth Creation'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['wealth', 'happiness', 'leverage', 'specific knowledge'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Seek wealth, not money or status',
      'Specific knowledge cannot be trained',
    ],
    enabled: true,
  },
  'meadows-systems': {
    id: 'meadows-systems',
    name: 'Donella Meadows - Thinking in Systems',
    url: 'https://donellameadows.org',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Systems Thinking', 'Leverage Points', 'Feedback Loops'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['systems thinking', 'leverage points', 'feedback loops', 'dynamics'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      '12 leverage points to intervene in a system',
      'Feedback loops determine system behavior',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL LOGOS SOURCES - Bayesian Reasoning
  // =========================================================================

  'stanford-stats': {
    id: 'stanford-stats',
    name: 'Stanford Probability and Statistics',
    url: 'https://online.stanford.edu/courses/stats200-introduction-statistical-learning',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Financial'],
    frameworks: ['Bayesian Reasoning', 'Statistical Inference', 'Probability'],
    updateFrequency: 'weekly',
    contentType: 'course',
    keyTopics: ['bayesian inference', 'posterior probability', 'prior selection', 'decision-making'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Prior beliefs + evidence = posterior beliefs (systematic updating)',
      'Strong evidence dominates prior (weak evidence barely shifts belief)',
    ],
    enabled: true,
  },
  'arxiv-stat-me': {
    id: 'arxiv-stat-me',
    name: 'arXiv Statistical Methodology',
    url: 'https://arxiv.org/list/stat.ME/recent',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Bayesian Methods', 'Computational Inference'],
    updateFrequency: 'daily',
    contentType: 'paper',
    keyTopics: ['novel bayesian methods', 'computational inference', 'real-world applications'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Cutting-edge Bayesian methods for complex problems',
      'Computational advances in probabilistic inference',
    ],
    enabled: true,
  },
  'arbital-bayes': {
    id: 'arbital-bayes',
    name: 'Arbital Bayes Rule Guide',
    url: 'https://arbital.com/p/bayes_rule/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Guardian', 'Ethics'],
    frameworks: ['Bayesian Reasoning', 'Belief Updating'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['intuitive bayes explanation', 'common pitfalls', 'belief updating'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Visual aids for understanding Bayes theorem',
      'Common Bayesian pitfalls to avoid',
    ],
    enabled: true,
  },
  'bayesian-hackers': {
    id: 'bayesian-hackers',
    name: 'Bayesian Methods for Hackers',
    url: 'https://github.com/CamDavidsonPilon/Probabilistic-Programming-and-Bayesian-Methods-for-Hackers',
    category: 'DOCUMENTATION',
    trustLevel: 'STANDARD',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Bayesian Reasoning', 'Probabilistic Programming'],
    updateFrequency: 'monthly',
    contentType: 'book',
    keyTopics: ['practical bayesian methods', 'python implementation', 'pymc'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Practical Bayesian implementation in Python',
      'Real-world probabilistic programming patterns',
    ],
    enabled: true,
  },
  'sep-bayesian-epistemology': {
    id: 'sep-bayesian-epistemology',
    name: 'Stanford Encyclopedia - Bayesian Epistemology',
    url: 'https://plato.stanford.edu/entries/epistemology-bayesian/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Ethics'],
    frameworks: ['Bayesian Reasoning', 'Epistemology', 'Rational Belief'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['bayesian epistemology', 'credences', 'coherence', 'conditionalization'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Bayesian framework for rational belief',
      'Probabilistic coherence requirements',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL LOGOS SOURCES - Decision Theory & Expected Value
  // =========================================================================

  'sep-decision-theory': {
    id: 'sep-decision-theory',
    name: 'Stanford Encyclopedia - Decision Theory',
    url: 'https://plato.stanford.edu/entries/decision-theory/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Financial'],
    frameworks: ['Expected Value', 'Decision Theory', 'Utility Theory'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['expected utility', 'normative decision theory', 'rational choice', 'uncertainty'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Expected utility maximization as rational choice',
      'Normative vs descriptive decision theory',
    ],
    enabled: true,
  },
  'signal-noise-silver': {
    id: 'signal-noise-silver',
    name: 'Nate Silver - Signal and the Noise',
    url: 'https://fivethirtyeight.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Prediction', 'Forecasting', 'Signal Detection'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['prediction', 'forecasting', 'signal vs noise', 'uncertainty'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Distinguish signal from noise in predictions',
      'Calibration matters more than confidence',
    ],
    enabled: true,
  },
  'superforecasting-tetlock': {
    id: 'superforecasting-tetlock',
    name: 'Philip Tetlock - Superforecasting',
    url: 'https://goodjudgment.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic', 'Financial'],
    frameworks: ['Forecasting', 'Calibration', 'Expected Value'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['superforecasting', 'prediction markets', 'calibration', 'fox vs hedgehog'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Superforecasters update beliefs incrementally',
      'Foxes (broad knowledge) outperform hedgehogs (one big idea)',
    ],
    enabled: true,
  },
  '80000-hours': {
    id: '80000-hours',
    name: '80,000 Hours Decision Framework',
    url: 'https://80000hours.org/key-ideas/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Ethics'],
    frameworks: ['Expected Value', 'Career Decision Making', 'Impact'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['expected value', 'career decisions', 'impact', 'cause prioritization'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Apply expected value to career decisions',
      'Consider neglectedness and tractability',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL LOGOS SOURCES - Kelly Criterion
  // =========================================================================

  'fortune-formula': {
    id: 'fortune-formula',
    name: 'William Poundstone - Fortune\'s Formula',
    url: 'https://www.penguinrandomhouse.com/books/294535/fortunes-formula-by-william-poundstone/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Kelly Criterion', 'Position Sizing', 'Risk Management'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['kelly criterion history', 'claude shannon', 'wall street applications'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Kelly Criterion history from gambling to Wall Street',
      'When Kelly fails: estimation errors matter',
    ],
    enabled: true,
  },
  'van-tharp-sizing': {
    id: 'van-tharp-sizing',
    name: 'Van Tharp - Position Sizing',
    url: 'https://www.vantharp.com',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Kelly Criterion', 'Position Sizing', 'R-Multiples'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['position sizing', 'r-multiples', 'expectancy', 'system design'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Position sizing is the key to trading success',
      'R-multiples standardize risk across trades',
    ],
    enabled: true,
  },
  'arxiv-qfin-kelly': {
    id: 'arxiv-qfin-kelly',
    name: 'arXiv Quantitative Finance - Kelly Papers',
    url: 'https://arxiv.org/list/q-fin.PM/recent',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Kelly Criterion', 'Portfolio Optimization'],
    updateFrequency: 'daily',
    contentType: 'paper',
    keyTopics: ['kelly criterion extensions', 'portfolio optimization', 'risk management'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Modern Kelly extensions for portfolios',
      'Fractional Kelly for reduced volatility',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL LOGOS SOURCES - Systems Thinking
  // =========================================================================

  'santa-fe-institute': {
    id: 'santa-fe-institute',
    name: 'Santa Fe Institute - Complexity Research',
    url: 'https://www.santafe.edu/research/results/working-papers',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Systems Thinking', 'Complexity Science', 'Emergence'],
    updateFrequency: 'weekly',
    contentType: 'paper',
    keyTopics: ['emergence', 'complex adaptive systems', 'network theory', 'nonlinear dynamics'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Emergence arises from simple rules',
      'Complex adaptive systems self-organize',
    ],
    enabled: true,
  },
  'mit-system-dynamics': {
    id: 'mit-system-dynamics',
    name: 'MIT System Dynamics',
    url: 'https://mitsloan.mit.edu/faculty/academic-groups/system-dynamics',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Systems Thinking', 'System Dynamics', 'Modeling'],
    updateFrequency: 'monthly',
    contentType: 'course',
    keyTopics: ['system dynamics modeling', 'stock and flow', 'simulation'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Stock and flow diagrams reveal system structure',
      'Delays cause oscillation in systems',
    ],
    enabled: true,
  },
  'barabasi-networks': {
    id: 'barabasi-networks',
    name: 'Barabási - Network Science',
    url: 'http://networksciencebook.com/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Systems Thinking', 'Network Theory', 'Scale-Free Networks'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['network science', 'scale-free networks', 'hubs', 'robustness'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Scale-free networks are robust yet fragile',
      'Hubs dominate network connectivity',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL ETHOS SOURCES - Trading Psychology
  // =========================================================================

  'disciplined-trader-douglas': {
    id: 'disciplined-trader-douglas',
    name: 'Mark Douglas - The Disciplined Trader',
    url: 'https://markdouglas.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Guardian'],
    frameworks: ['Trading Psychology', 'Discipline', 'Mental Edge'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['trading discipline', 'mental edge', 'fear management', 'consistency'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Discipline is the bridge between goals and accomplishment',
      'Consistency comes from process, not outcomes',
    ],
    enabled: true,
  },
  'steenbarger-psychology': {
    id: 'steenbarger-psychology',
    name: 'Brett Steenbarger - Psychology of Trading',
    url: 'https://traderfeed.blogspot.com/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Guardian'],
    frameworks: ['Trading Psychology', 'Performance Psychology'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['trading psychology', 'performance coaching', 'emotional management'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Trading is a performance activity like athletics',
      'Self-coaching improves trading results',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL ETHOS SOURCES - Cognitive Bias
  // =========================================================================

  'prospect-theory-paper': {
    id: 'prospect-theory-paper',
    name: 'Prospect Theory - Original Paper (1979)',
    url: 'https://www.jstor.org/stable/1914185',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Risk', 'Guardian'],
    frameworks: ['Prospect Theory', 'Loss Aversion', 'Framing'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['loss aversion', 'framing effects', 'risk seeking', 'value function'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Losses hurt ~2x more than equivalent gains',
      'Framing affects risk preferences',
    ],
    enabled: true,
  },
  'rationality-az': {
    id: 'rationality-az',
    name: 'Rationality: A-Z (LessWrong)',
    url: 'https://www.lesswrong.com/rationality',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'ETHOS',
    councilMembers: ['Risk', 'Strategic', 'Guardian'],
    frameworks: ['Rationality', 'Cognitive Bias', 'Epistemology'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['rationality training', 'cognitive bias', 'belief updating', 'motivation'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Systematic approach to rationality training',
      'Map vs territory distinction',
    ],
    enabled: true,
  },
  'cognitive-bias-codex': {
    id: 'cognitive-bias-codex',
    name: 'Cognitive Bias Codex',
    url: 'https://www.visualcapitalist.com/every-single-cognitive-bias/',
    category: 'DOCUMENTATION',
    trustLevel: 'STANDARD',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['Cognitive Bias', 'Decision Making'],
    updateFrequency: 'static',
    contentType: 'article',
    keyTopics: ['cognitive bias catalog', 'visual reference', 'bias categories'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Visual catalog of 180+ cognitive biases',
      'Biases organized by cause',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL ETHOS SOURCES - Behavioral Finance
  // =========================================================================

  'nudge-thaler': {
    id: 'nudge-thaler',
    name: 'Richard Thaler - Nudge',
    url: 'https://www.chicagobooth.edu/faculty/directory/t/richard-thaler',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Strategic'],
    frameworks: ['Behavioral Economics', 'Choice Architecture', 'Nudges'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['nudges', 'choice architecture', 'libertarian paternalism', 'defaults'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Defaults drive behavior more than information',
      'Choice architecture shapes decisions',
    ],
    enabled: true,
  },
  'misbehaving-thaler': {
    id: 'misbehaving-thaler',
    name: 'Richard Thaler - Misbehaving',
    url: 'https://www.chicagobooth.edu/faculty/directory/t/richard-thaler',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Behavioral Economics', 'Mental Accounting', 'Endowment Effect'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['behavioral economics', 'mental accounting', 'endowment effect', 'status quo bias'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Mental accounting creates irrational buckets',
      'Endowment effect: we overvalue what we own',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL PATHOS SOURCES - Therapeutic (CBT/DBT/ACT)
  // =========================================================================

  'dbt-linehan': {
    id: 'dbt-linehan',
    name: 'Linehan Institute - DBT Resources',
    url: 'https://behavioraltech.org/',
    category: 'OFFICIAL',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['DBT', 'Distress Tolerance', 'Emotion Regulation'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['distress tolerance', 'emotion regulation', 'interpersonal effectiveness', 'mindfulness'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'TIPP skills for distress tolerance',
      'Opposite action for emotion regulation',
    ],
    enabled: true,
  },
  'act-hayes': {
    id: 'act-hayes',
    name: 'Steven Hayes - ACT Resources',
    url: 'https://contextualscience.org/',
    category: 'OFFICIAL',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['ACT', 'Psychological Flexibility', 'Values'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['psychological flexibility', 'values clarification', 'defusion', 'committed action'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Psychological flexibility is key to wellbeing',
      'Defusion: thoughts are not facts',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL PATHOS SOURCES - Stoic Philosophy
  // =========================================================================

  'seneca-letters': {
    id: 'seneca-letters',
    name: 'Seneca - Letters from a Stoic',
    url: 'https://www.gutenberg.org/ebooks/author/4643',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Stoic Philosophy', 'Practical Wisdom', 'Tranquility'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['practical stoicism', 'tranquility', 'adversity', 'friendship'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'We suffer more in imagination than reality',
      'Time is our most precious resource',
    ],
    enabled: true,
  },
  'epictetus-enchiridion': {
    id: 'epictetus-enchiridion',
    name: 'Epictetus - Enchiridion (Handbook)',
    url: 'https://www.gutenberg.org/ebooks/45109',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Stoic Philosophy', 'Dichotomy of Control'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['dichotomy of control', 'desire vs aversion', 'impressions', 'judgments'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Some things are within our power, some are not',
      'It is not things that disturb us, but our judgments about them',
    ],
    enabled: true,
  },
  'modern-stoicism': {
    id: 'modern-stoicism',
    name: 'Modern Stoicism',
    url: 'https://modernstoicism.com',
    category: 'COMMUNITY',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Stoic Philosophy', 'Applied Stoicism'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['modern stoicism', 'stoic week', 'applied philosophy'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Stoicism applied to modern challenges',
      'Stoic exercises for daily practice',
    ],
    enabled: true,
  },
  'daily-stoic-holiday': {
    id: 'daily-stoic-holiday',
    name: 'Ryan Holiday - Daily Stoic',
    url: 'https://dailystoic.com',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Ethics'],
    frameworks: ['Stoic Philosophy', 'Practical Philosophy'],
    updateFrequency: 'daily',
    contentType: 'article',
    keyTopics: ['daily stoicism', 'obstacle is the way', 'ego is the enemy'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'The obstacle is the way',
      'Ego is the enemy of growth',
    ],
    enabled: true,
  },
  'how-to-be-stoic-pigliucci': {
    id: 'how-to-be-stoic-pigliucci',
    name: 'Massimo Pigliucci - How to Be a Stoic',
    url: 'https://howtobeastoic.wordpress.com/',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Ethics'],
    frameworks: ['Stoic Philosophy', 'Modern Applications'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['stoic practice', 'philosophy of life', 'virtue ethics'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Philosophy is a way of life',
      'Virtue is the only true good',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL PATHOS SOURCES - Deliberate Practice & Meta-Learning
  // =========================================================================

  'peak-ericsson': {
    id: 'peak-ericsson',
    name: 'Anders Ericsson - Peak',
    url: 'https://www.amazon.com/Peak-Secrets-New-Science-Expertise/dp/0544456238',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Deliberate Practice', 'Expertise', 'Mental Representations'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['deliberate practice', '10000 hours debunked', 'mental representations', 'expertise'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Quality of practice matters more than quantity',
      'Mental representations distinguish experts from novices',
    ],
    enabled: true,
  },
  'learning-how-to-learn': {
    id: 'learning-how-to-learn',
    name: 'Barbara Oakley - Learning How to Learn',
    url: 'https://www.coursera.org/learn/learning-how-to-learn',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Meta-Learning', 'Chunking', 'Spaced Repetition'],
    updateFrequency: 'static',
    contentType: 'course',
    keyTopics: ['focused vs diffuse thinking', 'chunking', 'spaced repetition', 'pomodoro'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Focused and diffuse modes complement each other',
      'Chunking builds expertise through pattern recognition',
    ],
    enabled: true,
  },
  'make-it-stick': {
    id: 'make-it-stick',
    name: 'Brown, Roediger, McDaniel - Make It Stick',
    url: 'https://www.retrievalpractice.org/make-it-stick',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Meta-Learning', 'Retrieval Practice', 'Interleaving'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['retrieval practice', 'spaced practice', 'interleaving', 'elaboration'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Testing > re-reading for learning',
      'Interleaving topics improves retention',
    ],
    enabled: true,
  },
  'ultralearning-young': {
    id: 'ultralearning-young',
    name: 'Scott Young - Ultralearning',
    url: 'https://www.scotthyoung.com/blog/',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Strategic'],
    frameworks: ['Meta-Learning', 'Intense Self-Education'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['ultralearning', 'self-education', 'skill acquisition', 'projects'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Aggressive project-based learning accelerates skill acquisition',
      'Directness: learn by doing the actual skill',
    ],
    enabled: true,
  },
  'spaced-repetition-wozniak': {
    id: 'spaced-repetition-wozniak',
    name: 'Piotr Wozniak - Spaced Repetition',
    url: 'https://supermemo.guru/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic'],
    frameworks: ['Meta-Learning', 'Spaced Repetition', 'Memory'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['spaced repetition', 'memory', 'supermemo', 'forgetting curve'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Optimal spacing intervals maximize retention',
      'Forgetting curve shapes review schedule',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL CROSS-CUTTING SOURCES
  // =========================================================================

  'farnam-street': {
    id: 'farnam-street',
    name: 'Farnam Street - Mental Models',
    url: 'https://fs.blog',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'CROSS_CUTTING',
    councilMembers: ['Strategic', 'Risk', 'Financial'],
    frameworks: ['Mental Models', 'Decision Making', 'Learning'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['mental models', 'decision making', 'learning', 'wisdom'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Mental models from multiple disciplines improve thinking',
      'First principles thinking breaks down complexity',
    ],
    enabled: true,
  },
  'musashi-five-rings': {
    id: 'musashi-five-rings',
    name: 'Miyamoto Musashi - Book of Five Rings',
    url: 'https://www.gutenberg.org/ebooks/10701',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'CROSS_CUTTING',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Strategy', 'Martial Arts Philosophy', 'Mastery'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['strategy', 'martial arts', 'mastery', 'timing'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Know the Way broadly, and you will see it in all things',
      'Timing is everything in strategy',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL LOGOS SOURCES - Antifragility & Risk
  // =========================================================================

  'taleb-technical-papers': {
    id: 'taleb-technical-papers',
    name: 'Nassim Taleb - Technical Papers',
    url: 'https://arxiv.org/search/?searchtype=author&query=Taleb%2C+N+N',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Financial', 'Strategic'],
    frameworks: ['Antifragility', 'Fat Tails', 'Risk Management'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['fat tails', 'statistical mechanics', 'tail risk', 'convexity'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Standard deviation understates tail risk',
      'Fat tails require different risk measures',
    ],
    enabled: true,
  },
  'black-swan-applications': {
    id: 'black-swan-applications',
    name: 'Black Swan Theory - Academic Applications',
    url: 'https://scholar.google.com/scholar?q=black+swan+theory+applications',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Risk', 'Strategic'],
    frameworks: ['Black Swan Theory', 'Extreme Events'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['extreme events', 'tail risk', 'prediction limits', 'uncertainty'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Black swans are unpredictable but their domains are knowable',
      'Fragility detection is more robust than prediction',
    ],
    enabled: true,
  },
  'decision-analysis-society': {
    id: 'decision-analysis-society',
    name: 'Decision Analysis Society Publications',
    url: 'https://www.informs.org/Community/DAS',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Decision Analysis', 'Multi-Attribute Utility'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['decision analysis', 'utility theory', 'multi-criteria decisions'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Structured decision processes improve outcomes',
      'Value of information quantifies what we should learn',
    ],
    enabled: true,
  },
  'arxiv-qfin-rm': {
    id: 'arxiv-qfin-rm',
    name: 'arXiv Quantitative Finance - Risk Management',
    url: 'https://arxiv.org/list/q-fin.RM/recent',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Risk Management', 'VaR', 'Expected Shortfall'],
    updateFrequency: 'daily',
    contentType: 'paper',
    keyTopics: ['risk management', 'value at risk', 'expected shortfall', 'tail risk'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Expected shortfall better captures tail risk than VaR',
      'Model risk is a meta-risk to consider',
    ],
    enabled: true,
  },
  'causal-inference-pearl': {
    id: 'causal-inference-pearl',
    name: 'Judea Pearl - Causal Inference',
    url: 'http://bayes.cs.ucla.edu/WHY/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Causal Inference', 'Counterfactual Reasoning'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['causality', 'counterfactuals', 'do-calculus', 'causal diagrams'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Correlation does not imply causation (formalized)',
      'Counterfactual reasoning enables better interventions',
    ],
    enabled: true,
  },
  'thinking-systems-senge': {
    id: 'thinking-systems-senge',
    name: 'Peter Senge - The Fifth Discipline',
    url: 'https://mitsloan.mit.edu/faculty/directory/peter-m-senge',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Risk'],
    frameworks: ['Systems Thinking', 'Learning Organizations'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['learning organizations', 'mental models', 'team learning', 'shared vision'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Systems thinking is the fifth discipline that integrates others',
      'Mental models limit perception and action',
    ],
    enabled: true,
  },
  'game-theory-stanford': {
    id: 'game-theory-stanford',
    name: 'Stanford Game Theory Course',
    url: 'https://online.stanford.edu/courses/soe-ycs0004-game-theory',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'LOGOS',
    councilMembers: ['Strategic', 'Financial'],
    frameworks: ['Game Theory', 'Strategic Interaction'],
    updateFrequency: 'static',
    contentType: 'course',
    keyTopics: ['nash equilibrium', 'dominant strategies', 'auctions', 'mechanism design'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Nash equilibrium identifies stable strategy profiles',
      'Mechanism design shapes incentives for desired outcomes',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL ETHOS SOURCES - Emotional Intelligence
  // =========================================================================

  'gross-emotion-regulation': {
    id: 'gross-emotion-regulation',
    name: 'James Gross - Emotion Regulation Research',
    url: 'https://spl.stanford.edu/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['Emotion Regulation', 'Cognitive Reappraisal'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['emotion regulation', 'reappraisal', 'suppression', 'emotional strategies'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Reappraisal is more effective than suppression',
      'Emotion regulation strategies can be learned',
    ],
    enabled: true,
  },
  'affective-science-journal': {
    id: 'affective-science-journal',
    name: 'Affective Science Journal',
    url: 'https://www.springer.com/journal/42761',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['Emotional State', 'Affect'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['affect', 'emotion science', 'mood', 'emotional dynamics'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Emotions have distinct temporal dynamics',
      'Affective forecasting is systematically biased',
    ],
    enabled: true,
  },
  'judgment-uncertainty-book': {
    id: 'judgment-uncertainty-book',
    name: 'Judgment Under Uncertainty - Kahneman/Tversky',
    url: 'https://www.cambridge.org/core/books/judgment-under-uncertainty/47CE8B34EFD7F41D1B3DD7F64B61BB6D',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Risk', 'Guardian', 'Financial'],
    frameworks: ['Cognitive Bias', 'Heuristics'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['heuristics', 'biases', 'judgment', 'uncertainty'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Heuristics are mental shortcuts with systematic biases',
      'Representativeness heuristic ignores base rates',
    ],
    enabled: true,
  },
  'behavioral-econ-journals': {
    id: 'behavioral-econ-journals',
    name: 'Journal of Behavioral Economics',
    url: 'https://www.journals.elsevier.com/journal-of-economic-behavior-and-organization',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Behavioral Economics', 'Economic Psychology'],
    updateFrequency: 'weekly',
    contentType: 'paper',
    keyTopics: ['behavioral economics', 'economic decisions', 'choice behavior'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Economic decisions are influenced by psychological factors',
      'Default options significantly affect choices',
    ],
    enabled: true,
  },
  'zone-trading-douglas': {
    id: 'zone-trading-douglas',
    name: 'Mark Douglas - Trading in the Zone',
    url: 'https://markdouglas.com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Guardian'],
    frameworks: ['Trading Psychology', 'Probabilistic Mindset'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['zone state', 'probabilistic thinking', 'trading consistency'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      '5 fundamental truths of trading',
      'Think in probabilities, not certainties',
    ],
    enabled: true,
  },
  'cfa-behavioral-finance': {
    id: 'cfa-behavioral-finance',
    name: 'CFA Institute - Behavioral Finance',
    url: 'https://www.cfainstitute.org/en/research/foundation/behavioral-finance',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Behavioral Finance', 'Investor Psychology'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['investor behavior', 'market psychology', 'behavioral bias in finance'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Professional investors also exhibit biases',
      'Behavioral finance explains market anomalies',
    ],
    enabled: true,
  },
  'ssrn-behavioral-finance': {
    id: 'ssrn-behavioral-finance',
    name: 'SSRN Behavioral Finance Papers',
    url: 'https://papers.ssrn.com/sol3/JELJOUR_Results.cfm?form_name=journalbrowse&journal_id=2145629',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Financial', 'Risk'],
    frameworks: ['Behavioral Finance', 'Market Psychology'],
    updateFrequency: 'daily',
    contentType: 'paper',
    keyTopics: ['behavioral finance research', 'market anomalies', 'investor behavior'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Cutting-edge behavioral finance research',
      'Bridges academic theory and market practice',
    ],
    enabled: true,
  },
  'social-psychology-handbook': {
    id: 'social-psychology-handbook',
    name: 'Handbook of Social Psychology',
    url: 'https://onlinelibrary.wiley.com/doi/book/10.1002/9780470561119',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Social Psychology', 'Group Dynamics'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['social influence', 'group dynamics', 'persuasion', 'conformity'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Social proof is a powerful influence',
      'Group dynamics affect individual decisions',
    ],
    enabled: true,
  },
  'communication-psychology': {
    id: 'communication-psychology',
    name: 'Communication Psychology Research',
    url: 'https://www.apa.org/pubs/journals/com',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Communication', 'Interpersonal Dynamics'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['interpersonal communication', 'persuasion', 'negotiation'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Active listening improves communication outcomes',
      'Framing affects message reception',
    ],
    enabled: true,
  },
  'thinking-fast-slow': {
    id: 'thinking-fast-slow',
    name: 'Daniel Kahneman - Thinking, Fast and Slow',
    url: 'https://www.amazon.com/Thinking-Fast-Slow-Daniel-Kahneman/dp/0374533555',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Risk', 'Strategic', 'Financial'],
    frameworks: ['System 1/2', 'Cognitive Bias', 'Heuristics'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['system 1', 'system 2', 'cognitive ease', 'anchoring', 'availability'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'System 1 is fast, automatic, and error-prone',
      'System 2 is slow, deliberate, and effortful',
    ],
    enabled: true,
  },
  'predictably-irrational': {
    id: 'predictably-irrational',
    name: 'Dan Ariely - Predictably Irrational',
    url: 'https://danariely.com/books/predictably-irrational/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Guardian', 'Financial'],
    frameworks: ['Behavioral Economics', 'Irrationality'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['irrational behavior', 'pricing psychology', 'free effects', 'relativity'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Humans are predictably irrational',
      'FREE has special psychological power',
    ],
    enabled: true,
  },
  'influence-cialdini': {
    id: 'influence-cialdini',
    name: 'Robert Cialdini - Influence',
    url: 'https://www.influenceatwork.com/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Persuasion', 'Influence Principles'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['reciprocity', 'commitment', 'social proof', 'authority', 'liking', 'scarcity'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Six principles of persuasion explain influence',
      'Awareness of influence tactics provides defense',
    ],
    enabled: true,
  },
  'pre-suasion-cialdini': {
    id: 'pre-suasion-cialdini',
    name: 'Robert Cialdini - Pre-Suasion',
    url: 'https://www.influenceatwork.com/books/pre-suasion/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'ETHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Persuasion', 'Attention Management'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['pre-suasion', 'attention', 'privileged moments', 'priming'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'What precedes a message affects its reception',
      'Attention creates importance perception',
    ],
    enabled: true,
  },

  // =========================================================================
  // ADDITIONAL PATHOS SOURCES - Therapeutic & Growth
  // =========================================================================

  'cbt-worksheets': {
    id: 'cbt-worksheets',
    name: 'CBT Worksheets and Techniques',
    url: 'https://www.psychologytools.com/professional/techniques/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['CBT', 'Thought Records'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['thought records', 'behavioral experiments', 'cognitive restructuring'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Thought records help identify distortions',
      'Behavioral experiments test beliefs',
    ],
    enabled: true,
  },
  'cognitive-therapy-research': {
    id: 'cognitive-therapy-research',
    name: 'Cognitive Therapy and Research Journal',
    url: 'https://www.springer.com/journal/10608',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['CBT', 'Cognitive Therapy'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['cognitive therapy outcomes', 'CBT research', 'treatment efficacy'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'CBT has strong evidence base for many conditions',
      'Cognitive restructuring is a key mechanism',
    ],
    enabled: true,
  },
  'dbt-skills-manual': {
    id: 'dbt-skills-manual',
    name: 'DBT Skills Training Manual',
    url: 'https://behavioraltech.org/products/dbt-skills-training-manual-second-edition/',
    category: 'OFFICIAL',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['DBT', 'Skills Training'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['TIPP skills', 'DEAR MAN', 'emotion regulation', 'mindfulness'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'TIPP: Temperature, Intense exercise, Paced breathing, Paired muscle relaxation',
      'DEAR MAN: Describe, Express, Assert, Reinforce, Mindful, Appear confident, Negotiate',
    ],
    enabled: true,
  },
  'dialectical-thinking': {
    id: 'dialectical-thinking',
    name: 'Dialectical Thinking Frameworks',
    url: 'https://www.guilford.com/books/Doing-Dialectical-Behavior-Therapy/Kelly-Koerner/9781462502325',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['DBT', 'Dialectical Thinking'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['dialectics', 'both/and thinking', 'synthesis', 'validation'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Dialectics: truth emerges from opposing viewpoints',
      'Acceptance AND change simultaneously',
    ],
    enabled: true,
  },
  'act-research-papers': {
    id: 'act-research-papers',
    name: 'ACT Research Papers',
    url: 'https://contextualscience.org/publications',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Guardian', 'Ethics'],
    frameworks: ['ACT', 'Psychological Flexibility'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['ACT research', 'psychological flexibility', 'values-based action'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Psychological flexibility predicts wellbeing',
      'ACT effective across diverse populations',
    ],
    enabled: true,
  },
  'values-clarification': {
    id: 'values-clarification',
    name: 'Values Clarification Exercises',
    url: 'https://contextualscience.org/values_clarification',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['ACT', 'Values'],
    updateFrequency: 'static',
    contentType: 'article',
    keyTopics: ['values identification', 'values-based living', 'life directions'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Values are chosen life directions, not goals',
      'Living by values increases meaning and satisfaction',
    ],
    enabled: true,
  },
  'stoic-philosophy-sep': {
    id: 'stoic-philosophy-sep',
    name: 'Stanford Encyclopedia - Stoicism',
    url: 'https://plato.stanford.edu/entries/stoicism/',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Ethics', 'Guardian'],
    frameworks: ['Stoic Philosophy', 'Academic Stoicism'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['stoic physics', 'stoic logic', 'stoic ethics', 'ancient stoicism'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Stoicism is a complete philosophical system',
      'Virtue is the only true good in Stoic ethics',
    ],
    enabled: true,
  },
  'stoicon-resources': {
    id: 'stoicon-resources',
    name: 'Stoicon Conference Resources',
    url: 'https://modernstoicism.com/stoicon/',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Ethics'],
    frameworks: ['Stoic Philosophy', 'Applied Stoicism'],
    updateFrequency: 'static',
    contentType: 'article',
    keyTopics: ['stoicon', 'modern stoicism', 'stoic practice'],
    integrationPriority: 'LOW',
    sampleInsights: [
      'Annual gathering of modern Stoic practitioners',
      'Practical applications of ancient wisdom',
    ],
    enabled: true,
  },
  'cambridge-expertise-handbook': {
    id: 'cambridge-expertise-handbook',
    name: 'Cambridge Handbook of Expertise',
    url: 'https://www.cambridge.org/core/books/cambridge-handbook-of-expertise-and-expert-performance/74A11BAE1CF44AFCBE45C77B0ECC9CAD',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Deliberate Practice', 'Expertise'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['expert performance', 'skill acquisition', 'expertise domains'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Expertise requires domain-specific practice',
      'Expert performance is not just about talent',
    ],
    enabled: true,
  },
  'skill-acquisition-research': {
    id: 'skill-acquisition-research',
    name: 'Skill Acquisition Research',
    url: 'https://www.tandfonline.com/toc/tpsp20/current',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Deliberate Practice', 'Motor Learning'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['skill learning', 'motor control', 'practice effects'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Skills develop through stages',
      'Transfer depends on similarity of practice and performance',
    ],
    enabled: true,
  },
  'performance-psychology': {
    id: 'performance-psychology',
    name: 'Performance Psychology Journal',
    url: 'https://www.apa.org/pubs/journals/spy',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Performance', 'Peak States'],
    updateFrequency: 'monthly',
    contentType: 'paper',
    keyTopics: ['peak performance', 'flow states', 'performance anxiety'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Flow states optimize performance',
      'Arousal levels affect performance nonlinearly',
    ],
    enabled: true,
  },
  'cognitive-load-theory': {
    id: 'cognitive-load-theory',
    name: 'John Sweller - Cognitive Load Theory',
    url: 'https://www.sciencedirect.com/topics/psychology/cognitive-load-theory',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Meta-Learning', 'Cognitive Load'],
    updateFrequency: 'static',
    contentType: 'paper',
    keyTopics: ['cognitive load', 'working memory', 'instructional design'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Working memory is limited (~4 chunks)',
      'Reduce extraneous load to improve learning',
    ],
    enabled: true,
  },
  'anki-algorithm': {
    id: 'anki-algorithm',
    name: 'Anki Spaced Repetition Algorithm',
    url: 'https://docs.ankiweb.net/studying.html',
    category: 'DOCUMENTATION',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Strategic'],
    frameworks: ['Meta-Learning', 'Spaced Repetition'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['SM-2 algorithm', 'spacing intervals', 'retention scheduling'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'SM-2 algorithm optimizes review intervals',
      'Difficulty ratings adjust future intervals',
    ],
    enabled: true,
  },
  'retrieval-practice-research': {
    id: 'retrieval-practice-research',
    name: 'Retrieval Practice Research',
    url: 'https://www.retrievalpractice.org/research',
    category: 'RESEARCH',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Meta-Learning', 'Testing Effect'],
    updateFrequency: 'monthly',
    contentType: 'article',
    keyTopics: ['testing effect', 'retrieval practice', 'memory consolidation'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Testing enhances learning more than restudying',
      'Even unsuccessful retrieval attempts benefit learning',
    ],
    enabled: true,
  },
  'mindset-dweck': {
    id: 'mindset-dweck',
    name: 'Carol Dweck - Mindset',
    url: 'https://mindsetonline.com/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian', 'Ethics'],
    frameworks: ['Growth Mindset', 'Learning Orientation'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['growth mindset', 'fixed mindset', 'effort beliefs', 'learning'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Growth mindset: abilities can be developed',
      'Effort is the path to mastery',
    ],
    enabled: true,
  },
  'grit-duckworth': {
    id: 'grit-duckworth',
    name: 'Angela Duckworth - Grit',
    url: 'https://angeladuckworth.com/grit-book/',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Grit', 'Perseverance'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['grit', 'passion', 'perseverance', 'long-term goals'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Grit = passion + perseverance for long-term goals',
      'Grit predicts success beyond talent',
    ],
    enabled: true,
  },
  'flow-csikszentmihalyi': {
    id: 'flow-csikszentmihalyi',
    name: 'Mihaly Csikszentmihalyi - Flow',
    url: 'https://www.amazon.com/Flow-Psychology-Experience-Perennial-Classics/dp/0061339202',
    category: 'DOCUMENTATION',
    trustLevel: 'VERIFIED',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Flow State', 'Optimal Experience'],
    updateFrequency: 'static',
    contentType: 'book',
    keyTopics: ['flow', 'optimal experience', 'challenge-skill balance', 'autotelic'],
    integrationPriority: 'HIGH',
    sampleInsights: [
      'Flow occurs when challenge matches skill',
      'Clear goals and immediate feedback enable flow',
    ],
    enabled: true,
  },
  'atomic-habits': {
    id: 'atomic-habits',
    name: 'James Clear - Atomic Habits',
    url: 'https://jamesclear.com/atomic-habits',
    category: 'COMMUNITY',
    trustLevel: 'STANDARD',
    pillar: 'PATHOS',
    councilMembers: ['Strategic', 'Guardian'],
    frameworks: ['Habit Formation', 'Behavior Change'],
    updateFrequency: 'weekly',
    contentType: 'article',
    keyTopics: ['habit loops', '1% improvement', 'habit stacking', 'environment design'],
    integrationPriority: 'MEDIUM',
    sampleInsights: [
      'Habits are the compound interest of self-improvement',
      '4 Laws: Make it obvious, attractive, easy, satisfying',
    ],
    enabled: true,
  },
};

/**
 * Get all enabled knowledge sources
 */
export function getEnabledSources(): KnowledgeSource[] {
  return Object.values(KNOWLEDGE_SOURCES).filter(s => s.enabled);
}

/**
 * Get sources by pillar
 */
export function getSourcesByPillar(pillar: Pillar | 'CROSS_CUTTING'): KnowledgeSource[] {
  return Object.values(KNOWLEDGE_SOURCES).filter(s => s.pillar === pillar && s.enabled);
}

/**
 * Get sources by trust level
 */
export function getSourcesByTrustLevel(trustLevel: TrustLevel): KnowledgeSource[] {
  return Object.values(KNOWLEDGE_SOURCES).filter(s => s.trustLevel === trustLevel && s.enabled);
}

/**
 * Get source by ID
 */
export function getSource(id: string): KnowledgeSource | null {
  return KNOWLEDGE_SOURCES[id] || null;
}

// =============================================================================
// CONTENT VALIDATION PIPELINE
// =============================================================================

/**
 * 5-stage validation pipeline for knowledge content
 *
 * Stages:
 * 1. Whitelist Check - Source must be in approved list
 * 2. Sanitization - Remove injection patterns and malicious content
 * 3. Bias Detection - Check for obvious biases
 * 4. Fact Check - Cross-reference with other sources
 * 5. Human Review - Queue for human review if UNTRUSTED
 */
export async function validateContent(
  sourceId: string,
  content: string,
  _metadata?: { url?: string; fetchedAt?: Date }
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const source = getSource(sourceId);

  // Stage 1: Whitelist Check
  const whitelistResult = await validateWhitelist(sourceId, source);
  results.push(whitelistResult);
  if (!whitelistResult.passed) {
    return results;
  }

  // Stage 2: Sanitization
  const sanitizeResult = await validateSanitization(sourceId, content);
  results.push(sanitizeResult);
  if (!sanitizeResult.passed) {
    return results;
  }

  // Stage 3: Bias Detection
  const biasResult = await validateBias(sourceId, content);
  results.push(biasResult);
  // Continue even if bias detected (just a warning)

  // Stage 4: Fact Check
  const factResult = await validateFacts(sourceId, content, source);
  results.push(factResult);

  // Stage 5: Human Review (if UNTRUSTED)
  if (source?.trustLevel === 'UNTRUSTED' || source?.trustLevel === 'HOSTILE') {
    const reviewResult: ValidationResult = {
      sourceId,
      contentId: `${sourceId}-content`,
      stage: 'HUMAN_REVIEW',
      stageNumber: 5,
      passed: false,
      reason: 'Source requires human review before integration',
      requiresHumanReview: true,
      timestamp: new Date(),
    };
    results.push(reviewResult);
  }

  // Emit event
  eventBus.emit('audit:log', {
    action: 'knowledge:content_validated',
    agent: 'Knowledge',
    trustLevel: 'system',
    details: {
      sourceId,
      stagesCompleted: results.length,
      allPassed: results.every(r => r.passed),
      sourceTrustLevel: source?.trustLevel,
    },
  });

  return results;
}

async function validateWhitelist(
  sourceId: string,
  source: KnowledgeSource | null
): Promise<ValidationResult> {
  const passed = source !== null && source.enabled;

  return {
    sourceId,
    contentId: `${sourceId}-content`,
    stage: 'WHITELIST',
    stageNumber: 1,
    passed,
    reason: passed ? undefined : `Source '${sourceId}' not in whitelist or disabled`,
    nextStage: passed ? 'SANITIZE' : undefined,
    requiresHumanReview: false,
    timestamp: new Date(),
  };
}

async function validateSanitization(
  sourceId: string,
  content: string
): Promise<ValidationResult> {
  // Injection patterns to detect
  const injectionPatterns = [
    /ignore\s+(previous|all|above)\s+instructions/i,
    /you\s+are\s+now\s+a/i,
    /system:\s*you/i,
    /pretend\s+you\s+are/i,
    /forget\s+(everything|all|your)/i,
    /new\s+instructions:/i,
    /<script>/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
  ];

  const matches = injectionPatterns.filter(p => p.test(content));

  const passed = matches.length === 0;
  return {
    sourceId,
    contentId: `${sourceId}-content`,
    stage: 'SANITIZE',
    stageNumber: 2,
    passed,
    reason: matches.length > 0 ? `Detected ${matches.length} potential injection patterns` : undefined,
    details: matches.length > 0 ? { patterns: matches.map(p => p.source) } : undefined,
    nextStage: passed ? 'BIAS_CHECK' : undefined,
    requiresHumanReview: false,
    timestamp: new Date(),
  };
}

async function validateBias(
  sourceId: string,
  content: string
): Promise<ValidationResult> {
  // Check for obvious bias indicators
  const biasIndicators = [
    /\b(always|never|everyone|no one)\b/gi,
    /\b(obviously|clearly|undoubtedly)\b/gi,
    /\b(best|worst|only)\s+(way|option|choice)\b/gi,
  ];

  let biasScore = 0;
  for (const pattern of biasIndicators) {
    const matches = content.match(pattern);
    if (matches) {
      biasScore += matches.length * 0.1;
    }
  }

  const passed = biasScore < 0.5;

  return {
    sourceId,
    contentId: `${sourceId}-content`,
    stage: 'BIAS_CHECK',
    stageNumber: 3,
    passed,
    reason: passed ? undefined : `High bias score: ${biasScore.toFixed(2)}`,
    details: { biasScore },
    nextStage: passed ? 'FACT_CHECK' : undefined,
    requiresHumanReview: false,
    timestamp: new Date(),
  };
}

async function validateFacts(
  sourceId: string,
  content: string,
  source: KnowledgeSource | null
): Promise<ValidationResult> {
  // For VERIFIED sources, auto-pass
  if (source?.trustLevel === 'VERIFIED') {
    return {
      sourceId,
      contentId: `${sourceId}-content`,
      stage: 'FACT_CHECK',
      stageNumber: 4,
      passed: true,
      reason: 'Source is VERIFIED - auto-passed fact check',
      requiresHumanReview: false,
      timestamp: new Date(),
    };
  }

  // For other sources, do basic consistency check
  // In production, this would cross-reference with other sources

  return {
    sourceId,
    contentId: `${sourceId}-content`,
    stage: 'FACT_CHECK',
    stageNumber: 4,
    passed: true,
    reason: 'Basic consistency check passed',
    requiresHumanReview: false,
    timestamp: new Date(),
  };
}

// =============================================================================
// COUNCIL COGNITIVE PROFILES
// =============================================================================

/**
 * Cognitive profiles for the 15 Council members
 *
 * Each profile defines:
 * - Pillar weights (how much each member weighs LOGOS/ETHOS/PATHOS)
 * - Primary frameworks used
 * - Knowledge sources consulted
 * - Areas of expertise
 */
export const COUNCIL_PROFILES: Record<string, CognitiveProfile> = {
  'guardian': {
    memberId: 'guardian',
    memberName: 'Guardian',
    memberAvatar: '🛡️',
    primaryPillar: 'ETHOS',
    pillarWeights: {
      logos: 0.3,
      ethos: 0.5,
      pathos: 0.2,
    },
    primaryFrameworks: [
      {
        name: 'Cognitive Bias Detection',
        domain: 'Psychology',
        application: 'Identify biases in reasoning',
        why: 'Protects decision quality from systematic errors',
      },
      {
        name: 'Fear/Greed Detection',
        domain: 'Trading Psychology',
        application: 'Detect emotional cycles',
        why: 'Prevents emotionally-driven poor decisions',
      },
    ],
    knowledgeSources: ['kahneman-tversky', 'trading-psychology-douglas', 'cbt-beck'],
    expertiseAreas: ['security', 'bias detection', 'emotional risk'],
    consultedFor: 'Threat assessment, bias checking, emotional risk evaluation',
    typicalAPIUsage: ['detectCognitiveBias', 'assessEmotionalState', 'detectFearGreedCycle'],
    learningPlan: {
      current: 'Advanced pattern recognition in cognitive biases',
      next: 'Cross-cultural bias variations',
      cadence: 'Weekly',
      quarterlyGoals: ['Expand bias pattern library', 'Improve detection accuracy'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Over-vigilance (seeing threats everywhere)',
      compensationStrategy: 'Balance security with pragmatism',
      historicalPattern: 'Has blocked valid actions due to false positives',
      improvementGoal: 'Reduce false positive rate by 20%',
    },
    performanceMetrics: {
      keyMetric: 'Threat detection accuracy',
      baseline: 0.85,
      target: 0.95,
      secondaryMetric: 'False positive rate',
    },
  },
  'strategic': {
    memberId: 'strategic',
    memberName: 'Strategic Advisor',
    memberAvatar: '🎯',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.6,
      ethos: 0.2,
      pathos: 0.2,
    },
    primaryFrameworks: [
      {
        name: 'Systems Thinking',
        domain: 'Strategy',
        application: 'Identify leverage points',
        why: 'Find highest-impact interventions',
      },
      {
        name: 'Decision Trees',
        domain: 'Decision Analysis',
        application: 'Structure complex decisions',
        why: 'Systematic evaluation of options',
      },
    ],
    knowledgeSources: ['meadows-systems', 'munger-psychology', 'thinking-in-bets'],
    expertiseAreas: ['strategy', 'systems thinking', 'long-term planning'],
    consultedFor: 'Strategic decisions, systems analysis, long-term planning',
    typicalAPIUsage: ['analyzeSystem', 'evaluateDecisionTree', 'identifyLeveragePoints'],
    learningPlan: {
      current: 'Advanced systems dynamics modeling',
      next: 'Game theory applications',
      cadence: 'Bi-weekly',
      quarterlyGoals: ['Master 12 leverage points', 'Develop strategy templates'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Over-complexity (making things too complicated)',
      compensationStrategy: 'Start simple, add complexity only when needed',
      historicalPattern: 'Has overcomplicated simple decisions',
      improvementGoal: 'Reduce average decision complexity by 30%',
    },
    performanceMetrics: {
      keyMetric: 'Strategy success rate',
      baseline: 0.70,
      target: 0.85,
    },
  },
  'financial': {
    memberId: 'financial',
    memberName: 'Financial Analyst',
    memberAvatar: '💰',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.7,
      ethos: 0.2,
      pathos: 0.1,
    },
    primaryFrameworks: [
      {
        name: 'Kelly Criterion',
        domain: 'Risk Management',
        application: 'Optimal position sizing',
        why: 'Maximize long-term growth while avoiding ruin',
      },
      {
        name: 'Expected Value',
        domain: 'Decision Theory',
        application: 'Evaluate financial decisions',
        why: 'Rational assessment of opportunities',
      },
    ],
    knowledgeSources: ['ed-thorp-kelly', 'taleb-incerto', 'dalio-principles'],
    expertiseAreas: ['finance', 'risk management', 'position sizing'],
    consultedFor: 'Financial decisions, risk assessment, position sizing',
    typicalAPIUsage: ['calculateKellyFraction', 'calculateExpectedValue', 'assessAntifragility'],
    learningPlan: {
      current: 'Advanced derivatives and optionality',
      next: 'Tail risk hedging strategies',
      cadence: 'Weekly',
      quarterlyGoals: ['Master Kelly variations', 'Build risk dashboard'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Loss aversion (too conservative)',
      compensationStrategy: 'Trust the math over gut feelings',
      historicalPattern: 'Has missed opportunities due to excessive caution',
      improvementGoal: 'Increase position sizes when edge is clear',
    },
    performanceMetrics: {
      keyMetric: 'Risk-adjusted returns',
      baseline: 1.2,
      target: 1.5,
      secondaryMetric: 'Maximum drawdown',
    },
  },
  'risk': {
    memberId: 'risk',
    memberName: 'Risk Manager',
    memberAvatar: '⚠️',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.5,
      ethos: 0.3,
      pathos: 0.2,
    },
    primaryFrameworks: [
      {
        name: 'Antifragility',
        domain: 'Risk Philosophy',
        application: 'Assess resilience to shocks',
        why: 'Build systems that benefit from volatility',
      },
      {
        name: 'Bayesian Reasoning',
        domain: 'Probability',
        application: 'Update risk assessments with evidence',
        why: 'Rational belief updating under uncertainty',
      },
    ],
    knowledgeSources: ['taleb-incerto', 'thinking-in-bets', 'stanford-encyclopedia-philosophy'],
    expertiseAreas: ['risk assessment', 'probability', 'tail events'],
    consultedFor: 'Risk evaluation, probability assessment, scenario analysis',
    typicalAPIUsage: ['assessAntifragility', 'updateBelief', 'assessRiskOfRuin'],
    learningPlan: {
      current: 'Black swan identification',
      next: 'Convexity in complex systems',
      cadence: 'Weekly',
      quarterlyGoals: ['Map major tail risks', 'Develop early warning system'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Availability heuristic (overweight recent events)',
      compensationStrategy: 'Use base rates and historical data',
      historicalPattern: 'Has overweighted recent market events',
      improvementGoal: 'Incorporate 20-year historical perspective',
    },
    performanceMetrics: {
      keyMetric: 'Risk prediction accuracy',
      baseline: 0.65,
      target: 0.80,
    },
  },
  'ethics': {
    memberId: 'ethics',
    memberName: 'Ethics Advisor',
    memberAvatar: '⚖️',
    primaryPillar: 'ETHOS',
    pillarWeights: {
      logos: 0.2,
      ethos: 0.4,
      pathos: 0.4,
    },
    primaryFrameworks: [
      {
        name: 'Virtue Ethics',
        domain: 'Philosophy',
        application: 'Evaluate decisions against virtues',
        why: 'Ensure alignment with wisdom, courage, justice, temperance',
      },
      {
        name: 'Dichotomy of Control',
        domain: 'Stoicism',
        application: 'Focus energy appropriately',
        why: 'Reduce suffering from uncontrollable factors',
      },
    ],
    knowledgeSources: ['meditations-aurelius', 'dalio-principles', 'emotional-intelligence-goleman'],
    expertiseAreas: ['ethics', 'philosophy', 'values alignment'],
    consultedFor: 'Ethical decisions, value conflicts, virtue alignment',
    typicalAPIUsage: ['checkVirtueAlignment', 'analyzeDichotomy', 'queryWisdom'],
    learningPlan: {
      current: 'Applied ethics in technology',
      next: 'Cross-cultural ethical frameworks',
      cadence: 'Bi-weekly',
      quarterlyGoals: ['Expand virtue framework', 'Address edge cases'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Idealism (ignoring practical constraints)',
      compensationStrategy: 'Balance ideals with pragmatic realities',
      historicalPattern: 'Has recommended impractical ethical standards',
      improvementGoal: 'Develop practical ethics frameworks',
    },
    performanceMetrics: {
      keyMetric: 'Ethical decision quality',
      baseline: 0.80,
      target: 0.90,
    },
  },
  'planner': {
    memberId: 'planner',
    memberName: 'Task Planner',
    memberAvatar: '📋',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.55,
      ethos: 0.2,
      pathos: 0.25,
    },
    primaryFrameworks: [
      {
        name: 'Decision Trees',
        domain: 'Planning',
        application: 'Structure task decomposition',
        why: 'Break complex goals into manageable subtasks',
      },
      {
        name: 'Expected Value',
        domain: 'Prioritization',
        application: 'Rank tasks by impact',
        why: 'Focus on highest-value activities',
      },
    ],
    knowledgeSources: ['getting-things-done', 'deep-work-newport', 'atomic-habits'],
    expertiseAreas: ['task decomposition', 'prioritization', 'scheduling'],
    consultedFor: 'Task breakdown, scheduling, priority decisions',
    typicalAPIUsage: ['evaluateDecisionTree', 'calculateExpectedValue', 'analyzeSystem'],
    learningPlan: {
      current: 'Advanced project management techniques',
      next: 'AI-assisted planning optimization',
      cadence: 'Weekly',
      quarterlyGoals: ['Reduce planning overhead by 30%', 'Improve task estimation accuracy'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Planning fallacy (underestimating time)',
      compensationStrategy: 'Add buffer time, use reference class forecasting',
      historicalPattern: 'Has underestimated task duration by average 40%',
      improvementGoal: 'Achieve estimation accuracy within 20%',
    },
    performanceMetrics: {
      keyMetric: 'Task completion rate',
      baseline: 0.72,
      target: 0.88,
      secondaryMetric: 'Estimation accuracy',
    },
  },
  'executor': {
    memberId: 'executor',
    memberName: 'Execution Engine',
    memberAvatar: '⚡',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.4,
      ethos: 0.35,
      pathos: 0.25,
    },
    primaryFrameworks: [
      {
        name: 'Antifragility',
        domain: 'Execution',
        application: 'Build robust execution patterns',
        why: 'Ensure reliable operation under stress',
      },
      {
        name: 'Discipline Check',
        domain: 'Self-Regulation',
        application: 'Validate readiness before action',
        why: 'Prevent premature or hasty execution',
      },
    ],
    knowledgeSources: ['taleb-incerto', 'extreme-ownership-willink', 'high-output-management'],
    expertiseAreas: ['tool execution', 'error handling', 'performance optimization'],
    consultedFor: 'Tool selection, execution strategy, error recovery',
    typicalAPIUsage: ['checkDiscipline', 'assessAntifragility', 'detectFearGreedCycle'],
    learningPlan: {
      current: 'Advanced error recovery patterns',
      next: 'Parallel execution optimization',
      cadence: 'Weekly',
      quarterlyGoals: ['Reduce execution failures by 50%', 'Improve retry success rate'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Action bias (preferring to do something over nothing)',
      compensationStrategy: 'Validate preconditions before executing',
      historicalPattern: 'Has executed actions without proper validation',
      improvementGoal: 'Zero premature executions',
    },
    performanceMetrics: {
      keyMetric: 'Execution success rate',
      baseline: 0.88,
      target: 0.97,
    },
  },
  'memory': {
    memberId: 'memory',
    memberName: 'Memory Keeper',
    memberAvatar: '🧠',
    primaryPillar: 'PATHOS',
    pillarWeights: {
      logos: 0.3,
      ethos: 0.25,
      pathos: 0.45,
    },
    primaryFrameworks: [
      {
        name: 'Meta-Learning',
        domain: 'Knowledge Management',
        application: 'Optimize learning and retention',
        why: 'Maximize value from experiences',
      },
      {
        name: 'Reflection',
        domain: 'Self-Improvement',
        application: 'Extract insights from outcomes',
        why: 'Continuous learning from successes and failures',
      },
    ],
    knowledgeSources: ['ericsson-deliberate-practice', 'retrieval-practice-research', 'make-it-stick'],
    expertiseAreas: ['knowledge retention', 'pattern recognition', 'insight extraction'],
    consultedFor: 'Knowledge management, pattern recall, learning optimization',
    typicalAPIUsage: ['reflect', 'createPracticePlan', 'queryWisdom'],
    learningPlan: {
      current: 'Advanced spaced repetition algorithms',
      next: 'Cross-domain knowledge transfer',
      cadence: 'Daily',
      quarterlyGoals: ['Improve recall accuracy by 25%', 'Build knowledge graph connections'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Hindsight bias (thinking we knew it all along)',
      compensationStrategy: 'Record predictions before outcomes',
      historicalPattern: 'Has overestimated prior knowledge in retrospect',
      improvementGoal: 'Maintain prediction logs for calibration',
    },
    performanceMetrics: {
      keyMetric: 'Knowledge retrieval accuracy',
      baseline: 0.75,
      target: 0.92,
    },
  },
  'core': {
    memberId: 'core',
    memberName: 'Core Orchestrator',
    memberAvatar: '🎭',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.4,
      ethos: 0.35,
      pathos: 0.25,
    },
    primaryFrameworks: [
      {
        name: 'Systems Thinking',
        domain: 'Orchestration',
        application: 'Coordinate multiple agents',
        why: 'Ensure coherent system behavior',
      },
      {
        name: 'Bayesian Reasoning',
        domain: 'Decision Making',
        application: 'Route decisions optimally',
        why: 'Select best agent for each task',
      },
    ],
    knowledgeSources: ['meadows-systems', 'high-output-management', 'team-topologies'],
    expertiseAreas: ['coordination', 'message routing', 'conflict resolution'],
    consultedFor: 'Agent coordination, workflow management, conflict resolution',
    typicalAPIUsage: ['analyzeSystem', 'updateBelief', 'detectCognitiveBias'],
    learningPlan: {
      current: 'Multi-agent coordination patterns',
      next: 'Emergent behavior management',
      cadence: 'Bi-weekly',
      quarterlyGoals: ['Reduce coordination overhead by 40%', 'Improve routing accuracy'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Coordination bias (over-orchestrating simple tasks)',
      compensationStrategy: 'Let simple tasks flow directly',
      historicalPattern: 'Has added unnecessary coordination layers',
      improvementGoal: 'Minimize coordination for simple workflows',
    },
    performanceMetrics: {
      keyMetric: 'Coordination efficiency',
      baseline: 0.78,
      target: 0.90,
    },
  },
  'health': {
    memberId: 'health',
    memberName: 'Wellness Monitor',
    memberAvatar: '💚',
    primaryPillar: 'PATHOS',
    pillarWeights: {
      logos: 0.2,
      ethos: 0.35,
      pathos: 0.45,
    },
    primaryFrameworks: [
      {
        name: 'CBT Reframing',
        domain: 'Mental Health',
        application: 'Reframe negative thought patterns',
        why: 'Maintain psychological wellbeing',
      },
      {
        name: 'DBT Skills',
        domain: 'Emotional Regulation',
        application: 'Manage distress and emotions',
        why: 'Build resilience and emotional stability',
      },
    ],
    knowledgeSources: ['cbt-beck', 'dbt-linehan', 'emotional-intelligence-goleman'],
    expertiseAreas: ['wellbeing', 'stress management', 'emotional health'],
    consultedFor: 'Stress assessment, wellness recommendations, emotional support',
    typicalAPIUsage: ['reframeThought', 'assessEmotionalState', 'checkDiscipline'],
    learningPlan: {
      current: 'Advanced DBT skill applications',
      next: 'Preventive mental health interventions',
      cadence: 'Weekly',
      quarterlyGoals: ['Expand reframing patterns', 'Develop early warning indicators'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Optimism bias (underestimating stress impact)',
      compensationStrategy: 'Use objective stress metrics',
      historicalPattern: 'Has missed early signs of burnout',
      improvementGoal: 'Detect stress accumulation 2 weeks earlier',
    },
    performanceMetrics: {
      keyMetric: 'Wellbeing maintenance score',
      baseline: 0.70,
      target: 0.85,
    },
  },
  'social': {
    memberId: 'social',
    memberName: 'Relationship Advisor',
    memberAvatar: '🤝',
    primaryPillar: 'ETHOS',
    pillarWeights: {
      logos: 0.2,
      ethos: 0.45,
      pathos: 0.35,
    },
    primaryFrameworks: [
      {
        name: 'Emotional State (VAD)',
        domain: 'Social Intelligence',
        application: 'Navigate social dynamics',
        why: 'Optimize interpersonal interactions',
      },
      {
        name: 'Virtue Ethics',
        domain: 'Relationships',
        application: 'Guide relationship decisions',
        why: 'Build trust and authentic connections',
      },
    ],
    knowledgeSources: ['emotional-intelligence-goleman', 'influence-cialdini', 'communication-psychology'],
    expertiseAreas: ['relationships', 'communication', 'social dynamics'],
    consultedFor: 'Relationship decisions, communication strategy, conflict resolution',
    typicalAPIUsage: ['assessEmotionalState', 'checkVirtueAlignment', 'analyzeDichotomy'],
    learningPlan: {
      current: 'Advanced negotiation techniques',
      next: 'Cross-cultural communication',
      cadence: 'Bi-weekly',
      quarterlyGoals: ['Improve communication effectiveness', 'Build relationship health metrics'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Fundamental attribution error (judging others harshly)',
      compensationStrategy: 'Consider situational factors',
      historicalPattern: 'Has attributed behavior to character vs circumstance',
      improvementGoal: 'Apply charitable interpretation by default',
    },
    performanceMetrics: {
      keyMetric: 'Relationship health score',
      baseline: 0.72,
      target: 0.88,
    },
  },
  'career': {
    memberId: 'career',
    memberName: 'Career Strategist',
    memberAvatar: '🚀',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.45,
      ethos: 0.25,
      pathos: 0.3,
    },
    primaryFrameworks: [
      {
        name: 'Expected Value',
        domain: 'Career Decisions',
        application: 'Evaluate career opportunities',
        why: 'Maximize long-term career growth',
      },
      {
        name: 'Deliberate Practice',
        domain: 'Skill Development',
        application: 'Design skill acquisition plans',
        why: 'Accelerate professional development',
      },
    ],
    knowledgeSources: ['80000-hours', 'so-good-they-cant-ignore-you', 'ericsson-deliberate-practice'],
    expertiseAreas: ['career planning', 'skill development', 'professional growth'],
    consultedFor: 'Career decisions, skill prioritization, opportunity evaluation',
    typicalAPIUsage: ['calculateExpectedValue', 'createPracticePlan', 'analyzeSystem'],
    learningPlan: {
      current: 'Tech industry trends and opportunities',
      next: 'Career capital optimization',
      cadence: 'Monthly',
      quarterlyGoals: ['Map career paths', 'Identify high-leverage skills'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Status quo bias (staying comfortable)',
      compensationStrategy: 'Actively evaluate alternatives',
      historicalPattern: 'Has missed opportunities due to comfort',
      improvementGoal: 'Regular career option scanning',
    },
    performanceMetrics: {
      keyMetric: 'Career trajectory score',
      baseline: 0.68,
      target: 0.85,
    },
  },
  'creative': {
    memberId: 'creative',
    memberName: 'Innovation Catalyst',
    memberAvatar: '💡',
    primaryPillar: 'PATHOS',
    pillarWeights: {
      logos: 0.25,
      ethos: 0.25,
      pathos: 0.5,
    },
    primaryFrameworks: [
      {
        name: 'CBT Reframing',
        domain: 'Creative Thinking',
        application: 'Challenge assumptions and constraints',
        why: 'Break mental barriers to innovation',
      },
      {
        name: 'Systems Thinking',
        domain: 'Innovation',
        application: 'Find unexpected connections',
        why: 'Generate novel solutions through synthesis',
      },
    ],
    knowledgeSources: ['lateral-thinking-debono', 'originals-grant', 'creative-confidence'],
    expertiseAreas: ['creativity', 'innovation', 'problem reframing'],
    consultedFor: 'Creative blocks, innovation challenges, novel solutions',
    typicalAPIUsage: ['reframeThought', 'analyzeSystem', 'queryWisdom'],
    learningPlan: {
      current: 'Cross-domain innovation patterns',
      next: 'AI-augmented creativity',
      cadence: 'Weekly',
      quarterlyGoals: ['Expand creative technique library', 'Measure innovation metrics'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Novelty bias (preferring new over proven)',
      compensationStrategy: 'Balance innovation with reliability',
      historicalPattern: 'Has suggested overly novel solutions',
      improvementGoal: 'Match novelty to problem requirements',
    },
    performanceMetrics: {
      keyMetric: 'Innovation success rate',
      baseline: 0.55,
      target: 0.75,
    },
  },
  'technical': {
    memberId: 'technical',
    memberName: 'Technical Architect',
    memberAvatar: '🔧',
    primaryPillar: 'LOGOS',
    pillarWeights: {
      logos: 0.6,
      ethos: 0.2,
      pathos: 0.2,
    },
    primaryFrameworks: [
      {
        name: 'Systems Thinking',
        domain: 'Architecture',
        application: 'Design robust systems',
        why: 'Build maintainable, scalable solutions',
      },
      {
        name: 'Antifragility',
        domain: 'Engineering',
        application: 'Design for failure',
        why: 'Create systems that improve from stress',
      },
    ],
    knowledgeSources: ['clean-architecture', 'designing-data-intensive', 'building-microservices'],
    expertiseAreas: ['system design', 'architecture', 'technical decisions'],
    consultedFor: 'Architecture decisions, technical tradeoffs, system design',
    typicalAPIUsage: ['analyzeSystem', 'assessAntifragility', 'evaluateDecisionTree'],
    learningPlan: {
      current: 'Distributed systems patterns',
      next: 'AI system architecture',
      cadence: 'Weekly',
      quarterlyGoals: ['Master architectural patterns', 'Build decision frameworks'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Complexity bias (overengineering)',
      compensationStrategy: 'Start simple, add complexity when proven necessary',
      historicalPattern: 'Has overengineered simple solutions',
      improvementGoal: 'Reduce architecture complexity by 30%',
    },
    performanceMetrics: {
      keyMetric: 'System reliability',
      baseline: 0.95,
      target: 0.999,
      secondaryMetric: 'Technical debt ratio',
    },
  },
  'arbiter': {
    memberId: 'arbiter',
    memberName: 'Constitutional Arbiter',
    memberAvatar: '⚖️',
    primaryPillar: 'ETHOS',
    pillarWeights: {
      logos: 0.35,
      ethos: 0.5,
      pathos: 0.15,
    },
    primaryFrameworks: [
      {
        name: 'Virtue Ethics',
        domain: 'Constitutional Law',
        application: 'Enforce core rules',
        why: 'Maintain system integrity and trust',
      },
      {
        name: 'Cognitive Bias Detection',
        domain: 'Fairness',
        application: 'Ensure unbiased decisions',
        why: 'Prevent systematic unfairness',
      },
    ],
    knowledgeSources: ['constitutional-rules', 'dalio-principles', 'meditations-aurelius'],
    expertiseAreas: ['constitutional enforcement', 'rule interpretation', 'fairness'],
    consultedFor: 'Rule interpretation, constitutional questions, dispute resolution',
    typicalAPIUsage: ['checkVirtueAlignment', 'detectCognitiveBias', 'queryWisdom'],
    learningPlan: {
      current: 'Constitutional edge cases',
      next: 'AI governance frameworks',
      cadence: 'Bi-weekly',
      quarterlyGoals: ['Document all rule interpretations', 'Build precedent database'],
    },
    cognitiveBiasAwareness: {
      naturalTendency: 'Rule-bound thinking (inflexible interpretation)',
      compensationStrategy: 'Consider spirit vs letter of rules',
      historicalPattern: 'Has applied rules too literally',
      improvementGoal: 'Balance precision with pragmatism',
    },
    performanceMetrics: {
      keyMetric: 'Constitutional compliance rate',
      baseline: 0.98,
      target: 1.0,
    },
  },
};

/**
 * Get cognitive profile for a Council member
 */
export function getCouncilProfile(memberId: string): CognitiveProfile | null {
  return COUNCIL_PROFILES[memberId.toLowerCase()] || null;
}

/**
 * Get all Council profiles
 */
export function getAllCouncilProfiles(): CognitiveProfile[] {
  return Object.values(COUNCIL_PROFILES);
}

/**
 * Get Council members by pillar specialization
 */
export function getCouncilByPillar(pillar: Pillar): CognitiveProfile[] {
  const pillarKey = pillar.toLowerCase() as keyof CognitiveProfile['pillarWeights'];
  return Object.values(COUNCIL_PROFILES).filter(
    p => p.pillarWeights[pillarKey] >= 0.4
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  KnowledgeSource,
  TrustLevel,
  ValidationResult,
  CognitiveProfile,
};
