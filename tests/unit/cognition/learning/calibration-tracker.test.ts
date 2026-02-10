import { describe, it, expect, beforeEach } from 'vitest';
import { CalibrationTracker } from '../../../../src/cognition/learning/calibration-tracker.js';

describe('CalibrationTracker', () => {
  let tracker: CalibrationTracker;

  beforeEach(() => {
    tracker = new CalibrationTracker();
  });

  describe('addPrediction', () => {
    it('should return a unique id', () => {
      const id1 = tracker.addPrediction('It will rain', 0.7);
      const id2 = tracker.addPrediction('It will snow', 0.3);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should store predictions retrievable via getPredictions', () => {
      tracker.addPrediction('Test statement', 0.6);

      const predictions = tracker.getPredictions();
      expect(predictions).toHaveLength(1);
      expect(predictions[0].statement).toBe('Test statement');
      expect(predictions[0].confidence).toBe(0.6);
      expect(predictions[0].outcome).toBeNull();
      expect(predictions[0].resolvedAt).toBeNull();
    });
  });

  describe('resolvePrediction', () => {
    it('should resolve an existing prediction', () => {
      const id = tracker.addPrediction('Test', 0.5);
      const result = tracker.resolvePrediction(id, true);

      expect(result).toBe(true);

      const predictions = tracker.getPredictions();
      expect(predictions[0].outcome).toBe(true);
      expect(predictions[0].resolvedAt).toBeInstanceOf(Date);
    });

    it('should return false for non-existent prediction', () => {
      const result = tracker.resolvePrediction('nonexistent', false);
      expect(result).toBe(false);
    });

    it('should handle false outcomes', () => {
      const id = tracker.addPrediction('Test', 0.9);
      tracker.resolvePrediction(id, false);

      const predictions = tracker.getPredictions();
      expect(predictions[0].outcome).toBe(false);
    });
  });

  describe('getReport', () => {
    it('should return empty report with no predictions', () => {
      const report = tracker.getReport();

      expect(report.overconfidenceBias).toBe(0);
      expect(report.underconfidenceBias).toBe(0);
      expect(report.calibrationCurve).toHaveLength(5);
      expect(report.predictions).toHaveLength(0);

      // All buckets should have count 0
      for (const bucket of report.calibrationCurve) {
        expect(bucket.count).toBe(0);
      }
    });

    it('should include unresolved predictions in report', () => {
      tracker.addPrediction('Unresolved', 0.5);

      const report = tracker.getReport();
      expect(report.predictions).toHaveLength(1);
      expect(report.predictions[0].outcome).toBeNull();
    });

    it('should serialize dates as ISO strings', () => {
      tracker.addPrediction('Test', 0.5);

      const report = tracker.getReport();
      expect(report.predictions[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(report.predictions[0].resolvedAt).toBeNull();
    });

    it('should compute calibration for resolved predictions', () => {
      // High confidence predictions — all correct (perfectly calibrated)
      for (let i = 0; i < 5; i++) {
        const id = tracker.addPrediction(`High confidence ${i}`, 0.9);
        tracker.resolvePrediction(id, true);
      }

      // Low confidence predictions — all wrong (well calibrated for low confidence)
      for (let i = 0; i < 5; i++) {
        const id = tracker.addPrediction(`Low confidence ${i}`, 0.1);
        tracker.resolvePrediction(id, false);
      }

      const report = tracker.getReport();

      // The 80-100% bucket should show ~0.9 confidence and 1.0 accuracy
      const highBucket = report.calibrationCurve.find(b => b.confidenceBucket === '80-100%');
      expect(highBucket).toBeDefined();
      expect(highBucket!.count).toBe(5);
      expect(highBucket!.actualAccuracy).toBe(1.0);

      // The 0-20% bucket should show ~0.1 confidence and 0.0 accuracy
      const lowBucket = report.calibrationCurve.find(b => b.confidenceBucket === '0-20%');
      expect(lowBucket).toBeDefined();
      expect(lowBucket!.count).toBe(5);
      expect(lowBucket!.actualAccuracy).toBe(0);
    });

    it('should detect overconfidence bias', () => {
      // Overconfident: say 90% but only right 40%
      for (let i = 0; i < 10; i++) {
        const id = tracker.addPrediction(`Overconfident ${i}`, 0.9);
        tracker.resolvePrediction(id, i < 4); // only 4/10 correct
      }

      const report = tracker.getReport();
      expect(report.overconfidenceBias).toBeGreaterThan(0);
    });

    it('should detect underconfidence bias', () => {
      // Underconfident: say 20% but right 80%
      for (let i = 0; i < 10; i++) {
        const id = tracker.addPrediction(`Underconfident ${i}`, 0.1);
        tracker.resolvePrediction(id, i < 8); // 8/10 correct
      }

      const report = tracker.getReport();
      expect(report.underconfidenceBias).toBeGreaterThan(0);
    });

    it('should handle mixed resolved and unresolved predictions', () => {
      const id1 = tracker.addPrediction('Resolved', 0.7);
      tracker.resolvePrediction(id1, true);
      tracker.addPrediction('Unresolved', 0.5);

      const report = tracker.getReport();
      expect(report.predictions).toHaveLength(2);
      // Only the resolved one contributes to calibration
      const bucketsWithData = report.calibrationCurve.filter(b => b.count > 0);
      expect(bucketsWithData).toHaveLength(1);
    });
  });
});
