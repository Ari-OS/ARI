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

    // TODO: Implement actual health checks based on API response times,
    // error rates, and usage statistics
    return {
      pillar,
      health: 0.95, // Placeholder
      healthLevel: 'EXCELLENT',
      apisActive: frameworks.length,
      apisTotal: frameworks.length,
      lastActivity: now,
      topFramework: frameworks[0]?.name || 'None',
      frameworkUsage: frameworks.map((f) => ({
        framework: f.name,
        usageCount: 0, // TODO: Track actual usage
        successRate: 1.0,
      })),
      recentErrors: 0,
      avgResponseTime: 50, // ms
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

    return {
      overall,
      overallLevel,
      pillars,
      learningLoopActive: true, // TODO: Check scheduler
      learningLoopStage: 'PERFORMANCE_REVIEW', // TODO: Get from learning module
      knowledgeSources: 87, // TODO: Get from knowledge module
      knowledgeSourcesActive: 87,
      councilProfilesLoaded: 15, // TODO: Get from knowledge module
      lastUpdated: new Date(),
    };
  }

  /**
   * Get the current learning progress
   */
  public async getLearningProgress(): Promise<LearningProgress> {
    const now = new Date();

    // TODO: Implement actual learning progress tracking
    return {
      currentStage: 'PERFORMANCE_REVIEW',
      stageProgress: 0.5,
      lastReview: now,
      lastGapAnalysis: now,
      lastAssessment: now,
      nextReview: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
      nextGapAnalysis: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next week
      nextAssessment: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Next month
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
