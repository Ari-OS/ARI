import type { EventBus } from '../kernel/event-bus.js';
import type { Message } from '../kernel/types.js';
import type { MemoryManager } from '../agents/memory-manager.js';
import type { LearningMachine } from '../agents/learning-machine.js';
import { VOTING_AGENTS } from '../kernel/types.js';

/**
 * A single context layer
 */
export interface ContextLayer {
  id: number;
  name: string;
  source: string;
  content: Record<string, unknown>;
  priority: number;  // Higher = more important in conflicts
  size: number;      // Bytes
  lastUpdated: Date;
}

/**
 * Complete layered context for a request
 */
export interface LayeredContext {
  layers: ContextLayer[];
  activeContext: string;
  depth: number;
  totalSize: number;
}

/**
 * Session information for runtime context
 */
export interface Session {
  id: string;
  contextId?: string;
  trustLevel: string;
  activeTasks?: string[];
  recentDecisions?: Array<{ action: string; timestamp: Date }>;
  startedAt: Date;
}

/**
 * ContextLayerManager - 6-Layer Context System
 * 
 * Based on Dash (OpenAI's Data Agent) pattern:
 * - Layer 1: Schema Context - Type definitions, runtime schemas
 * - Layer 2: Human Annotations - User-provided context, definitions, gotchas
 * - Layer 3: Operational Patterns - Successful tool call sequences
 * - Layer 4: Institutional Knowledge - KnowledgeIndex content
 * - Layer 5: Learning Memory - Error→fix associations, discovered patterns
 * - Layer 6: Runtime Context - Current session state, active tasks
 */
export class ContextLayerManager {
  private readonly memoryManager: MemoryManager | null;
  private readonly learningMachine: LearningMachine | null;
  private readonly eventBus: EventBus;

  constructor(
    eventBus: EventBus,
    memoryManager?: MemoryManager,
    learningMachine?: LearningMachine
  ) {
    this.eventBus = eventBus;
    this.memoryManager = memoryManager || null;
    this.learningMachine = learningMachine || null;
  }

  /**
   * Layer 1: Schema Context - Type definitions, runtime schemas
   */
  loadSchemaContext(): Promise<ContextLayer> {
    const schemas = {
      trustLevels: ['system', 'operator', 'verified', 'standard', 'untrusted', 'hostile'],
      permissionTiers: ['READ_ONLY', 'WRITE_SAFE', 'WRITE_DESTRUCTIVE', 'ADMIN'],
      memoryTypes: ['FACT', 'PREFERENCE', 'PATTERN', 'CONTEXT', 'DECISION', 'QUARANTINE'],
      memoryPartitions: ['PUBLIC', 'INTERNAL', 'SENSITIVE'],
      agentIds: [...VOTING_AGENTS],
      councilPillars: ['infrastructure', 'protection', 'strategy', 'domains', 'meta'],
    };

    return Promise.resolve({
      id: 1,
      name: 'schema',
      source: 'types.ts',
      content: schemas,
      priority: 100,
      size: JSON.stringify(schemas).length,
      lastUpdated: new Date(),
    });
  }

  /**
   * Layer 2: Human Annotations - User-provided context, definitions, gotchas
   */
  async loadAnnotations(): Promise<ContextLayer> {
    if (!this.memoryManager) {
      return {
        id: 2,
        name: 'annotations',
        source: 'memory:annotations',
        content: { annotations: [] },
        priority: 90,
        size: 0,
        lastUpdated: new Date(),
      };
    }

    try {
      const annotations = await this.memoryManager.query({
        type: 'PREFERENCE',
        partition: 'INTERNAL',
        min_confidence: 0.5,
      }, 'core');

      return {
        id: 2,
        name: 'annotations',
        source: 'memory:annotations',
        content: { annotations },
        priority: 90,
        size: JSON.stringify(annotations).length,
        lastUpdated: new Date(),
      };
    } catch {
      return {
        id: 2,
        name: 'annotations',
        source: 'memory:annotations',
        content: { annotations: [] },
        priority: 90,
        size: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Layer 3: Operational Patterns - Successful tool call sequences
   */
  async loadPatterns(context: string): Promise<ContextLayer> {
    if (!this.learningMachine) {
      return {
        id: 3,
        name: 'patterns',
        source: 'learning_machine',
        content: { patterns: [] },
        priority: 80,
        size: 0,
        lastUpdated: new Date(),
      };
    }

    try {
      const patterns = await this.learningMachine.retrieve(context, { limit: 20 });

      return {
        id: 3,
        name: 'patterns',
        source: 'learning_machine',
        content: { patterns },
        priority: 80,
        size: JSON.stringify(patterns).length,
        lastUpdated: new Date(),
      };
    } catch {
      return {
        id: 3,
        name: 'patterns',
        source: 'learning_machine',
        content: { patterns: [] },
        priority: 80,
        size: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Layer 4: Institutional Knowledge - KnowledgeIndex content
   * Note: KnowledgeIndex integration to be added when available
   */
  loadKnowledge(query: string): Promise<ContextLayer> {
    // Placeholder for KnowledgeIndex integration
    // When KnowledgeIndex is available, this will search for relevant documents
    return Promise.resolve({
      id: 4,
      name: 'knowledge',
      source: 'knowledge_index',
      content: {
        documents: [],
        query,
        note: 'KnowledgeIndex integration pending',
      },
      priority: 70,
      size: 0,
      lastUpdated: new Date(),
    });
  }

  /**
   * Layer 5: Learning Memory - Error→fix associations, discovered patterns
   */
  async loadLearnings(): Promise<ContextLayer> {
    if (!this.memoryManager) {
      return {
        id: 5,
        name: 'learnings',
        source: 'memory:learnings',
        content: { learnings: [] },
        priority: 60,
        size: 0,
        lastUpdated: new Date(),
      };
    }

    try {
      const allEntries = await this.memoryManager.query({
        type: 'PATTERN',
        partition: 'INTERNAL',
        min_confidence: 0.6,
        limit: 50,
      }, 'memory_keeper');

      // Filter to learning-related entries
      const learnings = allEntries.filter(l =>
        l.provenance.source === 'LEARNING_MACHINE' ||
        l.content.toLowerCase().includes('error') ||
        l.content.toLowerCase().includes('fix') ||
        l.content.toLowerCase().includes('learned')
      );

      return {
        id: 5,
        name: 'learnings',
        source: 'memory:learnings',
        content: { learnings },
        priority: 60,
        size: JSON.stringify(learnings).length,
        lastUpdated: new Date(),
      };
    } catch {
      return {
        id: 5,
        name: 'learnings',
        source: 'memory:learnings',
        content: { learnings: [] },
        priority: 60,
        size: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Layer 6: Runtime Context - Current session state, active tasks
   */
  loadRuntimeContext(session: Session): ContextLayer {
    return {
      id: 6,
      name: 'runtime',
      source: 'session',
      content: {
        sessionId: session.id,
        contextId: session.contextId,
        trustLevel: session.trustLevel,
        activeTasks: session.activeTasks || [],
        recentDecisions: session.recentDecisions || [],
        startedAt: session.startedAt.toISOString(),
      },
      priority: 50,
      size: JSON.stringify(session).length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Build full layered context for a request
   */
  async buildContext(request: Message, session: Session): Promise<LayeredContext> {
    const [schemaLayer, annotationsLayer, patternsLayer, knowledgeLayer, learningsLayer] = await Promise.all([
      this.loadSchemaContext(),
      this.loadAnnotations(),
      this.loadPatterns(request.content),
      this.loadKnowledge(request.content),
      this.loadLearnings(),
    ]);

    // Add runtime context synchronously
    const runtimeLayer = this.loadRuntimeContext(session);

    const allLayers = [
      schemaLayer,
      annotationsLayer,
      patternsLayer,
      knowledgeLayer,
      learningsLayer,
      runtimeLayer,
    ];

    // Filter to relevant content only
    const relevant = this.filterRelevant(allLayers, request.content);

    const context: LayeredContext = {
      layers: relevant,
      activeContext: session.contextId || 'default',
      depth: relevant.length,
      totalSize: relevant.reduce((sum, l) => sum + l.size, 0),
    };

    // Emit event for observability
    this.eventBus.emit('context:loaded', {
      path: session.contextId || 'default',
      depth: context.depth,
      skills: [], // Skills are loaded separately
    });

    return context;
  }

  /**
   * Filter layers to only include relevant content
   */
  private filterRelevant(layers: ContextLayer[], query: string): ContextLayer[] {
    const queryWords = new Set(
      query.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
    );

    return layers.map(layer => {
      // Keep schema and runtime layers intact - they're always needed
      if (layer.name === 'schema' || layer.name === 'runtime') {
        return layer;
      }

      // Skip empty layers
      if (layer.size === 0) {
        return layer;
      }

      // Calculate relevance score
      const contentStr = JSON.stringify(layer.content).toLowerCase();
      const matchingWords = Array.from(queryWords).filter(w => contentStr.includes(w));
      const relevanceScore = queryWords.size > 0 
        ? matchingWords.length / queryWords.size 
        : 0;

      // If relevance is too low, clear content but keep layer for debugging
      if (relevanceScore < 0.1) {
        return { 
          ...layer, 
          content: { filtered: true, originalSize: layer.size },
          size: 0,
        };
      }

      return layer;
    }).filter(l => l.size > 0 || l.name === 'schema' || l.name === 'runtime');
  }

  /**
   * Get a specific layer by name
   */
  async getLayer(name: string, context?: string, session?: Session): Promise<ContextLayer | null> {
    switch (name) {
      case 'schema':
        return this.loadSchemaContext();
      case 'annotations':
        return this.loadAnnotations();
      case 'patterns':
        return this.loadPatterns(context || '');
      case 'knowledge':
        return this.loadKnowledge(context || '');
      case 'learnings':
        return this.loadLearnings();
      case 'runtime':
        if (!session) return null;
        return this.loadRuntimeContext(session);
      default:
        return null;
    }
  }

  /**
   * Get all layer names in order
   */
  getLayerNames(): string[] {
    return ['schema', 'annotations', 'patterns', 'knowledge', 'learnings', 'runtime'];
  }

  /**
   * Get statistics about the context layer system
   */
  async getStats(): Promise<{
    layerCount: number;
    totalSize: number;
    layerSizes: Record<string, number>;
  }> {
    const layers = await Promise.all([
      this.loadSchemaContext(),
      this.loadAnnotations(),
      this.loadPatterns(''),
      this.loadKnowledge(''),
      this.loadLearnings(),
    ]);

    const layerSizes: Record<string, number> = {};
    let totalSize = 0;

    for (const layer of layers) {
      layerSizes[layer.name] = layer.size;
      totalSize += layer.size;
    }

    return {
      layerCount: 6, // Always 6 layers
      totalSize,
      layerSizes,
    };
  }
}
