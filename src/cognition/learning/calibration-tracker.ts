/**
 * Calibration Tracker
 *
 * Tracks prediction confidence vs actual outcomes to measure calibration quality.
 * Buckets predictions into confidence ranges and computes overconfidence/underconfidence bias.
 *
 * @module cognition/learning/calibration-tracker
 */

import { randomUUID } from 'node:crypto';

export interface Prediction {
  id: string;
  statement: string;
  confidence: number;
  outcome: boolean | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface CalibrationBucket {
  confidenceBucket: string;
  statedConfidence: number;
  actualAccuracy: number;
  delta: number;
  count: number;
}

export interface CalibrationReport {
  overconfidenceBias: number;
  underconfidenceBias: number;
  calibrationCurve: CalibrationBucket[];
  predictions: Array<{
    id: string;
    statement: string;
    confidence: number;
    outcome: boolean | null;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

const BUCKET_RANGES = [
  { label: '0-20%', min: 0, max: 0.2 },
  { label: '20-40%', min: 0.2, max: 0.4 },
  { label: '40-60%', min: 0.4, max: 0.6 },
  { label: '60-80%', min: 0.6, max: 0.8 },
  { label: '80-100%', min: 0.8, max: 1.0 },
];

export class CalibrationTracker {
  private predictions: Map<string, Prediction> = new Map();

  addPrediction(statement: string, confidence: number): string {
    const id = randomUUID();
    this.predictions.set(id, {
      id,
      statement,
      confidence,
      outcome: null,
      createdAt: new Date(),
      resolvedAt: null,
    });
    return id;
  }

  resolvePrediction(id: string, outcome: boolean): boolean {
    const prediction = this.predictions.get(id);
    if (!prediction) return false;

    prediction.outcome = outcome;
    prediction.resolvedAt = new Date();
    return true;
  }

  getPredictions(): Prediction[] {
    return [...this.predictions.values()];
  }

  getReport(): CalibrationReport {
    const all = [...this.predictions.values()];
    const resolved = all.filter((p) => p.outcome !== null);

    const buckets: CalibrationBucket[] = BUCKET_RANGES.map((range) => {
      const inBucket = resolved.filter(
        (p) => p.confidence >= range.min && p.confidence < (range.max === 1.0 ? 1.01 : range.max)
      );

      if (inBucket.length === 0) {
        return {
          confidenceBucket: range.label,
          statedConfidence: (range.min + range.max) / 2,
          actualAccuracy: 0,
          delta: 0,
          count: 0,
        };
      }

      const avgConfidence =
        inBucket.reduce((sum, p) => sum + p.confidence, 0) / inBucket.length;
      const accuracy =
        inBucket.filter((p) => p.outcome === true).length / inBucket.length;

      return {
        confidenceBucket: range.label,
        statedConfidence: avgConfidence,
        actualAccuracy: accuracy,
        delta: avgConfidence - accuracy,
        count: inBucket.length,
      };
    });

    // Overconfidence: avg(confidence - accuracy) where confidence > accuracy
    const overBuckets = buckets.filter((b) => b.count > 0 && b.statedConfidence > b.actualAccuracy);
    const overconfidenceBias = overBuckets.length > 0
      ? overBuckets.reduce((sum, b) => sum + (b.statedConfidence - b.actualAccuracy), 0) / overBuckets.length
      : 0;

    // Underconfidence: avg(accuracy - confidence) where accuracy > confidence
    const underBuckets = buckets.filter((b) => b.count > 0 && b.actualAccuracy > b.statedConfidence);
    const underconfidenceBias = underBuckets.length > 0
      ? underBuckets.reduce((sum, b) => sum + (b.actualAccuracy - b.statedConfidence), 0) / underBuckets.length
      : 0;

    return {
      overconfidenceBias,
      underconfidenceBias,
      calibrationCurve: buckets,
      predictions: all.map((p) => ({
        id: p.id,
        statement: p.statement,
        confidence: p.confidence,
        outcome: p.outcome,
        createdAt: p.createdAt.toISOString(),
        resolvedAt: p.resolvedAt?.toISOString() ?? null,
      })),
    };
  }
}
