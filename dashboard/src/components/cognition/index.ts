/**
 * Cognition Components — React wrappers for cognitive visualization
 *
 * These components render normalized cognitive metrics in the dashboard
 * using the 0-10 scoring system, traffic lights, and recommendations.
 */

export {
  InsightBlockRenderer,
  Gauge,
  TrafficLightIndicator,
  ActionBadge,
  MetricRow,
  RecommendationBox,
  PillarComparison,
  QuickStatus,
  Sparkline,
  type Pillar,
  type ScoreCategory,
  type TrafficLight,
  type ActionType,
  type NormalizedMetric,
  type InsightBlockProps,
} from './InsightBlockRenderer';

export {
  SkillProgressCard,
  ReviewCalendar,
  LearningLoopProgress,
  StreakDisplay,
  CardsDue,
  type SkillProficiency,
  type ReviewActivity,
  type LearningStage,
} from './LearningProgress';
