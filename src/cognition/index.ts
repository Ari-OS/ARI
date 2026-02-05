/* eslint-disable @typescript-eslint/require-await */
/**
 * ARI Cognitive Layer 0: Main Entry Point
 *
 * The Cognitive Layer provides ARI with advanced reasoning capabilities
 * through three pillars:
 *
 * - **LOGOS** (Reason): Bayesian reasoning, expected value, Kelly Criterion,
 *   decision trees, systems thinking, and antifragility analysis.
 *
 * - **ETHOS** (Character): Cognitive bias detection, emotional state monitoring,
 *   fear/greed cycle detection, and pre-decision discipline systems.
 *
 * - **PATHOS** (Growth): CBT reframing, Stoic philosophy, reflection engine,
 *   wisdom index, and meta-learning for continuous improvement.
 *
 * @module cognition
 * @version 1.0.0
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export * from './types.js';

// =============================================================================
// ERROR EXPORTS
// =============================================================================

export * from './errors.js';

// =============================================================================
// CONSTANT EXPORTS
// =============================================================================

export * from './constants.js';

// =============================================================================
// LOGOS PILLAR EXPORTS
// =============================================================================

export * from './logos/index.js';

// =============================================================================
// ETHOS PILLAR EXPORTS
// =============================================================================

export * from './ethos/index.js';

// =============================================================================
// PATHOS PILLAR EXPORTS
// =============================================================================

export * from './pathos/index.js';

// =============================================================================
// KNOWLEDGE EXPORTS
// =============================================================================

export * from './knowledge/index.js';

// =============================================================================
// LEARNING LOOP EXPORTS
// =============================================================================

export * from './learning/index.js';

// =============================================================================
// VISUALIZATION EXPORTS
// =============================================================================

export * from './visualization/index.js';

// =============================================================================
// UX EXPORTS (Dual-Coding / Interpretability)
// =============================================================================

export * from './ux/index.js';

// =============================================================================
// COGNITIVE LAYER FACADE
// =============================================================================

import { EventBus } from '../kernel/event-bus.js';
import type {
  Pillar,
  CognitiveHealth,
  PillarHealth,
  LearningProgress,
} from './types.js';
import { PILLAR_ICONS, PILLAR_NAMES, COGNITIVE_FRAMEWORKS } from './constants.js';

// =============================================================================
// COGNITIVE METRICS — Event-driven tracking (replaces hardcoded TODOs)
// =============================================================================

interface FrameworkMetrics {
  usageCount: number;
  errorCount: number;
  totalResponseTime: number;
  lastUsed: Date | null;
}

class CognitiveMetricsTracker {
  private frameworkMetrics: Map<string, FrameworkMetrics> = new Map();
  private pillarErrors: Map<Pillar, number> = new Map();
  private pillarLastActivity: Map<Pillar, Date> = new Map();

  recordUsage(framework: string, pillar: Pillar, responseTimeMs: number, success: boolean): void {
    const existing = this.frameworkMetrics.get(framework) ?? {
      usageCount: 0, errorCount: 0, totalResponseTime: 0, lastUsed: null,
    };
    existing.usageCount++;
    existing.totalResponseTime += responseTimeMs;
    if (!success) existing.errorCount++;
    existing.lastUsed = new Date();
    this.frameworkMetrics.set(framework, existing);

    this.pillarLastActivity.set(pillar, new Date());
    if (!success) {
      this.pillarErrors.set(pillar, (this.pillarErrors.get(pillar) ?? 0) + 1);
    }
  }

  getFrameworkMetrics(framework: string): FrameworkMetrics {
    return this.frameworkMetrics.get(framework) ?? {
      usageCount: 0, errorCount: 0, totalResponseTime: 0, lastUsed: null,
    };
  }

  getPillarErrors(pillar: Pillar): number {
    return this.pillarErrors.get(pillar) ?? 0;
  }

  getPillarLastActivity(pillar: Pillar): Date | null {
    return this.pillarLastActivity.get(pillar) ?? null;
  }

  getAvgResponseTime(pillar: Pillar): number {
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS).filter(f => f.pillar === pillar);
    let totalTime = 0;
    let totalCalls = 0;
    for (const f of frameworks) {
      const m = this.frameworkMetrics.get(f.name);
      if (m) {
        totalTime += m.totalResponseTime;
        totalCalls += m.usageCount;
      }
    }
    return totalCalls > 0 ? totalTime / totalCalls : 0;
  }

  getPillarHealth(pillar: Pillar): number {
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS).filter(f => f.pillar === pillar);
    if (frameworks.length === 0) return 1.0;

    let totalUsage = 0;
    let totalErrors = 0;
    for (const f of frameworks) {
      const m = this.frameworkMetrics.get(f.name);
      if (m) {
        totalUsage += m.usageCount;
        totalErrors += m.errorCount;
      }
    }

    if (totalUsage === 0) return 0.95; // No data yet — assume healthy
    const errorRate = totalErrors / totalUsage;
    return Math.max(0, 1 - errorRate);
  }

  getTopFramework(pillar: Pillar): string {
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS).filter(f => f.pillar === pillar);
    let top = frameworks[0]?.name || 'None';
    let topCount = 0;
    for (const f of frameworks) {
      const m = this.frameworkMetrics.get(f.name);
      if (m && m.usageCount > topCount) {
        topCount = m.usageCount;
        top = f.name;
      }
    }
    return top;
  }
}

/**
 * CognitionLayer provides a unified interface to all cognitive capabilities.
 *
 * This is the main entry point for interacting with the cognitive layer.
 * It manages health tracking, event emission, and provides convenient
 * access to all pillar APIs.
 *
 * @example
 * ```typescript
 * import { CognitionLayer } from './cognition/index.js';
 *
 * const cognition = CognitionLayer.getInstance();
 *
 * // Get overall health
 * const health = await cognition.getHealth();
 *
 * // Use LOGOS APIs
 * const ev = await cognition.logos.calculateExpectedValue(decision);
 *
 * // Use ETHOS APIs
 * const biases = await cognition.ethos.detectCognitiveBias(reasoning);
 *
 * // Use PATHOS APIs
 * const reframe = await cognition.pathos.reframeThought(thought);
 * ```
 */
export class CognitionLayer {
  private static instance: CognitionLayer | null = null;
  private eventBus: EventBus;
  private initialized: boolean = false;
  private initializationTime: Date | null = null;
  private metrics: CognitiveMetricsTracker = new CognitiveMetricsTracker();

  // Pillar APIs (will be populated on init)
  public logos: typeof import('./logos/index.js') | null = null;
  public ethos: typeof import('./ethos/index.js') | null = null;
  public pathos: typeof import('./pathos/index.js') | null = null;
  public knowledge: typeof import('./knowledge/index.js') | null = null;
  public learning: typeof import('./learning/index.js') | null = null;
  public visualization: typeof import('./visualization/index.js') | null = null;
  public ux: typeof import('./ux/index.js') | null = null;

  private constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? new EventBus();
  }

  /**
   * Get the singleton instance of CognitionLayer.
   * Pass an EventBus on first call to connect cognitive events to the kernel bus.
   */
  public static getInstance(eventBus?: EventBus): CognitionLayer {
    if (!CognitionLayer.instance) {
      CognitionLayer.instance = new CognitionLayer(eventBus);
    }
    return CognitionLayer.instance;
  }

  /**
   * Initialize the cognitive layer
   *
   * This loads all pillar modules and sets up event listeners.
   * Should be called once during application startup.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load pillar modules dynamically
      this.logos = await import('./logos/index.js');
      this.ethos = await import('./ethos/index.js');
      this.pathos = await import('./pathos/index.js');
      this.knowledge = await import('./knowledge/index.js');
      this.learning = await import('./learning/index.js');
      this.visualization = await import('./visualization/index.js');
      this.ux = await import('./ux/index.js');

      // Wire pillar EventBus instances to the shared bus
      this.logos.setLogosEventBus(this.eventBus);
      this.ethos.setEthosEventBus(this.eventBus);
      this.pathos.setPathosEventBus(this.eventBus);

      // Wire knowledge and learning modules to the shared bus
      if (this.knowledge && 'setKnowledgeEventBus' in this.knowledge) {
        (this.knowledge as { setKnowledgeEventBus: (bus: EventBus) => void }).setKnowledgeEventBus(this.eventBus);
      }
      if (this.learning && 'setLearningEventBus' in this.learning) {
        (this.learning as { setLearningEventBus: (bus: EventBus) => void }).setLearningEventBus(this.eventBus);
      }

      // Subscribe to cognitive events for real metrics tracking
      this.subscribeToCognitiveEvents();

      this.initialized = true;
      this.initializationTime = new Date();

      // Emit initialization event
      this.eventBus.emit('audit:log', {
        action: 'cognition:initialized',
        agent: 'CognitionLayer',
        trustLevel: 'system',
        details: {
          pillars: ['LOGOS', 'ETHOS', 'PATHOS'],
          frameworks: Object.keys(COGNITIVE_FRAMEWORKS).length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.eventBus.emit('audit:log', {
        action: 'cognition:init_failed',
        agent: 'CognitionLayer',
        trustLevel: 'system',
        details: { error: message },
      });
      throw error;
    }
  }

  /**
   * Check if the cognitive layer is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the time when the cognitive layer was initialized
   */
  public getInitializationTime(): Date | null {
    return this.initializationTime;
  }

  /**
   * Get the health status of a specific pillar
   */
  public async getPillarHealth(pillar: Pillar): Promise<PillarHealth> {
    const now = new Date();
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS).filter(
      (f) => f.pillar === pillar
    );

    const health = this.metrics.getPillarHealth(pillar);
    const healthLevel =
      health >= 0.9 ? 'EXCELLENT' :
      health >= 0.75 ? 'GOOD' :
      health >= 0.6 ? 'FAIR' :
      health >= 0.4 ? 'POOR' : 'CRITICAL';

    // Count active APIs (those with at least one usage)
    const apisActive = frameworks.filter(f => {
      const m = this.metrics.getFrameworkMetrics(f.name);
      return m.usageCount > 0;
    }).length;

    return {
      pillar,
      health,
      healthLevel,
      apisActive,
      apisTotal: frameworks.length,
      lastActivity: this.metrics.getPillarLastActivity(pillar) ?? now,
      topFramework: this.metrics.getTopFramework(pillar),
      frameworkUsage: frameworks.map((f) => {
        const m = this.metrics.getFrameworkMetrics(f.name);
        return {
          framework: f.name,
          usageCount: m.usageCount,
          successRate: m.usageCount > 0
            ? (m.usageCount - m.errorCount) / m.usageCount
            : 1.0,
        };
      }),
      recentErrors: this.metrics.getPillarErrors(pillar),
      avgResponseTime: Math.round(this.metrics.getAvgResponseTime(pillar)),
    };
  }

  /**
   * Get the overall health of the cognitive layer
   */
  public async getHealth(): Promise<CognitiveHealth> {
    const pillars = await Promise.all([
      this.getPillarHealth('LOGOS'),
      this.getPillarHealth('ETHOS'),
      this.getPillarHealth('PATHOS'),
    ]);

    const overall = pillars.reduce((sum, p) => sum + p.health, 0) / pillars.length;
    const overallLevel =
      overall >= 0.9 ? 'EXCELLENT' :
      overall >= 0.75 ? 'GOOD' :
      overall >= 0.6 ? 'FAIR' :
      overall >= 0.4 ? 'POOR' : 'CRITICAL';

    // Pull real data from knowledge and learning modules
    const knowledgeSources = this.knowledge
      ? this.knowledge.getEnabledSources().length
      : 0;
    const councilProfiles = this.knowledge
      ? this.knowledge.getAllCouncilProfiles().length
      : 0;
    const learningStatus = this.learning
      ? this.learning.getLearningStatus()
      : null;

    return {
      overall,
      overallLevel,
      pillars,
      learningLoopActive: learningStatus !== null,
      learningLoopStage: learningStatus?.currentStage ?? 'PERFORMANCE_REVIEW',
      knowledgeSources,
      knowledgeSourcesActive: knowledgeSources,
      councilProfilesLoaded: councilProfiles,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get the current learning progress
   */
  public async getLearningProgress(): Promise<LearningProgress> {
    // Delegate to learning module's real implementation
    if (this.learning) {
      return this.learning.getLearningStatus();
    }

    // Fallback if learning module not loaded
    const now = new Date();
    return {
      currentStage: 'PERFORMANCE_REVIEW',
      stageProgress: 0,
      lastReview: now,
      lastGapAnalysis: now,
      lastAssessment: now,
      nextReview: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      nextGapAnalysis: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      nextAssessment: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      recentInsights: [],
      recentInsightsCount: 0,
      improvementTrend: 'IMPROVING',
      currentGrade: 'B',
      streakDays: 0,
    };
  }

  /**
   * Get all available frameworks organized by pillar
   */
  public getFrameworks(): Record<Pillar, typeof COGNITIVE_FRAMEWORKS[keyof typeof COGNITIVE_FRAMEWORKS][]> {
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS);

    return {
      LOGOS: frameworks.filter((f) => f.pillar === 'LOGOS'),
      ETHOS: frameworks.filter((f) => f.pillar === 'ETHOS'),
      PATHOS: frameworks.filter((f) => f.pillar === 'PATHOS'),
    };
  }

  /**
   * Get pillar metadata
   */
  public getPillarInfo(pillar: Pillar): {
    name: string;
    icon: string;
    frameworks: string[];
  } {
    const frameworks = Object.values(COGNITIVE_FRAMEWORKS)
      .filter((f) => f.pillar === pillar)
      .map((f) => f.name);

    return {
      name: PILLAR_NAMES[pillar],
      icon: PILLAR_ICONS[pillar],
      frameworks,
    };
  }

  /**
   * Subscribe to cognitive events for real-time metrics tracking.
   * Events flow from LOGOS/ETHOS/PATHOS through the shared EventBus (fixed in P1-2).
   */
  private subscribeToCognitiveEvents(): void {
    // LOGOS events
    const logosEvents: Array<{ event: string; framework: string }> = [
      { event: 'cognition:belief_updated', framework: 'Bayesian Reasoning' },
      { event: 'cognition:expected_value_calculated', framework: 'Expected Value' },
      { event: 'cognition:kelly_calculated', framework: 'Kelly Criterion' },
    ];
    for (const { event, framework } of logosEvents) {
      this.eventBus.on(event as 'audit:log', () => {
        this.metrics.recordUsage(framework, 'LOGOS', 0, true);
      });
    }

    // ETHOS events
    const ethosEvents: Array<{ event: string; framework: string }> = [
      { event: 'cognition:bias_detected', framework: 'Cognitive Bias Detection' },
      { event: 'cognition:emotional_risk', framework: 'Emotional State Monitoring' },
      { event: 'cognition:discipline_check', framework: 'Pre-Decision Discipline' },
    ];
    for (const { event, framework } of ethosEvents) {
      this.eventBus.on(event as 'audit:log', () => {
        this.metrics.recordUsage(framework, 'ETHOS', 0, true);
      });
    }

    // PATHOS events
    const pathosEvents: Array<{ event: string; framework: string }> = [
      { event: 'cognition:thought_reframed', framework: 'CBT Reframing' },
      { event: 'cognition:reflection_complete', framework: 'Reflection Engine' },
      { event: 'cognition:wisdom_consulted', framework: 'Wisdom Traditions' },
      { event: 'cognition:practice_plan_created', framework: 'Deliberate Practice' },
    ];
    for (const { event, framework } of pathosEvents) {
      this.eventBus.on(event as 'audit:log', () => {
        this.metrics.recordUsage(framework, 'PATHOS', 0, true);
      });
    }
  }

  /**
   * Get the metrics tracker (for testing/introspection)
   */
  public getMetrics(): CognitiveMetricsTracker {
    return this.metrics;
  }

  /**
   * Shutdown the cognitive layer
   *
   * Cleans up resources and emits shutdown event.
   */
  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Emit shutdown event
    this.eventBus.emit('audit:log', {
      action: 'cognition:shutdown',
      agent: 'CognitionLayer',
      trustLevel: 'system',
      details: {
        uptime: this.initializationTime
          ? new Date().getTime() - this.initializationTime.getTime()
          : 0,
      },
    });

    // Clear module references
    this.logos = null;
    this.ethos = null;
    this.pathos = null;
    this.knowledge = null;
    this.learning = null;
    this.visualization = null;
    this.ux = null;

    this.initialized = false;
    this.initializationTime = null;
  }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get the singleton CognitionLayer instance
 */
export function getCognitionLayer(eventBus?: EventBus): CognitionLayer {
  return CognitionLayer.getInstance(eventBus);
}

/**
 * Initialize the cognitive layer.
 * Pass an EventBus to connect all cognitive events to the kernel bus.
 */
export async function initializeCognition(eventBus?: EventBus): Promise<CognitionLayer> {
  const layer = CognitionLayer.getInstance(eventBus);
  await layer.initialize();
  return layer;
}
