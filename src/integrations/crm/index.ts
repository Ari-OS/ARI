/**
 * CRM Integration
 *
 * Barrel export for CRM system:
 * - CRMStore: SQLite-backed contact database with relationship scoring
 * - ContactManager: Intelligent contact operations with LLM query handling
 */

export { CRMStore, type Contact, type ContactCategory, type CRMStats } from './crm-store.js';
export {
  ContactManager,
  type Interaction,
  type FollowUpRecommendation,
  type CRMWeeklyReport,
} from './contact-manager.js';
