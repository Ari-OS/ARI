import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GrowthReporter } from '../../../../src/integrations/social/growth-reporter.js';
import type { GrowthReport, YouTubeMetrics } from '../../../../src/integrations/social/growth-reporter.js';
import type { EngagementTrend } from '../../../../src/integrations/social/x-tracker.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockEventBus = { emit: mockEmit } as unknown as ConstructorParameters<typeof GrowthReporter>[0]['eventBus'];

vi.mock('../../../../src/kernel/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeXMetrics(overrides: Partial<EngagementTrend> = {}): EngagementTrend {
  return {
    period: '7d',
    avgEngagementRate: 0.035,
    totalImpressions: 50000,
    bestPerformingType: 'engagement-driven',
    growthRate: 5.2,
    ...overrides,
  };
}

function makeYouTubeMetrics(overrides: Partial<YouTubeMetrics> = {}): YouTubeMetrics {
  return {
    subscribers: 1200,
    views: 8500,
    watchTimeHours: 45.3,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GrowthReporter', () => {
  let reporter: GrowthReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    reporter = new GrowthReporter({ eventBus: mockEventBus });
  });

  describe('generateReport() — with both platforms', () => {
    it('should include both platforms in report', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics(),
        youtubeMetrics: makeYouTubeMetrics(),
      });

      expect(report.platforms).toHaveLength(2);
      expect(report.platforms.map(p => p.name)).toContain('X (Twitter)');
      expect(report.platforms.map(p => p.name)).toContain('YouTube');
    });

    it('should calculate overall growth as average of platform growth rates', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ growthRate: 10 }),
        youtubeMetrics: makeYouTubeMetrics(), // growth defaults to 0
      });

      expect(report.overallGrowth).toBe(5); // (10 + 0) / 2
    });

    it('should include a 7-day period', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics(),
      });

      expect(report.period.start).toBeDefined();
      expect(report.period.end).toBeDefined();
    });

    it('should generate a summary string', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics(),
        youtubeMetrics: makeYouTubeMetrics(),
      });

      expect(report.summary.length).toBeGreaterThan(0);
      expect(report.summary).toContain('2 platform(s)');
    });

    it('should emit audit event', () => {
      reporter.generateReport({ xMetrics: makeXMetrics() });

      expect(mockEmit).toHaveBeenCalledWith('audit:log', expect.objectContaining({
        action: 'social:report_generated',
      }));
    });
  });

  describe('generateReport() — X platform only', () => {
    it('should map X metrics correctly', () => {
      const xMetrics = makeXMetrics({
        avgEngagementRate: 0.05,
        bestPerformingType: 'conversation-starter',
        growthRate: 12.5,
      });

      const report = reporter.generateReport({ xMetrics });

      const xPlatform = report.platforms.find(p => p.name === 'X (Twitter)');
      expect(xPlatform).toBeDefined();
      expect(xPlatform!.engagement).toBe(0.05);
      expect(xPlatform!.topContent).toBe('conversation-starter');
      expect(xPlatform!.growth).toBe(12.5);
    });

    it('should set followers to 0 for X (not tracked in EngagementTrend)', () => {
      const report = reporter.generateReport({ xMetrics: makeXMetrics() });

      const xPlatform = report.platforms.find(p => p.name === 'X (Twitter)');
      expect(xPlatform!.followers).toBe(0);
    });
  });

  describe('generateReport() — YouTube platform only', () => {
    it('should map YouTube metrics correctly', () => {
      const ytMetrics = makeYouTubeMetrics({ subscribers: 5000, views: 25000, watchTimeHours: 120 });

      const report = reporter.generateReport({ youtubeMetrics: ytMetrics });

      const ytPlatform = report.platforms.find(p => p.name === 'YouTube');
      expect(ytPlatform).toBeDefined();
      expect(ytPlatform!.followers).toBe(5000);
      expect(ytPlatform!.topContent).toContain('120.0h');
    });

    it('should calculate engagement as views/subscribers ratio', () => {
      const ytMetrics = makeYouTubeMetrics({ subscribers: 1000, views: 5000 });

      const report = reporter.generateReport({ youtubeMetrics: ytMetrics });

      const ytPlatform = report.platforms.find(p => p.name === 'YouTube');
      expect(ytPlatform!.engagement).toBe(5); // 5000 / 1000
    });

    it('should handle zero subscribers without division error', () => {
      const ytMetrics = makeYouTubeMetrics({ subscribers: 0, views: 100 });

      const report = reporter.generateReport({ youtubeMetrics: ytMetrics });

      const ytPlatform = report.platforms.find(p => p.name === 'YouTube');
      expect(ytPlatform!.engagement).toBe(0);
    });
  });

  describe('generateReport() — no platform data', () => {
    it('should return empty platforms array', () => {
      const report = reporter.generateReport({});

      expect(report.platforms).toHaveLength(0);
    });

    it('should return 0 overall growth', () => {
      const report = reporter.generateReport({});

      expect(report.overallGrowth).toBe(0);
    });

    it('should recommend connecting a platform', () => {
      const report = reporter.generateReport({});

      expect(report.recommendations.some(r => r.includes('No platform data'))).toBe(true);
    });

    it('should indicate no data in summary', () => {
      const report = reporter.generateReport({});

      expect(report.summary).toContain('No platform data');
    });
  });

  describe('generateReport() — recommendations', () => {
    it('should recommend improving engagement when X rate is below 2%', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ avgEngagementRate: 0.01 }),
      });

      expect(report.recommendations.some(r => r.includes('below 2%'))).toBe(true);
    });

    it('should recommend doubling down on questions when conversation-starter wins', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ bestPerformingType: 'conversation-starter', avgEngagementRate: 0.05 }),
      });

      expect(report.recommendations.some(r => r.includes('questions'))).toBe(true);
    });

    it('should recommend save-worthy content when reference-content wins', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ bestPerformingType: 'reference-content', avgEngagementRate: 0.05 }),
      });

      expect(report.recommendations.some(r => r.includes('save-worthy'))).toBe(true);
    });

    it('should warn about declining engagement', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ growthRate: -5 }),
      });

      expect(report.recommendations.some(r => r.includes('declining'))).toBe(true);
    });

    it('should recommend retention for low YouTube watch time', () => {
      const report = reporter.generateReport({
        youtubeMetrics: makeYouTubeMetrics({ watchTimeHours: 5 }),
      });

      expect(report.recommendations.some(r => r.includes('watch time'))).toBe(true);
    });

    it('should recommend thumbnail optimization for low view-to-subscriber ratio', () => {
      const report = reporter.generateReport({
        youtubeMetrics: makeYouTubeMetrics({ subscribers: 1000, views: 300 }),
      });

      expect(report.recommendations.some(r => r.includes('thumbnails'))).toBe(true);
    });

    it('should give positive recommendation when everything looks good', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ avgEngagementRate: 0.05, growthRate: 10, bestPerformingType: 'engagement-driven' }),
        youtubeMetrics: makeYouTubeMetrics({ subscribers: 1000, views: 5000, watchTimeHours: 100 }),
      });

      expect(report.recommendations.some(r => r.includes('Solid week') || r.includes('consistency'))).toBe(true);
    });
  });

  describe('generateReport() — summary', () => {
    it('should indicate "up" direction for positive growth', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ growthRate: 10 }),
      });

      expect(report.summary).toContain('up');
    });

    it('should indicate "down" direction for negative growth', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ growthRate: -5 }),
      });

      expect(report.summary).toContain('down');
    });

    it('should indicate "flat" direction for zero growth', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics({ growthRate: 0 }),
      });

      expect(report.summary).toContain('flat');
    });

    it('should include platform names in summary', () => {
      const report = reporter.generateReport({
        xMetrics: makeXMetrics(),
        youtubeMetrics: makeYouTubeMetrics(),
      });

      expect(report.summary).toContain('X (Twitter)');
      expect(report.summary).toContain('YouTube');
    });
  });
});
