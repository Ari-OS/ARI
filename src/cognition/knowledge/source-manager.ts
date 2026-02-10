/**
 * ARI Cognitive Knowledge Source Manager
 *
 * Manages the curated knowledge sources for cognitive frameworks.
 * Provides filtering, querying, and statistics for the knowledge base.
 *
 * @module cognition/knowledge/source-manager
 */

import type { KnowledgeSource, Pillar } from '../types.js';
import { COGNITIVE_KNOWLEDGE_SOURCES } from './cognitive-sources.js';

/**
 * Statistics about the knowledge source collection
 */
export interface SourceStats {
  total: number;
  enabled: number;
  disabled: number;
  byPillar: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byTrustLevel: Record<string, number>;
}

/**
 * Manages the cognitive knowledge source collection.
 * Provides filtering and querying capabilities.
 */
export class SourceManager {
  private sources: KnowledgeSource[];

  constructor(sources: KnowledgeSource[] = COGNITIVE_KNOWLEDGE_SOURCES) {
    this.sources = sources;
  }

  /**
   * Get all knowledge sources.
   * @returns All sources
   */
  getSources(): KnowledgeSource[] {
    return [...this.sources];
  }

  /**
   * Get sources filtered by pillar.
   * @param pillar The pillar to filter by
   * @returns Sources for the specified pillar
   */
  getSourcesByPillar(pillar: Pillar | 'CROSS_CUTTING'): KnowledgeSource[] {
    return this.sources.filter(s => s.pillar === pillar);
  }

  /**
   * Get sources that support a specific framework.
   * @param framework The framework name
   * @returns Sources supporting the framework
   */
  getSourcesByFramework(framework: string): KnowledgeSource[] {
    return this.sources.filter(s =>
      s.frameworks.some(f =>
        f.toLowerCase().includes(framework.toLowerCase())
      )
    );
  }

  /**
   * Get sources relevant to a specific council member.
   * @param memberId The council member ID
   * @returns Sources tagged for that member
   */
  getSourcesByMember(memberId: string): KnowledgeSource[] {
    return this.sources.filter(s => s.councilMembers.includes(memberId));
  }

  /**
   * Get only enabled sources.
   * @returns Enabled sources
   */
  getEnabledSources(): KnowledgeSource[] {
    return this.sources.filter(s => s.enabled);
  }

  /**
   * Get a specific source by ID.
   * @param id The source ID
   * @returns The source or undefined if not found
   */
  getSource(id: string): KnowledgeSource | undefined {
    return this.sources.find(s => s.id === id);
  }

  /**
   * Get statistics about the source collection.
   * @returns Aggregate statistics
   */
  getSourceStats(): SourceStats {
    const stats: SourceStats = {
      total: this.sources.length,
      enabled: 0,
      disabled: 0,
      byPillar: {},
      byCategory: {},
      byPriority: {},
      byTrustLevel: {},
    };

    for (const source of this.sources) {
      // Enabled/disabled
      if (source.enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }

      // By pillar
      stats.byPillar[source.pillar] = (stats.byPillar[source.pillar] || 0) + 1;

      // By category
      stats.byCategory[source.category] = (stats.byCategory[source.category] || 0) + 1;

      // By priority
      stats.byPriority[source.integrationPriority] = (stats.byPriority[source.integrationPriority] || 0) + 1;

      // By trust level
      stats.byTrustLevel[source.trustLevel] = (stats.byTrustLevel[source.trustLevel] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get sources by category.
   * @param category The category to filter by
   * @returns Sources in that category
   */
  getSourcesByCategory(category: KnowledgeSource['category']): KnowledgeSource[] {
    return this.sources.filter(s => s.category === category);
  }

  /**
   * Get sources by trust level.
   * @param trustLevel The trust level to filter by
   * @returns Sources with that trust level
   */
  getSourcesByTrustLevel(trustLevel: KnowledgeSource['trustLevel']): KnowledgeSource[] {
    return this.sources.filter(s => s.trustLevel === trustLevel);
  }

  /**
   * Get sources by integration priority.
   * @param priority The priority level
   * @returns Sources with that priority
   */
  getSourcesByPriority(priority: 'HIGH' | 'MEDIUM' | 'LOW'): KnowledgeSource[] {
    return this.sources.filter(s => s.integrationPriority === priority);
  }

  /**
   * Search sources by keyword (searches name, keyTopics, and frameworks).
   * @param keyword The keyword to search for
   * @returns Matching sources
   */
  searchSources(keyword: string): KnowledgeSource[] {
    const term = keyword.toLowerCase();
    return this.sources.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.keyTopics.some(t => t.toLowerCase().includes(term)) ||
      s.frameworks.some(f => f.toLowerCase().includes(term))
    );
  }

  /**
   * Get sources that need updating (based on frequency and lastFetched).
   * @returns Sources that are due for update
   */
  getSourcesDueForUpdate(): KnowledgeSource[] {
    const now = new Date();
    return this.sources.filter(s => {
      if (!s.enabled || !s.lastFetched || s.updateFrequency === 'static') {
        return false;
      }

      const lastFetched = s.lastFetched;
      const hoursSinceUpdate = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

      switch (s.updateFrequency) {
        case 'daily':
          return hoursSinceUpdate >= 24;
        case 'weekly':
          return hoursSinceUpdate >= 168; // 7 days
        case 'monthly':
          return hoursSinceUpdate >= 720; // 30 days
        default:
          return false;
      }
    });
  }

  /**
   * Get sources with fetch errors.
   * @param minErrors Minimum error count to include
   * @returns Sources with fetch errors
   */
  getSourcesWithErrors(minErrors: number = 1): KnowledgeSource[] {
    return this.sources.filter(s =>
      s.fetchErrors !== undefined && s.fetchErrors >= minErrors
    );
  }
}
