/**
 * ARI Cognitive Learning Module
 *
 * Continuous self-improvement through decision analysis.
 *
 * @module cognition/learning
 */

export { DecisionJournal, getDecisionJournal, createDecisionJournal } from './decision-journal.js';
export type { JournalEntry } from './decision-journal.js';
export { PerformanceReviewer } from './performance-review.js';
export { GapAnalyzer } from './gap-analysis.js';
export { SelfAssessor } from './self-assessment.js';
export type { AssessmentInput } from './self-assessment.js';
export { LearningLoop } from './learning-loop.js';
export type { LearningLoopStatus } from './learning-loop.js';
export { CalibrationTracker } from './calibration-tracker.js';
export type { Prediction, CalibrationReport, CalibrationBucket } from './calibration-tracker.js';
