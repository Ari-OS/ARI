import { describe, it, expect } from 'vitest';
import {
  getEnabledSources,
  getSourcesByPillar,
  getSource,
  getSourcesByTrustLevel,
  KNOWLEDGE_SOURCES,
} from '../../../../src/cognition/knowledge/index.js';

describe('Knowledge Source Manager', () => {
  describe('getEnabledSources', () => {
    it('should return enabled knowledge sources', () => {
      const sources = getEnabledSources();

      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]).toHaveProperty('id');
      expect(sources[0]).toHaveProperty('name');
      expect(sources[0]).toHaveProperty('url');
      expect(sources[0]).toHaveProperty('trustLevel');
      expect(sources[0]).toHaveProperty('pillar');
    });

    it('should include sources from all pillars', () => {
      const sources = getEnabledSources();

      const pillars = new Set(sources.map(s => s.pillar));
      expect(pillars.has('LOGOS')).toBe(true);
      expect(pillars.has('ETHOS')).toBe(true);
      expect(pillars.has('PATHOS')).toBe(true);
    });

    it('should have valid trust levels for all sources', () => {
      const sources = getEnabledSources();
      const validTrustLevels = ['VERIFIED', 'STANDARD', 'UNTRUSTED'];

      for (const source of sources) {
        expect(validTrustLevels).toContain(source.trustLevel);
      }
    });

    it('should have valid URLs for all sources', () => {
      const sources = getEnabledSources();

      for (const source of sources) {
        expect(source.url).toMatch(/^https?:\/\//);
      }
    });
  });

  describe('KNOWLEDGE_SOURCES', () => {
    it('should be a non-empty record', () => {
      const sourceIds = Object.keys(KNOWLEDGE_SOURCES);
      expect(sourceIds.length).toBeGreaterThan(0);
    });

    it('should have properly structured sources', () => {
      const sources = Object.values(KNOWLEDGE_SOURCES);
      for (const source of sources) {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.url).toBeDefined();
      }
    });
  });

  describe('getSourcesByPillar', () => {
    it('should return sources for LOGOS pillar', () => {
      const sources = getSourcesByPillar('LOGOS');

      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.pillar).toBe('LOGOS');
      }
    });

    it('should return sources for ETHOS pillar', () => {
      const sources = getSourcesByPillar('ETHOS');

      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.pillar).toBe('ETHOS');
      }
    });

    it('should return sources for PATHOS pillar', () => {
      const sources = getSourcesByPillar('PATHOS');

      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.pillar).toBe('PATHOS');
      }
    });

    it('should return cross-cutting sources', () => {
      const sources = getSourcesByPillar('CROSS_CUTTING');

      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.pillar).toBe('CROSS_CUTTING');
      }
    });
  });

  describe('getSource', () => {
    it('should return source by ID', () => {
      const allSources = getEnabledSources();
      const firstId = allSources[0].id;

      const source = getSource(firstId);

      expect(source).not.toBeNull();
      expect(source?.id).toBe(firstId);
    });

    it('should return null for unknown ID', () => {
      const source = getSource('unknown-id-12345');

      expect(source).toBeNull();
    });
  });

  describe('getSourcesByTrustLevel', () => {
    it('should return VERIFIED sources', () => {
      const sources = getSourcesByTrustLevel('VERIFIED');

      for (const source of sources) {
        expect(source.trustLevel).toBe('VERIFIED');
      }
    });

    it('should return STANDARD sources', () => {
      const sources = getSourcesByTrustLevel('STANDARD');

      for (const source of sources) {
        expect(source.trustLevel).toBe('STANDARD');
      }
    });
  });

  describe('source content', () => {
    it('should have frameworks associated with LOGOS sources', () => {
      const sources = getSourcesByPillar('LOGOS');

      const hasFrameworks = sources.some(s =>
        s.frameworks && s.frameworks.length > 0
      );
      expect(hasFrameworks).toBe(true);
    });

    it('should have categories for all sources', () => {
      const sources = getEnabledSources();

      for (const source of sources) {
        expect(source.category).toBeDefined();
        expect(['OFFICIAL', 'RESEARCH', 'DOCUMENTATION', 'COMMUNITY', 'NEWS']).toContain(source.category);
      }
    });

    it('should have key topics for sources', () => {
      const sources = getEnabledSources();

      const hasTopics = sources.some(s =>
        s.keyTopics && s.keyTopics.length > 0
      );
      expect(hasTopics).toBe(true);
    });
  });
});
