/**
 * Cognition Page — Cognitive Layer 0 Dashboard
 *
 * This file re-exports the modular Cognition component from ./cognition/
 * The original 1334-line file has been split into focused sub-components:
 *
 * - constants.ts — Pillar config, types, helpers
 * - PillarHealthCard.tsx — Individual pillar health display
 * - LearningSection.tsx — Learning loop & analytics
 * - CouncilSection.tsx — Council member profiles
 * - InsightsSection.tsx — Insight timeline & type breakdown
 * - SourcesSection.tsx — Knowledge sources by pillar
 * - ActivityFeed.tsx — Real-time cognitive activity
 * - FrameworkUsageChart.tsx — Framework usage stats
 * - index.tsx — Main orchestration component
 */

export { default } from './cognition';
