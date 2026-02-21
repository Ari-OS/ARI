import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnomalyDetector } from '../../../src/kernel/anomaly-detector.js';
import type { EventBus } from '../../../src/kernel/event-bus.js';

function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    once: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0),
  } as unknown as EventBus;
}

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createMockEventBus();
    detector = new AnomalyDetector(eventBus);
  });

  describe('record()', () => {
    it('should accumulate data for a metric', () => {
      detector.record('cpu', 50);
      detector.record('cpu', 55);
      detector.record('cpu', 48);

      const baseline = detector.getBaseline('cpu');
      expect(baseline).not.toBeNull();
      expect(baseline!.count).toBe(3);
    });

    it('should handle multiple metrics independently', () => {
      detector.record('cpu', 50);
      detector.record('memory', 80);
      detector.record('cpu', 55);

      const cpuBaseline = detector.getBaseline('cpu');
      const memBaseline = detector.getBaseline('memory');

      expect(cpuBaseline!.count).toBe(2);
      expect(memBaseline!.count).toBe(1);
    });

    it('should emit warning event when anomaly is detected', () => {
      // Build a baseline of ~50 with tight distribution
      for (let i = 0; i < 100; i++) {
        detector.record('latency', 50 + (i % 3) - 1); // 49, 50, 51
      }

      // Record a massive outlier
      detector.record('latency', 500);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'security:alert',
        expect.objectContaining({
          type: expect.stringContaining('anomaly'),
          source: 'anomaly-detector',
        })
      );
    });

    it('should emit critical event for extreme outliers (>5 sigma)', () => {
      // Build a tight baseline
      for (let i = 0; i < 100; i++) {
        detector.record('errors', 10);
      }

      // Record an extreme outlier (stddev is ~0, so any deviation is huge)
      detector.record('errors', 1000);

      expect(eventBus.emit).toHaveBeenCalledWith(
        'security:alert',
        expect.objectContaining({
          type: 'anomaly_critical',
        })
      );
    });

    it('should not emit events when data is insufficient (<10 samples)', () => {
      for (let i = 0; i < 9; i++) {
        detector.record('requests', 100);
      }
      detector.record('requests', 99999);

      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('isAnomalous()', () => {
    it('should return false for normal values', () => {
      for (let i = 0; i < 50; i++) {
        detector.record('metric', 100 + Math.sin(i) * 5);
      }

      const result = detector.isAnomalous('metric', 102);
      expect(result.anomalous).toBe(false);
      expect(Math.abs(result.zscore)).toBeLessThan(3);
    });

    it('should return true for values beyond 3 sigma', () => {
      // Build baseline around 50, stddev ~ 1
      for (let i = 0; i < 100; i++) {
        detector.record('metric', 50 + (i % 3) - 1);
      }

      const result = detector.isAnomalous('metric', 500);
      expect(result.anomalous).toBe(true);
      expect(Math.abs(result.zscore)).toBeGreaterThan(3);
    });

    it('should return false when no data exists for metric', () => {
      const result = detector.isAnomalous('unknown', 42);
      expect(result.anomalous).toBe(false);
      expect(result.zscore).toBe(0);
    });

    it('should return false when only 1 sample exists', () => {
      detector.record('sparse', 100);
      const result = detector.isAnomalous('sparse', 200);
      expect(result.anomalous).toBe(false);
    });

    it('should handle zero stddev (all identical values)', () => {
      for (let i = 0; i < 20; i++) {
        detector.record('constant', 42);
      }

      // Same value should not be anomalous
      const sameResult = detector.isAnomalous('constant', 42);
      expect(sameResult.anomalous).toBe(false);
      expect(sameResult.zscore).toBe(0);

      // Different value should be anomalous
      const diffResult = detector.isAnomalous('constant', 43);
      expect(diffResult.anomalous).toBe(true);
    });

    it('should include threshold in result', () => {
      detector.record('m', 10);
      detector.record('m', 20);
      const result = detector.isAnomalous('m', 15);
      expect(result.threshold).toBe(3.0);
    });
  });

  describe('sliding window', () => {
    it('should drop old values when window is full', () => {
      const smallDetector = new AnomalyDetector(eventBus, 5);

      smallDetector.record('test', 10);
      smallDetector.record('test', 20);
      smallDetector.record('test', 30);
      smallDetector.record('test', 40);
      smallDetector.record('test', 50);

      expect(smallDetector.getBaseline('test')!.count).toBe(5);
      expect(smallDetector.getBaseline('test')!.mean).toBe(30);

      // Adding a 6th value should evict the first (10)
      smallDetector.record('test', 60);

      const baseline = smallDetector.getBaseline('test')!;
      expect(baseline.count).toBe(5);
      // New window: [20, 30, 40, 50, 60] -> mean = 40
      expect(baseline.mean).toBe(40);
      expect(baseline.min).toBe(20);
      expect(baseline.max).toBe(60);
    });

    it('should use configured window size', () => {
      const detector3 = new AnomalyDetector(eventBus, 3);
      expect(detector3.getWindowSize()).toBe(3);

      detector3.record('w', 1);
      detector3.record('w', 2);
      detector3.record('w', 3);
      detector3.record('w', 100);

      // Window should contain [2, 3, 100]
      const baseline = detector3.getBaseline('w')!;
      expect(baseline.count).toBe(3);
      expect(baseline.min).toBe(2);
      expect(baseline.max).toBe(100);
    });

    it('should default to 1000 window size', () => {
      expect(detector.getWindowSize()).toBe(1000);
    });
  });

  describe('getBaseline()', () => {
    it('should return null for unknown metric', () => {
      expect(detector.getBaseline('nonexistent')).toBeNull();
    });

    it('should return correct statistics', () => {
      // Values: [10, 20, 30, 40, 50]
      detector.record('stats', 10);
      detector.record('stats', 20);
      detector.record('stats', 30);
      detector.record('stats', 40);
      detector.record('stats', 50);

      const baseline = detector.getBaseline('stats')!;
      expect(baseline.mean).toBe(30);
      expect(baseline.count).toBe(5);
      expect(baseline.min).toBe(10);
      expect(baseline.max).toBe(50);
      // Population stddev of [10,20,30,40,50] = sqrt(200) ~= 14.14
      expect(baseline.stddev).toBeCloseTo(Math.sqrt(200), 5);
    });

    it('should return zero stddev for identical values', () => {
      detector.record('same', 7);
      detector.record('same', 7);
      detector.record('same', 7);

      const baseline = detector.getBaseline('same')!;
      expect(baseline.stddev).toBe(0);
      expect(baseline.mean).toBe(7);
    });
  });

  describe('getRecentAnomalies()', () => {
    it('should return empty array when no anomalies exist', () => {
      expect(detector.getRecentAnomalies()).toEqual([]);
    });

    it('should return anomalies within time window', () => {
      // Build baseline and trigger anomaly
      for (let i = 0; i < 50; i++) {
        detector.record('test', 10);
      }
      detector.record('test', 10000);

      const anomalies = detector.getRecentAnomalies(24);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].metric).toBe('test');
      expect(anomalies[0].value).toBe(10000);
    });

    it('should filter out old anomalies', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-21T12:00:00Z'));

      // Build baseline and trigger anomaly 1 (old)
      for (let i = 0; i < 50; i++) {
        detector.record('old', 10);
      }
      detector.record('old', 10000);

      // Advance time by 2 hours
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      // Build baseline and trigger anomaly 2 (new)
      for (let i = 0; i < 50; i++) {
        detector.record('new', 10);
      }
      detector.record('new', 10000);

      // Using getRecentAnomalies(1) should include only the new anomaly
      const anomalies = detector.getRecentAnomalies(1);
      expect(anomalies.length).toBe(1);

      // Verify the anomaly is from the expected metric
      expect(anomalies[0].metric).toBe('new');

      vi.useRealTimers();
    });

    it('should include severity in anomaly events', () => {
      for (let i = 0; i < 50; i++) {
        detector.record('sev', 10);
      }
      detector.record('sev', 10000);

      const anomalies = detector.getRecentAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
      expect(['warning', 'critical']).toContain(anomalies[0].severity);
    });

    it('should default to 24 hours', () => {
      for (let i = 0; i < 50; i++) {
        detector.record('def', 10);
      }
      detector.record('def', 10000);

      // Should return results (anomaly was just created, within 24 hours)
      const anomalies = detector.getRecentAnomalies();
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle negative values', () => {
      for (let i = 0; i < 20; i++) {
        detector.record('neg', -50 + i);
      }
      const baseline = detector.getBaseline('neg')!;
      expect(baseline.min).toBe(-50);
      expect(baseline.max).toBe(-31);
    });

    it('should handle very large values without overflow', () => {
      detector.record('big', 1e15);
      detector.record('big', 1e15 + 1);

      const baseline = detector.getBaseline('big')!;
      expect(baseline.mean).toBeCloseTo(1e15 + 0.5, 0);
    });

    it('should handle rapid successive recordings', () => {
      for (let i = 0; i < 2000; i++) {
        detector.record('rapid', i);
      }

      // Window should only hold last 1000 values (1000-1999)
      const baseline = detector.getBaseline('rapid')!;
      expect(baseline.count).toBe(1000);
      expect(baseline.min).toBe(1000);
      expect(baseline.max).toBe(1999);
    });
  });
});
