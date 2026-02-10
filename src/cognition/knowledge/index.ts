/**
 * ARI Cognitive Knowledge Module
 *
 * Exports curated knowledge sources and source management utilities.
 *
 * @module cognition/knowledge
 */

export { COGNITIVE_KNOWLEDGE_SOURCES } from './cognitive-sources.js';
export { SourceManager } from './source-manager.js';
export type { SourceStats } from './source-manager.js';
export { ContentValidator } from './content-validator.js';
export {
  getProfile,
  getAllProfiles,
  getProfilesByPillar,
  COUNCIL_COGNITIVE_PROFILES,
} from './specializations.js';
