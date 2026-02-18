import { describe, it, expect } from 'vitest';
import { assessConfidence, formatConfidence } from '../../../src/autonomous/confidence-signals.js';
import type { ConfidenceSignal, ConfidenceParams } from '../../../src/autonomous/confidence-signals.js';

// ── Constants (mirrored from source) ────────────────────────────────────────

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConfidenceSignals', () => {
  describe('assessConfidence() — high confidence', () => {
    it('should return high when data is fresh, reliable, and multi-sourced', () => {
      const signal = assessConfidence({
        dataAge: 2 * 60 * 1000, // 2 min
        sourceReliability: 0.9,
        hasMultipleSources: true,
        sourceName: 'CoinGecko',
      });

      expect(signal.level).toBe('high');
      expect(signal.source).toBe('CoinGecko');
    });

    it('should return high for data just under 5 minutes', () => {
      const signal = assessConfidence({
        dataAge: FIVE_MINUTES_MS - 1000,
        sourceReliability: 0.85,
        hasMultipleSources: true,
      });

      expect(signal.level).toBe('high');
    });

    it('should require reliability > 0.8 for high confidence', () => {
      const signal = assessConfidence({
        dataAge: 1 * 60 * 1000,
        sourceReliability: 0.8,
        hasMultipleSources: true,
      });

      // 0.8 is not > 0.8, should not be high
      expect(signal.level).not.toBe('high');
    });

    it('should require multiple sources for high confidence', () => {
      const signal = assessConfidence({
        dataAge: 1 * 60 * 1000,
        sourceReliability: 0.95,
        hasMultipleSources: false,
      });

      expect(signal.level).not.toBe('high');
    });
  });

  describe('assessConfidence() — medium confidence', () => {
    it('should return medium for reasonably fresh data with decent reliability', () => {
      const signal = assessConfidence({
        dataAge: 30 * 60 * 1000, // 30 min
        sourceReliability: 0.6,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('medium');
    });

    it('should return medium when fresh but single source with moderate reliability', () => {
      const signal = assessConfidence({
        dataAge: 2 * 60 * 1000,
        sourceReliability: 0.7,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('medium');
    });

    it('should return medium for data just under 1 hour with reliability > 0.5', () => {
      const signal = assessConfidence({
        dataAge: ONE_HOUR_MS - 1000,
        sourceReliability: 0.6,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('medium');
    });

    it('should not return medium when reliability is 0.5 or below', () => {
      const signal = assessConfidence({
        dataAge: 10 * 60 * 1000,
        sourceReliability: 0.5,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('low');
    });
  });

  describe('assessConfidence() — low confidence', () => {
    it('should return low for stale data', () => {
      const signal = assessConfidence({
        dataAge: 2 * ONE_HOUR_MS,
        sourceReliability: 0.9,
        hasMultipleSources: true,
      });

      expect(signal.level).toBe('low');
    });

    it('should return low for unreliable source', () => {
      const signal = assessConfidence({
        dataAge: 10 * 60 * 1000,
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('low');
    });

    it('should return low for data older than 1 hour', () => {
      const signal = assessConfidence({
        dataAge: ONE_HOUR_MS + 1000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
      });

      expect(signal.level).toBe('low');
    });

    it('should return low when both reliability and freshness are poor', () => {
      const signal = assessConfidence({
        dataAge: ONE_DAY_MS,
        sourceReliability: 0.1,
        hasMultipleSources: false,
      });

      expect(signal.level).toBe('low');
    });
  });

  describe('assessConfidence() — freshness formatting', () => {
    it('should show "just now" for data less than 60 seconds old', () => {
      const signal = assessConfidence({
        dataAge: 30_000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
      });

      expect(signal.freshness).toBe('just now');
    });

    it('should show minutes for data less than 1 hour old', () => {
      const signal = assessConfidence({
        dataAge: 15 * 60 * 1000,
        sourceReliability: 0.6,
        hasMultipleSources: false,
      });

      expect(signal.freshness).toBe('15 min ago');
    });

    it('should show hours for data less than 1 day old', () => {
      const signal = assessConfidence({
        dataAge: 3 * ONE_HOUR_MS,
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.freshness).toBe('3h ago');
    });

    it('should show "yesterday" for 1 day old data', () => {
      const signal = assessConfidence({
        dataAge: ONE_DAY_MS + 1000,
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.freshness).toBe('yesterday');
    });

    it('should show days for data less than 1 week old', () => {
      const signal = assessConfidence({
        dataAge: 3 * ONE_DAY_MS,
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.freshness).toBe('3 days ago');
    });

    it('should show "last week" for data older than 1 week', () => {
      const signal = assessConfidence({
        dataAge: ONE_WEEK_MS + ONE_DAY_MS,
        sourceReliability: 0.3,
        hasMultipleSources: false,
      });

      expect(signal.freshness).toBe('last week');
    });
  });

  describe('assessConfidence() — source name', () => {
    it('should use provided source name', () => {
      const signal = assessConfidence({
        dataAge: 1000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
        sourceName: 'Bloomberg',
      });

      expect(signal.source).toBe('Bloomberg');
    });

    it('should default to "unknown source" when not provided', () => {
      const signal = assessConfidence({
        dataAge: 1000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
      });

      expect(signal.source).toBe('unknown source');
    });
  });

  describe('assessConfidence() — message content', () => {
    it('should include source name in high-confidence message', () => {
      const signal = assessConfidence({
        dataAge: 1000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
        sourceName: 'CoinGecko',
      });

      expect(signal.message).toContain('CoinGecko');
    });

    it('should include freshness in medium-confidence message', () => {
      const signal = assessConfidence({
        dataAge: 30 * 60 * 1000,
        sourceReliability: 0.6,
        hasMultipleSources: false,
      });

      expect(signal.message).toContain('30 min ago');
    });

    it('should suggest verification for low-confidence signal', () => {
      const signal = assessConfidence({
        dataAge: 2 * ONE_HOUR_MS,
        sourceReliability: 0.2,
        hasMultipleSources: false,
      });

      expect(signal.message).toContain('verify');
    });
  });

  describe('assessConfidence() — icon assignment', () => {
    it('should use green circle for high confidence', () => {
      const signal = assessConfidence({
        dataAge: 1000,
        sourceReliability: 0.9,
        hasMultipleSources: true,
      });

      expect(signal.icon).toBe('\u{1F7E2}');
    });

    it('should use yellow circle for medium confidence', () => {
      const signal = assessConfidence({
        dataAge: 30 * 60 * 1000,
        sourceReliability: 0.6,
        hasMultipleSources: false,
      });

      expect(signal.icon).toBe('\u{1F7E1}');
    });

    it('should use red circle for low confidence', () => {
      const signal = assessConfidence({
        dataAge: 2 * ONE_HOUR_MS,
        sourceReliability: 0.2,
        hasMultipleSources: false,
      });

      expect(signal.icon).toBe('\u{1F534}');
    });
  });

  describe('formatConfidence()', () => {
    it('should combine icon and message', () => {
      const signal: ConfidenceSignal = {
        level: 'high',
        icon: '\u{1F7E2}',
        source: 'test',
        freshness: 'just now',
        message: 'from test just now',
      };

      const formatted = formatConfidence(signal);

      expect(formatted).toBe('\u{1F7E2} from test just now');
    });

    it('should work with low confidence signals', () => {
      const signal: ConfidenceSignal = {
        level: 'low',
        icon: '\u{1F534}',
        source: 'stale',
        freshness: 'last week',
        message: "I'm not sure \u2014 want me to verify?",
      };

      const formatted = formatConfidence(signal);

      expect(formatted).toContain('\u{1F534}');
      expect(formatted).toContain('verify');
    });
  });
});
