import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CareerTracker,
  JobOpportunity,
  CareerMatch,
  TargetProfile,
} from '../../../src/autonomous/career-tracker.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

// Mock logger
vi.mock('../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create a mock EventBus
function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    clear: vi.fn(),
    listenerCount: vi.fn(() => 0),
    getHandlerErrorCount: vi.fn(() => 0),
    setHandlerTimeout: vi.fn(),
  } as unknown as EventBus;
}

// Helper to create a test opportunity
function createTestOpportunity(overrides: Partial<JobOpportunity> = {}): JobOpportunity {
  return {
    id: 'test-job-1',
    title: 'Senior Software Engineer',
    company: 'TestCorp',
    location: 'San Francisco, CA',
    remote: true,
    salary: { min: 180000, max: 220000 },
    skills: ['TypeScript', 'Node.js', 'React'],
    description: 'Join our team',
    source: 'LinkedIn',
    sourceUrl: 'https://linkedin.com/jobs/test',
    postedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to run async operations with fake timers
async function runWithTimers<T>(fn: () => Promise<T>): Promise<T> {
  const promise = fn();
  // Advance all timers to resolve any setTimeout/sleep calls
  await vi.runAllTimersAsync();
  return promise;
}

describe('CareerTracker', () => {
  let tracker: CareerTracker;
  let mockEventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T10:00:00Z'));
    mockEventBus = createMockEventBus();
    tracker = new CareerTracker(mockEventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default profile', () => {
      const t = new CareerTracker();
      expect(t).toBeDefined();

      const profile = t.getTargetProfile();
      expect(profile.targetRoles).toContain('Software Engineer');
      expect(profile.skills).toContain('TypeScript');
    });

    it('should accept an EventBus', () => {
      const t = new CareerTracker(mockEventBus);
      expect(t).toBeDefined();
    });

    it('should work without EventBus', () => {
      const t = new CareerTracker();
      expect(t).toBeDefined();
    });
  });

  describe('setTargetProfile', () => {
    it('should update target roles', () => {
      tracker.setTargetProfile({
        targetRoles: ['Staff Engineer', 'Principal Engineer'],
      });

      const profile = tracker.getTargetProfile();
      expect(profile.targetRoles).toEqual(['Staff Engineer', 'Principal Engineer']);
    });

    it('should update target salary', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 200000, max: 400000 },
      });

      const profile = tracker.getTargetProfile();
      expect(profile.targetSalary.min).toBe(200000);
      expect(profile.targetSalary.max).toBe(400000);
    });

    it('should update remote preference', () => {
      tracker.setTargetProfile({ preferRemote: false });
      expect(tracker.getTargetProfile().preferRemote).toBe(false);

      tracker.setTargetProfile({ preferRemote: true });
      expect(tracker.getTargetProfile().preferRemote).toBe(true);
    });

    it('should update skills list', () => {
      tracker.setTargetProfile({
        skills: ['Rust', 'Go', 'Kubernetes'],
      });

      const profile = tracker.getTargetProfile();
      expect(profile.skills).toEqual(['Rust', 'Go', 'Kubernetes']);
    });

    it('should update locations', () => {
      tracker.setTargetProfile({
        locations: ['Austin', 'Denver', 'Remote'],
      });

      const profile = tracker.getTargetProfile();
      expect(profile.locations).toEqual(['Austin', 'Denver', 'Remote']);
    });

    it('should merge partial updates with existing profile', () => {
      tracker.setTargetProfile({
        targetRoles: ['CTO'],
      });

      tracker.setTargetProfile({
        skills: ['Leadership'],
      });

      const profile = tracker.getTargetProfile();
      expect(profile.targetRoles).toEqual(['CTO']);
      expect(profile.skills).toEqual(['Leadership']);
    });
  });

  describe('getTargetProfile', () => {
    it('should return a copy of the profile', () => {
      const profile1 = tracker.getTargetProfile();
      const profile2 = tracker.getTargetProfile();

      expect(profile1).toEqual(profile2);
      expect(profile1).not.toBe(profile2); // Different object references
    });
  });

  describe('scoreOpportunity', () => {
    it('should return high score for perfect match', () => {
      tracker.setTargetProfile({
        targetRoles: ['Senior Software Engineer'],
        targetSalary: { min: 150000, max: 250000 },
        preferRemote: true,
        skills: ['TypeScript', 'Node.js', 'React'],
        locations: ['San Francisco'],
      });

      const opportunity = createTestOpportunity();
      const match = tracker.scoreOpportunity(opportunity);

      expect(match.matchScore).toBeGreaterThan(0.8);
      expect(match.skillMatch).toBeGreaterThan(0.8);
      expect(match.salaryMatch).toBeGreaterThan(0.5);
      expect(match.locationMatch).toBe(1.0);
    });

    it('should return low score for poor match', () => {
      tracker.setTargetProfile({
        targetRoles: ['Data Scientist'],
        targetSalary: { min: 100000, max: 120000 },
        preferRemote: false,
        skills: ['Python', 'PyTorch', 'TensorFlow'],
        locations: ['Boston'],
      });

      const opportunity = createTestOpportunity({
        skills: ['Cobol', 'Fortran'],
        salary: { min: 50000, max: 60000 },
        location: 'Chicago, IL',
        remote: false,
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.matchScore).toBeLessThan(0.5);
    });

    it('should provide reasoning for skill match', () => {
      const opportunity = createTestOpportunity({
        skills: ['TypeScript', 'Node.js', 'GraphQL'],
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.reasoning.some(r => r.includes('skill'))).toBe(true);
    });

    it('should provide reasoning for salary match', () => {
      const opportunity = createTestOpportunity({
        salary: { min: 180000, max: 220000 },
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.reasoning.some(r => r.includes('salary') || r.includes('$'))).toBe(true);
    });

    it('should provide reasoning for location match', () => {
      const opportunity = createTestOpportunity({
        location: 'Remote',
        remote: true,
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.reasoning.some(r => r.toLowerCase().includes('remote') || r.toLowerCase().includes('location'))).toBe(true);
    });

    it('should handle missing salary', () => {
      const opportunity = createTestOpportunity({ salary: undefined });
      const match = tracker.scoreOpportunity(opportunity);

      expect(match.salaryMatch).toBe(0.5); // Neutral score
      expect(match.reasoning.some(r => r.includes('not disclosed'))).toBe(true);
    });

    it('should handle empty skills list', () => {
      const opportunity = createTestOpportunity({ skills: [] });
      const match = tracker.scoreOpportunity(opportunity);

      expect(match.skillMatch).toBe(0.5); // Neutral score
      expect(match.reasoning.some(r => r.includes('No skills listed'))).toBe(true);
    });

    it('should round scores to 2 decimal places', () => {
      const opportunity = createTestOpportunity();
      const match = tracker.scoreOpportunity(opportunity);

      // Check that scores are rounded
      expect(Number.isFinite(match.matchScore)).toBe(true);
      expect(match.matchScore.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });

  describe('calculateSkillMatch', () => {
    it('should match exact skill names', () => {
      tracker.setTargetProfile({ skills: ['TypeScript', 'Node.js'] });

      const opportunity = createTestOpportunity({
        skills: ['TypeScript', 'Node.js'],
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.skillMatch).toBe(1.0);
    });

    it('should match partial skill names', () => {
      tracker.setTargetProfile({ skills: ['TypeScript'] });

      const opportunity = createTestOpportunity({
        skills: ['typescript'],
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.skillMatch).toBeGreaterThan(0.8);
    });

    it('should be case insensitive', () => {
      tracker.setTargetProfile({ skills: ['TYPESCRIPT', 'nodejs'] });

      const opportunity = createTestOpportunity({
        skills: ['typescript', 'NodeJS'],
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.skillMatch).toBeGreaterThan(0.8);
    });
  });

  describe('calculateSalaryMatch', () => {
    it('should give high score for overlapping ranges', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 150000, max: 200000 },
      });

      const opportunity = createTestOpportunity({
        salary: { min: 160000, max: 190000 },
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.salaryMatch).toBeGreaterThan(0.8);
    });

    it('should give full score for salary above target', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 150000, max: 200000 },
      });

      const opportunity = createTestOpportunity({
        salary: { min: 250000, max: 300000 },
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.salaryMatch).toBe(1.0);
    });

    it('should penalize salary below target', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 150000, max: 200000 },
      });

      const opportunity = createTestOpportunity({
        salary: { min: 80000, max: 100000 },
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.salaryMatch).toBeLessThan(0.7);
    });
  });

  describe('calculateLocationMatch', () => {
    it('should give full score for remote when preferred', () => {
      tracker.setTargetProfile({ preferRemote: true, locations: [] });

      const opportunity = createTestOpportunity({ remote: true });
      const match = tracker.scoreOpportunity(opportunity);

      expect(match.locationMatch).toBe(1.0);
    });

    it('should give full score for matching location', () => {
      tracker.setTargetProfile({
        preferRemote: false,
        locations: ['San Francisco'],
      });

      const opportunity = createTestOpportunity({
        location: 'San Francisco, CA',
        remote: false,
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.locationMatch).toBe(1.0);
    });

    it('should give low score for non-matching location', () => {
      tracker.setTargetProfile({
        preferRemote: true,
        locations: ['Seattle'],
      });

      const opportunity = createTestOpportunity({
        location: 'Miami, FL',
        remote: false,
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.locationMatch).toBeLessThan(0.5);
    });
  });

  describe('scanOpportunities', () => {
    it('should return matches sorted by score', async () => {
      const matches = await runWithTimers(() => tracker.scanOpportunities());

      // Check sorting
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });

    it('should filter out low-scoring matches', async () => {
      const matches = await runWithTimers(() => tracker.scanOpportunities());

      // All matches should meet minimum threshold (0.4)
      for (const match of matches) {
        expect(match.matchScore).toBeGreaterThanOrEqual(0.4);
      }
    });

    it('should update lastScanAt timestamp', async () => {
      expect(tracker.getLastScanTime()).toBeNull();

      await runWithTimers(() => tracker.scanOpportunities());

      expect(tracker.getLastScanTime()).not.toBeNull();
    });

    it('should cache results', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const cached = tracker.getAllMatches();
      expect(cached.length).toBeGreaterThan(0);
    });

    it('should emit event when matches found', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'career:new_matches',
        expect.objectContaining({
          count: expect.any(Number),
          topMatch: expect.any(String),
        })
      );
    });

    it('should work without EventBus', async () => {
      const trackerNoEvents = new CareerTracker();
      const matches = await runWithTimers(() => trackerNoEvents.scanOpportunities());

      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('getTopMatches', () => {
    it('should return empty array before scan', () => {
      const matches = tracker.getTopMatches();
      expect(matches).toEqual([]);
    });

    it('should return top N matches', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const top3 = tracker.getTopMatches(3);
      expect(top3.length).toBeLessThanOrEqual(3);
    });

    it('should default to 10 matches', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const matches = tracker.getTopMatches();
      expect(matches.length).toBeLessThanOrEqual(10);
    });

    it('should return matches in descending score order', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const matches = tracker.getTopMatches(5);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });
  });

  describe('getAllMatches', () => {
    it('should return all cached matches', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const all = tracker.getAllMatches();
      const top = tracker.getTopMatches(100);

      expect(all.length).toBe(top.length);
    });

    it('should return a copy of the array', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const all1 = tracker.getAllMatches();
      const all2 = tracker.getAllMatches();

      expect(all1).not.toBe(all2);
    });
  });

  describe('generateReport', () => {
    it('should generate markdown report', async () => {
      const report = await runWithTimers(() => tracker.generateReport());

      expect(report).toContain('# Daily Career Opportunity Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Target Profile');
    });

    it('should include summary statistics', async () => {
      const report = await runWithTimers(() => tracker.generateReport());

      expect(report).toContain('Total Opportunities Found');
      expect(report).toContain('Above 70% Match');
    });

    it('should include target profile details', async () => {
      tracker.setTargetProfile({
        targetRoles: ['Staff Engineer'],
        skills: ['Rust', 'WebAssembly'],
      });

      const report = await runWithTimers(() => tracker.generateReport());

      expect(report).toContain('Staff Engineer');
      expect(report).toContain('Rust');
    });

    it('should include top opportunities', async () => {
      const report = await runWithTimers(() => tracker.generateReport());

      // Should have numbered opportunities
      expect(report).toContain('### 1.');
    });

    it('should include match reasoning', async () => {
      const report = await runWithTimers(() => tracker.generateReport());

      expect(report).toContain('Match Analysis');
    });

    it('should include sources checked', async () => {
      const report = await runWithTimers(() => tracker.generateReport());

      expect(report).toContain('## Sources Checked');
      expect(report).toContain('LinkedIn');
    });

    it('should trigger scan if no cached data', async () => {
      tracker.clearCache();

      const report = await runWithTimers(() => tracker.generateReport());

      expect(tracker.getLastScanTime()).not.toBeNull();
      expect(report).toContain('Total Opportunities Found');
    });
  });

  describe('clearCache', () => {
    it('should clear cached matches', async () => {
      await runWithTimers(() => tracker.scanOpportunities());
      expect(tracker.getAllMatches().length).toBeGreaterThan(0);

      tracker.clearCache();

      expect(tracker.getAllMatches().length).toBe(0);
    });

    it('should reset lastScanAt', async () => {
      await runWithTimers(() => tracker.scanOpportunities());
      expect(tracker.getLastScanTime()).not.toBeNull();

      tracker.clearCache();

      expect(tracker.getLastScanTime()).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return zero stats before scan', () => {
      const stats = tracker.getStats();

      expect(stats.total).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.topScore).toBe(0);
      expect(stats.lastScan).toBeNull();
    });

    it('should return accurate stats after scan', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const stats = tracker.getStats();
      const matches = tracker.getAllMatches();

      expect(stats.total).toBe(matches.length);
      expect(stats.topScore).toBe(matches[0]?.matchScore ?? 0);
      expect(stats.lastScan).not.toBeNull();
    });

    it('should calculate average score correctly', async () => {
      await runWithTimers(() => tracker.scanOpportunities());

      const stats = tracker.getStats();
      const matches = tracker.getAllMatches();

      const expectedAvg = matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length;
      // Use 1 decimal place precision to handle floating point rounding
      expect(stats.avgScore).toBeCloseTo(expectedAvg, 1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty target roles', async () => {
      tracker.setTargetProfile({ targetRoles: [] });

      const matches = await runWithTimers(() => tracker.scanOpportunities());
      expect(matches).toBeDefined();
    });

    it('should handle empty skills list in profile', async () => {
      tracker.setTargetProfile({ skills: [] });

      const matches = await runWithTimers(() => tracker.scanOpportunities());
      expect(matches).toBeDefined();
    });

    it('should handle zero salary range', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 0, max: 0 },
      });

      const opportunity = createTestOpportunity();
      const match = tracker.scoreOpportunity(opportunity);

      expect(Number.isFinite(match.salaryMatch)).toBe(true);
    });

    it('should handle opportunity with salary equal to min target', () => {
      tracker.setTargetProfile({
        targetSalary: { min: 150000, max: 200000 },
      });

      const opportunity = createTestOpportunity({
        salary: { min: 150000, max: 150000 },
      });

      const match = tracker.scoreOpportunity(opportunity);
      expect(match.salaryMatch).toBeGreaterThan(0);
    });
  });

  describe('singleton export', () => {
    it('should export careerTracker singleton', async () => {
      const { careerTracker } = await import('../../../src/autonomous/career-tracker.js');
      expect(careerTracker).toBeDefined();
      expect(careerTracker).toBeInstanceOf(CareerTracker);
    });
  });
});
