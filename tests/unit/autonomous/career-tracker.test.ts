import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';
import { CareerTracker } from '../../../src/autonomous/career-tracker.js';
import type { CareerProfile, JobMatch } from '../../../src/autonomous/career-tracker.js';

describe('CareerTracker', () => {
  let eventBus: EventBus;
  let tracker: CareerTracker;

  beforeEach(() => {
    eventBus = new EventBus();
    tracker = new CareerTracker(eventBus);
  });

  describe('scoreListing', () => {
    it('should score target role match highly', () => {
      const listing = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        salary: { min: 90000, max: 120000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchScore).toBeGreaterThanOrEqual(30); // Role match alone
      expect(result.matchReasons).toContain('Target role match');
    });

    it('should score strong skill matches', () => {
      const listing = {
        title: 'TypeScript Node.js Developer',
        company: 'Tech Inc',
        location: 'Remote',
        salary: { min: 85000, max: 110000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchScore).toBeGreaterThan(30);
      expect(result.matchReasons.some((r) => r.includes('strong skill'))).toBe(true);
    });

    it('should score remote work preference', () => {
      const listing = {
        title: 'Developer',
        company: 'Remote Co',
        location: 'Remote',
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons).toContain('Remote work available');
      expect(result.matchScore).toBeGreaterThanOrEqual(15);
    });

    it('should score hybrid work preference', () => {
      const listing = {
        title: 'Developer',
        company: 'Hybrid Co',
        location: 'Hybrid, NYC',
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons).toContain('Hybrid work available');
      expect(result.matchScore).toBeGreaterThanOrEqual(12);
    });

    it('should score location match', () => {
      const listing = {
        title: 'Developer',
        company: 'East Coast Co',
        location: 'Eastern US',
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons).toContain('Location match');
    });

    it('should score salary meeting minimum', () => {
      const listing = {
        title: 'Developer',
        company: 'Tech Corp',
        location: 'Remote',
        salary: { min: 90000, max: 120000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons.some((r) => r.includes('Salary meets minimum'))).toBe(true);
    });

    it('should flag salary below minimum', () => {
      const listing = {
        title: 'Developer',
        company: 'Startup Inc',
        location: 'Remote',
        salary: { min: 60000, max: 75000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons.some((r) => r.includes('below minimum'))).toBe(true);
    });

    it('should identify missing skills', () => {
      const listing = {
        title: 'React Angular Developer',
        company: 'Frontend Co',
        location: 'Remote',
      };

      const result = tracker.scoreListing(listing);

      expect(result.missingSkills).toContain('angular');
      // React is in moderate skills, so should match
    });

    it('should score differentiator keywords', () => {
      const listing = {
        title: 'AI/ML Engineer - Security Focus',
        company: 'AI Corp',
        location: 'Remote',
        salary: { min: 100000, max: 150000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchReasons.some((r) => r.includes('differentiators'))).toBe(true);
    });

    it.skip('should produce high score for perfect match', () => {
      const listing = {
        title: 'Senior TypeScript Node.js AI Engineer',
        company: 'AI Security Corp',
        location: 'Remote - Eastern US',
        salary: { min: 120000, max: 160000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchScore).toBeGreaterThan(80);
    });

    it('should produce low score for poor match', () => {
      const listing = {
        title: 'PHP Developer',
        company: 'Old Tech Inc',
        location: 'On-site San Francisco',
        salary: { min: 50000, max: 65000 },
      };

      const result = tracker.scoreListing(listing);

      expect(result.matchScore).toBeLessThan(30);
    });
  });

  describe('addListing', () => {
    it('should add and score a listing', () => {
      const listing = {
        id: '1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        salary: { min: 90000, max: 120000 },
        source: 'LinkedIn',
        url: 'https://example.com/job/1',
        detectedAt: new Date().toISOString(),
      };

      const match = tracker.addListing(listing);

      expect(match.id).toBe('1');
      expect(match.matchScore).toBeGreaterThan(0);
      expect(match.matchReasons.length).toBeGreaterThan(0);
    });

    it('should not add duplicate listings', () => {
      const listing = {
        id: '1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        source: 'LinkedIn',
        url: 'https://example.com/job/1',
        detectedAt: new Date().toISOString(),
      };

      const first = tracker.addListing(listing);
      const second = tracker.addListing(listing);

      expect(first.id).toBe(second.id);
      expect(tracker.getMatches(0)).toHaveLength(1);
    });

    it('should emit audit event', () => {
      let emitted = false;
      eventBus.on('audit:log', () => {
        emitted = true;
      });

      const listing = {
        id: '1',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        source: 'LinkedIn',
        url: 'https://example.com/job/1',
        detectedAt: new Date().toISOString(),
      };

      tracker.addListing(listing);

      expect(emitted).toBe(true);
    });
  });

  describe('getMatches', () => {
    it('should return all matches above threshold', () => {
      tracker.addListing({
        id: '1', title: 'TypeScript Developer', company: 'Tech', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });
      tracker.addListing({
        id: '2', title: 'PHP Developer', company: 'Old Tech', location: 'On-site',
        source: 'Indeed', url: 'https://example.com/2', detectedAt: new Date().toISOString(),
      });

      const matches = tracker.getMatches(50);

      // TypeScript role should score higher
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every((m) => m.matchScore >= 50)).toBe(true);
    });

    it('should sort by match score descending', () => {
      tracker.addListing({
        id: '1', title: 'Developer', company: 'Co A', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });
      tracker.addListing({
        id: '2', title: 'Senior TypeScript AI Engineer', company: 'Co B', location: 'Remote',
        salary: { min: 120000, max: 150000 },
        source: 'LinkedIn', url: 'https://example.com/2', detectedAt: new Date().toISOString(),
      });

      const matches = tracker.getMatches(0);

      expect(matches[0].matchScore).toBeGreaterThanOrEqual(matches[1].matchScore);
    });

    it('should default to minScore 50', () => {
      tracker.addListing({
        id: '1', title: 'TypeScript Developer', company: 'Tech', location: 'Remote',
        salary: { min: 90000, max: 120000 },
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });
      tracker.addListing({
        id: '2', title: 'PHP Developer', company: 'Old', location: 'On-site',
        salary: { min: 50000, max: 60000 },
        source: 'Indeed', url: 'https://example.com/2', detectedAt: new Date().toISOString(),
      });

      const matches = tracker.getMatches();

      expect(matches.every((m) => m.matchScore >= 50)).toBe(true);
    });
  });

  describe('getWeeklyReport', () => {
    it('should generate weekly report', () => {
      tracker.addListing({
        id: '1', title: 'TypeScript Engineer', company: 'Tech', location: 'Remote',
        salary: { min: 95000, max: 125000 },
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });

      const report = tracker.getWeeklyReport();

      expect(report.weekOf).toBeTruthy();
      expect(report.newMatches.length).toBeGreaterThan(0);
      expect(report.recommendation).toBeTruthy();
    });

    it('should include new matches from past week', () => {
      const recent = new Date();
      const old = new Date(recent.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      tracker.addListing({
        id: '1', title: 'Recent Job', company: 'Co A', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: recent.toISOString(),
      });
      tracker.addListing({
        id: '2', title: 'Old Job', company: 'Co B', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/2', detectedAt: old.toISOString(),
      });

      const report = tracker.getWeeklyReport();

      expect(report.newMatches.some((m) => m.id === '1')).toBe(true);
      expect(report.newMatches.some((m) => m.id === '2')).toBe(false);
    });

    it('should include top 5 matches', () => {
      // Add 10 listings
      for (let i = 0; i < 10; i++) {
        tracker.addListing({
          id: String(i),
          title: i < 5 ? 'TypeScript Engineer' : 'PHP Developer',
          company: `Company ${i}`,
          location: 'Remote',
          salary: { min: 80000 + i * 5000, max: 100000 + i * 5000 },
          source: 'LinkedIn',
          url: `https://example.com/${i}`,
          detectedAt: new Date().toISOString(),
        });
      }

      const report = tracker.getWeeklyReport();

      expect(report.topMatches.length).toBeLessThanOrEqual(5);
    });

    it('should include skill gaps', () => {
      tracker.addListing({
        id: '1', title: 'Angular Kubernetes Developer', company: 'Tech', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });

      const report = tracker.getWeeklyReport();

      expect(report.skillGaps.length).toBeGreaterThan(0);
    });

    it('should provide recommendation when no matches', () => {
      const report = tracker.getWeeklyReport();

      expect(report.recommendation).toContain('No strong matches');
    });

    it.skip('should provide strong match recommendation', () => {
      tracker.addListing({
        id: '1',
        title: 'Senior TypeScript Node.js AI Engineer',
        company: 'AI Corp',
        location: 'Remote - Eastern US',
        salary: { min: 120000, max: 160000 },
        source: 'LinkedIn',
        url: 'https://example.com/1',
        detectedAt: new Date().toISOString(),
      });

      const report = tracker.getWeeklyReport();

      expect(report.recommendation).toContain('apply immediately');
    });
  });

  describe('getSkillGaps', () => {
    it.skip('should identify most frequent missing skills', () => {
      tracker.addListing({
        id: '1', title: 'Angular Kubernetes Developer', company: 'A', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });
      tracker.addListing({
        id: '2', title: 'Vue Kubernetes Developer', company: 'B', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/2', detectedAt: new Date().toISOString(),
      });
      tracker.addListing({
        id: '3', title: 'Kubernetes Engineer', company: 'C', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/3', detectedAt: new Date().toISOString(),
      });

      const gaps = tracker.getSkillGaps();

      // Kubernetes should be most frequent (appears 3 times)
      expect(gaps[0]).toBe('kubernetes');
    });

    it('should limit to top 5 skills', () => {
      tracker.addListing({
        id: '1', title: 'Angular Vue Rust Go Java AWS Developer', company: 'A', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });

      const gaps = tracker.getSkillGaps();

      expect(gaps.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no gaps', () => {
      tracker.addListing({
        id: '1', title: 'TypeScript Developer', company: 'A', location: 'Remote',
        source: 'LinkedIn', url: 'https://example.com/1', detectedAt: new Date().toISOString(),
      });

      const gaps = tracker.getSkillGaps();

      expect(gaps).toEqual([]);
    });
  });

  describe('custom profile', () => {
    it('should use custom profile when provided', () => {
      const customProfile: CareerProfile = {
        targetRoles: ['Backend Engineer'],
        skills: {
          strong: ['Python', 'Django'],
          moderate: ['PostgreSQL'],
          learning: ['Go'],
        },
        preferences: {
          remote: false,
          hybrid: false,
          salaryMin: 100000,
          location: 'San Francisco',
        },
        differentiators: ['Built large-scale API'],
      };

      const customTracker = new CareerTracker(eventBus, customProfile);

      const listing = {
        title: 'Backend Engineer - Python Django',
        company: 'Tech Corp',
        location: 'San Francisco',
        salary: { min: 110000, max: 140000 },
      };

      const result = customTracker.scoreListing(listing);

      expect(result.matchReasons).toContain('Target role match');
      expect(result.matchScore).toBeGreaterThan(50);
    });
  });
});
