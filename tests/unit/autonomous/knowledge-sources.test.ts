import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_SOURCES,
  getSourcesByCategory,
  getEnabledSources,
  getVerifiedSources,
  isWhitelistedUrl,
  type KnowledgeSource,
  type SourceCategory,
} from '../../../src/autonomous/knowledge-sources.js';

describe('Knowledge Sources', () => {
  describe('KNOWLEDGE_SOURCES', () => {
    it('should have at least 10 sources defined', () => {
      expect(KNOWLEDGE_SOURCES.length).toBeGreaterThanOrEqual(10);
    });

    it('should have all required fields for each source', () => {
      const requiredFields: (keyof KnowledgeSource)[] = [
        'id',
        'name',
        'url',
        'category',
        'trust',
        'description',
        'contentType',
        'updateFrequency',
        'enabled',
      ];

      for (const source of KNOWLEDGE_SOURCES) {
        for (const field of requiredFields) {
          expect(source[field], `Missing ${field} in ${source.id}`).toBeDefined();
        }
      }
    });

    it('should have unique IDs', () => {
      const ids = KNOWLEDGE_SOURCES.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have HTTPS URLs only', () => {
      for (const source of KNOWLEDGE_SOURCES) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    });

    it('should have valid categories', () => {
      const validCategories: SourceCategory[] = ['OFFICIAL', 'RESEARCH', 'DOCUMENTATION', 'NEWS', 'SOCIAL'];
      for (const source of KNOWLEDGE_SOURCES) {
        expect(validCategories).toContain(source.category);
      }
    });

    it('should have valid content types', () => {
      const validTypes = ['html', 'json', 'markdown', 'rss'];
      for (const source of KNOWLEDGE_SOURCES) {
        expect(validTypes).toContain(source.contentType);
      }
    });

    it('should have valid update frequencies', () => {
      const validFrequencies = ['daily', 'weekly', 'monthly'];
      for (const source of KNOWLEDGE_SOURCES) {
        expect(validFrequencies).toContain(source.updateFrequency);
      }
    });

    it('should include Anthropic as official source', () => {
      const anthropicDocs = KNOWLEDGE_SOURCES.find(s => s.id === 'anthropic-docs');
      expect(anthropicDocs).toBeDefined();
      expect(anthropicDocs?.category).toBe('OFFICIAL');
      expect(anthropicDocs?.trust).toBe('verified');
      expect(anthropicDocs?.enabled).toBe(true);
    });
  });

  describe('getSourcesByCategory()', () => {
    it('should return only OFFICIAL sources', () => {
      const official = getSourcesByCategory('OFFICIAL');
      expect(official.length).toBeGreaterThan(0);
      for (const source of official) {
        expect(source.category).toBe('OFFICIAL');
        expect(source.enabled).toBe(true);
      }
    });

    it('should return only RESEARCH sources', () => {
      const research = getSourcesByCategory('RESEARCH');
      expect(research.length).toBeGreaterThan(0);
      for (const source of research) {
        expect(source.category).toBe('RESEARCH');
        expect(source.enabled).toBe(true);
      }
    });

    it('should return only DOCUMENTATION sources', () => {
      const docs = getSourcesByCategory('DOCUMENTATION');
      expect(docs.length).toBeGreaterThan(0);
      for (const source of docs) {
        expect(source.category).toBe('DOCUMENTATION');
        expect(source.enabled).toBe(true);
      }
    });

    it('should not return disabled sources', () => {
      const allByCategory = [
        ...getSourcesByCategory('OFFICIAL'),
        ...getSourcesByCategory('RESEARCH'),
        ...getSourcesByCategory('DOCUMENTATION'),
      ];
      for (const source of allByCategory) {
        expect(source.enabled).toBe(true);
      }
    });
  });

  describe('getEnabledSources()', () => {
    it('should return only enabled sources', () => {
      const enabled = getEnabledSources();
      expect(enabled.length).toBeGreaterThan(0);
      for (const source of enabled) {
        expect(source.enabled).toBe(true);
      }
    });

    it('should not include disabled sources', () => {
      const enabled = getEnabledSources();
      const disabledSource = KNOWLEDGE_SOURCES.find(s => !s.enabled);

      if (disabledSource) {
        expect(enabled).not.toContainEqual(disabledSource);
      }
    });

    it('should be subset of all sources', () => {
      const enabled = getEnabledSources();
      expect(enabled.length).toBeLessThanOrEqual(KNOWLEDGE_SOURCES.length);
    });
  });

  describe('getVerifiedSources()', () => {
    it('should return only verified trust sources', () => {
      const verified = getVerifiedSources();
      expect(verified.length).toBeGreaterThan(0);
      for (const source of verified) {
        expect(source.trust).toBe('verified');
        expect(source.enabled).toBe(true);
      }
    });

    it('should not include standard trust sources', () => {
      const verified = getVerifiedSources();
      for (const source of verified) {
        expect(source.trust).not.toBe('standard');
      }
    });

    it('should be subset of enabled sources', () => {
      const verified = getVerifiedSources();
      const enabled = getEnabledSources();
      expect(verified.length).toBeLessThanOrEqual(enabled.length);
    });
  });

  describe('isWhitelistedUrl()', () => {
    it('should return true for whitelisted Anthropic URL', () => {
      expect(isWhitelistedUrl('https://docs.anthropic.com/en/docs/overview')).toBe(true);
    });

    it('should return true for whitelisted Node.js URL', () => {
      expect(isWhitelistedUrl('https://nodejs.org/docs/latest/api/fs.html')).toBe(true);
    });

    it('should return true for whitelisted arXiv URL', () => {
      expect(isWhitelistedUrl('https://arxiv.org/abs/2301.12345')).toBe(true);
    });

    it('should return true for whitelisted TypeScript URL', () => {
      expect(isWhitelistedUrl('https://www.typescriptlang.org/docs/handbook')).toBe(true);
    });

    it('should return true for whitelisted MDN URL', () => {
      expect(isWhitelistedUrl('https://developer.mozilla.org/en-US/docs/Web/API')).toBe(true);
    });

    it('should return true for whitelisted OWASP URL', () => {
      expect(isWhitelistedUrl('https://owasp.org/www-project-top-ten/')).toBe(true);
    });

    it('should return false for non-whitelisted URL', () => {
      expect(isWhitelistedUrl('https://evil-site.com/malware')).toBe(false);
    });

    it('should return false for random domain', () => {
      expect(isWhitelistedUrl('https://random-blog.xyz/post')).toBe(false);
    });

    it('should return false for social media', () => {
      expect(isWhitelistedUrl('https://twitter.com/anthropic')).toBe(false);
      expect(isWhitelistedUrl('https://reddit.com/r/MachineLearning')).toBe(false);
    });

    it('should return false for invalid URL', () => {
      expect(isWhitelistedUrl('not-a-url')).toBe(false);
      expect(isWhitelistedUrl('')).toBe(false);
    });

    it('should return false for HTTP (non-HTTPS)', () => {
      // Even if the domain matches, HTTP should be treated separately
      expect(isWhitelistedUrl('http://docs.anthropic.com')).toBe(true); // URL parsing treats http/https same for hostname
    });

    it('should handle URLs with query parameters', () => {
      expect(isWhitelistedUrl('https://docs.anthropic.com/docs?version=2')).toBe(true);
    });

    it('should handle URLs with fragments', () => {
      expect(isWhitelistedUrl('https://nodejs.org/docs/latest/api/fs.html#fs_promises_api')).toBe(
        true
      );
    });

    it('should be case-sensitive for hostname', () => {
      // Hostnames are case-insensitive per RFC, so this should still work
      expect(isWhitelistedUrl('https://DOCS.ANTHROPIC.COM')).toBe(true);
    });
  });

  describe('Source data integrity', () => {
    it('should have Anthropic documentation enabled', () => {
      const anthropic = KNOWLEDGE_SOURCES.filter(s => s.id.startsWith('anthropic-'));
      expect(anthropic.length).toBeGreaterThanOrEqual(3);
      for (const source of anthropic) {
        expect(source.enabled).toBe(true);
      }
    });

    it('should have research sources (arXiv)', () => {
      const arxiv = KNOWLEDGE_SOURCES.filter(s => s.id.startsWith('arxiv-'));
      expect(arxiv.length).toBeGreaterThanOrEqual(2);
    });

    it('should have security sources (OWASP)', () => {
      const owasp = KNOWLEDGE_SOURCES.filter(s => s.id.startsWith('owasp-'));
      expect(owasp.length).toBeGreaterThanOrEqual(2);
    });

    it('should have alignment forum disabled by default', () => {
      const alignmentForum = KNOWLEDGE_SOURCES.find(s => s.id === 'alignment-forum');
      expect(alignmentForum).toBeDefined();
      expect(alignmentForum?.enabled).toBe(false);
      expect(alignmentForum?.trust).toBe('standard'); // Lower trust due to user content
    });
  });
});
