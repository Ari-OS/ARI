import { randomUUID } from 'crypto';
import type { EventBus } from '../kernel/event-bus.js';
import type { AgentId } from '../kernel/types.js';
import type { MemoryManager } from './memory-manager.js';

/**
 * Types of learned patterns
 */
export type PatternType = 'error_fix' | 'question_answer' | 'task_solution' | 'preference' | 'gotcha';

/**
 * A learned pattern from interactions
 */
export interface LearnedPattern {
  id: string;
  type: PatternType;
  trigger: string;           // What activates this pattern
  response: string;          // The learned response
  confidence: number;        // 0-1, decays over time
  successCount: number;      // Times pattern worked
  failureCount: number;      // Times pattern failed
  source: {
    interactionId: string;
    timestamp: Date;
    agent: AgentId;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interaction types for observation
 */
export type InteractionType = 'task_completed' | 'task_failed' | 'correction';

/**
 * An interaction to learn from
 */
export interface Interaction {
  id: string;
  type: InteractionType;
  success?: boolean;
  agent: AgentId;
  taskDescription?: string;
  steps?: unknown[];
  originalError?: string;
  correction?: string;
  isPreference?: boolean;
  context?: string;
  preferredBehavior?: string;
}

/**
 * Pattern retrieval options
 */
interface RetrieveOptions {
  limit?: number;
  minConfidence?: number;
  types?: PatternType[];
}

/**
 * LearningMachine - Self-learning loop for ARI
 * 
 * Observes every interaction, extracts patterns, and stores them for future retrieval.
 * Implements the Dash-style self-learning loop.
 * 
 * Pattern Types:
 * - error_fix: Error → correction associations
 * - question_answer: Q&A pairs from interactions
 * - task_solution: Successful task execution patterns
 * - preference: User preferences learned from corrections
 * - gotcha: Edge cases and pitfalls discovered
 */
export class LearningMachine {
  private patterns = new Map<string, LearnedPattern>();
  private readonly memoryManager: MemoryManager;
  private readonly eventBus: EventBus;
  private unsubscribes: (() => void)[] = [];

  // Configuration
  private readonly MIN_CONFIDENCE_TO_STORE = 0.5;
  private readonly CONFIDENCE_BOOST_ON_SUCCESS = 0.05;
  private readonly CONFIDENCE_PENALTY_ON_FAILURE = 0.1;
  private readonly MAX_CONFIDENCE = 1.0;
  private readonly MIN_CONFIDENCE = 0.0;

  constructor(memoryManager: MemoryManager, eventBus: EventBus) {
    this.memoryManager = memoryManager;
    this.eventBus = eventBus;
  }

  /**
   * Start the learning machine and set up event listeners
   */
  start(): void {
    this.setupEventListeners();
  }

  /**
   * Stop the learning machine and clean up listeners
   */
  stop(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes = [];
  }

  /**
   * Set up event listeners for learning
   */
  private setupEventListeners(): void {
    // Learn from completed tasks
    const unsubTask = this.eventBus.on('scheduler:task_complete', (data) => {
      void this.observe({
        id: data.taskId,
        type: data.success ? 'task_completed' : 'task_failed',
        success: data.success,
        agent: 'core',
        taskDescription: data.taskName,
      });
    });
    this.unsubscribes.push(unsubTask);

    // Learn from tool executions
    const unsubTool = this.eventBus.on('tool:end', (data) => {
      void this.observe({
        id: data.callId,
        type: data.success ? 'task_completed' : 'task_failed',
        success: data.success,
        agent: 'executor', // Tool executions are handled by the executor agent
        taskDescription: `Tool: ${data.toolId}`,
        steps: data.result ? [data.result] : [],
      });
    });
    this.unsubscribes.push(unsubTool);
  }

  /**
   * Observe an interaction and extract patterns
   */
  async observe(interaction: Interaction): Promise<void> {
    const extracted = this.extractPatterns(interaction);

    for (const pattern of extracted) {
      if (pattern.confidence >= this.MIN_CONFIDENCE_TO_STORE) {
        // Store pattern in memory for persistence
        try {
          await this.memoryManager.store({
            type: 'PATTERN',
            content: JSON.stringify(pattern),
            provenance: {
              source: 'LEARNING_MACHINE',
              trust_level: 'verified',
              agent: 'memory_keeper',
              chain: [interaction.id],
            },
            confidence: pattern.confidence,
            partition: 'INTERNAL',
          });
        } catch (error) {
          // Memory storage failed, keep in local cache only
          this.eventBus.emit('audit:log', {
            action: 'pattern_persist_failed',
            agent: 'learning_machine',
            trustLevel: 'system' as const,
            details: { error: error instanceof Error ? error.message : String(error) },
          });
        }

        this.patterns.set(pattern.id, pattern);

        this.eventBus.emit('memory:stored', {
          memoryId: pattern.id,
          type: 'PATTERN',
          partition: 'INTERNAL',
          agent: 'memory_keeper',
        });
      }
    }
  }

  /**
   * Extract patterns from an interaction
   */
  private extractPatterns(interaction: Interaction): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    const now = new Date();

    // Error → Fix pattern
    if (interaction.type === 'correction' && interaction.originalError && interaction.correction) {
      patterns.push({
        id: `err_${randomUUID()}`,
        type: 'error_fix',
        trigger: interaction.originalError,
        response: interaction.correction,
        confidence: 0.7,
        successCount: 1,
        failureCount: 0,
        source: {
          interactionId: interaction.id,
          timestamp: now,
          agent: interaction.agent,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Task → Solution pattern
    if (interaction.type === 'task_completed' && interaction.success && interaction.taskDescription) {
      patterns.push({
        id: `task_${randomUUID()}`,
        type: 'task_solution',
        trigger: interaction.taskDescription,
        response: JSON.stringify(interaction.steps || []),
        confidence: 0.8,
        successCount: 1,
        failureCount: 0,
        source: {
          interactionId: interaction.id,
          timestamp: now,
          agent: interaction.agent,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Preference pattern (from user corrections)
    if (interaction.type === 'correction' && interaction.isPreference && interaction.context && interaction.preferredBehavior) {
      patterns.push({
        id: `pref_${randomUUID()}`,
        type: 'preference',
        trigger: interaction.context,
        response: interaction.preferredBehavior,
        confidence: 0.9,
        successCount: 1,
        failureCount: 0,
        source: {
          interactionId: interaction.id,
          timestamp: now,
          agent: interaction.agent,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Gotcha pattern (from failed tasks)
    if (interaction.type === 'task_failed' && interaction.taskDescription) {
      patterns.push({
        id: `gotcha_${randomUUID()}`,
        type: 'gotcha',
        trigger: interaction.taskDescription,
        response: interaction.originalError || 'Task failed - investigate',
        confidence: 0.6,
        successCount: 0,
        failureCount: 1,
        source: {
          interactionId: interaction.id,
          timestamp: now,
          agent: interaction.agent,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    return patterns;
  }

  /**
   * Retrieve relevant patterns for a context
   */
  retrieve(context: string, options: RetrieveOptions = {}): Promise<LearnedPattern[]> {
    const {
      limit = 5,
      minConfidence = 0.3,
      types,
    } = options;

    let candidates = Array.from(this.patterns.values());

    // Filter by types if specified
    if (types && types.length > 0) {
      candidates = candidates.filter(p => types.includes(p.type));
    }

    // Filter by minimum confidence
    candidates = candidates.filter(p => p.confidence >= minConfidence);

    // Score and rank patterns
    const scored = candidates
      .map(pattern => ({
        pattern,
        score: this.relevanceScore(pattern, context),
      }))
      .filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return Promise.resolve(scored.map(s => s.pattern));
  }

  /**
   * Calculate relevance score for a pattern given a context
   */
  private relevanceScore(pattern: LearnedPattern, context: string): number {
    // TF-IDF style scoring
    const triggerWords = pattern.trigger.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const contextWords = new Set(context.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (triggerWords.length === 0) return 0;

    let matches = 0;
    for (const word of triggerWords) {
      if (contextWords.has(word)) matches++;
    }

    const baseScore = matches / triggerWords.length;
    const confidenceBoost = pattern.confidence * 0.3;
    const successRatio = pattern.successCount / (pattern.successCount + pattern.failureCount + 1);
    const successBoost = successRatio * 0.2;

    return baseScore + confidenceBoost + successBoost;
  }

  /**
   * Provide feedback on a pattern's effectiveness
   */
  async feedback(patternId: string, success: boolean): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    if (success) {
      pattern.successCount++;
      pattern.confidence = Math.min(this.MAX_CONFIDENCE, pattern.confidence + this.CONFIDENCE_BOOST_ON_SUCCESS);
    } else {
      pattern.failureCount++;
      pattern.confidence = Math.max(this.MIN_CONFIDENCE, pattern.confidence - this.CONFIDENCE_PENALTY_ON_FAILURE);
    }

    pattern.updatedAt = new Date();

    // Update in memory
    try {
      await this.memoryManager.store({
        type: 'PATTERN',
        content: JSON.stringify(pattern),
        provenance: {
          source: 'LEARNING_MACHINE',
          trust_level: 'verified',
          agent: 'memory_keeper',
          chain: [patternId],
        },
        confidence: pattern.confidence,
        partition: 'INTERNAL',
      });
    } catch (error) {
      this.eventBus.emit('audit:log', {
        action: 'pattern_update_failed',
        agent: 'learning_machine',
        trustLevel: 'system' as const,
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Load patterns from memory manager on startup
   */
  async loadFromMemory(): Promise<void> {
    try {
      const stored = await this.memoryManager.query({
        type: 'PATTERN',
        partition: 'INTERNAL',
        min_confidence: 0.3,
      }, 'memory_keeper');

      for (const entry of stored) {
        try {
          const pattern = JSON.parse(entry.content) as LearnedPattern;
          // Validate it's a LearnedPattern
          if (pattern.type && pattern.trigger && pattern.id) {
            // Restore dates
            pattern.createdAt = new Date(pattern.createdAt);
            pattern.updatedAt = new Date(pattern.updatedAt);
            pattern.source.timestamp = new Date(pattern.source.timestamp);
            this.patterns.set(pattern.id, pattern);
          }
        } catch {
          // Skip invalid entries
        }
      }
    } catch (error) {
      this.eventBus.emit('audit:log', {
        action: 'pattern_load_failed',
        agent: 'learning_machine',
        trustLevel: 'system' as const,
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Get statistics about stored patterns
   */
  getStats(): {
    totalPatterns: number;
    byType: Record<PatternType, number>;
    avgConfidence: number;
    avgSuccessRate: number;
  } {
    const patterns = Array.from(this.patterns.values());
    const byType: Record<PatternType, number> = {
      error_fix: 0,
      question_answer: 0,
      task_solution: 0,
      preference: 0,
      gotcha: 0,
    };

    let totalConfidence = 0;
    let totalSuccessRate = 0;

    for (const pattern of patterns) {
      byType[pattern.type]++;
      totalConfidence += pattern.confidence;
      totalSuccessRate += pattern.successCount / (pattern.successCount + pattern.failureCount + 1);
    }

    return {
      totalPatterns: patterns.length,
      byType,
      avgConfidence: patterns.length > 0 ? totalConfidence / patterns.length : 0,
      avgSuccessRate: patterns.length > 0 ? totalSuccessRate / patterns.length : 0,
    };
  }

  /**
   * Get all patterns (for debugging/testing)
   */
  getPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Clear all patterns (for testing)
   */
  clear(): void {
    this.patterns.clear();
  }
}
