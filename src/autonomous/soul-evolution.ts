/**
 * Soul Evolution — ARI's personality evolution system.
 *
 * ARI can propose changes to her own identity files (SOUL.md, IDENTITY.md,
 * PREFERENCES.md) in her workspace directory. Protected files (SOUL.md,
 * IDENTITY.md) require Pryce's explicit approval via Telegram before changes
 * are applied. PREFERENCES.md proposals can be auto-applied.
 *
 * The system supports:
 * - Targeted section proposals with unified diffs
 * - Weekly reflections that analyze interaction patterns
 * - Persistent proposal storage for async approval workflows
 * - Event-driven notifications for the approval pipeline
 *
 * @module autonomous/soul-evolution
 */

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import type { SoulProposal, SoulReflection } from './soul-evolution-types.js';

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const log = createLogger('soul-evolution');

// =============================================================================
// CONSTANTS
// =============================================================================

/** Files that require Pryce's explicit approval before changes are applied */
const PROTECTED_FILES = new Set(['SOUL.md', 'IDENTITY.md']);

/** Maximum number of proposals to retain in the persistent store */
const MAX_PROPOSALS = 200;

// =============================================================================
// TYPES
// =============================================================================

interface StoredProposals {
  proposals: SoulProposal[];
  lastUpdated: string;
}

interface OrchestratorLike {
  query(prompt: string, agent?: string): Promise<string>;
}

interface SoulEvolutionParams {
  eventBus: EventBus;
  orchestrator: OrchestratorLike;
  workspaceDir: string; // ~/.ari/workspace/
}

// =============================================================================
// SOUL EVOLUTION
// =============================================================================

export class SoulEvolution {
  private eventBus: EventBus;
  private orchestrator: OrchestratorLike;
  private workspaceDir: string;
  private proposals: SoulProposal[] = [];
  private persistPath: string;

  constructor(params: SoulEvolutionParams) {
    this.eventBus = params.eventBus;
    this.orchestrator = params.orchestrator;
    this.workspaceDir = params.workspaceDir;
    this.persistPath = path.join(params.workspaceDir, '..', 'soul', 'proposals.json');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize — load persisted proposals from disk.
   */
  async initialize(): Promise<void> {
    await this.loadProposals();
    log.info({ proposalCount: this.proposals.length }, 'Soul evolution initialized');
  }

  /**
   * Propose a change to a workspace file (SOUL.md, IDENTITY.md, PREFERENCES.md).
   *
   * Creates a proposal with a unified diff and persists it for later approval.
   * Protected files automatically set requiresPryceApproval = true.
   */
  async proposeChange(params: {
    file: string;
    section: string;
    currentContent: string;
    proposedContent: string;
    rationale: string;
  }): Promise<SoulProposal> {
    const diff = this.generateDiff(params.currentContent, params.proposedContent);
    const requiresPryceApproval = PROTECTED_FILES.has(params.file);

    const proposal: SoulProposal = {
      id: `soul-${randomUUID()}`,
      file: params.file,
      section: params.section,
      currentContent: params.currentContent,
      proposedContent: params.proposedContent,
      rationale: params.rationale,
      status: 'pending',
      createdAt: new Date().toISOString(),
      diff,
      requiresPryceApproval,
    };

    this.proposals.push(proposal);
    this.trimProposals();
    await this.persistProposals();

    this.eventBus.emit('audit:log', {
      action: 'soul:proposal_created',
      agent: 'SOUL_EVOLUTION',
      trustLevel: 'system',
      details: {
        proposalId: proposal.id,
        file: proposal.file,
        section: proposal.section,
        requiresPryceApproval,
      },
    });

    log.info(
      { proposalId: proposal.id, file: proposal.file, section: proposal.section },
      'Soul proposal created',
    );

    return proposal;
  }

  /**
   * Weekly reflection — ARI analyzes her interactions and proposes refinements.
   *
   * Uses the AI orchestrator to generate insights from interaction data,
   * then creates proposals for any identified improvements.
   */
  async weeklyReflection(params: {
    interactionCount: number;
    feedbackPositive: number;
    feedbackNegative: number;
    topTopics: string[];
    missedOpportunities?: string[];
  }): Promise<SoulReflection> {
    const prompt = this.buildReflectionPrompt(params);
    const rawResponse = await this.orchestrator.query(prompt, 'soul-evolution');
    const reflection = this.parseReflectionResponse(rawResponse, params);

    // Create proposals from the reflection
    for (const change of reflection.proposedChanges) {
      this.proposals.push(change);
    }

    if (reflection.proposedChanges.length > 0) {
      this.trimProposals();
      await this.persistProposals();
    }

    this.eventBus.emit('audit:log', {
      action: 'soul:reflection_completed',
      agent: 'SOUL_EVOLUTION',
      trustLevel: 'system',
      details: {
        insightCount: reflection.insights.length,
        proposedChanges: reflection.proposedChanges.length,
        overallSentiment: reflection.overallSentiment,
        interactionCount: params.interactionCount,
        feedbackPositive: params.feedbackPositive,
        feedbackNegative: params.feedbackNegative,
      },
    });

    log.info(
      {
        insights: reflection.insights.length,
        changes: reflection.proposedChanges.length,
        sentiment: reflection.overallSentiment,
      },
      'Weekly reflection completed',
    );

    return reflection;
  }

  /**
   * Apply an approved proposal — writes file changes to workspace.
   *
   * Only proposals with status 'approved' can be applied.
   * Returns true if the change was written, false if the proposal
   * was not found or not approved.
   */
  async applyProposal(proposalId: string): Promise<boolean> {
    const proposal = this.proposals.find(p => p.id === proposalId);

    if (!proposal) {
      log.warn({ proposalId }, 'Proposal not found');
      return false;
    }

    if (proposal.status !== 'approved') {
      log.warn(
        { proposalId, status: proposal.status },
        'Cannot apply unapproved proposal',
      );
      return false;
    }

    const filePath = path.join(this.workspaceDir, proposal.file);

    try {
      // Read the current file content
      let fileContent: string;
      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        // File does not exist yet — start with empty content
        fileContent = '';
      }

      // Replace the section content
      const updatedContent = this.applySectionChange(
        fileContent,
        proposal.section,
        proposal.currentContent,
        proposal.proposedContent,
      );

      // Write the updated file
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, updatedContent, 'utf-8');

      this.eventBus.emit('audit:log', {
        action: 'soul:proposal_approved',
        agent: 'SOUL_EVOLUTION',
        trustLevel: 'system',
        details: {
          proposalId: proposal.id,
          file: proposal.file,
          section: proposal.section,
        },
      });

      log.info({ proposalId, file: proposal.file }, 'Proposal applied successfully');
      return true;
    } catch (err: unknown) {
      log.error({ err, proposalId, file: proposal.file }, 'Failed to apply proposal');
      return false;
    }
  }

  /**
   * Get all pending proposals.
   */
  getPendingProposals(): SoulProposal[] {
    return this.proposals.filter(p => p.status === 'pending');
  }

  /**
   * Get a proposal by ID.
   */
  getProposal(proposalId: string): SoulProposal | undefined {
    return this.proposals.find(p => p.id === proposalId);
  }

  /**
   * Update a proposal's status (approve or reject).
   */
  async updateProposalStatus(
    proposalId: string,
    status: 'approved' | 'rejected',
  ): Promise<boolean> {
    const proposal = this.proposals.find(p => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') {
      return false;
    }

    proposal.status = status;
    await this.persistProposals();
    return true;
  }

  /**
   * Shutdown — persist final state.
   */
  async shutdown(): Promise<void> {
    await this.persistProposals();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a unified-diff-style string showing changes.
   */
  private generateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffLines: string[] = [];

    // Simple line-by-line diff (not a full diff algorithm, but clear for review)
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;

      if (oldLine === newLine) {
        if (oldLine !== undefined) {
          diffLines.push(` ${oldLine}`);
        }
      } else {
        if (oldLine !== undefined) {
          diffLines.push(`-${oldLine}`);
        }
        if (newLine !== undefined) {
          diffLines.push(`+${newLine}`);
        }
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Apply a section change within a file.
   * If the currentContent is found, replace it. Otherwise append.
   */
  private applySectionChange(
    fileContent: string,
    _section: string,
    currentContent: string,
    proposedContent: string,
  ): string {
    if (currentContent && fileContent.includes(currentContent)) {
      return fileContent.replace(currentContent, proposedContent);
    }

    // If current content not found, append the proposed content
    const separator = fileContent.endsWith('\n') || fileContent === '' ? '' : '\n';
    return `${fileContent}${separator}\n## ${_section}\n\n${proposedContent}\n`;
  }

  /**
   * Build the reflection prompt for the AI orchestrator.
   */
  private buildReflectionPrompt(params: {
    interactionCount: number;
    feedbackPositive: number;
    feedbackNegative: number;
    topTopics: string[];
    missedOpportunities?: string[];
  }): string {
    const missedSection = params.missedOpportunities?.length
      ? `\nMissed opportunities:\n${params.missedOpportunities.map(m => `- ${m}`).join('\n')}`
      : '';

    return [
      'You are ARI, reflecting on your week. Analyze these interaction metrics',
      'and suggest improvements to your personality and communication style.',
      '',
      `Interactions: ${params.interactionCount}`,
      `Positive feedback: ${params.feedbackPositive}`,
      `Negative feedback: ${params.feedbackNegative}`,
      `Top topics: ${params.topTopics.join(', ')}`,
      missedSection,
      '',
      'Respond in this exact JSON format:',
      '{',
      '  "insights": ["insight1", "insight2"],',
      '  "overallSentiment": "growing" | "stable" | "struggling",',
      '  "weekSummary": "brief summary",',
      '  "proposedChanges": [',
      '    {',
      '      "file": "PREFERENCES.md",',
      '      "section": "section name",',
      '      "currentContent": "what is there now",',
      '      "proposedContent": "what should replace it",',
      '      "rationale": "why this change"',
      '    }',
      '  ]',
      '}',
    ].join('\n');
  }

  /**
   * Parse the AI orchestrator's response into a SoulReflection.
   * Gracefully handles malformed responses.
   */
  private parseReflectionResponse(
    rawResponse: string,
    params: {
      interactionCount: number;
      feedbackPositive: number;
      feedbackNegative: number;
    },
  ): SoulReflection {
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackReflection(rawResponse, params);
      }

      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const insights = Array.isArray(parsed.insights)
        ? (parsed.insights as string[])
        : [rawResponse.slice(0, 200)];

      const sentiment = this.validateSentiment(parsed.overallSentiment);

      const weekSummary = typeof parsed.weekSummary === 'string'
        ? parsed.weekSummary
        : `Week with ${params.interactionCount} interactions`;

      const proposedChanges = this.parseProposedChanges(parsed.proposedChanges);

      return { insights, proposedChanges, overallSentiment: sentiment, weekSummary };
    } catch {
      return this.fallbackReflection(rawResponse, params);
    }
  }

  /**
   * Parse proposed changes from the AI response.
   */
  private parseProposedChanges(raw: unknown): SoulProposal[] {
    if (!Array.isArray(raw)) return [];

    const proposals: SoulProposal[] = [];
    for (const item of raw) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'file' in item &&
        'section' in item &&
        'proposedContent' in item &&
        'rationale' in item
      ) {
        const entry = item as Record<string, string>;
        const file = entry.file ?? 'PREFERENCES.md';
        const currentContent = entry.currentContent ?? '';
        const proposedContent = entry.proposedContent ?? '';

        proposals.push({
          id: `soul-${randomUUID()}`,
          file,
          section: entry.section ?? 'General',
          currentContent,
          proposedContent,
          rationale: entry.rationale ?? 'Identified during weekly reflection',
          status: 'pending',
          createdAt: new Date().toISOString(),
          diff: this.generateDiff(currentContent, proposedContent),
          requiresPryceApproval: PROTECTED_FILES.has(file),
        });
      }
    }

    return proposals;
  }

  /**
   * Validate sentiment value, defaulting to 'stable' for unknown values.
   */
  private validateSentiment(
    value: unknown,
  ): 'growing' | 'stable' | 'struggling' {
    if (value === 'growing' || value === 'stable' || value === 'struggling') {
      return value;
    }
    return 'stable';
  }

  /**
   * Fallback reflection when AI response cannot be parsed.
   */
  private fallbackReflection(
    rawResponse: string,
    params: { interactionCount: number; feedbackPositive: number; feedbackNegative: number },
  ): SoulReflection {
    const feedbackRatio = params.feedbackPositive / Math.max(1, params.feedbackPositive + params.feedbackNegative);
    const sentiment: 'growing' | 'stable' | 'struggling' =
      feedbackRatio > 0.7 ? 'growing' : feedbackRatio > 0.4 ? 'stable' : 'struggling';

    return {
      insights: [rawResponse.slice(0, 200) || 'Reflection data was inconclusive'],
      proposedChanges: [],
      overallSentiment: sentiment,
      weekSummary: `Week with ${params.interactionCount} interactions, ` +
        `${params.feedbackPositive} positive / ${params.feedbackNegative} negative feedback`,
    };
  }

  /**
   * Trim proposals to stay within MAX_PROPOSALS limit.
   * Keeps the most recent proposals, preferring pending ones.
   */
  private trimProposals(): void {
    if (this.proposals.length <= MAX_PROPOSALS) return;

    // Sort: pending first, then by createdAt descending
    const sorted = [...this.proposals].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    this.proposals = sorted.slice(0, MAX_PROPOSALS);
  }

  /**
   * Persist proposals to disk.
   */
  private async persistProposals(): Promise<void> {
    try {
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      const state: StoredProposals = {
        proposals: this.proposals,
        lastUpdated: new Date().toISOString(),
      };

      const tmpPath = `${this.persistPath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      try {
        await fs.rename(tmpPath, this.persistPath);
      } catch {
        await fs.writeFile(this.persistPath, JSON.stringify(state, null, 2), 'utf-8');
      }
    } catch (err: unknown) {
      log.error({ err }, 'Failed to persist soul proposals');
    }
  }

  /**
   * Load proposals from disk.
   */
  private async loadProposals(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const state = JSON.parse(data) as StoredProposals;
      this.proposals = state.proposals ?? [];
    } catch {
      // No state file or corrupted — start fresh (expected on first run)
      this.proposals = [];
    }
  }
}
