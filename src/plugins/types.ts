import { z } from 'zod';
import type { EventBus } from '../kernel/event-bus.js';
import type { AIOrchestrator } from '../ai/orchestrator.js';
import type { CostTracker } from '../observability/cost-tracker.js';
import type { PluginRegistry } from './registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PLUGIN SYSTEM TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Plugin Status ────────────────────────────────────────────────────

export const PluginStatusSchema = z.enum([
  'registered',
  'initializing',
  'active',
  'error',
  'disabled',
  'shutdown',
]);
export type PluginStatus = z.infer<typeof PluginStatusSchema>;

// ── Plugin Capabilities ──────────────────────────────────────────────

export const PluginCapabilitySchema = z.enum([
  'briefing',     // Can contribute to morning/evening/weekly briefings
  'scheduling',   // Has cron-scheduled tasks
  'alerting',     // Can generate alerts (→ Telegram/Notion/SMS)
  'cli',          // Registers CLI commands
  'api',          // Registers API routes
  'initiative',   // Can discover autonomous work initiatives
  'data',         // Provides data feeds (crypto prices, card prices, etc.)
]);
export type PluginCapability = z.infer<typeof PluginCapabilitySchema>;

// ── Plugin Manifest ──────────────────────────────────────────────────

export const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Plugin ID must be kebab-case'),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver'),
  description: z.string().min(1),
  author: z.string().min(1),
  capabilities: z.array(PluginCapabilitySchema).min(1),
  dependencies: z.array(z.string()).default([]),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ── Plugin Dependencies (injected at init) ───────────────────────────

export interface PluginDependencies {
  eventBus: EventBus;
  orchestrator: AIOrchestrator;
  config: Record<string, unknown>;
  dataDir: string;
  costTracker: CostTracker | null;
  registry?: PluginRegistry;
  notionInbox?: unknown;
  /** RAG query function — injected from AutonomousAgent when available */
  ragQuery?: (question: string) => Promise<{ answer: string; sources: Array<{ title?: string; snippet: string; score: number }> } | null>;
}

// ── Briefing Contribution ────────────────────────────────────────────

export interface BriefingContribution {
  pluginId: string;
  section: string;
  content: string;
  priority: number;
  category: 'info' | 'alert' | 'action' | 'insight';
}

// ── Scheduled Task ───────────────────────────────────────────────────

export interface ScheduledTaskDefinition {
  id: string;
  name: string;
  cron: string;
  essential: boolean;
  handler: () => Promise<void>;
}

// ── Alert Contribution ───────────────────────────────────────────────

export interface AlertContribution {
  pluginId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionable: boolean;
  action?: string;
  data?: Record<string, unknown>;
}

// ── Initiative (for autonomous work) ─────────────────────────────────

export interface PluginInitiative {
  pluginId: string;
  title: string;
  description: string;
  priority: number;
  estimatedCost: number;
  category: string;
}

// ── Domain Plugin Interface ──────────────────────────────────────────

export interface DomainPlugin {
  readonly manifest: PluginManifest;

  // Lifecycle (required)
  initialize(deps: PluginDependencies): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): PluginStatus;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;

  // Integration hooks (optional — implement based on capabilities)
  contributeToBriefing?(type: 'morning' | 'evening' | 'weekly'): Promise<BriefingContribution | null>;
  getScheduledTasks?(): ScheduledTaskDefinition[];
  checkAlerts?(): Promise<AlertContribution[]>;
  discoverInitiatives?(): Promise<PluginInitiative[]>;
}
