/**
 * Unit tests for SourceManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SourceManager } from '../../../../src/cognition/knowledge/source-manager.js';
import { COGNITIVE_KNOWLEDGE_SOURCES } from '../../../../src/cognition/knowledge/cognitive-sources.js';
import type { KnowledgeSource } from '../../../../src/cognition/types.js';

describe('SourceManager', () => {
  let manager: SourceManager;

  beforeEach(() => {
    manager = new SourceManager();
  });

  describe('getSources', () => {
    it('should return all sources', () => {
      const sources = manager.getSources();
      expect(sources).toHaveLength(COGNITIVE_KNOWLEDGE_SOURCES.length);
      expect(sources).toEqual(COGNITIVE_KNOWLEDGE_SOURCES);
    });

    it('should return a copy (not mutate original)', () => {
      const sources = manager.getSources();
      sources.pop();
      expect(manager.getSources()).toHaveLength(COGNITIVE_KNOWLEDGE_SOURCES.length);
    });
  });

  describe('getSourcesByPillar', () => {
    it('should return only LOGOS sources', () => {
      const sources = manager.getSourcesByPillar('LOGOS');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.pillar === 'LOGOS')).toBe(true);
    });

    it('should return only ETHOS sources', () => {
      const sources = manager.getSourcesByPillar('ETHOS');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.pillar === 'ETHOS')).toBe(true);
    });

    it('should return only PATHOS sources', () => {
      const sources = manager.getSourcesByPillar('PATHOS');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.pillar === 'PATHOS')).toBe(true);
    });

    it('should return only CROSS_CUTTING sources', () => {
      const sources = manager.getSourcesByPillar('CROSS_CUTTING');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.pillar === 'CROSS_CUTTING')).toBe(true);
    });

    it('should return empty array for non-existent pillar', () => {
      const sources = manager.getSourcesByPillar('INVALID' as any);
      expect(sources).toEqual([]);
    });
  });

  describe('getSourcesByFramework', () => {
    it('should return sources for Bayesian Reasoning', () => {
      const sources = manager.getSourcesByFramework('Bayesian Reasoning');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s =>
        s.frameworks.some(f => f.toLowerCase().includes('bayesian'))
      )).toBe(true);
    });

    it('should return sources for Kelly Criterion', () => {
      const sources = manager.getSourcesByFramework('Kelly Criterion');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.id === 'kelly-criterion-poundstone')).toBe(true);
    });

    it('should return sources for CBT', () => {
      const sources = manager.getSourcesByFramework('CBT');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.id === 'feeling-good-burns')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = manager.getSourcesByFramework('bayesian');
      const upper = manager.getSourcesByFramework('BAYESIAN');
      const mixed = manager.getSourcesByFramework('BaYeSiAn');
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should return empty array for non-existent framework', () => {
      const sources = manager.getSourcesByFramework('NonExistentFramework123');
      expect(sources).toEqual([]);
    });
  });

  describe('getSourcesByMember', () => {
    it('should return sources for risk_assessor (SCOUT)', () => {
      const sources = manager.getSourcesByMember('risk_assessor');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.councilMembers.includes('risk_assessor'))).toBe(true);
    });

    it('should return sources for wealth (MINT)', () => {
      const sources = manager.getSourcesByMember('wealth');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.councilMembers.includes('wealth'))).toBe(true);
      // MINT should have Kelly, trading psychology, etc.
      expect(sources.some(s => s.id === 'kelly-criterion-poundstone')).toBe(true);
      expect(sources.some(s => s.id === 'trading-zone-douglas')).toBe(true);
    });

    it('should return sources for wellness (PULSE)', () => {
      const sources = manager.getSourcesByMember('wellness');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.councilMembers.includes('wellness'))).toBe(true);
      // PULSE should have CBT, emotional intelligence
      expect(sources.some(s => s.id === 'feeling-good-burns')).toBe(true);
    });

    it('should return sources for ethics (VERA)', () => {
      const sources = manager.getSourcesByMember('ethics');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.councilMembers.includes('ethics'))).toBe(true);
      // VERA should have Stoic philosophy, bias detection
      expect(sources.some(s => s.id === 'meditations-aurelius')).toBe(true);
    });

    it('should return sources for integrator (NEXUS)', () => {
      const sources = manager.getSourcesByMember('integrator');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.councilMembers.includes('integrator'))).toBe(true);
      // NEXUS should have cross-cutting sources
      expect(sources.some(s => s.pillar === 'CROSS_CUTTING')).toBe(true);
    });

    it('should return empty array for non-existent member', () => {
      const sources = manager.getSourcesByMember('non_existent_member');
      expect(sources).toEqual([]);
    });
  });

  describe('getEnabledSources', () => {
    it('should return only enabled sources', () => {
      const sources = manager.getEnabledSources();
      expect(sources.every(s => s.enabled)).toBe(true);
    });

    it('should match total count (all sources enabled by default)', () => {
      const all = manager.getSources();
      const enabled = manager.getEnabledSources();
      expect(enabled.length).toBe(all.length);
    });
  });

  describe('getSource', () => {
    it('should return a specific source by ID', () => {
      const source = manager.getSource('bayesian-lesswrong');
      expect(source).toBeDefined();
      expect(source?.id).toBe('bayesian-lesswrong');
      expect(source?.name).toContain('LessWrong');
    });

    it('should return another specific source', () => {
      const source = manager.getSource('feeling-good-burns');
      expect(source).toBeDefined();
      expect(source?.id).toBe('feeling-good-burns');
      expect(source?.pillar).toBe('PATHOS');
    });

    it('should return undefined for non-existent ID', () => {
      const source = manager.getSource('non-existent-source');
      expect(source).toBeUndefined();
    });
  });

  describe('getSourceStats', () => {
    it('should return accurate total count', () => {
      const stats = manager.getSourceStats();
      expect(stats.total).toBe(COGNITIVE_KNOWLEDGE_SOURCES.length);
      expect(stats.total).toBeGreaterThan(30);
    });

    it('should count enabled sources correctly', () => {
      const stats = manager.getSourceStats();
      expect(stats.enabled).toBeGreaterThan(0);
      expect(stats.enabled).toBe(stats.total); // All enabled by default
    });

    it('should count by pillar', () => {
      const stats = manager.getSourceStats();
      expect(stats.byPillar.LOGOS).toBeGreaterThan(0);
      expect(stats.byPillar.ETHOS).toBeGreaterThan(0);
      expect(stats.byPillar.PATHOS).toBeGreaterThan(0);
      expect(stats.byPillar.CROSS_CUTTING).toBeGreaterThan(0);
    });

    it('should count by category', () => {
      const stats = manager.getSourceStats();
      expect(stats.byCategory.BOOK).toBeGreaterThan(0);
      expect(stats.byCategory.RESEARCH).toBeGreaterThan(0);
    });

    it('should count by priority', () => {
      const stats = manager.getSourceStats();
      expect(stats.byPriority.HIGH).toBeGreaterThan(0);
      expect(stats.byPriority.MEDIUM).toBeGreaterThan(0);
    });

    it('should count by trust level', () => {
      const stats = manager.getSourceStats();
      expect(stats.byTrustLevel.VERIFIED).toBeGreaterThan(0);
    });

    it('should sum to total across all dimensions', () => {
      const stats = manager.getSourceStats();
      const pillarSum = Object.values(stats.byPillar).reduce((a, b) => a + b, 0);
      const categorySum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
      expect(pillarSum).toBe(stats.total);
      expect(categorySum).toBe(stats.total);
    });
  });

  describe('getSourcesByCategory', () => {
    it('should return only BOOK sources', () => {
      const sources = manager.getSourcesByCategory('BOOK');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.category === 'BOOK')).toBe(true);
    });

    it('should return only RESEARCH sources', () => {
      const sources = manager.getSourcesByCategory('RESEARCH');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.category === 'RESEARCH')).toBe(true);
    });

    it('should return only DOCUMENTATION sources', () => {
      const sources = manager.getSourcesByCategory('DOCUMENTATION');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.category === 'DOCUMENTATION')).toBe(true);
    });
  });

  describe('getSourcesByTrustLevel', () => {
    it('should return only VERIFIED sources', () => {
      const sources = manager.getSourcesByTrustLevel('VERIFIED');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.trustLevel === 'VERIFIED')).toBe(true);
    });

    it('should return only STANDARD sources', () => {
      const sources = manager.getSourcesByTrustLevel('STANDARD');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.trustLevel === 'STANDARD')).toBe(true);
    });
  });

  describe('getSourcesByPriority', () => {
    it('should return only HIGH priority sources', () => {
      const sources = manager.getSourcesByPriority('HIGH');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.integrationPriority === 'HIGH')).toBe(true);
    });

    it('should return only MEDIUM priority sources', () => {
      const sources = manager.getSourcesByPriority('MEDIUM');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.integrationPriority === 'MEDIUM')).toBe(true);
    });

    it('should return only LOW priority sources', () => {
      const sources = manager.getSourcesByPriority('LOW');
      // May be 0 if no LOW priority sources exist
      expect(sources.every(s => s.integrationPriority === 'LOW')).toBe(true);
    });
  });

  describe('searchSources', () => {
    it('should find sources by name', () => {
      const sources = manager.searchSources('Taleb');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.name.includes('Taleb'))).toBe(true);
    });

    it('should find sources by topic', () => {
      const sources = manager.searchSources('probability');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s =>
        s.keyTopics.some(t => t.toLowerCase().includes('probability'))
      )).toBe(true);
    });

    it('should find sources by framework', () => {
      const sources = manager.searchSources('bayesian');
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s =>
        s.frameworks.some(f => f.toLowerCase().includes('bayesian'))
      )).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lower = manager.searchSources('stoic');
      const upper = manager.searchSources('STOIC');
      const mixed = manager.searchSources('StOiC');
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('should return empty array for no matches', () => {
      const sources = manager.searchSources('xyzqwerty123456789');
      expect(sources).toEqual([]);
    });
  });

  describe('getSourcesDueForUpdate', () => {
    it('should return empty array when no sources have lastFetched', () => {
      const sources = manager.getSourcesDueForUpdate();
      expect(sources).toEqual([]);
    });

    it('should not include static sources', () => {
      // Create a manager with a mix of sources
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          updateFrequency: 'static',
          lastFetched: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        },
      ];
      const testManager = new SourceManager(testSources);
      const due = testManager.getSourcesDueForUpdate();
      expect(due).toEqual([]);
    });

    it('should include daily sources older than 24 hours', () => {
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          updateFrequency: 'daily',
          lastFetched: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          enabled: true,
        },
      ];
      const testManager = new SourceManager(testSources);
      const due = testManager.getSourcesDueForUpdate();
      expect(due.length).toBe(1);
    });

    it('should include weekly sources older than 7 days', () => {
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          updateFrequency: 'weekly',
          lastFetched: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
          enabled: true,
        },
      ];
      const testManager = new SourceManager(testSources);
      const due = testManager.getSourcesDueForUpdate();
      expect(due.length).toBe(1);
    });

    it('should include monthly sources older than 30 days', () => {
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          updateFrequency: 'monthly',
          lastFetched: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
          enabled: true,
        },
      ];
      const testManager = new SourceManager(testSources);
      const due = testManager.getSourcesDueForUpdate();
      expect(due.length).toBe(1);
    });
  });

  describe('getSourcesWithErrors', () => {
    it('should return empty array when no sources have errors', () => {
      const sources = manager.getSourcesWithErrors();
      expect(sources).toEqual([]);
    });

    it('should return sources with errors', () => {
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          fetchErrors: 3,
        },
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[1],
          fetchErrors: 1,
        },
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[2],
          fetchErrors: 0,
        },
      ];
      const testManager = new SourceManager(testSources);
      const withErrors = testManager.getSourcesWithErrors();
      expect(withErrors.length).toBe(2);
    });

    it('should respect minErrors threshold', () => {
      const testSources: KnowledgeSource[] = [
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[0],
          fetchErrors: 5,
        },
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[1],
          fetchErrors: 2,
        },
        {
          ...COGNITIVE_KNOWLEDGE_SOURCES[2],
          fetchErrors: 1,
        },
      ];
      const testManager = new SourceManager(testSources);
      const withErrors = testManager.getSourcesWithErrors(3);
      expect(withErrors.length).toBe(1);
      expect(withErrors[0].fetchErrors).toBe(5);
    });
  });

  describe('integration - council member sources', () => {
    it('should have Bayesian sources for risk_assessor', () => {
      const sources = manager.getSourcesByMember('risk_assessor');
      const bayesianSources = sources.filter(s =>
        s.frameworks.some(f => f.toLowerCase().includes('bayesian'))
      );
      expect(bayesianSources.length).toBeGreaterThan(0);
    });

    it('should have Kelly sources for wealth manager', () => {
      const sources = manager.getSourcesByMember('wealth');
      const kellySources = sources.filter(s =>
        s.frameworks.some(f => f.toLowerCase().includes('kelly'))
      );
      expect(kellySources.length).toBeGreaterThan(0);
    });

    it('should have CBT sources for wellness', () => {
      const sources = manager.getSourcesByMember('wellness');
      const cbtSources = sources.filter(s =>
        s.frameworks.some(f => f.toLowerCase().includes('cbt'))
      );
      expect(cbtSources.length).toBeGreaterThan(0);
    });

    it('should have Systems Thinking sources for planner', () => {
      const sources = manager.getSourcesByMember('planner');
      const systemsSources = sources.filter(s =>
        s.frameworks.some(f => f.toLowerCase().includes('systems'))
      );
      expect(systemsSources.length).toBeGreaterThan(0);
    });
  });

  describe('validation - source data integrity', () => {
    it('should have valid URLs for all sources', () => {
      const sources = manager.getSources();
      for (const source of sources) {
        expect(source.url).toMatch(/^https?:\/\/.+/);
      }
    });

    it('should have non-empty frameworks for all sources', () => {
      const sources = manager.getSources();
      for (const source of sources) {
        expect(source.frameworks.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty councilMembers for all sources', () => {
      const sources = manager.getSources();
      for (const source of sources) {
        expect(source.councilMembers.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty keyTopics for all sources', () => {
      const sources = manager.getSources();
      for (const source of sources) {
        expect(source.keyTopics.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty sampleInsights for all sources', () => {
      const sources = manager.getSources();
      for (const source of sources) {
        expect(source.sampleInsights.length).toBeGreaterThan(0);
      }
    });

    it('should have all sources enabled by default', () => {
      const sources = manager.getSources();
      expect(sources.every(s => s.enabled)).toBe(true);
    });
  });
});
